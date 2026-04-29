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

// ── Stage Mapping ────────────────────────────────────────────

let _dealStageMapCache = null;

async function fetchDealStageMap(creds) {
  if (_dealStageMapCache) return _dealStageMapCache;

  try {
    const result = await hsGet(creds, '/crm/v3/pipelines/deals');
    const pipelines = result.results || [];
    if (pipelines.length === 0) throw new Error('No deal pipelines returned');

    // Use the default pipeline (first one), or the one with label "default"
    const pipeline = pipelines.find(p => p.label === 'default' || p.id === 'default') || pipelines[0];
    const stages = pipeline.stages || [];

    const stageMap = {};
    for (const s of stages) {
      stageMap[s.id] = {
        label: s.label,
        displayOrder: s.displayOrder,
        metadata: s.metadata || {},
      };
    }
    console.log(`[hubspot] Loaded ${stages.length} stages from pipeline "${pipeline.label}": ${stages.map(s => `${s.label}(${s.displayOrder})`).join(', ')}`);
    _dealStageMapCache = stageMap;
    return stageMap;
  } catch (err) {
    console.warn(`[hubspot] Could not fetch deal stages: ${err.message}, using hardcoded fallback`);
    return null;
  }
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
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;
    if (await shouldSkipProfile(sb, profileId)) continue;

    const weekStart = getWeekStart(props.hs_timestamp || record.createdAt);

    // dials — every call record is a dial attempt, regardless of status
    const dialMapping = buildKpiMapping({
      profileId, kpiKey: 'dials', rawValue: 1, fromUnit: 'Count',
      source: 'hubspot', externalEventId: `hubspot:call:${record.id}:dials`, weekStart,
    });
    if (dialMapping) kpiMappings.push(dialMapping);

    // Call connects — only COMPLETED calls
    if (props.hs_call_status === 'COMPLETED') {

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
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);

    const profileId = email
      ? await resolveProfileByEmail(sb, integration.organization_id, email)
      : null;

    if (profileId && !(await shouldSkipProfile(sb, profileId))) {
      const meetingWeekStart = getWeekStart(props.hs_meeting_start_time || record.createdAt);

      const meetingMapping = buildKpiMapping({
        profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:meeting:${record.id}:meetings`,
        weekStart: meetingWeekStart,
      });
      if (meetingMapping) kpiMappings.push(meetingMapping);

      // demos_completed — meetings with "demo" in title
      if (props.hs_meeting_title && /demo/i.test(props.hs_meeting_title)) {
        const demoMapping = buildKpiMapping({
          profileId, kpiKey: 'demos_completed', rawValue: 1, fromUnit: 'Count',
          source: 'hubspot', externalEventId: `hubspot:meeting:${record.id}:demos_completed`,
          weekStart: meetingWeekStart,
        });
        if (demoMapping) kpiMappings.push(demoMapping);
      }
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
  const pipelineDeals = [];
  const { resolveProfileByEmail, shouldSkipProfile } = require('../integrationService');

  // Fetch dynamic stage metadata — falls back to hardcoded if API fails
  const stageMap = await fetchDealStageMap(creds);

  // Hardcoded fallback lists (used only when stageMap is null)
  const FALLBACK_STAGE2 = ['qualifiedtobuy', 'presentationscheduled', 'decisionmakerboughtin', 'contractsent', 'closedwon'];
  const FALLBACK_STAGE3 = ['presentationscheduled', 'decisionmakerboughtin', 'contractsent', 'closedwon'];

  for (const record of records) {
    const props = record.properties || {};
    const ownerId = props.hubspot_owner_id;
    const email = await resolveOwnerEmail(creds, ownerId);
    if (!email) continue;

    const profileId = await resolveProfileByEmail(sb, integration.organization_id, email);
    if (!profileId) continue;
    if (await shouldSkipProfile(sb, profileId)) continue;

    const weekStart = getWeekStart(props.createdate || record.createdAt);

    // Sourced opp
    const sourcedMapping = buildKpiMapping({
      profileId, kpiKey: 'sourced_opps', rawValue: 1, fromUnit: 'Count',
      source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:sourced`, weekStart,
    });
    if (sourcedMapping) kpiMappings.push(sourcedMapping);

    // pipeline_created — value of new deals
    const dealAmount = parseFloat(props.amount);
    if (dealAmount > 0) {
      const pipelineMapping = buildKpiMapping({
        profileId, kpiKey: 'pipeline_created', rawValue: dealAmount, fromUnit: 'Dollars',
        source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:pipeline_created`, weekStart,
      });
      if (pipelineMapping) kpiMappings.push(pipelineMapping);
    }

    const dealstage = props.dealstage || '';
    const stageInfo = stageMap ? stageMap[dealstage] : null;

    // Dynamic: use displayOrder thresholds (matching Apollo: >=2 = stage2, >=3 = stage3)
    // HubSpot metadata.isClosed indicates won/lost via probability
    // Fallback: use hardcoded stage ID lists
    let isStage2, isStage3, isClosedWon;

    if (stageInfo) {
      const order = stageInfo.displayOrder ?? -1;
      const isClosed = stageInfo.metadata?.isClosed === 'true';
      const probability = parseFloat(stageInfo.metadata?.probability || '0');
      const isWon = isClosed && probability >= 1.0;
      isStage2 = order >= 2 && (!isClosed || isWon);
      isStage3 = order >= 3 && (!isClosed || isWon);
      isClosedWon = isWon;
    } else {
      isStage2 = FALLBACK_STAGE2.includes(dealstage);
      isStage3 = FALLBACK_STAGE3.includes(dealstage);
      isClosedWon = dealstage === 'closedwon';
    }

    if (isStage2) {
      const stage2Mapping = buildKpiMapping({
        profileId, kpiKey: 'stage2_opps', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:stage2`, weekStart,
      });
      if (stage2Mapping) kpiMappings.push(stage2Mapping);
    }

    if (isStage3) {
      const stage3Mapping = buildKpiMapping({
        profileId, kpiKey: 'stage3_opps', rawValue: 1, fromUnit: 'Count',
        source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:stage3`, weekStart,
      });
      if (stage3Mapping) kpiMappings.push(stage3Mapping);
    }

    if (isClosedWon) {
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

      // sales_cycle_days — days from creation to close
      if (props.createdate && props.closedate) {
        const cycleDays = (new Date(props.closedate) - new Date(props.createdate)) / (1000 * 60 * 60 * 24);
        if (cycleDays >= 0) {
          const cycleMapping = buildKpiMapping({
            profileId, kpiKey: 'sales_cycle_days', rawValue: cycleDays, fromUnit: 'Days',
            source: 'hubspot', externalEventId: `hubspot:deal:${record.id}:sales_cycle_days`, weekStart: closedWeek,
          });
          if (cycleMapping) kpiMappings.push(cycleMapping);
        }
      }
    }

    // Build pipeline deal for engage_pipeline_deals upsert
    pipelineDeals.push({
      ownerId: profileId,
      dealName: props.dealname || `HubSpot Deal ${record.id}`,
      dealValue: parseFloat(props.amount) || 0,
      stage: dealstage || 'discovery',
      probability: stageInfo ? (parseFloat(stageInfo.metadata?.probability || '0') * 100) : 0,
      closeDate: props.closedate || null,
      lastActivityAt: record.updatedAt || record.createdAt || null,
      source: 'hubspot',
      externalId: record.id,
      crmUrl: `https://app.hubspot.com/contacts/${integration.organization_id}/deal/${record.id}`,
      metadata: { hsDealStage: dealstage },
    });
  }

  const nextCursor = result.paging?.next?.after || null;
  return { records, nextCursor, kpiMappings, pipelineDeals };
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
