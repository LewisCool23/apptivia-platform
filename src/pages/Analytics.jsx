import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Radar, Shield } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import ScorecardFilters from '../components/ScorecardFilters';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import { useScorecardData } from '../hooks/useScorecardData';
import { exportAnalyticsToCSV } from '../utils/exportUtils';
import { exportAnalyticsToPDF } from '../utils/exportPdf';
import ExportReportModal from '../components/ExportReportModal';
import ConfigureModal from '../components/ConfigureModal';
import ConfigurePanel from '../components/ConfigurePanel';import ScheduleReportModal from '../components/ScheduleReportModal';import { ScoreDistributionChart, TeamPerformanceChart, HistoricalScoresChart } from '../components/Charts';
import { useHistoricalScores } from '../hooks/useHistoricalScores';
import { useNotifications } from '../contexts/NotificationContext';
import { ROLES } from '../constants/roles';
import { useAuth } from '../AuthContext';
import InfoTooltip from '../components/InfoTooltip';
import { scoreTextColor, scoreBgColor } from '../constants/scoreColors';
import { formatPresetDateRange } from '../utils/dateUtils';
import { supabase } from '../supabaseClient';
import KpiWatchdog from '../components/KpiWatchdog';
import SalesFunnel from '../components/SalesFunnel';
import OrgHealthScorecard from '../components/OrgHealthScorecard';
import UpgradePrompt from '../components/UpgradePrompt';
import { prettifyKpiKey } from '../constants/kpiGuidance';
import { backendFetch } from '../utils/backendFetch';
import { useBilling } from '../hooks/useBilling';
import AnalyticsRecords from '../components/AnalyticsRecords';

const FUNNEL_KEYS = ['call_connects', 'meetings', 'sourced_opps', 'stage2_opps', 'stage3_opps', 'closed_won'];

