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

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000; // exponential: 2s, 4s, 8s

async function withRetry(fn, label, maxAttempts = MAX_RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (attempt >= maxAttempts || !isRetryable) throw err;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[sync:retry] ${label} attempt ${attempt}/${maxAttempts} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

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

      const syncResult = await withRetry(
        () => provider.sync[entityType](freshIntegration, cursor?.last_sync_cursor, sb),
        `${integration.integration_type}:${entityType}`
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

  // Notify admins on sync failure
  if (finalStatus === 'failed' || finalStatus === 'partial') {
    notifySyncFailure(sb, integration, results.errors).catch(() => {});
  }

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
  const aggregation = mapping.aggregation || (mapping.increment ? 'sum' : 'set');
  const src = mapping.source || integration.integration_type;

  if (aggregation === 'sum' && mapping.increment) {
    // Sum mode — atomic increment via RPC (eliminates read-then-write race)
    // external_event_id enables dedup across both webhook and cron sync paths.
    await sb.rpc('upsert_kpi_sum', {
      p_profile_id:        mapping.profileId,
      p_kpi_id:            metric.id,
      p_period_start:      weekStart,
      p_period_end:        getWeekEnd(weekStart),
      p_increment:         mapping.increment,
      p_source:            src,
      p_external_event_id: mapping.externalEventId || null,
    });
  } else if (aggregation === 'max') {
    // Max mode — keep the highest value for the week (e.g. longest_monologue_sec)
    const { data: existing } = await sb.from('kpi_values')
      .select('id, value')
      .eq('profile_id', mapping.profileId)
      .eq('kpi_id', metric.id)
      .eq('period_start', weekStart)
      .maybeSingle();

    if (existing) {
      if (mapping.value > existing.value) {
        await sb.from('kpi_values').update({
          value: mapping.value,
          source: src,
        }).eq('id', existing.id);
      }
    } else {
      await sb.from('kpi_values').insert({
        profile_id: mapping.profileId,
        kpi_id: metric.id,
        period_start: weekStart,
        period_end: getWeekEnd(weekStart),
        value: mapping.value,
        source: src,
        external_event_id: mapping.externalEventId || null,
        sample_count: 1,
      });
    }
  } else if (aggregation === 'avg') {
    // Average mode — running average with sample_count (e.g. talk_to_listen_ratio)
    const { data: existing } = await sb.from('kpi_values')
      .select('id, value, sample_count')
      .eq('profile_id', mapping.profileId)
      .eq('kpi_id', metric.id)
      .eq('period_start', weekStart)
      .maybeSingle();

    if (existing) {
      const prevCount = existing.sample_count || 1;
      const newCount = prevCount + 1;
      const newValue = Math.round(((existing.value * prevCount + mapping.value) / newCount) * 100) / 100;
      await sb.from('kpi_values').update({
        value: newValue,
        sample_count: newCount,
        source: src,
      }).eq('id', existing.id);
    } else {
      await sb.from('kpi_values').insert({
        profile_id: mapping.profileId,
        kpi_id: metric.id,
        period_start: weekStart,
        period_end: getWeekEnd(weekStart),
        value: mapping.value,
        source: src,
        external_event_id: mapping.externalEventId || null,
        sample_count: 1,
      });
    }
  } else {
    // Set mode — upsert with exact value (backward compat)
    await sb.from('kpi_values').upsert({
      profile_id: mapping.profileId,
      kpi_id: metric.id,
      period_start: weekStart,
      period_end: getWeekEnd(weekStart),
      value: mapping.value || 0,
      source: src,
      external_event_id: mapping.externalEventId || null,
      sample_count: 1,
    }, { onConflict: 'profile_id,kpi_id,period_start' });
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
 * Generic webhook handler with integration-first org resolution.
 *
 * POST-PLANERA TODO: Admin UI to manage per-integration webhook secrets.
 *
 * Current state (Planera pilot):
 *   - Per-integration secrets supported via webhook_secret_encrypted column
 *   - When null, falls back to env-var secret (e.g. OUTREACH_WEBHOOK_SECRET)
 *   - Fallback email-lookup is scoped to provider-connected orgs only
 *   - Cross-org email collisions logged and refused (safe default)
 *
 * Future state:
 *   - Admin UI in Systems > Integrations to rotate webhook secrets
 *   - Remove env-var fallback entirely
 *   - Require per-integration secret for all new connections
 *
 * Resolution order:
 *   1. Fetch all connected integrations of this provider type
 *   2. Run provider.verifyWebhook() against each integration's webhook_secret
 *      (decrypted). The one that validates IS the correct integration.
 *   3. Use that integration's organization_id to scope the profile lookup.
 *   4. Fallback: if no integration has a stored secret (pre-migration state),
 *      fall back to the env-var global secret AND use the profile lookup —
 *      but ONLY scoped to orgs that have this provider connected.
 */
async function processWebhook(sb, providerType, req) {
  const provider = getProvider(providerType);
  if (!provider) {
    return { error: `Unknown provider: ${providerType}` };
  }

  if (!provider.mapWebhookEvent || !provider.kpiMap) {
    return { error: `Provider '${providerType}' does not support webhooks` };
  }

  // Step 1: Fetch candidate integrations (connected, this provider type)
  const { data: candidates } = await sb
    .from('integrations')
    .select('id, organization_id, webhook_secret_encrypted, integration_type, profile_id, status')
    .eq('integration_type', providerType)
    .eq('status', 'connected');

  if (!candidates?.length) {
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: 'unknown',
      external_id: null,
      payload: req.body,
      processed: false,
      error: `No connected ${providerType} integrations found`,
    });
    return { processed: false, reason: `No connected integrations for ${providerType}` };
  }

  // Step 2: Find the integration whose webhook_secret verifies this request
  let matchedIntegration = null;
  let usedFallback = false;

  if (provider.verifyWebhook) {
    for (const candidate of candidates) {
      if (candidate.webhook_secret_encrypted) {
        try {
          const decrypted = decryptCredentials(candidate.webhook_secret_encrypted);
          if (provider.verifyWebhook(req, decrypted.secret)) {
            matchedIntegration = candidate;
            break;
          }
        } catch (err) {
          console.warn(`[webhook:${providerType}] Decrypt failed for integration ${candidate.id}:`, err.message);
        }
      }
    }

    // Step 2b: Fallback path — env var secret (only if no per-integration secrets set yet)
    if (!matchedIntegration) {
      const anyHasSecret = candidates.some(c => c.webhook_secret_encrypted);
      if (!anyHasSecret && provider.verifyWebhook(req, null)) {
        // Env-var fallback verified. We still need to pick the right integration.
        // This is the transition-window path — safe because Phase 0 Query 8
        // confirmed zero cross-org email collisions in production data.
        usedFallback = true;
      } else {
        await sb.from('webhook_events').insert({
          source: providerType,
          event_type: 'signature_mismatch',
          external_id: null,
          payload: req.body,
          processed: false,
          error: 'No integration matched webhook signature',
        });
        return { error: 'Invalid webhook signature (no integration matched)' };
      }
    }
  } else {
    // Provider has no verifyWebhook — use fallback path
    usedFallback = true;
  }

  // Step 3: Parse the event
  const event = provider.mapWebhookEvent(req.body);
  if (!event || !event.eventName) {
    return { processed: false, reason: 'Unrecognized event' };
  }

  const kpiUpdates = provider.kpiMap[event.eventName];
  if (!kpiUpdates?.length) {
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: event.eventName,
      external_id: event.eventId || null,
      organization_id: matchedIntegration?.organization_id || null,
      payload: req.body,
      processed: false,
    });
    return { processed: false, reason: `No KPI mapping for ${event.eventName}` };
  }

  // Step 4: Determine organization_id
  let orgId = matchedIntegration?.organization_id || null;

  if (usedFallback && !orgId && event.userEmail) {
    // Env-var fallback: signature is valid globally but we don't know the org.
    // Look up the profile by email — scoped to orgs that have this provider connected,
    // to eliminate collisions with unrelated orgs.
    const candidateOrgIds = candidates.map(c => c.organization_id);
    const { data: matches } = await sb
      .from('profiles')
      .select('id, organization_id, role, carries_quota')
      .ilike('email', event.userEmail.trim())
      .in('organization_id', candidateOrgIds);

    if (matches?.length === 1) {
      orgId = matches[0].organization_id;
      matchedIntegration = candidates.find(c => c.organization_id === orgId) || null;
    } else if (matches?.length > 1) {
      // Cross-org collision detected — refuse to attribute
      await sb.from('webhook_events').insert({
        source: providerType,
        event_type: event.eventName,
        external_id: event.eventId || null,
        payload: req.body,
        processed: false,
        error: `Cross-org email collision for ${event.userEmail} — refusing to attribute`,
      });
      return { processed: false, reason: 'Cross-org email collision' };
    }
  } else if (usedFallback && !orgId && candidates.length === 1) {
    // Only one integration of this type exists — unambiguous
    orgId = candidates[0].organization_id;
    matchedIntegration = candidates[0];
  }

  if (!orgId) {
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: event.eventName,
      external_id: event.eventId || null,
      payload: req.body,
      processed: false,
      error: 'Could not resolve organization_id',
    });
    return { processed: false, reason: 'No organization_id' };
  }

  // Step 5: Resolve profile, scoped to orgId (no cross-org lookup)
  const profileId = event.userEmail
    ? await resolveProfileByEmail(sb, orgId, event.userEmail)
    : null;

  if (!profileId && event.userEmail) {
    await sb.from('webhook_events').insert({
      source: providerType,
      event_type: event.eventName,
      external_id: event.eventId || null,
      organization_id: orgId,
      payload: req.body,
      processed: false,
      error: `Could not resolve profile for email: ${event.userEmail}`,
    });
    return { processed: false, reason: 'User not found in org' };
  }

  // Step 6: Leader skip (player-coach override — see Fix #9)
  if (profileId) {
    const { data: profileRow } = await sb
      .from('profiles')
      .select('role, carries_quota')
      .eq('id', profileId)
      .maybeSingle();
    const isLeader = profileRow && ['admin', 'manager', 'coach'].includes(profileRow.role);
    if (isLeader && !profileRow.carries_quota) {
      await sb.from('webhook_events').insert({
        source: providerType,
        event_type: event.eventName,
        external_id: event.eventId || null,
        organization_id: orgId,
        profile_id: profileId,
        payload: req.body,
        processed: false,
        error: `Skipped: leadership role ${profileRow.role} without carries_quota`,
      });
      return { processed: false, reason: 'Leadership role without carries_quota' };
    }
  }

  // Step 7: Process KPI updates
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
      }, { organization_id: orgId, integration_type: providerType });
      kpisUpdated.push(update.key);
    } catch (err) {
      if (err.code === '23505') continue; // Duplicate — already processed
      console.error(`[webhook] KPI upsert error:`, err.message);
    }
  }

  // Step 8: Audit log
  await sb.from('webhook_events').insert({
    source: providerType,
    event_type: event.eventName,
    external_id: event.eventId || null,
    organization_id: orgId,
    profile_id: profileId,
    payload: req.body,
    processed: true,
    kpis_updated: kpisUpdated,
  });

  // Normalizes provider-specific reply event names to a canonical 'email_reply'
  // so downstream handlers (checkSequenceReply in server.js) can match on a
  // single string regardless of which provider fired the webhook. Without this
  // normalization, each provider's event name (e.g. Outreach's 'email.replied',
  // 'prospects.emailReplied', HubSpot's 'engagement.reply', SalesLoft's 'reply')
  // would require separate matching in the generic route handler.
  const REPLY_EVENTS = new Set([
    'email.replied',           // Outreach
    'prospects.emailReplied',  // Outreach (alternate)
    'email_reply',             // normalized / generic
    'engagement.reply',        // HubSpot
    'reply',                   // SalesLoft / generic
  ]);
  const normalizedEvent = REPLY_EVENTS.has(event.eventName) ? 'email_reply' : event.eventName;

  return {
    processed: true,
    kpisUpdated,
    organizationId: orgId,
    profileId,
    fallbackUsed: usedFallback,
    event: normalizedEvent,
    email: event.userEmail || null,
  };
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

