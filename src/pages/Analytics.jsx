import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Radar, Shield } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import ScorecardFilters from '../components/ScorecardFilters';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import { useScorecardData } from '../hooks/useScorecardData';
import { exportAnalyticsToCSV } from '../utils/exportUtils';
import ConfigureModal from '../components/ConfigureModal';
import ConfigurePanel from '../components/ConfigurePanel';import ScheduleReportModal from '../components/ScheduleReportModal';import { ScoreDistributionChart, TeamPerformanceChart, HistoricalScoresChart } from '../components/Charts';
import { useHistoricalScores } from '../hooks/useHistoricalScores';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import InfoTooltip from '../components/InfoTooltip';
import { supabase } from '../supabaseClient';
import { TeamPerformanceChart as EngageBarChart } from '../components/Charts';
import KpiWatchdog from '../components/KpiWatchdog';

export default function Analytics() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const isManager = role === 'manager';
  const isCoach = role === 'coach';
  const isAdmin = role === 'admin';
  const isPowerUser = role === 'power_user';
  const canExport = hasPermission('export_data');
  const canConfigure = hasPermission('configure_scorecard');

  const defaultFilters = useMemo(() => {
    if (isAdmin) {
      return {
        dateRange: 'All Time',
        departments: [],
        teams: [],
        members: [],
      };
    }
    if (isManager || isCoach) {
      return {
        dateRange: 'This Week',
        departments: [],
        teams: teamId ? [teamId] : [],
        members: [],
      };
    }
    return {
      dateRange: 'This Week',
      departments: [],
      teams: [],
      members: [],
    };
  }, [isAdmin, isManager, isCoach, teamId]);

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [filtersResetSignal, setFiltersResetSignal] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [showScheduleReportModal, setShowScheduleReportModal] = useState(false);
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [engageStats, setEngageStats] = useState(null);
  const [engageLoading, setEngageLoading] = useState(false);
  const [allKpiMetrics, setAllKpiMetrics] = useState([]);
  const [allKpiValues, setAllKpiValues] = useState([]);
  const [watchdogProfile, setWatchdogProfile] = useState(null);

  useEffect(() => {
    if (filtersInitialized) return;
    if (!user?.id) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    async function loadTeams() {
      try {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');
        if (!teamsError && mounted) setTeams(teamsData || []);
      } catch (e) {}
    }
    loadTeams();
    return () => { mounted = false; };
  }, [isAdmin]);

  // Fetch user profile for watchdog org context
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (data) setWatchdogProfile(data);
    }
    loadProfile();
  }, [user?.id]);

  // Fetch ALL active KPI metrics (not just scorecard ones) for comprehensive analytics
  useEffect(() => {
    async function loadAllKpis() {
      try {
        const { data: metrics, error: metricsError } = await supabase
          .from('kpi_metrics')
          .select('id, key, name, description, goal, weight, unit, category, show_on_scorecard')
          .eq('is_active', true)
          .order('scorecard_position');
        if (metricsError) throw metricsError;
        setAllKpiMetrics(metrics || []);
      } catch (e) {
        console.error('Error fetching all KPI metrics:', e);
      }
    }
    loadAllKpis();
  }, []);

  // Fetch Engage analytics when Engage tab is active
  useEffect(() => {
    if (activeTab !== 'engage') return;
    let mounted = true;
    async function loadEngageStats() {
      setEngageLoading(true);
      try {
        const orgId = profile?.organization_id || user?.organization_id;
        if (!orgId) { setEngageStats(null); setEngageLoading(false); return; }

        const [seqRes, enrollRes, acctRes, pbRes, execRes] = await Promise.all([
          supabase.from('engage_sequences').select('id, status, total_enrolled, total_replied', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('engage_sequence_enrollments').select('id, status', { count: 'exact' }).in('sequence_id',
            (await supabase.from('engage_sequences').select('id').eq('organization_id', orgId)).data?.map(s => s.id) || []
          ),
          supabase.from('engage_accounts').select('id, account_score, tier, status', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('engage_playbooks').select('id, status, times_used', { count: 'exact' }).eq('organization_id', orgId),
          supabase.from('engage_playbook_executions').select('id, status, outcome', { count: 'exact' }).eq('organization_id', orgId),
        ]);

        const sequences = seqRes.data || [];
        const enrollments = enrollRes.data || [];
        const accounts = acctRes.data || [];
        const playbooks = pbRes.data || [];
        const executions = execRes.data || [];

        const activeSequences = sequences.filter(s => s.status === 'active').length;
        const totalEnrolled = sequences.reduce((sum, s) => sum + (s.total_enrolled || 0), 0);
        const totalReplied = sequences.reduce((sum, s) => sum + (s.total_replied || 0), 0);
        const replyRate = totalEnrolled > 0 ? Math.round((totalReplied / totalEnrolled) * 100) : 0;

        const tier1 = accounts.filter(a => a.tier === 'tier_1').length;
        const tier2 = accounts.filter(a => a.tier === 'tier_2').length;
        const tier3 = accounts.filter(a => a.tier === 'tier_3').length;
        const avgAccountScore = accounts.length > 0
          ? Math.round(accounts.reduce((sum, a) => sum + (a.account_score || 0), 0) / accounts.length)
          : 0;

        const activePlaybooks = playbooks.filter(p => p.status === 'active').length;
        const completedExecutions = executions.filter(e => e.status === 'completed').length;
        const meetingsBooked = executions.filter(e => e.outcome === 'meeting_booked').length;

        // Build chart data
        const sequencePerformance = [
          { name: 'Active', score: activeSequences },
          { name: 'Draft', score: sequences.filter(s => s.status === 'draft').length },
          { name: 'Completed', score: sequences.filter(s => s.status === 'completed').length },
          { name: 'Paused', score: sequences.filter(s => s.status === 'paused').length },
        ].filter(d => d.score > 0);

        const accountTiers = [
          { name: 'Tier 1', score: tier1 },
          { name: 'Tier 2', score: tier2 },
          { name: 'Tier 3', score: tier3 },
          { name: 'Untiered', score: accounts.filter(a => a.tier === 'untiered').length },
        ].filter(d => d.score > 0);

        if (mounted) {
          setEngageStats({
            totalSequences: sequences.length,
            activeSequences,
            totalEnrolled,
            totalReplied,
            replyRate,
            enrollmentsByStatus: [
              { name: 'Active', score: enrollments.filter(e => e.status === 'active').length },
              { name: 'Replied', score: enrollments.filter(e => e.status === 'replied').length },
              { name: 'Completed', score: enrollments.filter(e => e.status === 'completed').length },
              { name: 'Bounced', score: enrollments.filter(e => e.status === 'bounced').length },
            ].filter(d => d.score > 0),
            totalAccounts: accounts.length,
            tier1, tier2, tier3,
            avgAccountScore,
            sequencePerformance,
            accountTiers,
            totalPlaybooks: playbooks.length,
            activePlaybooks,
            totalExecutions: executions.length,
            completedExecutions,
            meetingsBooked,
          });
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

  // Convert date range to actual dates
  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filters.dateRange) {
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
      default:
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
    }
  }, [filters.dateRange]);

  const { data, loading, error } = useScorecardData(
    filters.departments,
    filters.teams,
    filters.members,
    dateRange.start,
    dateRange.end
  );

  const { data: historicalScores } = useHistoricalScores(
    filters.departments,
    filters.teams,
    filters.members,
    dateRange,
    filters.dateRange
  );

  const handleFiltersChange = (nextFilters) => {
    if (isManager || isCoach) {
      setFilters({
        ...nextFilters,
        teams: teamId ? [teamId] : [],
      });
      return;
    }
    setFilters(nextFilters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFiltersResetSignal(prev => prev + 1);
  };

  const handleExport = () => {
    if (!canExport) return;
    if (!loading && !error) {
      exportAnalyticsToCSV(data, aggregateKPIs, filters);
    }
  };

  const quickRanges = ['This Week', 'Last Week', 'This Month', 'Last Month', 'All Time'];
  const applyQuickRange = (range) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  };

  const tabs = useMemo(() => ([
    { id: 'overview', label: 'Overview' },
    { id: 'score-trends', label: 'Score Trends' },
    ...(!isPowerUser ? [{ id: 'team-rankings', label: isAdmin ? 'Team Rankings' : 'Rep Rankings' }] : []),
    { id: 'kpi-attainment', label: 'KPI Attainment' },
    { id: 'watchdog', label: 'KPI Watchdog' },
    { id: 'engage', label: 'Engage' },
  ]), [isAdmin, isPowerUser]);

  // Calculate aggregate KPI metrics from filtered data
  const aggregateKPIs = useMemo(() => {
    if (!data.rows.length) return { totalCalls: 0, totalMeetings: 0, totalTalkTime: 0 };
    
    let totalCalls = 0;
    let totalMeetings = 0;
    let totalTalkTime = 0;

    data.rows.forEach(row => {
      totalCalls += row.kpis.call_connects?.value || 0;
      totalMeetings += row.kpis.meetings?.value || 0;
      totalTalkTime += row.kpis.talk_time_minutes?.value || 0;
    });

    return {
      totalCalls: Math.round(totalCalls),
      totalMeetings: Math.round(totalMeetings),
      totalTalkTime: Math.round(totalTalkTime)
    };
  }, [data]);

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
      const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    const result = allKeys.map((key) => {
      const avgPct = Math.round(
        data.rows.reduce((sum, row) => sum + (row.kpis[key]?.percentage || 0), 0) / data.rows.length
      );
      return {
        name: labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        key,
        score: avgPct,
        hasData: data.rows.some(row => row.kpis[key]?.value > 0),
      };
    });
    return result.sort((a, b) => b.score - a.score);
  }, [data.rows, allKpiMetrics]);

  const topMovers = useMemo(() => {
    if (!data.rows.length) return [];
    const sorted = [...data.rows].sort((a, b) => b.apptivityScore - a.apptivityScore);
    const top = sorted.slice(0, 3).map(r => ({ ...r, trend: 'Top' }));
    const bottom = sorted.slice(-3).reverse().map(r => ({ ...r, trend: 'Needs Focus' }));
    return [...top, ...bottom];
  }, [data.rows]);

  useEffect(() => {
    if (!data.rows.length) return;
    const callsTarget = data.rows.length * 50;
    if (aggregateKPIs.totalCalls >= callsTarget) {
      addNotification({
        type: 'trend',
        title: 'Weekly trend win',
        message: 'Calls are above target for this period.',
        link: '/analytics',
        dedupeKey: `analytics-trend-${filters.dateRange}`,
      });
    }
  }, [aggregateKPIs.totalCalls, data.rows.length, filters.dateRange, addNotification]);

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

      // Search profiles/users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      window.location.reload();
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-blue-700">Analytics Dashboard</h1>
              <InfoTooltip text="Performance analytics across the selected timeframe and audience." />
            </div>
            <p className="text-gray-500 text-sm">Advanced reporting and insights</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{result.type}</span>
                          </div>
                          {result.subtitle && (
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate">{result.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            {/* Refresh Icon */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
              title="Refresh data"
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
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => { if (canConfigure) setConfigPanelOpen(true); }}
              onExportClick={handleExport}
              onNotificationsClick={openPanel}
              exportDisabled={loading || !canExport}
              configureDisabled={!canConfigure}
              notificationBadge={unreadCount}
              actions={[
                {
                  label: 'Export Report',
                  onClick: handleExport,
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
            <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">Quick date presets</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickRanges.map((range) => (
                    <button
                      key={range}
                      onClick={() => applyQuickRange(range)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        filters.dateRange === range
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setFiltersOpen(true)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                More Filters
              </button>
            </div>

            {data.rows.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <div className="text-gray-500 text-sm">No data for the selected filters.</div>
                <div className="text-xs text-gray-400 mt-1">Try expanding the date range or teams.</div>
              </div>
            )}

            {data.rows.length > 0 && (
              <>
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  footer={isAdmin && teamNamesInView.length > 0 ? (
                    <div className="text-[11px] text-gray-500">
                      Teams in view: {teamNamesInView.join(', ')}
                    </div>
                  ) : null}
                />
                {isPowerUser ? (
                  <TeamPerformanceChart
                    title="KPI Attainment (Avg %)"
                    infoText="Average KPI attainment across the selected audience and period."
                    data={kpiAttainmentData}
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
            )}

            {activeTab === 'score-trends' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HistoricalScoresChart
                  title="Apptivia Score Trends"
                  infoText="Weekly trend of average Apptivia score for the selected filters and date range."
                  data={historicalScores}
                />
                {isPowerUser ? (
                  <TeamPerformanceChart
                    title="KPI Attainment (Avg %)"
                    infoText="Average KPI attainment across the selected audience and period."
                    data={kpiAttainmentData}
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
            )}

            {activeTab === 'team-rankings' && !isPowerUser && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamPerformanceChart
                  title={isAdmin ? 'Team Performance Rankings' : 'Rep Performance Rankings'}
                  infoText={isAdmin
                    ? 'Ranked by average Apptivia score across each team.'
                    : 'Top reps ranked by Apptivia score for the selected filters.'
                  }
                  data={isAdmin ? teamPerformanceData : repPerformanceData}
                />
                <ScoreDistributionChart
                  title="Score Distribution"
                  infoText="Distribution of reps by scorecard performance buckets for the selected period."
                  data={[
                    { name: 'Excellent (>100%)', value: data.rows.filter(r => r.apptivityScore >= 100).length },
                    { name: 'Good (80-99%)', value: data.rows.filter(r => r.apptivityScore >= 80 && r.apptivityScore < 100).length },
                    { name: 'Needs Improvement (<80%)', value: data.rows.filter(r => r.apptivityScore < 80).length },
                  ]}
                />
              </div>
            )}

            {activeTab === 'kpi-attainment' && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">Summary Metrics</h2>
                  <InfoTooltip text="Totals of key activities for the selected filters and date range." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Total Calls</div>
                    <div className="text-base font-bold text-blue-600">{aggregateKPIs.totalCalls.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">Across all team members</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Total Meetings</div>
                    <div className="text-base font-bold text-green-600">{aggregateKPIs.totalMeetings.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">Booked in {filters.dateRange}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Total Talk Time</div>
                    <div className="text-base font-bold text-purple-600">{aggregateKPIs.totalTalkTime.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">Minutes of conversation</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <TeamPerformanceChart
                    title="KPI Attainment (Avg %)"
                    infoText="Average KPI attainment across all active KPIs for the selected audience and period."
                    data={kpiAttainmentData}
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
                    <h3 className="text-sm font-semibold text-gray-900">All KPI Details</h3>
                    <InfoTooltip text="Detailed view of every active KPI metric — including those not shown on the scorecard." />
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{allKpiMetrics.length} KPIs</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-100">
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
                            <tr key={metric.key} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-gray-900">{metric.name}</div>
                                {metric.description && <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[200px]">{metric.description}</div>}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-xs text-gray-500 capitalize">{(metric.category || 'general').replace(/_/g, ' ')}</span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-gray-700">
                                {metric.goal}{metric.unit === 'percent' ? '%' : metric.unit === 'minutes' ? ' min' : ''}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-gray-700">{avgValue}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        avgPct >= 100 ? 'bg-emerald-500' : avgPct >= 80 ? 'bg-yellow-500' : 'bg-red-400'
                                      }`}
                                      style={{ width: `${Math.min(avgPct, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`font-bold ${
                                    avgPct >= 100 ? 'text-emerald-600' : avgPct >= 80 ? 'text-yellow-600' : 'text-red-500'
                                  }`}>
                                    {avgPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {metric.show_on_scorecard ? (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Yes</span>
                                ) : (
                                  <span className="text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">No</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                  avgPct >= 100 ? 'bg-emerald-50 text-emerald-700' :
                                  avgPct >= 80 ? 'bg-yellow-50 text-yellow-700' :
                                  avgPct > 0 ? 'bg-red-50 text-red-600' :
                                  'bg-gray-50 text-gray-400'
                                }`}>
                                  {avgPct >= 100 ? 'Exceeding' : avgPct >= 80 ? 'On Track' : avgPct > 0 ? 'Needs Focus' : 'No Data'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {allKpiMetrics.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">No KPI metrics configured yet.</div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'watchdog' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={18} className="text-red-500" />
                  <h2 className="text-sm font-semibold text-gray-900">KPI Anomaly Watchdog</h2>
                  <InfoTooltip text="Automatically detect KPI drops, trigger coaching recommendations, and track resolution." />
                </div>
                <KpiWatchdog
                  organizationId={watchdogProfile?.organization_id || user?.organization_id || ''}
                  userId={user?.id}
                />
              </div>
            )}

            {activeTab === 'engage' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Radar size={18} className="text-cyan-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Engage Analytics</h2>
                  <InfoTooltip text="Performance metrics from Apptivia Engage — sequences, accounts, playbooks, and signals." />
                </div>
                {engageLoading && <div className="text-center py-8 text-sm text-gray-500">Loading Engage data...</div>}
                {!engageLoading && !engageStats && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <div className="text-gray-500 text-sm">No Engage data found.</div>
                    <div className="text-xs text-gray-400 mt-1">Start using Engage to see analytics here.</div>
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
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-cyan-500">
                        <div className="text-xs text-gray-500">Sequences</div>
                        <div className="text-lg font-bold text-cyan-600">{engageStats.totalSequences}</div>
                        <div className="text-[11px] text-gray-400">{engageStats.activeSequences} active</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500">
                        <div className="text-xs text-gray-500">Enrolled</div>
                        <div className="text-lg font-bold text-blue-600">{engageStats.totalEnrolled}</div>
                        <div className="text-[11px] text-gray-400">{engageStats.replyRate}% reply rate</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-purple-500">
                        <div className="text-xs text-gray-500">Accounts</div>
                        <div className="text-lg font-bold text-purple-600">{engageStats.totalAccounts}</div>
                        <div className="text-[11px] text-gray-400">Avg score: {engageStats.avgAccountScore}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
                        <div className="text-xs text-gray-500">Playbooks</div>
                        <div className="text-lg font-bold text-green-600">{engageStats.totalPlaybooks}</div>
                        <div className="text-[11px] text-gray-400">{engageStats.completedExecutions} executed</div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {engageStats.sequencePerformance.length > 0 && (
                        <EngageBarChart
                          title="Sequences by Status"
                          infoText="Breakdown of outreach sequences by current status."
                          data={engageStats.sequencePerformance}
                        />
                      )}
                      {engageStats.accountTiers.length > 0 && (
                        <EngageBarChart
                          title="Accounts by Tier"
                          infoText="Account intelligence records grouped by tier level."
                          data={engageStats.accountTiers}
                        />
                      )}
                    </div>

                    {/* Detailed Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-2 font-semibold">Sequence Metrics</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-gray-600">Total Enrolled</span><span className="font-medium">{engageStats.totalEnrolled}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Total Replied</span><span className="font-medium text-green-600">{engageStats.totalReplied}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Reply Rate</span><span className="font-medium text-blue-600">{engageStats.replyRate}%</span></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-2 font-semibold">Account Tiers</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-gray-600">Tier 1</span><span className="font-medium text-purple-600">{engageStats.tier1}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Tier 2</span><span className="font-medium text-blue-600">{engageStats.tier2}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Tier 3</span><span className="font-medium text-gray-600">{engageStats.tier3}</span></div>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-2 font-semibold">Playbook Outcomes</div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between"><span className="text-gray-600">Active Playbooks</span><span className="font-medium">{engageStats.activePlaybooks}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Executions</span><span className="font-medium">{engageStats.totalExecutions}</span></div>
                          <div className="flex justify-between"><span className="text-gray-600">Meetings Booked</span><span className="font-medium text-green-600">{engageStats.meetingsBooked}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Links */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-100">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Quick Links</div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-cyan-700 rounded-lg border border-cyan-200 hover:bg-cyan-50 transition-colors">Pipeline Operator</button>
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors">Signal Prospecting</button>
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors">Accounts</button>
                        <button onClick={() => navigate('/engage')} className="px-3 py-1.5 bg-white text-xs font-medium text-green-700 rounded-lg border border-green-200 hover:bg-green-50 transition-colors">Playbooks</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
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
                        <tr className="text-left text-gray-500">
                          <th className="py-2 w-1/4">Rep</th>
                          <th className="py-2 w-1/4">Score</th>
                          <th className="py-2 w-1/4">Delta to 80%</th>
                          <th className="py-2 w-1/4">Bucket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topMovers.map((row) => (
                          <tr key={`${row.profile_id}-${row.trend}`} className="border-t">
                            <td className="py-2 w-1/4 font-medium text-gray-900 truncate">{row.name}</td>
                            <td className="py-2 w-1/4">
                              <span className={`font-semibold ${row.apptivityScore >= 100 ? 'text-green-600' : row.apptivityScore >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {row.apptivityScore}%
                              </span>
                            </td>
                            <td className="py-2 w-1/4 text-gray-600">{row.apptivityScore - 80 > 0 ? `+${row.apptivityScore - 80}` : row.apptivityScore - 80}%</td>
                            <td className="py-2 w-1/4 text-gray-500">{row.trend}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Performers List */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-semibold">🏆 Top Performers</h3>
                    <InfoTooltip text="Top reps by Apptivia score for the selected period." />
                  </div>
                  <div className="space-y-3">
                    {data.rows.slice(0, 5).map((performer, i) => (
                      <div key={performer.profile_id} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-white rounded-lg p-3 transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center gap-4">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold ${
                            i === 0 ? 'bg-yellow-100 text-yellow-600' :
                            i === 1 ? 'bg-gray-100 text-gray-600' :
                            i === 2 ? 'bg-orange-100 text-orange-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{performer.name}</div>
                            <div className="text-xs text-gray-500">
                              {Math.round(performer.kpis.call_connects?.value || 0)} calls • 
                              {Math.round(performer.kpis.meetings?.value || 0)} meetings
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            performer.apptivityScore >= 100 ? 'text-green-600' :
                            performer.apptivityScore >= 80 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {performer.apptivityScore}%
                          </div>
                          <div className="text-xs text-gray-500">Apptivia Score</div>
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
              onFilterChange={handleFiltersChange}
              initialFilters={defaultFilters}
              resetSignal={filtersResetSignal}
              restrictToTeams={(isManager || isCoach) && teamId ? [teamId] : undefined}
            />
      </RightFilterPanel>
      <ScheduleReportModal
        isOpen={showScheduleReportModal}
        onClose={() => setShowScheduleReportModal(false)}
        onSuccess={() => {
          addNotification({
            type: 'success',
            title: 'Report Scheduled',
            message: 'Your report has been scheduled successfully',
            dedupeKey: 'report-scheduled',
          });
        }}
      />
    </DashboardLayout>
  );
}
