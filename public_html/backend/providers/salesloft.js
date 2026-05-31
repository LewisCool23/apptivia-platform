/**
 * SalesLoft Provider — Apptivia Integration Framework
 * -----------------------------------------------------
 * OAuth 2.0, REST API v2, webhook ingest.
 * Syncs: Activities (calls, emails), Meetings.
 * Pushes: Create cadence steps.
 *
 * Env vars:
 *   SALESLOFT_CLIENT_ID
 *   SALESLOFT_CLIENT_SECRET
 */

'use strict';

const crypto = require('crypto');
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

const SL_API = 'https://api.salesloft.com/v2';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('SALESLOFT_CLIENT_ID'),
    redirect_uri: redirectUri,
    state,
  });
  return `https://accounts.salesloft.com/oauth/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('SALESLOFT_CLIENT_ID'),
    client_secret: env('SALESLOFT_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://accounts.salesloft.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SalesLoft token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    expires_in: data.expires_in || 7200,
  };
}

async function refreshToken(creds) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('SALESLOFT_CLIENT_ID'),
    client_secret: env('SALESLOFT_CLIENT_SECRET'),
  });

  const res = await fetch('https://accounts.salesloft.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SalesLoft token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || creds.refresh_token,
    expires_in: data.expires_in || 7200,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function slHeaders(creds) {
  return { Authorization: `Bearer ${creds.access_token}` };
}

async function slGet(creds, path, params = {}) {
  const { fetchJson } = require('../integrationService');
  const url = new URL(`${SL_API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return fetchJson(url.toString(), { headers: slHeaders(creds) });
}

// ── Sync: Activities (Calls) ─────────────────────────────────

async function syncActivities(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const params = { per_page: 100, sort_by: 'updated_at', sort_direction: 'asc' };
  if (cursor) params['updated_at[gte]'] = cursor;

  const result = await slGet(creds, '/activities/calls.json', params);
  const records = result.data || [];
  const kpiMappings = [];
  const activityRecords = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const userEmail = record.user?.email || null;
    if (!userEmail) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, userEmail);
    if (!profileId) continue;

    // Activity record for ALL calls
    activityRecords.push({
      profileId,
      activityType: 'call',
      activityDate: record.created_at || record.updated_at,
      source: 'salesloft',
      externalId: String(record.id),
      subject: record.to || null,
      contactName: record.person?.display_name || null,
      contactEmail: record.person?.email_address || null,
      direction: 'outbound',
      durationSeconds: record.duration || null,
      status: record.disposition || record.status || null,
      notes: record.note ? record.note.slice(0, 2000) : null,
      metadata: {},
    });

    if (record.disposition === 'connected' || record.status === 'completed') {
      const weekStart = getWeekStart(record.created_at || record.updated_at);

      const connectMapping = buildKpiMapping({
        profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
        source: 'salesloft', externalEventId: `salesloft:call:${record.id}:call_connects`, weekStart,
      });
      if (connectMapping) kpiMappings.push(connectMapping);

      if (record.duration > 0) {
        const talkTimeMapping = buildKpiMapping({
          profileId, kpiKey: 'talk_time_minutes', rawValue: record.duration, fromUnit: 'Seconds',
          source: 'salesloft', externalEventId: `salesloft:call:${record.id}:talk_time`, weekStart,
        });
        if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
      }
    }
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.updated_at || cursor,
    kpiMappings,
    activityRecords,
  };
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const params = { per_page: 100, sort_by: 'updated_at', sort_direction: 'asc' };
  if (cursor) params['updated_at[gte]'] = cursor;

  const result = await slGet(creds, '/meetings.json', params);
  const records = result.data || [];
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const userEmail = record.owner?.email || record.booked_by?.email || null;

    const profileId = userEmail
      ? await resolveProfileByEmail(sb, integration.organization_id, userEmail)
      : null;

    if (profileId) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'salesloft', externalEventId: `salesloft:meeting:${record.id}:meetings`,
        weekStart: getWeekStart(record.start_time || record.created_at),
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
    }

    calendarEvents.push({
      externalEventId: `salesloft:${record.id}`,
      title: record.title || 'SalesLoft Meeting',
      description: record.description,
      startTime: record.start_time,
      endTime: record.end_time,
      location: record.location,
      profileId,
      organizerEmail: userEmail,
      eventType: 'meeting',
      rawData: record,
    });
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.updated_at || cursor,
    kpiMappings,
    calendarEvents,
  };
}

// ── Sync: Emails ─────────────────────────────────────────────

