import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import DashboardLayout from './DashboardLayout';
import ScorecardFilters from './components/ScorecardFilters';
import RightFilterPanel from './components/RightFilterPanel';
import PageActionBar from './components/PageActionBar';
import { useScorecardData } from './hooks/useScorecardData';
import { exportScorecardToCSV } from './utils/exportUtils';
import { getMonday, getMonthRange, getQuarterRange, formatPresetDateRange } from './utils/dateUtils';
import { calcPct } from './utils/kpiCalc';
import { ROLES } from './constants/roles';
import { exportScorecardToPDF } from './utils/exportPdf';
import ExportReportModal from './components/ExportReportModal';
import ScheduleReportModal from './components/ScheduleReportModal';
import ConfigureModal from './components/ConfigureModal';
import ConfigurePanel from './components/ConfigurePanel';
import { StatCardSkeleton, TableRowSkeleton } from './components/Skeleton';
import { ScoreDistributionChart, HistoricalScoresChart } from './components/Charts';
import { supabase } from './supabaseClient';
import { useNotifications } from './contexts/NotificationContext';
import { useToast } from './contexts/ToastContext';
import { useAuth } from './AuthContext';
import { useHistoricalScores } from './hooks/useHistoricalScores';
import Tooltip from './components/shared/Tooltip';
import InfoTooltip from './components/InfoTooltip';
import ShareScorecardSnapshotModal from './components/ShareScorecardSnapshotModal';
import { scoreTextColor, scoreBgColor, scoreHex, scoreRowBg } from './constants/scoreColors';

interface KPIMetric {
  id: number;
  key: string;
  name: string;
  description?: string;
  goal: number;
  weight: number;
  unit: string;
  category: string;
  direction?: string;
}

// KPIs that should show 1 decimal place; all others display as whole numbers
const DECIMAL_KPI_KEYS = new Set(['talk_time_minutes']);

