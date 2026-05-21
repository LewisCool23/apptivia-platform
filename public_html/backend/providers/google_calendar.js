'use strict';

const GOOGLE_BASE = 'https://www.googleapis.com';
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

module.exports = {
  type: 'google_calendar',

  getAuthUrl(integration, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const res = await fetch(`${GOOGLE_BASE}/oauth2/v4/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    const data = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: 'Bearer',
      scope: data.scope,
    };
  },

  async refreshToken(creds) {
    const res = await fetch(`${GOOGLE_BASE}/oauth2/v4/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: creds.refresh_token,
      }),
    });
    if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
    const data = await res.json();
    return { access_token: data.access_token, expires_in: data.expires_in };
  },

  sync: {
    meetings: async (freshIntegration, cursor, sb) => {
      const token = freshIntegration.decryptedCreds.access_token;
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();

      const profileId = freshIntegration.profile_id;
      if (!profileId) return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };

      const { data: profile } = await sb.from('profiles')
        .select('role, email')
        .eq('id', profileId)
        .maybeSingle();
      if (!profile || ['admin', 'manager', 'coach'].includes(profile.role)) {
        return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };
      }

      const params = new URLSearchParams({
        timeMin: since,
        timeMax: new Date().toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });

      const res = await fetch(`${GOOGLE_BASE}/calendar/v3/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Google Calendar fetch failed: ${res.status}`);
      const data = await res.json();
      const events = data.items || [];

      const kpiMappings = [];
      for (const evt of events) {
        const isOrganizer = evt.organizer?.email?.toLowerCase() === profile.email.toLowerCase();
        const attendees = evt.attendees || [];
        const acceptedOthers = attendees.filter(a =>
          a.email?.toLowerCase() !== profile.email.toLowerCase() && a.responseStatus === 'accepted'
        );
        if (!isOrganizer || acceptedOthers.length === 0) continue;

        const weekStart = getWeekStart(evt.start?.dateTime || evt.start?.date);
        const meetingMapping = buildKpiMapping({
          profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
          source: 'google_calendar', externalEventId: `google_calendar:event:${evt.id}:meetings`, weekStart,
        });
        if (meetingMapping) kpiMappings.push(meetingMapping);
      }

      // Build calendarEvents for integration_calendar_events storage
      const calendarEvents = events.map(evt => ({
        profileId,
        externalEventId: evt.id,
        title: evt.summary || '(No title)',
        startTime: evt.start?.dateTime || evt.start?.date || null,
        endTime: evt.end?.dateTime || evt.end?.date || null,
        location: evt.location || null,
        attendees: (evt.attendees || []).map(a => ({
          email: a.email, name: a.displayName || null, status: a.responseStatus || null,
        })),
        isAllDay: !evt.start?.dateTime,
        organizerEmail: evt.organizer?.email || null,
        eventType: 'meeting',
        externalLink: evt.htmlLink || null,
        rawData: evt,
      }));

      return { records: events, nextCursor: new Date().toISOString(), kpiMappings, calendarEvents };
    },
  },

  push: {
    createMeeting: async (freshIntegration, eventData) => {
      const token = freshIntegration.decryptedCreds.access_token;
      const body = {
        summary: eventData.title,
        description: eventData.description || '',
        start: eventData.allDay
          ? { date: eventData.startTime.slice(0, 10) }
          : { dateTime: eventData.startTime, timeZone: eventData.timeZone || 'America/New_York' },
        end: eventData.allDay
          ? { date: eventData.endTime.slice(0, 10) }
          : { dateTime: eventData.endTime, timeZone: eventData.timeZone || 'America/New_York' },
        attendees: (eventData.attendees || []).map(a => ({ email: a.email, displayName: a.name || undefined })),
      };
      if (eventData.location) body.location = eventData.location;
      // Add Google Meet video conferencing if requested
      if (eventData.addVideoConference) {
        body.conferenceData = {
          createRequest: {
            requestId: `apptivia-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }
      const url = `${GOOGLE_BASE}/calendar/v3/calendars/primary/events?conferenceDataVersion=1`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Google Calendar create failed: ${res.status} ${errText}`);
      }
      const evt = await res.json();
      const meetLink = evt.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;
      return {
        externalId: evt.id,
        webLink: evt.htmlLink || null,
        meetLink,
        raw: evt,
      };
    },
  },

  gmail: {
    send: async (accessToken, { to, subject, body, fromName, fromEmail }) => {
      const message = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\r\n');
      const raw = Buffer.from(message).toString('base64url');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gmail send failed: ${res.status} ${errText}`);
      }
      return res.json();
    },
  },
};
