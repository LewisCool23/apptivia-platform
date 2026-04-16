/**
 * Gong Provider — Apptivia Integration Framework
 * ------------------------------------------------
 * OAuth 2.0, Gong API v2, cursor-based pagination.
 * Syncs: Calls (activities), Meetings.
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
const { fetchJson } = require('../integrationService');

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
  // Gong uses Basic Auth (client_id:client_secret) for token exchange
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

  // Gong returns api_base_url_for_customer — the customer-specific API base URL.
  // We pass it through so integrationService stores it as instance_url.
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: 'Bearer',
    expires_in: data.expires_in || 86400, // Gong tokens expire in ~24h
    // Custom field: the integration service stores this as instance_url
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
    // Preserve the customer-specific base URL on refresh
    instance_url: data.api_base_url_for_customer || creds.instance_url,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function getBaseUrl(integration) {
  // Customer-specific base URL stored during OAuth exchange
  return integration.instance_url || 'https://api.gong.io';
}

function gongHeaders(creds) {
  return { Authorization: `Bearer ${creds.access_token}` };
}

async function gongGet(integration, path, params = {}) {
  const url = new URL(`${getBaseUrl(integration)}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return fetchJson(url.toString(), { headers: gongHeaders(integration.decryptedCreds) });
}

async function gongPost(integration, path, body = {}) {
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
    // Fetch all users and cache them (Gong doesn't have a single-user endpoint)
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
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days

  const requestBody = {
    filter: {
      fromDateTime: lookback.toISOString(),
      toDateTime: now.toISOString(),
    },
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

    // Call connects
    kpiMappings.push({
      profileId,
      kpiKey: 'call_connects',
      increment: 1,
      source: 'gong',
      externalEventId: `gong:call:${call.metaData?.id || call.id}:call_connects`,
      weekStart,
    });

    // Talk time (duration is in seconds)
    const durationSec = call.metaData?.duration || 0;
    if (durationSec > 0) {
      kpiMappings.push({
        profileId,
        kpiKey: 'talk_time_minutes',
        increment: Math.round(durationSec / 60),
        source: 'gong',
        externalEventId: `gong:call:${call.metaData?.id || call.id}:talk_time`,
        weekStart,
      });
    }
  }

  const nextCursor = result.records?.cursor || null;
  return { records: calls, nextCursor, kpiMappings };
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const now = new Date();
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Gong treats video/web-conference calls as meetings
  const requestBody = {
    filter: {
      fromDateTime: lookback.toISOString(),
      toDateTime: now.toISOString(),
    },
  };
  if (cursor) requestBody.cursor = cursor;

  const result = await gongPost(integration, '/v2/calls', requestBody);
  const calls = result.calls || [];
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const call of calls) {
    // Only count web-conference / video calls as meetings
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
      kpiMappings.push({
        profileId,
        kpiKey: 'meetings',
        increment: 1,
        source: 'gong',
        externalEventId: `gong:meeting:${call.metaData?.id || call.id}:meetings`,
        weekStart: getWeekStart(call.metaData?.started),
      });
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
// Fetches detailed call analytics from /v2/calls/extensive:
// talk-to-listen ratio, longest monologue, questions asked,
// next steps, interactivity. These are per-call metrics that
// get averaged per rep per week using SET mode (not increment).

async function syncCallIntelligence(integration, cursor, sb) {
  const now = new Date();
  const lookback = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const requestBody = {
    filter: {
      fromDateTime: lookback.toISOString(),
      toDateTime: now.toISOString(),
    },
    contentSelector: {
      exposedFields: {
        content: {
          highlights: false,
          callOutcome: false,
          keyPoints: false,
        },
        collaboration: {
          publicComments: false,
        },
        media: false,
      },
    },
  };
  if (cursor) requestBody.cursor = cursor;

  const result = await gongPost(integration, '/v2/calls/extensive', requestBody);
  const calls = result.calls || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  // Accumulate per-rep stats then average
  const repStats = {}; // { profileId: { talkRatio: [], monologue: [], questions: 0, nextSteps: 0, interactivity: [] } }

  for (const call of calls) {
    const userId = call.metaData?.primaryUserId;
    const email = await resolveUserEmail(integration, userId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;

    if (!repStats[profileId]) {
      repStats[profileId] = { talkRatio: [], monologue: [], questions: 0, nextSteps: 0, interactivity: [] };
    }

    const stats = repStats[profileId];
    const interaction = call.interaction || {};
    const parties = call.parties || [];

    // Talk-to-listen ratio — Gong provides per-speaker talk time
    // Find the internal speaker's talk percentage
    const internalParty = parties.find(p => p.affiliation === 'Internal' || p.speakerId === call.metaData?.primaryUserId);
    if (internalParty?.talkTime != null && call.metaData?.duration > 0) {
      const ratio = (internalParty.talkTime / call.metaData.duration) * 100;
      stats.talkRatio.push(ratio);
    }

    // Longest monologue (seconds)
    if (interaction.longestMonologue?.duration != null) {
      stats.monologue.push(interaction.longestMonologue.duration);
    }

    // Questions asked
    if (interaction.questions != null) {
      stats.questions += interaction.questions;
    } else if (interaction.questionsAsked != null) {
      stats.questions += interaction.questionsAsked;
    }

    // Next steps mentioned
    if (interaction.nextSteps != null) {
      stats.nextSteps += interaction.nextSteps;
    } else if (call.content?.nextSteps?.length > 0) {
      stats.nextSteps += call.content.nextSteps.length;
    }

    // Interactivity score
    if (interaction.interactivity != null) {
      stats.interactivity.push(interaction.interactivity);
    }
  }

  // Convert accumulated stats to KPI mappings (SET mode — weekly averages)
  for (const [profileId, stats] of Object.entries(repStats)) {
    const s = stats;

    if (s.talkRatio.length > 0) {
      const avg = Math.round(s.talkRatio.reduce((a, b) => a + b, 0) / s.talkRatio.length);
      kpiMappings.push({
        profileId,
        kpiKey: 'talk_to_listen_ratio',
        value: avg,
        source: 'gong',
        externalEventId: `gong:intel:${profileId}:talk_ratio`,
      });
    }

    if (s.monologue.length > 0) {
      const avg = Math.round(s.monologue.reduce((a, b) => a + b, 0) / s.monologue.length);
      kpiMappings.push({
        profileId,
        kpiKey: 'longest_monologue_sec',
        value: avg,
        source: 'gong',
        externalEventId: `gong:intel:${profileId}:monologue`,
      });
    }

    if (s.questions > 0) {
      kpiMappings.push({
        profileId,
        kpiKey: 'questions_asked',
        increment: s.questions,
        source: 'gong',
        externalEventId: `gong:intel:${profileId}:questions`,
      });
    }

    if (s.nextSteps > 0) {
      kpiMappings.push({
        profileId,
        kpiKey: 'next_steps_mentioned',
        increment: s.nextSteps,
        source: 'gong',
        externalEventId: `gong:intel:${profileId}:next_steps`,
      });
    }

    if (s.interactivity.length > 0) {
      const avg = Math.round(s.interactivity.reduce((a, b) => a + b, 0) / s.interactivity.length);
      kpiMappings.push({
        profileId,
        kpiKey: 'interactivity_score',
        value: avg,
        source: 'gong',
        externalEventId: `gong:intel:${profileId}:interactivity`,
      });
    }
  }

  const nextCursor = result.records?.cursor || null;
  return { records: calls, nextCursor, kpiMappings };
}

// ── Helpers ───────────────────────────────────────────────────

function getWeekStart(fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'call.completed': [
    { key: 'call_connects', increment: 1 },
  ],
  'meeting.completed': [
    { key: 'meetings', increment: 1 },
  ],
};

function mapWebhookEvent(payload) {
  const eventName = payload.event || '';
  const callId = payload.data?.metaData?.id || payload.data?.callId || null;
  const userEmail = payload.data?.metaData?.primaryUserEmail || null;

  return {
    eventName,
    eventId: callId ? String(callId) : null,
    userEmail,
  };
}

function verifyWebhook(req) {
  const secret = env('GONG_CLIENT_SECRET');
  if (!secret) return true;

  const signature = req.headers['x-gong-signature'] || '';
  if (!signature) return true; // No signature header = legacy, allow through

  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
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
