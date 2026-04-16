import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { DEFAULT_TREND_WEEKS } from '../constants/kpiGuidance';
import { getMonday } from '../utils/dateUtils';
import { calcPct } from '../utils/kpiCalc';
import { LEADERSHIP_ROLE_FILTER } from '../constants/roles';

interface HistoricalScorePoint {
  week: string;
  score: number;
  hasData: boolean;
  [repId: string]: string | number | boolean; // per-rep scores keyed by profile_id
}

interface DateRange {
  start: string;
  end: string;
}

// getMonday imported from ../utils/dateUtils (X1 fix: single implementation)

export function useHistoricalScores(
  organizationId: string | null,
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  dateRange: DateRange,
  dateRangeLabel: string,
  refreshTrigger: number = 0
) {
  const [data, setData] = useState<HistoricalScorePoint[]>([]);
  const [repNames, setRepNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistoricalScores() {
      try {
        setLoading(true);
        setError(null);

        // Current scorecard KPI list — org-scoped via kpi_org_configs.
        // Falls back to global kpi_metrics if no organizationId.
        let scorecardKpis: any[] = [];
        if (organizationId) {
          const { data, error: kpiError } = await supabase
            .from('kpi_org_configs')
            .select('kpi_id, goal, weight, show_on_scorecard, kpi_metrics!inner(id, direction)')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .eq('show_on_scorecard', true);
          if (kpiError) throw kpiError;
          scorecardKpis = (data || []).map((c: any) => ({
            id: (c.kpi_metrics as any).id,
            weight: c.weight,
            goal: c.goal,
            direction: (c.kpi_metrics as any).direction,
          }));
        } else {
          const { data, error: kpiError } = await supabase
            .from('kpi_metrics')
            .select('id, weight, goal, direction')
            .eq('is_active', true)
            .eq('show_on_scorecard', true);
          if (kpiError) throw kpiError;
          scorecardKpis = data || [];
        }

        if (scorecardKpis.length === 0) {
          if (!cancelled) setData([]);
          return;
        }

        const kpiIds = scorecardKpis.map((k: any) => k.id);

        if (!organizationId) { if (!cancelled) setData([]); return; }
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, team_id, department')
          .not('role', 'in', LEADERSHIP_ROLE_FILTER)
          .eq('organization_id', organizationId);

        if (selectedDepartments.length > 0) {
          profilesQuery = profilesQuery.in('department', selectedDepartments);
        }
        if (selectedTeams.length > 0) {
          profilesQuery = profilesQuery.in('team_id', selectedTeams);
        }
        if (selectedMembers.length > 0) {
          profilesQuery = profilesQuery.in('id', selectedMembers);
        }

        const { data: profilesData, error: profilesError } = await profilesQuery;
        if (profilesError) throw profilesError;

        const profileIds = (profilesData || []).map((p: any) => p.id);
        if (profileIds.length === 0) {
          if (!cancelled) { setData([]); setRepNames({}); }
          return;
        }

        // Build rep names map for chart legend
        const namesMap: Record<string, string> = {};
        (profilesData || []).forEach((p: any) => {
          namesMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id;
        });

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const now = new Date();
        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const weeksInRange = Math.max(1, Math.round(daysDiff / 7));

        const isAllTime = dateRangeLabel === 'All Time';
        const isSingleWeek = weeksInRange <= 1; // This Week, Last Week, Custom Week, etc.
        const weeks = isAllTime || isSingleWeek ? DEFAULT_TREND_WEEKS : weeksInRange;
        // Clamp to today so ongoing/current periods don't generate future empty data points.
        const isCurrentPeriod = dateRangeLabel === 'This Week' || dateRangeLabel === 'This Month' || dateRangeLabel === 'This Quarter';
        const endDate = (isAllTime || isCurrentPeriod || end > now) ? now : end;

        // Snap to the Monday of the week containing endDate.
        // Subtract 1ms so that an exclusive-end "midnight of next Monday"
        // (e.g. dateRange.end for "Last Week") resolves to the correct Sunday
        // rather than the following Monday.
        let anchorMonday = getMonday(new Date(endDate.getTime() - 1));

        // Exclude current incomplete week — 5-week trends should always
        // reference the 5 most recently completed weeks.
        const thisMonday = getMonday(new Date());
        if (anchorMonday.getTime() >= thisMonday.getTime()) {
          anchorMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Earliest weekStart in our chart window — used to bound the history query.
        const chartRangeStart = new Date(anchorMonday.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000);

        // ── Fetch point-in-time config history ────────────────────────────────
        const rangeStart = isAllTime ? chartRangeStart : (start < chartRangeStart ? start : chartRangeStart);
        const rangeEnd = endDate;

        const { data: historyRows, error: historyError } = await supabase
          .from('kpi_metric_history')
          .select('kpi_id, goal, weight, direction, valid_from, valid_to')
          .in('kpi_id', kpiIds)
          .lte('valid_from', rangeEnd.toISOString())
          .or(`valid_to.is.null,valid_to.gte.${rangeStart.toISOString()}`);

        if (historyError) throw historyError;

        function getConfigAt(kpiId: string, atDate: Date) {
          const row = (historyRows || []).find((h: any) =>
            h.kpi_id === kpiId &&
            new Date(h.valid_from) <= atDate &&
            (h.valid_to === null || new Date(h.valid_to) > atDate)
          );
          if (row) return row;
          return (scorecardKpis || []).find((k: any) => k.id === kpiId);
        }

        // ── H3 fix: Single batched query for all weeks ────────────────────────
        const scoreData: HistoricalScorePoint[] = [];

        // Build week boundaries for all weeks
        const weekBoundaries: { weekStart: Date; weekEnd: Date }[] = [];
        for (let i = weeks - 1; i >= 0; i -= 1) {
          const weekStart = new Date(anchorMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const weekEnd   = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
          weekBoundaries.push({ weekStart, weekEnd });
        }

        // Single query spanning entire date range instead of one per week
        const firstWeekStart = weekBoundaries[0].weekStart.toISOString().split('T')[0];
        const lastWeekEnd = weekBoundaries[weekBoundaries.length - 1].weekEnd.toISOString().split('T')[0];

        const { data: allKpiValues, error: valuesError } = await supabase
          .from('kpi_values')
          .select('value, kpi_id, profile_id, period_start, period_end')
          .in('kpi_id', kpiIds)
          .in('profile_id', profileIds)
          .lte('period_start', lastWeekEnd)
          .gte('period_end', firstWeekStart);

        if (valuesError) throw valuesError;

        // Bucket values into weeks client-side
        for (const { weekStart, weekEnd } of weekBoundaries) {
          const weekStartStr = weekStart.toISOString().split('T')[0];
          const weekEndStr   = weekEnd.toISOString().split('T')[0];

          // Filter values that overlap this week's range
          const kpiValues = (allKpiValues || []).filter((kv: any) =>
            kv.period_start <= weekEndStr && kv.period_end >= weekStartStr
          );

          let weightedScore = 0;
          const hasData = kpiValues.length > 0;
          const weekPoint: HistoricalScorePoint = {
            week: `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
            score: 0,
            hasData,
          };

          if (hasData) {
            // Accumulate per-rep per-KPI sums
            const repKpiSums = new Map<string, Map<string, number>>(); // repId -> kpiId -> sum
            kpiValues.forEach((kv: any) => {
              if (!repKpiSums.has(kv.profile_id)) repKpiSums.set(kv.profile_id, new Map());
              const kpiMap = repKpiSums.get(kv.profile_id)!;
              kpiMap.set(kv.kpi_id, (kpiMap.get(kv.kpi_id) || 0) + (kv.value || 0));
            });

            // Compute week-specific totalWeight from historical config
            let weekTotalWeight = 0;
            kpiIds.forEach((id: string) => {
              const config = getConfigAt(id, weekEnd);
              if (config) weekTotalWeight += (config.weight || 0);
            });

            // Compute each rep's individual weighted score (matching useScorecardData),
            // then average across all reps. No percentage cap — consistent with stat card.
            const repScores: number[] = [];
            const perRepScores: Record<string, number> = {};
            profileIds.forEach((repId: string) => {
              let repTotal = 0;
              kpiIds.forEach((kpiId: string) => {
                const config = getConfigAt(kpiId, weekEnd);
                if (!config) return;
                const value = repKpiSums.get(repId)?.get(kpiId) || 0;
                const dir = config.direction || 'higher';
                const percentage = calcPct(value, config.goal, dir);
                repTotal += percentage * (config.weight || 0);
              });
              const score = weekTotalWeight > 0 ? repTotal / weekTotalWeight : 0;
              repScores.push(score);
              perRepScores[repId] = Math.round(score);
            });

            weightedScore = repScores.length > 0
              ? repScores.reduce((s, v) => s + v, 0) / repScores.length
              : 0;
            Object.assign(weekPoint, perRepScores);
          }

          weekPoint.score = Math.round(weightedScore);
          scoreData.push(weekPoint);
        }

        if (!cancelled) {
          setData(scoreData);
          setRepNames(namesMap);
        }
      } catch (err: any) {
        const message = err?.message || String(err);
        if (!cancelled) {
          setError(message);
          setData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistoricalScores();

    return () => {
      cancelled = true;
    };
  }, [organizationId, selectedDepartments, selectedTeams, selectedMembers, dateRange.start, dateRange.end, dateRangeLabel, refreshTrigger]);

  return { data, repNames, loading, error };
}
