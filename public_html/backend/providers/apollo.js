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
      const url = `https://api.apollo.io/api/v1/phone_calls/search?per_page=100&sort_by_field=created_at&sort_ascending=false`;
      const res = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'X-Api-Key': api_key,
        },
      });
      if (!res.ok) throw new Error(`Apollo API error: ${res.status} ${res.statusText}`);
      const data = await res.json();

      const calls = (data.phone_calls || []).filter(c => {
        const created = new Date(c.start_time);
        return created >= new Date(since);
      });

      const kpiMappings = [];

      for (const call of calls) {
        // Only completed calls (Apollo uses status: "completed" for connected calls)
        if (call.status !== 'completed') continue;

        const callId = call.id;
        const weekStart = getWeekStart(call.start_time);

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

      // Advance cursor to latest call's start_time, or keep current cursor if no calls
      const latestCallTime = calls.length > 0
        ? calls.reduce((max, c) => c.start_time > max ? c.start_time : max, calls[0].start_time)
        : since;

      return {
        records: calls,
        nextCursor: latestCallTime,
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
