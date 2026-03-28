/**
 * Microsoft Outlook / Calendar Provider — Apptivia Integration Framework
 * -----------------------------------------------------------------------
 * OAuth 2.0 via Microsoft Identity Platform, Microsoft Graph API v1.0.
 * Syncs: Calendar events (meetings).
 * Pushes: Create/update/delete events.
 *
 * Env vars:
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
 *   MICROSOFT_TENANT_ID  (default: 'common' for multi-tenant)
 */

'use strict';

const { fetchJson } = require('../integrationService');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function env(key) { return process.env[key] || ''; }
function getTenant() { return env('MICROSOFT_TENANT_ID') || 'common'; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const tenant = getTenant();
  const params = new URLSearchParams({
    client_id: env('MICROSOFT_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'Calendars.ReadWrite User.Read offline_access',
    state,
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const tenant = getTenant();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('MICROSOFT_CLIENT_ID'),
    client_secret: env('MICROSOFT_CLIENT_SECRET'),
    redirect_uri: redirectUri,
    scope: 'Calendars.ReadWrite User.Read offline_access',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    expires_in: data.expires_in || 3600,
  };
}

async function refreshToken(creds) {
  const tenant = getTenant();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('MICROSOFT_CLIENT_ID'),
    client_secret: env('MICROSOFT_CLIENT_SECRET'),
    scope: 'Calendars.ReadWrite User.Read offline_access',
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || creds.refresh_token,
    expires_in: data.expires_in || 3600,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function graphHeaders(creds) {
  return {
    Authorization: `Bearer ${creds.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function graphGet(creds, path) {
  return fetchJson(`${GRAPH_BASE}${path}`, {
    headers: graphHeaders(creds),
  });
}

async function graphPost(creds, path, body) {
  return fetchJson(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: graphHeaders(creds),
    body: JSON.stringify(body),
  });
}

async function graphPatch(creds, path, body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'PATCH',
    headers: graphHeaders(creds),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph PATCH ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

async function graphDelete(creds, path) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph DELETE ${path}: ${res.status} ${text}`);
  }
}

// ── Sync: Meetings (Calendar Events) ─────────────────────────

async function syncMeetings(integration, cursor) {
  const creds = integration.decryptedCreds;

  // Use delta query if we have a cursor (deltaLink), otherwise calendarView for initial sync
  let events = [];
  let nextCursor = cursor;

  if (cursor && cursor.startsWith('https://')) {
    // Delta query — cursor is the full deltaLink URL
    try {
      const result = await fetchJson(cursor, { headers: graphHeaders(creds) });
      events = result.value || [];
      nextCursor = result['@odata.deltaLink'] || result['@odata.nextLink'] || cursor;
    } catch (err) {
      // Delta token expired — fall back to full sync
      console.warn('[microsoft] Delta token expired, falling back to full sync');
      nextCursor = null;
    }
  }

  if (!nextCursor || !cursor?.startsWith('https://')) {
    // Initial sync or fallback — get last 30 days + next 30 days
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const end = new Date(now);
    end.setDate(end.getDate() + 30);

    const path = `/me/calendarview?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}`
      + '&$select=id,subject,start,end,location,attendees,organizer,webLink,isAllDay,body'
      + '&$top=100&$orderby=start/dateTime';

    const result = await graphGet(creds, path);
    events = result.value || [];

    // Get delta link for future incremental syncs
    if (result['@odata.deltaLink']) {
      nextCursor = result['@odata.deltaLink'];
    } else if (result['@odata.nextLink']) {
      nextCursor = result['@odata.nextLink'];
    }
  }

  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  // Get the authenticated user's email for profile resolution
  let userEmail = null;
  try {
    const me = await graphGet(creds, '/me?$select=mail,userPrincipalName');
    userEmail = me.mail || me.userPrincipalName;
  } catch { /* ignore */ }

  const profileId = userEmail
    ? await resolveProfileByEmail(null, integration.organization_id, userEmail)
    : null;

  for (const event of events) {
    // Skip cancelled events in delta responses
    if (event['@removed']) continue;

    const startTime = event.start?.dateTime
      ? new Date(event.start.dateTime + (event.start.timeZone === 'UTC' ? 'Z' : '')).toISOString()
      : null;
    const endTime = event.end?.dateTime
      ? new Date(event.end.dateTime + (event.end.timeZone === 'UTC' ? 'Z' : '')).toISOString()
      : null;

    if (!startTime || !endTime) continue;

    if (profileId) {
      kpiMappings.push({
        profileId,
        kpiKey: 'meetings',
        increment: 1,
        externalEventId: `microsoft:event:${event.id}:meetings`,
      });
    }

    calendarEvents.push({
      externalEventId: `microsoft:${event.id}`,
      title: event.subject || 'Outlook Event',
      description: event.body?.content?.substring(0, 2000) || null,
      startTime,
      endTime,
      location: event.location?.displayName || null,
      attendees: (event.attendees || []).map(a => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        status: a.status?.response,
      })),
      isAllDay: event.isAllDay || false,
      profileId,
      organizerEmail: event.organizer?.emailAddress?.address || userEmail,
      eventType: 'meeting',
      externalLink: event.webLink,
      rawData: event,
    });
  }

  return { records: events, nextCursor, kpiMappings, calendarEvents };
}

// ── Push: Create Meeting ─────────────────────────────────────

async function createMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const eventBody = {
    subject: data.title,
    body: {
      contentType: 'text',
      content: data.description || '',
    },
    start: {
      dateTime: data.startTime,
      timeZone: data.timeZone || 'UTC',
    },
    end: {
      dateTime: data.endTime,
      timeZone: data.timeZone || 'UTC',
    },
    location: data.location ? { displayName: data.location } : undefined,
    attendees: (data.attendees || []).map(a => ({
      emailAddress: { address: a.email, name: a.name || '' },
      type: 'required',
    })),
  };

  const result = await graphPost(creds, '/me/events', eventBody);

  return {
    externalId: result.id,
    webLink: result.webLink,
  };
}

// ── Push: Update Meeting ─────────────────────────────────────

async function updateMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const updates = {};
  if (data.title) updates.subject = data.title;
  if (data.description) updates.body = { contentType: 'text', content: data.description };
  if (data.startTime) updates.start = { dateTime: data.startTime, timeZone: data.timeZone || 'UTC' };
  if (data.endTime) updates.end = { dateTime: data.endTime, timeZone: data.timeZone || 'UTC' };
  if (data.location) updates.location = { displayName: data.location };

  const result = await graphPatch(creds, `/me/events/${data.externalId}`, updates);
  return { externalId: result.id };
}

// ── Push: Delete Meeting ─────────────────────────────────────

async function deleteMeeting(integration, externalId) {
  const creds = integration.decryptedCreds;
  await graphDelete(creds, `/me/events/${externalId}`);
  return { deleted: true };
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'microsoft_calendar',
  getAuthUrl,
  exchangeCode,
  refreshToken,
  sync: {
    meetings: syncMeetings,
  },
  push: {
    createMeeting,
    updateMeeting,
    deleteMeeting,
  },
};
