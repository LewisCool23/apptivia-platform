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
import { exportCoachDataToCSV } from '../utils/exportUtils';
import ConfigureModal from '../components/ConfigureModal';
import ConfigurePanel from '../components/ConfigurePanel';
import SkillsetDetailsModal from '../components/SkillsetDetailsModal';
import { SkillsetCardSkeleton } from '../components/Skeleton';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import InfoTooltip from '../components/InfoTooltip';
import CoachingPlanPanel from '../components/CoachingPlanPanel';
import ApptiviaLevelInfoModal from '../components/ApptiviaLevelInfoModal';
import ShareCoachSnapshotModal from '../components/ShareCoachSnapshotModal';
import { supabase } from '../supabaseClient';

export default function Coach() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const isManager = role === 'manager';
  const isCoach = role === 'coach';
  const isPowerUser = role === 'power_user';
  const isAdmin = role === 'admin';
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
  const [coachingPlanOpen, setCoachingPlanOpen] = useState(false);
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [loadFullData, setLoadFullData] = useState(false);
  const deepLinkHandled = React.useRef(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(isPowerUser);
  const [userAchievementCount, setUserAchievementCount] = useState(0);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch individual user profile data for power users to show cumulative points
  useEffect(() => {
    if (!isPowerUser || !userId) return;
    
    async function fetchUserProfile() {
      try {
        setLoadingProfile(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, apptivia_level, total_points')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        setUserProfile(data);
        
        // Also fetch achievement count for this user
        const { count, error: countError } = await supabase
          .from('profile_achievements')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', userId);
        
        if (!countError) {
          setUserAchievementCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    
    fetchUserProfile();
  }, [isPowerUser, userId]);

  useEffect(() => {
    if (filtersInitialized) return;
    if (!userId) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, userId]);

  const { data: summaryData, loading: summaryLoading, error: summaryError } = useCoachData(
    filters.departments,
    filters.teams,
    filters.members,
    { mode: 'summary' }
  );

  const { data: fullData, loading: fullLoading, error: fullError } = useCoachData(
    filters.departments,
    filters.teams,
    filters.members,
    { mode: 'full', enabled: loadFullData }
  );

  const data = fullData?.skillsets?.length ? fullData : summaryData;
  const loading = summaryLoading || (loadFullData && fullLoading) || loadingProfile;
  const error = summaryError || fullError;

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
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday.toISOString(), end: sunday.toISOString() };
      }
    }
  }, [filters.dateRange]);

  const { data: scorecardData } = useScorecardData(
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

  const handleExport = () => {
    if (!canExport) return;
    if (!loading && !error) {
      exportCoachDataToCSV(data, filters);
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

      // Search achievements
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

      // Search skillsets
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
              <h1 className="text-2xl font-bold text-blue-700">Apptivia Coach</h1>
              <InfoTooltip text="Overview of coaching performance, mastery progress, and achievements for the selected audience." />
            </div>
            <p className="text-gray-500 text-sm">
              {isPowerUser ? 'Your personalized coaching insights and progress' : 'Personalized coaching insights and progress'}
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
                  label: 'See Coaching Plan',
                  onClick: () => setCoachingPlanOpen(true),
                },
                {
                  label: 'Create Coaching Plan',
                  onClick: () => navigate('/coaching-plans'),
                },
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
              <div className="bg-gray-200 rounded-lg px-6 py-6 flex-1 min-w-[300px] animate-pulse" style={{ height: '280px' }} />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Error: {error}</div>
          ) : (
            <div className="flex flex-wrap gap-4 items-center text-sm text-gray-600">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg px-4 py-4 flex-1 min-w-[280px] flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                <div className="text-base font-semibold mb-1">{isPowerUser && userProfile ? userProfile.apptivia_level : data.avgLevel}</div>
                <div className="text-xs mb-2 flex items-center gap-2">
                  {isPowerUser ? 'My Apptivia Level' : (filters.teams.length > 0 ? 'Current Team Apptivia Level' : 'Current Apptivia Level')}
                  <InfoTooltip
                    text="Activity data feeds the weekly scorecard. Consistent KPI attainment earns achievements and badges, which build skillset mastery and lead to Apptivia Level promotions over time. Historical data informs coaching and AI guidance."
                    iconClassName="text-white/80 hover:text-white"
                    onClick={() => setLevelInfoOpen(true)}
                    ariaLabel="Open Apptivia Level details"
                  />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-lg font-bold">{isPowerUser && userProfile ? userProfile.total_points : data.avgPoints}</div>
                    <div className="text-xs">Level Points</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{data.avgScore}%</div>
                    <div className="text-xs">{isPowerUser ? 'My Score' : (filters.teams.length > 0 ? 'Team Average Score' : 'Average Score')}</div>
                  </div>
                </div>
                <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-white transition-all duration-500 ease-out" style={{ width: `${Math.min(data.levelProgress, 100)}%` }}></div>
                </div>
                <div className="text-xs">
                  Progress to Next Level • {data.levelProgress}%{data.pointsToNextLevel > 0 ? ` • ${data.pointsToNextLevel} pts to go` : ''}
                </div>
                <div className="w-full mt-4 pt-4 border-t border-white border-opacity-10 flex justify-between items-center">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="text-lg font-bold">{data.scorecardStreak}</div>
                    <div className="text-xs text-white/80">Scorecard Streak</div>
                  </div>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="text-lg font-bold">{data.totalBadges}</div>
                    <div className="text-xs text-white/80">Badges</div>
                  </div>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="text-lg font-bold">{isPowerUser ? userAchievementCount : data.totalAchievements}</div>
                    <div className="text-xs text-white/80">Achievements</div>
                  </div>
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="text-lg font-bold">{isPowerUser && userProfile ? userProfile.total_points : data.totalPoints}</div>
                    <div className="text-xs text-white/80">Points</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {isManager && !loading && !error && (
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-base font-semibold">Manager Coaching Playbook</h2>
              <InfoTooltip text="Actions to mobilize your team and operationalize coaching plan recommendations." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
              <div className="border rounded-lg p-3">
                <div className="font-semibold text-gray-900 mb-1">Mobilize weekly focus</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Set 1–2 KPI focus areas per week based on the coaching plan.</li>
                  <li>Run a 10-minute Monday kickoff to align targets and tactics.</li>
                  <li>Celebrate small wins mid-week to keep momentum.</li>
                </ul>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-semibold text-gray-900 mb-1">Increase efficient activity</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Block daily prospecting windows and protect them from meetings.</li>
                  <li>Encourage time-boxed call blocks aligned to peak connect hours.</li>
                  <li>Share top-performer talk tracks and cadences with the team.</li>
                </ul>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-semibold text-gray-900 mb-1">Implement coaching plans</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Assign each rep one KPI improvement action per week.</li>
                  <li>Review progress in 1:1s with quick scorecard check-ins.</li>
                  <li>Use achievements to reward consistent KPI execution.</li>
                </ul>
              </div>
              <div className="border rounded-lg p-3">
                <div className="font-semibold text-gray-900 mb-1">Sustain team energy</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Rotate peer coaching and deal reviews for shared learning.</li>
                  <li>Track a visible leaderboard for targeted KPIs.</li>
                  <li>End the week with retro notes and reset next week’s focus.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
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
                      <h3 className="font-bold text-base text-gray-900 mb-1">{skillset.skillset_name}</h3>
                      <p className="text-xs text-gray-600 break-words line-clamp-2 min-h-[2.5rem]">{skillset.description}</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${skillset.progress}%`, backgroundColor: skillset.color }}></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500">{audienceLabel} Progress</span>
                      <span className="font-bold" style={{ color: skillset.color }}>{skillset.progress}%</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 mb-2">
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Next Achievement</div>
                    <div className="text-xs text-gray-900 break-words line-clamp-2">{skillset.next_achievement}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 mb-2">
                    <div className="text-[10px] font-medium text-gray-500 mb-0.5">Skillset Points</div>
                    <div className="text-xs font-semibold text-gray-900">{skillset.points}</div>
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
          highlightAchievementName={highlightAchievement}
        />
      )}
      <CoachingPlanPanel
        isOpen={coachingPlanOpen}
        onClose={() => setCoachingPlanOpen(false)}
        audienceLabel={audienceLabel}
        scorecardData={scorecardData}
        coachData={data}
        historicalScores={historicalScores}
        currentUserId={userId}
        role={role}
        selectedMembers={filters.members}
      />
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
    </DashboardLayout>
  );
}