// ── Historical Backfill ──────────────────────────────────────

/**
 * Run a historical backfill for a newly connected integration.
 * Pulls data from 90 days ago up to now by resetting sync cursors
 * to the backfill start date.
 */
async function runHistoricalBackfill(sb, integrationId, daysBack = 90) {
  const { data: integration } = await sb.from('integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (!integration) throw new Error('Integration not found');

  const provider = getProvider(integration.integration_type);
  if (!provider || !provider.sync) throw new Error(`No sync handler for ${integration.integration_type}`);

  const backfillDate = new Date(Date.now() - daysBack * 86400000).toISOString();

  // Reset or create cursors with the backfill start date
  const entityTypes = Object.keys(provider.sync);
  for (const entityType of entityTypes) {
    await sb.from('integration_sync_cursors').upsert({
      integration_id: integrationId,
      entity_type: entityType,
      last_sync_cursor: backfillDate,
      last_synced_at: null,
      records_synced: 0,
    }, { onConflict: 'integration_id,entity_type' });
  }

  // Run the full sync — the provider will pull from the backfill cursor forward
  const result = await runIntegrationSync(sb, integrationId);

  console.log(`[backfill] Integration ${integrationId}: processed ${result.total || 0} records from last ${daysBack} days`);
  return { ...result, daysBack, backfillDate };
}

// ── Sync Failure Notifications ──────────────────────────────

/**
 * Send a notification to org admins when a sync fails.
 * Called after runIntegrationSync detects failures.
 */
async function notifySyncFailure(sb, integration, errors) {
  if (!sb || !integration?.organization_id) return;
  try {
    // Find admins for this org
    const { data: admins } = await sb.from('profiles')
      .select('id')
      .eq('organization_id', integration.organization_id)
      .in('role', ['admin', 'administrator']);

    if (!admins?.length) return;

    const errorSummary = errors.slice(0, 3).join('; ');
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      type: 'integration_sync_failed',
      title: `${integration.display_name || integration.integration_type} sync failed`,
      body: `Sync encountered errors: ${errorSummary}. Check Settings > Integrations for details.`,
      data: { integration_id: integration.id, integration_type: integration.integration_type },
      created_at: new Date().toISOString(),
    }));

    await sb.from('notifications').insert(notifications);
  } catch (err) {
    console.error('[sync:notify] Failed to send sync failure notification:', err.message);
  }
}

