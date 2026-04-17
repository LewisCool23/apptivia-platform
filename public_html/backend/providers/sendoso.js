/**
 * Sendoso Provider — Apptivia Integration Framework
 * ---------------------------------------------------
 * OAuth 2.0, REST API, cursor-based pagination.
 * Syncs: Gifts (sends, acceptances).
 * Webhooks: gift.sent, gift.accepted, gift.meeting_booked.
 *
 * Env vars:
 *   SENDOSO_CLIENT_ID
 *   SENDOSO_CLIENT_SECRET
 */

'use strict';

const crypto = require('crypto');
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

const SENDOSO_API = 'https://app.sendoso.com/api/v3';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('SENDOSO_CLIENT_ID'),
    redirect_uri: redirectUri,
    state,
  });
  return `https://app.sendoso.com/oauth/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('SENDOSO_CLIENT_ID'),
    client_secret: env('SENDOSO_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://app.sendoso.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sendoso token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in || 7200,
  };
}

async function refreshToken(creds) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('SENDOSO_CLIENT_ID'),
    client_secret: env('SENDOSO_CLIENT_SECRET'),
  });

  const res = await fetch('https://app.sendoso.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sendoso token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || creds.refresh_token,
    expires_in: data.expires_in || 7200,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function sendosoHeaders(creds) {
  return {
    Authorization: `Bearer ${creds.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function sendosoGet(creds, path) {
  const { fetchJson } = require('../integrationService');
  return fetchJson(`${SENDOSO_API}${path}`, {
    headers: sendosoHeaders(creds),
  });
}

// ── Sync: Gifts (Sent) ──────────────────────────────────────

async function syncGifts(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const page = cursor?.page || 1;

  const result = await sendosoGet(creds, `/sends?page=${page}&per_page=100`)
    .catch(() => ({ sends: [], data: [] }));

  const sends = result.sends || result.data || [];
  const records = [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const send of sends) {
    records.push({
      external_id: send.id,
      type: 'gift',
      status: send.status,
      recipient_email: send.recipient_email || send.recipient?.email,
      sender_email: send.sender_email || send.sender?.email || send.user_email,
      created_at: send.created_at || send.sent_at,
    });

    const senderEmail = send.sender_email || send.sender?.email || send.user_email;
    if (!senderEmail) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, senderEmail);
    if (!profileId) continue;

    const weekStart = getWeekStart(send.created_at || send.sent_at);

    // Sends sent
    const sentMapping = buildKpiMapping({
      profileId, kpiKey: 'sends_sent', rawValue: 1, fromUnit: 'Count',
      source: 'sendoso', externalEventId: `sendoso:send:${send.id}:sends_sent`, weekStart,
    });
    if (sentMapping) kpiMappings.push(sentMapping);

    // Gift accepted/claimed
    const status = (send.status || '').toLowerCase();
    if (status === 'accepted' || status === 'claimed' || status === 'redeemed') {
      const acceptedMapping = buildKpiMapping({
        profileId, kpiKey: 'gifts_accepted', rawValue: 1, fromUnit: 'Count',
        source: 'sendoso', externalEventId: `sendoso:send:${send.id}:gifts_accepted`, weekStart,
      });
      if (acceptedMapping) kpiMappings.push(acceptedMapping);
    }

    // Gift-influenced meeting
    if (send.meeting_booked || send.influenced_meeting) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'gift_influenced_meetings', rawValue: 1, fromUnit: 'Count',
        source: 'sendoso', externalEventId: `sendoso:send:${send.id}:gift_influenced_meetings`, weekStart,
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
    }
  }

  const nextCursor = sends.length >= 100
    ? { page: page + 1 }
    : null;

  return { records, nextCursor, kpiMappings };
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'gift.sent':            [{ key: 'sends_sent',                increment: 1 }],
  'gift.accepted':        [{ key: 'gifts_accepted',            increment: 1 }],
  'gift.claimed':         [{ key: 'gifts_accepted',            increment: 1 }],
  'gift.meeting_booked':  [{ key: 'gift_influenced_meetings',  increment: 1 }],
};

function mapWebhookEvent(payload) {
  const eventName = payload.event || payload.event_type || '';
  const eventId = payload.data?.id || payload.send_id || null;
  const userEmail = payload.data?.sender_email
    || payload.data?.user_email
    || payload.sender_email
    || null;

  return { eventName, eventId: eventId ? String(eventId) : null, userEmail };
}

function verifyWebhook(req, explicitSecret = null) {
  const secret = explicitSecret || env('SENDOSO_CLIENT_SECRET');
  if (!secret) return true;

  const signature = req.headers['x-sendoso-signature'] || '';
  if (!signature) return true; // No signature = allow through

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
  type: 'sendoso',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    gifts: syncGifts,
  },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
