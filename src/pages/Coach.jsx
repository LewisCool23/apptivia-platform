import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import ScorecardFilters from '../components/ScorecardFilters';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import { useCoachData } from '../hooks/useCoachData';
import { useScorecardData } from '../hooks/useScorecardData';
import { useHistoricalScores } from '../hooks/useHistoricalScores';
import { calcPct } from '../utils/kpiCalc';
import { exportCoachDataToCSV } from '../utils/exportUtils';
import { exportCoachToPDF } from '../utils/exportPdf';
import ExportReportModal from '../components/ExportReportModal';
import ScheduleReportModal from '../components/ScheduleReportModal';
import { ROLES } from '../constants/roles';
import ConfigureModal from '../components/ConfigureModal';
import ConfigurePanel from '../components/ConfigurePanel';
import SkillsetDetailsModal from '../components/SkillsetDetailsModal';
import { SkillsetCardSkeleton } from '../components/Skeleton';
import Tooltip from '../components/shared/Tooltip';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../AuthContext';
import { LEVELS, getLevelInfo, getEffectiveLevel, getSkillsetLevel, SKILLSET_LEVEL_COLORS } from '../constants/skillsets';
import InfoTooltip from '../components/InfoTooltip';
import ApptiviaLevelInfoModal from '../components/ApptiviaLevelInfoModal';
import DataDrivenPlaybook from '../components/DataDrivenPlaybook';
import ShareCoachSnapshotModal from '../components/ShareCoachSnapshotModal';
import RequestCoachingPlanModal from '../components/coaching/RequestCoachingPlanModal';
import PlanDetailModal from '../components/coaching/PlanDetailModal';
import IdpDetailModal from '../components/coaching/IdpDetailModal';
import ReviewDetailModal from '../components/coaching/ReviewDetailModal';
import ConfirmModal from '../components/ConfirmModal';
import CreateRepPlanModal from '../components/coaching/CreateRepPlanModal';
import CreateReviewModal from '../components/coaching/CreateReviewModal';
import { supabase } from '../supabaseClient';
import { KPI_GUIDANCE, LAGGING_THRESHOLD, buildLabel } from '../constants/kpiGuidance';
import { scoreTextColor } from '../constants/scoreColors';
import FeedbackThumb from '../components/shared/FeedbackThumb';

