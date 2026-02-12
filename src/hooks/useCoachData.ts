import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

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
  skillsets: SkillsetProgress[];
}

const SKILLSET_KPI_MAP: Record<string, string[]> = {
  conversationalist: ['talk_time_minutes', 'conversations'],
  'call conqueror': ['call_connects', 'meetings', 'discovery_calls'],
  'email warrior': ['emails_sent', 'social_touches'],
  'pipeline guru': ['sourced_opps', 'stage2_opps', 'pipeline_created', 'pipeline_advanced', 'qualified_leads'],
  'task master': ['follow_ups', 'demos_completed', 'response_time', 'sales_cycle_days', 'win_rate'],  'scorecard master': ['scorecard_100_percent', 'scorecard_100_percent_streak', 'key_metric_100_percent', 'key_metric_100_percent_streak', 'scorecards_completed'],};

const LEVELS = [
  { label: 'Developing', min: 0, max: 999 },
  { label: 'Intermediate', min: 1000, max: 2499 },
  { label: 'Proficient', min: 2500, max: 3999 },
  { label: 'Elite', min: 4000, max: 5499 },
  { label: 'Master', min: 5500, max: 6000 },
];

function getLevelInfo(points: number) {
  const safePoints = Math.max(0, Math.round(points || 0));
  const level = LEVELS.find((l, index) => {
    if (index === LEVELS.length - 1) return safePoints >= l.min;
    return safePoints >= l.min && safePoints <= l.max;
  }) || LEVELS[0];

  const isTop = level.label === LEVELS[LEVELS.length - 1].label;
  const span = Math.max(1, level.max - level.min);
  const progress = isTop
    ? 100
    : Math.min(100, Math.max(0, Math.round(((safePoints - level.min) / span) * 100)));
  const pointsToNext = isTop ? 0 : Math.max(0, level.max - safePoints + 1);

  return { level: level.label, progress, pointsToNext };
}

function difficultyRank(difficulty?: string) {
  switch (difficulty) {
    case 'easy':
      return 1;
    case 'medium':
      return 2;
    case 'hard':
      return 3;
    case 'expert':
      return 4;
    default:
      return 5;
  }
}

