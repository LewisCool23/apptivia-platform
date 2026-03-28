/**
 * Google Calendar Provider — Apptivia Integration Framework
 * -----------------------------------------------------------
 * OAuth 2.0 via Google, Google Calendar API v3.
 * Syncs: Calendar events (meetings).
 * Pushes: Create/update/delete events.
 *
 * Env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

'use strict';

const { fetchJson } = require('../integrationService');

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

function env(key) { return process.env[key] || ''; }

// ── OAuth ────────────────────────────────────────────────────

function getAuthUrl(integration, state, redirectUri) {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent', // Force refresh token on every auth
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    redirect_uri: redirectUri,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
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
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    // Google does not return a new refresh_token on refresh
    expires_in: data.expires_in || 3600,
  };
}

// ── API Helpers ──────────────────────────────────────────────

function gcalHeaders(creds) {
  return {
    Authorization: `Bearer ${creds.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function gcalGet(creds, path) {
  return fetchJson(`${GCAL_BASE}${path}`, {
    headers: gcalHeaders(creds),
  });
}

async function gcalPost(creds, path, body) {
  return fetchJson(`${GCAL_BASE}${path}`, {
    method: 'POST',
    headers: gcalHeaders(creds),
    body: JSON.stringify(body),
  });
}

async function gcalPut(creds, path, body) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: 'PUT',
    headers: gcalHeaders(creds),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Calendar PUT ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

async function gcalDelete(creds, path) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });
  if (!res.ok && res.status !== 204 && res.status !== 410) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Calendar DELETE ${path}: ${res.status} ${text}`);
  }
}

// ── Sync: Meetings ───────────────────────────────────────────

async function syncMeetings(integration, cursor) {
  const creds = integration.decryptedCreds;
  let events = [];
  let nextCursor = cursor;

  if (cursor && !cursor.startsWith('http')) {
    // Cursor is a syncToken — use incremental sync
    try {
      const path = `/calendars/primary/events?syncToken=${encodeURIComponent(cursor)}&maxResults=100`;
      const result = await gcalGet(creds, path);
      events = result.items || [];
      nextCursor = result.nextSyncToken || cursor;
    } catch (err) {
      // syncToken expired (410 Gone) — fall back to full sync
      if (err.message?.includes('410')) {
        console.warn('[google] syncToken expired, falling back to full sync');
        nextCursor = null;
      } else {
        throw err;
      }
    }
  }

  if (!nextCursor || (cursor && cursor.startsWith('http'))) {
    // Initial full sync — last 30 days + next 30 days
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const end = new Date(now);
    end.setDate(end.getDate() + 30);

    const path = `/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}`
      + '&singleEvents=true&orderBy=startTime&maxResults=100';

    const result = await gcalGet(creds, path);
    events = result.items || [];
    nextCursor = result.nextSyncToken || null;

    // Handle pagination
    let nextPageToken = result.nextPageToken;
    while (nextPageToken && events.length < 1000) {
      const pageResult = await gcalGet(creds, `${path}&pageToken=${nextPageToken}`);
      events.push(...(pageResult.items || []));
      nextPageToken = pageResult.nextPageToken;
      if (pageResult.nextSyncToken) nextCursor = pageResult.nextSyncToken;
    }
  }

  const kpiMappings = [];
  const calendarEvents = [];
  const { resolveProfileByEmail } = require('../integrationService');

  // Get user's email for profile resolution
  let userEmail = null;
  try {
    const userInfo = await fetchJson('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${creds.access_token}` },
    });
    userEmail = userInfo.email;
  } catch { /* ignore */ }

  const profileId = userEmail
    ? await resolveProfileByEmail(null, integration.organization_id, userEmail)
    : null;

  for (const event of events) {
    // Skip cancelled events
    if (event.status === 'cancelled') continue;

    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    if (!startTime || !endTime) continue;

    if (profileId) {
      kpiMappings.push({
        profileId,
        kpiKey: 'meetings',
        increment: 1,
        externalEventId: `google:event:${event.id}:meetings`,
      });
    }

    calendarEvents.push({
      externalEventId: `google:${event.id}`,
      title: event.summary || 'Google Calendar Event',
      description: event.description || null,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      location: event.location || null,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus,
      })),
      isAllDay: !!event.start?.date,
      profileId,
      organizerEmail: event.organizer?.email || userEmail,
      eventType: 'meeting',
      externalLink: event.htmlLink,
      rawData: event,
    });
  }

  return { records: events, nextCursor, kpiMappings, calendarEvents };
}

// ── Push: Create Meeting ─────────────────────────────────────

async function createMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const eventBody = {
    summary: data.title,
    description: data.description || '',
    start: {
      dateTime: data.startTime,
      timeZone: data.timeZone || 'UTC',
    },
    end: {
      dateTime: data.endTime,
      timeZone: data.timeZone || 'UTC',
    },
    location: data.location || '',
    attendees: (data.attendees || []).map(a => ({
      email: a.email,
      displayName: a.name || '',
    })),
  };

  const result = await gcalPost(creds, '/calendars/primary/events?sendUpdates=all', eventBody);

  return {
    externalId: result.id,
    webLink: result.htmlLink,
  };
}

// ── Push: Update Meeting ─────────────────────────────────────

async function updateMeeting(integration, data) {
  const creds = integration.decryptedCreds;

  const updates = {};
  if (data.title) updates.summary = data.title;
  if (data.description) updates.description = data.description;
  if (data.startTime) updates.start = { dateTime: data.startTime, timeZone: data.timeZone || 'UTC' };
  if (data.endTime) updates.end = { dateTime: data.endTime, timeZone: data.timeZone || 'UTC' };
  if (data.location) updates.location = data.location;
  if (data.attendees) {
    updates.attendees = data.attendees.map(a => ({ email: a.email, displayName: a.name || '' }));
  }

  const result = await gcalPut(creds, `/calendars/primary/events/${data.externalId}?sendUpdates=all`, updates);
  return { externalId: result.id };
}

// ── Push: Delete Meeting ─────────────────────────────────────

async function deleteMeeting(integration, externalId) {
  const creds = integration.decryptedCreds;
  await gcalDelete(creds, `/calendars/primary/events/${externalId}?sendUpdates=all`);
  return { deleted: true };
}

// ── Export ────────────────────────────────────────────────────

module.exports = {
  type: 'google_calendar',
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
