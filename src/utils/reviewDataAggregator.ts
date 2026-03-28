import { supabase } from '../supabaseClient';

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
      .select('week_start, value, kpi_metric_id')
      .eq('profile_id', profileId)
      .gte('week_start', periodStart)
      .lte('week_start', periodEnd)
      .order('week_start', { ascending: true });

    const { data: kpiMetrics } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, show_on_scorecard')
      .eq('is_active', true);

    const metricsMap = Object.fromEntries((kpiMetrics || []).map(m => [m.id, m]));

    // Group by week and compute weekly scores
    const weekMap: Record<string, { total: number; weightSum: number; kpis: any[] }> = {};
    (kpiValues || []).forEach(v => {
      const w = v.week_start;
      if (!weekMap[w]) weekMap[w] = { total: 0, weightSum: 0, kpis: [] };
      const metric = metricsMap[v.kpi_metric_id];
      if (metric && metric.show_on_scorecard && metric.goal > 0) {
        const pct = Math.min((v.value / metric.goal) * 100, 150);
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
      .select('kpi_metric_id, value')
      .eq('profile_id', profileId)
      .gte('week_start', periodStart)
      .lte('week_start', periodEnd);

    const metricMap = Object.fromEntries((kpiMetrics || []).map(m => [m.id, m]));
    const accum: Record<string, { sum: number; count: number; metric: any }> = {};
    (kpiValues || []).forEach(v => {
      const m = metricMap[v.kpi_metric_id];
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
  const [skillsetRes, achievementsRes, badgesRes, coachingRes, idpRes] = await Promise.all([
    supabase.from('profile_skillsets').select('skillset_key, current_xp, level, mastery_label').eq('profile_id', profileId).then(r => r).catch(() => ({ data: null })),
    supabase.from('profile_achievements').select('achievement_id, completed_at, achievements(name, description, category, tier)').eq('profile_id', profileId).gte('completed_at', periodStart).lte('completed_at', endDateStr).then(r => r).catch(() => ({ data: null })),
    supabase.from('profile_badges').select('badge_id, earned_at, badges(name, description, category, tier)').eq('profile_id', profileId).gte('earned_at', periodStart).lte('earned_at', endDateStr).then(r => r).catch(() => ({ data: null })),
    supabase.from('coaching_plan_assignments').select('status, assigned_at, completed_at, coaching_plans(name, focus_kpis)').eq('profile_id', profileId).gte('assigned_at', periodStart).then(r => r).catch(() => ({ data: null })),
    supabase.from('individual_development_plans').select('name, plan_type, status, period_start, period_end, milestones, career_goals').eq('profile_id', profileId).or(`period_start.lte.${periodEnd},period_end.gte.${periodStart}`).then(r => r).catch(() => ({ data: null })),
  ]);

  results.skillset_progress = skillsetRes.data || [];
  results.achievements_earned = (achievementsRes.data || []).map((a: any) => ({
    name: a.achievements?.name, description: a.achievements?.description,
    category: a.achievements?.category, tier: a.achievements?.tier, completed_at: a.completed_at,
  }));
  results.badges_earned = (badgesRes.data || []).map((b: any) => ({
    name: b.badges?.name, description: b.badges?.description,
    category: b.badges?.category, tier: b.badges?.tier, earned_at: b.earned_at,
  }));
  results.coaching_plans_summary = (coachingRes.data || []).map((a: any) => ({
    name: a.coaching_plans?.name, focus_kpis: a.coaching_plans?.focus_kpis,
    status: a.status, assigned_at: a.assigned_at, completed_at: a.completed_at,
  }));
  results.idps_summary = (idpRes.data || []).map((i: any) => ({
    name: i.name, plan_type: i.plan_type, status: i.status,
    milestones_completed: (i.milestones || []).filter((m: any) => m.status === 'completed').length,
    milestones_total: (i.milestones || []).length,
    career_goals_count: (i.career_goals || []).length,
  }));

  return results;
}
