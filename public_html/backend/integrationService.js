/**
 * Apptivia Integration Service — Core Framework
 * -----------------------------------------------
 * Provides OAuth 2.0 flow orchestration, AES-256-GCM token encryption,
 * provider registry, sync engine, and CRUD helpers for all integrations.
 *
 * Each provider (Salesforce, HubSpot, etc.) is a separate module in ./providers/
 * that exports a standard interface and is registered via registerProvider().
 *
 * Env vars:
 *   INTEGRATION_ENCRYPTION_KEY — 32-byte hex key for AES-256-GCM (required)
 *   FRONTEND_URL               — Base URL for OAuth redirect (e.g. https://apptivia.app)
 *   BACKEND_URL                — Public backend URL for OAuth callbacks
 */

'use strict';

const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────

function env(key) {
  return process.env[key] || '';
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ── Encryption (AES-256-GCM) ────────────────────────────────

const ALGO = 'aes-256-gcm';

function getEncryptionKey() {
  const hex = env('INTEGRATION_ENCRYPTION_KEY');
  if (!hex || hex.length !== 64) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

function encryptCredentials(obj) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let enc = cipher.update(JSON.stringify(obj), 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), data: enc, tag };
}

function decryptCredentials(encrypted) {
  if (!encrypted || !encrypted.iv || !encrypted.data || !encrypted.tag) {
    return encrypted; // plaintext fallback for legacy data
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(encrypted.data, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

// ── Provider Registry ────────────────────────────────────────

const _providers = {};

function registerProvider(providerModule) {
  if (!providerModule || !providerModule.type) {
    throw new Error('Provider must export a `type` string');
  }
  _providers[providerModule.type] = providerModule;
}

function getProvider(type) {
  return _providers[type] || null;
}

function listProviders() {
  return Object.keys(_providers);
}

// ── OAuth Flow ───────────────────────────────────────────────

/**
 * Initiate OAuth flow for a provider.
 * Generates CSRF state, stores it in the integrations row, and returns the auth URL.
 */
async function initOAuth(sb, organizationId, providerType, createdBy, profileId) {
  const provider = getProvider(providerType);
  if (!provider || !provider.getAuthUrl) {
    throw new Error(`Provider '${providerType}' does not support OAuth`);
  }

  const state = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Upsert integration row for this org+provider (+profile if personal)
  let query = sb.from('integrations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('integration_type', providerType);
  if (profileId) {
    query = query.eq('profile_id', profileId);
  } else {
    query = query.is('profile_id', null);
  }
  const { data: existing } = await query.maybeSingle();

  let integrationId;
  if (existing) {
    integrationId = existing.id;
    await sb.from('integrations').update({
      oauth_state: state,
      oauth_state_expires_at: expiresAt,
    }).eq('id', integrationId);
  } else {
    const insertData = {
      organization_id: organizationId,
      integration_type: providerType,
      display_name: providerType,
      is_enabled: false,
      status: 'disconnected',
      credentials: {},
      oauth_state: state,
      oauth_state_expires_at: expiresAt,
      created_by: createdBy,
    };
    if (profileId) insertData.profile_id = profileId;
    const { data: created } = await sb.from('integrations').insert(insertData).select('id').single();
    integrationId = created.id;
  }

  const backendUrl = env('BACKEND_URL') || env('FRONTEND_URL');
  const redirectUri = `${backendUrl}/api/integrations/oauth/${providerType}/callback`;
  const authUrl = provider.getAuthUrl({ id: integrationId, organization_id: organizationId }, state, redirectUri);

  return { authUrl, integrationId };
}

/**
 * Handle OAuth callback — validate state, exchange code, encrypt and store tokens.
 */
async function handleOAuthCallback(sb, providerType, code, state) {
  const provider = getProvider(providerType);
  if (!provider || !provider.exchangeCode) {
    throw new Error(`Provider '${providerType}' does not support OAuth`);
  }

  // Find integration by state
  const { data: integration } = await sb.from('integrations')
    .select('*')
    .eq('integration_type', providerType)
    .eq('oauth_state', state)
    .maybeSingle();

  if (!integration) {
    throw new Error('Invalid OAuth state — no matching integration found');
  }

  if (new Date(integration.oauth_state_expires_at) < new Date()) {
    throw new Error('OAuth state expired — please try connecting again');
  }

  // Exchange code for tokens
  const backendUrl = env('BACKEND_URL') || env('FRONTEND_URL');
  const redirectUri = `${backendUrl}/api/integrations/oauth/${providerType}/callback`;
  const tokens = await provider.exchangeCode(code, redirectUri);

  // Encrypt and store
  const encrypted = encryptCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope,
    instance_url: tokens.instance_url,
    ...(tokens.extra || {}),
  });

  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await sb.from('integrations').update({
    credentials: encrypted,
    status: 'connected',
    is_enabled: true,
    token_expires_at: tokenExpiresAt,
    instance_url: tokens.instance_url || null,
    scopes: tokens.scope ? tokens.scope.split(/[\s,]+/) : null,
    oauth_state: null,
    oauth_state_expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', integration.id);

  return { integrationId: integration.id, organizationId: integration.organization_id };
}

// ── Token Refresh ────────────────────────────────────────────

/**
 * Ensure the integration has a fresh access token.
 * Auto-refreshes if token expires within 5 minutes.
 * Returns the integration with decrypted credentials attached.
 */
async function ensureFreshToken(sb, integration) {
  const creds = decryptCredentials(integration.credentials);

  if (!integration.token_expires_at) {
    return { ...integration, decryptedCreds: creds };
  }

  const expiresAt = new Date(integration.token_expires_at);
  const bufferMs = 5 * 60 * 1000;

  if (Date.now() < expiresAt.getTime() - bufferMs) {
    return { ...integration, decryptedCreds: creds };
  }

  // Token needs refresh
  const provider = getProvider(integration.integration_type);
  if (!provider || !provider.refreshToken) {
    console.error(`[integration] No refresh handler for ${integration.integration_type}`);
    return { ...integration, decryptedCreds: creds };
  }

  try {
    const newTokens = await provider.refreshToken(creds);
    const mergedCreds = { ...creds, ...newTokens };
    const encrypted = encryptCredentials(mergedCreds);
    const newExpiresAt = newTokens.expires_in
      ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
      : null;

    await sb.from('integrations').update({
      credentials: encrypted,
      token_expires_at: newExpiresAt,
      instance_url: newTokens.instance_url || integration.instance_url,
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    return {
      ...integration,
      credentials: encrypted,
      token_expires_at: newExpiresAt,
      decryptedCreds: mergedCreds,
    };
  } catch (err) {
    console.error(`[integration] Token refresh failed for ${integration.id}:`, err.message);
    await sb.from('integrations').update({
      status: 'error',
      last_sync_error: `Token refresh failed: ${err.message}`,
    }).eq('id', integration.id);
    throw err;
  }
}

// ── Sync Engine ──────────────────────────────────────────────

/**
 * Run a full sync for an integration across all (or specified) entity types.
 * Handles pagination via cursors, KPI mapping, and audit logging.
 */
async function runIntegrationSync(sb, integrationId, entityTypes) {
  const { data: integration, error: fetchErr } = await sb.from('integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (fetchErr || !integration) {
    console.error(`[sync] Integration ${integrationId} not found`);
    return { error: 'Integration not found' };
  }

  if (integration.status === 'disconnected') {
    return { error: 'Integration is disconnected' };
  }

  const provider = getProvider(integration.integration_type);
  if (!provider || !provider.sync) {
    return { error: `No sync handler for ${integration.integration_type}` };
  }

  const types = entityTypes || Object.keys(provider.sync);
  const results = { total: 0, created: 0, updated: 0, failed: 0, errors: [] };

  // Create sync history record
  const { data: syncRun } = await sb.from('integration_sync_history').insert({
    integration_id: integrationId,
    organization_id: integration.organization_id,
    status: 'running',
    sync_started_at: new Date().toISOString(),
  }).select('id').single();

  await sb.from('integrations').update({ status: 'syncing' }).eq('id', integrationId);

  for (const entityType of types) {
    if (!provider.sync[entityType]) continue;

    try {
      // Ensure fresh token before each entity type sync
      const freshIntegration = await ensureFreshToken(sb, integration);

      // Get cursor for incremental sync
      const { data: cursor } = await sb.from('integration_sync_cursors')
        .select('*')
        .eq('integration_id', integrationId)
        .eq('entity_type', entityType)
        .maybeSingle();

      const syncResult = await provider.sync[entityType](
        freshIntegration,
        cursor?.last_sync_cursor
      );

      const records = syncResult.records || [];
      const nextCursor = syncResult.nextCursor;
      const kpiMappings = syncResult.kpiMappings || [];

      // Process KPI mappings from synced records
      for (const mapping of kpiMappings) {
        try {
          await upsertKpiValue(sb, mapping, integration);
          results.created++;
        } catch (kpiErr) {
          if (kpiErr.code !== '23505') { // Ignore duplicate key
            results.failed++;
            results.errors.push(`KPI upsert: ${kpiErr.message}`);
          }
        }
      }

      // Process calendar events if returned
      if (syncResult.calendarEvents?.length) {
        for (const evt of syncResult.calendarEvents) {
          await upsertCalendarEvent(sb, evt, integration);
        }
      }

      // Update cursor
      await sb.from('integration_sync_cursors').upsert({
        integration_id: integrationId,
        entity_type: entityType,
        last_sync_cursor: nextCursor || cursor?.last_sync_cursor,
        last_synced_at: new Date().toISOString(),
        records_synced: (cursor?.records_synced || 0) + records.length,
      }, { onConflict: 'integration_id,entity_type' });

      results.total += records.length;
    } catch (err) {
      results.failed++;
      results.errors.push(`${entityType}: ${err.message}`);
      console.error(`[sync] ${entityType} error for ${integrationId}:`, err.message);
    }
  }

  // Finalize sync history
  const finalStatus = results.failed > 0 && results.total > 0 ? 'partial'
    : results.failed > 0 ? 'failed' : 'success';

  await sb.from('integration_sync_history').update({
    status: finalStatus,
    sync_completed_at: new Date().toISOString(),
    records_processed: results.total,
    records_created: results.created,
    records_updated: results.updated,
    records_failed: results.failed,
    error_message: results.errors.length ? results.errors.join('; ') : null,
  }).eq('id', syncRun.id);

  await sb.from('integrations').update({
    status: 'connected',
    last_sync_at: new Date().toISOString(),
    last_sync_status: finalStatus,
    last_sync_error: results.errors.length ? results.errors.join('; ') : null,
    updated_at: new Date().toISOString(),
  }).eq('id', integrationId);

  return results;
}

// ── KPI Value Upsert ─────────────────────────────────────────

/**
 * Upsert a KPI value from an integration sync.
 * mapping: { profileId, kpiKey, value, increment, source, externalEventId, weekStart }
 */
async function upsertKpiValue(sb, mapping, integration) {
  // Resolve KPI metric ID — kpi_metrics.key is globally unique (no org scoping)
  const { data: metric } = await sb.from('kpi_metrics')
    .select('id')
    .eq('key', mapping.kpiKey)
    .eq('is_active', true)
    .maybeSingle();

  if (!metric) return; // KPI not defined or inactive

  const weekStart = mapping.weekStart || getWeekStart();

  if (mapping.increment) {
    // Increment mode — add to existing value
    const { data: existing } = await sb.from('kpi_values')
      .select('id, value')
      .eq('profile_id', mapping.profileId)
      .eq('kpi_id', metric.id)
      .eq('period_start', weekStart)
      .maybeSingle();

    if (existing) {
      await sb.from('kpi_values').update({
        value: existing.value + mapping.increment,
        source: mapping.source || integration.integration_type,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await sb.from('kpi_values').insert({
        profile_id: mapping.profileId,
        kpi_id: metric.id,
        period_start: weekStart,
        period_end: getWeekEnd(weekStart),
        value: mapping.increment,
        source: mapping.source || integration.integration_type,
        external_event_id: mapping.externalEventId || null,
      });
    }
  } else {
    // Set mode — upsert with exact value
    await sb.from('kpi_values').upsert({
      profile_id: mapping.profileId,
      kpi_id: metric.id,
      period_start: weekStart,
      period_end: getWeekEnd(weekStart),
      value: mapping.value || 0,
      source: mapping.source || integration.integration_type,
      external_event_id: mapping.externalEventId || null,
    }, { onConflict: 'external_event_id' });
  }
}

// ── Calendar Event Upsert ────────────────────────────────────

async function upsertCalendarEvent(sb, evt, integration) {
  await sb.from('integration_calendar_events').upsert({
    integration_id: integration.id,
    organization_id: integration.organization_id,
    profile_id: evt.profileId || null,
    external_event_id: evt.externalEventId,
    title: evt.title,
    description: evt.description || null,
    start_time: evt.startTime,
    end_time: evt.endTime,
    location: evt.location || null,
    attendees: evt.attendees || [],
    is_all_day: evt.isAllDay || false,
    organizer_email: evt.organizerEmail || null,
    event_type: evt.eventType || 'meeting',
    external_link: evt.externalLink || null,
    raw_data: evt.rawData || {},
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'integration_id,external_event_id' });
}

// ── Date Helpers ─────────────────────────────────────────────

function getWeekStart(fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

// ── User Mapping ─────────────────────────────────────────────

/**
 * Resolve an external user email to an Apptivia profile ID.
 * Uses cached mapping from integration.sync_config.userMap, falling back to email lookup.
 */
async function resolveProfileByEmail(sb, organizationId, email) {
  if (!email) return null;
  const { data: profile } = await sb.from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('email', email.trim())
    .maybeSingle();
  return profile?.id || null;
}

// ── CRUD Helpers ─────────────────────────────────────────────

async function listIntegrations(sb, organizationId, { profileId } = {}) {
  let query = sb.from('integrations')
    .select('id, integration_type, display_name, is_enabled, status, last_sync_at, last_sync_status, last_sync_error, instance_url, scopes, profile_id, created_at, updated_at')
    .eq('organization_id', organizationId);

  if (profileId) {
    // Personal integrations for a specific user
    query = query.eq('profile_id', profileId);
  } else {
    // Org-level integrations only (profile_id IS NULL)
    query = query.is('profile_id', null);
  }

  const { data, error } = await query.order('created_at');
  if (error) throw error;
  return data || [];
}

async function getIntegration(sb, integrationId, organizationId) {
  const { data, error } = await sb.from('integrations')
    .select('*')
    .eq('id', integrationId)
    .eq('organization_id', organizationId)
    .single();
  if (error) throw error;
  return data;
}

async function disconnectIntegration(sb, integrationId) {
  const { data: integration } = await sb.from('integrations')
    .select('integration_type, credentials')
    .eq('id', integrationId)
    .single();

  if (integration) {
    // Attempt to revoke token with provider if supported
    const provider = getProvider(integration.integration_type);
    if (provider?.revokeToken && integration.credentials) {
      try {
        const creds = decryptCredentials(integration.credentials);
        await provider.revokeToken(creds);
      } catch (err) {
        console.warn(`[integration] Token revocation failed for ${integrationId}:`, err.message);
      }
    }
  }

  await sb.from('integrations').update({
    status: 'disconnected',
    is_enabled: false,
    credentials: {},
    token_expires_at: null,
    instance_url: null,
    scopes: null,
    updated_at: new Date().toISOString(),
  }).eq('id', integrationId);

  // Clear sync cursors
  await sb.from('integration_sync_cursors')
    .delete()
    .eq('integration_id', integrationId);
}

async function getSyncHistory(sb, integrationId, limit = 20) {
  const { data, error } = await sb.from('integration_sync_history')
    .select('*')
    .eq('integration_id', integrationId)
    .order('sync_started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// ── Webhook Processing ───────────────────────────────────────

/**
 * Generic webhook handler — routes to the appropriate provider.
 */
async function processWebhook(sb, providerType, req) {
  const provider = getProvider(providerType);
  if (!provider) {
    return { error: `Unknown provider: ${providerType}` };
  }

  // Verify webhook signature if provider supports it
  if (provider.verifyWebhook && !provider.verifyWebhook(req)) {
    return { error: 'Invalid webhook signature' };
  }

  if (!provider.mapWebhookEvent || !provider.kpiMap) {
    return { error: `Provider '${providerType}' does not support webhooks` };
  }

  const event = provider.mapWebhookEvent(req.body);
  if (!event || !event.eventName) {
    return { processed: false, reason: 'Unrecognized event' };
  }

  const kpiUpdates = provider.kpiMap[event.eventName];
  if (!kpiUpdates?.length) {
    // Log but skip unmapped events
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: event.eventName,
      external_id: event.eventId || null,
      payload: req.body,
      processed: false,
    });
    return { processed: false, reason: `No KPI mapping for ${event.eventName}` };
  }

  // Resolve user
  const profileId = event.userEmail
    ? await resolveProfileByEmail(sb, event.organizationId, event.userEmail)
    : null;

  if (!profileId && event.userEmail) {
    // Lookup org from email domain or integration
    // If we can't resolve the user, log but skip
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: event.eventName,
      external_id: event.eventId || null,
      payload: req.body,
      processed: false,
      error: `Could not resolve profile for email: ${event.userEmail}`,
    });
    return { processed: false, reason: 'User not found' };
  }

  // Process KPI updates
  const weekStart = getWeekStart();
  const kpisUpdated = [];

  for (const update of kpiUpdates) {
    const externalEventId = `${providerType}:${event.eventId}:${update.key}`;
    try {
      await upsertKpiValue(sb, {
        profileId,
        kpiKey: update.key,
        increment: update.increment || 1,
        source: providerType,
        externalEventId,
        weekStart,
      }, { organization_id: event.organizationId, integration_type: providerType });
      kpisUpdated.push(update.key);
    } catch (err) {
      if (err.code === '23505') continue; // Duplicate — already processed
      console.error(`[webhook] KPI upsert error:`, err.message);
    }
  }

  // Audit log
  await sb.from('webhook_events').insert({
    source: providerType,
    event_type: event.eventName,
    external_id: event.eventId || null,
    organization_id: event.organizationId || null,
    profile_id: profileId,
    payload: req.body,
    processed: true,
    kpis_updated: kpisUpdated,
  });

  return { processed: true, kpisUpdated };
}

// ── Scheduled Sync (called by CronManager) ───────────────────

/**
 * Run scheduled syncs for all connected integrations that are due.
 */
async function runScheduledSyncs(sb) {
  if (!sb) return { synced: 0, checked: 0 };

  const { data: integrations } = await sb.from('integrations')
    .select('id, integration_type, sync_config, last_sync_at')
    .eq('status', 'connected')
    .eq('is_enabled', true);

  let synced = 0;
  const list = integrations || [];

  for (const integ of list) {
    const freq = integ.sync_config?.frequency || 'daily';
    const lastSync = integ.last_sync_at ? new Date(integ.last_sync_at) : new Date(0);

    const intervals = { hourly: 3600000, daily: 86400000, weekly: 604800000 };
    const intervalMs = intervals[freq] || intervals.daily;

    if (Date.now() - lastSync.getTime() >= intervalMs) {
      try {
        await runIntegrationSync(sb, integ.id);
        synced++;
      } catch (err) {
        console.error(`[cron:integration-sync] Error syncing ${integ.id}:`, err.message);
      }
    }
  }

  return { synced, checked: list.length };
}

// ── Calendar Push Helpers ────────────────────────────────────

async function createCalendarEvent(sb, integrationId, eventData) {
  const { data: integration } = await sb.from('integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (!integration || integration.status !== 'connected') {
    throw new Error('Integration is not connected');
  }

  const provider = getProvider(integration.integration_type);
  if (!provider?.push?.createMeeting) {
    throw new Error(`Provider '${integration.integration_type}' does not support creating meetings`);
  }

  const freshIntegration = await ensureFreshToken(sb, integration);
  const result = await provider.push.createMeeting(freshIntegration, eventData);

  // Store locally
  if (result?.externalId) {
    await upsertCalendarEvent(sb, {
      externalEventId: result.externalId,
      title: eventData.title,
      description: eventData.description,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      location: eventData.location,
      attendees: eventData.attendees,
      organizerEmail: eventData.organizerEmail,
      externalLink: result.webLink || null,
      profileId: eventData.profileId,
    }, integration);
  }

  return result;
}

async function getCalendarEvents(sb, integrationId, organizationId, startDate, endDate) {
  const { data, error } = await sb.from('integration_calendar_events')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('organization_id', organizationId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time');
  if (error) throw error;
  return data || [];
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  // Encryption
  encryptCredentials,
  decryptCredentials,

  // Provider registry
  registerProvider,
  getProvider,
  listProviders,

  // OAuth
  initOAuth,
  handleOAuthCallback,

  // Token management
  ensureFreshToken,

  // Sync engine
  runIntegrationSync,
  runScheduledSyncs,

  // KPI / Calendar helpers
  upsertKpiValue,
  upsertCalendarEvent,
  resolveProfileByEmail,

  // CRUD
  listIntegrations,
  getIntegration,
  disconnectIntegration,
  getSyncHistory,

  // Webhooks
  processWebhook,

  // Calendar
  createCalendarEvent,
  getCalendarEvents,

  // Utilities
  fetchJson,
  getWeekStart,
  getWeekEnd,
};
