/**
 * HubSpot Provider — Apptivia Integration Framework
 * ---------------------------------------------------
 * OAuth 2.0, CRM v3 API, cursor-based pagination.
 * Syncs: Calls, Meetings, Deals.
 * Pushes: Create meetings, update deals.
 * Webhooks: deal.creation, deal.propertyChange, contact.creation.
 *
 * Env vars:
 *   HUBSPOT_CLIENT_ID
 *   HUBSPOT_CLIENT_SECRET
 */

'use strict';

const crypto = require('crypto');
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

const HS_API_BASE = 'https://api.hubapi.com';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const scopes = [
    'crm.objects.appointments.read',
    'crm.objects.appointments.write',
    'crm.objects.companies.read',
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
    'crm.objects.leads.read',
    'crm.objects.leads.write',
    'crm.objects.owners.read',
    'crm.objects.users.read',
    'timeline',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: env('HUBSPOT_CLIENT_ID'),
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('HUBSPOT_CLIENT_ID'),
    client_secret: env('HUBSPOT_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${HS_API_BASE}/oauth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HubSpot token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: 'Bearer',
    scope: data.token_type, // HubSpot includes scope info
    expires_in: data.expires_in || 1800, // HubSpot tokens expire in ~30 min
  };
}

async function refreshToken(creds) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('HUBSPOT_CLIENT_ID'),
    client_secret: env('HUBSPOT_CLIENT_SECRET'),
  });

  const res = await fetch(`${HS_API_BASE}/oauth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HubSpot token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in || 1800,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function hsHeaders(creds) {
  return { Authorization: `Bearer ${creds.access_token}` };
}

async function hsGet(creds, path, params = {}) {
  const { fetchJson } = require('../integrationService');
  const url = new URL(`${HS_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return fetchJson(url.toString(), { headers: hsHeaders(creds) });
}

async function hsPost(creds, path, body) {
  const { fetchJson } = require('../integrationService');
  return fetchJson(`${HS_API_BASE}${path}`, {
    method: 'POST',
    headers: hsHeaders(creds),
    body: JSON.stringify(body),
  });
}

async function hsPatch(creds, path, body) {
  const res = await fetch(`${HS_API_BASE}${path}`, {
    method: 'PATCH',
    headers: { ...hsHeaders(creds), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HubSpot PATCH ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Owner Mapping ────────────────────────────────────────────

const _ownerCache = {};

async function resolveOwnerEmail(creds, ownerId) {
  if (!ownerId) return null;
  if (_ownerCache[ownerId]) return _ownerCache[ownerId];

  try {
    const owner = await hsGet(creds, `/crm/v3/owners/${ownerId}`);
    const email = owner?.email || null;
    if (email) _ownerCache[ownerId] = email;
    return email;
  } catch {
    return null;
  }
}

// ── Sync: Activities (Calls) ─────────────────────────────────

async function syncActivities(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const properties = 'hs_call_status,hs_call_duration,hs_timestamp,hubspot_owner_id,hs_call_direction';

  const params = {
    properties,
    limit: 100,
    sorts: JSON.stringify([{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }]),
  };
  if (cursor) params.after = cursor;

  const result = await hsGet(creds, '/crm/v3/objects/calls', params);
  const records = result.results || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;

    // Call connects
    if (props.hs_call_status === 'COMPLETED') {
      const weekStart = getWeekStart(props.hs_timestamp || record.createdAt);

      const connectMapping = buildKpiMapping({
        profileId, kpiKey: 'call_connects', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:call:${record.id}:call_connects`, weekStart,
      });
      if (connectMapping) kpiMappings.push(connectMapping);

      // Talk time (hs_call_duration is in milliseconds)
      if (props.hs_call_duration && parseInt(props.hs_call_duration) > 0) {
        const talkTimeMapping = buildKpiMapping({
          profileId, kpiKey: 'talk_time_minutes', rawValue: parseInt(props.hs_call_duration), fromUnit: 'Milliseconds',
          source: 'hubspot', externalEventId: `hubspot:call:${record.id}:talk_time`, weekStart,
        });
        if (talkTimeMapping) kpiMappings.push(talkTimeMapping);
      }
    }
  }

  const nextCursor = result.paging?.next?.after || null;
  return { records, nextCursor, kpiMappings };
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const properties = 'hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_location,hs_meeting_body,hubspot_owner_id';

  const params = { properties, limit: 100 };
  if (cursor) params.after = cursor;

  const result = await hsGet(creds, '/crm/v3/objects/meetings', params);
  const records = result.results || [];
  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);

    const profileId = email
      ? await resolveProfileByEmail(sb, integration.organization_id, email)
      : null;

    if (profileId) {
      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:meeting:${record.id}:meetings`,
        weekStart: getWeekStart(props.hs_meeting_start_time || record.createdAt),
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);
    }

    calendarEvents.push({
      externalEventId: `hubspot:${record.id}`,
      title: props.hs_meeting_title || 'HubSpot Meeting',
      description: props.hs_meeting_body,
      startTime: props.hs_meeting_start_time,
      endTime: props.hs_meeting_end_time,
      location: props.hs_meeting_location,
      profileId,
      organizerEmail: email,
      eventType: 'meeting',
      rawData: record,
    });
  }

  const nextCursor = result.paging?.next?.after || null;
  return { records, nextCursor, kpiMappings, calendarEvents };
}

// ── Sync: Deals ──────────────────────────────────────────────

async function syncDeals(integration, cursor, sb) {
  const creds = integration.decryptedCreds;
  const properties = 'dealname,dealstage,amount,createdate,closedate,pipeline,hubspot_owner_id';

  const params = {
    properties,
    limit: 100,
    sorts: JSON.stringify([{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }]),
  };
  if (cursor) params.after = cursor;

  const result = await hsGet(creds, '/crm/v3/objects/deals', params);
  const records = result.results || [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;

    const weekStart = getWeekStart(props.createdate || record.createdAt);

    // Sourced opp
    const sourcedMapping = buildKpiMapping({
      profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
      source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:sourced`, weekStart,
    });
    if (sourcedMapping) kpiMappings.push(sourcedMapping);

    // Closed Won — HubSpot default stage
    if (props.dealstage === 'closedwon') {
      const closedWeek = getWeekStart(props.closedate || record.createdAt);
      const wonMapping = buildKpiMapping({
        profileId, kpiKey: 'closed_won', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:closed_won`, weekStart: closedWeek,
      });
      if (wonMapping) kpiMappings.push(wonMapping);

      const amount = parseFloat(props.amount);
      if (amount > 0) {
        const revenueMapping = buildKpiMapping({
          profileId, kpiKey: 'revenue_generated', rawValue: amount, fromUnit: 'Dollars',
          source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:revenue`, weekStart: closedWeek,
        });
        if (revenueMapping) kpiMappings.push(revenueMapping);
      }
    }
  }

  const nextCursor = result.paging?.next?.after || null;
  return { records, nextCursor, kpiMappings };
}

// ── Push: Create Meeting ─────────────────────────────────────

async function createMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const meetingBody = {
    properties: {
      hs_meeting_title: data.title,
      hs_meeting_body: data.description || '',
      hs_meeting_start_time: data.startTime,
      hs_meeting_end_time: data.endTime,
      hs_meeting_location: data.location || '',
    },
  };

  const result = await hsPost(creds, '/crm/v3/objects/meetings', meetingBody);
  return {
    externalId: result.id,
    webLink: `https://app.hubspot.com/contacts/meetings/${result.id}`,
  };
}

// ── Push: Update Deal ────────────────────────────────────────

async function updateDeal(integration, data) {
  const creds = integration.decryptedCreds;

  const dealBody = { properties: {} };
  if (data.stage) dealBody.properties.dealstage = data.stage;
  if (data.amount) dealBody.properties.amount = String(data.amount);
  if (data.closeDate) dealBody.properties.closedate = data.closeDate;

  const result = await hsPatch(creds, `/crm/v3/objects/deals/${data.externalId}`, dealBody);
  return { externalId: result.id };
}

// ── Webhook Support ──────────────────────────────────────────

const kpiMap = {
  'deal.creation': [{ key: 'sourced_opps', increment: 1 }],
  'deal.propertyChange': [], // Handled dynamically in mapWebhookEvent
  'contact.creation': [],
};

function mapWebhookEvent(payload) {
  // HubSpot webhook payload is an array of subscription events
  const event = Array.isArray(payload) ? payload[0] : payload;
  if (!event) return null;

  const eventName = event.subscriptionType || '';
  const eventId = event.objectId ? String(event.objectId) : null;
  const userEmail = null; // HubSpot webhooks don't include user email directly

  return { eventName, eventId, userEmail };
}

function verifyWebhook(req, explicitSecret = null) {
  const secret = explicitSecret || env('HUBSPOT_CLIENT_SECRET');
  if (!secret) return true; // No verification if no secret configured

  const signature = req.headers['x-hubspot-signature-v3'] || '';
  const timestamp = req.headers['x-hubspot-request-timestamp'] || '';

  // HubSpot v3 signature: SHA-256 HMAC of requestMethod + requestUri + requestBody + timestamp
  const sourceString = `${req.method}${req.originalUrl}${req.rawBody || JSON.stringify(req.body)}${timestamp}`;
  const expected = crypto.createHmac('sha256', secret).update(sourceString).digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'hubspot',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    activities: syncActivities,
    meetings: syncMeetings,
    deals: syncDeals,
  },
  push: {
    createMeeting,
    updateDeal,
  },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
