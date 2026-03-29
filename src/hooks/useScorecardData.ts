import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface KPIMetric {
  id: string;
  key: string;
  name: string;
  goal: number;
  weight: number;
  unit: string;
  direction?: string; // 'higher' (default) or 'lower'
}

interface KPIValue {
  profile_id: string;
  kpi_id: string;
  value: number;
  kpi_key: string;
}

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  department: string;
  email?: string;
}

interface ScorecardRow {
  profile_id: string;
  name: string;
  team_id: string;
  team_name: string;
  department: string;
  email?: string;
  kpis: { [key: string]: { value: number; percentage: number } };
  apptivityScore: number;
}

interface TrendData {
  profile_id: string;
  currentScore: number;
  priorScore: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
  goalPacing: number;  // weekly score ≈ % of monthly goal pace
}

interface ScorecardData {
  rows: ScorecardRow[];
  topPerformer: { name: string; score: number } | null;
  mostImproved: { name: string; delta: number } | null;
  teamAverage: number;
  aboveTarget: number;
  needCoaching: number;
  trendData: TrendData[];
  histGoalMap: Record<string, { goal: number; weight: number }>;
  scorecardKpiKeys: string[];
}

// Returns the Monday of the week containing the given date.
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function useScorecardData(
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  periodStart: string = '2026-01-12',
  periodEnd: string = '2026-01-18',
  refreshTrigger: number = 0,
  // weeklyAverage: when true, values are divided by numWeeks so the scorecard
  // always shows a per-week pace (comparable across different date ranges).
  // numWeeks: number of weeks to divide by. Pass 0 for "All Time" — the hook
  // will query the actual earliest kpi_value date to compute it.
  weeklyAverage: boolean = false,
  numWeeks: number = 1
) {
  const [data, setData] = useState<ScorecardData>({
    rows: [],
    topPerformer: null,
    mostImproved: null,
    teamAverage: 0,
    aboveTarget: 0,
    needCoaching: 0,
    trendData: [],
    histGoalMap: {},
    scorecardKpiKeys: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // ── Week-align the query range ──────────────────────────────────────────
        // kpi_values uses Mon–Sun DATE columns. Comparing raw ISO timestamps
        // (which include timezone offsets) against DATE columns causes boundary
        // leaks — e.g. midnight-Monday exclusive ends resolve to the next week's
        // period_start in UTC. Always snap to date-only Mon–Sun boundaries.
        let qStart: string;
        let qEnd: string;
        let alignedNumWeeks = numWeeks;

        // Subtract 1ms so an exclusive-end midnight-of-Monday resolves to Sunday
        const endAdj = new Date(new Date(periodEnd).getTime() - 1);
        const anchorMon = getMonday(endAdj);

        if (weeklyAverage && numWeeks > 0) {
          // Multi-week average: snap to exact N Mon–Sun weeks
          const daysDiff = Math.floor(
            (new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
            (1000 * 60 * 60 * 24)
          );
          const weekCount = Math.max(1, Math.round(daysDiff / 7));
          const alignedStart = new Date(anchorMon.getTime() - (weekCount - 1) * 7 * 24 * 60 * 60 * 1000);
          const alignedEnd   = new Date(anchorMon.getTime() + 6 * 24 * 60 * 60 * 1000);

          qStart = alignedStart.toISOString().split('T')[0];
          qEnd   = alignedEnd.toISOString().split('T')[0];
          alignedNumWeeks = weekCount;
        } else {
          // Single-week or All-Time: snap to the anchor week's Mon–Sun
          // For All-Time (numWeeks=0), use the original wide start so we
          // don't accidentally narrow the range to a single week.
          const anchorSun = new Date(anchorMon.getTime() + 6 * 24 * 60 * 60 * 1000);
          qEnd = anchorSun.toISOString().split('T')[0];
          if (weeklyAverage && numWeeks === 0) {
            // All-Time: keep the original start (epoch) so all data is included
            qStart = new Date(periodStart).toISOString().split('T')[0];
          } else {
            // Single-week modes (This Week, Last Week, Custom Week)
            qStart = anchorMon.toISOString().split('T')[0];
          }
        }

        // ── STAGE 1: Independent queries in parallel ──────────────────────────
        // kpi_metrics and profiles have no dependencies on each other.
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, team_id, department, email')
          .not('role', 'in', '("admin","manager","coach")');
        if (selectedDepartments.length > 0) profilesQuery = profilesQuery.in('department', selectedDepartments);
        if (selectedTeams.length > 0) profilesQuery = profilesQuery.in('team_id', selectedTeams);
        if (selectedMembers.length > 0) profilesQuery = profilesQuery.in('id', selectedMembers);

        const [metricsResult, profilesResult] = await Promise.all([
          supabase.from('kpi_metrics').select('*').eq('is_active', true).order('scorecard_position'),
          profilesQuery,
        ]);

        if (metricsResult.error) throw metricsResult.error;
        if (profilesResult.error) throw profilesResult.error;

        const metrics: KPIMetric[] = metricsResult.data || [];
        const profiles: ProfileData[] = profilesResult.data || [];

        // Derive scorecard KPI keys from already-fetched metrics
        const scorecardKpiKeys = metrics.filter((m: any) => m.show_on_scorecard).map((m: any) => m.key as string);

        if (cancelled) return;

        if (profiles.length === 0) {
          if (!cancelled) {
            setData({
              rows: [],
              topPerformer: null,
              mostImproved: null,
              teamAverage: 0,
              aboveTarget: 0,
              needCoaching: 0,
              trendData: [],
              histGoalMap: {},
              scorecardKpiKeys,
            });
            setLoading(false);
          }
          return;
        }

        const profileIds = profiles.map((p: any) => p.id);
        const scorecardMetricIds = metrics.filter((m: any) => m.show_on_scorecard).map((m: any) => m.id);
        const uniqueTeamIds = [...new Set(profiles.map((p: any) => p.team_id).filter(Boolean))];

        // ── STAGE 2: Dependent queries in parallel ──────────────────────────────
        // All depend on Stage 1 results but are independent of each other.
        const isLivePeriod = new Date(periodEnd) >= new Date(new Date().toISOString().split('T')[0]);
        const refDate = isLivePeriod ? new Date().toISOString() : new Date(qStart).toISOString();

        const stage2: Promise<any>[] = [
          // 2a: kpi_metric_history (needs scorecardMetricIds from metrics)
          scorecardMetricIds.length > 0
            ? supabase.from('kpi_metric_history')
                .select('kpi_id, goal, weight, direction, valid_from, valid_to')
                .in('kpi_id', scorecardMetricIds)
                .lte('valid_from', refDate)
                .or(`valid_to.is.null,valid_to.gt.${refDate}`)
            : Promise.resolve({ data: [] }),
          // 2b: teams (needs uniqueTeamIds from profiles)
          uniqueTeamIds.length > 0
            ? supabase.from('teams').select('id, name').in('id', uniqueTeamIds)
            : Promise.resolve({ data: [] }),
          // 2c: kpi_values (needs profileIds from profiles)
          supabase.from('kpi_values')
            .select('profile_id, kpi_id, value, period_start, kpi_metrics!inner(key)')
            .in('profile_id', profileIds)
            .lte('period_start', qEnd)
            .gte('period_end', qStart)
            .limit(50000),
          // 2d: min date for All-Time (needs profileIds)
          (weeklyAverage && numWeeks === 0)
            ? supabase.from('kpi_values')
                .select('period_start')
                .in('profile_id', profileIds)
                .order('period_start', { ascending: true })
                .limit(1)
            : Promise.resolve({ data: null }),
        ];

        const [histResult, teamsResult, valuesResult, minDateResult] = await Promise.all(stage2);
        if (cancelled) return;
        if (valuesResult.error) throw valuesResult.error;

        // Process kpi_metric_history → histGoalMap
        let histGoalMap: Record<string, { goal: number; weight: number; direction?: string; valid_from?: string }> = {};
        (histResult.data || []).forEach((h: any) => {
          const existing = histGoalMap[h.kpi_id];
          if (!existing || new Date(h.valid_from) > new Date(existing.valid_from || '')) {
            histGoalMap[h.kpi_id] = { goal: h.goal, weight: h.weight, direction: h.direction, valid_from: h.valid_from };
          }
        });

        function histGoal(metric: any): number {
          return histGoalMap[metric.id]?.goal ?? metric.goal;
        }
        function histWeight(metric: any): number {
          return histGoalMap[metric.id]?.weight ?? metric.weight;
        }
        function histDirection(metric: any): string {
          return histGoalMap[metric.id]?.direction ?? metric.direction ?? 'higher';
        }

        // Direction-aware percentage: for "lower is better" KPIs, invert so
        // beating the goal (lower value) yields >100% and missing it yields <100%.
        // Existing "higher" KPIs are completely unaffected.
        function calcPct(value: number, goal: number, dir: string): number {
          if (goal <= 0) return 0;
          if (dir === 'lower') {
            // value=0 → perfect (cap at 200%), value=goal → 100%, value>goal → <100%
            return value > 0 ? Math.min((goal / value) * 100, 200) : 200;
          }
          return Math.min((value / goal) * 100, 200);
        }

        // Process teams → teamNameMap
        const teamNameMap: Record<string, string> = {};
        (teamsResult.data || []).forEach((t: any) => { teamNameMap[t.id] = t.name; });

        // Process min date for All-Time
        let effectiveNumWeeks = alignedNumWeeks;
        if (weeklyAverage && numWeeks === 0) {
          const minDateData = minDateResult.data;
          if (minDateData && minDateData.length > 0) {
            const minDate = new Date(minDateData[0].period_start);
            const endDate = new Date(periodEnd);
            effectiveNumWeeks = Math.max(1, (endDate.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          } else {
            effectiveNumWeeks = 1;
          }
        }

        // Warn if query limit was hit — data may be incomplete
        if (valuesResult.data && valuesResult.data.length >= 50000) {
          console.warn('kpi_values query hit 50k row limit — scorecard data may be incomplete for this date range');
        }

        // Sum all kpi_values per (profile_id, kpi_key) across all weeks in the range.
        const valuesData = valuesResult.data;
        const sums: Record<string, Record<string, number>> = {};
        (valuesData || []).forEach((v: any) => {
          const pid = v.profile_id;
          const key = (v.kpi_metrics as any)?.key;
          if (!pid || !key) return;
          if (!sums[pid]) sums[pid] = {};
          sums[pid][key] = (sums[pid][key] || 0) + (v.value || 0);
        });

        // Normalise by the sum of HISTORICAL scorecard KPI weights so apptivityScore
        // is a true weighted-average percentage against the goals/weights that were
        // in effect at the start of this period.
        const scorecardTotalWeight = metrics
          .filter((m: any) => m.show_on_scorecard)
          .reduce((sum: number, m: any) => sum + histWeight(m), 0);

        // Build scorecard rows
        const rows: ScorecardRow[] = profiles.map((profile: any) => {
          const kpis: { [key: string]: { value: number; percentage: number } } = {};
          let totalScore = 0;

          metrics.forEach((metric: any) => {
            const total = sums[profile.id]?.[metric.key] || 0;
            // When weeklyAverage is true, divide total by effectiveNumWeeks so the
            // displayed value represents a weekly pace regardless of date range length.
            const value = weeklyAverage && effectiveNumWeeks > 0
              ? Math.round((total / effectiveNumWeeks) * 10) / 10
              : total;
            // Use historical goal/direction for percentage — shows performance vs
            // the goal that was set during this period, not today's config.
            const goal = histGoal(metric);
            const percentage = calcPct(value, goal, histDirection(metric));
            kpis[metric.key] = { value, percentage };
            // Only scorecard metrics contribute to the Apptivia Score
            if (metric.show_on_scorecard) {
              totalScore += percentage * histWeight(metric);
            }
          });

          return {
            profile_id: profile.id,
            name: `${profile.first_name} ${profile.last_name}`,
            team_id: profile.team_id || '',
            team_name: teamNameMap[profile.team_id] || 'Unassigned',
            department: profile.department || '',
            email: profile.email || null,
            kpis,
            apptivityScore: Math.round(scorecardTotalWeight > 0 ? totalScore / scorecardTotalWeight : 0),
          };
        });

        // Sort by score descending
        rows.sort((a, b) => b.apptivityScore - a.apptivityScore);

        // Calculate stats
        const topPerformer = rows.length > 0
          ? { name: rows[0].name, score: rows[0].apptivityScore }
          : null;

        const teamAverage = rows.length > 0
          ? Math.round(rows.reduce((sum, r) => sum + r.apptivityScore, 0) / rows.length)
          : 0;

        const aboveTarget = rows.filter(r => r.apptivityScore >= 100).length;
        const needCoaching = rows.filter(r => r.apptivityScore < 80).length;

        // ── Trend computation (last week of period vs the week before it) ──
        // Both sides use single-week raw scores so the delta is meaningful
        // regardless of whether the scorecard is showing a weekly average.
        // Snap to Mon-Sun boundaries so each query hits exactly one DB week.
        let trendAnchor = getMonday(new Date(new Date(qEnd || periodEnd).getTime() - 1));
        // Exclude current incomplete week from trend comparison —
        // always compare the two most recently completed weeks.
        const trendCurrentMonday = getMonday(new Date());
        if (trendAnchor.getTime() >= trendCurrentMonday.getTime()) {
          trendAnchor = new Date(trendCurrentMonday.getTime() - 7 * 86400000);
        }
        const curMonday  = trendAnchor.toISOString().split('T')[0];
        const curSunday  = new Date(trendAnchor.getTime() + 6 * 86400000).toISOString().split('T')[0];
        const prevMonday = new Date(trendAnchor.getTime() - 7 * 86400000).toISOString().split('T')[0];
        const prevSunday = new Date(trendAnchor.getTime() - 1 * 86400000).toISOString().split('T')[0];

        if (cancelled) return;

        // Fetch current week (curMonday–curSunday) and prior week (prevMonday–prevSunday)
        const [{ data: currentWeekData }, { data: priorValuesData }] = await Promise.all([
          supabase
            .from('kpi_values')
            .select('profile_id, kpi_id, value, kpi_metrics!inner(key)')
            .in('profile_id', profileIds)
            .lte('period_start', curSunday)
            .gte('period_end', curMonday)
            .limit(50000),
          supabase
            .from('kpi_values')
            .select('profile_id, kpi_id, value, kpi_metrics!inner(key)')
            .in('profile_id', profileIds)
            .lte('period_start', prevSunday)
            .gte('period_end', prevMonday)
            .limit(50000),
        ]);

        const currentSums: Record<string, Record<string, number>> = {};
        (currentWeekData || []).forEach((v: any) => {
          const pid = v.profile_id;
          const key = (v.kpi_metrics as any)?.key;
          if (!pid || !key) return;
          if (!currentSums[pid]) currentSums[pid] = {};
          currentSums[pid][key] = (currentSums[pid][key] || 0) + (v.value || 0);
        });

        const priorSums: Record<string, Record<string, number>> = {};
        (priorValuesData || []).forEach((v: any) => {
          const pid = v.profile_id;
          const key = (v.kpi_metrics as any)?.key;
          if (!pid || !key) return;
          if (!priorSums[pid]) priorSums[pid] = {};
          priorSums[pid][key] = (priorSums[pid][key] || 0) + (v.value || 0);
        });

        const scorecardMetrics = metrics.filter((m: any) => m.show_on_scorecard);

        const trendData: TrendData[] = rows.map((row) => {
          // Compute single-week current score
          let currentWeekScore = 0;
          scorecardMetrics.forEach((metric: any) => {
            const val  = currentSums[row.profile_id]?.[metric.key] || 0;
            const goal = histGoal(metric);
            const pct  = calcPct(val, goal, histDirection(metric));
            currentWeekScore += pct * histWeight(metric);
          });
          currentWeekScore = Math.round(scorecardTotalWeight > 0 ? currentWeekScore / scorecardTotalWeight : 0);

          // Compute single-week prior score
          let priorScore = 0;
          scorecardMetrics.forEach((metric: any) => {
            const val  = priorSums[row.profile_id]?.[metric.key] || 0;
            const goal = histGoal(metric);
            const pct  = calcPct(val, goal, histDirection(metric));
            priorScore += pct * histWeight(metric);
          });
          priorScore = Math.round(scorecardTotalWeight > 0 ? priorScore / scorecardTotalWeight : 0);

          const delta     = currentWeekScore - priorScore;
          const direction = delta >  2 ? 'up' : delta < -2 ? 'down' : 'flat';

          // Goal pacing: project current score to end of period based on elapsed time.
          // Only meaningful for current (live) periods — caller decides whether to show it.
          let goalPacing = 0;
          const now = new Date();
          const pStart = new Date(periodStart);
          const pEnd = new Date(periodEnd);
          const totalMs = pEnd.getTime() - pStart.getTime();
          const elapsedMs = now.getTime() - pStart.getTime();
          if (totalMs > 0 && elapsedMs > 0) {
            const fractionElapsed = Math.min(1, elapsedMs / totalMs);
            // Project: if rep achieved score% in fractionElapsed of the period,
            // they're on pace for score / fractionElapsed by end of period.
            goalPacing = fractionElapsed > 0
              ? Math.min(150, Math.round(row.apptivityScore / fractionElapsed))
              : 0;
          }

          return { profile_id: row.profile_id, currentScore: currentWeekScore, priorScore, delta, direction, goalPacing };
        });

        // Most Improved: rep with largest positive week-over-week delta.
        // Fallback: if nobody improved (all deltas <= 0), show "Least Declined"
        // — the rep with the smallest negative delta.
        let mostImproved: { name: string; delta: number } | null = null;
        if (trendData.length > 0) {
          let bestDelta = -Infinity;
          trendData.forEach(t => {
            if (t.delta > bestDelta) {
              bestDelta = t.delta;
              const row = rows.find(r => r.profile_id === t.profile_id);
              if (row) mostImproved = { name: row.name, delta: t.delta };
            }
          });
        }

        // Convert histGoalMap from kpi_id → {goal,weight} to kpi_key → {goal,weight}
        // so the component can look up by key for column headers.
        const histGoalByKey: Record<string, { goal: number; weight: number }> = {};
        metrics.forEach((m: any) => {
          if (histGoalMap[m.id]) {
            histGoalByKey[m.key] = histGoalMap[m.id];
          }
        });

        if (!cancelled) {
          setData({ rows, topPerformer, mostImproved, teamAverage, aboveTarget, needCoaching, trendData, histGoalMap: histGoalByKey, scorecardKpiKeys });
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Error fetching scorecard data:', err);
        const message = err?.message || String(err);
        const isAbort = err?.name === 'AbortError' || message.includes('AbortError');
        if (!isAbort) {
          setError(message || 'Failed to load scorecard data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [selectedDepartments, selectedTeams, selectedMembers, periodStart, periodEnd, refreshTrigger, weeklyAverage, numWeeks]);

  return { data, loading, error };
}
