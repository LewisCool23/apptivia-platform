/**
 * Outreach.io Provider — Apptivia Integration Framework
 * -------------------------------------------------------
 * OAuth 2.0, REST API v2, webhook ingest (migrated from server.js).
 * Syncs: Activities (calls, emails), Meetings, Opportunities.
 * Pushes: Create tasks.
 *
 * Env vars:
 *   OUTREACH_CLIENT_ID
 *   OUTREACH_CLIENT_SECRET
 *   OUTREACH_WEBHOOK_SECRET  (for webhook signature verification)
 */

'use strict';

const crypto = require('crypto');
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

const OUTREACH_API = 'https://api.outreach.io/api/v2';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('OUTREACH_CLIENT_ID'),
    redirect_uri: redirectUri,
    state,
    scope: 'prospects.read prospects.write activities.read meetings.read opportunities.read',
  });
  return `https://api.outreach.io/oauth/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('OUTREACH_CLIENT_ID'),
    client_secret: env('OUTREACH_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://api.outreach.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Outreach token exchange failed: ${res.status} ${text}`);
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
    client_id: env('OUTREACH_CLIENT_ID'),
    client_secret: env('OUTREACH_CLIENT_SECRET'),
  });

  const res = await fetch('https://api.outreach.io/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Outreach token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || creds.refresh_token,
    expires_in: data.expires_in || 7200,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function outreachHeaders(creds) {
  return {
    Authorization: `Bearer ${creds.access_token}`,
    'Content-Type': 'application/vnd.api+json',
  };
}

async function outreachGet(creds, path) {
  const { fetchJson } = require('../integrationService');
  return fetchJson(`${OUTREACH_API}${path}`, {
    headers: outreachHeaders(creds),
  });
}

// ── Sync: Activities ─────────────────────────────────────────

async function syncActivities(integration, cursor) {
  const creds = integration.decryptedCreds;
  let path = '/activities?page[size]=100&sort=updatedAt';
  if (cursor) path += `&filter[updatedAt]=${cursor}..`;

  const result = await outreachGet(creds, path);
  const records = result.data || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const attrs = record.attributes || {};
    const ownerEmail = attrs.userEmail || null;
    if (!ownerEmail) continue;

    const profileId = await resolveProfileByEmail(null, integration.organization_id, ownerEmail);
    if (!profileId) continue;

    const weekStart = getWeekStart(attrs.updatedAt || attrs.createdAt);

    if (attrs.activityType === 'call' && attrs.disposition === 'Answered') {
      const connectMapping = buildKpiMapping({
        profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
        source: 'outreach', externalEventId: `outreach:activity:${record.id}:call_connects`, weekStart,
      });
      if (connectMapping) kpiMappings.push(connectMapping);

      if (attrs.duration > 0) {
        const talkTimeMapping = buildKpiMapping({
          profileId, kpiKey: 'talk_time_minutes', rawValue: attrs.duration, fromUnit: 'Seconds',
          source: 'outreach', externalEventId: `outreach:activity:${record.id}:talk_time`, weekStart,
        });
        if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
      }
    }

    if (attrs.activityType === 'email' && attrs.direction === 'reply') {
      const replyMapping = buildKpiMapping({
        profileId, kpiKey: 'sequence_replies', rawValue: 1, fromUnit: 'Count',
        source: 'outreach', externalEventId: `outreach:activity:${record.id}:sequence_replies`, weekStart,
      });
      if (replyMapping) kpiMappings.push(replyMapping);
    }

    if (attrs.activityType === 'sequence' || attrs.action === 'sequence_start') {
      const seqMapping = buildKpiMapping({
        profileId, kpiKey: 'sequences_started', rawValue: 1, fromUnit: 'Count',
        source: 'outreach', externalEventId: `outreach:activity:${record.id}:sequences_started`, weekStart,
      });
      if (seqMapping) kpiMappings.push(seqMapping);
    }
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.attributes?.updatedAt || cursor, kpiMappings };
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor) {
  const creds = integration.decryptedCreds;
  let path = '/meetings?page[size]=100&sort=updatedAt';
  if (cursor) path += `&filter[updatedAt]=${cursor}..`;

  const result = await outreachGet(creds, path);
  const records = result.data || [];
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const attrs = record.attributes || {};
    const ownerEmail = attrs.organizerEmail || null;

    const profileId = ownerEmail
      ? await resolveProfileByEmail(null, integration.organization_id, ownerEmail)
      : null;

    if (profileId) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'outreach', externalEventId: `outreach:meeting:${record.id}:meetings`,
        weekStart: getWeekStart(attrs.startAt || attrs.updatedAt),
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
    }

    calendarEvents.push({
      externalEventId: `outreach:${record.id}`,
      title: attrs.title || 'Outreach Meeting',
      description: attrs.description,
      startTime: attrs.startAt,
      endTime: attrs.endAt,
      location: attrs.location,
      profileId,
      organizerEmail: ownerEmail,
      eventType: 'meeting',
      rawData: record,
    });
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.attributes?.updatedAt || cursor, kpiMappings, calendarEvents };
}

// ── Sync: Deals ──────────────────────────────────────────────