async function syncEmails(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const params = { per_page: 100, sort_by: 'updated_at', sort_direction: 'asc' };
  if (cursor) params['updated_at[gte]'] = cursor;

  const result = await slGet(creds, '/activities/emails.json', params);
  const records = result.data || [];
  const kpiMappings = [];
  const activityRecords = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const userEmail = record.user?.email || null;
    if (!userEmail) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, userEmail);
    if (!profileId) continue;

    // Activity record for ALL emails
    activityRecords.push({
      profileId,
      activityType: 'email',
      activityDate: record.created_at || record.updated_at,
      source: 'salesloft',
      externalId: `email_${record.id}`,
      subject: record.subject || null,
      contactEmail: record.recipient_email_address || null,
      direction: 'outbound',
      status: record.status || null,
      metadata: {},
    });

    const weekStart = getWeekStart(record.created_at || record.updated_at);

    // Count email replies
    if (record.status === 'replied') {
      const replyMapping = buildKpiMapping({
        profileId, kpiKey: 'sequence_replies', rawValue: 1, fromUnit: 'Count',
        source: 'salesloft', externalEventId: `salesloft:email:${record.id}:sequence_replies`, weekStart,
      });
      if (replyMapping) kpiMappings.push(replyMapping);
    }

    // Count emails sent
    if (record.status === 'sent') {
      const sentMapping = buildKpiMapping({
        profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
        source: 'salesloft', externalEventId: `salesloft:email:${record.id}:emails_sent`, weekStart,
      });
      if (sentMapping) kpiMappings.push(sentMapping);
    }
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.updated_at || cursor, kpiMappings, activityRecords };
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'call.completed':   [{ key: 'call_connects', increment: 1 }, { key: 'talk_time_minutes', fromAttr: 'duration' }],
  'meeting.booked':   [{ key: 'meetings', increment: 1 }],
  'meeting.created':  [{ key: 'meetings', increment: 1 }],
  'email.replied':    [{ key: 'sequence_replies', increment: 1 }],
  'email.sent':       [{ key: 'emails_sent', increment: 1 }],
};

function mapWebhookEvent(payload) {
  const eventName = payload?.event || payload?.type || '';
  const eventId = payload?.id || payload?.data?.id || null;
  const userEmail = payload?.data?.user?.email || payload?.user_email || null;
  return { eventName, eventId, userEmail };
}

function verifyWebhook(req, explicitSecret = null) {
  const secret = explicitSecret || env('SALESLOFT_WEBHOOK_SECRET');
  if (!secret) return true;

  const sig = req.headers['x-salesloft-signature'] || '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Sync: Tasks (open SalesLoft action items → engage_tasks) ─────────────────

async function syncTasks(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const params = { per_page: 100, sort_by: 'updated_at', sort_direction: 'asc' };
  if (cursor) params['updated_at[gte]'] = cursor;

  let result;
  try {
    result = await slGet(creds, '/actions.json', params);
  } catch (err) {
    console.warn(`[salesloft:tasks] Skipping — ${err.message}`);
    return { records: [], nextCursor: cursor, kpiMappings: [] };
  }

  const records = result.data || [];
  const { resolveProfileByEmail } = require('../integrationService');
  const orgId = integration.organization_id;
  const taskRows = [];
  const kpiMappings = [];

  for (const record of records) {
    const userEmail = record.user?.email || null;
    if (!userEmail) continue;
    const profileId = await resolveProfileByEmail(sb, orgId, userEmail);
    if (!profileId) continue;

    if (record.status === 'completed') {
      const mapping = buildKpiMapping({
        profileId, kpiKey: 'tasks_completed', rawValue: 1, fromUnit: 'Count',
        source: 'salesloft', externalEventId: `salesloft:action:${record.id}:tasks_completed`,
        weekStart: getWeekStart(record.completed_at || record.updated_at),
      });
      if (mapping) kpiMappings.push(mapping);
    } else {
      taskRows.push({
        organization_id: orgId, created_by: profileId, assigned_to: profileId,
        title: record.subject || record.action_type || 'SalesLoft Task',
        description: record.notes || null,
        due_date: record.due_on || null,
        priority: 'medium', status: 'pending', source: 'salesloft',
        external_id: String(record.id), external_url: null,
        integration_id: integration.id, synced_at: new Date().toISOString(),
      });
    }
  }

  if (taskRows.length > 0) {
    const { error } = await sb.from('engage_tasks')
      .upsert(taskRows, { onConflict: 'organization_id,source,external_id', ignoreDuplicates: false });
    if (error) console.warn('[salesloft:tasks] Upsert error:', error.message);
  }

  const lastRecord = records[records.length - 1];
  console.log(`[salesloft:tasks] Synced ${taskRows.length} open, ${kpiMappings.length} completed`);
  return { records, nextCursor: lastRecord?.updated_at || cursor, kpiMappings };
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'salesloft',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    activities: syncActivities,
    meetings: syncMeetings,
    emails: syncEmails,
    tasks: syncTasks,
  },
  push: {},
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
