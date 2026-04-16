'use strict';

module.exports = {
  type: 'apollo',

  sync: {
    calls: async (freshIntegration, cursor, sb) => {
      const { api_key } = freshIntegration.decryptedCreds;
      const since = cursor || new Date(Date.now() - 7 * 86400000).toISOString();

      // Apollo personal integration — profile_id is the rep's own profile
      const profileId = freshIntegration.profile_id;
      if (!profileId) return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };

      // Check role — skip non-reps
      const { data: profile } = await sb.from('profiles')
        .select('role')
        .eq('id', profileId)
        .maybeSingle();
      if (!profile || ['admin', 'manager', 'coach'].includes(profile.role)) {
        return { records: [], nextCursor: new Date().toISOString(), kpiMappings: [] };
      }

      // Fetch calls from Apollo
      const url = `https://api.apollo.io/api/v1/calls?api_key=${encodeURIComponent(api_key)}&sort_by_field=created_at&sort_ascending=false&per_page=100`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Apollo API error: ${res.status} ${res.statusText}`);
      const data = await res.json();

      const calls = (data.calls || []).filter(c => {
        const created = new Date(c.created_at);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const call of calls) {
        // Only connected calls
        const disposition = (call.disposition || '').toLowerCase();
        const isConnected = disposition.includes('connected') || call.connected === true;
        if (!isConnected) continue;

        const callId = call.id;
        const weekStart = getWeekStart(call.created_at);

        // call_connects — 1 per connected call
        kpiMappings.push({
          profileId,
          kpiKey: 'call_connects',
          increment: 1,
          source: 'apollo',
          externalEventId: `apollo:call:${callId}:call_connects`,
          weekStart,
        });

        // talk_time_minutes — duration_in_seconds / 60
        const durationSec = call.duration_in_seconds || call.duration || 0;
        if (durationSec > 0) {
          kpiMappings.push({
            profileId,
            kpiKey: 'talk_time_minutes',
            increment: Math.round((durationSec / 60) * 100) / 100,
            source: 'apollo',
            externalEventId: `apollo:call:${callId}:talk_time_minutes`,
            weekStart,
          });
        }
      }

      return {
        records: calls,
        nextCursor: new Date().toISOString(),
        kpiMappings,
      };
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
