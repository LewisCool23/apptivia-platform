import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import DashboardLayout from './DashboardLayout';
import ScorecardFilters from './components/ScorecardFilters';
import RightFilterPanel from './components/RightFilterPanel';
import PageActionBar from './components/PageActionBar';
import { useScorecardData } from './hooks/useScorecardData';
import { useCoachData } from './hooks/useCoachData';
import { exportScorecardToCSV } from './utils/exportUtils';
import ConfigureModal from './components/ConfigureModal';
import ConfigurePanel from './components/ConfigurePanel';
import { StatCardSkeleton, TableRowSkeleton } from './components/Skeleton';
import { ScoreDistributionChart, HistoricalScoresChart } from './components/Charts';
import { supabase } from './supabaseClient';
import { useNotifications } from './contexts/NotificationContext';
import { useAuth } from './AuthContext';
import CoachingPlanPanel from './components/CoachingPlanPanel';
import { useHistoricalScores } from './hooks/useHistoricalScores';
import InfoTooltip from './components/InfoTooltip';
import ShareScorecardSnapshotModal from './components/ShareScorecardSnapshotModal';

interface KPIMetric {
  key: string;
  name: string;
  description?: string;
  goal: number;
  weight: number;
  unit: string;
  category: string;
}

const SKILLSET_KPI_MAP: Record<string, string[]> = {
  conversationalist: ['talk_time_minutes', 'conversations'],
  'call conqueror': ['call_connects', 'meetings', 'discovery_calls'],
  'email warrior': ['emails_sent', 'social_touches'],
  'pipeline guru': ['sourced_opps', 'stage2_opps', 'pipeline_created', 'pipeline_advanced', 'qualified_leads'],
  'task master': ['follow_ups', 'demos_completed', 'response_time', 'sales_cycle_days', 'win_rate'],
  'scorecard master': ['scorecard_100_percent', 'scorecard_100_percent_streak', 'key_metric_100_percent', 'key_metric_100_percent_streak', 'scorecards_completed'],
};

const KPI_SKILLSET_MAP: Record<string, string> = Object.entries(SKILLSET_KPI_MAP).reduce(
  (acc, [skillset, kpis]) => {
    kpis.forEach((kpi) => {
      acc[kpi] = skillset;
    });
    return acc;
  },
  {} as Record<string, string>
);

