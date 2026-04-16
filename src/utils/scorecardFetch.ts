/**
 * Standalone async functions for fetching scorecard + historical data.
 * These mirror the logic in useScorecardData and useHistoricalScores
 * but work imperatively (no React hooks) so they can be called from event handlers.
 *
 * Primary use: feeding buildPlaybookSummary() in handleAutoGenerate.
 */
import { supabase } from '../supabaseClient';
import { getMonday } from './dateUtils';
import { calcPct } from './kpiCalc';
import { LEADERSHIP_ROLE_FILTER } from '../constants/roles';

// getMonday imported from dateUtils (X1 fix)

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function weekLabel(sun: Date): string {
  return `${sun.getMonth() + 1}/${sun.getDate()}`;
}

// Types matching useScorecardData output shapes (what buildPlaybookSummary expects)
export interface ScorecardRow {
  profile_id: string;
  name: string;
  team_id: string;
  team_name: string;
  department: string;
  email?: string;
  kpis: Record<string, { value: number; percentage: number }>;
  apptivityScore: number;
}

export interface ScorecardResult {
  rows: ScorecardRow[];
  scorecardKpiKeys: string[];
  teamAverage: number;
  topPerformer: { name: string; score: number } | null;
}

export interface HistoricalScorePoint {
  week: string;
  score: number;
  hasData: boolean;
  [repId: string]: number | string | boolean;
}

/**
 * Fetch scorecard data for a specific team for a single week.
 * Returns shapes compatible with buildPlaybookSummary's `scorecardData` param.
 */
export async function fetchScorecardDataForTeam(
  teamId: string,
  weekStart: string,
  weekEnd: string,
  organizationId?: string | null
): Promise<ScorecardResult> {
  // 1. Fetch active KPI metrics — org-scoped via kpi_org_configs when possible
  let metrics: any[] = [];
  if (organizationId) {
    const { data } = await supabase
      .from('kpi_org_configs')
      .select('kpi_id, goal, weight, is_active, show_on_scorecard, scorecard_position, kpi_metrics!inner(id, key, name, direction)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('scorecard_position');
    metrics = (data || []).map((c: any) => ({
      id: (c.kpi_metrics as any).id, key: (c.kpi_metrics as any).key,
      name: (c.kpi_metrics as any).name, direction: (c.kpi_metrics as any).direction,
      goal: c.goal, weight: c.weight, show_on_scorecard: c.show_on_scorecard,
    }));
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction, show_on_scorecard')
      .eq('is_active', true)
      .order('scorecard_position');
    metrics = data || [];
  }
  if (!metrics.length) return { rows: [], scorecardKpiKeys: [], teamAverage: 0, topPerformer: null };

  const scorecardMetrics = metrics.filter(m => m.show_on_scorecard);
  const scorecardKpiKeys = scorecardMetrics.map(m => m.key);

  // 2. Fetch profiles in this team (reps only) — org-scoped
  let profilesQ = supabase
    .from('profiles')
    .select('id, first_name, last_name, team_id, department, email')
    .eq('team_id', teamId)
    .not('role', 'in', LEADERSHIP_ROLE_FILTER);
  if (organizationId) profilesQ = profilesQ.eq('organization_id', organizationId);
  const { data: profiles } = await profilesQ;
  if (!profiles?.length) return { rows: [], scorecardKpiKeys, teamAverage: 0, topPerformer: null };

  const profileIds = profiles.map((p: any) => p.id);

  // 3. Fetch KPI values for the week
  const { data: kpiValues } = await supabase
    .from('kpi_values')
    .select('profile_id, kpi_id, value')
    .in('profile_id', profileIds)
    .lte('period_start', weekEnd)
    .gte('period_end', weekStart);

  // 4. Build metric lookup
  const metricById: Record<string, typeof metrics[0]> = {};
  metrics.forEach(m => { metricById[m.id] = m; });

  // 5. Aggregate values per (profile, kpi)
  const valMap: Record<string, Record<string, number>> = {};
  (kpiValues || []).forEach((v: any) => {
    if (!valMap[v.profile_id]) valMap[v.profile_id] = {};
    const metric = metricById[v.kpi_id];
    if (!metric) return;
    const key = metric.key;
    valMap[v.profile_id][key] = (valMap[v.profile_id][key] || 0) + (v.value || 0);
  });

  // 6. Compute rows
  const rows: ScorecardRow[] = profiles.map((p: any) => {
    const vals = valMap[p.id] || {};
    const kpis: Record<string, { value: number; percentage: number }> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    scorecardMetrics.forEach(m => {
      const value = vals[m.key] || 0;
      const dir = (m as any).direction || 'higher';
      const percentage = calcPct(value, m.goal, dir);
      kpis[m.key] = { value, percentage };
      weightedSum += percentage * (m.weight || 0);
      totalWeight += m.weight || 0;
    });

    return {
      profile_id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      team_id: p.team_id,
      team_name: '',
      department: p.department || '',
      email: p.email || '',
      kpis,
      apptivityScore: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0,
    };
  });

  rows.sort((a, b) => b.apptivityScore - a.apptivityScore);

  const teamAverage = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.apptivityScore, 0) / rows.length)
    : 0;

  const topPerformer = rows.length > 0 ? { name: rows[0].name, score: rows[0].apptivityScore } : null;

  return { rows, scorecardKpiKeys, teamAverage, topPerformer };
}

