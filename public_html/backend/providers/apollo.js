/**
 * Apollo Provider — Apptivia Integration Framework
 * -------------------------------------------------
 * API key auth (no OAuth popup — admin enters API key in form).
 * Syncs: Contacts, Activities (emails, calls), Sequences.
 * Pushes: Create/update contacts, log activities.
 *
 * Apollo uses a simple API key header: X-Api-Key.
 * No token exchange or refresh needed.
 *
 * Env vars (fallback when no per-org key stored):
 *   APOLLO_API_KEY
 */

'use strict';

const { fetchJson } = require('../integrationService');

const APOLLO_BASE = 'https://api.apollo.io/v1';

function env(key) { return process.env[key] || ''; }

// ── Auth ─────────────────────────────────────────────────────

// Apollo does not use OAuth. getAuthUrl = null signals UI to show a credentials form.
const getAuthUrl = null;

// "Exchange" simply validates the API key by making a test call
async function exchangeCredentials(apiKey) {
  const res = await fetch(`${APOLLO_BASE}/auth/health`, {
    method: 'GET',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    // Fallback: try a lightweight search to validate the key
    const fallback = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1, per_page: 1 }),
    });
    if (!fallback.ok) {
      throw new Error('Invalid Apollo API key');
    }
  }

  return {
    access_token: apiKey,
    token_type: 'api_key',
    expires_in: null, // API keys don't expire
  };
}

// Apollo API keys don't expire — refreshToken is a no-op
function refreshToken(creds) {
  return Promise.resolve({
    access_token: creds.access_token || creds.api_key,
    token_type: 'api_key',
    expires_in: null,
  });
}

// ── API Helpers ──────────────────────────────────────────────

function apolloHeaders(creds) {
  const key = creds.access_token || creds.api_key || env('APOLLO_API_KEY');
  if (!key) throw new Error('Apollo API key not configured');
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' };
}

async function apolloPost(creds, path, body) {
  return fetchJson(`${APOLLO_BASE}${path}`, {
    method: 'POST',
    headers: apolloHeaders(creds),
    body: JSON.stringify(body),
  });
}

async function apolloGet(creds, path) {
  return fetchJson(`${APOLLO_BASE}${path}`, {
    headers: apolloHeaders(creds),
  });
}

// ── Sync: Activities (Emails Sent, Calls) ───────────────────

async function syncActivities(integration, cursor) {
  const creds = integration.decryptedCreds;
  const records = [];
  const kpiMappings = [];
  const { resolveProfileByEmail } = require('../integrationService');

  // Fetch email activities
  const page = cursor?.emailPage || 1;
  const emailResult = await apolloPost(creds, '/activities/search', {
    page,
    per_page: 100,
    sort_by_field: 'created_at',
    sort_ascending: false,
  }).catch(() => ({ activities: [] }));

  const activities = emailResult.activities || [];

  for (const act of activities) {
    records.push({
      external_id: act.id,
      type: act.type || 'activity',
      subject: act.subject || '',
      created_at: act.created_at,
      user_email: act.user?.email || act.emailer_email || null,
    });

    const email = act.user?.email || act.emailer_email;
    if (!email) continue;

    const profileId = await resolveProfileByEmail(null, integration.organization_id, email);
    if (!profileId) continue;

    // Map to KPIs based on activity type
    const actType = (act.type || '').toLowerCase();
    if (actType.includes('email') || actType.includes('message')) {
      kpiMappings.push({
        profileId,
        kpiKey: 'emails_sent',
        increment: 1,
        externalEventId: `apollo:activity:${act.id}:emails_sent`,
      });
    } else if (actType.includes('call') || actType.includes('phone')) {
      kpiMappings.push({
        profileId,
        kpiKey: 'call_connects',
        increment: 1,
        externalEventId: `apollo:activity:${act.id}:call_connects`,
      });
    }
  }

  const nextCursor = activities.length >= 100
    ? { emailPage: page + 1 }
    : null;

  return { records, nextCursor, kpiMappings };
}

// ── Sync: Contacts ──────────────────────────────────────────

async function syncContacts(integration, cursor) {
  const creds = integration.decryptedCreds;
  const page = cursor?.page || 1;

  const result = await apolloPost(creds, '/mixed_people/search', {
    page,
    per_page: 100,
    sort_by_field: 'updated_at',
    sort_ascending: false,
  }).catch(() => ({ people: [] }));

  const people = result.people || [];
  const records = people.map(p => ({
    external_id: p.id,
    type: 'contact',
    name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
    email: p.email,
    title: p.title,
    company: p.organization?.name || p.organization_name,
    linkedin_url: p.linkedin_url,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  const nextCursor = people.length >= 100
    ? { page: page + 1 }
    : null;

  return { records, nextCursor, kpiMappings: [] };
}

// ── Sync: Sequences ─────────────────────────────────────────

async function syncSequences(integration, cursor) {
  const creds = integration.decryptedCreds;
  const page = cursor?.page || 1;

  const result = await apolloGet(creds, `/emailer_campaigns?page=${page}&per_page=50`)
    .catch(() => ({ emailer_campaigns: [] }));

  const sequences = result.emailer_campaigns || [];
  const records = sequences.map(s => ({
    external_id: s.id,
    type: 'sequence',
    name: s.name,
    active: s.active,
    num_steps: s.emailer_steps?.length || 0,
    created_at: s.created_at,
  }));

  const nextCursor = sequences.length >= 50
    ? { page: page + 1 }
    : null;

  return { records, nextCursor, kpiMappings: [] };
}

// ── Push: Create/Update Contact ─────────────────────────────

async function createContact(integration, data) {
  const creds = integration.decryptedCreds;

  const result = await apolloPost(creds, '/contacts', {
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    title: data.title,
    organization_name: data.company,
    phone_numbers: data.phone ? [{ raw_number: data.phone }] : undefined,
  });

  return {
    externalId: result.contact?.id,
  };
}

// ── Push: Log Activity ──────────────────────────────────────

async function logActivity(integration, data) {
  const creds = integration.decryptedCreds;

  const result = await apolloPost(creds, '/activities', {
    type: data.type || 'custom',
    subject: data.subject,
    body: data.body,
    contact_id: data.contactId,
    completed_at: data.completedAt || new Date().toISOString(),
  });

  return {
    externalId: result.activity?.id,
  };
}

// ── KPI Map (for webhook events) ────────────────────────────

const kpiMap = {
  'email.sent':     [{ key: 'emails_sent', increment: 1 }],
  'email.replied':  [{ key: 'sequence_replies', increment: 1 }],
  'call.completed': [{ key: 'call_connects', increment: 1 }],
};

function mapWebhookEvent(payload) {
  // Apollo webhooks (if configured) typically send event_type + data
  const eventName = payload.event_type || payload.type || 'unknown';
  const eventId = payload.id || payload.event_id;
  const userEmail = payload.user?.email || payload.data?.user_email;
  return { eventName, eventId, userEmail };
}

function verifyWebhook(req) {
  // Apollo doesn't provide webhook signature verification out of the box.
  // Rely on the API key match in headers if present.
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return true; // Accept unsigned webhooks (Apollo doesn't sign them)
  return apiKey === env('APOLLO_API_KEY');
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'apollo',
  getAuthUrl, // null — signals UI to show API key form
  exchangeCode: null, // Not used — API key auth
  exchangeCredentials, // Validates API key
  refreshToken,
  sync: {
    activities: syncActivities,
    contacts: syncContacts,
    sequences: syncSequences,
  },
  push: {
    createContact,
    logActivity,
  },
  kpiMap,
  mapWebhookEvent,
  verifyWebhook,
};
