/**
 * Gong Provider — Apptivia Integration Framework
 * ------------------------------------------------
 * OAuth 2.0, Gong API v2, cursor-based pagination.
 * Syncs: Calls (activities), Meetings, Call Intelligence.
 * Webhooks: call.completed.
 *
 * NOTE: Gong's API base URL is customer-specific and returned
 * during token exchange as `api_base_url_for_customer`.
 * It is stored in `integration.instance_url`.
 *
 * Env vars:
 *   GONG_CLIENT_ID
 *   GONG_CLIENT_SECRET
 */

'use strict';

const crypto = require('crypto');
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const scopes = [
    'api:calls:read:basic',
    'api:calls:read:extensive',
    'api:users:read',
    'api:stats:scorecards',
    'api:stats:interaction',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: env('GONG_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
  });
  return `https://app.gong.io/oauth2/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const basicAuth = Buffer.from(
    `${env('GONG_CLIENT_ID')}:${env('GONG_CLIENT_SECRET')}`
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://app.gong.io/oauth2/generate-customer-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gong token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: 'Bearer',
    expires_in: data.expires_in || 86400,
    instance_url: data.api_base_url_for_customer || 'https://api.gong.io',
  };
}

async function refreshToken(creds) {
  const basicAuth = Buffer.from(
    `${env('GONG_CLIENT_ID')}:${env('GONG_CLIENT_SECRET')}`
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
  });

  const res = await fetch('https://app.gong.io/oauth2/generate-customer-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gong token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 86400,
    instance_url: data.api_base_url_for_customer || creds.instance_url,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function getBaseUrl(integration) {
  return integration.instance_url || 'https://api.gong.io';
}

function gongHeaders(creds) {
  return { Authorization: `Bearer ${creds.access_token}` };
}

async function gongGet(integration, path, params = {}) {
  const { fetchJson } = require('../integrationService');
  const url = new URL(`${getBaseUrl(integration)}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return fetchJson(url.toString(), { headers: gongHeaders(integration.decryptedCreds) });
}

async function gongPost(integration, path, body = {}) {
  const { fetchJson } = require('../integrationService');
  return fetchJson(`${getBaseUrl(integration)}${path}`, {
    method: 'POST',
    headers: gongHeaders(integration.decryptedCreds),
    body: JSON.stringify(body),
  });
}

// ── User Mapping ─────────────────────────────────────────────

const _userCache = {};

async function resolveUserEmail(integration, userId) {
  if (!userId) return null;
  const cacheKey = `${integration.id}:${userId}`;
  if (_userCache[cacheKey]) return _userCache[cacheKey];

  try {
    const result = await gongGet(integration, '/v2/users');
    const users = result.users || [];
    for (const user of users) {
      const k = `${integration.id}:${user.id}`;
      _userCache[k] = user.emailAddress || null;
    }
    return _userCache[cacheKey] || null;
  } catch {
    return null;
  }
}

// ── Sync: Activities (Calls) ─────────────────────────────────

async function syncActivities(integration, cursor, sb) {
  const now = new Date();
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const requestBody = {
    filter: { fromDateTime: lookback.toISOString(), toDateTime: now.toISOString() },
  };
  if (cursor) requestBody.cursor = cursor;

  const result = await gongPost(integration, '/v2/calls', requestBody);
  const calls = result.calls || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const call of calls) {
    const userId = call.metaData?.primaryUserId;
    const email = await resolveUserEmail(integration, userId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;

    const weekStart = getWeekStart(call.metaData?.started);

    const connectMapping = buildKpiMapping({
      profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
      source: 'gong', externalEventId: `gong:call:${call.metaData?.id || call.id}:call_connects`, weekStart,
    });
    if (connectMapping) kpiMappings.push(connectMapping);

    const durationSec = call.metaData?.duration || 0;
    if (durationSec > 0) {
      const talkTimeMapping = buildKpiMapping({
        profileId, kpiKey: 'talk_time_minutes', rawValue: durationSec, fromUnit: 'Seconds',
        source: 'gong', externalEventId: `gong:call:${call.metaData?.id || call.id}:talk_time`, weekStart,
      });
      if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
    }
  }

  const nextCursor = result.records?.cursor || null;
  return { records: calls, nextCursor, kpiMappings };
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const now = new Date();
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const requestBody = {
    filter: { fromDateTime: lookback.toISOString(), toDateTime: now.toISOString() },
  };
  if (cursor) requestBody.cursor = cursor;

  const result = await gongPost(integration, '/v2/calls', requestBody);
  const calls = result.calls || [];
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const call of calls) {
    const isWebConference = call.metaData?.system === 'Zoom'
      || call.metaData?.system === 'Microsoft Teams'
      || call.metaData?.system === 'Google Meet'
      || call.metaData?.system === 'Webex'
      || call.metaData?.system === 'GoToMeeting'
      || (call.metaData?.mediaType || '').toLowerCase() === 'video';

    if (!isWebConference) continue;

    const userId = call.metaData?.primaryUserId;
    const email = await resolveUserEmail(integration, userId);

    const profileId = email
      ? await resolveProfileByEmail(sb, integration.organization_id, email)
      : null;

    if (profileId) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'gong', externalEventId: `gong:meeting:${call.metaData?.id || call.id}:meetings`,
        weekStart: getWeekStart(call.metaData?.started),
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
    }

    const started = call.metaData?.started;
    const durationSec = call.metaData?.duration || 0;
    const endTime = started && durationSec
      ? new Date(new Date(started).getTime() + durationSec * 1000).toISOString()
      : null;

    calendarEvents.push({
      externalEventId: `gong:${call.metaData?.id || call.id}`,
      title: call.metaData?.title || call.metaData?.purpose || 'Gong Meeting',
      description: call.metaData?.purpose || '',
      startTime: started,
      endTime,
      location: call.metaData?.system || '',
      profileId,
      organizerEmail: email,
      eventType: 'meeting',
      rawData: call,
    });
  }

  const nextCursor = result.records?.cursor || null;
  return { records: calls, nextCursor, kpiMappings, calendarEvents };
}

