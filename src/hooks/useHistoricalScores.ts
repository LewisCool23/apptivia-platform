import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

interface HistoricalScorePoint {
  week: string;
  score: number;
}

interface DateRange {
  start: string;
  end: string;
}

export function useHistoricalScores(
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  dateRange: DateRange,
  dateRangeLabel: string,
  refreshTrigger: number = 0
) {
  const [data, setData] = useState<HistoricalScorePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistoricalScores() {
      try {
        setLoading(true);
        setError(null);

        const { data: scorecardKpis, error: kpiError } = await supabase
          .from('kpi_metrics')
          .select('id, weight')
          .eq('is_active', true)
          .eq('show_on_scorecard', true);

        if (kpiError) throw kpiError;

        if (!scorecardKpis || scorecardKpis.length === 0) {
          if (!cancelled) setData([]);
          return;
        }

        const kpiIds = scorecardKpis.map((k: any) => k.id);
        const totalWeight = scorecardKpis.reduce((sum: number, k: any) => sum + (k.weight || 0), 0);

        let profilesQuery = supabase
          .from('profiles')
          .select('id, team_id, department');

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
          if (!cancelled) setData([]);
          return;
        }

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 1000 * 24));
        const weeksInRange = Math.max(1, Math.floor(daysDiff / 7));

        const isAllTime = dateRangeLabel === 'All Time';
        const isThisWeek = dateRangeLabel === 'This Week';
        const weeks = isAllTime || isThisWeek ? 5 : weeksInRange;
        const endDate = isAllTime || isThisWeek ? new Date() : end;

        const scoreData: HistoricalScorePoint[] = [];

        for (let i = weeks - 1; i >= 0; i -= 1) {
          const weekEnd = new Date(endDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
          const weekStart = new Date(weekEnd.getTime() - (7 * 24 * 60 * 60 * 1000));

          const { data: kpiValues, error: valuesError } = await supabase
            .from('kpi_values')
            .select('value, kpi_id, kpi_metrics!inner(goal, weight)')
            .in('kpi_id', kpiIds)
            .in('profile_id', profileIds)
            .lte('period_start', weekEnd.toISOString().split('T')[0])
            .gte('period_end', weekStart.toISOString().split('T')[0]);

          if (valuesError) throw valuesError;

          let weightedScore = 0;
          const kpiScores = new Map<string, { sum: number; count: number; goal: number; weight: number }>();

          if (kpiValues && kpiValues.length > 0) {
            kpiValues.forEach((kv: any) => {
              const goal = kv.kpi_metrics.goal;
              const weight = kv.kpi_metrics.weight;
              const existing = kpiScores.get(kv.kpi_id) || { sum: 0, count: 0, goal, weight };
              existing.sum += kv.value;
              existing.count += 1;
              existing.goal = goal;
              existing.weight = weight;
              kpiScores.set(kv.kpi_id, existing);
            });

            kpiScores.forEach(({ sum, count, goal, weight }) => {
              const avgValue = count > 0 ? sum / count : 0;
              const percentage = goal > 0 ? Math.min((avgValue / goal) * 100, 150) : 0;
              weightedScore += (percentage * weight);
            });

            weightedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
          }

          scoreData.push({
            week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            score: Math.round(weightedScore),
          });
        }

        if (!cancelled) setData(scoreData);
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
  }, [selectedDepartments, selectedTeams, selectedMembers, dateRange.start, dateRange.end, dateRangeLabel, refreshTrigger]);

  return { data, loading, error };
}
