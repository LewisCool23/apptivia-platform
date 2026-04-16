import { supabase } from '../supabaseClient';
import { calcPct } from './kpiCalc';

/**
 * Aggregates historical data for a performance review period.
 * Returns JSONB-ready snapshots for scorecard, KPIs, skillsets, achievements, badges, coaching plans, and IDPs.
 */
export async function aggregateReviewData(
  profileId: string,
  orgId: string,
  periodStart: string,
  periodEnd: string
) {
  const results: Record<string, any> = {};

  // 1. Scorecard summary — weekly scores over the period
  try {
    const { data: kpiValues } = await supabase
      .from('kpi_values')
      .select('period_start, value, kpi_id')
      .eq('profile_id', profileId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd)
      .order('period_start', { ascending: true });

    const { data: kpiMetrics } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction, show_on_scorecard')
      .eq('is_active', true);

    const metricsMap = Object.fromEntries((kpiMetrics || []).map((m: any) => [m.id, m]));

    // Group by week and compute weekly scores
    const weekMap: Record<string, { total: number; weightSum: number; kpis: any[] }> = {};
    (kpiValues || []).forEach((v: any) => {
      const w = v.period_start;
      if (!weekMap[w]) weekMap[w] = { total: 0, weightSum: 0, kpis: [] };
      const metric = metricsMap[v.kpi_id];
      if (metric && metric.show_on_scorecard && metric.goal > 0) {
        const pct = calcPct(v.value, metric.goal, (metric as any).direction || 'higher');
        const weight = metric.weight || 1;
        weekMap[w].total += pct * weight;
        weekMap[w].weightSum += weight;
        weekMap[w].kpis.push({ key: metric.key, name: metric.name, value: v.value, goal: metric.goal, pct: Math.round(pct) });
      }
    });

    const weeklyScores = Object.entries(weekMap).map(([week, d]) => ({
      week,
      score: d.weightSum > 0 ? Math.round(d.total / d.weightSum) : 0,
      kpis: d.kpis,
    }));

    results.scorecard_summary = weeklyScores;
  } catch (err) {
    console.error('Review aggregation — scorecard error:', err);
    results.scorecard_summary = [];
  }

  // 2. KPI attainment — per-KPI average attainment over period
  try {
    const { data: kpiMetrics } = await supabase.from('kpi_metrics').select('id, key, name, goal').eq('is_active', true);
    const { data: kpiValues } = await supabase
      .from('kpi_values')
      .select('kpi_id, value')
      .eq('profile_id', profileId)
      .gte('period_start', periodStart)
      .lte('period_start', periodEnd);

    const metricMap = Object.fromEntries((kpiMetrics || []).map((m: any) => [m.id, m]));
    const accum: Record<string, { sum: number; count: number; metric: any }> = {};
    (kpiValues || []).forEach((v: any) => {
      const m = metricMap[v.kpi_id];
      if (!m) return;
      if (!accum[m.key]) accum[m.key] = { sum: 0, count: 0, metric: m };
      accum[m.key].sum += v.value;
      accum[m.key].count += 1;
    });

    results.kpi_attainment = Object.entries(accum).map(([key, d]) => ({
      key,
      name: d.metric.name,
      avg_value: Math.round((d.sum / d.count) * 100) / 100,
      goal: d.metric.goal,
      attainment_pct: d.metric.goal > 0 ? Math.round(((d.sum / d.count) / d.metric.goal) * 100) : 0,
      weeks_measured: d.count,
    }));
  } catch (err) {
    console.error('Review aggregation — KPI attainment error:', err);
    results.kpi_attainment = [];
  }

  // 3-7: Fetch skillsets, achievements, badges, coaching plans, and IDPs in parallel
  const endDateStr = periodEnd.slice(0, 10) + 'T23:59:59';
  const [skillsetRes, achievementsRes, badgesRes, coachingRes, idpRes] = await Promise.allSettled([
    supabase.from('profile_skillsets').select('skillset_id, progress, achievements_completed, total_points_earned, milestone_25_reached, milestone_50_reached, milestone_75_reached, milestone_100_reached, skillsets(name)').eq('profile_id', profileId),
    supabase.from('profile_achievements').select('achievement_id, completed_at, achievements(name, description, category, tier)').eq('profile_id', profileId).gte('completed_at', periodStart).lte('completed_at', endDateStr),
    supabase.from('profile_badges').select('id, badge_name, badge_type, earned_at').eq('profile_id', profileId).gte('earned_at', periodStart).lte('earned_at', endDateStr),
    supabase.from('coaching_plan_assignments').select('status, assigned_at, completed_at, coaching_plans(name, focus_kpis)').eq('profile_id', profileId).gte('assigned_at', periodStart),
    supabase.from('individual_development_plans').select('name, plan_type, status, period_start, period_end, milestones, career_goals').eq('profile_id', profileId).or(`period_start.lte.${periodEnd},period_end.gte.${periodStart}`),
  ]);

  // Extract data from settled promises, logging any failures
  const extract = (result: PromiseSettledResult<any>, label: string) => {
    if (result.status === 'rejected') {
      console.error(`Review aggregation — ${label} failed:`, result.reason);
      return { data: null };
    }
    if (result.value?.error) {
      console.error(`Review aggregation — ${label} query error:`, result.value.error);
    }
    return result.value;
  };
  const skillsetData = extract(skillsetRes, 'skillsets');
  const achievementsData = extract(achievementsRes, 'achievements');
  const badgesData = extract(badgesRes, 'badges');
  const coachingData = extract(coachingRes, 'coaching plans');
  const idpData = extract(idpRes, 'IDPs');

  results.skillset_progress = (skillsetData.data || []).map((s: any) => ({
    skillset_name: s.skillsets?.name || 'Unknown',
    progress: s.progress || 0,
    achievements_completed: s.achievements_completed || 0,
    total_points_earned: s.total_points_earned || 0,
    milestone_25: s.milestone_25_reached || false,
    milestone_50: s.milestone_50_reached || false,
    milestone_75: s.milestone_75_reached || false,
    milestone_100: s.milestone_100_reached || false,
  }));
  results.achievements_earned = (achievementsData.data || []).map((a: any) => ({
    name: a.achievements?.name, description: a.achievements?.description,
    category: a.achievements?.category, tier: a.achievements?.tier, completed_at: a.completed_at,
  }));
  results.badges_earned = (badgesData.data || []).map((b: any) => ({
    name: b.badge_name, description: b.badge_type,
    category: b.badge_type, tier: null, earned_at: b.earned_at,
  }));
  results.coaching_plans_summary = (coachingData.data || []).map((a: any) => ({
    name: a.coaching_plans?.name, focus_kpis: a.coaching_plans?.focus_kpis,
    status: a.status, assigned_at: a.assigned_at, completed_at: a.completed_at,
  }));
  results.idps_summary = (idpData.data || []).map((i: any) => ({
    name: i.name, plan_type: i.plan_type, status: i.status,
    milestones_completed: (i.milestones || []).filter((m: any) => m.status === 'completed').length,
    milestones_total: (i.milestones || []).length,
    career_goals_count: (i.career_goals || []).length,
  }));

  return results;
}
