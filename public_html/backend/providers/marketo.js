/**
 * Marketo Provider — Apptivia Integration Framework
 * ---------------------------------------------------
 * Client credentials OAuth (no browser popup), REST API.
 * Syncs: Lead changes, Activities.
 * Pushes: Upsert leads.
 *
 * Marketo uses client_credentials grant — admin enters Client ID,
 * Client Secret, and Munchkin Account ID in a form (no OAuth popup).
 *
 * Env vars:
 *   MARKETO_CLIENT_ID
 *   MARKETO_CLIENT_SECRET
 *   MARKETO_MUNCHKIN_ID
 */

'use strict';

const { fetchJson } = require('../integrationService');

function env(key) { return process.env[key] || ''; }

function getBaseUrl(munchkinId) {
  const id = munchkinId || env('MARKETO_MUNCHKIN_ID');
  if (!id) throw new Error('Marketo Munchkin ID not configured');
  return `https://${id}.mktorest.com`;
}

// ── OAuth (Client Credentials) ───────────────────────────────

// Marketo does not use a browser-based OAuth flow.
// getAuthUrl returns null to signal the UI should show a credentials form instead.
const getAuthUrl = null;

async function authenticate(clientId, clientSecret, munchkinId) {
  const baseUrl = getBaseUrl(munchkinId);
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId || env('MARKETO_CLIENT_ID'),
    client_secret: clientSecret || env('MARKETO_CLIENT_SECRET'),
  });

  const res = await fetch(`${baseUrl}/identity/oauth/token?${params}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Marketo authentication failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(`Marketo auth error: ${data.errors[0].message}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in || 3600,
    scope: data.scope,
  };
}

// Marketo refresh = re-authenticate with client_credentials
async function refreshToken(creds) {
  return authenticate(creds.client_id, creds.client_secret, creds.munchkin_id);
}

// ── API Helpers ──────────────────────────────────────────────

function marketoHeaders(creds) {
  return { Authorization: `Bearer ${creds.access_token}` };
}

async function marketoGet(creds, path) {
  const baseUrl = getBaseUrl(creds.munchkin_id);
  return fetchJson(`${baseUrl}${path}`, {
    headers: marketoHeaders(creds),
  });
}

async function marketoPost(creds, path, body) {
  const baseUrl = getBaseUrl(creds.munchkin_id);
  return fetchJson(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { ...marketoHeaders(creds), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Sync: Leads ──────────────────────────────────────────────

async function syncLeads(integration, cursor) {
  const creds = integration.decryptedCreds;
  const sinceDateTime = cursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get lead changes since cursor
  const path = `/rest/v1/activities/leadchanges.json?sinceDatetime=${encodeURIComponent(sinceDateTime)}&batchSize=300`;
  const result = await marketoGet(creds, path);

  const records = result.result || [];
  const kpiMappings = [];
  // Marketo leads don't directly map to sales KPIs in the standard model
  // but could be used for marketing-qualified leads tracking

  const nextCursor = result.nextPageToken
    ? new Date().toISOString() // Use current time as next cursor
    : sinceDateTime;

  return { records, nextCursor, kpiMappings };
}

// ── Sync: Activities ─────────────────────────────────────────

async function syncActivities(integration, cursor) {
  const creds = integration.decryptedCreds;
  const sinceDateTime = cursor || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Activity type IDs: 1=Visit Web Page, 6=Send Email, 7=Email Delivered,
  // 8=Email Bounced, 9=Unsubscribe Email, 10=Open Email, 11=Click Email, 12=New Lead
  const activityTypeIds = '1,6,10,11,12';
  const path = `/rest/v1/activities.json?activityTypeIds=${activityTypeIds}&sinceDatetime=${encodeURIComponent(sinceDateTime)}&batchSize=300`;

  const result = await marketoGet(creds, path);
  const records = result.result || [];
  const kpiMappings = [];
  // Activities can be mapped to marketing KPIs if configured

  const nextCursor = result.moreResult
    ? new Date().toISOString()
    : sinceDateTime;

  return { records, nextCursor, kpiMappings };
}

// ── Push: Upsert Lead ────────────────────────────────────────

async function syncLead(integration, data) {
  const creds = integration.decryptedCreds;

  const leadBody = {
    action: 'createOrUpdate',
    lookupField: 'email',
    input: [{
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company,
      phone: data.phone,
      title: data.title,
    }],
  };

  const result = await marketoPost(creds, '/rest/v1/leads.json', leadBody);

  if (result.errors?.length) {
    throw new Error(`Marketo lead upsert error: ${result.errors[0].message}`);
  }

  return {
    externalId: result.result?.[0]?.id,
    status: result.result?.[0]?.status,
  };
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'marketo',
  getAuthUrl, // null — signals UI to show credentials form
  exchangeCode: null, // Not used — client credentials flow
  refreshToken,
  authenticate, // Extra export for direct authentication
  sync: {
    leads: syncLeads,
    activities: syncActivities,
  },
  push: {
    syncLead,
  },
};
