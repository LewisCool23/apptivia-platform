'use strict';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

module.exports = {
  type: 'microsoft_outlook',

  getAuthUrl(integration, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'Calendars.Read Mail.Read offline_access',
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
        $select: 'id,subject,start,end,organizer,attendees',
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
        kpiMappings.push({
          profileId,
          kpiKey: 'meetings',
          increment: 1,
          source: 'microsoft_outlook',
          externalEventId: `microsoft_outlook:event:${evt.id}:meetings`,
          weekStart,
        });
      }

      return { records: events, nextCursor: new Date().toISOString(), kpiMappings };
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

      const kpiMappings = emails.map(email => ({
        profileId,
        kpiKey: 'emails_sent',
        increment: 1,
        source: 'microsoft_outlook',
        externalEventId: `microsoft_outlook:email:${email.id}:emails_sent`,
        weekStart: getWeekStart(email.sentDateTime),
      }));

      return { records: emails, nextCursor: new Date().toISOString(), kpiMappings };
    },
  },
};

function getWeekStart(fromDate) {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}