const ApptiviaScorecard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const userId = (user && typeof user === 'object' && 'id' in user) ? (user as any).id : null;
  const profileTeamId = (profile as any)?.team_id;
  const userTeamId = (user as any)?.team_id;
  const teamId = profileTeamId ? String(profileTeamId) : userTeamId ? String(userTeamId) : null;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isCoach = role === 'coach';
  const isPowerUser = role === 'power_user';
  const canConfigureScorecard = (hasPermission as any)('configure_scorecard');
  const canExport = (hasPermission as any)('export_data');
  const canViewCoach = (hasPermission as any)('view_coach');
  const canViewAnalytics = (hasPermission as any)('view_analytics');
  const canViewContests = (hasPermission as any)('view_contests');

  const defaultFilters = useMemo(() => {
    if (isAdmin) {
      return {
        dateRange: 'All Time',
        departments: [] as string[],
        teams: [] as string[],
        members: [] as string[],
      };
    }
    if (isManager || isCoach) {
      return {
        dateRange: 'This Week',
        departments: [] as string[],
        teams: teamId ? [teamId] : [] as string[],
        members: [] as string[],
      };
    }
    if (isPowerUser) {
      return {
        dateRange: 'This Week',
        departments: [] as string[],
        teams: [] as string[],
        members: userId ? [String(userId)] : [] as string[],
      };
    }
    return {
      dateRange: 'This Week',
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
  const [coachingPlanOpen, setCoachingPlanOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const notifications = useNotifications() as any;

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
      dateRange: 'All Time',
      departments: [],
      teams: [],
      members: [],
    });
  }, [isAdmin, userId]);

  async function fetchKpiMetrics() {
    setLoadingKpis(true);
    try {
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('key, name, description, goal, weight, unit, category')
        .eq('is_active', true)
        .eq('show_on_scorecard', true)
        .order('scorecard_position');

      if (error) throw error;
      setKpiMetrics(data || []);
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

  // Convert date range selection to actual dates
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
        // Default to This Week
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
    }
  }, [filters.dateRange]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchKpiMetrics();
  }, [refreshTrigger, filters, dateRange]);

  const { data, loading, error } = useScorecardData(
    filters.departments,
    filters.teams,
    filters.members,
    dateRange.start,
    dateRange.end,
    refreshTrigger
  );

  const { data: historicalScores } = useHistoricalScores(
    filters.departments,
    filters.teams,
    filters.members,
    dateRange,
    filters.dateRange,
    refreshTrigger
  );

  const shouldLoadCoach = isPowerUser && !!userId;
  const coachDepartments = useMemo(() => [] as string[], []);
  const coachTeams = useMemo(() => [] as string[], []);
  const coachMembers = useMemo(
    () => (shouldLoadCoach && userId ? [String(userId)] : [] as string[]),
    [shouldLoadCoach, userId]
  );
  const { data: coachData, loading: coachLoading, error: coachError } = useCoachData(
    coachDepartments,
    coachTeams,
    coachMembers,
    { enabled: shouldLoadCoach, mode: 'summary' }
  );

  const planDepartments = useMemo(() => {
    if (isAdmin) return filters.departments;
    if (isManager || isCoach) return filters.departments;
    return [] as string[];
  }, [filters.departments, isAdmin, isManager, isCoach]);

  const planTeams = useMemo(() => {
    if (isAdmin) return filters.teams;
    if (isManager || isCoach) return teamId ? [teamId] : filters.teams;
    return [] as string[];
  }, [filters.teams, isAdmin, isManager, isCoach, teamId]);

  const planMembers = useMemo(() => {
    if (isAdmin || isManager || isCoach) return filters.members;
    if (userId) return [String(userId)];
    return [] as string[];
  }, [filters.members, isAdmin, isManager, isCoach, userId]);

  const { data: planCoachData } = useCoachData(
    planDepartments,
    planTeams,
    planMembers,
    { enabled: coachingPlanOpen, mode: 'full' }
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

  const coachSkillsetsByName = useMemo(() => {
    const map = new Map<string, any>();
    (coachData?.skillsets || []).forEach((skillset: any) => {
      const key = skillset.skillset_name?.toLowerCase?.() || '';
      if (key) map.set(key, skillset);
    });
    return map;
  }, [coachData?.skillsets]);

  const coachingOpportunities = useMemo(() => {
    if (!isPowerUser || !userRow?.kpis) return [] as any[];

    return kpiMetrics
      .map((metric) => {
        const kpi = (userRow.kpis as any)?.[metric.key];
        if (!kpi) return null;
        const pct = Number(kpi?.percentage || 0);
        if (pct >= 80) return null;
        const skillsetKey = KPI_SKILLSET_MAP[metric.key];
        const skillset = skillsetKey ? coachSkillsetsByName.get(skillsetKey) : null;
        return {
          kpiKey: metric.key,
          kpiLabel: kpiLabels[metric.key] || metric.name || metric.key,
          percentage: Math.round(pct),
          skillsetId: skillset?.skillset_id || null,
          skillsetName: skillset?.skillset_name || skillsetKey || 'Coaching Focus',
          skillsetColor: skillset?.color || '#3b82f6',
          nextAchievement: skillset?.next_achievement || 'Review coach recommendations',
        };
      })
      .filter(Boolean) as any[];
  }, [isPowerUser, userRow, kpiMetrics, kpiLabels, coachSkillsetsByName]);

  const buildCoachLink = (skillset: any, achievement?: string | null, kpiKey?: string) => {
    const params = new URLSearchParams();
    if (skillset?.skillset_id) params.set('skillsetId', String(skillset.skillset_id));
    else if (skillset?.skillset_name) params.set('skillset', skillset.skillset_name);
    if (achievement) params.set('achievement', achievement);
    if (kpiKey) params.set('kpi', kpiKey);
    const query = params.toString();
    return query ? `/coach?${query}` : '/coach';
  };

  const openCoachForKpi = (kpiKey: string, achievement?: string | null) => {
    if (!canViewCoach) return;
    const skillsetKey = KPI_SKILLSET_MAP[kpiKey];
    const skillset = skillsetKey ? coachSkillsetsByName.get(skillsetKey) : null;
    navigate(buildCoachLink(skillset, achievement, kpiKey));
  };

  const handleExport = () => {
    if (!canExport) return;
    if (!loading && !error) {
      exportScorecardToCSV(data, filters);
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
      notifications.addNotification({
        type: 'performance',
        title: 'Scorecard milestone',
        message: `You hit ${userRow.apptivityScore}% on your scorecard.`,
        link: '/dashboard',
        dedupeKey: `scorecard-high-${userId}-${filters.dateRange}`,
      });
    }

    if (userRow.apptivityScore < 80) {
      notifications.addNotification({
        type: 'coaching',
        title: 'Opportunity to improve',
        message: `Your scorecard is ${userRow.apptivityScore}%. Review coaching insights.`,
        link: '/coach',
        dedupeKey: `scorecard-low-${userId}-${filters.dateRange}`,
      });
    }

    const topRow = data.rows[0];
    if (topRow && String(topRow.profile_id) === String(userId)) {
      notifications.addNotification({
        type: 'performance',
        title: 'Top performer',
        message: 'You are the top performer this period. Keep it up!',
        link: '/dashboard',
        dedupeKey: `scorecard-top-${userId}-${filters.dateRange}`,
      });
    }
  }, [loading, error, data.rows, userId, filters.dateRange, notifications]);

  useEffect(() => {
    if (loading || error || data.rows.length === 0) return;
    if (!(isManager || isCoach)) return;
    if (data.needCoaching > 0) {
      notifications.addNotification({
        type: 'coaching',
        title: 'Team coaching needed',
        message: `${data.needCoaching} rep${data.needCoaching === 1 ? '' : 's'} need coaching attention.`,
        link: '/coach',
        dedupeKey: `team-coaching-${data.needCoaching}-${filters.dateRange}`,
        audience: 'team',
      });
    }
  }, [loading, error, data.needCoaching, data.rows.length, isManager, isCoach, filters.dateRange, notifications]);

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
    return `Filters: ${filters.dateRange} • ${deptLabel} • ${teamLabel} • ${memberLabel}`;
  })();

  const canShareSnapshot = isAdmin || isManager;
  const sortedRows = useMemo(() => {
    return [...(data.rows || [])].sort((a, b) => (b.apptivityScore || 0) - (a.apptivityScore || 0));
  }, [data.rows]);
  const topPerformers = useMemo(() => sortedRows.slice(0, 3), [sortedRows]);
  const lowestPerformers = useMemo(() => sortedRows.slice(-3).reverse(), [sortedRows]);

  const snapshotHighlights = useMemo(() => {
    if (!data || !data.rows || data.rows.length === 0) return [] as string[];
    const topName = data.topPerformer?.name || topPerformers[0]?.name || 'N/A';
    const topScore = data.topPerformer?.score ?? topPerformers[0]?.apptivityScore ?? 'N/A';
    return [
      `Team average: ${data.teamAverage ?? 'N/A'}%`,
      `Top performer: ${topName} (${topScore}%)`,
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

      // Search profiles/users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);

      if (profiles) {
        profiles.forEach((profile: any) => {
          results.push({
            type: 'User',
            title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            subtitle: profile.role,
            link: `/profile?user=${profile.id}`,
            icon: '👤'
          });
        });
      }

      // Search achievements
      const { data: achievements } = await supabase
        .from('achievements')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (achievements) {
        achievements.forEach((achievement: any) => {
          results.push({
            type: 'Achievement',
            title: achievement.name,
            subtitle: achievement.description,
            link: '/coach',
            icon: '🏆'
          });
        });
      }

      // Search badges
      const { data: badges } = await supabase
        .from('badges')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (badges) {
        badges.forEach((badge: any) => {
          results.push({
            type: 'Badge',
            title: badge.name,
            subtitle: badge.description,
            link: '/profile',
            icon: '🎖️'
          });
        });
      }

      // Search contests
      const { data: contests } = await supabase
        .from('contests')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);

      if (contests) {
        contests.forEach((contest: any) => {
          results.push({
            type: 'Contest',
            title: contest.name,
            subtitle: contest.description,
            link: '/contests',
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

  const handleRefreshAchievements = async () => {
    setIsRefreshing(true);
    try {
      // Call the database function to check and award achievements
      const { data, error } = await supabase.rpc('check_and_award_achievements');
      
      if (error) {
        console.error('Error checking achievements:', error);
        notifications.addToast('error', 'Failed to refresh achievements');
      } else {
        const awardsCount = data || 0;
        if (awardsCount > 0) {
          notifications.addToast('success', `${awardsCount} new achievement${awardsCount > 1 ? 's' : ''} awarded!`);
        } else {
          notifications.addToast('info', 'No new achievements earned yet. Keep pushing!');
        }
        // Trigger data refresh
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error refreshing achievements:', err);
      notifications.addToast('error', 'Failed to refresh achievements');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Apptivia Scorecard</h1>
            <p className="text-gray-500 text-sm">
              {isPowerUser ? 'Your personalized productivity scorecard and progress' : 'Real-time productivity scoring for your sales team'}
            </p>
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
              onClick={handleRefreshAchievements}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 group ${
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
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => { if (canConfigureScorecard) setConfigPanelOpen(true); }}
              onExportClick={handleExport}
              onNotificationsClick={notifications.openPanel}
              exportDisabled={loading || !canExport}
              configureDisabled={!canConfigureScorecard}
              notificationBadge={notifications.unreadCount}
              actions={[
                {
                  label: 'See Coaching Plan',
                  onClick: () => setCoachingPlanOpen(true),
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
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="h-6 w-64 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left table-fixed">
                  <thead>
                    <tr className="bg-gray-50">
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <p className="text-yellow-800 text-lg font-semibold mb-2">No Scorecard KPIs Selected</p>
            <p className="text-yellow-600 mb-4">Please select 5 KPI metrics to display on your scorecard.</p>
            <button 
              onClick={() => {
                if (canConfigureScorecard) setShowConfigModal(true);
              }}
              disabled={!canConfigureScorecard}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${canConfigureScorecard ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              Select Scorecard KPIs
            </button>
          </div>
        )}

        {!loading && !error && !loadingKpis && kpiKeys.length > 0 && kpiKeys.length < 5 && (
          <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-blue-600 text-xl">ℹ️</span>
            <div>
              <p className="text-blue-800 font-semibold">Scorecard Incomplete</p>
              <p className="text-blue-700 text-sm">
                You have selected {kpiKeys.length} of 5 recommended KPIs.{' '}
                <button
                  onClick={() => {
                    if (canConfigureScorecard) setShowConfigModal(true);
                  }}
                  className={`underline font-medium ${canConfigureScorecard ? 'text-blue-700' : 'text-gray-400 cursor-not-allowed'}`}
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
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">My Score</div>
                    <div className="text-blue-700 font-bold text-base">{userRow?.apptivityScore ?? 'N/A'}%</div>
                    <div className="text-gray-400 text-xs">Current Apptivia Score</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">My Rank</div>
                    <div className="text-green-600 font-bold text-base">{userRank ? `#${userRank}` : 'N/A'}</div>
                    <div className="text-gray-400 text-xs">Within selected view</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">KPI On Track</div>
                    <div className="text-blue-700 font-bold text-base">{userKpiBreakdown.onTrack + userKpiBreakdown.exceeding}</div>
                    <div className="text-gray-400 text-xs">of {userKpiBreakdown.total} KPIs</div>
                  </div>
                  <div
                    className={`bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${canViewCoach ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (canViewCoach) navigate('/coach');
                    }}
                  >
                    <div className="text-xs text-gray-500 mb-1">Needs Focus</div>
                    <div className="text-orange-600 font-bold text-base">{userKpiBreakdown.needsFocus}</div>
                    <div className="text-gray-400 text-xs">Coaching opportunities</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Top Performer</div>
                    <div className="text-green-600 font-bold text-base">{data.topPerformer?.name || 'N/A'}</div>
                    <div className="text-gray-400 text-xs">{data.topPerformer?.score || 0}% Score</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Active Reps</div>
                    <div className="text-blue-700 font-bold text-base">{data.rows.length}</div>
                    <div className="text-gray-400 text-xs">In selected filters</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="text-xs text-gray-500 mb-1">Score Spread</div>
                    <div className="text-purple-600 font-bold text-base">{teamScoreStats.spread}%</div>
                    <div className="text-gray-400 text-xs">Highest vs lowest</div>
                  </div>
                  <div
                    className={`bg-white rounded-lg border border-gray-100 shadow-sm p-3 flex flex-col items-start justify-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${canViewCoach ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (canViewCoach) navigate('/coach');
                    }}
                  >
                    <div className="text-xs text-gray-500 mb-1">Lowest Score</div>
                    <div className="text-orange-600 font-bold text-base">{teamScoreStats.min}%</div>
                    <div className="text-gray-400 text-xs">Bottom performer</div>
                  </div>
                </>
              )}
            </div>

            {(isManager || isCoach) && (hasPermission as any)('view_team_snapshot') && (
              <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">Team Snapshot</h3>
                      <InfoTooltip text="High-level summary of team scorecard health for the selected filters." />
                    </div>
                    <p className="text-xs text-gray-500">Quick view of your direct team performance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canViewCoach && (
                      <button
                        onClick={() => navigate('/coach')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100"
                      >
                        Coach Team
                      </button>
                    )}
                    {canViewAnalytics && (
                      <button
                        onClick={() => navigate('/analytics')}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
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
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-gray-500">Team Average</div>
                    <div className="text-lg font-bold text-blue-700">{data.teamAverage}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-gray-500">Above Target</div>
                    <div className="text-lg font-bold text-emerald-600">{data.aboveTarget}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-gray-500">Need Coaching</div>
                    <div className="text-lg font-bold text-orange-600">{data.needCoaching}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <ScoreDistributionChart
                title={isPowerUser ? 'My KPI Health' : 'Score Distribution'}
                infoText="Shows the count of KPIs that are exceeding, on track, or below target for the current selection."
                data={isPowerUser ? [
                  { name: 'Exceeding (≥100%)', value: userKpiBreakdown.exceeding, kpis: kpiCategoryDetails.exceeding },
                  { name: 'On Track (80-99%)', value: userKpiBreakdown.onTrack, kpis: kpiCategoryDetails.onTrack },
                  { name: 'Needs Focus (<80%)', value: userKpiBreakdown.needsFocus, kpis: kpiCategoryDetails.needsFocus },
                ] : [
                  { name: 'Exceeding (≥100%)', value: data.rows.filter(r => r.apptivityScore >= 100).length },
                  { name: 'On Track (80-99%)', value: data.rows.filter(r => r.apptivityScore >= 80 && r.apptivityScore < 100).length },
                  { name: 'Below Target (<80%)', value: data.rows.filter(r => r.apptivityScore < 80).length },
                ]}
              />
              <HistoricalScoresChart
                title="Apptivia Score Trends"
                infoText="Weekly trend of the average Apptivia score for the selected filters and date range."
                data={historicalScores}
              />
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm mb-4 ring-1 ring-blue-100/80 shadow-blue-100/40">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{isPowerUser ? 'My Scorecard Snapshot' : 'Team Performance Scorecard'}</h2>
                <InfoTooltip text="Detailed KPI values and scorecard percentages for the current selection." />
              </div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-xs text-gray-500">
                  {isPowerUser ? 'Your performance metrics with optional benchmarking' : 'Detailed performance metrics and Apptivia Scores'}
                </div>
                <div className="text-[11px] text-gray-500 text-right whitespace-nowrap">{filterSummary}</div>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                {data.rows.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No data available for selected filters</div>
                ) : (
                  <table className="min-w-full text-xs text-left table-fixed">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-1 font-semibold w-40">Rep Name</th>
                        {kpiKeys.map(key => (
                          <th key={key} className="px-2 py-1 font-semibold text-center w-24">
                            {kpiLabels[key]}<br />
                            <span className='font-normal'>Goal varies</span>
                          </th>
                        ))}
                        <th className="px-2 py-1 font-semibold text-center w-24">Apptivia Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, idx) => {
                        const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
                        const rowClass = row.apptivityScore >= 100 ? 'bg-green-50' : '';
                        const scoreColor = row.apptivityScore >= 100 ? 'text-green-600' : row.apptivityScore >= 80 ? 'text-yellow-500' : 'text-red-500';
                        return (
                          <tr key={row.profile_id} className={`${rowClass} transition-all duration-200 hover:bg-gray-50 hover:shadow-sm`}>
                            <td className="px-2 py-1 font-medium flex items-center gap-1 w-40">
                              {medal && <span className="text-yellow-500">{medal}</span>} {row.name}
                            </td>
                            {kpiKeys.map(key => {
                              const kpi = row.kpis[key] || { value: 0, percentage: 0 };
                              const pct = Math.round(kpi.percentage);
                              const color = pct >= 100 ? 'text-green-600' : pct >= 80 ? 'text-yellow-500' : 'text-red-500';
                              const skillsetKey = KPI_SKILLSET_MAP[key];
                              const skillset = skillsetKey ? coachSkillsetsByName.get(skillsetKey) : null;
                              const isCoachActionable = isPowerUser && canViewCoach && pct < 80 && !!skillset;
                              return (
                                <td key={key} className="px-2 py-1 text-center w-24">
                                  {isCoachActionable ? (
                                    <button
                                      type="button"
                                      onClick={() => openCoachForKpi(key, skillset?.next_achievement)}
                                      className="w-full text-center hover:text-blue-700"
                                    >
                                      {Math.round(kpi.value * 10) / 10}<br />
                                      <span className={color}>{pct}%</span>
                                      <div className="text-[10px] text-blue-600 mt-0.5">Coach</div>
                                    </button>
                                  ) : (
                                    <>
                                      {Math.round(kpi.value * 10) / 10}<br />
                                      <span className={color}>{pct}%</span>
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-center w-24">
                              <span className={`font-bold ${scoreColor}`}>{row.apptivityScore}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {isPowerUser && (
              <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">Coaching Opportunities</h2>
                      <InfoTooltip text="Highlights KPIs below target and the recommended skillset to improve next." />
                    </div>
                    <p className="text-xs text-gray-500">
                      KPI areas needing focus with suggested skillset improvements and next achievements.
                    </p>
                  </div>
                  {canViewCoach && (
                    <button
                      onClick={() => navigate('/coach')}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100"
                    >
                      Open Coach
                    </button>
                  )}
                </div>

                {coachLoading ? (
                  <div className="text-xs text-gray-500">Loading coaching insights...</div>
                ) : coachError ? (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                    Coaching insights are taking longer than expected. You can still open Coach to explore skillsets.
                  </div>
                ) : coachingOpportunities.length === 0 ? (
                  <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    All KPIs are on track. Keep up the momentum!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {coachingOpportunities.map((item) => (
                      <button
                        key={item.kpiKey}
                        type="button"
                        onClick={() => openCoachForKpi(item.kpiKey, item.nextAchievement)}
                        className={`text-left border rounded-lg p-3 transition-all ${canViewCoach ? 'hover:shadow-md hover:border-blue-200' : ''}`}
                        disabled={!canViewCoach}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">{item.kpiLabel}</div>
                          <div className="text-xs font-semibold text-red-600">{item.percentage}%</div>
                        </div>
                        <div className="text-xs text-gray-500 mb-1">Suggested skillset</div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <span className="inline-flex w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.skillsetColor }} />
                          {item.skillsetName}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">Next achievement</div>
                        <div className="text-sm text-gray-900">{item.nextAchievement}</div>
                        {canViewCoach && (
                          <div className="mt-2 text-[11px] text-blue-600 font-semibold">View in Coach →</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
        <ScorecardFilters
          onFilterChange={handleFiltersChange}
          initialFilters={defaultFilters}
          resetSignal={filtersResetSignal}
          restrictToTeams={(isManager || isCoach) && teamId ? [teamId] : undefined}
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
      />
      <CoachingPlanPanel
        isOpen={coachingPlanOpen}
        onClose={() => setCoachingPlanOpen(false)}
        audienceLabel={isPowerUser ? 'My Coaching Plan' : filterSummary}
        scorecardData={data}
        coachData={planCoachData}
        historicalScores={historicalScores}
        kpiMetrics={kpiMetrics}
        kpiLabels={kpiLabels}
        currentUserId={userId}
        role={role}
        selectedMembers={planMembers}
      />
    </DashboardLayout>
  );
};

export default ApptiviaScorecard;

