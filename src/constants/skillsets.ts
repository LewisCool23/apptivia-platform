/**
 * Single source of truth for skillset → KPI mappings.
 * Import this everywhere instead of duplicating the map.
 */
export const SKILLSET_KPI_MAP: Record<string, string[]> = {
  conversationalist: ['talk_time_minutes', 'conversations'],
  'call conqueror': ['call_connects', 'meetings', 'discovery_calls', 'dials'],
  'email warrior': ['emails_sent', 'social_touches'],
  'pipeline guru': ['sourced_opps', 'stage2_opps', 'pipeline_created', 'pipeline_advanced', 'qualified_leads', 'revenue_generated', 'closed_won_deals'],
  'task master': ['follow_ups', 'demos_completed', 'tasks_completed', 'response_time', 'sales_cycle_days', 'win_rate'],
  'scorecard master': ['scorecard_100_percent', 'scorecard_100_percent_streak', 'key_metric_100_percent', 'key_metric_100_percent_streak', 'scorecards_completed'],
  'engage pro': ['accounts_researched', 'outreach_drafts_sent', 'ai_content_generated', 'engage_signals_actioned', 'engage_deals_influenced'],
};

export const LEVELS = [
  { label: 'Developing', min: 0, max: 999 },
  { label: 'Intermediate', min: 1000, max: 2499 },
  { label: 'Proficient', min: 2500, max: 4999 },
  { label: 'Elite', min: 5000, max: 9999 },
  { label: 'Master', min: 10000, max: 15000 },
];

export function getLevelInfo(points: number) {
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

export function difficultyRank(difficulty?: string) {
  switch (difficulty) {
    case 'easy': return 1;
    case 'medium': return 2;
    case 'hard': return 3;
    case 'expert': return 4;
    default: return 5;
  }
}

// KPIs belonging to Tier 2 skillsets (Pipeline Guru, Task Master, Call Conqueror, Conversationalist)
const TIER2_KPIS = new Set([
  ...SKILLSET_KPI_MAP['pipeline guru'],
  ...SKILLSET_KPI_MAP['task master'],
  ...SKILLSET_KPI_MAP['call conqueror'],
  ...SKILLSET_KPI_MAP.conversationalist,
]);

// KPIs belonging to Tier 3 (Engage Pro)
const TIER3_KPIS = new Set(SKILLSET_KPI_MAP['engage pro']);

export const TIER_LABELS: Record<number, string> = {
  1: 'Scorecard Priority',
  2: 'Core Skill',
  3: 'Engage Adoption',
  4: 'Other',
};

export const TIER_COLORS: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-cyan-100 text-cyan-700',
  4: 'bg-gray-100 text-gray-600',
};

/**
 * Returns the coaching priority tier for a KPI key.
 * Tier 1 = org's scorecard KPIs (most impactful)
 * Tier 2 = core selling skillsets (Pipeline Guru, Task Master, Call Conqueror, Conversationalist)
 * Tier 3 = Engage Pro adoption KPIs
 * Tier 4 = everything else
 */
export function getKpiTier(kpiKey: string, scorecardKpiKeys: Set<string> | string[]): number {
  const scSet = scorecardKpiKeys instanceof Set ? scorecardKpiKeys : new Set(scorecardKpiKeys);
  if (scSet.has(kpiKey)) return 1;
  if (TIER2_KPIS.has(kpiKey)) return 2;
  if (TIER3_KPIS.has(kpiKey)) return 3;
  return 4;
}

/** Skillset categories for display (e.g., in ApptiviaLevelInfoModal) */
export const SKILLSET_CATEGORIES = [
  { name: 'Conversationalist', kpis: 'Talk Time, Conversations', color: 'bg-blue-500' },
  { name: 'Call Conqueror', kpis: 'Call Connects, Meetings, Discovery, Dials', color: 'bg-green-500' },
  { name: 'Email Warrior', kpis: 'Emails Sent, Social Touches', color: 'bg-purple-500' },
  { name: 'Pipeline Guru', kpis: 'Sourced Opps, Pipeline, Revenue, Deals Closed', color: 'bg-orange-500' },
  { name: 'Task Master', kpis: 'Follow-ups, Demos, Tasks, Win Rate', color: 'bg-red-500' },
  { name: 'Scorecard Master', kpis: 'Scorecard Streaks, 100% Weeks', color: 'bg-yellow-500' },
  { name: 'Engage Pro', kpis: 'Signals, Account Research, Outreach, Deals Influenced', color: 'bg-cyan-500' },
];

/**
 * Reverse-lookup: given a KPI key, return which skillset(s) it belongs to.
 */
export function getSkillsetsForKpi(kpiKey: string): string[] {
  return Object.entries(SKILLSET_KPI_MAP)
    .filter(([, kpis]) => kpis.includes(kpiKey))
    .map(([name]) => name);
}

/**
 * Skillset mastery level based on progress percentage.
 */
export const SKILLSET_LEVEL_COLORS: Record<string, string> = {
  Beginner: 'bg-gray-100 text-gray-600',
  Developing: 'bg-orange-100 text-orange-700',
  Intermediate: 'bg-blue-100 text-blue-700',
  Advanced: 'bg-emerald-100 text-emerald-700',
  Master: 'bg-purple-100 text-purple-700',
};

