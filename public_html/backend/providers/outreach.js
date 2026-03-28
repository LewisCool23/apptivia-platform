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
const { fetchJson } = require('../integrationService');

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

    if (attrs.activityType === 'call' && attrs.disposition === 'Answered') {
      kpiMappings.push({
        profileId,
        kpiKey: 'call_connects',
        increment: 1,
        externalEventId: `outreach:activity:${record.id}:call_connects`,
      });

      if (attrs.duration > 0) {
        kpiMappings.push({
          profileId,
          kpiKey: 'talk_time_minutes',
          increment: Math.round(attrs.duration / 60) || 1,
          externalEventId: `outreach:activity:${record.id}:talk_time`,
        });
      }
    }

    if (attrs.activityType === 'email' && attrs.direction === 'reply') {
      kpiMappings.push({
        profileId,
        kpiKey: 'sequence_replies',
        increment: 1,
        externalEventId: `outreach:activity:${record.id}:sequence_replies`,
      });
    }

    // Sequence enrollment events
    if (attrs.activityType === 'sequence' || attrs.action === 'sequence_start') {
      kpiMappings.push({
        profileId,
        kpiKey: 'sequences_started',
        increment: 1,
        externalEventId: `outreach:activity:${record.id}:sequences_started`,
      });
    }
  }

  const lastRecord = records[records.length - 1];
  const nextCursor = lastRecord?.attributes?.updatedAt || cursor;

  return { records, nextCursor, kpiMappings };
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
      kpiMappings.push({
        profileId,
        kpiKey: 'meetings',
        increment: 1,
        externalEventId: `outreach:meeting:${record.id}:meetings`,
      });
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
  return {
    records,
    nextCursor: lastRecord?.attributes?.updatedAt || cursor,
    kpiMappings,
    calendarEvents,
  };
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

    kpiMappings.push({
      profileId,
      kpiKey: 'sourced_opps',
      increment: 1,
      externalEventId: `outreach:opp:${record.id}:sourced`,
    });
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

    // Count opened emails (openCount > 0 means the recipient opened it)
    if (attrs.openCount > 0 || attrs.openedAt) {
      kpiMappings.push({
        profileId,
        kpiKey: 'emails_opened',
        increment: 1,
        externalEventId: `outreach:mailing:${record.id}:emails_opened`,
      });
    }
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.attributes?.updatedAt || cursor,
    kpiMappings,
  };
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

    kpiMappings.push({
      profileId,
      kpiKey: 'tasks_completed',
      increment: 1,
      externalEventId: `outreach:task:${record.id}:tasks_completed`,
    });
  }

  const lastRecord = records[records.length - 1];
  return {
    records,
    nextCursor: lastRecord?.attributes?.updatedAt || cursor,
    kpiMappings,
  };
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

// ── Webhook Support (migrated from server.js) ────────────────

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

function verifyWebhook(req) {
  const secret = env('OUTREACH_WEBHOOK_SECRET');
  if (!secret) return true;

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
  push: {
    createTask,
  },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