// ── Sync: Call Intelligence (Extensive) ──────────────────────

async function syncCallIntelligence(integration, cursor, sb) {
  const now = new Date();
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const requestBody = {
    filter: { fromDateTime: lookback.toISOString(), toDateTime: now.toISOString() },
    contentSelector: {
      exposedFields: {
        content: { highlights: false, callOutcome: false, keyPoints: false },
        collaboration: { publicComments: false },
        media: false,
      },
    },
  };
  if (cursor) requestBody.cursor = cursor;

  const result = await gongPost(integration, '/v2/calls/extensive', requestBody);
  const calls = result.calls || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const call of calls) {
    const userId = call.metaData?.primaryUserId;
    const email = await resolveUserEmail(integration, userId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;

    const weekStart = getWeekStart(call.metaData?.started);
    const interaction = call.interaction || {};
    const parties = call.parties || [];

    // Talk-to-listen ratio
    const internalParty = parties.find(p => p.affiliation === 'Internal' || p.speakerId === call.metaData?.primaryUserId);
    if (internalParty?.talkTime != null && call.metaData?.duration > 0) {
      const ratio = (internalParty.talkTime / call.metaData.duration) * 100;
      const ratioMapping = buildKpiMapping({
        profileId, kpiKey: 'talk_to_listen_ratio', rawValue: ratio, fromUnit: 'Percent',
        source: 'gong', externalEventId: `gong:intel:${call.metaData?.id}:${profileId}:talk_ratio`, weekStart,
      });
      if (ratioMapping) kpiMappings.push(ratioMapping);
    }

    // Longest monologue
    if (interaction.longestMonologue?.duration != null) {
      const monoMapping = buildKpiMapping({
        profileId, kpiKey: 'longest_monologue_sec', rawValue: interaction.longestMonologue.duration, fromUnit: 'Seconds',
        source: 'gong', externalEventId: `gong:intel:${call.metaData?.id}:${profileId}:monologue`, weekStart,
      });
      if (monoMapping) kpiMappings.push(monoMapping);
    }

    // Questions asked
    const questions = interaction.questions ?? interaction.questionsAsked ?? 0;
    if (questions > 0) {
      const questionsMapping = buildKpiMapping({
        profileId, kpiKey: 'questions_asked', rawValue: questions, fromUnit: 'Count',
        source: 'gong', externalEventId: `gong:intel:${call.metaData?.id}:${profileId}:questions`, weekStart,
      });
      if (questionsMapping) kpiMappings.push(questionsMapping);
    }

    // Next steps mentioned
    let nextStepsCount = interaction.nextSteps ?? 0;
    if (nextStepsCount === 0 && call.content?.nextSteps?.length > 0) {
      nextStepsCount = call.content.nextSteps.length;
    }
    if (nextStepsCount > 0) {
      const nextStepsMapping = buildKpiMapping({
        profileId, kpiKey: 'next_steps_mentioned', rawValue: nextStepsCount, fromUnit: 'Count',
        source: 'gong', externalEventId: `gong:intel:${call.metaData?.id}:${profileId}:next_steps`, weekStart,
      });
      if (nextStepsMapping) kpiMappings.push(nextStepsMapping);
    }

    // Interactivity score
    if (interaction.interactivity != null) {
      const interactivityMapping = buildKpiMapping({
        profileId, kpiKey: 'interactivity_score', rawValue: interaction.interactivity, fromUnit: 'Score',
        source: 'gong', externalEventId: `gong:intel:${call.metaData?.id}:${profileId}:interactivity`, weekStart,
      });
      if (interactivityMapping) kpiMappings.push(interactivityMapping);
    }
  }

  const nextCursor = result.records?.cursor || null;
  return { records: calls, nextCursor, kpiMappings };
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'call.completed': [{ key: 'call_connects', increment: 1 }],
  'meeting.completed': [{ key: 'meetings', increment: 1 }],
};

function mapWebhookEvent(payload) {
  const eventName = payload.event || '';
  const callId = payload.data?.metaData?.id || payload.data?.callId || null;
  const userEmail = payload.data?.metaData?.primaryUserEmail || null;
  return { eventName, eventId: callId ? String(callId) : null, userEmail };
}

function verifyWebhook(req, explicitSecret = null) {
  const secret = explicitSecret || env('GONG_CLIENT_SECRET');
  if (!secret) return true;

  const signature = req.headers['x-gong-signature'] || '';
  if (!signature) return true;

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'gong',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    activities: syncActivities,
    meetings: syncMeetings,
    callIntelligence: syncCallIntelligence,
  },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