export default function Analytics() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, role, hasPermission } = useAuth();
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const isManager = role === ROLES.MANAGER;
  const isCoach = role === ROLES.COACH;
  const isAdmin = role === ROLES.ADMIN;
  const isPowerUser = role === ROLES.POWER_USER;
  const canExport = hasPermission('export_data');
  const canConfigure = hasPermission('configure_scorecard');
  const { plan: billingPlan } = useBilling();
  const isPro = billingPlan === 'Pro' || billingPlan === 'Enterprise';
  const isEnterprise = billingPlan === 'Enterprise';

  // [FEATURE 4] Benchmarks state
  const [benchmarks, setBenchmarks] = useState([]);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [benchmarksError, setBenchmarksError] = useState(null);

  const userId = profile?.id || user?.id;
  const defaultFilters = useMemo(() => {
    if (isAdmin) {
      return {
        dateRange: 'Last Week',
        departments: [],
        teams: [],
        members: [],
      };
    }
    if (isManager || isCoach) {
      return {
        dateRange: 'Last Week',
        departments: [],
        teams: teamId ? [teamId] : [],
        members: [],
      };
    }
    if (isPowerUser) {
      return {
        dateRange: 'Last Week',
        departments: [],
        teams: [],
        members: userId ? [userId] : [],
      };
    }
    return {
      dateRange: 'Last Week',
      departments: [],
      teams: [],
      members: [],
    };
  }, [isAdmin, isManager, isCoach, isPowerUser, teamId, userId]);

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [filtersResetSignal, setFiltersResetSignal] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'overview';
  });
  const [showScheduleReportModal, setShowScheduleReportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [engageStats, setEngageStats] = useState(null);
  const [engageLoading, setEngageLoading] = useState(false);
  const [allKpiMetrics, setAllKpiMetrics] = useState([]);
  const [funnelKpiValues, setFunnelKpiValues] = useState({});
  const [funnelBenchmarks, setFunnelBenchmarks] = useState({});
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [cohortData, setCohortData] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(false);

  // Sync active tab to URL search params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentTab = params.get('tab');
    if (currentTab !== activeTab) {
      params.set('tab', activeTab);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Accept filter state from scorecard navigation
  useEffect(() => {
    const incoming = location.state?.filters;
    if (incoming) {
      setFilters(prev => ({
        ...prev,
        dateRange: incoming.dateRange || prev.dateRange,
        departments: incoming.departments || prev.departments,
        teams: incoming.teams || prev.teams,
        members: incoming.members || prev.members,
      }));
      setFiltersInitialized(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (filtersInitialized) return;
    if (!user?.id) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    const orgId = profile?.organization_id || user?.organization_id;
    let mounted = true;
    async function loadTeams() {
      try {
        let query = supabase.from('teams').select('id, name').order('name');
        if (orgId) query = query.eq('organization_id', orgId);
        else return;
        const { data: teamsData, error: teamsError } = await query;
        if (!teamsError && mounted) setTeams(teamsData || []);
      } catch (e) {}
    }
    loadTeams();
    return () => { mounted = false; };
  }, [isAdmin, profile?.organization_id, user?.organization_id]);

  // Fetch ALL active KPI metrics — org-specific when available, fallback to global
  useEffect(() => {
    const analyticsOrgId = profile?.organization_id || user?.organization_id;
    async function loadAllKpis() {
      try {
        let metrics = [];
        if (analyticsOrgId) {
          const { data } = await supabase
            .from('kpi_org_configs')
            .select('kpi_id, goal, weight, is_active, show_on_scorecard, kpi_metrics!inner(id, key, name, description, unit, category, direction, scorecard_position)')
            .eq('organization_id', analyticsOrgId)
            .eq('is_active', true);
          metrics = (data || []).map(c => ({
            id: c.kpi_metrics.id, key: c.kpi_metrics.key, name: c.kpi_metrics.name,
            description: c.kpi_metrics.description, unit: c.kpi_metrics.unit,
            category: c.kpi_metrics.category, direction: c.kpi_metrics.direction,
            goal: c.goal, weight: c.weight, show_on_scorecard: c.show_on_scorecard ?? true,
          }));
        }
        // Fallback to global kpi_metrics
        if (metrics.length === 0) {
          const { data, error } = await supabase
            .from('kpi_metrics')
            .select('id, key, name, description, goal, weight, unit, category, show_on_scorecard, direction')
            .eq('is_active', true)
            .order('scorecard_position');
          if (error) throw error;
          metrics = data || [];
        }
        setAllKpiMetrics(metrics);
      } catch (e) {
        console.error('Error fetching all KPI metrics:', e);
      }
    }
    loadAllKpis();
  }, [profile?.organization_id, user?.organization_id]);

  // Fetch global kpi_benchmarks once on mount
  useEffect(() => {
    async function loadBenchmarks() {
      try {
        const { data: rows, error } = await supabase
          .from('kpi_benchmarks')
          .select('kpi_key, benchmark_type, value')
          .is('org_id', null);
        if (error) throw error;
        const map = {};
        (rows || []).forEach(r => {
          if (!map[r.kpi_key]) map[r.kpi_key] = {};
          map[r.kpi_key][r.benchmark_type] = r.value;
        });
        setFunnelBenchmarks(map);
      } catch (e) {
        console.error('Error fetching benchmarks:', e);
      }
    }
    loadBenchmarks();
  }, []);

  // Cache refs to prevent refetching tab data on tab switches
  const engageCacheRef = useRef(null);
  const funnelCacheRef = useRef(false);

  // Fetch Engage analytics when Engage tab is active
  useEffect(() => {
    if (activeTab !== 'engage') return;
    if (engageCacheRef.current) return; // Already cached
    let mounted = true;
    async function loadEngageStats() {
      setEngageLoading(true);
      try {
        const orgId = profile?.organization_id || user?.organization_id;
        if (!orgId) { setEngageStats(null); setEngageLoading(false); return; }

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [acctRes, signalRes, actionRes, draftRes, draftEventsRes] = await Promise.all([
          supabase.from('engage_accounts').select('id, account_score, tier, status', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('engage_intent_signals').select('id, status, signal_type, detected_at', { count: 'exact' }).eq('organization_id', orgId).gte('detected_at', thirtyDaysAgo),
          supabase.from('engage_signal_actions').select('id, status, channel, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
          supabase.from('engage_outreach_drafts').select('id, status, channel, created_at').eq('organization_id', orgId).gte('created_at', thirtyDaysAgo),
          // Fallback: count outreach draft events from activity log (covers drafts logged via Activity Feed)
          supabase.from('engage_activity_events').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).ilike('event_type', '%outreach%draft%').gte('created_at', thirtyDaysAgo),
        ]);

        const accounts = acctRes.data || [];
        const signals = signalRes.data || [];
        const actions = actionRes.data || [];
        const drafts = draftRes.data || [];
        const draftEventCount = draftEventsRes.count || 0;

        const tier1 = accounts.filter(a => a.tier === 'tier_1').length;
        const tier2 = accounts.filter(a => a.tier === 'tier_2').length;
        const tier3 = accounts.filter(a => a.tier === 'tier_3').length;
        const avgAccountScore = accounts.length > 0
          ? Math.round(accounts.reduce((sum, a) => sum + (a.account_score || 0), 0) / accounts.length)
          : 0;

        const accountTiers = [
          { name: 'Tier 1', score: tier1 },
          { name: 'Tier 2', score: tier2 },
          { name: 'Tier 3', score: tier3 },
          { name: 'Untiered', score: accounts.filter(a => a.tier === 'untiered').length },
        ].filter(d => d.score > 0);

        // Signal activity
        const signalsActioned = signals.filter(s => s.status === 'actioned').length;
        const signalActionRate = signals.length > 0 ? Math.round((signalsActioned / signals.length) * 100) : 0;

        // Signal type breakdown
        const signalTypeCounts = {};
        signals.forEach(s => { signalTypeCounts[s.signal_type] = (signalTypeCounts[s.signal_type] || 0) + 1; });
        const signalTypeBreakdown = Object.entries(signalTypeCounts)
          .map(([name, score]) => ({ name: prettifyKpiKey(name), score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);

        // Action queue throughput
        const actionsSent = actions.filter(a => a.status === 'sent').length;
        const actionsApproved = actions.filter(a => a.status === 'approved').length;
        const actionsDismissed = actions.filter(a => a.status === 'dismissed').length;
        const actionsPending = actions.filter(a => a.status === 'pending').length;

        // Outreach by channel
        const channelCounts = {};
        [...actions, ...drafts].forEach(d => {
          const ch = d.channel || 'email';
          channelCounts[ch] = (channelCounts[ch] || 0) + 1;
        });
        const outreachByChannel = Object.entries(channelCounts)
          .map(([name, score]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), score }))
          .sort((a, b) => b.score - a.score);

        if (mounted) {
          const stats = {
            totalAccounts: accounts.length,
            tier1, tier2, tier3,
            avgAccountScore,
            accountTiers,
            // Signal activity
            totalSignals: signals.length,
            signalsActioned,
            signalActionRate,
            signalTypeBreakdown,
            // Action queue
            actionsSent, actionsApproved, actionsDismissed, actionsPending,
            totalActions: actions.length,
            // Outreach — use higher of dedicated table vs activity events
            totalDrafts: Math.max(drafts.length, draftEventCount),
            outreachByChannel,
          };
          setEngageStats(stats);
          engageCacheRef.current = stats;
        }
      } catch (err) {
        console.error('Error loading Engage stats:', err);
        if (mounted) setEngageStats(null);
      } finally {
        if (mounted) setEngageLoading(false);
      }
    }
    loadEngageStats();
    return () => { mounted = false; };
  }, [activeTab, profile?.organization_id, user?.organization_id]);

  // Fetch coaching cohort data when overview tab is active (managers+)
  useEffect(() => {
    if (activeTab !== 'overview' || isPowerUser) return;
    let mounted = true;
    async function loadCohorts() {
      setCohortLoading(true);
      try {
        const data = await backendFetch('/api/analytics/coaching-cohorts?weeks=4');
        if (mounted) setCohortData(data);
      } catch { /* non-critical */ }
      finally { if (mounted) setCohortLoading(false); }
    }
    loadCohorts();
    return () => { mounted = false; };
  }, [activeTab, isPowerUser]);

  // Enterprise full benchmark data
  const [enterpriseBenchmarkData, setEnterpriseBenchmarkData] = useState(null);

  // [FEATURE 4] Fetch benchmarks when Benchmarks tab is active (tier-aware)
  useEffect(() => {
    if (activeTab !== 'benchmarks' || !isPro) return;
    let mounted = true;
    async function loadBenchmarks() {
      setBenchmarksLoading(true);
      setBenchmarksError(null);
      try {
        if (isEnterprise) {
          const data = await backendFetch('/api/analytics/cross-org-benchmarks', undefined, 'GET');
          if (mounted) {
            setEnterpriseBenchmarkData(data);
            if (data.insufficient_data && !data.using_industry_baseline) {
              setBenchmarksError(data.message || 'Not enough peer data yet');
            }
          }
        } else {
          const data = await backendFetch('/api/analytics/benchmarks-summary', undefined, 'GET');
          if (mounted) {
            if (data.insufficient_data) {
              setBenchmarks([]);
              setBenchmarksError(data.message || 'Not enough peer data yet');
            } else {
              setBenchmarks(data.benchmarks || []);
            }
          }
        }
      } catch (err) {
        if (mounted) setBenchmarksError(err.message || 'Failed to load benchmarks');
      } finally {
        if (mounted) setBenchmarksLoading(false);
      }
    }
    loadBenchmarks();
    return () => { mounted = false; };
  }, [activeTab, isPro, isEnterprise]);

  const [customWeekDate, setCustomWeekDate] = useState('');

  // Convert date range to actual dates
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const label = filters.dateRange || 'This Week';

    // Custom Week — user picked a specific week via the inline date picker
    // ScorecardFilters encodes as "Custom Week|YYYY-MM-DD"
    if (label.startsWith('Custom Week|')) {
      const mondayStr = label.split('|')[1];
      const monday = new Date(mondayStr + 'T00:00:00');
      const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { start: monday.toISOString(), end: sunday.toISOString() };
    }
    if (label === 'Custom Week') {
      if (customWeekDate) {
        const d = new Date(customWeekDate + 'T00:00:00');
        const day = d.getDay();
        const monday = new Date(d.getTime() - (day === 0 ? 6 : day - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
      // fall through to This Week until a date is chosen
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
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
      case 'Last Week': {
        const dayOfWeek = today.getDay();
        const lastMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 13 : dayOfWeek + 6) * 24 * 60 * 60 * 1000);
        const lastSunday = new Date(lastMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: lastMonday.toISOString(), end: lastSunday.toISOString() };
      }
      case 'This Month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: firstDay.toISOString(), end: lastDay.toISOString() };
      }
      case 'Last Month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: firstDay.toISOString(), end: lastDay.toISOString() };
      }
      case 'This Quarter': {
        const q = Math.floor(today.getMonth() / 3);
        const firstDay = new Date(today.getFullYear(), q * 3, 1);
        const lastDay = new Date(today.getFullYear(), q * 3 + 3, 0);
        return { start: firstDay.toISOString(), end: lastDay.toISOString() };
      }
      case 'Last Quarter': {
        const q = Math.floor(today.getMonth() / 3);
        const prevQ = q === 0 ? 3 : q - 1;
        const yr = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
        const firstDay = new Date(yr, prevQ * 3, 1);
        const lastDay = new Date(yr, prevQ * 3 + 3, 0);
        return { start: firstDay.toISOString(), end: lastDay.toISOString() };
      }
      default: {
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
    }
  }, [filters.dateRange, customWeekDate]);

  // Weekly average mode for multi-week periods
  const weeklyAverage = useMemo(() => {
    const label = filters.dateRange || 'This Week';
    return !['This Week', 'Last Week', 'Today', 'Custom Week'].includes(label) && !label.startsWith('Custom Week|');
  }, [filters.dateRange]);

  const analyticsNumWeeks = useMemo(() => {
    const label = filters.dateRange || 'This Week';
    const today = new Date();
    if (label === 'This Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return Math.max(1 / 7, (today.getTime() - firstDay.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    if (label === 'Last Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return Math.max(1, (lastDay.getTime() - firstDay.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    if (label === 'This Quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const firstDay = new Date(today.getFullYear(), q * 3, 1);
      return Math.max(1 / 7, (today.getTime() - firstDay.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    if (label === 'Last Quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const yr = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
      const firstDay = new Date(yr, prevQ * 3, 1);
      const lastDay = new Date(yr, prevQ * 3 + 3, 0);
      return Math.max(1, (lastDay.getTime() - firstDay.getTime()) / (7 * 24 * 60 * 60 * 1000));
    }
    if (label === 'All Time') return 0; // hook computes from min(period_start)
    return 1;
  }, [filters.dateRange]);

  const orgId = profile?.organization_id || user?.organization_id || null;

  const { data, loading, error } = useScorecardData(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    dateRange.start,
    dateRange.end,
    refreshTrigger,
    weeklyAverage,
    analyticsNumWeeks
  );

  // Historical trend data for the overview chart
  const { data: historicalData, repNames: historicalRepNames, loading: historicalLoading } = useHistoricalScores(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    dateRange,
    filters.dateRange || 'This Week',
    0
  );

  const handleFiltersChange = (nextFilters) => {
    if (isPowerUser) {
      setFilters({
        ...nextFilters,
        members: userId ? [userId] : [],
        teams: [],
        departments: [],
      });
      return;
    }
    if (isManager || isCoach) {
      setFilters({
        ...nextFilters,
        teams: teamId ? [teamId] : (profile?.team_id ? [String(profile.team_id)] : []),
      });
      return;
    }
    setFilters(nextFilters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFiltersResetSignal(prev => prev + 1);
  };

  const handleExportFormat = (format) => {
    if (!canExport || loading || error) return;
    if (format === 'csv') {
      exportAnalyticsToCSV(data, aggregateKPIs, filters, kpiUnits);
    } else if (format === 'pdf') {
      exportAnalyticsToPDF(data, aggregateKPIs, filters, kpiUnits);
    }
  };

  const quickRanges = ['This Week', 'Last Week', 'This Month', 'Last Month', 'This Quarter', 'Last Quarter', 'All Time', 'Custom Week'];
  const applyQuickRange = (range) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
    if (range !== 'Custom Week') setCustomWeekDate('');
  };

  const kpiUnits = useMemo(() => {
    const map = {};
    allKpiMetrics.forEach(m => { map[m.key] = m.unit || 'count'; });
    return map;
  }, [allKpiMetrics]);

  const funnelGoals = useMemo(() => {
    const map = {};
    allKpiMetrics.forEach(m => { map[m.key] = m.goal; });
    return map;
  }, [allKpiMetrics]);

  // Scale benchmarks and goals by team size × date range weeks so they match team-total funnel values
  const scaledFunnelBenchmarks = useMemo(() => {
    const numReps = data.rows.length || 1;
    const numDays = Math.max(7, (new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
    const numWeeks = numDays / 7;
    const scaled = {};
    Object.entries(funnelBenchmarks).forEach(([key, types]) => {
      scaled[key] = {};
      Object.entries(types).forEach(([type, value]) => {
        scaled[key][type] = Math.round(value * numReps * numWeeks);
      });
    });
    // Compute Team Top 25% (75th percentile of actual rep values)
    const funnelKeys = ['call_connects', 'meetings', 'sourced_opps', 'stage2_opps', 'stage3_opps', 'closed_won'];
    funnelKeys.forEach(key => {
      const vals = data.rows.map(r => r.kpis[key]?.value || 0).sort((a, b) => a - b);
      const p75 = vals.length > 0 ? vals[Math.min(Math.ceil(vals.length * 0.75) - 1, vals.length - 1)] : 0;
      if (!scaled[key]) scaled[key] = {};
      scaled[key].team_p75 = Math.round(p75 * numReps * numWeeks);
    });
    return scaled;
  }, [funnelBenchmarks, data.rows, dateRange.end, dateRange.start]);

  const scaledFunnelGoals = useMemo(() => {
    const numReps = data.rows.length || 1;
    const numDays = Math.max(7, (new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
    const numWeeks = numDays / 7;
    const scaled = {};
    allKpiMetrics.forEach(m => { scaled[m.key] = Math.round((m.goal || 0) * numReps * numWeeks); });
    return scaled;
  }, [allKpiMetrics, data.rows.length, dateRange.end, dateRange.start]);

  const tabs = useMemo(() => ([
    { id: 'overview', label: 'Overview' },
    { id: 'kpi-attainment', label: 'KPI Attainment' },
    { id: 'funnel', label: 'Sales Funnel' },
    { id: 'watchdog', label: 'KPI Watchdog' },
    { id: 'engage', label: 'Engage' },
    { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'records', label: 'Records' },
    ...((isAdmin || isManager) ? [{ id: 'org-health', label: 'Org Health' }] : []),
  ]), [isAdmin, isManager]);

  // Calculate aggregate KPI metrics from filtered data — dynamic top KPIs by total value
  const aggregateKPIs = useMemo(() => {
    if (!data.rows.length || !allKpiMetrics.length) return [];
    const sums = {};
    allKpiMetrics.forEach(m => { sums[m.key] = 0; });
    data.rows.forEach(row => {
      allKpiMetrics.forEach(m => {
        sums[m.key] += row.kpis[m.key]?.value || 0;
      });
    });
    // Pick top 6 KPIs that actually have data, sorted by total value descending
    return allKpiMetrics
      .filter(m => sums[m.key] > 0)
      .sort((a, b) => sums[b.key] - sums[a.key])
      .slice(0, 6)
      .map(m => ({
        key: m.key,
        name: m.name,
        total: Math.round(sums[m.key] * 10) / 10,
        unit: m.unit,
        goal: m.goal,
      }));
  }, [data, allKpiMetrics]);

  const teamNameMap = useMemo(() => {
    const map = new Map();
    (teams || []).forEach((t) => map.set(String(t.id), t.name));
    return map;
  }, [teams]);

  const teamNamesInView = useMemo(() => {
    const ids = Array.from(new Set((data.rows || []).map(r => String(r.team_id || '')).filter(Boolean)));
    const names = ids.map(id => teamNameMap.get(id) || `Team ${id.slice(0, 4)}`);
    return names.sort();
  }, [data.rows, teamNameMap]);

  const userRow = useMemo(() => {
    if (!user?.id) return null;
    return data.rows.find(r => String(r.profile_id) === String(user.id)) || null;
  }, [data.rows, user?.id]);

  const kpiHealthData = useMemo(() => {
    if (!userRow?.kpis) return [
      { name: 'Exceeding (≥100%)', value: 0, kpis: [] },
      { name: 'On Track (80-99%)', value: 0, kpis: [] },
      { name: 'Needs Focus (<80%)', value: 0, kpis: [] },
    ];
    const exceeding = [];
    const onTrack = [];
    const needsFocus = [];
    // Use ALL KPI metrics for comprehensive health view
    const allKeys = allKpiMetrics.length > 0
      ? allKpiMetrics.map(m => m.key)
      : Object.keys(userRow.kpis);
    const labelMap = allKpiMetrics.reduce((acc, m) => { acc[m.key] = m.name; return acc; }, {});
    allKeys.forEach((key) => {
      const val = userRow.kpis[key];
      const pct = Math.round(val?.percentage || 0);
      const label = labelMap[key] || prettifyKpiKey(key);
      if (pct >= 100) exceeding.push(label);
      else if (pct >= 80) onTrack.push(label);
      else needsFocus.push(label);
    });
    return [
      { name: 'Exceeding (≥100%)', value: exceeding.length, kpis: exceeding },
      { name: 'On Track (80-99%)', value: onTrack.length, kpis: onTrack },
      { name: 'Needs Focus (<80%)', value: needsFocus.length, kpis: needsFocus },
    ];
  }, [userRow, allKpiMetrics]);

  const teamPerformanceData = useMemo(() => {
    if (!isAdmin || data.rows.length === 0) return [];
    const byTeam = new Map();
    data.rows.forEach((row) => {
      const id = String(row.team_id || '');
      if (!byTeam.has(id)) byTeam.set(id, { sum: 0, count: 0 });
      const entry = byTeam.get(id);
      entry.sum += row.apptivityScore || 0;
      entry.count += 1;
    });
    const result = Array.from(byTeam.entries()).map(([id, entry]) => ({
      name: teamNameMap.get(id) || (id ? `Team ${id.slice(0, 4)}` : 'Unassigned'),
      score: Math.round(entry.sum / Math.max(1, entry.count)),
    }));
    return result.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [isAdmin, data.rows, teamNameMap]);

  const repPerformanceData = useMemo(() => {
    if (data.rows.length === 0) return [];
    return data.rows.slice(0, 10).map(row => ({
      name: row.name.split(' ')[0],
      score: row.apptivityScore,
    }));
  }, [data.rows]);

  const kpiAttainmentData = useMemo(() => {
    if (!data.rows.length) return [];
    // Use ALL KPI metrics (not just scorecard ones) for comprehensive analytics
    const allKeys = allKpiMetrics.length > 0
      ? allKpiMetrics.map(m => m.key)
      : Object.keys(data.rows[0]?.kpis || {});
    const labelMap = allKpiMetrics.reduce((acc, m) => { acc[m.key] = m.name; return acc; }, {});

    const rowCount = data.rows.length || 1;
    const result = allKeys.map((key) => {
      const avgPct = Math.round(
        data.rows.reduce((sum, row) => sum + (row.kpis[key]?.percentage || 0), 0) / rowCount
      );
      return {
        name: labelMap[key] || prettifyKpiKey(key),
        key,
        score: avgPct,
        hasData: data.rows.some(row => row.kpis[key]?.value > 0),
      };
    });
    return result.sort((a, b) => b.score - a.score);
  }, [data.rows, allKpiMetrics]);

  // Filtered version for charts — excludes KPIs with no data to avoid 0% noise
  const kpiAttainmentChartData = useMemo(() => {
    return kpiAttainmentData.filter(k => k.hasData);
  }, [kpiAttainmentData]);

  const topMovers = useMemo(() => {
    if (!data.rows.length) return [];
    const sorted = [...data.rows].sort((a, b) => b.apptivityScore - a.apptivityScore);
    const topCount = Math.min(3, Math.floor(sorted.length / 2));
    const bottomStart = Math.max(topCount, sorted.length - 3);
    const top = sorted.slice(0, topCount).map(r => ({ ...r, trend: 'Top' }));
    const bottom = sorted.slice(bottomStart).reverse().map(r => ({ ...r, trend: 'Needs Focus' }));
    return [...top, ...bottom];
  }, [data.rows]);

  // Fetch funnel KPI values — placed here so data and dateRange are already declared
  useEffect(() => {
    if (activeTab !== 'funnel') return;
    if (!data.rows.length) { setFunnelKpiValues({}); return; }
    // Skip refetch if the data context hasn't changed
    const cacheKey = `${data.rows.map(r => r.profile_id).join(',')}|${dateRange.start}|${dateRange.end}`;
    if (funnelCacheRef.current === cacheKey) return;
    let mounted = true;
    async function loadFunnelValues() {
      setFunnelLoading(true);
      try {
        const profileIds = data.rows.map(r => r.profile_id);
        const { data: kpiRows, error } = await supabase
          .from('kpi_values')
          .select('value, kpi_metrics!inner(key)')
          .in('profile_id', profileIds)
          .lte('period_start', dateRange.end.slice(0, 10))
          .gte('period_end', dateRange.start.slice(0, 10))
          .in('kpi_metrics.key', FUNNEL_KEYS);
        if (error) throw error;
        const sums = {};
        (kpiRows || []).forEach(r => {
          const key = r.kpi_metrics?.key;
          if (key) sums[key] = (sums[key] || 0) + (r.value || 0);
        });
        if (mounted) {
          setFunnelKpiValues(sums);
          funnelCacheRef.current = cacheKey;
        }
      } catch (e) {
        console.error('Error fetching funnel KPI values:', e);
      } finally {
        if (mounted) setFunnelLoading(false);
      }
    }
    loadFunnelValues();
    return () => { mounted = false; };
  }, [activeTab, data.rows, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (!data.rows.length || !allKpiMetrics.length) return;
    const callsMetric = allKpiMetrics.find(m => m.key === 'call_connects');
    const callsGoal = callsMetric?.goal || 100;
    const callsTarget = data.rows.length * callsGoal;
    const totalCalls = data.rows.reduce((sum, row) => sum + (row.kpis.call_connects?.value || 0), 0);
    if (totalCalls >= callsTarget) {
      addNotification({
        type: 'trend',
        title: 'Weekly trend win',
        message: 'Calls are above target for this period.',
        link: '/analytics',
        dedupeKey: `analytics-trend-${filters.dateRange}`,
      });
    }
  }, [data.rows, allKpiMetrics, filters.dateRange, addNotification]);

  // Search functionality
  const handleSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    setShowSearchResults(true);
    const results = [];

    try {
      const searchTerm = query.trim().toLowerCase();

      // Search profiles/users — org-scoped (mandatory)
      if (!orgId) { setSearching(false); return; }
      let profilesSearchQ = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .eq('organization_id', orgId)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      const { data: profiles } = await profilesSearchQ;

      if (profiles) {
        profiles.forEach((profile) => {
          results.push({
            type: 'User',
            title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            subtitle: profile.role,
            link: `/profile?user=${profile.id}`,
            icon: '👤'
          });
        });
      }

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    // Loading state will be cleared when data comes back
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-apptivia-coral">{isPowerUser ? 'My Analytics' : 'Analytics Dashboard'}</h1>
              <InfoTooltip text="Performance analytics across the selected timeframe and audience." />
            </div>
            <p className="text-apptivia-carbon-500 text-sm">Advanced reporting and insights</p>
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
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-apptivia-carbon-700 border border-apptivia-carbon-200 hover:bg-apptivia-paper group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
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
              onConfigureClick={() => { if (canConfigure) setConfigPanelOpen(true); }}
              onNotificationsClick={openPanel}
              configureDisabled={!canConfigure}
              notificationBadge={unreadCount}
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
              ]}
            />
        </div>
      </div>
      {loading && <div className="text-center py-8">Loading analytics...</div>}
      {error && <div className="text-red-500 text-center py-8">Error: {error}</div>}

        {!loading && !error && (
          <div className="space-y-6 mt-6">
            <div className="bg-white rounded-lg p-2 shadow-sm border border-apptivia-carbon-100">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-apptivia-coral text-white shadow-sm'
                        : 'text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs text-apptivia-carbon-500">Quick date presets</div>
                  {weeklyAverage && (
                    <span className="text-[10px] bg-apptivia-coral-tone-50 text-apptivia-coral px-1.5 py-0.5 rounded-full font-semibold">avg/wk</span>
                  )}
                  {formatPresetDateRange(filters.dateRange || 'This Week') && (
                    <span className="text-xs font-medium text-apptivia-carbon-700">
                      {formatPresetDateRange(filters.dateRange || 'This Week')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {quickRanges.map((range) => (
                    <button
                      key={range}
                      onClick={() => applyQuickRange(range)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        filters.dateRange === range
                          ? 'bg-apptivia-coral text-white'
                          : 'bg-apptivia-carbon-100 text-apptivia-carbon-600 hover:bg-apptivia-carbon-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                {filters.dateRange === 'Custom Week' && (
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-apptivia-carbon-500">Pick any day in the week:</label>
                    <input
                      type="date"
                      title="Pick any day — the full Mon–Sun week will be used"
                      value={customWeekDate}
                      onChange={e => setCustomWeekDate(e.target.value)}
                      className="border border-apptivia-carbon-200 rounded px-2 py-0.5 text-xs"
                    />
                    {customWeekDate && (
                      <span className="text-[11px] text-apptivia-carbon-400">
                        {dateRange.start.slice(0, 10)} → {dateRange.end.slice(0, 10)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setFiltersOpen(true)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-apptivia-carbon-200 text-apptivia-carbon-700 hover:bg-apptivia-paper"
              >
                More Filters
              </button>
            </div>

            {data.rows.length === 0 && (
              <div className="bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg p-6 text-center">
                <div className="text-apptivia-carbon-500 text-sm">No data for the selected filters.</div>
                <div className="text-xs text-apptivia-carbon-400 mt-1">Try expanding the date range or teams.</div>
              </div>
            )}

            {data.rows.length > 0 && (
              <>
            {activeTab === 'overview' && (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[300px] gap-4">
                <ScoreDistributionChart
                  title={isPowerUser ? 'KPI Health' : 'Team Score Distribution'}
                  infoText={isPowerUser
                    ? 'Breakdown of your KPIs by health category for the selected period.'
                    : 'Distribution of reps by scorecard performance buckets for the selected period.'
                  }
                  data={isPowerUser ? kpiHealthData : [
                    { name: 'Excellent (>100%)', value: data.rows.filter(r => r.apptivityScore >= 100).length },
                    { name: 'Good (80-99%)', value: data.rows.filter(r => r.apptivityScore >= 80 && r.apptivityScore < 100).length },
                    { name: 'Needs Improvement (<80%)', value: data.rows.filter(r => r.apptivityScore < 80).length },
                  ]}
                  footer={null}
                />
                {isPowerUser ? (
                  <TeamPerformanceChart
                    title="KPI Attainment (Avg %)"
                    infoText="Average KPI attainment across the selected audience and period."
                    data={kpiAttainmentChartData}
                    dataKey="score"
                    barLabel="Avg KPI %"
                    xDomain={[0, 120]}
                    xTickFormatter={(value) => `${value}%`}
                  />
                ) : (
                  <TeamPerformanceChart
                    title={isAdmin ? 'Team Performance Rankings' : 'Rep Performance Rankings'}
                    infoText={isAdmin
                      ? 'Ranked by average Apptivia score across each team.'
                      : 'Top reps ranked by Apptivia score for the selected filters.'
                    }
                    data={isAdmin ? teamPerformanceData : repPerformanceData}
                  />
                )}
              </div>

              {/* Historical Trend Chart */}
              {!historicalLoading && historicalData.length > 1 && (
                <div className="mt-4">
                  <HistoricalScoresChart
                    data={historicalData}
                    title="Score Trend"
                    infoText="Average Apptivia score trend over the selected date range."
                    repNames={historicalRepNames}
                    lineName="Team Avg"
                    chartHeight={220}
                  />
                </div>
              )}
              </>
            )}

            {activeTab === 'kpi-attainment' && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-apptivia-ink">Summary Metrics</h2>
                  <InfoTooltip text={weeklyAverage ? "Weekly averages of key activities for the selected filters and date range." : "Totals of key activities for the selected filters and date range."} />
                </div>
                {aggregateKPIs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {aggregateKPIs.map((kpi, idx) => {
                    const colors = ['text-apptivia-coral', 'text-green-600', 'text-apptivia-ink', 'text-cyan-600', 'text-amber-600', 'text-rose-600'];
                    const unitSuffix = kpi.unit === 'currency' ? '' : kpi.unit === 'minutes' ? ' min' : kpi.unit === 'hours' ? ' hrs' : kpi.unit === 'percentage' || kpi.unit === 'percent' ? '%' : '';
                    const formatted = kpi.unit === 'currency' ? `$${kpi.total.toLocaleString()}` : `${kpi.total.toLocaleString()}${unitSuffix}`;
                    return (
                      <div key={kpi.key} className="bg-white rounded-lg p-3 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                        <div className="text-xs text-apptivia-carbon-500 mb-1 truncate" title={kpi.name}>{kpi.name}</div>
                        <div className={`text-base font-bold ${colors[idx % colors.length]}`}>{formatted}</div>
                        <div className="text-xs text-apptivia-carbon-400 mt-1">{weeklyAverage ? 'Avg/week' : 'Team total'}</div>
                      </div>
                    );
                  })}
                </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[300px] gap-4">
                  <TeamPerformanceChart
                    title="KPI Attainment (Avg %)"
                    infoText="Average KPI attainment across all active KPIs for the selected audience and period."
                    data={kpiAttainmentChartData}
                    dataKey="score"
                    barLabel="Avg KPI %"
                    xDomain={[0, 120]}
                    xTickFormatter={(value) => `${value}%`}
                  />
                  <ScoreDistributionChart
                    title={isPowerUser ? 'KPI Health' : 'Score Distribution'}
                    infoText={isPowerUser
                      ? 'Breakdown of all your KPIs by health category for the selected period.'
                      : 'Distribution of reps by scorecard performance buckets for the selected period.'
                    }
                    data={isPowerUser ? kpiHealthData : [
                      { name: 'Excellent (>100%)', value: data.rows.filter(r => r.apptivityScore >= 100).length },
                      { name: 'Good (80-99%)', value: data.rows.filter(r => r.apptivityScore >= 80 && r.apptivityScore < 100).length },
                      { name: 'Needs Improvement (<80%)', value: data.rows.filter(r => r.apptivityScore < 80).length },
                    ]}
                  />
                </div>

                {/* Detailed KPI Breakdown — All KPIs */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-apptivia-ink">All KPI Details</h3>
                    <InfoTooltip text="Detailed view of every active KPI metric — including those not shown on the scorecard." />
                    <span className="text-[10px] bg-apptivia-coral-tone-50 text-apptivia-coral px-2 py-0.5 rounded-full font-medium">{allKpiMetrics.length} KPIs</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-apptivia-carbon-500 border-b border-apptivia-carbon-100">
                          <th className="py-2 px-3 font-medium">KPI Name</th>
                          <th className="py-2 px-3 font-medium">Category</th>
                          <th className="py-2 px-3 font-medium">Goal</th>
                          <th className="py-2 px-3 font-medium">Avg Value</th>
                          <th className="py-2 px-3 font-medium">Avg Attainment</th>
                          <th className="py-2 px-3 font-medium">On Scorecard</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allKpiMetrics.map((metric) => {
                          const kpiData = kpiAttainmentData.find(k => k.key === metric.key);
                          const avgPct = kpiData?.score || 0;
                          const avgValue = data.rows.length > 0
                            ? Math.round(data.rows.reduce((sum, row) => sum + (row.kpis[metric.key]?.value || 0), 0) / data.rows.length * 10) / 10
                            : 0;
                          return (
                            <tr key={metric.key} className="border-b border-apptivia-carbon-100 hover:bg-apptivia-paper/50">
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-apptivia-ink">{metric.name}</div>
                                {metric.description && <div className="text-[10px] text-apptivia-carbon-400 mt-0.5 line-clamp-2" title={metric.description}>{metric.description}</div>}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-xs text-apptivia-carbon-500">{prettifyKpiKey(metric.category || 'general')}</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-apptivia-carbon-700">
                                {metric.unit === 'currency' ? `$${Number(metric.goal).toLocaleString()}` : metric.goal}
                                {metric.unit === 'percentage' || metric.unit === 'percent' ? '%' : ''}
                                {metric.unit === 'minutes' ? ' min' : ''}
                                {metric.unit === 'hours' ? ' hrs' : ''}
                                {metric.unit === 'seconds' ? ' sec' : ''}
                                {metric.unit === 'days' ? ' days' : ''}
                                {metric.direction === 'lower' && <span className="text-[10px] text-apptivia-carbon-400 ml-1">(lower=better)</span>}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-apptivia-carbon-700">{avgValue}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-apptivia-carbon-100 rounded-full h-1.5">
                                    <div
                                      className={`h-full rounded-full transition-all ${scoreBgColor(avgPct)}`}
                                      style={{ width: `${Math.min(avgPct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`font-bold ${scoreTextColor(avgPct)}`}>
                                    {avgPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {metric.show_on_scorecard ? (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Yes</span>
                                ) : (
                                  <span className="text-[10px] bg-apptivia-paper text-apptivia-carbon-400 px-1.5 py-0.5 rounded-full font-medium">No</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  avgPct >= 90 ? 'bg-emerald-50 text-emerald-700' :
                                  avgPct >= 80 ? 'bg-yellow-50 text-yellow-700' :
                                  avgPct >= 60 ? 'bg-orange-50 text-orange-700' :
                                  avgPct > 0 ? 'bg-red-50 text-red-600' :
                                  'bg-apptivia-paper text-apptivia-carbon-400'
                                }`}>
                                  {avgPct >= 90 ? 'On Track' : avgPct >= 80 ? 'Acceptable' : avgPct >= 60 ? 'Needs Focus' : avgPct > 0 ? 'Critical' : 'No Data'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {allKpiMetrics.length === 0 && (
                    <div className="text-center py-8 text-sm text-apptivia-carbon-400">No KPI metrics configured yet.</div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'funnel' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-apptivia-ink">Sales Funnel</h2>
                  <InfoTooltip text="Conversion rates across each stage of the sales funnel for the selected filters and date range. Benchmarks compare your actuals against industry averages, your team's top 25% performers, or configured goals." />
                </div>
                {funnelLoading && <div className="text-center py-8 text-sm text-apptivia-carbon-500">Loading funnel data...</div>}
                {!funnelLoading && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SalesFunnel
                      kpiValues={funnelKpiValues}
                      benchmarks={scaledFunnelBenchmarks}
                      goals={scaledFunnelGoals}
                      viewMode="team"
                    />
                    {/* Summary conversion stats */}
                    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-6">
                      <h3 className="text-sm font-semibold text-apptivia-ink mb-4">Conversion Rates</h3>
                      {[
                        { from: 'call_connects', to: 'meetings', label: 'Call → Meeting Rate', desc: 'How many calls result in a booked meeting' },
                        { from: 'meetings', to: 'sourced_opps', label: 'Meeting → Opp Rate', desc: 'How many meetings result in a sourced opportunity' },
                        { from: 'sourced_opps', to: 'stage2_opps', label: 'Opp → SQL Rate', desc: 'How many sourced opps get accepted as SQLs' },
                        { from: 'stage2_opps', to: 'stage3_opps', label: 'SQL → Stage 3 Rate', desc: 'How many SQLs advance to Stage 3' },
                        { from: 'stage3_opps', to: 'closed_won', label: 'Stage 3 → Won Rate', desc: 'Win rate from late-stage opportunities' },
                      ].map(({ from, to, label, desc }) => {
                        const fromVal = funnelKpiValues[from] || 0;
                        const toVal = funnelKpiValues[to] || 0;
                        const rate = fromVal > 0 ? ((toVal / fromVal) * 100).toFixed(1) : null;
                        const industryFrom = funnelBenchmarks[from]?.industry;
                        const industryTo = funnelBenchmarks[to]?.industry;
                        const industryRate = industryFrom > 0 && industryTo != null
                          ? ((industryTo / industryFrom) * 100).toFixed(1)
                          : null;
                        const pctOfIndustry = rate != null && industryRate > 0
                          ? (parseFloat(rate) / parseFloat(industryRate)) * 100
                          : null;
                        const color = pctOfIndustry == null ? 'text-apptivia-carbon-400'
                          : pctOfIndustry >= 100 ? 'text-emerald-600'
                          : pctOfIndustry >= 75 ? 'text-amber-600'
                          : 'text-red-500';
                        const bg = pctOfIndustry == null ? 'bg-apptivia-paper'
                          : pctOfIndustry >= 100 ? 'bg-emerald-50'
                          : pctOfIndustry >= 75 ? 'bg-amber-50'
                          : 'bg-red-50';
                        return (
                          <div key={`${from}-${to}`} className={`flex items-center justify-between p-3 rounded-lg mb-2 ${bg}`}>
                            <div>
                              <div className="text-xs font-semibold text-apptivia-ink">{label}</div>
                              <div className="text-[11px] text-apptivia-carbon-500 mt-0.5">{desc}</div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${color}`}>
                                {rate != null ? `${rate}%` : '—'}
                              </div>
                              {industryRate && (
                                <div className="text-[10px] text-apptivia-carbon-400">Ind. avg: {industryRate}%</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'watchdog' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={18} className="text-red-500" />
                  <h2 className="text-sm font-semibold text-apptivia-ink">KPI Anomaly Watchdog</h2>
                  <InfoTooltip text="Automatically detect KPI drops, trigger coaching recommendations, and track resolution." />
                </div>
                <KpiWatchdog
                  organizationId={profile?.organization_id || user?.organization_id || ''}
                  userId={user?.id}
                  filterProfileIds={data.rows.length > 0 ? data.rows.map(r => r.profile_id) : undefined}
                />
              </div>
            )}

            {activeTab === 'engage' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radar size={18} className="text-cyan-500" />
                  <h2 className="text-sm font-semibold text-apptivia-ink">Engage Analytics</h2>
                  <InfoTooltip text="Performance metrics from Apptivia Engage — sequences, accounts, playbooks, and signals." />
                </div>
                {engageLoading && <div className="text-center py-8 text-sm text-apptivia-carbon-500">Loading Engage data...</div>}
                {!engageLoading && !engageStats && (
                  <div className="bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg p-6 text-center">
                    <div className="text-apptivia-carbon-500 text-sm">No Engage data found.</div>
                    <div className="text-xs text-apptivia-carbon-400 mt-1">Start using Engage to see analytics here.</div>
                    <button
                      onClick={() => navigate('/engage')}
                      className="mt-3 px-4 py-2 bg-cyan-500 text-white text-xs font-semibold rounded-lg hover:bg-cyan-600 transition-colors"
                    >
                      Go to Engage
                    </button>
                  </div>
                )}
                {!engageLoading && engageStats && (
                  <>
                    {/* Summary Cards — Row 1: Accounts */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-apptivia-carbon-300">
                        <div className="text-xs text-apptivia-carbon-500">Accounts</div>
                        <div className="text-lg font-bold text-apptivia-ink">{engageStats.totalAccounts}</div>
                        <div className="text-[11px] text-apptivia-carbon-400">Avg score: {engageStats.avgAccountScore}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-apptivia-coral">
                        <div className="text-xs text-apptivia-carbon-500">Tier 1</div>
                        <div className="text-lg font-bold text-apptivia-coral">{engageStats.tier1}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-cyan-500">
                        <div className="text-xs text-apptivia-carbon-500">Tier 2 / Tier 3</div>
                        <div className="text-lg font-bold text-cyan-600">{engageStats.tier2} / {engageStats.tier3}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-apptivia-coral">
                        <div className="text-xs text-apptivia-carbon-500">AI Drafts Generated</div>
                        <div className="text-lg font-bold text-apptivia-coral">{engageStats.totalDrafts}</div>
                        <div className="text-[11px] text-apptivia-carbon-400">Last 30 days</div>
                      </div>
                    </div>

                    {/* Summary Cards — Row 2: Signal Activity */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-amber-400">
                        <div className="text-xs text-apptivia-carbon-500">Signals Detected</div>
                        <div className="text-lg font-bold text-apptivia-ink">{engageStats.totalSignals}</div>
                        <div className="text-[11px] text-apptivia-carbon-400">Last 30 days</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
                        <div className="text-xs text-apptivia-carbon-500">Signals Actioned</div>
                        <div className="text-lg font-bold text-green-600">{engageStats.signalsActioned}</div>
                        <div className="text-[11px] text-apptivia-carbon-400">{engageStats.signalActionRate}% action rate</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-400">
                        <div className="text-xs text-apptivia-carbon-500">Outreach Sent</div>
                        <div className="text-lg font-bold text-blue-600">{engageStats.actionsSent}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-300">
                        <div className="text-xs text-apptivia-carbon-500">Dismissed</div>
                        <div className="text-lg font-bold text-red-500">{engageStats.actionsDismissed}</div>
                        <div className="text-[11px] text-apptivia-carbon-400">{engageStats.actionsPending} pending</div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {engageStats.accountTiers.length > 0 && (
                        <TeamPerformanceChart
                          title="Accounts by Tier"
                          infoText="Account intelligence records grouped by tier level."
                          data={engageStats.accountTiers}
                        />
                      )}
                      {engageStats.signalTypeBreakdown.length > 0 && (
                        <TeamPerformanceChart
                          title="Signals by Type"
                          infoText="Intent signals detected in the last 30 days, grouped by signal type."
                          data={engageStats.signalTypeBreakdown}
                        />
                      )}
                    </div>

                    {/* Outreach by Channel + Action Queue Throughput */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-apptivia-carbon-500 mb-2 font-semibold">Outreach by Channel</div>
                        <div className="space-y-1.5 text-xs">
                          {engageStats.outreachByChannel.length > 0 ? engageStats.outreachByChannel.map(ch => (
                            <div key={ch.name} className="flex justify-between">
                              <span className="text-apptivia-carbon-600">{ch.name}</span>
                              <span className="font-medium text-apptivia-ink">{ch.score}</span>
                            </div>
                          )) : (
                            <div className="text-apptivia-carbon-400 text-center py-2">No outreach data yet</div>
                          )}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-apptivia-carbon-500 mb-2 font-semibold">Action Queue (30 days)</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-apptivia-carbon-600">Sent</span><span className="font-medium text-green-600">{engageStats.actionsSent}</span></div>
                          <div className="flex justify-between"><span className="text-apptivia-carbon-600">Approved</span><span className="font-medium text-blue-600">{engageStats.actionsApproved}</span></div>
                          <div className="flex justify-between"><span className="text-apptivia-carbon-600">Dismissed</span><span className="font-medium text-red-500">{engageStats.actionsDismissed}</span></div>
                          <div className="flex justify-between"><span className="text-apptivia-carbon-600">Pending</span><span className="font-medium text-apptivia-carbon-600">{engageStats.actionsPending}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-apptivia-coral-tone-50 rounded-lg p-4 border border-cyan-100">
                      <div className="text-xs font-semibold text-apptivia-carbon-700 mb-2">Quick Links</div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-cyan-700 rounded-lg border border-cyan-200 hover:bg-cyan-50 transition-colors">Pipeline Operator</button>
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-apptivia-coral rounded-lg border border-apptivia-coral-tone-100 hover:bg-apptivia-coral-tone-50 transition-colors">Signal Prospecting</button>
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-apptivia-ink rounded-lg border border-apptivia-carbon-300 hover:bg-apptivia-carbon-100 transition-colors">Accounts</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* [FEATURE 4] Team Benchmarks Tab */}
            {activeTab === 'benchmarks' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={18} className="text-apptivia-ink" />
                  <h2 className="text-base font-bold text-apptivia-ink">Team Benchmarks</h2>
                </div>
                <p className="text-xs text-apptivia-carbon-500">See how your team compares to similar sales organizations. All peer data is anonymized.</p>

                {!isPro ? (
                  <div>
                    {/* Blurred placeholder rows */}
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-apptivia-paper">
                          <tr><th className="px-4 py-2 text-left text-xs font-semibold text-apptivia-carbon-600">Metric</th><th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Your Avg</th><th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Peer Avg</th><th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Percentile</th></tr>
                        </thead>
                        <tbody className="blur-[3px] pointer-events-none select-none">
                          <tr className="border-t"><td className="px-4 py-3 text-apptivia-carbon-700">Calls Made</td><td className="px-4 py-3 text-center">72%</td><td className="px-4 py-3 text-center">65-75%</td><td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Top 25%</span></td></tr>
                          <tr className="border-t"><td className="px-4 py-3 text-apptivia-carbon-700">Meetings Set</td><td className="px-4 py-3 text-center">58%</td><td className="px-4 py-3 text-center">50-60%</td><td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">Top 50%</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                    <UpgradePrompt variant="feature_gate" feature="benchmarks" context="inline" />
                  </div>
                ) : benchmarksLoading ? (
                  <div className="text-sm text-apptivia-carbon-500 text-center py-8">Loading benchmarks...</div>
                ) : isEnterprise && enterpriseBenchmarkData ? (
                  <div className="space-y-3">
                    {enterpriseBenchmarkData.org_count > 0 && (
                      <p className="text-xs text-apptivia-carbon-400">Compared against {enterpriseBenchmarkData.org_count} peer organization{enterpriseBenchmarkData.org_count !== 1 ? 's' : ''} (anonymized){enterpriseBenchmarkData.using_industry_baseline ? ' · Showing industry medians' : ''}</p>
                    )}
                    {(enterpriseBenchmarkData.benchmarks || []).length > 0 ? (
                      <div className="bg-white rounded-lg border border-apptivia-carbon-200 divide-y divide-gray-50">
                        {enterpriseBenchmarkData.benchmarks.map((b, i) => (
                          <div key={i} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-apptivia-ink">{b.kpi_name || b.kpi_key}</span>
                              {b.your_percentile != null ? (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  b.your_percentile >= 75 ? 'bg-green-100 text-green-700' :
                                  b.your_percentile >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {b.your_percentile}th percentile
                                </span>
                              ) : (
                                <span className="text-xs text-apptivia-carbon-400">—</span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-apptivia-carbon-500">
                              <div>Your avg: <span className="font-medium text-apptivia-ink">{b.your_avg ?? b.value ?? '—'}</span></div>
                              <div>Peer median: <span className="font-medium text-apptivia-ink">{b.peer_median ?? (b.benchmark_type === 'industry_median' ? b.value : '—')}</span></div>
                              <div>Top quartile: <span className="font-medium text-apptivia-ink">{b.top_quartile ?? '—'}</span></div>
                            </div>
                            {b.trend != null && (
                              <div className="mt-1 text-xs text-apptivia-carbon-400">
                                Trend vs prior period: {b.trend >= 0 ? '+' : ''}{b.trend}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-apptivia-carbon-500 text-center py-8">{enterpriseBenchmarkData.message || 'No benchmark data available yet.'}</div>
                    )}
                  </div>
                ) : benchmarksError ? (
                  <div className="bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg p-4 text-center">
                    <p className="text-sm text-apptivia-coral">Benchmarks activate once more Apptivia organizations join your segment. Check back soon.</p>
                  </div>
                ) : benchmarks.length > 0 ? (
                  <div className="bg-white rounded-lg border border-apptivia-carbon-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-apptivia-paper">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-apptivia-carbon-600">Metric</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Your Avg</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Peer Avg</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-apptivia-carbon-600">Percentile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks.map(b => {
                          const pctColor = b.percentile >= 75 ? 'bg-green-100 text-green-700' : b.percentile >= 50 ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' : 'bg-amber-100 text-amber-700';
                          const trendIcon = b.trend === 'improving' ? '↑' : b.trend === 'declining' ? '↓' : '→';
                          const trendColor = b.trend === 'improving' ? 'text-green-600' : b.trend === 'declining' ? 'text-red-600' : 'text-apptivia-carbon-400';
                          return (
                            <tr key={b.metric_name} className="border-t hover:bg-apptivia-paper">
                              <td className="px-4 py-3 text-apptivia-carbon-700 font-medium">{b.metric_name}</td>
                              <td className="px-4 py-3 text-center">
                                {b.org_avg}% <span className={`ml-1 ${trendColor}`}>{trendIcon}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-apptivia-carbon-500">{b.peer_range}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pctColor}`}>
                                  Top {100 - b.percentile}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-apptivia-carbon-500 text-center py-8">No benchmark data available yet.</div>
                )}
              </div>
            )}

            {/* Records tab */}
            {activeTab === 'records' && (
              <AnalyticsRecords
                organizationId={profile?.organization_id}
                dateRange={dateRange}
                isAdmin={isAdmin}
                isManager={isManager}
                teamMembers={data.rows?.map(r => ({ id: r.profile_id, full_name: r.name, avatar_url: r.avatar_url })) || []}
              />
            )}

            {/* 4E: Org Health Scorecard — admins/managers only */}
            {activeTab === 'org-health' && (isAdmin || isManager) && (
              <OrgHealthScorecard />
            )}

            {activeTab === 'overview' && (
              <>
                {/* Top Movers */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-semibold">📈 Top Movers</h3>
                    <InfoTooltip text="Best and weakest scorecard performance in the selected period." />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs table-fixed">
                      <thead>
                        <tr className="text-left text-apptivia-carbon-500">
                          <th className="py-2 w-1/4">Rep</th>
                          <th className="py-2 w-1/4">Score</th>
                          <th className="py-2 w-1/4">Delta to 80%</th>
                          <th className="py-2 w-1/4">Bucket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topMovers.map((row) => (
                          <tr key={`${row.profile_id}-${row.trend}`} className="border-t">
                            <td className="py-2 w-1/4 font-medium text-apptivia-ink truncate">{row.name}</td>
                            <td className="py-2 w-1/4">
                              <span className={`font-semibold ${scoreTextColor(row.apptivityScore)}`}>
                                {row.apptivityScore}%
                              </span>
                            </td>
                            <td className="py-2 w-1/4 text-apptivia-carbon-600">{row.apptivityScore - 80 > 0 ? `+${row.apptivityScore - 80}` : row.apptivityScore - 80}%</td>
                            <td className="py-2 w-1/4 text-apptivia-carbon-500">{row.trend}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Coached vs Uncoached Cohort Comparison */}
                {!isPowerUser && cohortData && (
                  <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
                    <h3 className="font-semibold text-apptivia-ink text-sm mb-1">Coached vs. Uncoached — KPI Impact</h3>
                    <p className="text-xs text-apptivia-carbon-400 mb-4">Last {cohortData.period_weeks || 4} weeks · Coached = received AI coaching suggestion</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-semibold text-apptivia-ink">
                          {cohortData.coached?.avg_attainment != null ? `${cohortData.coached.avg_attainment}%` : '—'}
                        </div>
                        <div className="text-xs text-apptivia-carbon-500 mt-1">Coached ({cohortData.coached?.count || 0} reps)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-semibold text-apptivia-carbon-400">
                          {cohortData.uncoached?.avg_attainment != null ? `${cohortData.uncoached.avg_attainment}%` : '—'}
                        </div>
                        <div className="text-xs text-apptivia-carbon-500 mt-1">Uncoached ({cohortData.uncoached?.count || 0} reps)</div>
                      </div>
                    </div>
                    {cohortData.coached?.avg_attainment != null && cohortData.uncoached?.avg_attainment != null && (
                      <div className="mt-3 text-center">
                        <span className={`text-sm font-medium ${
                          cohortData.coached.avg_attainment > cohortData.uncoached.avg_attainment
                            ? 'text-green-600' : 'text-apptivia-carbon-500'
                        }`}>
                          {cohortData.coached.avg_attainment > cohortData.uncoached.avg_attainment
                            ? `+${cohortData.coached.avg_attainment - cohortData.uncoached.avg_attainment}% lift from coaching`
                            : 'Not enough data yet'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Top Performers List */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-semibold">🏆 Top Performers</h3>
                    <InfoTooltip text="Top reps by Apptivia score for the selected period." />
                  </div>
                  <div className="space-y-3">
                    {data.rows.slice(0, 5).map((performer, i) => (
                      <div key={performer.profile_id} className="flex items-center justify-between bg-apptivia-carbon-50 rounded-lg p-3 transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold ${
                            i === 0 ? 'bg-yellow-100 text-yellow-600' :
                            i === 1 ? 'bg-apptivia-carbon-100 text-apptivia-carbon-600' :
                            i === 2 ? 'bg-orange-100 text-orange-600' :
                            'bg-apptivia-coral-tone-50 text-apptivia-coral'
                          }`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-apptivia-ink">{performer.name}</div>
                            <div className="text-xs text-apptivia-carbon-500">
                              {Math.round(performer.kpis.call_connects?.value || 0)} calls • 
                              {Math.round(performer.kpis.meetings?.value || 0)} meetings
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${scoreTextColor(performer.apptivityScore)}`}>
                            {performer.apptivityScore}%
                          </div>
                          <div className="text-xs text-apptivia-carbon-500">Apptivia Score</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            </>
            )}
          </div>
        )}
      </div>
      <ConfigurePanel
        isOpen={configPanelOpen}
        onClose={() => setConfigPanelOpen(false)}
        onOpenAdvanced={() => setShowConfigModal(true)}
      />
      <ConfigureModal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)} 
      />
      <RightFilterPanel
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Analytics Filters"
        subtitle="Refine insights"
        showReset
        onReset={handleResetFilters}
      >
            <ScorecardFilters
              showDate={true}
              organizationId={orgId}
              onFilterChange={handleFiltersChange}
              initialFilters={defaultFilters}
              resetSignal={filtersResetSignal}
              restrictToTeams={(isManager || isCoach) && teamId ? [teamId] : undefined}
            />
      </RightFilterPanel>
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
          addNotification({
            type: 'success',
            title: 'Report Scheduled',
            message: 'Your report has been scheduled. Manage it in Settings → Reports.',
            dedupeKey: 'report-scheduled',
          });
        }}
      />
    </DashboardLayout>
  );
}