// ── CRM Push Queue Engine ────────────────────────────────────

/**
 * Enqueue an outbound push action (e.g., log activity, create meeting).
 * Called by event triggers in server.js.
 */
async function enqueuePush(sb, { organizationId, integrationId, entityType, entityId, action, payload, triggeredBy, sourceEvent, scheduledAt }) {
  const { error } = await sb.from('integration_push_queue').insert({
    organization_id: organizationId,
    integration_id:  integrationId,
    entity_type:     entityType,
    entity_id:       entityId || null,
    action:          action || 'log_activity',
    payload:         payload || {},
    triggered_by:    triggeredBy || 'event',
    source_event:    sourceEvent || null,
    scheduled_at:    scheduledAt || new Date().toISOString(),
  });
  if (error) console.error('[push:enqueue] Error:', error.message);
  return { error };
}

/**
 * Process pending items in the push queue.
 * Called by the integration-push cron (every 15 min).
 * - Fetches pending + retryable failed items
 * - Routes to provider push methods
 * - Logs results + updates entity map
 * - Exponential backoff: 10min, 20min, 40min
 */
async function processPushQueue(sb) {
  const BACKOFF_MINUTES = [10, 20, 40];

  // Fetch items: pending OR (failed + retry eligible + enough time elapsed)
  const { data: items, error: fetchErr } = await sb
    .from('integration_push_queue')
    .select('*, integrations:integration_id(id, integration_type, credentials, organization_id, status)')
    .or('status.eq.pending,status.eq.failed')
    .lt('retry_count', 3)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(50);

  if (fetchErr || !items?.length) return { processed: 0, sent: 0, failed: 0, skipped: 0 };

  let sent = 0, failed = 0, skipped = 0;

  for (const item of items) {
    const integration = item.integrations;
    if (!integration || integration.status !== 'connected') {
      await markPushItem(sb, item, 'skipped', 'Integration not connected');
      skipped++;
      continue;
    }

    const provider = getProvider(integration.integration_type);
    if (!provider) {
      await markPushItem(sb, item, 'skipped', `Unknown provider: ${integration.integration_type}`);
      skipped++;
      continue;
    }

    // Determine which push method to call
    const pushMethod = resolvePushMethod(provider, item.action, item.entity_type);
    if (!pushMethod) {
      await markPushItem(sb, item, 'skipped', `Provider does not support ${item.action}/${item.entity_type}`);
      skipped++;
      continue;
    }

    // Mark processing
    await sb.from('integration_push_queue')
      .update({ status: 'processing' })
      .eq('id', item.id);

    const startMs = Date.now();
    try {
      // Ensure token is fresh
      const freshIntegration = await ensureFreshToken(sb, integration);

      // Execute push
      const result = await pushMethod(freshIntegration, item.payload);
      const durationMs = Date.now() - startMs;
      const externalId = result?.id || result?.external_id || item.external_id;

      // Log success
      await sb.from('integration_push_log').insert({
        organization_id: item.organization_id,
        integration_id:  item.integration_id,
        queue_item_id:   item.id,
        entity_type:     item.entity_type,
        action:          item.action,
        status:          'sent',
        external_id:     externalId || null,
        request_payload: item.payload,
        response_payload: result || null,
        duration_ms:     durationMs,
      });

      // Update entity map if we got an external ID
      if (externalId && item.entity_id) {
        await sb.from('integration_entity_map').upsert({
          organization_id: item.organization_id,
          integration_id:  item.integration_id,
          apptivia_entity: item.entity_type,
          apptivia_id:     item.entity_id,
          external_entity: mapExternalEntity(integration.integration_type, item.entity_type),
          external_id:     externalId,
          last_synced_at:  new Date().toISOString(),
        }, { onConflict: 'integration_id,apptivia_entity,apptivia_id' });
      }

      // Mark sent
      await sb.from('integration_push_queue').update({
        status:       'sent',
        external_id:  externalId || null,
        processed_at: new Date().toISOString(),
      }).eq('id', item.id);

      sent++;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const newRetry = (item.retry_count || 0) + 1;
      const isFinal = newRetry >= item.max_retries;

      // Log failure
      await sb.from('integration_push_log').insert({
        organization_id: item.organization_id,
        integration_id:  item.integration_id,
        queue_item_id:   item.id,
        entity_type:     item.entity_type,
        action:          item.action,
        status:          'failed',
        error_message:   err.message?.slice(0, 500),
        request_payload: item.payload,
        duration_ms:     durationMs,
      });

      // Update queue item with retry info + backoff schedule
      const nextSchedule = isFinal ? null : new Date(Date.now() + BACKOFF_MINUTES[newRetry - 1] * 60000).toISOString();
      await sb.from('integration_push_queue').update({
        status:        isFinal ? 'failed' : 'retry',
        retry_count:   newRetry,
        error_message: err.message?.slice(0, 500),
        processed_at:  new Date().toISOString(),
        ...(nextSchedule && { scheduled_at: nextSchedule }),
      }).eq('id', item.id);

      failed++;
      console.error(`[push:process] ${item.action}/${item.entity_type} failed (retry ${newRetry}/${item.max_retries}):`, err.message);
    }
  }

  console.log(`[push:process] Done — sent: ${sent}, failed: ${failed}, skipped: ${skipped}`);
  return { processed: items.length, sent, failed, skipped };
}