export default function Coach() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const isManager = role === ROLES.MANAGER;
  const isCoach = role === ROLES.COACH;
  const isPowerUser = role === ROLES.POWER_USER;
  const isAdmin = role === ROLES.ADMIN;
  const canConfigure = hasPermission('configure_scorecard');
  const canExport = hasPermission('export_data');

  const defaultFilters = React.useMemo(() => {
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
    if (isPowerUser) {
      return {
        dateRange: 'This Week',
        departments: [],
        teams: [],
        members: userId ? [userId] : [],
      };
    }
    return {
      dateRange: 'This Week',
      departments: [],
      teams: [],
      members: [],
    };
  }, [isAdmin, isManager, isCoach, isPowerUser, teamId, userId]);

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [selectedSkillset, setSelectedSkillset] = useState(null);
  const [highlightAchievement, setHighlightAchievement] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersResetSignal, setFiltersResetSignal] = useState(0);
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const toast = useToast();
  const [loadFullData, setLoadFullData] = useState(false);
  const deepLinkHandled = React.useRef(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  // Power user profile data derived from useCoachData (no separate fetch needed)
  const [userProfile, setUserProfile] = useState(null);
  const [userAchievementCount, setUserAchievementCount] = useState(0);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestPlanOpen, setRequestPlanOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Performance Insights: 5-week per-KPI trends for power users
  const [kpiTrends, setKpiTrends] = useState(null); // { kpiKey: { weeks: [{week, value, pct}], currentPct, trend } }
  const [kpiTrendsLoading, setKpiTrendsLoading] = useState(false);
  // Active Coaching Plans for power users (loaded via coaching_plan_assignments)
  const [activePlans, setActivePlans] = useState([]);
  const [activePlansLoading, setActivePlansLoading] = useState(false);
  const [myAssignments, setMyAssignments] = useState({});
  const [completedPlans, setCompletedPlans] = useState([]);
  const [completedPlansOpen, setCompletedPlansOpen] = useState(false);
  const [viewPlanDetail, setViewPlanDetail] = useState(null);
  const [insightsSection, setInsightsSection] = useState(null); // 'trends' | 'suggestions' | 'plans' | 'idps' | 'reviews' | null
  // My Development Plans (IDPs) for power users
  const [myIdps, setMyIdps] = useState([]);
  const [myIdpsLoading, setMyIdpsLoading] = useState(false);
  // My Performance Reviews for power users
  const [myReviews, setMyReviews] = useState([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [viewIdpDetail, setViewIdpDetail] = useState(null);
  const [viewReviewDetail, setViewReviewDetail] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [idpCompletionPrompt, setIdpCompletionPrompt] = useState({ isOpen: false, idp: null });
  const [buildPlanFor, setBuildPlanFor] = useState(null); // { repId, repName }
  const [startReviewFor, setStartReviewFor] = useState(null); // { repId, repName }
  const [managerTeamMembers, setManagerTeamMembers] = useState([]);

  useEffect(() => {
    if (filtersInitialized) return;
    if (!userId) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, userId]);

  const orgId = profile?.organization_id;

  const { data: summaryData, loading: summaryLoading, error: summaryError } = useCoachData(
    filters.departments,
    filters.teams,
    filters.members,
    { mode: 'summary', refreshTrigger, organizationId: orgId }
  );

  const { data: fullData, loading: fullLoading, error: fullError } = useCoachData(
    filters.departments,
    filters.teams,
    filters.members,
    { mode: 'full', enabled: loadFullData, refreshTrigger, organizationId: orgId }
  );

  const data = fullData?.skillsets?.length ? fullData : summaryData;
  const loading = summaryLoading || (loadFullData && fullLoading);
  const error = summaryError || fullError;

  // Derive power user profile data from useCoachData instead of separate fetch
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    if (!data?.profiles?.length) return;
    const match = data.profiles.find(p => String(p.id) === String(userId));
    if (match) {
      setUserProfile(match);
      // Sum achievements from individual skillset cards for accuracy
      // (totalAchievements may use stale profile_skillsets data)
      const skillsetTotal = (data.skillsets || []).reduce((sum, s) => sum + (s.achievements_completed || 0), 0);
      setUserAchievementCount(skillsetTotal || data.totalAchievements || 0);
    }
  }, [isPowerUser, userId, data]);

  // Compute next level name for progress text (avoids repeating in JSX)
  const nextLevelLabel = React.useMemo(() => {
    if (!data?.avgLevel) return null;
    const idx = LEVELS.findIndex(l => l.label === data.avgLevel);
    return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1].label : null;
  }, [data?.avgLevel]);

  const dateRange = React.useMemo(() => {
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
      default: {
        // Handle "Custom Week|YYYY-MM-DD" encoded format from ScorecardFilters
        if (filters.dateRange && filters.dateRange.startsWith('Custom Week|')) {
          const mondayStr = filters.dateRange.split('|')[1];
          const monday = new Date(mondayStr + 'T00:00:00');
          const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
          return { start: monday.toISOString(), end: sunday.toISOString() };
        }
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
    }
  }, [filters.dateRange]);

  const { data: scorecardData } = useScorecardData(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    dateRange.start,
    dateRange.end,
    refreshTrigger
  );

  // Last week's scorecard data — used by the coaching playbook as fallback
  // when the current week has no data yet (e.g., early Monday morning).
  const lastWeekRange = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const lastMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 13 : dayOfWeek + 6) * 24 * 60 * 60 * 1000);
    const lastSunday = new Date(lastMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { start: lastMonday.toISOString(), end: lastSunday.toISOString() };
  }, []);

  const { data: lastWeekScorecardData } = useScorecardData(
    orgId,
    filters.departments,
    filters.teams,
    filters.members,
    lastWeekRange.start,
    lastWeekRange.end,
    refreshTrigger
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

  const audienceLabel = (() => {
    if (isPowerUser) return 'My Progress';
    if (filters.members.length > 0) return 'Selected Members';
    if (filters.teams.length > 0) return 'Selected Team';
    if (filters.departments.length > 0) return 'Selected Department';
    return 'All Members';
  })();

  const handleFiltersChange = (nextFilters) => {
    if (isPowerUser) {
      setFilters({
        ...nextFilters,
        members: userId ? [userId] : [],
      });
      return;
    }
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

  const [showExportModal, setShowExportModal] = useState(false);
  const [showScheduleReportModal, setShowScheduleReportModal] = useState(false);

  const handleExportFormat = (format) => {
    if (!canExport || loading || error) return;
    if (format === 'csv') {
      exportCoachDataToCSV(data, filters);
    } else if (format === 'pdf') {
      exportCoachToPDF(data, filters);
    }
  };

  const buildSnapshotBody = () => {
    const lines = [];
    lines.push('Apptivia Coach Snapshot');
    lines.push(`Filters: ${filters.dateRange} • ${filters.departments.length || 'All'} Depts • ${filters.teams.length || 'All'} Teams • ${filters.members.length || 'All'} Members`);
    lines.push('');
    lines.push('Summary:');
    lines.push(`• Apptivia Level: ${isPowerUser && userProfile ? userProfile.apptivia_level : data.avgLevel}`);
    lines.push(`• Level Points: ${isPowerUser && userProfile ? userProfile.total_points : data.avgPoints}`);
    lines.push(`• Average Score: ${data.avgScore}%`);
    lines.push(`• Scorecard Streak: ${data.scorecardStreak} periods`);
    lines.push(`• Badges: ${data.totalBadges}`);
    lines.push(`• Achievements: ${isPowerUser ? userAchievementCount : data.totalAchievements}`);
    lines.push('');
    lines.push('Skillset Progress:');
    (data.skillsets || []).forEach(skillset => {
      lines.push(`• ${skillset.skillset_name}: ${skillset.progress}% (${skillset.achievements_completed} achievements)`);
    });
    lines.push('');
    if (snapshotNotes.trim()) {
      lines.push('Notes:');
      lines.push(snapshotNotes.trim());
      lines.push('');
    }
    lines.push('Generated from Apptivia Coach.');
    return lines.join('\n');
  };

  const canShareSnapshot = isAdmin || isManager || isPowerUser;

  useEffect(() => {
    if (summaryLoading || summaryError) return;
    if (!loadFullData) setLoadFullData(true);
  }, [summaryLoading, summaryError, loadFullData]);

  useEffect(() => {
    if (loading || error) return;
    if (data?.scorecardStreak >= 5) {
      addNotification({
        type: 'streak',
        title: 'Scorecard streak',
        message: `Average scorecard streak is ${data.scorecardStreak} periods.`,
        link: '/coach',
        dedupeKey: `coach-streak-${filters.dateRange}-${data.scorecardStreak}`,
      });
    }
  }, [loading, error, data, filters.dateRange, addNotification]);

  useEffect(() => {
    if (loading || error) return;
    if (deepLinkHandled.current) return;

    const params = new URLSearchParams(location.search);
    const skillsetIdParam = params.get('skillsetId');
    const skillsetNameParam = params.get('skillset');
    const achievementParam = params.get('achievement');

    if (!skillsetIdParam && !skillsetNameParam) return;

    const match = skillsetIdParam
      ? data.skillsets.find(s => String(s.skillset_id) === String(skillsetIdParam))
      : data.skillsets.find(s => s.skillset_name?.toLowerCase?.() === skillsetNameParam?.toLowerCase?.());

    if (!match) return;

    setSelectedSkillset({ id: match.skillset_id, name: match.skillset_name, color: match.color });
    setHighlightAchievement(achievementParam);
    deepLinkHandled.current = true;
  }, [loading, error, data.skillsets, location.search]);

  // Fetch 5-week per-KPI trends for power user Performance Insights
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    let cancelled = false;
    const fetchKpiTrends = async () => {
      setKpiTrendsLoading(true);
      try {
        // Get active scorecard KPIs (current config as fallback)
        const { data: kpiDefs } = await supabase
          .from('kpi_metrics')
          .select('id, key, name, goal, weight, direction')
          .eq('is_active', true)
          .eq('show_on_scorecard', true)
          .order('scorecard_position');
        if (!kpiDefs || kpiDefs.length === 0 || cancelled) { setKpiTrends(null); return; }

        // Get Monday of LAST week (exclude current incomplete week)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = today.getDay();
        const currentMonday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86400000);
        const lastMonday = new Date(currentMonday.getTime() - 7 * 86400000);

        // Fetch 5 previous completed weeks of KPI values (excludes current week)
        const fiveWeeksAgoMonday = new Date(lastMonday.getTime() - 4 * 7 * 86400000);

        // Fetch historical config covering the 5-week range
        const kpiIds = kpiDefs.map(k => k.id);
        const [{ data: vals }, { data: historyRows }] = await Promise.all([
          supabase
            .from('kpi_values')
            .select('value, kpi_id, period_start')
            .eq('profile_id', userId)
            .in('kpi_id', kpiIds)
            .gte('period_start', fiveWeeksAgoMonday.toISOString().split('T')[0])
            .lte('period_start', lastMonday.toISOString().split('T')[0]),
          supabase
            .from('kpi_metric_history')
            .select('kpi_id, goal, weight, direction, valid_from, valid_to')
            .in('kpi_id', kpiIds)
            .lte('valid_from', now.toISOString())
            .or(`valid_to.is.null,valid_to.gte.${fiveWeeksAgoMonday.toISOString()}`),
        ]);
        if (cancelled) return;

        // Historical config resolver
        function getConfigAt(kpiId, atDate) {
          const dt = typeof atDate === 'string' ? new Date(atDate) : atDate;
          const match = (historyRows || []).find(h =>
            h.kpi_id === kpiId &&
            new Date(h.valid_from) <= dt &&
            (h.valid_to === null || new Date(h.valid_to) > dt)
          );
          if (match) return { goal: match.goal, weight: match.weight, direction: match.direction || 'higher' };
          const fb = kpiDefs.find(m => m.id === kpiId);
          return fb ? { goal: fb.goal, weight: fb.weight, direction: fb.direction || 'higher' } : { goal: 1, weight: 1, direction: 'higher' };
        }

        // Build per-KPI weekly data — 5 completed weeks ending at lastMonday
        const trends = {};
        kpiDefs.forEach(metric => {
          const weeklyData = [];
          for (let i = 4; i >= 0; i--) {
            const wStart = new Date(lastMonday.getTime() - i * 7 * 86400000);
            const wEnd = new Date(wStart.getTime() + 6 * 86400000);
            const wStartStr = wStart.toISOString().split('T')[0];
            const weekLabel = `${wEnd.getMonth() + 1}/${wEnd.getDate()}`;
            // Sum values for this week
            const weekVal = (vals || [])
              .filter(v => v.kpi_id === metric.id && v.period_start === wStartStr)
              .reduce((s, v) => s + (v.value || 0), 0);
            // Use historical config for this week
            const cfg = getConfigAt(metric.id, wEnd);
            const dir = cfg.direction || 'higher';
            const pct = Math.round(calcPct(weekVal, cfg.goal, dir));
            weeklyData.push({ week: weekLabel, value: Math.round(weekVal * 10) / 10, pct });
          }
          const latestPct = weeklyData[weeklyData.length - 1]?.pct || 0;
          const prevPct = weeklyData.length >= 2 ? weeklyData[weeklyData.length - 2]?.pct || 0 : 0;
          const trendDelta = latestPct - prevPct;
          const avgPct = weeklyData.length > 0 ? Math.round(weeklyData.reduce((s, w) => s + (w.pct || 0), 0) / weeklyData.length) : 0;
          // Use latest week's historical config for display
          const latestCfg = getConfigAt(metric.id, new Date(lastMonday.getTime() + 6 * 86400000));
          trends[metric.key] = {
            name: metric.name,
            goal: latestCfg.goal,
            weight: latestCfg.weight,
            weeks: weeklyData,
            currentPct: latestPct,
            avgPct,
            trendDelta,
            direction: trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat',
          };
        });
        if (!cancelled) setKpiTrends(trends);
      } catch (err) {
        console.error('Error fetching KPI trends:', err);
        if (!cancelled) setKpiTrends(null);
      } finally {
        if (!cancelled) setKpiTrendsLoading(false);
      }
    };
    fetchKpiTrends();
    return () => { cancelled = true; };
  }, [isPowerUser, userId, refreshTrigger]);

  // Fetch coaching plans assigned to this power user via coaching_plan_assignments
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    let cancelled = false;
    const fetchPlans = async () => {
      setActivePlansLoading(true);
      try {
        // Step 1: Get all assignments for this user
        const { data: assignments } = await supabase
          .from('coaching_plan_assignments')
          .select('plan_id, status, baseline_kpi_snapshot, final_kpi_snapshot, effectiveness_score, completed_at')
          .eq('assigned_to', userId)
          .in('status', ['active', 'in_progress', 'completed', 'cancelled']);

        if (!assignments?.length || cancelled) {
          if (!cancelled) { setActivePlans([]); setCompletedPlans([]); setMyAssignments({}); }
          return;
        }

        // Build assignment lookup
        const assignmentMap = {};
        assignments.forEach(a => { assignmentMap[a.plan_id] = a; });
        const planIds = assignments.map(a => a.plan_id);

        // Step 2: Fetch plan details
        const { data: plans } = await supabase
          .from('coaching_plans')
          .select('id, name, focus_kpis, action_items, success_metrics, goals, notes, content, visibility, date_range_start, date_range_end, assigned_to, created_at, plan_type')
          .in('id', planIds)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        // Step 3: Separate active vs completed
        const active = [];
        const completed = [];
        (plans || []).forEach(plan => {
          const assignment = assignmentMap[plan.id];
          if (!assignment) return;
          const enriched = { ...plan, _assignment: assignment };
          if (assignment.status === 'completed' || assignment.status === 'cancelled') {
            completed.push(enriched);
          } else {
            active.push(enriched);
          }
        });

        setActivePlans(active);
        setCompletedPlans(completed);
        setMyAssignments(assignmentMap);
      } catch (err) {
        console.error('Error fetching coaching plans:', err);
        if (!cancelled) { setActivePlans([]); setCompletedPlans([]); setMyAssignments({}); }
      } finally {
        if (!cancelled) setActivePlansLoading(false);
      }
    };
    fetchPlans();
    return () => { cancelled = true; };
  }, [isPowerUser, userId, refreshTrigger]);

  // Fetch IDPs assigned to this power user
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    let cancelled = false;
    const fetchIdps = async () => {
      setMyIdpsLoading(true);
      try {
        let idpQuery = supabase
          .from('individual_development_plans')
          .select('id, name, description, plan_type, status, period_start, period_end, focus_kpis, milestones, career_goals, development_areas, action_items, resources, success_criteria, notes, baseline_kpi_snapshot, created_at')
          .eq('profile_id', userId)
          .in('status', ['draft', 'active', 'in_progress', 'completed'])
          .order('created_at', { ascending: false });
        if (orgId) idpQuery = idpQuery.eq('organization_id', orgId);
        const { data } = await idpQuery;
        if (!cancelled) setMyIdps(data || []);
      } catch (err) {
        console.error('Error fetching IDPs:', err);
        if (!cancelled) setMyIdps([]);
      } finally {
        if (!cancelled) setMyIdpsLoading(false);
      }
    };
    fetchIdps();
    return () => { cancelled = true; };
  }, [isPowerUser, userId, refreshTrigger]);

  // Fetch performance reviews for this power user
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    let cancelled = false;
    const fetchReviews = async () => {
      setMyReviewsLoading(true);
      try {
        let reviewQuery = supabase
          .from('performance_reviews')
          .select('*')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false });
        if (orgId) reviewQuery = reviewQuery.eq('organization_id', orgId);
        const { data } = await reviewQuery;
        if (!cancelled) setMyReviews(data || []);
      } catch (err) {
        console.error('Error fetching reviews:', err);
        if (!cancelled) setMyReviews([]);
      } finally {
        if (!cancelled) setMyReviewsLoading(false);
      }
    };
    fetchReviews();
    return () => { cancelled = true; };
  }, [isPowerUser, userId, refreshTrigger]);

  // Fetch team members for manager actions (Build Plan, Start Review modals)
  useEffect(() => {
    if (!isManager && !isAdmin) return;
    let cancelled = false;
    const teamFilter = profile?.team_id;
    supabase.from('profiles')
      .select('id, first_name, last_name, email, full_name, role, team_id')
      .eq('organization_id', profile?.organization_id)
      .then(({ data, error }) => {
        if (cancelled || error) {
          if (error) console.error('Error loading team members:', error);
          return;
        }
        if (!data) return;
        const members = isAdmin ? data : data.filter(m => m.team_id === teamFilter);
        setManagerTeamMembers(members);
      });
    return () => { cancelled = true; };
  }, [isManager, isAdmin, profile?.organization_id, profile?.team_id]);

  // IDP milestone toggle from detail modal
  const handleIdpMilestoneToggle = async (milestoneIdx, newStatus) => {
    if (!viewIdpDetail) return;
    const updated = [...(viewIdpDetail.milestones || [])];
    updated[milestoneIdx] = { ...updated[milestoneIdx], status: newStatus };
    const { error } = await supabase.from('individual_development_plans')
      .update({ milestones: updated, updated_at: new Date().toISOString() })
      .eq('id', viewIdpDetail.id);
    if (error) { toast.error('Milestone update failed'); return; }
    const updatedIdp = { ...viewIdpDetail, milestones: updated };
    setViewIdpDetail(updatedIdp);
    setMyIdps(prev => prev.map(p => p.id === viewIdpDetail.id ? { ...p, milestones: updated } : p));
    // Prompt to complete IDP when all milestones are done
    const allCompleted = updated.length > 0 && updated.every(m => m.status === 'completed');
    if (allCompleted && viewIdpDetail.status !== 'completed' && viewIdpDetail.status !== 'cancelled') {
      setIdpCompletionPrompt({ isOpen: true, idp: updatedIdp });
    }
  };

  // Review: self-assessment submission (rep submits → status moves to self_assessment_submitted)
  const handleReviewTransition = async (newStatus, extraData = {}) => {
    if (!viewReviewDetail) return;
    setReviewSaving(true);
    try {
      const updates = { status: newStatus, updated_at: new Date().toISOString(), ...extraData };
      if (newStatus === 'self_assessment_submitted') updates.self_assessment_submitted_at = new Date().toISOString();
      if (newStatus === 'acknowledged') updates.acknowledged_at = new Date().toISOString();
      const { error } = await supabase.from('performance_reviews').update(updates).eq('id', viewReviewDetail.id);
      if (error) throw error;
      toast.success(`Review status updated to ${newStatus.replace(/_/g, ' ')}`);
      setViewReviewDetail(prev => prev ? { ...prev, ...updates } : null);
      // Refresh list
      setMyReviews(prev => prev.map(r => r.id === viewReviewDetail.id ? { ...r, ...updates } : r));
    } catch (err) {
      toast.error('Transition failed: ' + err.message);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReviewAcknowledge = async (comment) => {
    await handleReviewTransition('acknowledged', { acknowledgment_comment: comment || null });
  };

  // Handle power user changing their own assignment status (active → in_progress → completed)
  const handlePowerUserStatusChange = async (plan, newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    // Snapshot final KPIs and compute effectiveness when completing
    if (newStatus === 'completed' && plan.focus_kpis?.length > 0) {
      try {
        const { data: metrics } = await supabase
          .from('kpi_metrics')
          .select('id, key, goal, direction')
          .in('key', plan.focus_kpis)
          .eq('is_active', true);
        if (metrics?.length > 0) {
          const metricIds = metrics.map(m => m.id);
          const now = new Date();
          const weekEnd = now.toISOString().split('T')[0];
          const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
          // Fetch historical config for current period
          const { data: histRows } = await supabase
            .from('kpi_metric_history')
            .select('kpi_id, goal, direction, valid_from, valid_to')
            .in('kpi_id', metricIds)
            .lte('valid_from', now.toISOString())
            .or(`valid_to.is.null,valid_to.gte.${now.toISOString()}`);
          function getGoalAndDir(metricId) {
            const h = (histRows || []).find(r => r.kpi_id === metricId && new Date(r.valid_from) <= now && (r.valid_to === null || new Date(r.valid_to) > now));
            if (h) return { goal: h.goal, dir: h.direction || 'higher' };
            const fb = metrics.find(m => m.id === metricId);
            return { goal: fb?.goal || 1, dir: fb?.direction || 'higher' };
          }
          const { data: vals } = await supabase
            .from('kpi_values')
            .select('kpi_id, value')
            .eq('profile_id', userId)
            .in('kpi_id', metricIds)
            .lte('period_start', weekEnd)
            .gte('period_end', weekStart);
          const finalSnapshot = {};
          for (const m of metrics) {
            const val = (vals || []).filter(v => v.kpi_id === m.id).reduce((s, v) => s + (v.value || 0), 0);
            const { goal, dir } = getGoalAndDir(m.id);
            const pct = Math.round(calcPct(val, goal, dir));
            finalSnapshot[m.key] = { value: val, pct };
          }
          const baseline = myAssignments[plan.id]?.baseline_kpi_snapshot || {};
          const deltas = plan.focus_kpis
            .filter(k => finalSnapshot[k] && baseline[k])
            .map(k => (finalSnapshot[k].pct || 0) - (baseline[k].pct || 0));
          const effScore = deltas.length > 0 ? Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null;
          updateData.final_kpi_snapshot = finalSnapshot;
          if (effScore != null) updateData.effectiveness_score = effScore;
        }
      } catch (effErr) {
        console.warn('Effectiveness snapshot failed:', effErr);
      }
    }

    const { error } = await supabase
      .from('coaching_plan_assignments')
      .update(updateData)
      .eq('plan_id', plan.id)
      .eq('assigned_to', userId);

    if (error) {
      console.error('Status update failed:', error);
      toast.error('Failed to update plan status');
      return;
    }

    // Update local state — use functional updater to avoid stale closure
    let latestAssignment;
    setMyAssignments(prev => {
      latestAssignment = { ...prev[plan.id], ...updateData };
      return { ...prev, [plan.id]: latestAssignment };
    });
    if (newStatus === 'completed') {
      setActivePlans(prev => prev.filter(p => p.id !== plan.id));
      setCompletedPlans(prev => [{ ...plan, _assignment: latestAssignment || updateData }, ...prev]);
    } else {
      setActivePlans(prev => prev.map(p => p.id === plan.id
        ? { ...p, _assignment: { ...p._assignment, status: newStatus } }
        : p
      ));
    }
  };

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

      // Search profiles/users (org-scoped — mandatory)
      let profilesSearch = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (orgId) profilesSearch = profilesSearch.eq('organization_id', orgId);
      else { setSearching(false); return; }
      const { data: profiles } = await profilesSearch;

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

      // Search achievements (global structural definitions)
      const { data: achievements } = await supabase
        .from('achievements')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (achievements) {
        achievements.forEach((achievement) => {
          results.push({
            type: 'Achievement',
            title: achievement.name,
            subtitle: achievement.description,
            link: '/coach',
            icon: '🏆'
          });
        });
      }

      // Search skillsets (global structural definitions)
      const { data: skillsets } = await supabase
        .from('skillsets')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (skillsets) {
        skillsets.forEach((skillset) => {
          results.push({
            type: 'Skillset',
            title: skillset.name,
            subtitle: skillset.description,
            link: `/coach?skillset=${encodeURIComponent(skillset.name)}`,
            icon: '🎯'
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
      setRefreshTrigger(prev => prev + 1);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-apptivia-coral">Apptivia Coach</h1>
              <InfoTooltip text="Overview of coaching performance, mastery progress, and achievements for the selected audience." />
            </div>
            <p className="text-apptivia-carbon-500 text-sm">
              {isPowerUser ? 'Your personalized coaching insights and progress' : 'Personalized coaching insights and progress'}
            </p>
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
                className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            {/* Refresh Icon */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-apptivia-carbon-700 border border-gray-200 hover:bg-apptivia-paper group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
              /* tooltip handled by custom hover span below */
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
                ...(isAdmin || isManager || isCoach ? [{
                  label: 'View Coaching Plans',
                  onClick: () => navigate('/coaching-plans'),
                }] : []),
                ...(isPowerUser ? [{
                  label: 'Request Coaching Plan',
                  onClick: () => setRequestPlanOpen(true),
                }] : []),
                ...(canShareSnapshot ? [{
                  label: 'Share Snapshot',
                  onClick: () => setSnapshotOpen(true),
                }] : []),
              ]}
            />
          </div>
        </div>
        <div className="mb-6">
          {loading ? (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="bg-apptivia-carbon-200 rounded-lg px-6 py-6 flex-1 min-w-[300px] animate-pulse" style={{ height: '280px' }} />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Error: {error}</div>
          ) : (
            <div className="flex flex-wrap gap-4 items-stretch text-sm text-apptivia-carbon-600">
              {/* Main Level Card */}
              <div className={`bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg px-4 py-4 flex-1 min-w-[280px] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${data.levelProgress === 100 ? 'ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold">{data.avgLevel}</span>
                  {data.levelProgress === 100 && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[10px] font-bold animate-pulse">LEVEL UP!</span>
                  )}
                </div>
                <div className="text-xs mb-2 flex items-center gap-2">
                  {isPowerUser ? 'My Apptivia Level' : (filters.teams.length > 0 ? 'Current Team Apptivia Level' : 'Current Apptivia Level')}
                  <InfoTooltip
                    text="Activity data feeds the weekly scorecard. Consistent KPI attainment earns achievements and badges, which build skillset mastery and lead to Apptivia Level promotions over time."
                    iconClassName="text-white/80 hover:text-white"
                    onClick={() => setLevelInfoOpen(true)}
                    ariaLabel="Open Apptivia Level details"
                  />
                </div>

                {/* Level Distribution Chips (team/admin views) */}
                {!isPowerUser && data.profiles?.length > 1 && (() => {
                  const dist = {};
                  LEVELS.forEach(l => { dist[l.label] = 0; });
                  const skillsetProgresses = (data.skillsets || []).map(s => s.progress);
                  data.profiles.forEach(p => {
                    const lvl = getEffectiveLevel(p.total_points || 0, skillsetProgresses).level;
                    dist[lvl] = (dist[lvl] || 0) + 1;
                  });
                  const colors = { Developing: 'bg-orange-400', Intermediate: 'bg-apptivia-coral', Proficient: 'bg-emerald-400', Elite: 'bg-yellow-400', Master: 'bg-apptivia-ink' };
                  return (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.entries(dist).filter(([, count]) => count > 0).map(([label, count]) => (
                        <span key={label} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[label] || 'bg-apptivia-carbon-400'} text-white/90`}>
                          {count} {label}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between mb-2">
                  {/* Points with breakdown tooltip */}
                  <div className="relative group/pts">
                    <div className="text-lg font-bold cursor-help">{data.avgPoints || 0}</div>
                    <div className="text-xs">Level Points</div>
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover/pts:block z-50">
                      <div className="bg-apptivia-ink text-white text-[10px] rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <div className="font-semibold mb-1">Points Breakdown</div>
                        <div>Achievements: {isPowerUser ? userAchievementCount : data.totalAchievements} earned</div>
                        <div>Badges: {data.totalBadges} earned</div>
                        <div>Skillsets: {(data.skillsets || []).filter(s => s.progress >= 25).length} with milestones</div>
                      </div>
                    </div>
                  </div>
                  {nextLevelLabel ? (
                    <div className="text-right">
                      <div className="text-sm font-semibold opacity-90">Next: {nextLevelLabel}</div>
                      {data.pointsToNextLevel > 0 && (
                        <div className="text-xs opacity-70">{data.pointsToNextLevel.toLocaleString()} pts away</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="text-sm font-semibold opacity-90">Max Level</div>
                      <div className="text-xs opacity-70">All levels unlocked</div>
                    </div>
                  )}
                </div>
                <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-white transition-all duration-500 ease-out" style={{ width: `${Math.min(data.levelProgress, 100)}%` }}></div>
                </div>
                <div className="text-xs">
                  {data.cappedByBreadth
                    ? `Advance more skillsets to unlock ${nextLevelLabel || 'next level'}`
                    : nextLevelLabel
                      ? `Progress to ${nextLevelLabel} • ${data.levelProgress}%`
                      : 'Max Level Achieved'
                  }
                </div>
                <div className="w-full mt-4 pt-4 border-t border-white border-opacity-10 flex justify-between items-center">
                  <Tooltip text={isPowerUser ? "Your weighted average KPI attainment for the current period" : "Weighted average of all KPI attainment percentages for the current period"} position="right">
                    <div className="flex flex-col items-center min-w-[60px] cursor-help">
                      <div className="text-lg font-bold">{data.avgScore}%</div>
                      <div className="text-xs text-white/80">{isPowerUser ? 'Score' : 'Avg Score'}</div>
                    </div>
                  </Tooltip>
                  <Tooltip text="Consecutive weeks where the scorecard score reached 100% or higher" position="bottom">
                    <div className="flex flex-col items-center min-w-[60px] cursor-help">
                      <div className="text-lg font-bold">{data.scorecardStreak}</div>
                      <div className="text-xs text-white/80">100% Streak</div>
                    </div>
                  </Tooltip>
                  <Tooltip text={isPowerUser ? "Badges you've earned from volume, milestones, revenue, and scorecard excellence" : "Total badges earned across the team from volume, milestones, revenue, and scorecard excellence"} position="bottom">
                    <div className="flex flex-col items-center min-w-[60px] cursor-help">
                      <div className="text-lg font-bold">{data.totalBadges}</div>
                      <div className="text-xs text-white/80">Badges</div>
                    </div>
                  </Tooltip>
                  <Tooltip text={isPowerUser ? "Achievements you've earned across all skillsets" : "Total achievements earned across all skillsets and team members"} position="bottom">
                    <div className="flex flex-col items-center min-w-[60px] cursor-help">
                      <div className="text-lg font-bold">{isPowerUser ? userAchievementCount : data.totalAchievements}</div>
                      <div className="text-xs text-white/80">Achievements</div>
                    </div>
                  </Tooltip>
                </div>
              </div>

              {/* Side Cards: Growth Path (power user) or Team Leaderboard (manager) */}
              {isPowerUser && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[220px] max-w-[260px] flex flex-col">
                  <div className="text-sm font-semibold text-apptivia-ink mb-3">My Growth Path</div>
                  {(() => {
                    const pts = data.avgPoints || 0;
                    const skillsetProgresses = (data.skillsets || []).map(s => s.progress);
                    const effectiveInfo = getEffectiveLevel(pts, skillsetProgresses);
                    const currentIdx = LEVELS.findIndex(l => l.label === effectiveInfo.level);
                    const nextLevel = currentIdx < LEVELS.length - 1 ? LEVELS[currentIdx + 1] : null;
                    const levelColors = ['text-orange-500', 'text-apptivia-coral', 'text-emerald-500', 'text-yellow-500', 'text-apptivia-ink'];
                    return (
                      <div className="space-y-2 flex-1">
                        {LEVELS.map((lvl, i) => (
                          <div key={lvl.label} className={`flex items-center gap-2 text-xs ${i === currentIdx ? 'font-bold' : i < currentIdx ? 'text-apptivia-carbon-400' : 'text-apptivia-carbon-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${i <= currentIdx ? (levelColors[i] || 'text-apptivia-carbon-400').replace('text-', 'bg-') : 'bg-apptivia-carbon-200'}`} />
                            <span className={i === currentIdx ? levelColors[i] || '' : ''}>{lvl.label}</span>
                            {i === currentIdx && <span className="ml-auto text-[10px] bg-apptivia-coral-tone-50 text-apptivia-coral px-1.5 py-0.5 rounded">YOU</span>}
                            {i < currentIdx && <span className="ml-auto text-[10px] text-green-500">✓</span>}
                          </div>
                        ))}
                        {effectiveInfo.cappedByBreadth && nextLevel && (
                          <div className="mt-3 pt-2 border-t text-[11px] text-amber-600">
                            Advance more skillsets to reach {nextLevel.label}
                          </div>
                        )}
                        {!effectiveInfo.cappedByBreadth && nextLevel && (
                          <div className="mt-3 pt-2 border-t text-[11px] text-apptivia-carbon-500">
                            <span className="font-medium text-apptivia-carbon-700">{effectiveInfo.pointsToNext} pts</span> to reach {nextLevel.label}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>
          )}
        </div>
        {(isManager || isAdmin) && !loading && !error && (
          <DataDrivenPlaybook
            scorecardData={scorecardData}
            lastWeekScorecardData={lastWeekScorecardData}
            coachData={data}
            historicalScores={historicalScores}
            repNames={historicalRepNames}
            scorecardKpiKeys={scorecardData?.scorecardKpiKeys || []}
            onBuildPlan={(repId, repName) => setBuildPlanFor({ repId, repName })}
            onStartReview={(repId, repName) => setStartReviewFor({ repId, repName })}
          />
        )}

        {/* Power User: Your Performance Insights — 3 accordion sections matching Manager Playbook style */}
        {isPowerUser && !loading && !error && (() => {
          const trendEntries = kpiTrends ? Object.entries(kpiTrends) : [];
          const declining = trendEntries.filter(([, t]) => t.avgPct < LAGGING_THRESHOLD);
          const onTrackCount = trendEntries.length - declining.length;
          const totalPlans = activePlans.length + completedPlans.length;

          return (
            <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-semibold">Your Performance Insights</h2>
                <InfoTooltip text="5-week trend analysis, improvement suggestions, and your coaching plans." />
              </div>

              <div className="space-y-2">
                {/* Section 1: KPI Success Trends */}
                <div className={`rounded-lg border transition-colors ${insightsSection === 'trends' ? 'border-blue-200 bg-apptivia-coral-tone-50/30' : 'border-gray-100 bg-apptivia-coral-tone-50/10 hover:bg-apptivia-coral-tone-50/30'}`}>
                  <button
                    type="button"
                    onClick={() => setInsightsSection(prev => prev === 'trends' ? null : 'trends')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <svg className="w-5 h-5 text-apptivia-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <span className="font-semibold text-sm text-apptivia-ink">KPI Success Trends</span>
                    {kpiTrends && (
                      <span className="ml-auto text-[10px] font-medium text-apptivia-carbon-500">
                        {onTrackCount > 0 && <span className="text-emerald-600">{onTrackCount} on track</span>}
                        {onTrackCount > 0 && declining.length > 0 && <span className="mx-1">·</span>}
                        {declining.length > 0 && <span className="text-red-500">{declining.length} need focus</span>}
                        {trendEntries.length === 0 && 'No data yet'}
                      </span>
                    )}
                    {insightsSection === 'trends'
                      ? <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      : <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    }
                  </button>
                  {insightsSection === 'trends' && (
                    <div className="px-4 pb-4">
                      {kpiTrendsLoading ? (
                        <div className="text-xs text-apptivia-carbon-500 py-4">Loading performance trends...</div>
                      ) : !kpiTrends || trendEntries.length === 0 ? (
                        <div className="text-xs text-apptivia-carbon-500 py-4">No trend data available yet.</div>
                      ) : (
                        <div className="overflow-y-auto max-h-[300px]">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-white">
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-1.5 px-2 font-semibold text-apptivia-carbon-700">KPI</th>
                                {(trendEntries[0]?.[1]?.weeks || []).map((w, i) => (
                                  <th key={i} className="text-center py-1.5 px-1 font-medium text-apptivia-carbon-400 text-[10px]">{w.week}</th>
                                ))}
                                <th className="text-center py-1.5 px-2 font-semibold text-apptivia-carbon-700">Trend</th>
                                <th className="text-center py-1.5 px-2 font-semibold text-apptivia-carbon-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trendEntries.map(([key, trend]) => {
                                const isLagging = trend.avgPct < LAGGING_THRESHOLD;
                                const statusColor = trend.avgPct >= 90 ? 'text-green-600 bg-green-50' : trend.avgPct >= 80 ? 'text-yellow-600 bg-yellow-50' : trend.avgPct >= 60 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';
                                return (
                                  <tr key={key} className={`border-b border-gray-50 ${isLagging ? 'bg-red-50/30' : ''}`}>
                                    <td className="py-1.5 px-2 font-medium text-apptivia-ink whitespace-nowrap">{trend.name}</td>
                                    {trend.weeks.map((w, i) => {
                                      const cellColor = w.pct > 0 ? scoreTextColor(w.pct) : 'text-apptivia-carbon-300';
                                      return (
                                        <td key={i} className={`text-center py-1.5 px-1 font-medium ${cellColor}`}>{w.pct}%</td>
                                      );
                                    })}
                                    <td className="text-center py-1.5 px-2">
                                      <span className={`text-[10px] font-semibold ${trend.direction === 'up' ? 'text-emerald-600' : trend.direction === 'down' ? 'text-rose-600' : 'text-apptivia-carbon-400'}`}>
                                        {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'}
                                        {trend.trendDelta !== 0 ? ` ${Math.abs(trend.trendDelta)}%` : ''}
                                      </span>
                                    </td>
                                    <td className="text-center py-1.5 px-2">
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                        {trend.avgPct >= 90 ? 'On Track' : trend.avgPct >= 80 ? 'Acceptable' : trend.avgPct >= 60 ? 'Needs Focus' : 'Critical'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: Improvement Suggestions */}
                <div className={`rounded-lg border transition-colors ${insightsSection === 'suggestions' ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100 bg-orange-50/10 hover:bg-orange-50/30'}`}>
                  <button
                    type="button"
                    onClick={() => setInsightsSection(prev => prev === 'suggestions' ? null : 'suggestions')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    <span className="font-semibold text-sm text-apptivia-ink">Improvement Suggestions</span>
                    <span className="ml-auto flex items-center gap-2">
                      {declining.length > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold">{declining.length} KPI{declining.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-600">All on track</span>
                      )}
                    </span>
                    {insightsSection === 'suggestions'
                      ? <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      : <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    }
                  </button>
                  {insightsSection === 'suggestions' && (
                    <div className="px-4 pb-4">
                      {declining.length > 0 ? (
                        <div className="space-y-2">
                          {declining.slice(0, 3).map(([key, trend]) => {
                            const guidance = KPI_GUIDANCE[key];
                            if (!guidance) return null;
                            return (
                              <div key={key} className="border border-orange-100 bg-orange-50/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-xs text-apptivia-ink">{trend.name}</span>
                                  <span className={`text-[10px] font-semibold ${trend.direction === 'down' ? 'text-rose-600' : 'text-amber-600'}`}>
                                    {trend.direction === 'down' ? `▼ ${Math.abs(trend.trendDelta)}% declining` : `${trend.avgPct}% avg — below ${LAGGING_THRESHOLD}%`}
                                  </span>
                                </div>
                                <div className="text-[11px] text-amber-800 italic mb-1.5">{guidance.diagnosis}</div>
                                <div className="space-y-0.5">
                                  {guidance.tips.slice(0, 2).map((tip, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-apptivia-carbon-700">
                                      <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                      <span>{tip}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 flex justify-end">
                                  <FeedbackThumb featureArea="performance_insight" contentKey={key} context={{ kpi: key }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                          All KPIs are trending positively. Keep up the great work!
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 3: Active Coaching Plans */}
                <div className={`rounded-lg border transition-colors ${insightsSection === 'plans' ? 'border-green-200 bg-green-50/30' : 'border-gray-100 bg-green-50/10 hover:bg-green-50/30'}`}>
                  <button
                    type="button"
                    onClick={() => setInsightsSection(prev => prev === 'plans' ? null : 'plans')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    <span className="font-semibold text-sm text-apptivia-ink">Active Coaching Plans</span>
                    <span className="ml-auto flex items-center gap-2">
                      {activePlansLoading ? (
                        <span className="text-[10px] font-medium text-apptivia-carbon-400">Loading...</span>
                      ) : totalPlans > 0 ? (
                        <span className="text-[10px] font-medium text-apptivia-carbon-500">
                          {activePlans.length > 0 && <span className="text-green-600">{activePlans.length} active</span>}
                          {activePlans.length > 0 && completedPlans.length > 0 && <span className="mx-1">·</span>}
                          {completedPlans.length > 0 && <span className="text-apptivia-carbon-400">{completedPlans.length} completed</span>}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-apptivia-carbon-400">
                          No plans
                          <span className="ml-1.5 text-apptivia-coral hover:text-apptivia-coral-tone-700 cursor-pointer" onClick={(e) => { e.stopPropagation(); setRequestPlanOpen(true); }}>
                            + Request
                          </span>
                        </span>
                      )}
                    </span>
                    {insightsSection === 'plans'
                      ? <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      : <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    }
                  </button>
                  {insightsSection === 'plans' && (
                    <div className="px-4 pb-4">
                      {activePlansLoading ? (
                        <div className="text-xs text-apptivia-carbon-500 py-4">Loading coaching plans...</div>
                      ) : totalPlans === 0 ? (
                        <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <div className="text-sm text-apptivia-carbon-500 mb-2">No active coaching plans</div>
                          <button type="button" onClick={() => setRequestPlanOpen(true)} className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 font-medium">
                            Request Coaching Plan
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activePlans.map(plan => {
                            const assignment = myAssignments[plan.id] || {};
                            const status = assignment.status || 'active';
                            const statusColor = status === 'in_progress' ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' : 'bg-apptivia-carbon-100 text-apptivia-carbon-600';
                            const statusLabel = status === 'in_progress' ? 'In Progress' : 'Active';
                            return (
                              <div key={plan.id} className="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-all">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-apptivia-ink">{plan.name || 'Coaching Plan'}</div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${plan.plan_type === 'ai_self_coaching' ? 'bg-apptivia-carbon-100 text-apptivia-ink' : 'bg-apptivia-coral-tone-50 text-apptivia-coral'}`}>
                                      {plan.plan_type === 'ai_self_coaching' ? 'AI Generated' : 'Manager Assigned'}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor}`}>{statusLabel}</span>
                                  </div>
                                </div>
                                {plan.focus_kpis?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {plan.focus_kpis.map((kpi, i) => (
                                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-carbon-600 font-medium">{buildLabel(kpi)}</span>
                                    ))}
                                  </div>
                                )}
                                {plan.action_items && (
                                  <div className="space-y-1 mb-2">
                                    {(Array.isArray(plan.action_items) ? plan.action_items : []).slice(0, 3).map((item, i) => (
                                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-apptivia-carbon-700">
                                        <span className="text-apptivia-coral-tone-300 mt-0.5 shrink-0">○</span>
                                        <span>{typeof item === 'string' ? item : item?.text || item?.action || JSON.stringify(item)}</span>
                                      </div>
                                    ))}
                                    {Array.isArray(plan.action_items) && plan.action_items.length > 3 && (
                                      <div className="text-[10px] text-apptivia-carbon-400 ml-4">+{plan.action_items.length - 3} more items</div>
                                    )}
                                  </div>
                                )}
                                <div className="flex gap-2 mt-2">
                                  <button type="button" onClick={() => setViewPlanDetail(plan)} className="text-[11px] px-2.5 py-1 rounded-md bg-apptivia-paper text-apptivia-carbon-700 hover:bg-apptivia-carbon-100 font-medium border border-gray-200 transition-colors">
                                    View Full Plan
                                  </button>
                                  {(status === 'active' || status === 'in_progress') && (
                                    <button type="button" onClick={() => handlePowerUserStatusChange(plan, 'completed')} className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium border border-emerald-200 transition-colors">
                                      Mark Completed
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Completed Plans — collapsible */}
                          {completedPlans.length > 0 && (
                            <div className={`${activePlans.length > 0 ? 'border-t pt-3' : ''}`}>
                              <button type="button" onClick={() => setCompletedPlansOpen(o => !o)} className="flex items-center gap-2 text-xs font-semibold text-apptivia-carbon-600 hover:text-apptivia-ink transition-colors">
                                <span className="text-[10px]">{completedPlansOpen ? '▲' : '▼'}</span>
                                Past Plans ({completedPlans.length})
                              </button>
                              {completedPlansOpen && (
                                <div className="space-y-3 mt-3">
                                  {completedPlans.map(plan => {
                                    const assignment = plan._assignment || {};
                                    const baseline = assignment.baseline_kpi_snapshot || {};
                                    const final_ = assignment.final_kpi_snapshot || {};
                                    const effScore = assignment.effectiveness_score;
                                    const focusKpis = plan.focus_kpis || [];
                                    let effTier = null, effColor = '';
                                    if (effScore != null) {
                                      if (effScore >= 5) { effTier = 'Strong improvement'; effColor = 'text-emerald-600'; }
                                      else if (effScore > -5) { effTier = 'Some improvement'; effColor = 'text-amber-600'; }
                                      else { effTier = 'No change'; effColor = 'text-apptivia-carbon-500'; }
                                    }
                                    return (
                                      <div key={plan.id} className="border border-gray-100 rounded-lg p-3 bg-apptivia-paper">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-sm text-apptivia-ink">{plan.name || 'Coaching Plan'}</span>
                                          <span className="text-[10px] text-apptivia-carbon-400">{assignment.status === 'cancelled' ? 'Cancelled' : 'Completed'} {assignment.completed_at ? new Date(assignment.completed_at).toLocaleDateString() : ''}</span>
                                        </div>
                                        {focusKpis.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {focusKpis.map((kpi, i) => (
                                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-carbon-600 font-medium">{buildLabel(kpi)}</span>
                                            ))}
                                          </div>
                                        )}
                                        {effTier && <div className={`text-[11px] font-semibold ${effColor} mb-1`}>{effTier}</div>}
                                        {focusKpis.length > 0 && Object.keys(baseline).length > 0 && (
                                          <div className="space-y-1">
                                            {focusKpis.map(kpi => {
                                              const b = baseline[kpi], f = final_[kpi];
                                              if (!b) return null;
                                              const delta = f && b ? (f.pct || 0) - (b.pct || 0) : null;
                                              return (
                                                <div key={kpi} className="flex items-center gap-2 text-[10px]">
                                                  <span className="text-apptivia-carbon-600 w-28 truncate">{buildLabel(kpi)}</span>
                                                  <span className="text-apptivia-carbon-500">{b.pct ?? '—'}%</span>
                                                  <span className="text-apptivia-carbon-400">→</span>
                                                  <span className="text-apptivia-carbon-700 font-medium">{f?.pct ?? '—'}%</span>
                                                  {delta !== null && (
                                                    <span className={`font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-apptivia-carbon-400'}`}>
                                                      {delta > 0 ? '+' : ''}{delta}%
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 4: My Development Plans (IDPs) */}
                <div className={`rounded-lg border transition-colors ${insightsSection === 'idps' ? 'border-purple-200 bg-apptivia-carbon-100/30' : 'border-gray-100 bg-apptivia-carbon-100/10 hover:bg-apptivia-carbon-100/30'}`}>
                  <button
                    type="button"
                    onClick={() => setInsightsSection(prev => prev === 'idps' ? null : 'idps')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <svg className="w-5 h-5 text-apptivia-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    <span className="font-semibold text-sm text-apptivia-ink">My Development Plans</span>
                    <span className="ml-auto flex items-center gap-2">
                      {myIdpsLoading ? (
                        <span className="text-[10px] font-medium text-apptivia-carbon-400">Loading...</span>
                      ) : myIdps.length > 0 ? (
                        <span className="text-[10px] font-medium text-apptivia-carbon-500">
                          <span className="text-apptivia-ink">{myIdps.filter(p => p.status !== 'completed').length} active</span>
                          {myIdps.filter(p => p.status === 'completed').length > 0 && (
                            <><span className="mx-1">·</span><span className="text-apptivia-carbon-400">{myIdps.filter(p => p.status === 'completed').length} completed</span></>
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-apptivia-carbon-400">No plans</span>
                      )}
                    </span>
                    {insightsSection === 'idps'
                      ? <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      : <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    }
                  </button>
                  {insightsSection === 'idps' && (
                    <div className="px-4 pb-4">
                      {myIdpsLoading ? (
                        <div className="text-xs text-apptivia-carbon-500 py-4">Loading development plans...</div>
                      ) : myIdps.length === 0 ? (
                        <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <div className="text-sm text-apptivia-carbon-500">No development plans assigned yet</div>
                          <div className="text-xs text-apptivia-carbon-400 mt-1">Your manager will create an IDP when ready</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myIdps.map(idp => {
                            const milestones = idp.milestones || [];
                            const completedMs = milestones.filter(m => m.status === 'completed').length;
                            const msPct = milestones.length > 0 ? Math.round((completedMs / milestones.length) * 100) : 0;
                            const isOverdue = idp.period_end && new Date() > new Date(idp.period_end) && idp.status !== 'completed';
                            const displayStatus = isOverdue ? 'overdue' : idp.status;
                            const statusStyles = {
                              draft: 'bg-apptivia-carbon-100 text-apptivia-carbon-600',
                              active: 'bg-apptivia-coral-tone-50 text-apptivia-coral',
                              in_progress: 'bg-yellow-100 text-yellow-700',
                              completed: 'bg-green-100 text-green-700',
                              overdue: 'bg-red-100 text-red-700',
                            };
                            const statusLabels = { draft: 'Draft', active: 'Active', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' };
                            return (
                              <div key={idp.id} className="border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-all">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-apptivia-ink truncate">{idp.name}</div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${idp.plan_type === 'annual' ? 'bg-apptivia-carbon-100 text-apptivia-ink' : 'bg-apptivia-carbon-100 text-apptivia-ink'}`}>
                                      {idp.plan_type === 'annual' ? 'Annual' : idp.plan_type === 'quarterly' ? 'Quarterly' : 'Custom'}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusStyles[displayStatus] || statusStyles.draft}`}>
                                      {statusLabels[displayStatus] || displayStatus}
                                    </span>
                                  </div>
                                </div>
                                {idp.period_start && idp.period_end && (
                                  <div className="text-[10px] text-apptivia-carbon-500 mb-2">{idp.period_start} → {idp.period_end}</div>
                                )}
                                {idp.focus_kpis?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {idp.focus_kpis.slice(0, 4).map((kpi, i) => (
                                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-ink font-medium">{buildLabel(kpi)}</span>
                                    ))}
                                    {idp.focus_kpis.length > 4 && <span className="text-[10px] text-apptivia-carbon-400">+{idp.focus_kpis.length - 4}</span>}
                                  </div>
                                )}
                                {milestones.length > 0 && (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-[10px] text-apptivia-carbon-500 mb-1">
                                      <span>Milestones ({completedMs}/{milestones.length})</span>
                                      <span className="font-semibold text-apptivia-ink">{msPct}%</span>
                                    </div>
                                    <div className="w-full bg-apptivia-carbon-200 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-1.5 rounded-full bg-apptivia-ink transition-all duration-500" style={{ width: `${msPct}%` }} />
                                    </div>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setViewIdpDetail(idp)}
                                  className="text-[11px] px-2.5 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 font-medium border border-purple-200 transition-colors mt-1"
                                >
                                  View Full Plan
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 5: My Performance Reviews */}
                <div className={`rounded-lg border transition-colors ${insightsSection === 'reviews' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-amber-50/10 hover:bg-amber-50/30'}`}>
                  <button
                    type="button"
                    onClick={() => setInsightsSection(prev => prev === 'reviews' ? null : 'reviews')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="font-semibold text-sm text-apptivia-ink">My Performance Reviews</span>
                    <span className="ml-auto flex items-center gap-2">
                      {myReviewsLoading ? (
                        <span className="text-[10px] font-medium text-apptivia-carbon-400">Loading...</span>
                      ) : (() => {
                        const needsAction = myReviews.filter(r => r.status === 'pending_self_assessment' || r.status === 'finalized');
                        return myReviews.length > 0 ? (
                          <span className="text-[10px] font-medium text-apptivia-carbon-500">
                            {needsAction.length > 0 ? (
                              <span className="text-amber-600">{needsAction.length} need{needsAction.length === 1 ? 's' : ''} action</span>
                            ) : (
                              <span>{myReviews.length} review{myReviews.length !== 1 ? 's' : ''}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-apptivia-carbon-400">No reviews</span>
                        );
                      })()}
                    </span>
                    {insightsSection === 'reviews'
                      ? <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      : <svg className="w-4 h-4 text-apptivia-carbon-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    }
                  </button>
                  {insightsSection === 'reviews' && (
                    <div className="px-4 pb-4">
                      {myReviewsLoading ? (
                        <div className="text-xs text-apptivia-carbon-500 py-4">Loading performance reviews...</div>
                      ) : myReviews.length === 0 ? (
                        <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                          <div className="text-sm text-apptivia-carbon-500">No performance reviews yet</div>
                          <div className="text-xs text-apptivia-carbon-400 mt-1">Your manager will initiate reviews during review cycles</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myReviews.map(review => {
                            const reviewStatusStyles = {
                              draft: { bg: 'bg-apptivia-carbon-100 text-apptivia-carbon-600', label: 'Draft' },
                              pending_self_assessment: { bg: 'bg-amber-100 text-amber-700', label: 'Self-Assessment Needed' },
                              self_assessment_submitted: { bg: 'bg-apptivia-coral-tone-50 text-apptivia-coral', label: 'Under Review' },
                              manager_review: { bg: 'bg-apptivia-coral-tone-50 text-apptivia-coral', label: 'Manager Reviewing' },
                              finalized: { bg: 'bg-green-100 text-green-700', label: 'Ready to Acknowledge' },
                              acknowledged: { bg: 'bg-emerald-100 text-emerald-700', label: 'Acknowledged' },
                              reopened: { bg: 'bg-yellow-100 text-yellow-700', label: 'Reopened' },
                            };
                            const rs = reviewStatusStyles[review.status] || reviewStatusStyles.draft;
                            const needsAction = review.status === 'pending_self_assessment' || review.status === 'finalized';
                            const rating = review.final_rating || review.manager_rating;
                            return (
                              <div key={review.id} className={`border rounded-lg p-3 hover:shadow-sm transition-all ${needsAction ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-semibold text-sm text-apptivia-ink truncate">{review.title}</div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${review.review_type === 'annual' ? 'bg-apptivia-carbon-100 text-apptivia-ink' : 'bg-apptivia-coral-tone-50 text-apptivia-coral'}`}>
                                      {review.review_type === 'annual' ? 'Annual' : 'Mid-Year'}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${rs.bg}`}>
                                      {rs.label}
                                    </span>
                                  </div>
                                </div>
                                {review.period_start && review.period_end && (
                                  <div className="text-[10px] text-apptivia-carbon-500 mb-2">{review.period_start} → {review.period_end}</div>
                                )}
                                {rating && (
                                  <div className="flex items-center gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <svg key={star} className={`w-3.5 h-3.5 ${star <= rating ? 'text-yellow-400' : 'text-apptivia-carbon-300'}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    ))}
                                    <span className="text-[10px] text-apptivia-carbon-500 ml-1">{rating}/5</span>
                                  </div>
                                )}
                                {needsAction && (
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span className="text-[11px] font-medium text-amber-700">
                                      {review.status === 'pending_self_assessment' ? 'Complete your self-assessment' : 'Review and acknowledge'}
                                    </span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setViewReviewDetail(review)}
                                  className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors mt-1 ${
                                    needsAction
                                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                      : 'bg-apptivia-paper text-apptivia-carbon-700 hover:bg-apptivia-carbon-100 border-gray-200'
                                  }`}
                                >
                                  {review.status === 'pending_self_assessment' ? 'Start Self-Assessment' : review.status === 'finalized' ? 'View & Acknowledge' : 'View Review'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold">Skillset Mastery Progress</h2>
            <InfoTooltip text="Progress toward skillset achievements based on recent KPI performance." />
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch auto-rows-fr">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkillsetCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch auto-rows-fr">
              {data.skillsets.map((skillset, index) => (
                <div key={index} className="border-2 border-gray-100 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full flex flex-col">
                  <div className="flex items-start gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm flex-shrink-0">
                      <span style={{ color: skillset.color, fontSize: 20 }}>●</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-base text-apptivia-ink">{skillset.skillset_name}</h3>
                        <Tooltip text={`Skillset level based on achievement progress: Beginner (0-24%), Intermediate (25-49%), Advanced (50-74%), Expert (75-99%), Master (100%)`} position="bottom" wide>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold cursor-help ${SKILLSET_LEVEL_COLORS[getSkillsetLevel(skillset.progress)] || 'bg-apptivia-carbon-100 text-apptivia-carbon-600'}`}>
                          {getSkillsetLevel(skillset.progress)}
                        </span>
                      </Tooltip>
                      </div>
                      <p className="text-xs text-apptivia-carbon-600 break-words line-clamp-2 min-h-[2.5rem]">{skillset.description}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="relative w-full bg-apptivia-carbon-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${skillset.progress}%`, backgroundColor: skillset.color }}></div>
                      {[25, 50, 75].map(pct => (
                        <div key={pct} className="absolute top-0 h-full w-px bg-apptivia-carbon-400/50" style={{ left: `${pct}%` }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-apptivia-carbon-500">{skillset.achievements_completed}/{skillset.total_achievements} achievements</span>
                      <Tooltip text="Percentage of total achievement points earned in this skillset" position="left">
                        <span className="font-bold cursor-help" style={{ color: skillset.color }}>{skillset.progress}%</span>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="bg-apptivia-paper rounded-lg p-2.5 border border-gray-100 mb-2">
                    <div className="text-[10px] font-medium text-apptivia-carbon-500 mb-0.5">Next Achievement</div>
                    <div className="text-xs text-apptivia-ink break-words line-clamp-2">{skillset.next_achievement}</div>
                  </div>
                  <div className="bg-apptivia-paper rounded-lg p-2.5 border border-gray-100 mb-2">
                    <div className="text-[10px] font-medium text-apptivia-carbon-500 mb-0.5">{isPowerUser ? 'Skillset Points' : 'Avg Skillset Points'}</div>
                    <div className="text-xs font-semibold text-apptivia-ink">{skillset.points}</div>
                  </div>
                  <button
                    onClick={() => setSelectedSkillset({ id: skillset.skillset_id, name: skillset.skillset_name, color: skillset.color })}
                    className="w-full py-1.5 px-3 rounded-md font-medium text-xs transition-all duration-200 hover:opacity-90 hover:shadow-md mt-auto text-white"
                    style={{
                      backgroundColor: skillset.color || '#3B82F6',
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
        title="Coach Filters"
        subtitle="Focus coaching views"
        showReset
        onReset={handleResetFilters}
      >
        <ScorecardFilters
          showDate={false}
          organizationId={orgId}
          onFilterChange={handleFiltersChange}
          initialFilters={defaultFilters}
          resetSignal={filtersResetSignal}
          restrictToTeams={(isManager || isCoach) && teamId ? [teamId] : undefined}
          restrictToMembers={isPowerUser && userId ? [userId] : undefined}
          lockedFilters={isPowerUser ? { members: true, teams: true, departments: true } : undefined}
        />
      </RightFilterPanel>
      {selectedSkillset && (
        <SkillsetDetailsModal
          isOpen={!!selectedSkillset}
          onClose={() => {
            setSelectedSkillset(null);
            setHighlightAchievement(null);
          }}
          skillsetId={selectedSkillset.id}
          skillsetName={selectedSkillset.name}
          skillsetColor={selectedSkillset.color}
          selectedMembers={filters.members}
          selectedTeams={filters.teams}
          selectedDepartments={filters.departments}
          organizationId={profile?.organization_id}
          highlightAchievementName={highlightAchievement}
        />
      )}
      <ApptiviaLevelInfoModal
        isOpen={levelInfoOpen}
        onClose={() => setLevelInfoOpen(false)}
      />
      <ShareCoachSnapshotModal
        isOpen={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        coachData={{
          apptiviaLevel: data?.avgLevel || 'N/A',
          levelPoints: data?.avgPoints || 0,
          averageScore: data?.avgScore || 0,
          skillsetData: data?.skillsets || [],
          totalMembers: data?.totalMembers || 0,
          totalBadges: data?.totalBadges || 0,
          totalAchievements: data?.totalAchievements || 0,
          scorecardStreak: data?.scorecardStreak || 0,
        }}
        scorecardData={scorecardData}
        filters={filters}
      />
      <RequestCoachingPlanModal
        isOpen={requestPlanOpen}
        onClose={() => setRequestPlanOpen(false)}
      />
      {viewPlanDetail && (
        <PlanDetailModal
          plan={viewPlanDetail}
          onClose={() => setViewPlanDetail(null)}
          canCreatePlans={false}
          canManagePlans={false}
          assignmentStatuses={{}}
          assignmentEffectiveness={{}}
          teamMembers={[]}
          user={user}
          isPowerUser={true}
          getMyAssignmentStatus={(p) => myAssignments[p.id]?.status || 'active'}
          handleStatusChange={(p, status) => { handlePowerUserStatusChange(p, status); setViewPlanDetail(null); }}
        />
      )}
      {viewIdpDetail && (
        <IdpDetailModal
          idp={viewIdpDetail}
          onClose={() => setViewIdpDetail(null)}
          onMilestoneToggle={handleIdpMilestoneToggle}
          canManage={false}
        />
      )}
      {viewReviewDetail && (
        <ReviewDetailModal
          review={viewReviewDetail}
          onClose={() => setViewReviewDetail(null)}
          onTransition={handleReviewTransition}
          onAcknowledge={handleReviewAcknowledge}
          isManager={false}
          isRep={true}
          teamMembers={[]}
          saving={reviewSaving}
        />
      )}
      <ConfirmModal
        isOpen={idpCompletionPrompt.isOpen}
        title="All Milestones Completed!"
        message={`All milestones for "${idpCompletionPrompt.idp?.name}" are complete. Would you like to mark this development plan as completed?`}
        confirmText="Mark Completed"
        variant="success"
        onConfirm={async () => {
          const idp = idpCompletionPrompt.idp;
          setIdpCompletionPrompt({ isOpen: false, idp: null });
          if (!idp) return;
          const { error } = await supabase.from('individual_development_plans')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', idp.id);
          if (error) { toast.error('Status update failed'); return; }
          toast.success('Development plan marked as completed!');
          setViewIdpDetail(prev => prev?.id === idp.id ? { ...prev, status: 'completed' } : prev);
          setMyIdps(prev => prev.map(p => p.id === idp.id ? { ...p, status: 'completed' } : p));
        }}
        onClose={() => setIdpCompletionPrompt({ isOpen: false, idp: null })}
      />
      <CreateRepPlanModal
        isOpen={!!buildPlanFor}
        onClose={() => setBuildPlanFor(null)}
        repId={buildPlanFor?.repId}
        repName={buildPlanFor?.repName}
        teamMembers={managerTeamMembers}
        onPlanCreated={() => setRefreshTrigger(prev => prev + 1)}
      />
      <CreateReviewModal
        isOpen={!!startReviewFor}
        onClose={() => setStartReviewFor(null)}
        repId={startReviewFor?.repId}
        repName={startReviewFor?.repName}
        teamMembers={managerTeamMembers}
        onReviewCreated={() => setRefreshTrigger(prev => prev + 1)}
      />
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={handleExportFormat}
        title="Export Coach Report"
      />
      <ScheduleReportModal
        isOpen={showScheduleReportModal}
        onClose={() => setShowScheduleReportModal(false)}
        onSuccess={() => {
          if (addNotification) addNotification({ type: 'success', title: 'Report Scheduled', message: 'Your report has been scheduled. Manage it in Settings → Reports.', dedupeKey: 'report-scheduled' });
        }}
      />
    </DashboardLayout>
  );
}
