/**
 * Standalone async functions for fetching scorecard + historical data.
 * These mirror the logic in useScorecardData and useHistoricalScores
 * but work imperatively (no React hooks) so they can be called from event handlers.
 *
 * Primary use: feeding buildPlaybookSummary() in handleAutoGenerate.
 */
import { supabase } from '../supabaseClient';

// Monday-aligned date helpers
function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

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
  weekEnd: string
): Promise<ScorecardResult> {
  // 1. Fetch active KPI metrics
  const { data: metrics } = await supabase
    .from('kpi_metrics')
    .select('id, key, name, goal, weight, direction, show_on_scorecard')
    .eq('is_active', true)
    .order('scorecard_position');
  if (!metrics?.length) return { rows: [], scorecardKpiKeys: [], teamAverage: 0, topPerformer: null };

  const scorecardMetrics = metrics.filter(m => m.show_on_scorecard);
  const scorecardKpiKeys = scorecardMetrics.map(m => m.key);

  // 2. Fetch profiles in this team (reps only)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, team_id, department, email')
    .eq('team_id', teamId)
    .not('role', 'in', '("admin","manager","coach")');
  if (!profiles?.length) return { rows: [], scorecardKpiKeys, teamAverage: 0, topPerformer: null };

  const profileIds = profiles.map(p => p.id);

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
  (kpiValues || []).forEach(v => {
    if (!valMap[v.profile_id]) valMap[v.profile_id] = {};
    const metric = metricById[v.kpi_id];
    if (!metric) return;
    const key = metric.key;
    valMap[v.profile_id][key] = (valMap[v.profile_id][key] || 0) + (v.value || 0);
  });

  // 6. Compute rows
  const rows: ScorecardRow[] = profiles.map(p => {
    const vals = valMap[p.id] || {};
    const kpis: Record<string, { value: number; percentage: number }> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    scorecardMetrics.forEach(m => {
      const value = vals[m.key] || 0;
      const dir = (m as any).direction || 'higher';
      const percentage = m.goal > 0
        ? Math.round(dir === 'lower' ? (value > 0 ? (m.goal / value) * 100 : 200) : (value / m.goal) * 100)
        : 0;
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
  weeks: number = 5
): Promise<{ data: HistoricalScorePoint[]; repNames: Record<string, string> }> {
  // 1. Fetch scorecard metrics
  const { data: metrics } = await supabase
    .from('kpi_metrics')
    .select('id, key, goal, weight, direction')
    .eq('is_active', true)
    .eq('show_on_scorecard', true);
  if (!metrics?.length) return { data: [], repNames: {} };

  const kpiIds = metrics.map(m => m.id);
  const metricById: Record<string, typeof metrics[0]> = {};
  metrics.forEach(m => { metricById[m.id] = m; });

  // 2. Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('team_id', teamId)
    .not('role', 'in', '("admin","manager","coach")');
  if (!profiles?.length) return { data: [], repNames: {} };

  const profileIds = profiles.map(p => p.id);
  const repNames: Record<string, string> = {};
  profiles.forEach(p => { repNames[p.id] = `${p.first_name} ${p.last_name}`; });

  // 3. Compute week boundaries (most recent complete weeks)
  const now = new Date();
  const thisMonday = getMonday(now);
  // Anchor = last completed week's Monday
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);

  const weekPoints: HistoricalScorePoint[] = [];

  // 4. Fetch data per week
  for (let w = weeks - 1; w >= 0; w--) {
    const wMonday = new Date(anchorMonday.getTime() - w * 7 * 86400000);
    const wSunday = new Date(wMonday.getTime() + 6 * 86400000);
    const wStart = fmt(wMonday);
    const wEnd = fmt(wSunday);

    const { data: vals } = await supabase
      .from('kpi_values')
      .select('value, kpi_id, profile_id')
      .in('kpi_id', kpiIds)
      .in('profile_id', profileIds)
      .lte('period_start', wEnd)
      .gte('period_end', wStart);

    if (!vals?.length) {
      weekPoints.push({ week: weekLabel(wSunday), score: 0, hasData: false });
      continue;
    }

    // Aggregate per (profile, kpi)
    const repKpiSums: Record<string, Record<string, number>> = {};
    vals.forEach(v => {
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
        const pct = m.goal > 0
          ? (dir === 'lower' ? (val > 0 ? (m.goal / val) * 100 : 200) : (val / m.goal) * 100)
          : 0;
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
  weeks: number = 5
): Promise<RepTrendResult> {
  // 1. Fetch scorecard metrics
  const { data: metrics } = await supabase
    .from('kpi_metrics')
    .select('id, key, name, goal, weight, direction, show_on_scorecard')
    .eq('is_active', true)
    .eq('show_on_scorecard', true);
  if (!metrics?.length) return { weeks: [], currentScore: 0, oldestScore: 0, trendDelta: 0, avg5w: 0, laggingKpis: [], onTrackCount: 0, exceedingCount: 0 };

  const kpiIds = metrics.map(m => m.id);
  const metricById: Record<string, typeof metrics[0]> = {};
  metrics.forEach(m => { metricById[m.id] = m; });

  // 2. Compute week boundaries
  const now = new Date();
  const thisMonday = getMonday(now);
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);

  const weekData: RepWeeklyTrend[] = [];

  // 3. Fetch each week
  for (let w = weeks - 1; w >= 0; w--) {
    const wMonday = new Date(anchorMonday.getTime() - w * 7 * 86400000);
    const wSunday = new Date(wMonday.getTime() + 6 * 86400000);
    const wStart = fmt(wMonday);
    const wEnd = fmt(wSunday);

    const { data: vals } = await supabase
      .from('kpi_values')
      .select('value, kpi_id')
      .eq('profile_id', profileId)
      .in('kpi_id', kpiIds)
      .lte('period_start', wEnd)
      .gte('period_end', wStart);

    if (!vals?.length) {
      weekData.push({ week: weekLabel(wSunday), weekStart: wStart, weekEnd: wEnd, score: 0, hasData: false, kpis: {} });
      continue;
    }

    // Aggregate per KPI
    const kpiSums: Record<string, number> = {};
    vals.forEach(v => {
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
      const percentage = m.goal > 0
        ? Math.round(dir === 'lower' ? (value > 0 ? (m.goal / value) * 100 : 200) : (value / m.goal) * 100)
        : 0;
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
      const kpiWeeks = withData.map(w => w.kpis[m.key]?.percentage || 0).filter(v => v > 0);
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