/**
 * Fetch historical weekly scores for a team over N weeks.
 * Returns shapes compatible with buildPlaybookSummary's `historicalScores` + `repNames` params.
 */
export async function fetchHistoricalScoresForTeam(
  teamId: string,
  weeks: number = 5,
  organizationId?: string | null
): Promise<{ data: HistoricalScorePoint[]; repNames: Record<string, string> }> {
  // 1. Fetch scorecard metrics — org-scoped via kpi_org_configs when possible
  let metrics: any[] = [];
  if (organizationId) {
    const { data } = await supabase
      .from('kpi_org_configs')
      .select('kpi_id, goal, weight, show_on_scorecard, kpi_metrics!inner(id, key, direction)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = (data || []).map((c: any) => ({
      id: (c.kpi_metrics as any).id, key: (c.kpi_metrics as any).key,
      direction: (c.kpi_metrics as any).direction,
      goal: c.goal, weight: c.weight,
    }));
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, goal, weight, direction')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = data || [];
  }
  if (!metrics.length) return { data: [], repNames: {} };

  const kpiIds = metrics.map(m => m.id);
  const metricById: Record<string, typeof metrics[0]> = {};
  metrics.forEach(m => { metricById[m.id] = m; });

  // 2. Fetch profiles — org-scoped
  let profQ = supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('team_id', teamId)
    .not('role', 'in', LEADERSHIP_ROLE_FILTER);
  if (organizationId) profQ = profQ.eq('organization_id', organizationId);
  const { data: profiles } = await profQ;
  if (!profiles?.length) return { data: [], repNames: {} };

  const profileIds = profiles.map((p: any) => p.id);
  const repNames: Record<string, string> = {};
  profiles.forEach((p: any) => { repNames[p.id] = `${p.first_name} ${p.last_name}`; });

  // 3. Compute week boundaries (most recent complete weeks)
  const now = new Date();
  const thisMonday = getMonday(now);
  // Anchor = last completed week's Monday
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);

  // 4. H3 fix: single batched query instead of N+1 per-week queries
  const oldestMonday = new Date(anchorMonday.getTime() - (weeks - 1) * 7 * 86400000);
  const newestSunday = new Date(anchorMonday.getTime() + 6 * 86400000);

  const { data: allVals } = await supabase
    .from('kpi_values')
    .select('value, kpi_id, profile_id, period_start')
    .in('kpi_id', kpiIds)
    .in('profile_id', profileIds)
    .gte('period_start', fmt(oldestMonday))
    .lte('period_start', fmt(newestSunday));

  // Bucket values by week
  const weekBuckets: Record<string, typeof allVals> = {};
  (allVals || []).forEach((v: any) => {
    const vMon = getMonday(new Date(v.period_start));
    const key = fmt(vMon);
    if (!weekBuckets[key]) weekBuckets[key] = [];
    weekBuckets[key]!.push(v);
  });

  const weekPoints: HistoricalScorePoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const wMonday = new Date(anchorMonday.getTime() - w * 7 * 86400000);
    const wSunday = new Date(wMonday.getTime() + 6 * 86400000);
    const wKey = fmt(wMonday);
    const vals = weekBuckets[wKey];

    if (!vals?.length) {
      weekPoints.push({ week: weekLabel(wSunday), score: 0, hasData: false });
      continue;
    }

    // Aggregate per (profile, kpi)
    const repKpiSums: Record<string, Record<string, number>> = {};
    vals.forEach((v: any) => {
      if (!repKpiSums[v.profile_id]) repKpiSums[v.profile_id] = {};
      repKpiSums[v.profile_id][v.kpi_id] = (repKpiSums[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
    });

    // Compute per-rep scores
    const point: HistoricalScorePoint = { week: weekLabel(wSunday), score: 0, hasData: true };
    let totalScore = 0;
    let repCount = 0;

    for (const pid of profileIds) {
      const sums = repKpiSums[pid];
      if (!sums) continue;
      let wSum = 0;
      let wWeight = 0;
      for (const m of metrics) {
        const val = sums[m.id] || 0;
        const dir = (m as any).direction || 'higher';
        const pct = calcPct(val, m.goal, dir);
        wSum += pct * (m.weight || 0);
        wWeight += m.weight || 0;
      }
      const repScore = wWeight > 0 ? Math.round(wSum / wWeight) : 0;
      (point as any)[pid] = repScore;
      totalScore += repScore;
      repCount++;
    }

    point.score = repCount > 0 ? Math.round(totalScore / repCount) : 0;
    weekPoints.push(point);
  }

  return { data: weekPoints, repNames };
}

