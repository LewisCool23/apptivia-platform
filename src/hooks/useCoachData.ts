import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { SKILLSET_KPI_MAP, LEVELS, getLevelInfo, getEffectiveLevel, difficultyRank, getSkillsetColor } from '../constants/skillsets';

interface ProfileCoachData {
  id: string;
  first_name: string;
  last_name: string;
  apptivia_level: string;
  current_score: number;
  day_streak: number;
  total_points: number;
}

interface SkillsetProgress {
  skillset_id: string;
  skillset_name: string;
  description: string;
  color: string;
  progress: number;
  next_achievement: string;
  achievements_completed: number;
  total_achievements: number;
  points: number;
}

interface CoachData {
  profiles: ProfileCoachData[];
  avgLevel: string;
  avgScore: number;
  totalMembers: number;
  scorecardStreak: number;
  totalBadges: number;
  totalAchievements: number;
  totalPoints: number;
  avgPoints: number;
  levelProgress: number;
  pointsToNextLevel: number;
  cappedByBreadth: boolean;
  skillsets: SkillsetProgress[];
}

// SKILLSET_KPI_MAP, LEVELS, getLevelInfo, difficultyRank imported from '../constants/skillsets'

export function useCoachData(
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  options?: { enabled?: boolean; mode?: 'summary' | 'full'; refreshTrigger?: number }
) {
  const cacheRef = useRef<Map<string, CoachData>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const lastKeyRef = useRef<string | null>(null);
  // Incremented whenever a real-time kpi_values change is detected,
  // causing the main effect to bypass the cache and re-fetch.
  const [realtimeKey, setRealtimeKey] = useState(0);

  const [data, setData] = useState<CoachData>({
    profiles: [],
    avgLevel: 'Developing',
    avgScore: 0,
    totalMembers: 0,
    scorecardStreak: 0,
    totalBadges: 0,
    totalAchievements: 0,
    totalPoints: 0,
    avgPoints: 0,
    levelProgress: 0,
    pointsToNextLevel: 0,
    cappedByBreadth: false,
    skillsets: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const enabled = options?.enabled ?? true;
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    const mode = options?.mode ?? 'full';
    const refreshSuffix = options?.refreshTrigger ? `|r:${options.refreshTrigger}` : '';
    const cacheKey = `${mode}|d:${selectedDepartments.join(',')}|t:${selectedTeams.join(',')}|m:${selectedMembers.join(',')}${refreshSuffix}`;
    const cached = cacheRef.current.get(cacheKey);

    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      lastKeyRef.current = cacheKey;
      return;
    }

    if (inFlightRef.current.has(cacheKey)) {
      return;
    }
    inFlightRef.current.add(cacheKey);

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // ── Stage 1: Independent queries (parallel) ──────────────────────
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, apptivia_level, current_score, day_streak, total_points, department, team_id')
          .not('role', 'in', '("admin","manager","coach")');

        if (selectedDepartments.length > 0) {
          profilesQuery = profilesQuery.in('department', selectedDepartments);
        }
        if (selectedTeams.length > 0) {
          profilesQuery = profilesQuery.in('team_id', selectedTeams);
        }
        if (selectedMembers.length > 0) {
          profilesQuery = profilesQuery.in('id', selectedMembers);
        }

        const [profilesResult, skillsetsResult, metricsResult] = await Promise.all([
          profilesQuery,
          supabase.from('skillsets').select('id, name, description, color').order('name'),
          supabase.from('kpi_metrics').select('id, key, goal, weight, show_on_scorecard, direction').eq('is_active', true),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (skillsetsResult.error) throw skillsetsResult.error;
        if (metricsResult.error) throw metricsResult.error;

        const profiles: ProfileCoachData[] = profilesResult.data || [];
        const allSkillsetsData = skillsetsResult.data;
        const totalMembers = profiles.length;

        const metrics = (metricsResult.data || []).map((m: any) => ({
          ...m,
          show_on_scorecard: m?.show_on_scorecard ?? true,
        }));

        const metricsById = new Map<string, any>();
        const metricsByKey = new Map<string, any>();
        metrics.forEach((metric: any) => {
          metricsById.set(metric.id, metric);
          metricsByKey.set(metric.key, metric);
        });

        const scorecardMetrics = metrics.filter((m: any) => m.show_on_scorecard);

        // ── Stage 2: Dependent queries (parallel) ────────────────────────
        const profileIds = profiles.map(p => p.id);
        const metricIds = metrics.map((m: any) => m.id);
        const skillsetIds = (allSkillsetsData || []).map((item: any) => item.id).filter(Boolean);

        // Build kpi_values promise
        let valuesPromise: Promise<{ data: any[] | null; error: any }>;
        if (profileIds.length > 0 && metricIds.length > 0) {
          if (mode === 'summary' && profileIds.length === 1) {
            // For summary mode, fetch latest period first then values for that period
            valuesPromise = supabase
              .from('kpi_values')
              .select('period_end')
              .in('profile_id', profileIds)
              .order('period_end', { ascending: false })
              .limit(1)
              .then(({ data: latestRows, error: latestErr }) => {
                if (latestErr) return { data: null, error: latestErr };
                const latestEnd = latestRows?.[0]?.period_end || null;
                if (!latestEnd) return { data: [], error: null };
                return supabase
                  .from('kpi_values')
                  .select('profile_id, kpi_id, value, period_start, period_end')
                  .in('profile_id', profileIds)
                  .in('kpi_id', metricIds)
                  .eq('period_end', latestEnd);
              });
          } else {
            valuesPromise = supabase
              .from('kpi_values')
              .select('profile_id, kpi_id, value, period_start, period_end')
              .in('profile_id', profileIds)
              .in('kpi_id', metricIds)
              .limit(50000);
          }
        } else {
          valuesPromise = Promise.resolve({ data: [], error: null });
        }

        // Build all Stage 2 promises
        const stage2Promises: [
          Promise<{ data: any[] | null; error: any }>,                    // kpi_values
          Promise<{ data: any[] | null; error: any }>,                    // achievements
          Promise<{ data: any[] | null; error: any }>,                    // profile_skillsets
          Promise<{ data: any[] | null; error: any }>,                    // profile_achievements
          Promise<{ data: any[] | null; error: any }>,                    // profile_badges
        ] = [
          valuesPromise,
          mode === 'full' && skillsetIds.length > 0
            ? supabase.from('achievements').select('id, skillset_id, name, description, points, difficulty').in('skillset_id', skillsetIds)
            : Promise.resolve({ data: [], error: null }),
          profileIds.length > 0
            ? supabase.from('profile_skillsets').select('profile_id, skillset_id, progress, achievements_completed, total_points_earned').in('profile_id', profileIds)
            : Promise.resolve({ data: [], error: null }),
          mode === 'full' && profileIds.length > 0
            ? supabase.from('profile_achievements').select('profile_id, achievement_id').in('profile_id', profileIds)
            : Promise.resolve({ data: [], error: null }),
          mode === 'full' && profileIds.length > 0
            ? supabase.from('profile_badges').select('id, profile_id').in('profile_id', profileIds)
            : Promise.resolve({ data: [], error: null }),
        ];

        const [valuesResult, achievementsResult, profileSkillsetsResult, earnedResult, badgesResult] = await Promise.all(stage2Promises);

        if (valuesResult.error) throw valuesResult.error;
        if (achievementsResult.error) throw achievementsResult.error;

        const valuesData: any[] = valuesResult.data || [];

        // Latest period determination
        const latestPeriodEnd = valuesData.reduce<string | null>((acc, curr: any) => {
          if (!curr?.period_end) return acc;
          if (!acc || curr.period_end > acc) return curr.period_end;
          return acc;
        }, null);

        const latestValues = latestPeriodEnd
          ? valuesData.filter((v: any) => v.period_end === latestPeriodEnd)
          : [];

        const latestValueMap = new Map<string, number>();
        latestValues.forEach((v: any) => {
          const key = `${v.profile_id}|${v.kpi_id}`;
          latestValueMap.set(key, (latestValueMap.get(key) || 0) + Number(v.value || 0));
        });

        // Scorecard scores for latest period
        const profileScores = new Map<string, number>();
        profiles.forEach((profile: any) => {
          let totalScore = 0;
          scorecardMetrics.forEach((metric: any) => {
            const value = latestValueMap.get(`${profile.id}|${metric.id}`) || 0;
            const dir = metric.direction || 'higher';
            const percentage = metric.goal > 0
              ? (dir === 'lower' ? (value > 0 ? Math.min((metric.goal / value) * 100, 200) : 200) : (value / metric.goal) * 100)
              : 0;
            totalScore += percentage * (metric.weight || 0);
          });
          profileScores.set(profile.id, Math.round(totalScore));
        });

        const avgScore = totalMembers > 0
          ? Math.round(Array.from(profileScores.values()).reduce((sum, s) => sum + s, 0) / totalMembers)
          : 0;

        // Scorecard streaks (consecutive periods >= 100%)
        const valueByProfilePeriodMetric = new Map<string, number>();
        const periodsByProfile = new Map<string, Set<string>>();
        valuesData.forEach((v: any) => {
          const periodKey = `${v.profile_id}|${v.period_end}|${v.kpi_id}`;
          valueByProfilePeriodMetric.set(periodKey, (valueByProfilePeriodMetric.get(periodKey) || 0) + Number(v.value || 0));

          if (!periodsByProfile.has(v.profile_id)) {
            periodsByProfile.set(v.profile_id, new Set());
          }
          if (v.period_end) {
            periodsByProfile.get(v.profile_id)!.add(v.period_end);
          }
        });

        let totalStreak = 0;
        const profileStreaks = new Map<string, number>();
        if (mode === 'full') {
          profiles.forEach((profile: any) => {
            const periodEnds = Array.from(periodsByProfile.get(profile.id) || []).sort((a, b) => (a > b ? -1 : 1));
            let streak = 0;
            for (const periodEnd of periodEnds) {
              let periodScore = 0;
              scorecardMetrics.forEach((metric: any) => {
                const value = valueByProfilePeriodMetric.get(`${profile.id}|${periodEnd}|${metric.id}`) || 0;
                const dir = metric.direction || 'higher';
                const percentage = metric.goal > 0
                  ? (dir === 'lower' ? (value > 0 ? Math.min((metric.goal / value) * 100, 200) : 200) : (value / metric.goal) * 100)
                  : 0;
                periodScore += percentage * (metric.weight || 0);
              });
              if (Math.round(periodScore) >= 100) {
                streak += 1;
              } else {
                break;
              }
            }
            totalStreak += streak;
            profileStreaks.set(profile.id, streak);
          });
        }

        const scorecardStreak = mode === 'full' && totalMembers > 0
          ? Math.round(totalStreak / totalMembers)
          : 0;

        // Process achievements (already fetched in Stage 2)
        const achievementsBySkillset = new Map<string, any[]>();
        if (mode === 'full') {
          (achievementsResult.data || []).forEach((achievement: any) => {
            if (!achievementsBySkillset.has(achievement.skillset_id)) {
              achievementsBySkillset.set(achievement.skillset_id, []);
            }
            achievementsBySkillset.get(achievement.skillset_id)!.push(achievement);
          });

          achievementsBySkillset.forEach(list => {
            list.sort((a, b) => {
              const diffRank = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
              if (diffRank !== 0) return diffRank;
              return (a.points || 0) - (b.points || 0);
            });
          });
        }

        // Build skillset progress from CUMULATIVE achievement data (persistent, never decreases)
        let totalAchievementCount = 0;
        let totalPointSum = 0;
        const achievementsByProfile = new Map<string, number>();
        const pointsByProfile = new Map<string, number>();
        profiles.forEach((profile: any) => {
          achievementsByProfile.set(profile.id, 0);
          pointsByProfile.set(profile.id, 0);
        });

        // Process profile_skillsets (already fetched in Stage 2)
        if (profileSkillsetsResult.error) {
          console.error('Error fetching profile_skillsets:', profileSkillsetsResult.error);
        }

        const profileSkillsetMap = new Map<string, any>();
        (profileSkillsetsResult.data || []).forEach((ps: any) => {
          const key = `${ps.profile_id}|${ps.skillset_id}`;
          profileSkillsetMap.set(key, ps);
        });

        // Process earned achievements (already fetched in Stage 2)
        let earnedByProfileSkillset = new Map<string, { count: number; points: number }>();
        if (mode === 'full' && !earnedResult.error && earnedResult.data) {
          const achievementInfoMap = new Map<string, { skillset_id: string; points: number }>();
          achievementsBySkillset.forEach((achList, skillsetId) => {
            achList.forEach((ach: any) => {
              achievementInfoMap.set(ach.id, { skillset_id: skillsetId, points: ach.points || 0 });
            });
          });

          earnedResult.data.forEach((ea: any) => {
            const info = achievementInfoMap.get(ea.achievement_id);
            if (!info) return;
            const key = `${ea.profile_id}|${info.skillset_id}`;
            const existing = earnedByProfileSkillset.get(key) || { count: 0, points: 0 };
            existing.count += 1;
            existing.points += info.points;
            earnedByProfileSkillset.set(key, existing);
          });
        }

        const skillsets: SkillsetProgress[] = (allSkillsetsData || []).map((skillset: any) => {
          const achievementList = achievementsBySkillset.get(skillset.id) || [];
          const totalAchievementsForSkillset = achievementList.length;
          const totalSkillsetPoints = achievementList.reduce((sum: number, a: any) => sum + (a.points || 0), 0);

          let progressSum = 0;
          let achievementsSum = 0;
          let pointsSum = 0;

          profiles.forEach((profile: any) => {
            const key = `${profile.id}|${skillset.id}`;
            const profileSkillset = profileSkillsetMap.get(key);
            const earned = earnedByProfileSkillset.get(key);

            // Live-calculated values from profile_achievements are the source of truth.
            // DB cache (profile_skillsets) is only used as a fallback when live data
            // is unavailable (e.g., summary mode where profile_achievements isn't fetched).
            const dbAchievements = profileSkillset?.achievements_completed || 0;
            const dbPoints = profileSkillset?.total_points_earned || 0;
            const dbProgress = profileSkillset?.progress || 0;

            const earnedAchievements = earned?.count || 0;
            const earnedPoints = earned?.points || 0;
            const earnedProgress = (totalSkillsetPoints > 0 && earnedPoints > 0)
              ? Math.min(100, Math.round((earnedPoints / totalSkillsetPoints) * 100))
              : 0;

            // Use live data when available (full mode); fall back to DB cache (summary mode)
            const hasLiveData = mode === 'full';
            const achievementsCompleted = hasLiveData ? earnedAchievements : (earnedAchievements || dbAchievements);
            const pointsEarned = hasLiveData ? earnedPoints : (earnedPoints || dbPoints);
            const progress = hasLiveData ? earnedProgress : (earnedProgress || dbProgress);

            progressSum += progress;
            achievementsSum += achievementsCompleted;
            pointsSum += pointsEarned;

            achievementsByProfile.set(profile.id, (achievementsByProfile.get(profile.id) || 0) + achievementsCompleted);
            pointsByProfile.set(profile.id, (pointsByProfile.get(profile.id) || 0) + pointsEarned);
          });

          const avgProgress = totalMembers > 0 ? Math.round(progressSum / totalMembers) : 0;
          const avgAchievements = totalMembers > 0 ? Math.round(achievementsSum / totalMembers) : 0;
          const avgPoints = totalMembers > 0 ? Math.round(pointsSum / totalMembers) : 0;

          totalAchievementCount += achievementsSum;
          totalPointSum += pointsSum;

          // Find next unearned achievement by checking which ones the average member hasn't completed
          let nextAchievement = 'View details to see next achievement';
          if (mode === 'full') {
            if (avgAchievements >= totalAchievementsForSkillset) {
              nextAchievement = 'All achievements complete';
            } else {
              const ach = achievementList[avgAchievements];
              nextAchievement = ach?.description || ach?.name || 'Keep progressing to unlock the next achievement';
            }
          }

          return {
            skillset_id: skillset.id,
            skillset_name: skillset.name,
            description: skillset.description,
            color: getSkillsetColor(skillset.name, skillset.color),
            progress: avgProgress,
            next_achievement: nextAchievement,
            achievements_completed: avgAchievements,
            total_achievements: totalAchievementsForSkillset,
            points: avgPoints,
          };
        });

        // Sort skillsets by progress descending, then alphabetically as tiebreaker
        skillsets.sort((a, b) => {
          if (b.progress !== a.progress) return b.progress - a.progress;
          return a.skillset_name.localeCompare(b.skillset_name);
        });

        // Badge counts (already fetched in Stage 2)
        let totalBadges = 0;
        if (mode === 'full') {
          if (!badgesResult.error) {
            totalBadges = (badgesResult.data || []).length;
          } else {
            console.error('Error fetching profile badges for coach view:', badgesResult.error);
            // Fallback: derive badge counts from scorecard performance and achievement milestones
            const achievementThresholds = [10, 25, 50, 100];
            const streakThresholds = [5, 10, 30, 90, 180];
            profiles.forEach(profile => {
              const achievementCount = achievementsByProfile.get(profile.id) || 0;
              const streak = profileStreaks.get(profile.id) || 0;
              const latestScore = profileScores.get(profile.id) || 0;

              let badgeCount = 0;
              achievementThresholds.forEach(threshold => {
                if (achievementCount >= threshold) badgeCount += 1;
              });
              streakThresholds.forEach(threshold => {
                if (streak >= threshold) badgeCount += 1;
              });
              if (latestScore >= 100) badgeCount += 1;

              totalBadges += badgeCount;
            });
          }
        }

        const totalPoints = totalPointSum;
        const avgPoints = totalMembers > 0 ? Math.round(totalPointSum / totalMembers) : 0;

        // Use effective level (points + skillset breadth) for accurate level
        const skillsetProgresses = skillsets.map(s => s.progress);
        const levelInfo = getEffectiveLevel(avgPoints, skillsetProgresses);

        const nextData: CoachData = {
          profiles,
          avgLevel: levelInfo.level,
          avgScore,
          totalMembers,
          scorecardStreak,
          totalBadges,
          totalAchievements: totalAchievementCount,
          totalPoints,
          avgPoints,
          levelProgress: levelInfo.progress,
          pointsToNextLevel: levelInfo.pointsToNext,
          cappedByBreadth: levelInfo.cappedByBreadth,
          skillsets,
        };

        cacheRef.current.set(cacheKey, nextData);
        setData(nextData);
        lastKeyRef.current = cacheKey;
      } catch (err: any) {
        const message = err?.message || String(err);
        const isAbort = err?.name === 'AbortError' || message.includes('AbortError');
        if (!isAbort) {
          setError(message);
        }
      } finally {
        inFlightRef.current.delete(cacheKey);
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedDepartments, selectedTeams, selectedMembers, options?.enabled, options?.mode, realtimeKey, options?.refreshTrigger]);

  // ── Real-time subscription ─────────────────────────────────────────────────
  // When kpi_values change in the DB (e.g. a manager logs activity), invalidate
  // the in-memory cache and trigger a re-fetch so the scorecard updates live.
  useEffect(() => {
    const channel = supabase
      .channel('coach_data_kpi_values')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kpi_values' },
        () => {
          cacheRef.current.clear();
          setRealtimeKey((k) => k + 1);
        },
      )
      .subscribe();

    // Also subscribe to achievement/skillset changes for real-time updates
    const channel2 = supabase
      .channel('coach_data_achievements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_achievements' },
        () => { cacheRef.current.clear(); setRealtimeKey((k) => k + 1); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_skillsets' },
        () => { cacheRef.current.clear(); setRealtimeKey((k) => k + 1); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(channel2);
    };
  }, []);

  return { data, loading, error };
}