/** Resolve the push method from provider based on action + entity type */
function resolvePushMethod(provider, action, entityType) {
  if (!provider.push) return null;
  // Direct action mapping
  const methodMap = {
    'log_activity':   provider.push.logActivity,
    'create_meeting': provider.push.createMeeting,
    'update_deal':    provider.push.updateDeal,
    'create_contact': provider.push.createContact,
  };
  return methodMap[action] || null;
}

/** Map Apptivia entity types to CRM external entity types */
function mapExternalEntity(providerType, apptiviaEntity) {
  const maps = {
    salesforce: { profile: 'Contact', deal: 'Opportunity', meeting: 'Event', activity: 'Task' },
    hubspot:    { profile: 'Contact', deal: 'Deal', meeting: 'Meeting', activity: 'Engagement' },
  };
  return maps[providerType]?.[apptiviaEntity] || apptiviaEntity;
}

/** Helper to mark a push item with a terminal status */
async function markPushItem(sb, item, status, errorMessage) {
  await sb.from('integration_push_queue').update({
    status,
    error_message: errorMessage,
    processed_at:  new Date().toISOString(),
  }).eq('id', item.id);

  await sb.from('integration_push_log').insert({
    organization_id: item.organization_id,
    integration_id:  item.integration_id,
    queue_item_id:   item.id,
    entity_type:     item.entity_type,
    action:          item.action,
    status,
    error_message:   errorMessage,
  });
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
  runHistoricalBackfill,
  notifySyncFailure,

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

  // Push engine
  enqueuePush,
  processPushQueue,

  // Utilities
  fetchJson,
  getWeekStart,
  getWeekEnd,
};

// ── Auto-register providers ─────────────────────────────────
// Load all provider modules from ./providers/ AFTER module.exports
// is assigned, so providers can require('../integrationService')
// without hitting a circular dependency (exports are fully populated).
try {
  const path = require('path');
  const fs = require('fs');
  const providersDir = path.join(__dirname, 'providers');
  if (fs.existsSync(providersDir)) {
    for (const file of fs.readdirSync(providersDir)) {
      if (file.endsWith('.js')) {
        const provider = require(path.join(providersDir, file));
        if (provider && provider.type) {
          registerProvider(provider);
          console.log(`[integrations] Registered provider: ${provider.type}`);
        }
      }
    }
  }
} catch (err) {
  console.warn('[integrations] Error auto-loading providers:', err.message);
}