/**
 * Fetch 5-week historical trend for a single rep.
 * Returns per-week overall score + per-KPI attainment for trend analysis.
 */
export interface RepWeeklyTrend {
  week: string;
  weekStart: string;
  weekEnd: string;
  score: number;
  hasData: boolean;
  kpis: Record<string, { value: number; percentage: number }>;
}

export interface RepTrendResult {
  weeks: RepWeeklyTrend[];
  currentScore: number;
  oldestScore: number;
  trendDelta: number;
  avg5w: number;
  laggingKpis: Array<{ key: string; label: string; percentage: number; goal: number; tier: number; tierLabel: string; avg5wPct: number; trendDelta: number }>;
  onTrackCount: number;
  exceedingCount: number;
}

export async function fetchRepTrend(
  profileId: string,
  weeks: number = 5,
  organizationId?: string | null
): Promise<RepTrendResult> {
  // 1. Fetch scorecard metrics — org-scoped via kpi_org_configs when possible
  let metrics: any[] = [];
  if (organizationId) {
    const { data } = await supabase
      .from('kpi_org_configs')
      .select('kpi_id, goal, weight, show_on_scorecard, kpi_metrics!inner(id, key, name, direction)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = (data || []).map((c: any) => ({
      id: (c.kpi_metrics as any).id, key: (c.kpi_metrics as any).key,
      name: (c.kpi_metrics as any).name, direction: (c.kpi_metrics as any).direction,
      goal: c.goal, weight: c.weight, show_on_scorecard: c.show_on_scorecard,
    }));
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction, show_on_scorecard')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = data || [];
  }
  if (!metrics.length) return { weeks: [], currentScore: 0, oldestScore: 0, trendDelta: 0, avg5w: 0, laggingKpis: [], onTrackCount: 0, exceedingCount: 0 };

  const kpiIds = metrics.map(m => m.id);
  const metricById: Record<string, typeof metrics[0]> = {};
  metrics.forEach(m => { metricById[m.id] = m; });

  // 2. Compute week boundaries
  const now = new Date();
  const thisMonday = getMonday(now);
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);

  // 3. H3 fix: single batched query instead of N+1 per-week queries
  const oldestMonday = new Date(anchorMonday.getTime() - (weeks - 1) * 7 * 86400000);
  const newestSunday = new Date(anchorMonday.getTime() + 6 * 86400000);

  const { data: allVals } = await supabase
    .from('kpi_values')
    .select('value, kpi_id, period_start')
    .eq('profile_id', profileId)
    .in('kpi_id', kpiIds)
    .gte('period_start', fmt(oldestMonday))
    .lte('period_start', fmt(newestSunday));

  // Bucket values by week
  const weekBuckets: Record<string, typeof allVals> = {};
  (allVals || []).forEach((v: any) => {
    const vMon = getMonday(new Date(v.period_start));
    const key = fmt(vMon);
    if (!weekBuckets[key]) weekBuckets[key] = [];
    weekBuckets[key]!.push(v);
  });

  const weekData: RepWeeklyTrend[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const wMonday = new Date(anchorMonday.getTime() - w * 7 * 86400000);
    const wSunday = new Date(wMonday.getTime() + 6 * 86400000);
    const wStart = fmt(wMonday);
    const wEnd = fmt(wSunday);
    const vals = weekBuckets[wStart];

    if (!vals?.length) {
      weekData.push({ week: weekLabel(wSunday), weekStart: wStart, weekEnd: wEnd, score: 0, hasData: false, kpis: {} });
      continue;
    }

    // Aggregate per KPI
    const kpiSums: Record<string, number> = {};
    vals.forEach((v: any) => {
      const m = metricById[v.kpi_id];
      if (!m) return;
      kpiSums[m.key] = (kpiSums[m.key] || 0) + (v.value || 0);
    });

    let weightedSum = 0;
    let totalWeight = 0;
    const kpis: Record<string, { value: number; percentage: number }> = {};

    metrics.forEach(m => {
      const value = kpiSums[m.key] || 0;
      const dir = (m as any).direction || 'higher';
      const percentage = calcPct(value, m.goal, dir);
      kpis[m.key] = { value, percentage };
      weightedSum += percentage * (m.weight || 0);
      totalWeight += m.weight || 0;
    });

    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    weekData.push({ week: weekLabel(wSunday), weekStart: wStart, weekEnd: wEnd, score, hasData: true, kpis });
  }

  // 4. Compute summary stats
  const withData = weekData.filter(w => w.hasData);
  const currentScore = withData.length > 0 ? withData[withData.length - 1].score : 0;
  const oldestScore = withData.length > 0 ? withData[0].score : 0;
  const trendDelta = currentScore - oldestScore;
  const avg5w = withData.length > 0 ? Math.round(withData.reduce((s, w) => s + w.score, 0) / withData.length) : 0;

  // 5. Per-KPI trend analysis using the most recent week with data
  const latestWeek = withData.length > 0 ? withData[withData.length - 1] : null;
  const laggingKpis: RepTrendResult['laggingKpis'] = [];
  let onTrackCount = 0;
  let exceedingCount = 0;

  if (latestWeek) {
    // Import tier info inline
    const tierForKey = (key: string): { tier: number; tierLabel: string } => {
      // Check if it's a scorecard priority based on weight
      const m = metrics.find(met => met.key === key);
      const weight = m?.weight || 0;
      if (weight >= 15) return { tier: 1, tierLabel: 'Scorecard Priority' };
      if (key.startsWith('engage_')) return { tier: 3, tierLabel: 'Engage Adoption' };
      return { tier: 2, tierLabel: 'Core Skill' };
    };

    metrics.forEach(m => {
      const current = latestWeek.kpis[m.key]?.percentage || 0;

      // Compute 5-week average for this KPI
      const kpiWeeks = withData.map(w => w.kpis[m.key]?.percentage || 0);
      const kpiAvg5w = kpiWeeks.length > 0 ? Math.round(kpiWeeks.reduce((s, v) => s + v, 0) / kpiWeeks.length) : 0;

      // KPI trend
      const firstKpiPct = withData.length > 0 ? (withData[0].kpis[m.key]?.percentage || 0) : 0;
      const kpiTrendDelta = current - firstKpiPct;

      const { tier, tierLabel } = tierForKey(m.key);

      if (current < 80) {
        laggingKpis.push({ key: m.key, label: m.name || m.key, percentage: current, goal: m.goal, tier, tierLabel, avg5wPct: kpiAvg5w, trendDelta: kpiTrendDelta });
      } else if (current >= 100) {
        exceedingCount++;
      } else {
        onTrackCount++;
      }
    });

    laggingKpis.sort((a, b) => a.tier - b.tier || a.percentage - b.percentage);
  }

  return { weeks: weekData, currentScore, oldestScore, trendDelta, avg5w, laggingKpis, onTrackCount, exceedingCount };
}
