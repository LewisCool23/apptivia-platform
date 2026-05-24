/**
 * Wallboard — Full-screen TV display for sales floor visibility.
 *
 * Designed to be displayed on office monitors/TVs. Auto-rotates through
 * configurable slides with animated transitions. Supports:
 *   1. Leaderboard      — top 10 reps ranked by score
 *   2. Top Performer    — spotlight on the current #1 rep
 *   3. Contests         — active contest standings
 *   4. Team Stats       — aggregate performance snapshot
 *   5. Badges           — recently earned badges
 *   6. This Week's Activity — live team KPI totals with week-over-week deltas
 *   7. Achievements     — recent achievement feed
 *   8. Goal Progress    — progress bars toward team goals
 *
 * Features:
 *   - Animated slide transitions (CSS fade/slide)
 *   - Celebration overlay (confetti for level-ups, rare badges, contest wins)
 *   - Multi-team filtering via dropdown
 *   - Configurable slides & per-slide duration via Org Settings
 *   - Supabase realtime for live updates
 *   - Press F for fullscreen, Space to pause, arrow keys to navigate
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { Maximize2, Minimize2, Trophy, TrendingUp, Zap, Users, Star, Flame, Award, ArrowLeft, Target } from 'lucide-react';
import { getMonday } from '../utils/dateUtils';
import { LEADERSHIP_ROLE_FILTER } from '../constants/roles';
import { ApptiviaLogo } from '../components/ApptiviaLogo';

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_SLIDES = ['leaderboard', 'spotlight', 'contests', 'team_stats', 'badges', 'activity', 'achievements', 'goals'];

const DEFAULT_SLIDE_CONFIG = {
  leaderboard:  { enabled: true, duration: 15 },
  spotlight:    { enabled: true, duration: 15 },
  contests:     { enabled: true, duration: 15 },
  team_stats:   { enabled: true, duration: 15 },
  badges:       { enabled: true, duration: 15 },
  activity:     { enabled: true, duration: 15 },
  achievements: { enabled: true, duration: 15 },
  goals:        { enabled: true, duration: 15 },
};

const LEVEL_COLORS = {
  Developing:   { bg: 'bg-apptivia-carbon-600',   badge: 'bg-apptivia-carbon-500' },
  Intermediate: { bg: 'bg-apptivia-coral',     badge: 'bg-apptivia-coral' },
  Proficient:   { bg: 'bg-apptivia-ink', badge: 'bg-apptivia-ink' },
  Elite:        { bg: 'bg-amber-500',  badge: 'bg-amber-500' },
  Master:       { bg: 'bg-rose-500',  badge: 'bg-rose-500' },
};

const RARITY_COLORS = {
  legendary: { border: '#FFD700', glow: 'shadow-yellow-400/40', label: 'text-yellow-300' },
  epic:      { border: '#FF4D2E', glow: 'shadow-apptivia-coral/40', label: 'text-apptivia-ink' },
  rare:      { border: '#FF4D2E', glow: 'shadow-apptivia-coral', label: 'text-apptivia-coral-tone-300' },
  common:    { border: '#71717A', glow: '',                      label: 'text-apptivia-carbon-400' },
};

const DIFFICULTY_COLORS = {
  easy:   { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  medium: { bg: 'bg-apptivia-coral/20',  text: 'text-apptivia-coral-tone-300',  border: 'border-apptivia-coral/30' },
  hard:   { bg: 'bg-apptivia-ink/20', text: 'text-apptivia-ink', border: 'border-apptivia-carbon-300/30' },
  expert: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
};

const CELEBRATION_COLORS = [
  '#FF4D2E', '#FF8A6B', '#F59E0B', '#16A34A', '#06B6D4',
  '#FF4D2E', '#71717A', '#FF8A6B', '#C8341B', '#F59E0B',
  '#FF4D2E', '#16A34A',
];
const CELEBRATION_CONFETTI = Array.from({ length: 90 }, (_, i) => ({
  color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
  left: Math.random() * 100,
  delay: Math.random() * 2,
  duration: 2.5 + Math.random() * 2.5,
  size: 7 + Math.random() * 9,
  rotation: Math.random() * 360,
  isRect: i % 3 !== 0,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

// getMonday imported from ../utils/dateUtils (X1 fix)

function formatKpiValue(val, unit) {
  if (unit === 'currency' || unit === 'dollars') return '$' + Math.round(val).toLocaleString();
  if (unit === 'percentage' || unit === 'percent') return val.toFixed(1) + '%';
  if (unit === 'minutes') return Math.round(val).toLocaleString() + 'm';
  if (unit === 'seconds') return Math.round(val).toLocaleString() + 's';
  return Math.round(val).toLocaleString();
}

// ── Data Hook ────────────────────────────────────────────────────────────────

function useWallboardData(orgId, selectedTeamId) {
  const [profiles, setProfiles] = useState([]);
  const [contests, setContests] = useState([]);
  const [recentBadges, setRecentBadges] = useState([]);
  const [teams, setTeams] = useState([]);
  const [weeklyKpis, setWeeklyKpis] = useState([]);
  const [priorWeekKpis, setPriorWeekKpis] = useState([]);
  const [recentAchievements, setRecentAchievements] = useState([]);
  const [wallboardConfig, setWallboardConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
      const monday = getMonday(new Date());
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      const priorMonday = new Date(monday.getTime() - 7 * 86400000);
      const priorSunday = new Date(monday.getTime() - 86400000);
      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];
      const priorMondayStr = priorMonday.toISOString().split('T')[0];
      const priorSundayStr = priorSunday.toISOString().split('T')[0];

      // Build profiles query with optional team filter (org-scoped)
      let profilesQuery = supabase
        .from('profiles')
        .select('id, first_name, last_name, apptivia_level, current_score, total_points, day_streak, role, team_id')
        .not('role', 'in', LEADERSHIP_ROLE_FILTER);
      if (orgId) profilesQuery = profilesQuery.eq('organization_id', orgId);
      if (selectedTeamId) profilesQuery = profilesQuery.eq('team_id', selectedTeamId);

      // Build org-scoped contest query
      let contestsQuery = supabase
        .from('active_contests')
        .select(`id, name, participant_type, start_date, end_date,
          contest_leaderboards(profile_id, rank, score,
            profile:profiles(first_name, last_name))`)
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(3);
      if (orgId) contestsQuery = contestsQuery.eq('organization_id', orgId);

      // Build org-scoped teams query
      let teamsQuery = supabase.from('teams').select('id, name').order('name');
      if (orgId) teamsQuery = teamsQuery.eq('organization_id', orgId);

      // Stage 1: parallel queries
      const [profilesRes, contestsRes, badgesRes, teamsRes, configRes] = await Promise.all([
        profilesQuery.order('total_points', { ascending: false }).limit(20),
        contestsQuery,
        orgId
          ? supabase
              .from('profile_badges')
              .select('id, badge_name, icon, color, rarity, earned_at, profile:profiles!inner(first_name, last_name, organization_id)')
              .eq('profile.organization_id', orgId)
              .gte('earned_at', since7d)
              .order('earned_at', { ascending: false })
              .limit(15)
          : Promise.resolve({ data: [] }),
        teamsQuery,
        orgId
          ? supabase.from('organizations').select('settings').eq('id', orgId).single()
          : Promise.resolve({ data: null }),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data);
      if (contestsRes.data) setContests(contestsRes.data);
      if (badgesRes.data) setRecentBadges(badgesRes.data);
      if (teamsRes.data) setTeams(teamsRes.data);
      if (configRes.data?.settings?.wallboard) setWallboardConfig(configRes.data.settings.wallboard);

      // Stage 2: queries that depend on profile IDs
      const profileIds = (profilesRes.data || []).map(p => p.id);
      if (profileIds.length > 0) {
        const [currentKpiRes, priorKpiRes, achievementsRes] = await Promise.all([
          supabase.from('kpi_values')
            .select('kpi_id, profile_id, value, kpi_metrics!inner(key, name, goal, unit, category, show_on_scorecard)')
            .in('profile_id', profileIds)
            .gte('period_start', mondayStr)
            .lte('period_start', sundayStr),
          supabase.from('kpi_values')
            .select('kpi_id, profile_id, value, kpi_metrics!inner(key, name, goal, unit, category, show_on_scorecard)')
            .in('profile_id', profileIds)
            .gte('period_start', priorMondayStr)
            .lte('period_start', priorSundayStr),
          supabase.from('profile_achievements')
            .select('id, profile_id, achievement_id, completed_at, points_awarded, achievement:achievements(name, description, difficulty, points, icon), profile:profiles(first_name, last_name)')
            .in('profile_id', profileIds)
            .gte('completed_at', since7d)
            .order('completed_at', { ascending: false })
            .limit(20),
        ]);

        // Aggregate KPI values per key across all profiles
        const aggregate = (data) => {
          const sums = {};
          (data || []).forEach(v => {
            const m = v.kpi_metrics;
            if (!m?.key) return;
            if (!sums[m.key]) sums[m.key] = { kpi_key: m.key, name: m.name, value: 0, goal: m.goal, unit: m.unit, category: m.category, show_on_scorecard: m.show_on_scorecard };
            sums[m.key].value += Number(v.value || 0);
          });
          return Object.values(sums);
        };

        setWeeklyKpis(aggregate(currentKpiRes.data));
        setPriorWeekKpis(aggregate(priorKpiRes.data));
        if (achievementsRes.data) setRecentAchievements(achievementsRes.data);
      }
    } catch (e) {
      console.error('Wallboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedTeamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live updates — F26: debounced to prevent refetch storms on rapid kpi_values changes
  useEffect(() => {
    let debounceTimer = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshRef.current += 1;
        fetchData();
      }, 500);
    };
    const channel = supabase
      .channel('wallboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_values' }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_badges' }, debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_achievements' }, debouncedFetch)
      .subscribe();

    return () => { if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  }, [fetchData]);

  return { profiles, contests, recentBadges, teams, weeklyKpis, priorWeekKpis, recentAchievements, wallboardConfig, loading };
}

// ── Clock ────────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="text-right">
      <div className="text-3xl font-bold text-white tabular-nums">{timeStr}</div>
      <div className="text-sm text-white/60">{dateStr}</div>
    </div>
  );
}

// ── Slide: Leaderboard ───────────────────────────────────────────────────────

function LeaderboardSlide({ profiles }) {
  const top10 = profiles.slice(0, 10);
  const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Trophy className="text-amber-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Leaderboard</h2>
        <span className="ml-auto text-white/40 text-lg">Live</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        {top10.map((rep, i) => {
          const level = rep.apptivia_level || 'Developing';
          const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Developing;
          const isTop3 = i < 3;

          return (
            <div
              key={rep.id}
              className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                isTop3
                  ? `${colors.bg} shadow-lg shadow-black/30`
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="w-10 text-center flex-shrink-0">
                {medals[i] ? (
                  <span className="text-3xl">{medals[i]}</span>
                ) : (
                  <span className="text-2xl font-bold text-white/40">#{i + 1}</span>
                )}
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-black ${isTop3 ? 'bg-white/20' : 'bg-white/10'}`}>
                {(rep.first_name?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-lg leading-tight truncate">
                  {rep.first_name} {rep.last_name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colors.badge} bg-opacity-60 text-white`}>
                    {level}
                  </span>
                  {rep.day_streak > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-300">
                      <Flame size={12} />
                      {rep.day_streak}d
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-black text-white tabular-nums">
                  {(rep.total_points || 0).toLocaleString()}
                </div>
                <div className="text-xs text-white/50">pts</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: Top Performer Spotlight ───────────────────────────────────────────

function SpotlightSlide({ profiles }) {
  const top = profiles[0];
  const runnerUp = profiles[1];
  const third = profiles[2];

  if (!top) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/40 text-2xl">No data yet</p>
      </div>
    );
  }

  const level = top.apptivia_level || 'Developing';
  const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Developing;
  const gap1 = runnerUp ? (top.total_points || 0) - (runnerUp.total_points || 0) : null;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <div className="text-center">
        <div className="text-6xl mb-4">{'\u{1F3C6}'}</div>
        <div className="text-2xl text-white/60 font-semibold uppercase tracking-widest mb-2">Top Performer</div>
        <div className="text-8xl font-black text-white leading-none mb-4">
          {top.first_name}<br />{top.last_name}
        </div>
        <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full ${colors.bg} text-white font-bold text-xl`}>
          <Star size={20} />
          {level}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        <div className="bg-white/10 rounded-lg p-6">
          <div className="text-5xl font-black text-amber-400 tabular-nums">
            {(top.total_points || 0).toLocaleString()}
          </div>
          <div className="text-white/60 mt-1 font-medium">Total Points</div>
        </div>
        <div className="bg-white/10 rounded-lg p-6">
          <div className="text-5xl font-black text-apptivia-coral-tone-300 tabular-nums">
            {top.current_score || 0}%
          </div>
          <div className="text-white/60 mt-1 font-medium">Scorecard</div>
        </div>
        <div className="bg-white/10 rounded-lg p-6">
          <div className="text-5xl font-black text-orange-400 tabular-nums flex items-center justify-center gap-2">
            <Flame size={40} />
            {top.day_streak || 0}
          </div>
          <div className="text-white/60 mt-1 font-medium">Day Streak</div>
        </div>
      </div>

      {(runnerUp || third) && (
        <div className="flex gap-6 items-end">
          {runnerUp && (
            <div className="text-center bg-white/5 rounded-lg px-6 py-3">
              <div className="text-3xl mb-1">{'\u{1F948}'}</div>
              <div className="text-white font-bold">{runnerUp.first_name} {runnerUp.last_name}</div>
              <div className="text-white/50 text-sm">{(runnerUp.total_points || 0).toLocaleString()} pts</div>
              {gap1 !== null && <div className="text-xs text-red-400 mt-1">-{gap1.toLocaleString()} pts behind</div>}
            </div>
          )}
          {third && (
            <div className="text-center bg-white/5 rounded-lg px-6 py-3">
              <div className="text-3xl mb-1">{'\u{1F949}'}</div>
              <div className="text-white font-bold">{third.first_name} {third.last_name}</div>
              <div className="text-white/50 text-sm">{(third.total_points || 0).toLocaleString()} pts</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slide: Contests ──────────────────────────────────────────────────────────

function ContestsSlide({ contests }) {
  if (!contests.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Award size={80} className="text-white/20" />
        <p className="text-white/40 text-3xl font-bold">No Active Contests</p>
        <p className="text-white/25 text-lg">Create a contest to display standings here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Award className="text-yellow-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Active Contests</h2>
      </div>

      <div className="grid gap-6 flex-1">
        {contests.map((contest) => {
          const entries = Array.isArray(contest.contest_leaderboards)
            ? [...contest.contest_leaderboards].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5)
            : [];
          const end = contest.end_date ? new Date(contest.end_date) : null;
          const daysLeft = end ? Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))) : null;

          return (
            <div key={contest.id} className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">{contest.name}</h3>
                {daysLeft !== null && (
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${daysLeft <= 3 ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/60'}`}>
                    {daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
                  </span>
                )}
              </div>

              {entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((entry, i) => (
                    <div key={entry.profile_id || i} className="flex items-center gap-4">
                      <span className="text-xl w-8">{['\u{1F947}','\u{1F948}','\u{1F949}','4\uFE0F\u20E3','5\uFE0F\u20E3'][i] || `${i+1}.`}</span>
                      <span className="flex-1 text-white font-semibold text-lg truncate">
                        {entry.profile ? `${entry.profile.first_name || ''} ${entry.profile.last_name || ''}`.trim() || 'Rep' : 'Rep'}
                      </span>
                      <span className="text-amber-400 font-black text-xl tabular-nums">
                        {typeof entry.score === 'number' ? entry.score.toLocaleString() : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/30 text-center py-4">Standings loading...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: Team Stats ────────────────────────────────────────────────────────

function TeamStatsSlide({ profiles }) {
  if (!profiles.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/40 text-2xl">No data yet</p>
      </div>
    );
  }

  const totalPoints  = profiles.reduce((s, p) => s + (p.total_points || 0), 0);
  const avgScore     = Math.round(profiles.reduce((s, p) => s + (p.current_score || 0), 0) / profiles.length);
  const topStreak    = Math.max(...profiles.map(p => p.day_streak || 0));
  const totalMembers = profiles.length;

  const levelCounts = profiles.reduce((acc, p) => {
    const l = p.apptivia_level || 'Developing';
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { label: 'Team Members', value: totalMembers, icon: Users, color: 'text-apptivia-coral-tone-300' },
    { label: 'Total Points', value: totalPoints.toLocaleString(), icon: Zap, color: 'text-amber-400' },
    { label: 'Avg Scorecard', value: `${avgScore}%`, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Longest Streak', value: `${topStreak}d`, icon: Flame, color: 'text-orange-400' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <TrendingUp className="text-green-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Team Performance</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-lg p-8 flex items-center gap-6">
            <Icon size={48} className={color} />
            <div>
              <div className="text-5xl font-black text-white tabular-nums">{value}</div>
              <div className="text-white/50 text-lg font-medium mt-1">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-white/50 text-sm uppercase tracking-widest mb-3 font-semibold">Level Distribution</div>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(LEVEL_COLORS).map(([level, colors]) => {
            const count = levelCounts[level] || 0;
            if (count === 0) return null;
            return (
              <div key={level} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${colors.bg}`}>
                <span className="text-white font-bold text-lg">{count}</span>
                <span className="text-white/80 font-medium">{level}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Slide: Recent Badges ─────────────────────────────────────────────────────

function BadgesSlide({ recentBadges }) {
  if (!recentBadges.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Award size={80} className="text-white/20" />
        <p className="text-white/40 text-3xl font-bold">No Badges Earned This Week</p>
        <p className="text-white/25 text-lg">Badges will appear here as the team earns them</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Award className="text-amber-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Badges Earned</h2>
        <span className="ml-auto text-white/40 text-lg">Last 7 days</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 content-start">
        {recentBadges.map((b) => {
          const rarity = b.rarity?.toLowerCase() || 'common';
          const rc = RARITY_COLORS[rarity] || RARITY_COLORS.common;
          const name = `${b.profile?.first_name || ''} ${b.profile?.last_name || ''}`.trim() || 'Rep';
          const when = new Date(b.earned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div
              key={b.id}
              className={`flex items-center gap-4 bg-white/5 border rounded-lg p-4 shadow-lg ${rc.glow}`}
              style={{ borderColor: rc.border }}
            >
              <div className="text-4xl flex-shrink-0">{b.icon || '\u{1F3C6}'}</div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${rc.label}`}>{rarity}</div>
                <div className="text-white font-bold text-lg leading-tight truncate">{b.badge_name}</div>
                <div className="text-white/60 text-sm truncate">{name}</div>
                <div className="text-white/30 text-xs mt-0.5">{when}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: This Week's Activity ──────────────────────────────────────────────

function ActivitySlide({ weeklyKpis, priorWeekKpis }) {
  if (!weeklyKpis.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Zap size={80} className="text-white/20" />
        <p className="text-white/40 text-3xl font-bold">No Activity Data</p>
        <p className="text-white/25 text-lg">KPI data will appear as it's recorded this week</p>
      </div>
    );
  }

  const priorMap = {};
  priorWeekKpis.forEach(k => { priorMap[k.kpi_key] = k.value; });

  // Show top 8 KPIs by value
  const top8 = [...weeklyKpis].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Zap className="text-cyan-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">This Week's Activity</h2>
        <span className="ml-auto text-white/40 text-lg">Live</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 content-start">
        {top8.map((kpi) => {
          const prior = priorMap[kpi.kpi_key] || 0;
          const delta = prior > 0 ? ((kpi.value - prior) / prior * 100) : 0;
          const isUp = delta > 2;
          const isDown = delta < -2;

          return (
            <div key={kpi.kpi_key} className="bg-white/5 border border-white/10 rounded-lg p-6 flex flex-col justify-center">
              <div className="text-white/50 text-sm font-medium mb-2 truncate">{kpi.name}</div>
              <div className="text-4xl font-black text-white tabular-nums">
                {formatKpiValue(kpi.value, kpi.unit)}
              </div>
              {prior > 0 && (
                <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${
                  isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white/40'
                }`}>
                  {isUp ? '\u2191' : isDown ? '\u2193' : '\u2192'}
                  {Math.abs(delta).toFixed(1)}% vs last week
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: Recent Achievements ───────────────────────────────────────────────

function AchievementsSlide({ recentAchievements }) {
  if (!recentAchievements.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Star size={80} className="text-white/20" />
        <p className="text-white/40 text-3xl font-bold">No Recent Achievements</p>
        <p className="text-white/25 text-lg">Achievements will appear as the team earns them</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Star className="text-yellow-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Recent Achievements</h2>
        <span className="ml-auto text-white/40 text-lg">Last 7 days</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 content-start">
        {recentAchievements.map((a) => {
          const name = `${a.profile?.first_name || ''} ${a.profile?.last_name || ''}`.trim() || 'Rep';
          const diff = a.achievement?.difficulty || 'medium';
          const dc = DIFFICULTY_COLORS[diff] || DIFFICULTY_COLORS.medium;
          const when = new Date(a.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={a.id} className={`flex items-center gap-4 bg-white/5 border ${dc.border} rounded-lg p-4`}>
              <div className="text-4xl flex-shrink-0">{a.achievement?.icon || '\u{1F3C5}'}</div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-bold text-lg leading-tight truncate">
                  {a.achievement?.name || 'Achievement'}
                </div>
                <div className="text-white/60 text-sm truncate">{name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${dc.bg} ${dc.text}`}>{diff}</span>
                  <span className="text-amber-400 text-xs font-bold">+{a.points_awarded || a.achievement?.points || 0} pts</span>
                  <span className="text-white/30 text-xs">{when}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: Goal Progress ─────────────────────────────────────────────────────

function GoalProgressSlide({ weeklyKpis, profileCount }) {
  if (!weeklyKpis.length || !profileCount) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Target size={80} className="text-white/20" />
        <p className="text-white/40 text-3xl font-bold">No Goal Data</p>
        <p className="text-white/25 text-lg">Goal progress will appear once KPI data is available</p>
      </div>
    );
  }

  const kpisWithProgress = weeklyKpis
    .filter(k => k.goal > 0)
    .map(k => {
      const teamGoal = k.goal * profileCount;
      const pct = teamGoal > 0 ? (k.value / teamGoal) * 100 : 0;
      return { ...k, teamGoal, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const overallPct = kpisWithProgress.length > 0
    ? Math.round(kpisWithProgress.reduce((s, k) => s + k.pct, 0) / kpisWithProgress.length)
    : 0;

  const pctColor = (pct) => pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const pctText = (pct) => pct >= 80 ? 'text-green-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Target className="text-emerald-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Goal Progress</h2>
        <div className="ml-auto text-right">
          <div className={`text-3xl font-black ${pctText(overallPct)}`}>{overallPct}%</div>
          <div className="text-white/40 text-sm">Team Average</div>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {kpisWithProgress.slice(0, 10).map((kpi) => (
          <div key={kpi.kpi_key} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-semibold text-lg">{kpi.name}</span>
              <span className={`font-bold ${pctText(kpi.pct)}`}>
                {formatKpiValue(kpi.value, kpi.unit)} / {formatKpiValue(kpi.teamGoal, kpi.unit)} ({Math.round(kpi.pct)}%)
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${pctColor(kpi.pct)}`}
                style={{ width: `${Math.min(100, kpi.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Celebration Overlay ──────────────────────────────────────────────────────

function WallboardCelebration({ orgId, enabled }) {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const dismissTimer = useRef(null);
  const seenIds = useRef(new Set());

  useEffect(() => {
    if (!orgId || enabled === false) return;

    const channel = supabase
      .channel(`wallboard-celebrations-${orgId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        ...(orgId ? { filter: `organization_id=eq.${orgId}` } : {}),
      }, (payload) => {
        const n = payload.new;
        if (seenIds.current.has(n.id)) return;
        if (!['level_up', 'rare_badge_earned', 'contest_winner'].includes(n.type)) return;
        seenIds.current.add(n.id);

        setQueue(q => [...q, {
          id: n.id,
          type: n.type,
          title: n.title || 'Celebration!',
          message: n.message || '',
          icon: n.icon || (n.type === 'level_up' ? '\u{1F680}' : n.type === 'contest_winner' ? '\u{1F3C6}' : '\u{1F48E}'),
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, enabled]);

  // Process queue
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setActive(null), 8000);
    return () => clearTimeout(dismissTimer.current);
  }, [active, queue]);

  if (!active) return null;

  const typeLabel = active.type === 'level_up' ? 'Level Up!' : active.type === 'contest_winner' ? 'Contest Winner!' : 'Rare Badge!';

  return (
    <>
      <style>{`
        @keyframes wbConfettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes wbCardIn {
          0%   { transform: translate(-50%, -45%); opacity: 0; }
          60%  { transform: translate(-50%, -51%); }
          100% { transform: translate(-50%, -50%); opacity: 1; }
        }
      `}</style>

      <div
        onClick={() => { clearTimeout(dismissTimer.current); setActive(null); }}
        style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', cursor: 'pointer' }}
      >
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {CELEBRATION_CONFETTI.map((p, i) => (
            <div key={i} style={{
              position: 'absolute', top: -16, left: `${p.left}%`,
              width: p.size, height: p.isRect ? p.size * 0.55 : p.size,
              borderRadius: p.isRect ? 2 : '50%', backgroundColor: p.color,
              animation: `wbConfettiFall ${p.duration}s ${p.delay}s linear forwards`,
              transform: `rotate(${p.rotation}deg)`,
            }} />
          ))}
        </div>

        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            animation: 'wbCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
            background: 'linear-gradient(145deg, #0A0A0B 0%, #27272A 50%, #0A0A0B 100%)',
            border: '2px solid rgba(245,158,11,0.5)', borderRadius: 28,
            padding: '52px 72px 44px', textAlign: 'center', minWidth: 460, maxWidth: '88vw', cursor: 'default',
            boxShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 0 80px rgba(245,158,11,0.25), 0 40px 80px rgba(0,0,0,0.6)',
          }}
        >
          <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 20 }}>{active.icon}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: '#fcd34d', textTransform: 'uppercase', marginBottom: 16 }}>
            {typeLabel}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#F7F5F2', marginBottom: 10, lineHeight: 1.25 }}>{active.title}</div>
          {active.message && <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 380, margin: '0 auto' }}>{active.message}</div>}
          {queue.length > 0 && (
            <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
              +{queue.length} more celebration{queue.length > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3), transparent)', margin: '28px 0 18px' }} />
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, letterSpacing: '0.05em' }}>Click anywhere to dismiss</div>
        </div>
      </div>
    </>
  );
}

// ── Slide Indicator ──────────────────────────────────────────────────────────

function SlideIndicator({ slides, current, onSelect }) {
  return (
    <div className="flex items-center gap-2">
      {slides.map((id, i) => (
        <button
          key={id}
          onClick={() => onSelect(i)}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'w-8 bg-white' : 'w-3 bg-white/30 hover:bg-white/50'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main Wallboard ───────────────────────────────────────────────────────────

export default function Wallboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  // Multi-team filter
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Data
  const {
    profiles, contests, recentBadges, teams,
    weeklyKpis, priorWeekKpis, recentAchievements,
    wallboardConfig, loading,
  } = useWallboardData(orgId, selectedTeamId);

  // Slide config
  const slideConfig = wallboardConfig?.slides || DEFAULT_SLIDE_CONFIG;
  const celebrationsEnabled = wallboardConfig?.celebrations !== false;

  const activeSlides = useMemo(() =>
    ALL_SLIDES.filter(s => (slideConfig[s]?.enabled) !== false),
    [slideConfig]
  );

  // Slide state with animation
  const [displayIndex, setDisplayIndex] = useState(0);
  const [animClass, setAnimClass] = useState('wb-slide-enter');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const animTimer = useRef(null);

  // Keep displayIndex in bounds when activeSlides changes
  useEffect(() => {
    if (displayIndex >= activeSlides.length && activeSlides.length > 0) {
      setDisplayIndex(0);
    }
  }, [activeSlides.length, displayIndex]);

  const currentSlideDuration = useMemo(() =>
    (slideConfig[activeSlides[displayIndex]]?.duration || 15) * 1000,
    [slideConfig, activeSlides, displayIndex]
  );

  const changeSlide = useCallback((newIndex) => {
    clearTimeout(animTimer.current);
    setAnimClass('wb-slide-exit');
    animTimer.current = setTimeout(() => {
      setDisplayIndex(newIndex);
      setAnimClass('wb-slide-enter');
    }, 300);
  }, []);

  const advance = useCallback(() => {
    if (activeSlides.length === 0) return;
    changeSlide((displayIndex + 1) % activeSlides.length);
  }, [displayIndex, activeSlides.length, changeSlide]);

  // Auto-advance timer
  useEffect(() => {
    if (paused || activeSlides.length === 0) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(advance, currentSlideDuration);
    return () => clearInterval(timerRef.current);
  }, [advance, paused, currentSlideDuration]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') changeSlide((displayIndex - 1 + activeSlides.length) % activeSlides.length);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, changeSlide, displayIndex, activeSlides.length, toggleFullscreen]);

  const currentSlide = activeSlides[displayIndex];

  return (
    <div className="min-h-screen bg-apptivia-ink flex flex-col select-none overflow-hidden">
      {/* Celebration overlay */}
      <WallboardCelebration orgId={orgId} enabled={celebrationsEnabled} />

      {/* Transition CSS */}
      <style>{`
        @keyframes wbSlideEnter {
          0%   { opacity: 0; transform: translateX(40px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes wbSlideExit {
          0%   { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-40px); }
        }
        .wb-slide-enter { animation: wbSlideEnter 0.3s ease-out forwards; }
        .wb-slide-exit  { animation: wbSlideExit 0.3s ease-in forwards; }
      `}</style>

      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-apptivia-ink rounded-lg flex items-center justify-center">
            <Trophy size={18} className="text-white" />
          </div>
          <ApptiviaLogo dark className="text-xl" />
          <span className="text-white/30 text-sm">Sales Floor</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Team filter */}
          {teams.length > 1 && (
            <select
              value={selectedTeamId || ''}
              onChange={(e) => setSelectedTeamId(e.target.value || null)}
              className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-apptivia-coral appearance-none cursor-pointer"
            >
              <option value="" className="bg-apptivia-ink">All Teams</option>
              {teams.map(t => (
                <option key={t.id} value={t.id} className="bg-apptivia-ink">{t.name}</option>
              ))}
            </select>
          )}

          <SlideIndicator
            slides={activeSlides}
            current={displayIndex}
            onSelect={(i) => { changeSlide(i); setPaused(true); setTimeout(() => setPaused(false), currentSlideDuration); }}
          />
        </div>

        <div className="flex items-center gap-4">
          <Clock />
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-sm font-medium"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Toggle fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Slide area */}
      <div className="flex-1 px-10 py-8 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : activeSlides.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/40 text-2xl">No slides enabled. Configure slides in Organization Settings.</p>
          </div>
        ) : (
          <div key={`${displayIndex}-${currentSlide}`} className={`h-full ${animClass}`}>
            {currentSlide === 'leaderboard'   && <LeaderboardSlide profiles={profiles} />}
            {currentSlide === 'spotlight'     && <SpotlightSlide profiles={profiles} />}
            {currentSlide === 'contests'      && <ContestsSlide contests={contests} />}
            {currentSlide === 'team_stats'    && <TeamStatsSlide profiles={profiles} />}
            {currentSlide === 'badges'        && <BadgesSlide recentBadges={recentBadges} />}
            {currentSlide === 'activity'      && <ActivitySlide weeklyKpis={weeklyKpis} priorWeekKpis={priorWeekKpis} />}
            {currentSlide === 'achievements'  && <AchievementsSlide recentAchievements={recentAchievements} />}
            {currentSlide === 'goals'         && <GoalProgressSlide weeklyKpis={weeklyKpis} profileCount={profiles.length} />}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-8 py-3 border-t border-white/5 text-white/25 text-xs">
        <span>{'\u2190'} {'\u2192'} Navigate  {'\u00B7'}  Space Pause  {'\u00B7'}  F Fullscreen</span>
        {paused && <span className="text-amber-400">{'\u23F8'} Paused</span>}
        <span>Auto-advances every {currentSlideDuration / 1000}s</span>
      </div>
    </div>
  );
}