export function getSkillsetLevel(progress: number): string {
  if (progress >= 100) return 'Master';
  if (progress >= 80) return 'Advanced';
  if (progress >= 60) return 'Intermediate';
  if (progress >= 40) return 'Developing';
  return 'Beginner';
}

/** Fallback hex colors for skillsets (used when DB color is null/empty) */
export const SKILLSET_COLOR_MAP: Record<string, string> = {
  conversationalist: '#3B82F6',
  'call conqueror': '#10B981',
  'email warrior': '#8B5CF6',
  'pipeline guru': '#F59E0B',
  'task master': '#EF4444',
  'scorecard master': '#D97706',
  'engage pro': '#06b6d4',
};

/** Returns the DB color or a fallback from SKILLSET_COLOR_MAP */
export function getSkillsetColor(name: string | undefined, dbColor: string | null | undefined): string {
  if (dbColor) return dbColor;
  return SKILLSET_COLOR_MAP[(name || '').toLowerCase()] || '#6B7280';
}

/**
 * Breadth requirements per level: how many skillsets must be at a given
 * progress threshold to qualify for each Apptivia Level.
 */
const BREADTH_REQUIREMENTS: { label: string; minSkillsets: number; minProgress: number }[] = [
  { label: 'Developing',   minSkillsets: 0, minProgress: 0  },
  { label: 'Intermediate', minSkillsets: 1, minProgress: 40 },
  { label: 'Proficient',   minSkillsets: 2, minProgress: 60 },
  { label: 'Elite',        minSkillsets: 3, minProgress: 60 },
  { label: 'Master',       minSkillsets: 5, minProgress: 80 },
];

/**
 * Returns the effective Apptivia Level, capped by both points AND
 * skillset breadth. The result is the LOWER of the points-based level
 * and the breadth-based cap.
 *
 * @param points       Total cumulative points
 * @param progresses   Array of skillset progress values (0-100), one per skillset
 */
export function getEffectiveLevel(points: number, progresses: number[]) {
  const pointsLevel = getLevelInfo(points);
  const pointsLevelIdx = LEVELS.findIndex(l => l.label === pointsLevel.level);

  // Find highest level the user qualifies for based on breadth
  let breadthIdx = 0;
  for (let i = BREADTH_REQUIREMENTS.length - 1; i >= 0; i--) {
    const req = BREADTH_REQUIREMENTS[i];
    const qualifying = progresses.filter(p => p >= req.minProgress).length;
    if (qualifying >= req.minSkillsets) {
      breadthIdx = i;
      break;
    }
  }

  const effectiveIdx = Math.min(pointsLevelIdx, breadthIdx);
  const effectiveLevel = LEVELS[effectiveIdx];
  const isTop = effectiveIdx === LEVELS.length - 1;
  const span = Math.max(1, effectiveLevel.max - effectiveLevel.min);
  const safePoints = Math.max(0, Math.round(points || 0));

  // If capped by breadth (not at their points level), show progress
  // toward meeting the breadth requirement rather than points progress
  let progress: number;
  let pointsToNext: number;

  if (effectiveIdx < pointsLevelIdx) {
    // Capped by breadth — show how close they are to the breadth gate
    const nextBreadthReq = BREADTH_REQUIREMENTS[effectiveIdx + 1];
    const qualifying = progresses.filter(p => p >= nextBreadthReq.minProgress).length;
    progress = Math.min(99, Math.round((qualifying / nextBreadthReq.minSkillsets) * 100));
    // Points to next still shows point-based distance (informational)
    pointsToNext = isTop ? 0 : Math.max(0, effectiveLevel.max - safePoints + 1);
  } else {
    progress = isTop
      ? 100
      : Math.min(100, Math.max(0, Math.round(((safePoints - effectiveLevel.min) / span) * 100)));
    pointsToNext = isTop ? 0 : Math.max(0, effectiveLevel.max - safePoints + 1);
  }

  return {
    level: effectiveLevel.label,
    progress,
    pointsToNext,
    cappedByBreadth: effectiveIdx < pointsLevelIdx,
  };
}

/**
 * Given an array of focus KPI keys, estimate XP gain per skillset.
 * Rule of thumb: each focus KPI in a skillset represents ~150 XP
 * (roughly 1-2 achievements earned by improving that KPI).
 */
export function estimateSkillsetXp(focusKpis: string[]): { skillset: string; estimatedXp: number; color: string }[] {
  const skillsetXp: Record<string, number> = {};

  for (const kpi of focusKpis) {
    const skillsets = getSkillsetsForKpi(kpi);
    for (const s of skillsets) {
      skillsetXp[s] = (skillsetXp[s] || 0) + 150;
    }
  }

  return Object.entries(skillsetXp)
    .map(([skillset, estimatedXp]) => {
      const cat = SKILLSET_CATEGORIES.find(c => c.name.toLowerCase() === skillset.toLowerCase());
      return { skillset: cat?.name || skillset, estimatedXp, color: cat?.color || 'bg-gray-500' };
    })
    .sort((a, b) => b.estimatedXp - a.estimatedXp);
}