export function useCoachData(
  selectedDepartments: string[],
  selectedTeams: string[],
  selectedMembers: string[],
  options?: { enabled?: boolean; mode?: 'summary' | 'full' }
) {
  const cacheRef = useRef<Map<string, CoachData>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const lastKeyRef = useRef<string | null>(null);
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
    const cacheKey = `${mode}|d:${selectedDepartments.join(',')}|t:${selectedTeams.join(',')}|m:${selectedMembers.join(',')}`;
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

        // Build profiles query with filters
        let profilesQuery = supabase
          .from('profiles')
          .select('id, first_name, last_name, apptivia_level, current_score, day_streak, total_points, department, team_id');

        if (selectedDepartments.length > 0) {
          profilesQuery = profilesQuery.in('department', selectedDepartments);
        }
        if (selectedTeams.length > 0) {
          profilesQuery = profilesQuery.in('team_id', selectedTeams);
        }
        if (selectedMembers.length > 0) {
          profilesQuery = profilesQuery.in('id', selectedMembers);
        }

        const { data: profilesData, error: profilesError } = await profilesQuery;
        if (profilesError) throw profilesError;

        const profiles: ProfileCoachData[] = profilesData || [];

        const totalMembers = profiles.length;

        // Fetch all skillsets
        const { data: allSkillsetsData, error: allSkillsetsError } = await supabase
          .from('skillsets')
          .select('id, name, description, color')
          .order('name');

        if (allSkillsetsError) throw allSkillsetsError;

        // Fetch KPI metrics
        const { data: metricsData, error: metricsError } = await supabase
          .from('kpi_metrics')
          .select('id, key, goal, weight, show_on_scorecard')
          .eq('is_active', true);

        if (metricsError) throw metricsError;

        const metrics = (metricsData || []).map((m: any) => ({
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
        const scorecardMetricKeys = scorecardMetrics.map((m: any) => m.key);

        // Fetch KPI values for selected profiles
        let valuesData: any[] = [];
        if (profiles.length > 0 && metrics.length > 0) {
          const profileIds = profiles.map((p: any) => p.id);
          const metricIds = metrics.map((m: any) => m.id);

          if (mode === 'summary' && profileIds.length === 1) {
            const { data: latestPeriodRows, error: latestError } = await supabase
              .from('kpi_values')
              .select('period_end')
              .in('profile_id', profileIds)
              .order('period_end', { ascending: false })
              .limit(1);

            if (latestError) throw latestError;
            const latestPeriodEnd = latestPeriodRows?.[0]?.period_end || null;

            if (latestPeriodEnd) {
              const { data: valuesResult, error: valuesError } = await supabase
                .from('kpi_values')
                .select('profile_id, kpi_id, value, period_start, period_end')
                .in('profile_id', profileIds)
                .in('kpi_id', metricIds)
                .eq('period_end', latestPeriodEnd);

              if (valuesError) throw valuesError;
              valuesData = valuesResult || [];
            }
          } else {
            const { data: valuesResult, error: valuesError } = await supabase
              .from('kpi_values')
              .select('profile_id, kpi_id, value, period_start, period_end')
              .in('profile_id', profileIds)
              .in('kpi_id', metricIds);

            if (valuesError) throw valuesError;
            valuesData = valuesResult || [];
          }
        }

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
            const percentage = metric.goal > 0 ? (value / metric.goal) * 100 : 0;
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
                const percentage = metric.goal > 0 ? (value / metric.goal) * 100 : 0;
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

        // Fetch achievements for skillsets (skip for summary mode)
        const achievementsBySkillset = new Map<string, any[]>();
        if (mode === 'full') {
          const skillsetIds = (allSkillsetsData || []).map((item: any) => item.id).filter(Boolean);
          const { data: achievementsData, error: achievementsError } = await supabase
            .from('achievements')
            .select('id, skillset_id, name, description, points, difficulty')
            .in('skillset_id', skillsetIds);

          if (achievementsError) throw achievementsError;

          (achievementsData || []).forEach((achievement: any) => {
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

        // Fetch profile_skillsets data for cumulative progress
        const profileIds = profiles.map(p => p.id);
        const { data: profileSkillsetsData, error: profileSkillsetsError } = await supabase
          .from('profile_skillsets')
          .select('profile_id, skillset_id, progress, achievements_completed, total_points_earned')
          .in('profile_id', profileIds);

        if (profileSkillsetsError) {
          console.error('Error fetching profile_skillsets:', profileSkillsetsError);
        }

        // Create map of profile skillset progress
        const profileSkillsetMap = new Map<string, any>();
        (profileSkillsetsData || []).forEach((ps: any) => {
          const key = `${ps.profile_id}|${ps.skillset_id}`;
          profileSkillsetMap.set(key, ps);
        });

        const skillsets: SkillsetProgress[] = (allSkillsetsData || []).map((skillset: any) => {
          const achievementList = achievementsBySkillset.get(skillset.id) || [];
          const totalAchievementsForSkillset = achievementList.length;

          let progressSum = 0;
          let achievementsSum = 0;
          let pointsSum = 0;

          profiles.forEach((profile: any) => {
            const key = `${profile.id}|${skillset.id}`;
            const profileSkillset = profileSkillsetMap.get(key);

            // Use persistent cumulative data from database
            const progress = profileSkillset?.progress || 0;
            const achievementsCompleted = profileSkillset?.achievements_completed || 0;
            const pointsEarned = profileSkillset?.total_points_earned || 0;

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

          const nextAchievement = mode === 'full'
            ? (avgAchievements < totalAchievementsForSkillset
                ? achievementList[avgAchievements]?.description || achievementList[avgAchievements]?.name || 'Keep progressing to unlock the next achievement'
                : 'All achievements complete')
            : 'View details to see next achievement';

          return {
            skillset_id: skillset.id,
            skillset_name: skillset.name,
            description: skillset.description,
            color: skillset.color,
            progress: avgProgress,
            next_achievement: nextAchievement,
            achievements_completed: avgAchievements,
            points: avgPoints,
          };
        });

        // Badge counts from earned badges (skip for summary mode)
        let totalBadges = 0;
        if (mode === 'full') {
          let badgeQuerySucceeded = false;
          if (profiles.length > 0) {
            const profileIds = profiles.map(p => p.id);
            const { data: badgeRows, error: badgeError } = await supabase
              .from('profile_badges')
              .select('id, profile_id')
              .in('profile_id', profileIds);

            if (!badgeError) {
              totalBadges = (badgeRows || []).length;
              badgeQuerySucceeded = true;
            } else {
              console.error('Error fetching profile badges for coach view:', badgeError);
            }
          }

          if (!badgeQuerySucceeded) {
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
        const levelInfo = getLevelInfo(avgPoints);

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
  }, [selectedDepartments, selectedTeams, selectedMembers, options?.enabled, options?.mode]);

  return { data, loading, error };
}