async function syncDeals(integration, cursor) {
  const creds = integration.decryptedCreds;
  let path = '/opportunities?page[size]=100&sort=updatedAt';
  if (cursor) path += `&filter[updatedAt]=${cursor}..`;

  const result = await outreachGet(creds, path);
  const records = result.data || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const attrs = record.attributes || {};
    const ownerEmail = attrs.ownerEmail || null;
    if (!ownerEmail) continue;

    const profileId = await resolveProfileByEmail(null, integration.organization_id, ownerEmail);
    if (!profileId) continue;

    const sourcedMapping = buildKpiMapping({
      profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
      source: 'outreach', externalEventId: `outreach:opp:${record.id}:sourced`,
      weekStart: getWeekStart(attrs.createdAt || attrs.updatedAt),
    });
    if (sourcedMapping) kpiMappings.push(sourcedMapping);
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.attributes?.updatedAt || cursor, kpiMappings };
}

// ── Sync: Emails (Opens) ────────────────────────────────────

async function syncEmails(integration, cursor) {
  const creds = integration.decryptedCreds;
  let path = '/mailings?page[size]=100&sort=updatedAt';
  if (cursor) path += `&filter[updatedAt]=${cursor}..`;

  const result = await outreachGet(creds, path);
  const records = result.data || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const attrs = record.attributes || {};
    const ownerEmail = attrs.userEmail || null;
    if (!ownerEmail) continue;

    const profileId = await resolveProfileByEmail(null, integration.organization_id, ownerEmail);
    if (!profileId) continue;

    if (attrs.openCount > 0 || attrs.openedAt) {
      const openedMapping = buildKpiMapping({
        profileId, kpiKey: 'emails_opened', rawValue: 1, fromUnit: 'Count',
        source: 'outreach', externalEventId: `outreach:mailing:${record.id}:emails_opened`,
        weekStart: getWeekStart(attrs.openedAt || attrs.updatedAt),
      });
      if (openedMapping) kpiMappings.push(openedMapping);
    }
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.attributes?.updatedAt || cursor, kpiMappings };
}

// ── Sync: Tasks (Completed) ─────────────────────────────────

async function syncTasks(integration, cursor) {
  const creds = integration.decryptedCreds;
  let path = '/tasks?page[size]=100&sort=updatedAt&filter[state]=complete';
  if (cursor) path += `&filter[updatedAt]=${cursor}..`;

  const result = await outreachGet(creds, path);
  const records = result.data || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const attrs = record.attributes || {};
    const ownerEmail = attrs.ownerEmail || attrs.userEmail || null;
    if (!ownerEmail) continue;

    const profileId = await resolveProfileByEmail(null, integration.organization_id, ownerEmail);
    if (!profileId) continue;

    const taskMapping = buildKpiMapping({
      profileId, kpiKey: 'tasks_completed', rawValue: 1, fromUnit: 'Count',
      source: 'outreach', externalEventId: `outreach:task:${record.id}:tasks_completed`,
      weekStart: getWeekStart(attrs.completedAt || attrs.updatedAt),
    });
    if (taskMapping) kpiMappings.push(taskMapping);
  }

  const lastRecord = records[records.length - 1];
  return { records, nextCursor: lastRecord?.attributes?.updatedAt || cursor, kpiMappings };
}

// ── Push: Create Task ────────────────────────────────────────

async function createTask(integration, data) {
  const creds = integration.decryptedCreds;
  const taskBody = {
    data: {
      type: 'task',
      attributes: {
        subject: data.title || data.subject,
        taskType: data.type || 'to-do',
        dueAt: data.dueDate || new Date().toISOString(),
        note: data.description || '',
      },
    },
  };

  const res = await fetch(`${OUTREACH_API}/tasks`, {
    method: 'POST',
    headers: outreachHeaders(creds),
    body: JSON.stringify(taskBody),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Outreach create task failed: ${res.status} ${text}`);
  }

  const result = await res.json();
  return { externalId: result.data?.id };
}

// ── Webhook Support ────────────────────────────────────────

const kpiMap = {
  'prospects.called':          [{ key: 'call_connects',     increment: 1 }],
  'calls.completed':           [{ key: 'call_connects',     increment: 1 }, { key: 'talk_time_minutes', fromAttr: 'duration' }],
  'meetings.booked':           [{ key: 'meetings',          increment: 1 }],
  'meetings.created':          [{ key: 'meetings',          increment: 1 }],
  'opportunities.created':     [{ key: 'sourced_opps',      increment: 1 }],
  'opportunities.stageChange': [{ key: 'stage2_opps',       increment: 1, condition: 'stage2' }],
  'email.replied':             [{ key: 'sequence_replies',  increment: 1 }],
  'prospects.emailReplied':    [{ key: 'sequence_replies',  increment: 1 }],
  'email.opened':              [{ key: 'emails_opened',     increment: 1 }],
  'sequence.started':          [{ key: 'sequences_started', increment: 1 }],
  'task.completed':            [{ key: 'tasks_completed',   increment: 1 }],
};

function mapWebhookEvent(payload) {
  const eventName = payload?.meta?.eventName || payload?.event || '';
  const eventId = payload?.meta?.requestId || payload?.id || null;
  const attrs = payload?.data?.attributes || {};
  const rels = payload?.data?.relationships || {};
  const userEmail = rels?.owner?.data?.attributes?.email
    || attrs?.userEmail
    || payload?.userEmail
    || null;
  return { eventName, eventId, attrs, userEmail };
}

function verifyWebhook(req, explicitSecret = null) {
  const secret = explicitSecret || env('OUTREACH_WEBHOOK_SECRET');
  if (!secret) return true; // No secret configured — skip validation (dev only)

  const sig = req.headers['x-outreach-webhook-signature'] || '';
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  const sigBuf = Buffer.from(sig.padEnd(expected.length));
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;

  try {
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'outreach',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    activities: syncActivities,
    meetings: syncMeetings,
    deals: syncDeals,
    emails: syncEmails,
    tasks: syncTasks,
  },
  push: { createTask },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
