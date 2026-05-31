/**
 * Standalone async functions for fetching scorecard + historical data.
 * These mirror the logic in useScorecardData and useHistoricalScores
 * but work imperatively (no React hooks) so they can be called from event handlers.
 *
 * Primary use: feeding buildPlaybookSummary() in handleAutoGenerate.
 *
 * Point-in-time scoring: when organizationId is set, these functions fetch
 * kpi_org_config_history to use the goals/weights/flags that were in effect
 * at the time of each historical week — not the current config.
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

// ── Shared: fetch org config history and build per-week config resolver ──────

interface OrgConfigHistoryResult {
  allMetrics: any[];
  getConfigAt: (kpiId: string, atDate: Date) => any;
  getActiveScorecardMetrics: (atDate: Date) => any[];
}

async function fetchOrgConfigWithHistory(
  organizationId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<OrgConfigHistoryResult> {
  // Fetch ALL org configs (no is_active filter) for the full KPI catalog
  const { data: orgConfigs } = await supabase
    .from('kpi_org_configs')
    .select('id, kpi_id, goal, weight, is_active, show_on_scorecard, scorecard_position, kpi_metrics!inner(id, key, name, direction)')
    .eq('organization_id', organizationId)
    .order('scorecard_position');

  const allMetrics = (orgConfigs || []).map((c: any) => ({
    orgConfigId: c.id,
    id: (c.kpi_metrics as any).id,
    key: (c.kpi_metrics as any).key,
    name: (c.kpi_metrics as any).name,
    direction: (c.kpi_metrics as any).direction,
    goal: c.goal,
    weight: c.weight,
    is_active: c.is_active,
    show_on_scorecard: c.show_on_scorecard,
    scorecard_position: c.scorecard_position,
  }));

  // Fetch point-in-time config history
  const { data: historyRows } = await supabase
    .from('kpi_org_config_history')
    .select('org_config_id, kpi_id, goal, weight, show_on_scorecard, is_active, valid_from, valid_to')
    .eq('organization_id', organizationId)
    .lte('valid_from', rangeEnd.toISOString())
    .or(`valid_to.is.null,valid_to.gte.${rangeStart.toISOString()}`);

  const history = historyRows || [];

  function getConfigAt(kpiId: string, atDate: Date) {
    // Find the history row active at atDate for this kpiId
    const histRow = history.find((h: any) =>
      h.kpi_id === kpiId &&
      new Date(h.valid_from) <= atDate &&
      (h.valid_to === null || new Date(h.valid_to) > atDate)
    );
    const baseMet = allMetrics.find((m: any) => m.id === kpiId);
    if (!baseMet) return null;
    if (histRow) {
      return {
        ...baseMet,
        goal: histRow.goal,
        weight: histRow.weight,
        is_active: histRow.is_active,
        show_on_scorecard: histRow.show_on_scorecard,
      };
    }
    return baseMet;
  }

  function getActiveScorecardMetrics(atDate: Date) {
    return allMetrics.filter((m: any) => {
      const cfg = getConfigAt(m.id, atDate);
      return cfg && cfg.is_active !== false && cfg.show_on_scorecard !== false;
    });
  }

  return { allMetrics, getConfigAt, getActiveScorecardMetrics };
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
  // 1. Fetch KPI metrics with point-in-time config
  const weekDate = new Date(weekEnd);
  let scorecardMetrics: any[] = [];
  let scorecardKpiKeys: string[] = [];

  if (organizationId) {
    const { getActiveScorecardMetrics } = await fetchOrgConfigWithHistory(
      organizationId,
      new Date(weekStart),
      weekDate
    );
    scorecardMetrics = getActiveScorecardMetrics(weekDate);
    scorecardKpiKeys = scorecardMetrics.map(m => m.key);
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction, show_on_scorecard')
      .eq('is_active', true)
      .order('scorecard_position');
    const metrics = data || [];
    scorecardMetrics = metrics.filter((m: any) => m.show_on_scorecard);
    scorecardKpiKeys = scorecardMetrics.map((m: any) => m.key);
  }
  if (!scorecardMetrics.length) return { rows: [], scorecardKpiKeys: [], teamAverage: 0, topPerformer: null };

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
  const metricById: Record<string, any> = {};
  scorecardMetrics.forEach(m => { metricById[m.id] = m; });

  // 5. Aggregate values per (profile, kpi)
  const valMap: Record<string, Record<string, number>> = {};
  (kpiValues || []).forEach((v: any) => {
    if (!valMap[v.profile_id]) valMap[v.profile_id] = {};
    const metric = metricById[v.kpi_id];
    if (!metric) return;
    const key = metric.key;
    valMap[v.profile_id][key] = (valMap[v.profile_id][key] || 0) + (v.value || 0);
  });

  // 6. Compute rows using point-in-time config
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
  // 1. Compute week boundaries first so we know the date range for history
  const now = new Date();
  const thisMonday = getMonday(now);
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const oldestMonday = new Date(anchorMonday.getTime() - (weeks - 1) * 7 * 86400000);
  const newestSunday = new Date(anchorMonday.getTime() + 6 * 86400000);

  // 2. Fetch scorecard metrics with point-in-time history
  let allMetrics: any[] = [];
  let getConfigAt: ((kpiId: string, atDate: Date) => any) | null = null;
  let getActiveScorecardMetrics: ((atDate: Date) => any[]) | null = null;

  if (organizationId) {
    const result = await fetchOrgConfigWithHistory(organizationId, oldestMonday, newestSunday);
    allMetrics = result.allMetrics;
    getConfigAt = result.getConfigAt;
    getActiveScorecardMetrics = result.getActiveScorecardMetrics;
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, goal, weight, direction')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    allMetrics = data || [];
  }
  if (!allMetrics.length) return { data: [], repNames: {} };

  const kpiIds = allMetrics.map(m => m.id);

  // 3. Fetch profiles — org-scoped
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

  // 4. Single batched query for all weeks
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

    // Determine which metrics were on the scorecard this week
    const weekMetrics = getActiveScorecardMetrics
      ? getActiveScorecardMetrics(wSunday)
      : allMetrics;

    // Aggregate per (profile, kpi)
    const repKpiSums: Record<string, Record<string, number>> = {};
    vals.forEach((v: any) => {
      if (!repKpiSums[v.profile_id]) repKpiSums[v.profile_id] = {};
      repKpiSums[v.profile_id][v.kpi_id] = (repKpiSums[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
    });

    // Compute per-rep scores using point-in-time config
    const point: HistoricalScorePoint = { week: weekLabel(wSunday), score: 0, hasData: true };
    let totalScore = 0;
    let repCount = 0;

    for (const pid of profileIds) {
      const sums = repKpiSums[pid];
      if (!sums) continue;
      let wSum = 0;
      let wWeight = 0;
      for (const m of weekMetrics) {
        const cfg = getConfigAt ? getConfigAt(m.id, wSunday) : m;
        if (!cfg) continue;
        const val = sums[m.id] || 0;
        const dir = cfg.direction || 'higher';
        const pct = calcPct(val, cfg.goal, dir);
        wSum += pct * (cfg.weight || 0);
        wWeight += cfg.weight || 0;
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
  // 1. Compute week boundaries first
  const now = new Date();
  const thisMonday = getMonday(now);
  const anchorMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const oldestMonday = new Date(anchorMonday.getTime() - (weeks - 1) * 7 * 86400000);
  const newestSunday = new Date(anchorMonday.getTime() + 6 * 86400000);

  // 2. Fetch scorecard metrics with point-in-time history
  let allMetrics: any[] = [];
  let getConfigAt: ((kpiId: string, atDate: Date) => any) | null = null;
  let getActiveScorecardMetrics: ((atDate: Date) => any[]) | null = null;

  if (organizationId) {
    const result = await fetchOrgConfigWithHistory(organizationId, oldestMonday, newestSunday);
    allMetrics = result.allMetrics;
    getConfigAt = result.getConfigAt;
    getActiveScorecardMetrics = result.getActiveScorecardMetrics;
  } else {
    const { data } = await supabase
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction, show_on_scorecard')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    allMetrics = data || [];
  }
  if (!allMetrics.length) return { weeks: [], currentScore: 0, oldestScore: 0, trendDelta: 0, avg5w: 0, laggingKpis: [], onTrackCount: 0, exceedingCount: 0 };

  const kpiIds = allMetrics.map(m => m.id);
  const metricById: Record<string, any> = {};
  allMetrics.forEach(m => { metricById[m.id] = m; });

  // 3. Single batched query for all weeks
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

    // Determine which metrics were on the scorecard this week
    const weekMetrics = getActiveScorecardMetrics
      ? getActiveScorecardMetrics(wSunday)
      : allMetrics;

    // Aggregate per KPI
    const kpiSums: Record<string, number> = {};
    const kpiSumsById: Record<string, number> = {};
    vals.forEach((v: any) => {
      const m = metricById[v.kpi_id];
      if (!m) return;
      kpiSums[m.key] = (kpiSums[m.key] || 0) + (v.value || 0);
      kpiSumsById[v.kpi_id] = (kpiSumsById[v.kpi_id] || 0) + (v.value || 0);
    });

    let weightedSum = 0;
    let totalWeight = 0;
    const kpis: Record<string, { value: number; percentage: number }> = {};

    weekMetrics.forEach(m => {
      const cfg = getConfigAt ? getConfigAt(m.id, wSunday) : m;
      if (!cfg) return;
      const value = kpiSumsById[m.id] || 0;
      const dir = cfg.direction || 'higher';
      const percentage = calcPct(value, cfg.goal, dir);
      kpis[m.key] = { value, percentage };
      weightedSum += percentage * (cfg.weight || 0);
      totalWeight += cfg.weight || 0;
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

  // 5. Per-KPI trend analysis using the most recent week's config
  const latestWeek = withData.length > 0 ? withData[withData.length - 1] : null;
  const latestMetrics = getActiveScorecardMetrics
    ? getActiveScorecardMetrics(newestSunday)
    : allMetrics;
  const laggingKpis: RepTrendResult['laggingKpis'] = [];
  let onTrackCount = 0;
  let exceedingCount = 0;

  if (latestWeek) {
    const tierForKey = (key: string): { tier: number; tierLabel: string } => {
      const m = latestMetrics.find(met => met.key === key);
      const cfg = getConfigAt && m ? getConfigAt(m.id, newestSunday) : m;
      const weight = cfg?.weight || 0;
      if (weight >= 15) return { tier: 1, tierLabel: 'Scorecard Priority' };
      if (key.startsWith('engage_')) return { tier: 3, tierLabel: 'Engage Adoption' };
      return { tier: 2, tierLabel: 'Core Skill' };
    };

    latestMetrics.forEach(m => {
      const cfg = getConfigAt ? getConfigAt(m.id, newestSunday) : m;
      const current = latestWeek.kpis[m.key]?.percentage || 0;

      // Compute 5-week average for this KPI
      const kpiWeeks = withData.map(w => w.kpis[m.key]?.percentage || 0);
      const kpiAvg5w = kpiWeeks.length > 0 ? Math.round(kpiWeeks.reduce((s, v) => s + v, 0) / kpiWeeks.length) : 0;

      // KPI trend
      const firstKpiPct = withData.length > 0 ? (withData[0].kpis[m.key]?.percentage || 0) : 0;
      const kpiTrendDelta = current - firstKpiPct;

      const { tier, tierLabel } = tierForKey(m.key);

      if (current < 80) {
        laggingKpis.push({ key: m.key, label: m.name || m.key, percentage: current, goal: cfg?.goal || m.goal, tier, tierLabel, avg5wPct: kpiAvg5w, trendDelta: kpiTrendDelta });
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
