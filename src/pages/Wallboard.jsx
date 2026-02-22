/**
 * Wallboard — Full-screen TV display for sales floor visibility.
 *
 * Designed to be displayed on office monitors/TVs. Auto-rotates through:
 *   1. Leaderboard  — top 10 reps ranked by score
 *   2. Top Performer — spotlight on the current #1 rep
 *   3. Contests     — active contest standings
 *   4. Team Stats   — aggregate performance snapshot
 *
 * Uses Supabase realtime on kpi_values so scores update live.
 * No nav chrome — press F for fullscreen, Esc to exit.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Maximize2, Minimize2, Trophy, TrendingUp, Zap, Users, Star, Flame, Award } from 'lucide-react';

const SLIDE_DURATION = 15000; // ms per slide
const SLIDES = ['leaderboard', 'spotlight', 'contests', 'team_stats'];

const LEVEL_COLORS = {
  Developing:   { bg: 'from-slate-600 to-slate-700',   badge: 'bg-slate-500' },
  Intermediate: { bg: 'from-blue-600 to-blue-700',     badge: 'bg-blue-500' },
  Proficient:   { bg: 'from-purple-600 to-purple-700', badge: 'bg-purple-500' },
  Elite:        { bg: 'from-amber-500 to-orange-600',  badge: 'bg-amber-500' },
  Master:       { bg: 'from-rose-500 to-pink-600',     badge: 'bg-rose-500' },
};

function useWallboardData() {
  const [profiles, setProfiles] = useState([]);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const [profilesRes, contestsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, apptivia_level, current_score, total_points, day_streak, role')
          .order('total_points', { ascending: false })
          .limit(20),
        supabase
          .from('contests')
          .select('id, title, contest_type, start_date, end_date, entries')
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(3),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data);
      if (contestsRes.data) setContests(contestsRes.data);
    } catch (e) {
      console.error('Wallboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live updates when KPI values change
  useEffect(() => {
    const channel = supabase
      .channel('wallboard_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_values' }, () => {
        refreshRef.current += 1;
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { profiles, contests, loading };
}

// ── Clock ──────────────────────────────────────────────────────────────────

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

// ── Slide: Leaderboard ─────────────────────────────────────────────────────

function LeaderboardSlide({ profiles }) {
  const top10 = profiles.slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-8">
        <Trophy className="text-amber-400" size={40} />
        <h2 className="text-5xl font-black text-white tracking-tight">Leaderboard</h2>
        <span className="ml-auto text-white/40 text-lg">Live</span>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {top10.map((rep, i) => {
          const level = rep.apptivia_level || 'Developing';
          const colors = LEVEL_COLORS[level] || LEVEL_COLORS.Developing;
          const isTop3 = i < 3;

          return (
            <div
              key={rep.id}
              className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${
                isTop3
                  ? `bg-gradient-to-r ${colors.bg} shadow-lg shadow-black/30`
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              {/* Rank */}
              <div className="w-10 text-center flex-shrink-0">
                {medals[i] ? (
                  <span className="text-3xl">{medals[i]}</span>
                ) : (
                  <span className="text-2xl font-bold text-white/40">#{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-black ${isTop3 ? 'bg-white/20' : 'bg-white/10'}`}>
                {(rep.first_name?.[0] || '?').toUpperCase()}
              </div>

              {/* Info */}
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

              {/* Score */}
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

// ── Slide: Top Performer Spotlight ─────────────────────────────────────────

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
        <div className="text-6xl mb-4">🏆</div>
        <div className="text-2xl text-white/60 font-semibold uppercase tracking-widest mb-2">Top Performer</div>
        <div className="text-8xl font-black text-white leading-none mb-4">
          {top.first_name}<br />{top.last_name}
        </div>
        <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r ${colors.bg} text-white font-bold text-xl`}>
          <Star size={20} />
          {level}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 text-center">
        <div className="bg-white/10 rounded-2xl p-6">
          <div className="text-5xl font-black text-amber-400 tabular-nums">
            {(top.total_points || 0).toLocaleString()}
          </div>
          <div className="text-white/60 mt-1 font-medium">Total Points</div>
        </div>
        <div className="bg-white/10 rounded-2xl p-6">
          <div className="text-5xl font-black text-blue-400 tabular-nums">
            {top.current_score || 0}%
          </div>
          <div className="text-white/60 mt-1 font-medium">Scorecard</div>
        </div>
        <div className="bg-white/10 rounded-2xl p-6">
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
            <div className="text-center bg-white/5 rounded-xl px-6 py-3">
              <div className="text-3xl mb-1">🥈</div>
              <div className="text-white font-bold">{runnerUp.first_name} {runnerUp.last_name}</div>
              <div className="text-white/50 text-sm">{(runnerUp.total_points || 0).toLocaleString()} pts</div>
              {gap1 !== null && <div className="text-xs text-red-400 mt-1">-{gap1.toLocaleString()} pts behind</div>}
            </div>
          )}
          {third && (
            <div className="text-center bg-white/5 rounded-xl px-6 py-3">
              <div className="text-3xl mb-1">🥉</div>
              <div className="text-white font-bold">{third.first_name} {third.last_name}</div>
              <div className="text-white/50 text-sm">{(third.total_points || 0).toLocaleString()} pts</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slide: Contests ────────────────────────────────────────────────────────

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
          const entries = Array.isArray(contest.entries)
            ? [...contest.entries].sort((a, b) => (b.value ?? b.score ?? 0) - (a.value ?? a.score ?? 0)).slice(0, 5)
            : [];
          const end = contest.end_date ? new Date(contest.end_date) : null;
          const daysLeft = end ? Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))) : null;

          return (
            <div key={contest.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">{contest.title}</h3>
                {daysLeft !== null && (
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${daysLeft <= 3 ? 'bg-red-500/30 text-red-300' : 'bg-white/10 text-white/60'}`}>
                    {daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}
                  </span>
                )}
              </div>

              {entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-xl w-8">{['🥇','🥈','🥉','4️⃣','5️⃣'][i] || `${i+1}.`}</span>
                      <span className="flex-1 text-white font-semibold text-lg truncate">{entry.name || entry.participant_name || 'Rep'}</span>
                      <span className="text-amber-400 font-black text-xl tabular-nums">
                        {typeof entry.value === 'number' ? entry.value.toLocaleString() : (entry.score ?? '-')}
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

// ── Slide: Team Stats ──────────────────────────────────────────────────────

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
    { label: 'Team Members', value: totalMembers, icon: Users, color: 'text-blue-400' },
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

      <div className="grid grid-cols-2 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-8 flex items-center gap-6">
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
              <div key={level} className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${colors.bg}`}>
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

// ── Slide Indicator ────────────────────────────────────────────────────────

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

// ── Main Wallboard ──────────────────────────────────────────────────────────

export default function Wallboard() {
  const { profiles, contests, loading } = useWallboardData();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const advance = useCallback(() => {
    setSlideIndex((i) => (i + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(advance, SLIDE_DURATION);
    return () => clearInterval(timerRef.current);
  }, [advance, paused]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard: left/right arrows to navigate, space to pause, F for fullscreen
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') setSlideIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance]);

  const currentSlide = SLIDES[slideIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-blue-950 flex flex-col select-none overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
            <Trophy size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Apptivia</span>
          <span className="text-white/30 text-sm">Sales Floor</span>
        </div>

        <SlideIndicator
          slides={SLIDES}
          current={slideIndex}
          onSelect={(i) => { setSlideIndex(i); setPaused(true); setTimeout(() => setPaused(false), SLIDE_DURATION); }}
        />

        <div className="flex items-center gap-4">
          <Clock />
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
        ) : (
          <div className="h-full">
            {currentSlide === 'leaderboard' && <LeaderboardSlide profiles={profiles} />}
            {currentSlide === 'spotlight'   && <SpotlightSlide profiles={profiles} />}
            {currentSlide === 'contests'    && <ContestsSlide contests={contests} />}
            {currentSlide === 'team_stats'  && <TeamStatsSlide profiles={profiles} />}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-8 py-3 border-t border-white/5 text-white/25 text-xs">
        <span>← → Navigate  ·  Space Pause  ·  F Fullscreen</span>
        {paused && <span className="text-amber-400">⏸ Paused</span>}
        <span>Auto-advances every {SLIDE_DURATION / 1000}s</span>
      </div>
    </div>
  );
}
