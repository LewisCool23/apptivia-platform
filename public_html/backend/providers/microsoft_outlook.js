'use strict';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const { buildKpiMapping, getWeekStart } = require('./kpiCanonical');

module.exports = {
  type: 'microsoft_outlook',

  getAuthUrl(integration, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'Calendars.ReadWrite Mail.Read OnlineMeetings.ReadWrite offline_access',
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const res = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!res.ok) throw new Error(`Microsoft token exchange failed: ${res.status}`);
    const data = await res.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      token_type: 'Bearer',
    };
  },

  async refreshToken(creds) {
    const res = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token: creds.refresh_token,
      }),
    });
    if (!res.ok) throw new Error(`Microsoft token refresh failed: ${res.status}`);
    const data = await res.json();
    return { access_token: data.access_token, expires_in: data.expires_in };
  },

  sync: {
    meetings: async (freshIntegration, cursor, sb) => {
      const token = freshIntegration.decryptedCreds.access_token;
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();
      const until = new Date().toISOString();

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
        startDateTime: since,
        endDateTime: until,
        $select: 'id,subject,start,end,organizer,attendees,location,isAllDay,webLink',
        $top: '100',
      });

      const res = await fetch(`${GRAPH_BASE}/me/calendarView?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Microsoft Calendar fetch failed: ${res.status}`);
      const data = await res.json();
      const events = data.value || [];

      const kpiMappings = [];
      for (const evt of events) {
        const isOrganizer = evt.organizer?.emailAddress?.address?.toLowerCase() === profile.email.toLowerCase();
        const acceptedOthers = (evt.attendees || []).filter(a =>
          a.emailAddress?.address?.toLowerCase() !== profile.email.toLowerCase()
          && a.status?.response === 'accepted'
        );
        if (!isOrganizer || acceptedOthers.length === 0) continue;

        const weekStart = getWeekStart(evt.start?.dateTime);
        const meetingMapping = buildKpiMapping({
          profileId, kpiKey: 'meetings', rawValue: 1, fromUnit: 'Count',
          source: 'microsoft_outlook', externalEventId: `microsoft_outlook:event:${evt.id}:meetings`, weekStart,
        });
        if (meetingMapping) kpiMappings.push(meetingMapping);
      }

      // Build calendarEvents for integration_calendar_events storage
      const calendarEvents = events.map(evt => ({
        profileId,
        externalEventId: evt.id,
        title: evt.subject || '(No title)',
        startTime: evt.start?.dateTime || null,
        endTime: evt.end?.dateTime || null,
        location: evt.location?.displayName || null,
        attendees: (evt.attendees || []).map(a => ({
          email: a.emailAddress?.address, name: a.emailAddress?.name || null, status: a.status?.response || null,
        })),
        isAllDay: evt.isAllDay || false,
        organizerEmail: evt.organizer?.emailAddress?.address || null,
        eventType: 'meeting',
        externalLink: evt.webLink || null,
        rawData: evt,
      }));

      return { records: events, nextCursor: new Date().toISOString(), kpiMappings, calendarEvents };
    },

    emails: async (freshIntegration, cursor, sb) => {
      const token = freshIntegration.decryptedCreds.access_token;
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();

      const profileId = freshIntegration.profile_id;
      if (!profileId) return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };

      const { data: profile } = await sb.from('profiles')
        .select('role')
        .eq('id', profileId)
        .maybeSingle();
      if (!profile || ['admin', 'manager', 'coach'].includes(profile.role)) {
        return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };
      }

      const filter = `sentDateTime ge ${since} and isDraft eq false`;
      const params = new URLSearchParams({
        $filter: filter,
        $select: 'id,sentDateTime,isDraft',
        $top: '100',
        $orderby: 'sentDateTime desc',
      });

      const res = await fetch(`${GRAPH_BASE}/me/mailFolders/SentItems/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Microsoft Mail fetch failed: ${res.status}`);
      const data = await res.json();
      const emails = data.value || [];

      const kpiMappings = [];
      for (const email of emails) {
        const sentMapping = buildKpiMapping({
          profileId, kpiKey: 'emails_sent', rawValue: 1, fromUnit: 'Count',
          source: 'microsoft_outlook', externalEventId: `microsoft_outlook:email:${email.id}:emails_sent`,
          weekStart: getWeekStart(email.sentDateTime),
        });
        if (sentMapping) kpiMappings.push(sentMapping);
      }

      return { records: emails, nextCursor: new Date().toISOString(), kpiMappings };
    },
  },

  push: {
    createMeeting: async (freshIntegration, eventData) => {
      const token = freshIntegration.decryptedCreds.access_token;
      const body = {
        subject: eventData.title,
        body: { contentType: 'text', content: eventData.description || '' },
        start: { dateTime: eventData.startTime, timeZone: eventData.timeZone || 'Eastern Standard Time' },
        end: { dateTime: eventData.endTime, timeZone: eventData.timeZone || 'Eastern Standard Time' },
        attendees: (eventData.attendees || []).map(a => ({
          emailAddress: { address: a.email, name: a.name || undefined },
          type: 'required',
        })),
      };
      if (eventData.location) body.location = { displayName: eventData.location };
      // Add Microsoft Teams meeting if requested
      if (eventData.addVideoConference) {
        body.isOnlineMeeting = true;
        body.onlineMeetingProvider = 'teamsForBusiness';
      }
      const res = await fetch(`${GRAPH_BASE}/me/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Microsoft Calendar create failed: ${res.status} ${errText}`);
      }
      const evt = await res.json();
      const teamsLink = evt.onlineMeeting?.joinUrl || null;
      return {
        externalId: evt.id,
        webLink: evt.webLink || null,
        meetLink: teamsLink,
        raw: evt,
      };
    },
  },
};