const ApptiviaScorecard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const userId = (user && typeof user === 'object' && 'id' in user) ? (user as any).id : null;
  const profileTeamId = (profile as any)?.team_id;
  const userTeamId = (user as any)?.team_id;
  const teamId = profileTeamId ? String(profileTeamId) : userTeamId ? String(userTeamId) : null;
  const isAdmin = role === ROLES.ADMIN;
  const isManager = role === ROLES.MANAGER;
  const isCoach = role === ROLES.COACH;
  const isPowerUser = role === ROLES.POWER_USER;
  const canConfigureScorecard = (hasPermission as any)('configure_scorecard');
  const canExport = (hasPermission as any)('export_data');
  const canViewCoach = (hasPermission as any)('view_coach');
  const canViewAnalytics = (hasPermission as any)('view_analytics');
  const canViewContests = (hasPermission as any)('view_contests');

  const defaultFilters = useMemo(() => {
    if (isAdmin) {
      return {
        dateRange: 'Last Week',
        departments: [] as string[],
        teams: [] as string[],
        members: [] as string[],
      };
    }
    if (isManager || isCoach) {
      return {
        dateRange: 'Last Week',
        departments: [] as string[],
        teams: teamId ? [teamId] : [] as string[],
        members: [] as string[],
      };
    }
    if (isPowerUser) {
      return {
        dateRange: 'Last Week',
        departments: [] as string[],
        teams: [] as string[],
        members: userId ? [String(userId)] : [] as string[],
      };
    }
    return {
      dateRange: 'Last Week',
      departments: [] as string[],
      teams: [] as string[],
      members: [] as string[],
    };
  }, [isAdmin, isManager, isCoach, isPowerUser, teamId, userId]);

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([]);
  const [filtersResetSignal, setFiltersResetSignal] = useState(0);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [repDetailModal, setRepDetailModal] = useState<{ profileId: string; name: string } | null>(null);
  const [repTrendData, setRepTrendData] = useState<{ week: string; score: number }[]>([]);
  const [repTrendLoading, setRepTrendLoading] = useState(false);
  const [overlayRepIds, setOverlayRepIds] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string>('apptivityScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [focusedRowIdx, setFocusedRowIdx] = useState(-1);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const notifications = useNotifications() as any;
  const toast = useToast();
  const addNotificationRef = React.useRef(notifications.addNotification);
  React.useEffect(() => { addNotificationRef.current = notifications.addNotification; }, [notifications.addNotification]);

  // Initialize filters on first mount
  useEffect(() => {
    if (filtersInitialized) return;
    if (!userId) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, userId]);

  useEffect(() => {
    if (!filtersInitialized) return;
    if (!(isManager || isCoach)) return;
    if (!teamId) return;
    if (filters.teams.length > 0 && filters.teams.includes(teamId)) return;
    setFilters(prev => ({
      ...prev,
      teams: [teamId],
    }));
  }, [filtersInitialized, isManager, isCoach, teamId, filters.teams]);

  useEffect(() => {
    if (!userId) return;
    if (!isAdmin) return;
    setFilters({
      dateRange: 'Last Week',
      departments: [],
      teams: [],
      members: [],
    });
  }, [isAdmin, userId]);

  async function fetchKpiMetrics() {
    setLoadingKpis(true);
    try {
      let metrics: any[] = [];
      if (orgId) {
        const { data, error } = await supabase
          .from('kpi_org_configs')
          .select('kpi_id, goal, weight, show_on_scorecard, scorecard_position, kpi_metrics!inner(id, key, name, description, unit, category, direction)')
          .eq('organization_id', orgId)
          .eq('is_active', true)
          .eq('show_on_scorecard', true)
          .order('scorecard_position');
        if (error) throw error;
        metrics = (data || []).map((c: any) => ({
          id: (c.kpi_metrics as any).id, key: (c.kpi_metrics as any).key,
          name: (c.kpi_metrics as any).name, description: (c.kpi_metrics as any).description,
          goal: c.goal, weight: c.weight, unit: (c.kpi_metrics as any).unit,
          category: (c.kpi_metrics as any).category, direction: (c.kpi_metrics as any).direction,
        }));
      } else {
        const { data, error } = await supabase
          .from('kpi_metrics')
          .select('id, key, name, description, goal, weight, unit, category, direction')
          .eq('is_active', true)
          .eq('show_on_scorecard', true)
          .order('scorecard_position');
        if (error) throw error;
        metrics = data || [];
      }
      setKpiMetrics(metrics);
    } catch (err) {
      console.error('Error fetching KPI metrics:', err);
    } finally {
      setLoadingKpis(false);
    }
  }

  // Dynamically generate KPI keys and labels from database
  const kpiKeys = useMemo(() => kpiMetrics.map(k => k.key), [kpiMetrics]);
  const kpiLabels: {[key: string]: string} = useMemo(() => {
    return kpiMetrics.reduce((acc, k) => {
      acc[k.key] = k.name;
      return acc;
    }, {} as {[key: string]: string});
  }, [kpiMetrics]);
  const kpiUnits: {[key: string]: string} = useMemo(() => {
    return kpiMetrics.reduce((acc, k) => {
      acc[k.key] = k.unit || 'count';
      return acc;
    }, {} as {[key: string]: string});
  }, [kpiMetrics]);

  // Convert date range selection to actual dates.
  // filters.dateRange may be a plain label ("This Week") or an encoded Custom Week
  // string ("Custom Week|2026-02-16") emitted by ScorecardFilters.
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const label = filters.dateRange || 'This Week';

    // Custom Week|YYYY-MM-DD — Monday date encoded by ScorecardFilters
    if (label.startsWith('Custom Week|')) {
      const mondayStr = label.split('|')[1];
      if (mondayStr) {
        const monday = new Date(mondayStr + 'T00:00:00');
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
    }

    switch (label) {
      case 'Today': {
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      }
      case 'All Time': {
        const start = new Date(1970, 0, 1);
        return { start: start.toISOString(), end: new Date().toISOString() };
      }
      case 'This Week': {
        const monday = getMonday(today);
        const nextMonday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: nextMonday.toISOString() };
      }
      case 'Last Week': {
        const monday = getMonday(today);
        const lastMonday = new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: lastMonday.toISOString(), end: monday.toISOString() };
      }
      case 'This Month': {
        // H1 fix: use Monday-aligned ranges to avoid off-by-one on final day
        const range = getMonthRange(today.getFullYear(), today.getMonth());
        return { start: range.start.toISOString(), end: range.end.toISOString() };
      }
      case 'Last Month': {
        const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
        const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
        const range = getMonthRange(lastMonthYear, lastMonth);
        return { start: range.start.toISOString(), end: range.end.toISOString() };
      }
      case 'This Quarter': {
        const q = Math.floor(today.getMonth() / 3) + 1;  // 1-based quarter
        const range = getQuarterRange(today.getFullYear(), q);
        return { start: range.start.toISOString(), end: range.end.toISOString() };
      }
      case 'Last Quarter': {
        let q = Math.floor(today.getMonth() / 3);  // current quarter 0-based
        let yr = today.getFullYear();
        if (q === 0) { q = 4; yr -= 1; }  // Q0 current → Q4 previous year
        const range = getQuarterRange(yr, q);
        return { start: range.start.toISOString(), end: range.end.toISOString() };
      }
      default: {
        const monday = getMonday(today);
        const nextMonday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: nextMonday.toISOString() };
      }
    }
  }, [filters.dateRange]);

  // Weekly average mode: for periods longer than one week, divide totals by numWeeks
  // so the scorecard always shows a comparable per-week pace.
  const weeklyAverage = useMemo(() => {
    const label = filters.dateRange || 'This Week';
    return !['This Week', 'Last Week', 'Today'].includes(label) && !label.startsWith('Custom Week|') && label !== 'Custom Week';
  }, [filters.dateRange]);

  // numWeeks: how many weeks to divide totals by.
  // "This Month" uses elapsed weeks so mid-month pace is still meaningful.
  // "All Time" passes 0 as a sentinel — the hook fetches the actual min date.
  const scorecardNumWeeks = useMemo(() => {
    const label = filters.dateRange || 'This Week';
    const today = new Date();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    if (label === 'This Month') {
      // H1 fix: Monday-aligned range for consistent week count
      const range = getMonthRange(today.getFullYear(), today.getMonth());
      return Math.max(1 / 7, (today.getTime() - range.start.getTime()) / WEEK_MS);
    }
    if (label === 'Last Month') {
      const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
      const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const range = getMonthRange(lastMonthYear, lastMonth);
      return Math.max(1, (range.end.getTime() - range.start.getTime()) / WEEK_MS);
    }
    if (label === 'This Quarter') {
      const q = Math.floor(today.getMonth() / 3) + 1;
      const range = getQuarterRange(today.getFullYear(), q);
      return Math.max(1 / 7, (today.getTime() - range.start.getTime()) / WEEK_MS);
    }
    if (label === 'Last Quarter') {
      let q = Math.floor(today.getMonth() / 3);
      let yr = today.getFullYear();
      if (q === 0) { q = 4; yr -= 1; }
      const range = getQuarterRange(yr, q);
      return Math.max(1, (range.end.getTime() - range.start.getTime()) / WEEK_MS);
    }
    if (label === 'All Time') return 0; // hook computes from min(period_start)
    return 1;
  }, [filters.dateRange]);

  // Listen for post-onboarding refresh signal
  useEffect(() => {
    const handler = () => setRefreshTrigger(t => t + 1);
    window.addEventListener('apptivia:onboarding-complete', handler);
    return () => window.removeEventListener('apptivia:onboarding-complete', handler);
  }, []);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchKpiMetrics();
  }, [refreshTrigger, filters, dateRange]);

  const orgId = (profile as any)?.organization_id || null;

  const { data, loading, error } = useScorecardData(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    dateRange.start,
    dateRange.end,
    refreshTrigger,
    weeklyAverage,
    scorecardNumWeeks
  );

  const { data: historicalScores, repNames: historicalRepNames } = useHistoricalScores(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    dateRange,
    filters.dateRange,
    refreshTrigger
  );

  const applyScopedFilters = (nextFilters: typeof filters) => {
    if (isManager || isCoach) {
      return {
        ...nextFilters,
        teams: teamId ? [teamId] : [],
      };
    }
    return nextFilters;
  };

  const handleFiltersChange = (nextFilters: typeof filters) => {
    setFilters(applyScopedFilters(nextFilters));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFiltersResetSignal(prev => prev + 1);
  };

  const userRow = useMemo(() => {
    if (!userId) return null;
    return data?.rows?.find((row: any) => String(row.profile_id) === String(userId)) || null;
  }, [data?.rows, userId]);

  const userRank = useMemo(() => {
    if (!userRow || !data?.rows?.length) return null;
    const idx = data.rows.findIndex((row: any) => String(row.profile_id) === String(userId));
    return idx >= 0 ? idx + 1 : null;
  }, [data?.rows, userId, userRow]);

  // Team rank: rank among all reps in the team (independent of member filter)
  const [teamRank, setTeamRank] = useState<{ rank: number; total: number } | null>(null);
  useEffect(() => {
    if (!isPowerUser || !userId || !userRow) return;
    const fetchTeamRank = async () => {
      // Get all reps in the same team
      const profileTeamId = (profile as any)?.team_id;
      if (!profileTeamId) { setTeamRank(null); return; }
      let teamProfilesQ = supabase
        .from('profiles')
        .select('id')
        .eq('team_id', profileTeamId)
        .not('role', 'in', '("admin","manager","coach")');
      if (orgId) teamProfilesQ = teamProfilesQ.eq('organization_id', orgId);
      const { data: teamProfiles } = await teamProfilesQ;
      if (!teamProfiles?.length) { setTeamRank(null); return; }
      const teamIds = teamProfiles.map((p: any) => p.id);
      // Get their scores from kpi_values for the same date range
      const kpiIds = kpiMetrics.map(k => k.id);
      if (kpiIds.length === 0) { setTeamRank(null); return; }
      // M2 fix: fetch historical goals so team rank uses the same goals as the scorecard
      const [kpiValuesRes, historyRes] = await Promise.all([
        supabase.from('kpi_values')
          .select('value, kpi_id, profile_id')
          .in('kpi_id', kpiIds)
          .in('profile_id', teamIds)
          .lte('period_start', dateRange.end)
          .gte('period_end', dateRange.start),
        supabase.from('kpi_metric_history')
          .select('kpi_id, goal, weight, direction, valid_from, valid_to')
          .in('kpi_id', kpiIds)
          .lte('valid_from', dateRange.end)
          .or(`valid_to.is.null,valid_to.gte.${dateRange.start}`),
      ]);
      const kpiValues = kpiValuesRes.data;
      const histRows = historyRes.data || [];
      if (!kpiValues?.length) { setTeamRank(null); return; }
      // Build historical goal/weight/direction lookup (M2 fix)
      const histMap: Record<string, { goal: number; weight: number; direction: string }> = {};
      for (const h of histRows) {
        histMap[h.kpi_id] = { goal: h.goal, weight: h.weight, direction: h.direction || 'higher' };
      }
      const histGoal = (m: any) => histMap[m.id]?.goal ?? m.goal;
      const histWeight = (m: any) => histMap[m.id]?.weight ?? m.weight;
      const histDir = (m: any) => histMap[m.id]?.direction ?? m.direction ?? 'higher';
      // Compute weighted score per rep using historical goals + calcPct (M1 residual fix: 200% cap)
      const totalWeight = kpiMetrics.reduce((s: number, m) => s + (histWeight(m) || 0), 0);
      const repScores: Record<string, number> = {};
      teamIds.forEach((id: string) => { repScores[id] = 0; });
      const metricById = new Map(kpiMetrics.map(m => [m.id, m]));
      kpiValues.forEach((kv: any) => {
        const metric = metricById.get(kv.kpi_id);
        if (!metric || !histGoal(metric)) return;
        const pct = calcPct(kv.value, histGoal(metric), histDir(metric));
        repScores[kv.profile_id] = (repScores[kv.profile_id] || 0) + pct * (histWeight(metric) || 0);
      });
      const ranked = Object.entries(repScores)
        .map(([id, total]) => ({ id, score: totalWeight > 0 ? Math.round(total / totalWeight) : 0 }))
        .sort((a, b) => b.score - a.score);
      const myIdx = ranked.findIndex(r => String(r.id) === String(userId));
      setTeamRank(myIdx >= 0 ? { rank: myIdx + 1, total: ranked.length } : null);
    };
    fetchTeamRank();
  }, [isPowerUser, userId, userRow, (profile as any)?.team_id, kpiMetrics, dateRange.start, dateRange.end]);

  const userKpiBreakdown = useMemo(() => {
    if (!userRow?.kpis) return { exceeding: 0, onTrack: 0, needsFocus: 0, total: 0 };
    const entries = Object.values(userRow.kpis) as any[];
    let exceeding = 0;
    let onTrack = 0;
    let needsFocus = 0;
    entries.forEach((kpi) => {
      const pct = Number(kpi?.percentage || 0);
      if (pct >= 100) exceeding += 1;
      else if (pct >= 80) onTrack += 1;
      else needsFocus += 1;
    });
    return { exceeding, onTrack, needsFocus, total: entries.length };
  }, [userRow]);

  const teamScoreStats = useMemo(() => {
    if (!data?.rows?.length) return { max: 0, min: 0, spread: 0 };
    const max = Number(data.rows[0]?.apptivityScore || 0);
    const min = Number(data.rows[data.rows.length - 1]?.apptivityScore || 0);
    return { max, min, spread: Math.max(0, max - min) };
  }, [data?.rows]);

  const kpiCategoryDetails = useMemo(() => {
    const result = { exceeding: [] as string[], onTrack: [] as string[], needsFocus: [] as string[] };
    if (!userRow?.kpis) return result;
    kpiMetrics.forEach((metric) => {
      const kpi = (userRow.kpis as any)?.[metric.key];
      if (!kpi) return;
      const pct = Number(kpi?.percentage || 0);
      const label = kpiLabels[metric.key] || metric.name || metric.key;
      if (pct >= 100) result.exceeding.push(label);
      else if (pct >= 80) result.onTrack.push(label);
      else result.needsFocus.push(label);
    });
    return result;
  }, [userRow, kpiMetrics, kpiLabels]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showScheduleReportModal, setShowScheduleReportModal] = useState(false);

  const handleExportFormat = (format: string) => {
    if (!canExport || loading || error) return;
    if (format === 'csv') {
      exportScorecardToCSV(data, filters, kpiUnits);
    } else if (format === 'pdf') {
      exportScorecardToPDF(data, filters);
    }
  };

  const handleConfigSave = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (loading || error || !userId || data.rows.length === 0) return;

    const userRow = data.rows.find(r => String(r.profile_id) === String(userId));
    if (!userRow) return;

    if (userRow.apptivityScore >= 100) {
      addNotificationRef.current({
        type: 'performance',
        title: 'Scorecard milestone',
        message: `You hit ${userRow.apptivityScore}% on your scorecard.`,
        link: '/dashboard',
        dedupeKey: `scorecard-high-${userId}-${filters.dateRange}`,
      });
    }

    // Skip "Opportunity to improve" for current (incomplete) week to avoid misleading 0% alerts
    const dateLabel = filters.dateRange || '';
    const isCurrentWeek = dateLabel === 'This Week' || dateLabel === 'Today';
    if (userRow.apptivityScore < 80 && !isCurrentWeek) {
      addNotificationRef.current({
        type: 'coaching',
        title: 'Opportunity to improve',
        message: `Your scorecard was ${userRow.apptivityScore}% for ${dateLabel}. Review coaching insights.`,
        link: '/coach',
        dedupeKey: `scorecard-low-${userId}-${filters.dateRange}`,
      });
    }

    // Only fire "Top performer" when at least 3 reps are in the view
    const topRow = data.rows[0];
    if (topRow && String(topRow.profile_id) === String(userId) && data.rows.length >= 3) {
      addNotificationRef.current({
        type: 'performance',
        title: 'Top performer',
        message: `You are the top performer this period out of ${data.rows.length} reps. Keep it up!`,
        link: '/dashboard',
        dedupeKey: `scorecard-top-${userId}-${filters.dateRange}`,
      });
    }
  }, [loading, error, data.rows, userId, filters.dateRange]);

  useEffect(() => {
    if (loading || error || data.rows.length === 0) return;
    if (!(isManager || isCoach)) return;
    if (data.needCoaching > 0) {
      addNotificationRef.current({
        type: 'coaching',
        title: 'Team coaching needed',
        message: `${data.needCoaching} rep${data.needCoaching === 1 ? '' : 's'} need coaching attention.`,
        link: '/coach',
        dedupeKey: `team-coaching-${data.needCoaching}-${filters.dateRange}`,
        audience: 'team',
      });
    }
  }, [loading, error, data.needCoaching, data.rows.length, isManager, isCoach, filters.dateRange]);

  // Milestone notifications: personal best, 3-week streak, team average crossing target
  useEffect(() => {
    if (loading || error || !userId || data.rows.length === 0) return;
    const userRow = data.rows.find(r => String(r.profile_id) === String(userId));
    if (!userRow) return;

    // Check for 3+ consecutive weeks at 100%+ using historical data
    if (historicalScores && historicalScores.length >= 3) {
      const last3 = historicalScores.slice(-3);
      const allAbove100 = last3.every((pt: any) => pt.score >= 100);
      if (allAbove100) {
        addNotificationRef.current({
          type: 'streak',
          title: 'Scorecard streak!',
          message: 'You have maintained 100%+ for 3 consecutive weeks!',
          link: '/dashboard',
          dedupeKey: `scorecard-streak-3wk-${userId}`,
        });
      }
    }

    // Team average crossing above target (for managers)
    if ((isManager || isCoach) && data.teamAverage >= 100) {
      addNotificationRef.current({
        type: 'performance',
        title: 'Team target reached',
        message: `Team average is ${data.teamAverage}% — above target!`,
        link: '/dashboard',
        dedupeKey: `team-above-target-${filters.dateRange}`,
        audience: 'team',
      });
    }
  }, [loading, error, data.rows, data.teamAverage, userId, historicalScores, isManager, isCoach, filters.dateRange]);

  // Fetch 5-week trend for a single rep when the detail modal opens
  useEffect(() => {
    if (!repDetailModal) { setRepTrendData([]); return; }
    let cancelled = false;
    const fetchRepTrend = async () => {
      setRepTrendLoading(true);
      try {
        // Org-scoped scorecard KPIs
        let scorecardKpis: any[] = [];
        if (orgId) {
          const { data } = await supabase
            .from('kpi_org_configs')
            .select('kpi_id, goal, weight, kpi_metrics!inner(id, direction)')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .eq('show_on_scorecard', true);
          scorecardKpis = (data || []).map((c: any) => ({
            id: (c.kpi_metrics as any).id, weight: c.weight, goal: c.goal,
            direction: (c.kpi_metrics as any).direction,
          }));
        } else {
          const { data } = await supabase
            .from('kpi_metrics')
            .select('id, weight, goal, direction')
            .eq('is_active', true)
            .eq('show_on_scorecard', true);
          scorecardKpis = data || [];
        }
        if (scorecardKpis.length === 0) { setRepTrendData([]); return; }
        const kpiIds = scorecardKpis.map((k: any) => k.id);

        // Anchor to the same week the scorecard is viewing
        const endAdj = new Date(new Date(dateRange.end).getTime() - 1);
        const now = new Date();
        const effectiveEnd = endAdj > now ? now : endAdj;
        const anchorMon = (() => {
          const d = new Date(effectiveEnd);
          d.setHours(0,0,0,0);
          const day = d.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          d.setDate(d.getDate() + diff);
          // Exclude current incomplete week — always show 5 previously completed weeks
          const cm = new Date(); cm.setHours(0,0,0,0);
          const cd = cm.getDay(); cm.setDate(cm.getDate() + (cd === 0 ? -6 : 1 - cd));
          if (d.getTime() >= cm.getTime()) d.setDate(d.getDate() - 7);
          return d;
        })();

        // Fetch all 5 weeks in parallel
        const weekBounds = Array.from({ length: 5 }, (_, idx) => {
          const i = 4 - idx;
          const wStart = new Date(anchorMon.getTime() - i * 7 * 86400000);
          const wEnd = new Date(wStart.getTime() + 6 * 86400000);
          return { wStart, wEnd, wStartStr: wStart.toISOString().split('T')[0], wEndStr: wEnd.toISOString().split('T')[0] };
        });

        const weekResults = await Promise.all(
          weekBounds.map(({ wStartStr, wEndStr }) =>
            supabase
              .from('kpi_values')
              .select('value, kpi_id')
              .eq('profile_id', repDetailModal.profileId)
              .in('kpi_id', kpiIds)
              .lte('period_start', wEndStr)
              .gte('period_end', wStartStr)
          )
        );

        const points: { week: string; score: number }[] = weekBounds.map(({ wEnd }, idx) => {
          const vals = weekResults[idx].data || [];
          const sums: Record<string, number> = {};
          vals.forEach((v: any) => { sums[v.kpi_id] = (sums[v.kpi_id] || 0) + (v.value || 0); });

          let totalWeight = 0;
          let repTotal = 0;
          scorecardKpis.forEach((k: any) => {
            totalWeight += (k.weight || 0);
            const val = sums[k.id] || 0;
            const dir = k.direction || 'higher';
            const pct = k.goal > 0
              ? (dir === 'lower' ? (val > 0 ? (k.goal / val) * 100 : 200) : (val / k.goal) * 100)
              : 0;
            repTotal += pct * (k.weight || 0);
          });
          const score = totalWeight > 0 ? Math.round(repTotal / totalWeight) : 0;
          return { week: `${wEnd.getMonth() + 1}/${wEnd.getDate()}`, score };
        });
        if (!cancelled) setRepTrendData(points);
      } catch (err) {
        console.error('Error fetching rep trend:', err);
        if (!cancelled) setRepTrendData([]);
      } finally {
        if (!cancelled) setRepTrendLoading(false);
      }
    };
    fetchRepTrend();
    return () => { cancelled = true; };
  }, [repDetailModal, dateRange.end]);

  const filterSummary = (() => {
    const deptLabel = filters.departments.length > 0
      ? `${filters.departments.length} Dept${filters.departments.length > 1 ? 's' : ''}`
      : 'All Depts';
    const teamLabel = filters.teams.length > 0
      ? `${filters.teams.length} Team${filters.teams.length > 1 ? 's' : ''}`
      : 'All Teams';
    const memberLabel = filters.members.length > 0
      ? `${filters.members.length} Member${filters.members.length > 1 ? 's' : ''}`
      : 'All Members';

    const dateLabel = formatPresetDateRange(filters.dateRange || 'This Week') || (filters.dateRange || 'This Week');

    return `Filters: ${dateLabel} • ${deptLabel} • ${teamLabel} • ${memberLabel}`;
  })();

  const canShareSnapshot = isAdmin || isManager;

  // Count active (non-default) filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.departments.length > 0) count++;
    if (filters.members.length > 0) count++;
    // For teams, only count if non-default (managers default to their team)
    const defaultTeams = (isManager || isCoach) && teamId ? [teamId] : [];
    const teamsChanged = JSON.stringify(filters.teams.sort()) !== JSON.stringify(defaultTeams.sort());
    if (filters.teams.length > 0 && teamsChanged) count++;
    const defaultDate = isAdmin ? 'All Time' : 'This Week';
    const currentDate = filters.dateRange?.startsWith('Custom Week|') ? 'Custom Week' : filters.dateRange;
    if (currentDate !== defaultDate) count++;
    return count;
  }, [filters, isAdmin, isManager, isCoach, teamId]);

  // Trend lookup: profile_id → { delta, direction, goalPacing }
  const trendMap = useMemo(() => {
    return Object.fromEntries((data.trendData || []).map(t => [t.profile_id, t]));
  }, [data.trendData]);

  // Pacing only shows for live/current periods
  const showPacing = useMemo(() => {
    const label = filters.dateRange || '';
    return ['This Week', 'This Month', 'This Quarter'].includes(label);
  }, [filters.dateRange]);

  const handleSortColumn = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(col);
      setSortDirection('desc');
    }
  };

  const tableSortedRows = useMemo(() => {
    const rows = [...(data.rows || [])];
    const dir = sortDirection === 'desc' ? -1 : 1;
    return rows.sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortColumn === 'apptivityScore') {
        aVal = a.apptivityScore || 0;
        bVal = b.apptivityScore || 0;
      } else if (sortColumn === 'name') {
        return dir * a.name.localeCompare(b.name);
      } else {
        // KPI column — sort by percentage
        aVal = a.kpis[sortColumn]?.percentage || 0;
        bVal = b.kpis[sortColumn]?.percentage || 0;
      }
      return dir * (aVal - bVal);
    });
  }, [data.rows, sortColumn, sortDirection]);

  // sortedRows is always by score desc — used for topPerformers/snapshot
  const sortedRows = useMemo(() => {
    return [...(data.rows || [])].sort((a, b) => (b.apptivityScore || 0) - (a.apptivityScore || 0));
  }, [data.rows]);
  const topPerformers = useMemo(() => sortedRows.slice(0, 3), [sortedRows]);
  const lowestPerformers = useMemo(() => sortedRows.slice(-3).reverse(), [sortedRows]);

  const snapshotHighlights = useMemo(() => {
    if (!data || !data.rows || data.rows.length === 0) return [] as string[];
    const topName = topPerformers[0]?.name || 'N/A';
    const topScore = topPerformers[0]?.apptivityScore ?? 'N/A';
    const improvedName = data.mostImproved?.name || 'N/A';
    const improvedDelta = data.mostImproved ? `+${data.mostImproved.delta}` : 'N/A';
    return [
      `Team average: ${data.teamAverage ?? 'N/A'}%`,
      `Top performer: ${topName} (${topScore}%)`,
      `Most improved: ${improvedName} (${improvedDelta} pts)`,
      `Above target: ${data.aboveTarget ?? 0} reps`,
      `Need coaching: ${data.needCoaching ?? 0} reps`,
      `Score spread: ${teamScoreStats.spread ?? 0}% (high ${teamScoreStats.max ?? 0}% / low ${teamScoreStats.min ?? 0}%)`,
    ];
  }, [data, topPerformers, teamScoreStats]);

  const buildSnapshotBody = () => {
    const lines: string[] = [];
    lines.push('Apptivia Weekly Scorecard Snapshot');
    lines.push(filterSummary);
    lines.push('');
    lines.push('Highlights:');
    snapshotHighlights.forEach((h) => lines.push(`• ${h}`));
    lines.push('');
    if (topPerformers.length > 0) {
      lines.push('Top performers:');
      topPerformers.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.name} — ${r.apptivityScore || 0}%`);
      });
      lines.push('');
    }
    if (lowestPerformers.length > 0) {
      lines.push('Needs improvement:');
      lowestPerformers.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.name} — ${r.apptivityScore || 0}%`);
      });
      lines.push('');
    }
    lines.push('Generated from Apptivia Scorecard.');
    return lines.join('\n');
  };

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);
    const results: any[] = [];

    try {
      const searchTerm = query.trim().toLowerCase();

      // Search all categories in parallel — org-scoped
      let profilesSearchQ = supabase.from('profiles').select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`).limit(5);
      if (orgId) profilesSearchQ = profilesSearchQ.eq('organization_id', orgId);
      let contestsSearchQ = supabase.from('active_contests').select('id, name, description')
        .ilike('name', `%${searchTerm}%`).limit(5);
      if (orgId) contestsSearchQ = contestsSearchQ.eq('organization_id', orgId);
      let achievementsSearchQ = supabase.from('achievements').select('id, name, description')
        .ilike('name', `%${searchTerm}%`).limit(5);
      // Achievements and badge_definitions are global structural definitions (migration 157)
      let badgesSearchQ = supabase.from('badge_definitions').select('id, badge_name, badge_description')
        .ilike('badge_name', `%${searchTerm}%`).limit(5);
      const [profilesRes, achievementsRes, badgesRes, contestsRes] = await Promise.all([
        profilesSearchQ,
        achievementsSearchQ,
        badgesSearchQ,
        contestsSearchQ,
      ]);

      (profilesRes.data || []).forEach((profile: any) => {
        results.push({
          type: 'User',
          title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
          subtitle: profile.role, link: `/profile?user=${profile.id}`, icon: '👤'
        });
      });
      (achievementsRes.data || []).forEach((achievement: any) => {
        results.push({
          type: 'Achievement', title: achievement.name,
          subtitle: achievement.description, link: '/coach', icon: '🏆'
        });
      });
      (badgesRes.data || []).forEach((badge: any) => {
        results.push({
          type: 'Badge', title: badge.badge_name,
          subtitle: badge.badge_description, link: '/profile', icon: '🎖️'
        });
      });
      (contestsRes.data || []).forEach((contest: any) => {
        results.push({
          type: 'Contest', title: contest.name,
          subtitle: contest.description, link: '/contests', icon: '🎯'
        });
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleRefreshAchievements = async () => {
    setIsRefreshing(true);
    try {
      // Call the database function to check and award achievements
      const { data, error } = await supabase.rpc('check_and_award_achievements');
      
      if (error) {
        console.error('Error checking achievements:', error);
        toast.error('Failed to refresh achievements');
      } else {
        const awardsCount = data || 0;
        if (awardsCount > 0) {
          toast.success(`${awardsCount} new achievement${awardsCount > 1 ? 's' : ''} awarded!`);
        } else {
          toast.info('No new achievements earned yet. Keep pushing!');
        }
        // Trigger data refresh
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error refreshing achievements:', err);
      toast.error('Failed to refresh achievements');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Apptivia Scorecard</h1>
            <div className="flex items-center gap-3">
              <p className="text-apptivia-carbon-500 text-sm">
                {isPowerUser ? 'Your personalized productivity scorecard and progress' : 'Real-time productivity scoring for your sales team'}
              </p>
              {(isManager || isAdmin) && (
                <span className="text-[10px] text-apptivia-carbon-400 bg-apptivia-paper border border-apptivia-carbon-200 rounded-full px-2 py-0.5">
                  Scoring alerts: Mon 8am
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                >
                  <X size={14} />
                </button>
              )}
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-apptivia-paper border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-apptivia-ink">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-carbon-600">{result.type}</span>
                          </div>
                          {result.subtitle && (
                            <div className="text-[11px] text-apptivia-carbon-500 mt-0.5 truncate">{result.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            {/* Refresh Icon */}
            <button
              onClick={handleRefreshAchievements}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-apptivia-carbon-700 border border-apptivia-carbon-200 hover:bg-apptivia-paper group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
              title="Refresh dashboard data and check for new achievements"
            >
              <svg 
                className={`w-[18px] h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-apptivia-ink text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => { if (canConfigureScorecard) setConfigPanelOpen(true); }}
              onExportClick={() => setShowExportModal(true)}
              onNotificationsClick={notifications.openPanel}
              configureDisabled={!canConfigureScorecard}
              notificationBadge={notifications.unreadCount}
              filterBadge={activeFilterCount}
              actions={[
                {
                  label: 'Export Report',
                  onClick: () => setShowExportModal(true),
                  disabled: loading || !canExport,
                },
                {
                  label: 'Schedule Report',
                  onClick: () => setShowScheduleReportModal(true),
                  disabled: !canExport,
                },
                ...(canShareSnapshot ? [{
                  label: 'Share Snapshot',
                  onClick: () => setSnapshotOpen(true),
                }] : []),
              ]}
            />
          </div>
        </div>
        {(loading || loadingKpis) && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="h-6 w-64 bg-apptivia-carbon-200 rounded animate-pulse mb-4" />
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left table-fixed">
                  <thead>
                    <tr className="bg-apptivia-paper">
                      <th className="px-2 py-1 font-semibold w-40">Rep Name</th>
                      {kpiKeys.map(key => (
                        <th key={key} className="px-2 py-1 font-semibold text-center w-24">{kpiLabels[key]}</th>
                      ))}
                      <th className="px-2 py-1 font-semibold text-center w-24">Apptivia Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRowSkeleton key={i} columns={7} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {error && <div className="text-red-500 text-center py-8">Error: {error}</div>}
        
        {!loading && !error && !loadingKpis && kpiKeys.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <p className="text-yellow-800 text-lg font-semibold mb-2">No Scorecard KPIs Selected</p>
            <p className="text-yellow-600 mb-4">Please select 5 KPI metrics to display on your scorecard.</p>
            <button 
              onClick={() => {
                if (canConfigureScorecard) setShowConfigModal(true);
              }}
              disabled={!canConfigureScorecard}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${canConfigureScorecard ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-apptivia-carbon-200 text-apptivia-carbon-500 cursor-not-allowed'}`}
            >
              Select Scorecard KPIs
            </button>
          </div>
        )}

        {!loading && !error && !loadingKpis && kpiKeys.length > 0 && kpiKeys.length < 5 && (
          <div className="bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-apptivia-coral text-xl">ℹ️</span>
            <div>
              <p className="text-apptivia-coral-tone-700 font-semibold">Scorecard Incomplete</p>
              <p className="text-apptivia-coral text-sm">
                You have selected {kpiKeys.length} of 5 recommended KPIs.{' '}
                <button
                  onClick={() => {
                    if (canConfigureScorecard) setShowConfigModal(true);
                  }}
                  className={`underline font-medium ${canConfigureScorecard ? 'text-apptivia-coral' : 'text-apptivia-carbon-400 cursor-not-allowed'}`}
                  disabled={!canConfigureScorecard}
                >
                  Configure scorecard
                </button>{' '}
                to select all 5.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && !loadingKpis && kpiKeys.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {isPowerUser ? (
                <>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex items-center gap-3 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    {/* Progress Ring */}
                    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
                      <circle cx="26" cy="26" r="22" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                      <circle
                        cx="26" cy="26" r="22"
                        fill="none"
                        stroke={scoreHex(userRow?.apptivityScore ?? 0)}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, userRow?.apptivityScore ?? 0) * 1.382} 138.2`}
                        transform="rotate(-90 26 26)"
                      />
                      <text x="26" y="28" textAnchor="middle" className="text-[11px] font-bold fill-gray-900">
                        {userRow?.apptivityScore ?? 0}%
                      </text>
                    </svg>
                    <div className="flex flex-col">
                      <div className="text-xs text-apptivia-carbon-500">My Score</div>
                      <div className={`font-bold text-sm ${scoreTextColor(userRow?.apptivityScore ?? 0)}`}>
                        {showPacing && trendMap[userId] ? `~${trendMap[userId].goalPacing}% pace` : 'Target: 100%'}
                      </div>
                      <div className="text-apptivia-carbon-400 text-[10px]">
                        {(userRow?.apptivityScore ?? 0) >= 100 ? 'On target' : `${100 - (userRow?.apptivityScore ?? 0)} pts to goal`}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-apptivia-carbon-500 mb-1">My Rank</div>
                    <div className="text-green-600 font-bold text-base">{teamRank ? `#${teamRank.rank}` : 'N/A'}</div>
                    <div className="text-apptivia-carbon-400 text-xs">{teamRank ? `of ${teamRank.total} on your team` : 'Within your team'}</div>
                  </div>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-apptivia-carbon-500 mb-1">KPI On Track</div>
                    <div className="text-apptivia-coral font-bold text-base">{userKpiBreakdown.onTrack + userKpiBreakdown.exceeding}</div>
                    <div className="text-apptivia-carbon-400 text-xs">of {userKpiBreakdown.total} KPIs</div>
                  </div>
                  <div
                    className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                    onClick={() => {
                      document.getElementById('coaching-opportunities')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <div className="text-xs text-apptivia-carbon-500 mb-1">Needs Focus</div>
                    <div className="text-orange-600 font-bold text-base">{userKpiBreakdown.needsFocus}</div>
                    <div className="text-apptivia-carbon-400 text-xs">Coaching opportunities</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    {filters.dateRange === 'All Time' ? (
                      <>
                        <div className="text-xs text-apptivia-carbon-500 mb-1">Top Performer</div>
                        <div className="font-bold text-base text-green-600">
                          {sortedRows[0]?.name || 'N/A'}
                        </div>
                        <div className="text-apptivia-carbon-400 text-xs">
                          {sortedRows[0] ? `${sortedRows[0].apptivityScore}% score` : 'No data'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-apptivia-carbon-500 mb-1">
                          {data.mostImproved && data.mostImproved.delta > 0 ? 'Most Improved' : 'Least Declined'}
                        </div>
                        <div className={`font-bold text-base ${data.mostImproved && data.mostImproved.delta > 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {data.mostImproved?.name || 'N/A'}
                        </div>
                        <div className="text-apptivia-carbon-400 text-xs">
                          {data.mostImproved
                            ? `${data.mostImproved.delta > 0 ? '+' : ''}${data.mostImproved.delta} pts`
                            : 'No trend data'}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-apptivia-carbon-500 mb-1">Active Reps</div>
                    <div className="text-apptivia-coral font-bold text-base">{data.rows.length}</div>
                    <div className="text-apptivia-carbon-400 text-xs">In selected filters</div>
                  </div>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-apptivia-carbon-500 mb-1">Score Spread</div>
                    <div className="text-apptivia-ink font-bold text-base">{teamScoreStats.spread}%</div>
                    <div className="text-apptivia-carbon-400 text-xs">Highest vs lowest</div>
                  </div>
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-apptivia-carbon-500 mb-1">Team Score</div>
                    <div className={`font-bold text-base ${scoreTextColor(data.teamAverage)}`}>
                      {data.teamAverage}%
                    </div>
                    <div className="text-apptivia-carbon-400 text-xs">Avg across all reps</div>
                  </div>
                </>
              )}
            </div>


            {/* Admin Cross-Team Comparison */}
            {isAdmin && data.rows.length > 0 && (() => {
              const teamScores: Record<string, { name: string; scores: number[] }> = {};
              data.rows.forEach((row: any) => {
                const tName = row.team_name || 'Unassigned';
                const tId = row.team_id || 'none';
                if (!teamScores[tId]) teamScores[tId] = { name: tName, scores: [] };
                teamScores[tId].scores.push(row.apptivityScore || 0);
              });
              const ranked = Object.values(teamScores)
                .map(t => ({ name: t.name, avg: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length), count: t.scores.length }))
                .sort((a, b) => b.avg - a.avg);
              if (ranked.length <= 1) return null;
              return (
                <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-apptivia-ink">Team Comparison</h3>
                    <InfoTooltip text="Average Apptivia Score per team for the current filters." />
                  </div>
                  <div className="space-y-1.5">
                    {ranked.map((team, idx) => {
                      const color = scoreTextColor(team.avg);
                      const barBg = scoreBgColor(team.avg);
                      const trendIcon = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `${idx + 1}th`;
                      return (
                        <div key={team.name} className="flex items-center gap-3 text-xs">
                          <span className="w-6 text-right font-bold text-apptivia-carbon-400 shrink-0">{trendIcon}</span>
                          <span className="font-medium text-apptivia-ink w-36 truncate shrink-0">{team.name}</span>
                          <span className="text-apptivia-carbon-400 shrink-0">{team.count} reps</span>
                          <div className="flex-1 bg-apptivia-carbon-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${barBg}`} style={{ width: `${Math.min(100, team.avg)}%` }} />
                          </div>
                          <span className={`font-bold ${color} w-10 text-right shrink-0`}>{team.avg}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Charts Section — both cards locked to same height */}
            <div className={`grid gap-4 mb-4 ${isPowerUser ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 lg:grid-rows-[300px]'}`}>
              {!isPowerUser && (
                <div className="bg-white rounded-lg p-3 shadow-sm flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-apptivia-ink">Team KPI Health</h3>
                    <InfoTooltip text="Heatmap showing each rep's attainment per KPI. Green = 90%+ (on track), yellow = 80–89%, orange = 60–79% (needs attention), red = below 60%." />
                  </div>
                  {/* Color legend */}
                  <div className="flex items-center gap-3 mb-1 text-[9px] text-apptivia-carbon-500">
                    <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-green-500" /> 90%+</div>
                    <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-yellow-400" /> 80–89%</div>
                    <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-orange-400" /> 60–79%</div>
                    <div className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded bg-red-500" /> &lt;60%</div>
                  </div>
                  <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-2 py-1.5 text-apptivia-carbon-500 font-medium bg-white w-24">Rep</th>
                          {kpiKeys.map(key => (
                            <th key={key} className="text-center px-1.5 py-1.5 text-apptivia-carbon-500 font-medium bg-white text-[10px] leading-tight" title={kpiLabels[key]}>
                              {kpiLabels[key] || key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableSortedRows.map(row => (
                          <tr key={row.profile_id}>
                            <td className="px-2 py-1 font-medium text-apptivia-carbon-700 whitespace-nowrap w-24 truncate" title={row.name}>
                              {row.name.split(' ')[0]}
                            </td>
                            {kpiKeys.map(key => {
                              const pct = Math.round(row.kpis[key]?.percentage || 0);
                              const bg = scoreBgColor(pct);
                              return (
                                <td key={key} className="px-1 py-1 text-center" title={`${kpiLabels[key]}: ${pct}% attainment`}>
                                  <div className={`${bg} text-white rounded-md px-3 py-1.5 text-xs font-bold`}>
                                    {pct}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <HistoricalScoresChart
                  title="Apptivia Score Trends"
                  infoText={isPowerUser ? "Your Apptivia Score trend over the last 5 weeks." : "Weekly trend of the average Apptivia score for the selected filters and date range. Click a rep name in the table to overlay their trend."}
                  data={historicalScores}
                  overlayRepIds={overlayRepIds}
                  repNames={historicalRepNames}
                  lineName={isPowerUser ? 'My Score' : 'Team Avg'}
                />
                {overlayRepIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOverlayRepIds([])}
                    className="mt-1 text-[10px] text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                  >
                    Clear overlays
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm mb-4 ring-1 ring-apptivia-coral-tone-100/80 shadow-blue-100/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{isPowerUser ? 'My Scorecard Snapshot' : 'Team Performance Scorecard'}</h2>
                  <InfoTooltip text="Detailed KPI values and scorecard percentages for the current selection." />
                </div>
                {!isPowerUser && (
                  <div className="flex items-center gap-2">
                    {canViewAnalytics && (
                      <button
                        onClick={() => navigate('/analytics', { state: { filters: { dateRange: filters.dateRange, departments: filters.departments, teams: filters.teams, members: filters.members } } })}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50"
                      >
                        View Analytics
                      </button>
                    )}
                    {canViewContests && (
                      <button
                        onClick={() => navigate('/contests')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100"
                      >
                        Team Contests
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-xs text-apptivia-carbon-500">
                  {isPowerUser ? 'Your performance metrics with optional benchmarking' : 'Detailed performance metrics and Apptivia Scores'}
                </div>
                <div className="text-[11px] text-apptivia-carbon-500 text-right whitespace-nowrap">{filterSummary}</div>
              </div>
              <div
                ref={tableRef}
                className=""
                tabIndex={0}
                onKeyDown={(e) => {
                  const rows = tableSortedRows;
                  if (!rows.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedRowIdx(prev => Math.min(prev + 1, rows.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedRowIdx(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter' && focusedRowIdx >= 0 && focusedRowIdx < rows.length) {
                    e.preventDefault();
                    const row = rows[focusedRowIdx];
                    setRepDetailModal({ profileId: row.profile_id, name: row.name });
                  } else if (e.key === 'Escape') {
                    setFocusedRowIdx(-1);
                    if (repDetailModal) setRepDetailModal(null);
                  }
                }}
              >
                {data.rows.length === 0 ? (
                  <div className="text-center py-8 text-apptivia-carbon-500">No data available for selected filters</div>
                ) : (
                  <table className="w-full text-xs text-left table-fixed">
                    <thead>
                      <tr className="bg-apptivia-paper">
                        <th className="px-2 py-1 font-semibold cursor-pointer select-none hover:bg-apptivia-carbon-100" onClick={() => handleSortColumn('name')}>
                          {isPowerUser ? 'Your Performance' : 'Rep Name'} {sortColumn === 'name' && (sortDirection === 'desc' ? '▼' : '▲')}
                        </th>
                        {kpiKeys.map(key => (
                          <th
                            key={key}
                            className="px-2 py-1 font-semibold text-center cursor-pointer select-none hover:bg-apptivia-carbon-100"
                            onClick={() => handleSortColumn(key)}
                          >
                            {kpiLabels[key]} {sortColumn === key && (sortDirection === 'desc' ? '▼' : '▲')}
                            {weeklyAverage && <><br /><span className="font-normal text-apptivia-carbon-400">avg/wk</span></>}
                          </th>
                        ))}
                        <th
                          className="px-2 py-1 font-semibold text-center cursor-pointer select-none hover:bg-apptivia-carbon-100"
                          onClick={() => handleSortColumn('apptivityScore')}
                        >
                          <Tooltip text="Weighted composite of all KPI attainment percentages. 100% = meeting all goals." position="bottom" wide>
                            <span className="cursor-help">Apptivia Score</span>
                          </Tooltip> {sortColumn === 'apptivityScore' && (sortDirection === 'desc' ? '▼' : '▲')}
                        </th>
                      </tr>
                      <tr className="bg-apptivia-paper border-b border-apptivia-carbon-200">
                        <td className="px-2 py-0.5 text-[10px] text-apptivia-carbon-400 font-medium">Goal | Weight</td>
                        {kpiKeys.map(key => {
                          const metric = kpiMetrics.find(m => m.key === key);
                          const hist = data.histGoalMap?.[key];
                          const goal = metric?.goal ?? hist?.goal ?? 0;
                          const weight = metric?.weight ?? hist?.weight ?? 0;
                          return (
                            <td key={key} className="px-2 py-0.5 text-center text-[10px] text-apptivia-carbon-400 font-medium">
                              {goal} | {Math.round(weight * 100)}%
                            </td>
                          );
                        })}
                        <td></td>
                      </tr>
                    </thead>
                    <tbody>
                      {tableSortedRows.map((row, idx) => {
                        const medal = sortColumn === 'apptivityScore' && sortDirection === 'desc'
                          ? (idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '')
                          : '';
                        const isFocused = focusedRowIdx === idx;
                        const rowClass = isFocused ? 'bg-apptivia-coral-tone-50 ring-1 ring-apptivia-coral-tone-300' : scoreRowBg(row.apptivityScore);
                        const scoreColor = scoreTextColor(row.apptivityScore);
                        return (
                          <tr key={row.profile_id} className={`${rowClass} transition-all duration-200 hover:bg-apptivia-paper hover:shadow-sm`}>
                            <td className="px-2 py-1 font-medium align-top">
                              <div className="flex items-center gap-1">
                                {medal && <span className="text-yellow-500">{medal}</span>}
                                <button
                                  type="button"
                                  onClick={() => setRepDetailModal({ profileId: row.profile_id, name: row.name })}
                                  className="text-left hover:text-apptivia-coral hover:underline truncate"
                                >
                                  {row.name}
                                </button>
                                {!isPowerUser && (
                                  <Tooltip text={overlayRepIds.includes(row.profile_id) ? 'Remove from chart' : 'Show on chart'} position="left">
                                    <button
                                      type="button"
                                      onClick={() => setOverlayRepIds(prev =>
                                        prev.includes(row.profile_id)
                                          ? prev.filter(id => id !== row.profile_id)
                                          : [...prev, row.profile_id]
                                      )}
                                      className={`ml-auto text-[10px] leading-none ${overlayRepIds.includes(row.profile_id) ? 'text-apptivia-coral' : 'text-apptivia-carbon-300 hover:text-apptivia-carbon-500'}`}
                                    >
                                      {'📈'}
                                    </button>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                            {kpiKeys.map(key => {
                              const kpi = row.kpis[key] || { value: 0, percentage: 0 };
                              const pct = Math.round(kpi.percentage);
                              const color = scoreTextColor(pct);
                              return (
                                <td key={key} className="px-2 py-1 text-center align-top">
                                  <span className={`font-semibold ${color}`}>{pct}%</span>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-center align-top">
                              <Tooltip text={`Apptivia Score: ${row.apptivityScore}% — Weighted composite of all KPI attainment${trendMap[row.profile_id] ? `. ${trendMap[row.profile_id].direction === 'up' ? 'Up' : trendMap[row.profile_id].direction === 'down' ? 'Down' : 'Flat'} ${Math.abs(trendMap[row.profile_id].delta)} pts vs last week` : ''}`} wide>
                              <div className="flex flex-col items-center cursor-help">
                                <div className="flex items-center gap-1">
                                  <span className={`font-bold ${scoreColor}`}>{row.apptivityScore}%</span>
                                  {trendMap[row.profile_id] && (
                                    trendMap[row.profile_id].direction === 'flat' ? (
                                      <span className="text-[10px] text-apptivia-carbon-400">—</span>
                                    ) : (
                                      <span className={`text-[10px] font-semibold ${trendMap[row.profile_id].direction === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {trendMap[row.profile_id].direction === 'up' ? '▲' : '▼'}{Math.abs(trendMap[row.profile_id].delta)}
                                      </span>
                                    )
                                  )}
                                </div>
                                {showPacing && trendMap[row.profile_id] && (
                                  <span className="text-[9px] text-apptivia-carbon-400">~{trendMap[row.profile_id].goalPacing}% pace</span>
                                )}
                              </div>
                              </Tooltip>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {tableSortedRows.length >= 2 && !isPowerUser && (() => {
                      const teamAvgScore = Math.round(tableSortedRows.reduce((s, r) => s + (r.apptivityScore || 0), 0) / tableSortedRows.length);
                      const teamAvgScoreColor = scoreTextColor(teamAvgScore);
                      // Compute team average trend from individual trends
                      const trendEntries = tableSortedRows.map(r => trendMap[r.profile_id]).filter(Boolean);
                      const avgDelta = trendEntries.length > 0 ? Math.round(trendEntries.reduce((s, t) => s + (t.delta || 0), 0) / trendEntries.length) : 0;
                      const avgDirection = avgDelta > 0 ? 'up' : avgDelta < 0 ? 'down' : 'flat';
                      return (
                        <tfoot>
                          <tr className="bg-apptivia-coral-tone-50 border-t-2 border-apptivia-coral-tone-100">
                            <td className="px-2 py-2 font-bold text-apptivia-ink">Team Average</td>
                            {kpiKeys.map(key => {
                              const avgPct = Math.round(tableSortedRows.reduce((sum, r) => sum + (r.kpis[key]?.percentage || 0), 0) / tableSortedRows.length);
                              const color = scoreTextColor(avgPct);
                              return (
                                <td key={key} className="px-2 py-2 text-center font-semibold">
                                  <span className={color}>{avgPct}%</span>
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center">
                                <div className="flex items-center gap-1">
                                  <span className={`font-bold ${teamAvgScoreColor}`}>{teamAvgScore}%</span>
                                  {avgDirection === 'flat' ? (
                                    <span className="text-[10px] text-apptivia-carbon-400">—</span>
                                  ) : (
                                    <span className={`text-[10px] font-semibold ${avgDirection === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {avgDirection === 'up' ? '▲' : '▼'}{Math.abs(avgDelta)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                )}
              </div>
            </div>


          </>
        )}
      </div>
      <ConfigurePanel
        isOpen={configPanelOpen}
        onClose={() => setConfigPanelOpen(false)}
        onOpenAdvanced={() => setShowConfigModal(true)}
        onSave={handleConfigSave}
      />
      <ConfigureModal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)}
        onSave={handleConfigSave}
      />
      <RightFilterPanel
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Scorecard Filters"
        subtitle="Narrow your results"
        showReset
        onReset={handleResetFilters}
      >
        {/* Quick Scope Presets */}
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-apptivia-carbon-100">
          {(isAdmin || isManager || isCoach) && (
            <button
              type="button"
              onClick={() => {
                const next = applyScopedFilters({
                  dateRange: 'This Week',
                  departments: [],
                  teams: teamId ? [teamId] : [],
                  members: [],
                });
                setFilters(next);
                setFiltersResetSignal(prev => prev + 1);
              }}
              className="px-3 py-1 text-xs rounded-full bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 font-medium transition-colors"
            >
              My Team
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFilters({ dateRange: 'This Week', departments: [], teams: [], members: [] });
                setFiltersResetSignal(prev => prev + 1);
              }}
              className="px-3 py-1 text-xs rounded-full bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 font-medium transition-colors"
            >
              All Teams
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const topIds = sortedRows.filter(r => r.apptivityScore >= 90).map(r => r.profile_id);
              const next = applyScopedFilters({ ...filters, members: topIds.length > 0 ? topIds : [] });
              setFilters(next);
              setFiltersResetSignal(prev => prev + 1);
            }}
            className="px-3 py-1 text-xs rounded-full bg-green-50 text-green-700 hover:bg-green-100 font-medium transition-colors"
          >
            Top Performers
          </button>
          <button
            type="button"
            onClick={() => {
              const coachIds = sortedRows.filter(r => r.apptivityScore < 80).map(r => r.profile_id);
              const next = applyScopedFilters({ ...filters, members: coachIds.length > 0 ? coachIds : [] });
              setFilters(next);
              setFiltersResetSignal(prev => prev + 1);
            }}
            className="px-3 py-1 text-xs rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium transition-colors"
          >
            Needs Coaching
          </button>
        </div>
        <ScorecardFilters
          organizationId={(profile as any)?.organization_id}
          onFilterChange={handleFiltersChange}
          initialFilters={defaultFilters}
          resetSignal={filtersResetSignal}
          restrictToTeams={(isManager || isCoach) && teamId ? [teamId] : undefined}
          restrictToMembers={isPowerUser && userId ? [String(userId)] : undefined}
        />
      </RightFilterPanel>
      <ShareScorecardSnapshotModal
        isOpen={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        scorecardData={{
          teamAverage: Math.round(data.teamAverage || 0),
          totalMembers: data.rows?.length || 0,
          dateRange: filters.dateRange || 'This Week',
          topPerformers: data.rows?.slice(0, 5).map(d => ({
            name: d.name,
            score: d.apptivityScore,
            percentage: `${d.apptivityScore}%`
          })) || [],
          needsImprovement: data.rows?.filter(d => d.apptivityScore < 80).slice(-5).reverse().map(d => ({
            name: d.name,
            score: d.apptivityScore,
            percentage: `${d.apptivityScore}%`
          })) || [],
          scoreDistribution: {
            excellent: data.rows?.filter(d => d.apptivityScore >= 90).length || 0,
            good: data.rows?.filter(d => d.apptivityScore >= 70 && d.apptivityScore < 90).length || 0,
            fair: data.rows?.filter(d => d.apptivityScore >= 50 && d.apptivityScore < 70).length || 0,
            poor: data.rows?.filter(d => d.apptivityScore < 50).length || 0,
          }
        }}
        filters={filters}
        historicalScores={historicalScores}
        kpiMetrics={kpiMetrics}
        periodStart={dateRange.start}
        periodEnd={dateRange.end}
        scorecardRows={data.rows}
      />
      {/* Rep Detail Modal — 5-week trend */}
      {repDetailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setRepDetailModal(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-apptivia-ink">{repDetailModal.name} — 5-Week Trend</h3>
              <button type="button" onClick={() => setRepDetailModal(null)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600" title="Close">
                <X size={18} />
              </button>
            </div>
            {repTrendLoading ? (
              <div className="flex items-center justify-center h-48 text-sm text-apptivia-carbon-500">Loading trend data...</div>
            ) : repTrendData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-apptivia-carbon-500">No trend data available</div>
            ) : (
              <div>
                <HistoricalScoresChart
                  title=""
                  infoText="Individual rep's Apptivia Score over the last 5 weeks."
                  data={repTrendData}
                  lineName={repDetailModal.name}
                />
                <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                  {repTrendData.map((pt, i) => (
                    <div key={i}>
                      <div className="text-apptivia-carbon-400">{pt.week}</div>
                      <div className={`font-bold ${scoreTextColor(pt.score)}`}>{pt.score}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={handleExportFormat}
        title="Export Scorecard Report"
      />
      <ScheduleReportModal
        isOpen={showScheduleReportModal}
        onClose={() => setShowScheduleReportModal(false)}
        onSuccess={() => {
          if (notifications.addNotification) notifications.addNotification({ type: 'success', title: 'Report Scheduled', message: 'Your report has been scheduled. Manage it in Settings → Reports.', dedupeKey: 'report-scheduled' });
        }}
      />
    </DashboardLayout>
  );
};

export default ApptiviaScorecard;

