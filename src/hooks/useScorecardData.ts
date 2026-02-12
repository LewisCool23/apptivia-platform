import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface KPIMetric {
  id: string;
  key: string;
  name: string;
  goal: number;
  weight: number;
  unit: string;
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
  department: string;
  email?: string;
  kpis: { [key: string]: { value: number; percentage: number } };
  apptivityScore: number;
}

interface ScorecardData {
  rows: ScorecardRow[];
  topPerformer: { name: string; score: number } | null;
  teamAverage: number;
  aboveTarget: number;
  needCoaching: number;
}

export function useScorecardData(
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  periodStart: string = '2026-01-12',
  periodEnd: string = '2026-01-18',
  refreshTrigger: number = 0
) {
  const [data, setData] = useState<ScorecardData>({
    rows: [],
    topPerformer: null,
    teamAverage: 0,
    aboveTarget: 0,
    needCoaching: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch KPI metrics (goals and weights) - ONLY scorecard KPIs for score calculation
        const { data: metricsData, error: metricsError } = await supabase
          .from('kpi_metrics')
          .select('*')
          .eq('is_active', true)
          .eq('show_on_scorecard', true)
          .order('scorecard_position');

        if (metricsError) throw metricsError;
        const metrics: KPIMetric[] = metricsData || [];

        // Fetch profiles with filtering
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, team_id, department, email');

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
        const profiles: ProfileData[] = profilesData || [];

        if (profiles.length === 0) {
          setData({
            rows: [],
            topPerformer: null,
            teamAverage: 0,
            aboveTarget: 0,
            needCoaching: 0,
          });
          setLoading(false);
          return;
        }

        const profileIds = profiles.map((p: any) => p.id);

        // Fetch KPI values for the period (using overlapping date range logic)
        // A period overlaps if: period_start <= filter_end AND period_end >= filter_start
        const { data: valuesData, error: valuesError } = await supabase
          .from('kpi_values')
          .select('profile_id, kpi_id, value, kpi_metrics!inner(key)')
          .in('profile_id', profileIds)
          .lte('period_start', periodEnd)
          .gte('period_end', periodStart);

        if (valuesError) throw valuesError;

        // Process data
        const rows: ScorecardRow[] = profiles.map((profile: any) => {
          const profileValues = (valuesData || []).filter(
            (v: any) => v.profile_id === profile.id
          );

          const kpis: { [key: string]: { value: number; percentage: number } } = {};
          let totalScore = 0;

          metrics.forEach((metric: any) => {
            const valueRecord = profileValues.find(
              (v: any) => (v.kpi_metrics as any)?.key === metric.key
            );
            const value = valueRecord?.value || 0;
            const percentage = metric.goal > 0 ? (value / metric.goal) * 100 : 0;
            kpis[metric.key] = { value, percentage };
            totalScore += percentage * metric.weight;
          });

          return {
            profile_id: profile.id,
            name: `${profile.first_name} ${profile.last_name}`,
            team_id: profile.team_id || '',
            department: profile.department || '',
            email: profile.email || null,
            kpis,
            apptivityScore: Math.round(totalScore),
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

        setData({ rows, topPerformer, teamAverage, aboveTarget, needCoaching });
      } catch (err: any) {
        console.error('Error fetching scorecard data:', err);
        const message = err?.message || String(err);
        const isAbort = err?.name === 'AbortError' || message.includes('AbortError');
        if (!isAbort) {
          setError(message || 'Failed to load scorecard data');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedDepartments, selectedTeams, selectedMembers, periodStart, periodEnd, refreshTrigger]);

  return { data, loading, error };
}
