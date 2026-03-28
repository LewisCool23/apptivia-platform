/**
 * Shared Email Template Utilities
 *
 * Centralized HTML email builders for all Apptivia email types.
 * Uses consistent Apptivia branding: gradient header, stat boxes, footer.
 */

// ── Brand Colors ─────────────────────────────────────────────────────
export const EMAIL_COLORS = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  bgNotes: '#e0f2fe',
  bgWarning: '#fef3c7',
} as const;

const GRADIENT = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)';

// ── Shared Email Wrapper ─────────────────────────────────────────────

interface WrapperOptions {
  ctaUrl?: string;
  ctaLabel?: string;
  headerMeta?: string;
  notesHtml?: string;
  footerLabel?: string;
}

/**
 * Wraps body HTML in the standard Apptivia email shell.
 */
export function buildEmailWrapper(
  title: string,
  subtitle: string,
  bodyHtml: string,
  options: WrapperOptions = {},
): string {
  const { ctaUrl, ctaLabel, headerMeta, notesHtml, footerLabel } = options;
  const date = new Date().toLocaleDateString();

  const ctaBlock = ctaUrl && ctaLabel
    ? `<div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background: ${GRADIENT}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">${ctaLabel}</a>
      </div>`
    : '';

  const notesBlock = notesHtml
    ? `<div style="background: ${EMAIL_COLORS.bgNotes}; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>📝 Notes:</strong><br/>${notesHtml}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${GRADIENT}; color: white; padding: 30px; border-radius: 10px; text-align: center; }
    .stat-box { background: ${EMAIL_COLORS.lightGray}; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: ${EMAIL_COLORS.blue}; }
    .stat-label { font-size: 14px; color: ${EMAIL_COLORS.gray}; }
    .section { margin: 20px 0; }
    .section-title { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; color: #111827; }
    .footer { text-align: center; color: ${EMAIL_COLORS.gray}; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 5px 0;">${title}</h1>
      <p style="margin: 0; opacity: 0.9;">${subtitle}</p>
      ${headerMeta || ''}
    </div>
    ${bodyHtml}
    ${notesBlock}
    ${ctaBlock}
    <div class="footer">
      <p style="margin: 0 0 5px 0;">Generated on ${date}</p>
      <p style="margin: 0;">${footerLabel || 'Apptivia Platform'}</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Helper: stat box row ─────────────────────────────────────────────

function buildStatGrid(stats: Array<{ value: string | number; label: string; color?: string }>, columns = 2): string {
  const rows: string[] = [];
  for (let i = 0; i < stats.length; i += columns) {
    const cells = stats.slice(i, i + columns).map(s => `
      <td style="width: ${Math.round(100 / columns)}%; padding: 8px;">
        <div style="background: ${EMAIL_COLORS.lightGray}; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: ${s.color || EMAIL_COLORS.blue};">${s.value}</div>
          <div style="font-size: 13px; color: ${EMAIL_COLORS.gray};">${s.label}</div>
        </div>
      </td>
    `).join('');
    rows.push(`<tr>${cells}</tr>`);
  }
  return `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${rows.join('')}</table>`;
}

// ── Helper: list section ─────────────────────────────────────────────

function buildListSection(
  icon: string,
  title: string,
  items: string[],
  style: 'bullet' | 'numbered' | 'card' = 'bullet',
  cardBorderColor?: string,
): string {
  if (items.length === 0) return '';
  let listHtml: string;
  if (style === 'numbered') {
    listHtml = items.map((item, i) =>
      `<div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px;">${i + 1}. ${item}</div>`
    ).join('');
  } else if (style === 'card') {
    listHtml = items.map(item =>
      `<div style="background: #f9fafb; padding: 12px 15px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${cardBorderColor || EMAIL_COLORS.blue}; font-size: 14px;">${item}</div>`
    ).join('');
  } else {
    listHtml = items.map(item =>
      `<div style="padding: 4px 0; font-size: 14px;">• ${item}</div>`
    ).join('');
  }
  return `<div style="margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">${icon} ${title}</h3>
    ${listHtml}
  </div>`;
}

// ── Helper: badge pills ──────────────────────────────────────────────

function buildBadgePills(items: string[], bgColor = '#dbeafe', textColor = '#1d4ed8'): string {
  if (items.length === 0) return '';
  return items.map(item =>
    `<span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: ${bgColor}; color: ${textColor}; font-size: 12px; font-weight: 600; margin: 2px 4px 2px 0;">${item}</span>`
  ).join('');
}

// ═════════════════════════════════════════════════════════════════════
// SCORECARD SNAPSHOT EMAIL
// ═════════════════════════════════════════════════════════════════════

interface ScorecardData {
  teamAverage: number;
  totalMembers: number;
  dateRange: string;
  topPerformers: Array<{ name: string; score: number; percentage?: string }>;
  needsImprovement: Array<{ name: string; score: number; percentage?: string }>;
  scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
}

interface ScorecardEmailOptions {
  notes?: string;
  trendWeeks?: Array<{ week: string; score: number; delta?: number }>;
  kpiScores?: Array<{ label: string; percentage: number }>;
  exactDateRange?: { start: string; end: string };
}

export function buildScorecardSnapshotEmailHtml(data: ScorecardData, options: ScorecardEmailOptions = {}): string {
  const { teamAverage, totalMembers, dateRange, topPerformers, needsImprovement, scoreDistribution } = data;
  const { trendWeeks, kpiScores, exactDateRange } = options;

  // Header meta with exact date range
  const headerMeta = exactDateRange
    ? `<div style="margin-top: 10px; padding: 6px 16px; background: rgba(255,255,255,0.15); border-radius: 6px; display: inline-block;">
        <span style="font-size: 14px;">${exactDateRange.start} — ${exactDateRange.end}</span>
      </div>`
    : `<p style="font-size: 14px; opacity: 0.9; margin: 5px 0 0 0;">${dateRange} • ${totalMembers} Team Members</p>`;

  // Team Average stat
  let bodyHtml = buildStatGrid([{ value: `${teamAverage}%`, label: 'Team Average' }], 1);

  // Score Distribution (2x2 grid)
  bodyHtml += `<div style="margin: 20px 0; background: #f9fafb; padding: 15px; border-radius: 8px;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">📈 Score Distribution</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.green};">${scoreDistribution.excellent}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.gray};">Excellent (≥90%)</div>
        </td>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.blue};">${scoreDistribution.good}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.gray};">Good (70-89%)</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.amber};">${scoreDistribution.fair}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.gray};">Fair (50-69%)</div>
        </td>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.red};">${scoreDistribution.poor}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.gray};">Needs Focus (&lt;50%)</div>
        </td>
      </tr>
    </table>
  </div>`;

  // 5-Week Trend Table (new)
  if (trendWeeks && trendWeeks.length > 0) {
    const trendRows = trendWeeks.map(w => {
      const deltaStr = w.delta != null
        ? `<span style="color: ${w.delta >= 0 ? EMAIL_COLORS.green : EMAIL_COLORS.red}; font-weight: bold;">${w.delta >= 0 ? '▲' : '▼'} ${Math.abs(w.delta)}%</span>`
        : '<span style="color: #9ca3af;">—</span>';
      return `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">${w.week}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; text-align: right; font-weight: bold;">${w.score}%</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; text-align: right;">${deltaStr}</td>
      </tr>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">📊 5-Week Trend</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: ${EMAIL_COLORS.lightGray};">
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: ${EMAIL_COLORS.gray};">Week</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: ${EMAIL_COLORS.gray};">Score</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: ${EMAIL_COLORS.gray};">Change</th>
          </tr>
        </thead>
        <tbody>${trendRows}</tbody>
      </table>
    </div>`;
  }

  // Per-KPI Score Breakdown (new)
  if (kpiScores && kpiScores.length > 0) {
    const kpiRows = kpiScores.map(kpi => {
      const color = kpi.percentage >= 80 ? EMAIL_COLORS.green : kpi.percentage >= 50 ? EMAIL_COLORS.amber : EMAIL_COLORS.red;
      return `<div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px;">
        <span>${kpi.label}</span>
        <span style="font-weight: bold; color: ${color};">${kpi.percentage}%</span>
      </div>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">🎯 KPI Score Breakdown</h3>
      <div style="background: #f9fafb; border-radius: 8px; overflow: hidden;">${kpiRows}</div>
    </div>`;
  }

  // Top Performers
  if (topPerformers.length > 0) {
    bodyHtml += buildListSection('🏆', 'Top Performers',
      topPerformers.map((p, i) => `<strong>${i + 1}. ${p.name || 'Team Member'}</strong> <span style="color: ${EMAIL_COLORS.gray};">${p.score}%</span>`),
      'card', EMAIL_COLORS.green,
    );
  }

  // Needs Improvement
  if (needsImprovement.length > 0) {
    bodyHtml += buildListSection('📈', 'Needs Improvement',
      needsImprovement.map(m => `<strong>${m.name || 'Team Member'}</strong> <span style="color: ${EMAIL_COLORS.gray};">${m.score}%</span>`),
      'card', EMAIL_COLORS.amber,
    );
  }

  return buildEmailWrapper(
    '📊 Weekly Scorecard Snapshot',
    'Apptivia Platform',
    bodyHtml,
    {
      headerMeta,
      notesHtml: options.notes ? options.notes.replace(/\n/g, '<br/>') : undefined,
      ctaUrl: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      ctaLabel: 'View Dashboard',
      footerLabel: 'Apptivia Platform - Team Performance Tracking',
    },
  );
}

export function buildScorecardSnapshotEmailText(data: ScorecardData, options: ScorecardEmailOptions = {}): string {
  const { teamAverage, totalMembers, dateRange, topPerformers, needsImprovement, scoreDistribution } = data;
  const { trendWeeks, kpiScores, exactDateRange } = options;

  let text = `Apptivia Weekly Scorecard Snapshot\n\n`;
  if (exactDateRange) {
    text += `${exactDateRange.start} — ${exactDateRange.end} • Team Members: ${totalMembers}\n`;
  } else {
    text += `${dateRange} • Team Members: ${totalMembers}\n`;
  }
  text += `Team Average: ${teamAverage}%\n\n`;

  text += `Score Distribution:\n`;
  text += `- Excellent (≥90%): ${scoreDistribution.excellent} members\n`;
  text += `- Good (70-89%): ${scoreDistribution.good} members\n`;
  text += `- Fair (50-69%): ${scoreDistribution.fair} members\n`;
  text += `- Needs Focus (<50%): ${scoreDistribution.poor} members\n\n`;

  if (trendWeeks && trendWeeks.length > 0) {
    text += `5-Week Trend:\n`;
    trendWeeks.forEach(w => {
      const delta = w.delta != null ? ` (${w.delta >= 0 ? '+' : ''}${w.delta}%)` : '';
      text += `  ${w.week}: ${w.score}%${delta}\n`;
    });
    text += '\n';
  }

  if (kpiScores && kpiScores.length > 0) {
    text += `KPI Score Breakdown:\n`;
    kpiScores.forEach(k => { text += `  - ${k.label}: ${k.percentage}%\n`; });
    text += '\n';
  }

  if (topPerformers.length > 0) {
    text += `Top Performers:\n${topPerformers.map((p, i) => `${i + 1}. ${p.name}: ${p.score}%`).join('\n')}\n\n`;
  }
  if (needsImprovement.length > 0) {
    text += `Needs Improvement:\n${needsImprovement.map(m => `- ${m.name}: ${m.score}%`).join('\n')}\n\n`;
  }
  if (options.notes) text += `Notes:\n${options.notes}\n\n`;
  text += `Generated on ${new Date().toLocaleDateString()}`;
  return text;
}

// ═════════════════════════════════════════════════════════════════════
// ACHIEVEMENT SNAPSHOT EMAIL
// ═════════════════════════════════════════════════════════════════════

interface AchievementData {
  name: string;
  userId: string;
  totalBadges: number;
  totalAchievements: number;
  avgSkillsetProgress: number;
  points: number;
}

export function buildAchievementSnapshotEmailHtml(data: AchievementData): string {
  const { name, userId, totalBadges, totalAchievements, avgSkillsetProgress, points } = data;
  const bodyHtml = buildStatGrid([
    { value: totalBadges, label: 'Badges Earned' },
    { value: totalAchievements, label: 'Achievements' },
    { value: `${avgSkillsetProgress}%`, label: 'Avg Progress' },
    { value: points?.toLocaleString() || '0', label: 'Total Points' },
  ], 2);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return buildEmailWrapper(
    '🎉 Achievement Snapshot',
    name,
    bodyHtml,
    {
      ctaUrl: `${baseUrl}/profile/${userId}`,
      ctaLabel: 'View Profile',
      footerLabel: 'Apptivia Platform - Achievement & Skills Management',
    },
  );
}

export function buildAchievementSnapshotEmailText(data: AchievementData): string {
  const { name, userId, totalBadges, totalAchievements, avgSkillsetProgress, points } = data;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${name}'s Achievement Snapshot - Apptivia Platform

🏆 Badges Earned: ${totalBadges}
✅ Achievements: ${totalAchievements}
📊 Average Progress: ${avgSkillsetProgress}%
⭐ Total Points: ${points?.toLocaleString() || 0}

View full profile: ${baseUrl}/profile/${userId}

Generated on ${new Date().toLocaleDateString()}`;
}

// ═════════════════════════════════════════════════════════════════════
// COACH SNAPSHOT EMAIL
// ═════════════════════════════════════════════════════════════════════

interface CoachData {
  apptiviaLevel: string;
  levelPoints: number;
  averageScore: number;
  scorecardStreak: number;
  totalBadges: number;
  totalAchievements: number;
  totalMembers?: number;
  allSkillsets: Array<{ skillset_name?: string; name?: string; progress?: number; achievements_completed?: number; points?: number }>;
}

interface CoachEmailOptions {
  notes?: string;
}

export function buildCoachSnapshotEmailHtml(data: CoachData, options: CoachEmailOptions = {}): string {
  const { apptiviaLevel, levelPoints, averageScore, scorecardStreak, totalBadges, totalAchievements, totalMembers, allSkillsets } = data;

  const headerMeta = totalMembers && totalMembers > 0
    ? `<p style="font-size: 14px; opacity: 0.9; margin: 5px 0 0 0;">Team Members: ${totalMembers}</p>`
    : '';

  let bodyHtml = buildStatGrid([
    { value: apptiviaLevel || 'N/A', label: 'Apptivia Level' },
    { value: levelPoints || 0, label: 'Level Points' },
    { value: `${averageScore || 0}%`, label: 'Average Score' },
    { value: scorecardStreak, label: 'Scorecard Streak' },
    { value: totalBadges, label: 'Total Badges' },
    { value: totalAchievements, label: 'Achievements' },
  ], 2);

  // Skillset Mastery Progress
  if (allSkillsets.length > 0) {
    const skillsetCards = allSkillsets.map(s => {
      const name = s.skillset_name || s.name || 'Skillset';
      return `<strong>${name}</strong><div style="font-size: 14px; color: ${EMAIL_COLORS.gray};">Progress: ${Math.round(s.progress || 0)}% • Achievements: ${s.achievements_completed || 0} • Points: ${s.points || 0}</div>`;
    });
    bodyHtml += buildListSection('🎯', 'Skillset Mastery Progress', skillsetCards, 'card', EMAIL_COLORS.blue);
  }

  return buildEmailWrapper(
    '📋 Coaching Progress Snapshot',
    'Apptivia Platform',
    bodyHtml,
    {
      headerMeta,
      notesHtml: options.notes ? options.notes.replace(/\n/g, '<br/>') : undefined,
      footerLabel: 'Apptivia Platform - Coaching & Development',
    },
  );
}

export function buildCoachSnapshotEmailText(data: CoachData, options: CoachEmailOptions = {}): string {
  const { apptiviaLevel, levelPoints, averageScore, scorecardStreak, totalBadges, totalAchievements, totalMembers, allSkillsets } = data;
  let text = `Apptivia Coach Snapshot\n\nApptivia Level: ${apptiviaLevel || 'N/A'}\nLevel Points: ${levelPoints || 0}\nAverage Score: ${averageScore || 0}%\nScorecard Streak: ${scorecardStreak}\nTotal Badges: ${totalBadges}\nAchievements: ${totalAchievements}\n`;
  if (totalMembers && totalMembers > 0) text += `Team Members: ${totalMembers}\n`;
  text += '\n';
  if (allSkillsets.length > 0) {
    text += `Skillset Mastery Progress:\n`;
    allSkillsets.forEach(s => {
      text += `- ${s.skillset_name || s.name}: ${Math.round(s.progress || 0)}% (${s.achievements_completed || 0} achievements, ${s.points || 0} pts)\n`;
    });
    text += '\n';
  }
  if (options.notes) text += `Notes:\n${options.notes}\n\n`;
  text += `Generated on ${new Date().toLocaleDateString()}`;
  return text;
}

// ═════════════════════════════════════════════════════════════════════
// COACHING PLAN EMAIL
// ═════════════════════════════════════════════════════════════════════

interface CoachingPlan {
  name: string;
  date_range_start?: string;
  date_range_end?: string;
  goals?: string[];
  focus_kpis?: string[];
  action_items?: string[];
  success_metrics?: string[];
  notes?: string;
}

interface CoachingPlanEmailOptions {
  additionalNotes?: string;
  introMessage?: string;
  laggingKpis?: Array<{ key: string; label: string; percentage: number; tier?: number }>;
  prioritySkillsets?: Array<{ name: string; progress: number }>;
  xpEstimate?: Array<{ skillset: string; estimatedXp: number }>;
  currentScore?: number;
  /** When true, suppress team-level data (lagging KPIs, skillsets, XP) from email */
  suppressTeamData?: boolean;
}

export function buildCoachingPlanEmailHtml(plan: CoachingPlan, options: CoachingPlanEmailOptions = {}): string {
  const { laggingKpis, prioritySkillsets, xpEstimate, currentScore, introMessage, additionalNotes, suppressTeamData } = options;

  let bodyHtml = '';

  // Intro message (for assignment emails)
  if (introMessage) {
    bodyHtml += `<div style="margin: 20px 0; padding: 15px; background: #eff6ff; border-radius: 8px; border-left: 4px solid ${EMAIL_COLORS.blue}; font-size: 14px;">
      ${introMessage}
    </div>`;
  }

  // Plan name heading
  bodyHtml += `<h2 style="margin: 20px 0 5px 0; font-size: 20px; color: #111827;">${plan.name}</h2>`;

  // Date range banner
  if (plan.date_range_start && plan.date_range_end) {
    bodyHtml += `<div style="margin: 0 0 20px 0; padding: 8px 16px; background: ${EMAIL_COLORS.lightGray}; border-radius: 6px; display: inline-block; font-size: 13px; color: ${EMAIL_COLORS.gray};">
      &#128197; ${plan.date_range_start} &#8594; ${plan.date_range_end}
    </div>`;
  }

  // Current score stat (if available)
  if (currentScore != null) {
    bodyHtml += buildStatGrid([{ value: `${currentScore}%`, label: 'Current Score' }], 1);
  }

  // Goals — blue left border card
  if (plan.goals && plan.goals.length > 0) {
    const goalItems = plan.goals.map((g, i) =>
      `<div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; ${i < plan.goals!.length - 1 ? 'border-bottom: 1px solid #dbeafe;' : ''} font-size: 14px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #dbeafe; color: #2563eb; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
        <span style="color: #374151;">${g}</span>
      </div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #eff6ff; border-left: 4px solid ${EMAIL_COLORS.blue}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">&#127919; Goals</h3>
      ${goalItems}
    </div>`;
  }

  // Focus KPIs — indigo left border card with badge pills
  if (plan.focus_kpis && plan.focus_kpis.length > 0) {
    const kpiLabels = plan.focus_kpis.map(k => k.replace(/_/g, ' ').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()));
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #eef2ff; border-left: 4px solid #6366f1; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">&#128202; Focus KPIs</h3>
      <div>${buildBadgePills(kpiLabels, '#e0e7ff', '#4338ca')}</div>
    </div>`;
  }

  // Action Items — green left border card
  if (plan.action_items && plan.action_items.length > 0) {
    const actionItems = plan.action_items.map((a, i) =>
      `<div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; ${i < plan.action_items!.length - 1 ? 'border-bottom: 1px solid #d1fae5;' : ''} font-size: 14px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
        <span style="color: #374151;">${a}</span>
      </div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #ecfdf5; border-left: 4px solid ${EMAIL_COLORS.green}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">&#9989; Action Items</h3>
      ${actionItems}
    </div>`;
  }

  // Success Metrics — purple left border card
  if (plan.success_metrics && plan.success_metrics.length > 0) {
    const metricItems = plan.success_metrics.map(s =>
      `<div style="padding: 8px 0; font-size: 14px; color: #374151;">&#8226; ${s}</div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #f5f3ff; border-left: 4px solid ${EMAIL_COLORS.purple}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #111827;">&#128200; Success Metrics</h3>
      ${metricItems}
    </div>`;
  }

  // Lagging KPI Analysis (color-coded) — suppress for team-visibility plans
  if (laggingKpis && laggingKpis.length > 0 && !suppressTeamData) {
    const kpiRows = laggingKpis.map(kpi => {
      const color = kpi.percentage < 50 ? EMAIL_COLORS.red : EMAIL_COLORS.amber;
      const bgColor = kpi.percentage < 50 ? '#fef2f2' : '#fffbeb';
      return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: ${bgColor}; border-radius: 6px; margin-bottom: 6px; font-size: 14px;">
        <span>${kpi.label}</span>
        <span style="font-weight: bold; color: ${color};">${kpi.percentage}%</span>
      </div>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">&#9888;&#65039; Lagging KPIs</h3>
      ${kpiRows}
    </div>`;
  }

  // Priority Skillsets — suppress for team-visibility plans
  if (prioritySkillsets && prioritySkillsets.length > 0 && !suppressTeamData) {
    const skillsetRows = prioritySkillsets.map(s => {
      const barWidth = Math.max(s.progress, 3);
      return `<div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
          <span style="font-weight: 600;">${s.name}</span>
          <span style="color: ${EMAIL_COLORS.gray};">${Math.round(s.progress)}%</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 999px; height: 8px; overflow: hidden;">
          <div style="background: ${EMAIL_COLORS.blue}; height: 8px; border-radius: 999px; width: ${barWidth}%;"></div>
        </div>
      </div>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">&#129504; Priority Skillsets</h3>
      ${skillsetRows}
    </div>`;
  }

  // XP Estimate — suppress for team-visibility plans
  if (xpEstimate && xpEstimate.length > 0 && !suppressTeamData) {
    const xpPills = xpEstimate.map(e =>
      `<span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: #fef9c3; color: #854d0e; font-size: 12px; font-weight: 600; margin: 2px 4px 2px 0;">~${e.estimatedXp} ${e.skillset} XP</span>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">&#9889; Estimated XP Gain</h3>
      <div>${xpPills}</div>
    </div>`;
  }

  // Notes — gray left border card
  if (plan.notes) {
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-left: 4px solid ${EMAIL_COLORS.gray}; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #111827;">&#128172; Coach Notes</h3>
      <span style="font-size: 14px; color: #374151;">${plan.notes.replace(/\n/g, '<br/>')}</span>
    </div>`;
  }

  // Additional notes from share dialog
  const notesHtml = additionalNotes ? additionalNotes.replace(/\n/g, '<br/>') : undefined;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return buildEmailWrapper(
    '&#128203; Coaching Plan',
    plan.name,
    bodyHtml,
    {
      notesHtml: notesHtml ? `<strong>Additional Notes:</strong><br/>${notesHtml}` : undefined,
      ctaUrl: `${baseUrl}/coaching-plans`,
      ctaLabel: 'View in Apptivia',
      footerLabel: 'Apptivia Platform - Coaching & Development',
    },
  );
}

export function buildCoachingPlanEmailText(plan: CoachingPlan, options: CoachingPlanEmailOptions = {}): string {
  const { laggingKpis, prioritySkillsets, xpEstimate, currentScore, introMessage, additionalNotes, suppressTeamData } = options;

  let text = '';
  if (introMessage) text += `${introMessage}\n\n`;
  text += `Coaching Plan: ${plan.name}\n`;
  if (plan.date_range_start && plan.date_range_end) {
    text += `Date Range: ${plan.date_range_start} to ${plan.date_range_end}\n`;
  }
  if (currentScore != null) text += `Current Score: ${currentScore}%\n`;
  text += '\n';

  if (plan.goals && plan.goals.length > 0) {
    text += `--- Goals ---\n${plan.goals.map((g, i) => `  ${i + 1}. ${g}`).join('\n')}\n\n`;
  }
  if (plan.focus_kpis && plan.focus_kpis.length > 0) {
    text += `--- Focus KPIs ---\n${plan.focus_kpis.map(k => `  - ${k.replace(/_/g, ' ').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase())}`).join('\n')}\n\n`;
  }
  if (plan.action_items && plan.action_items.length > 0) {
    text += `--- Action Items ---\n${plan.action_items.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}\n\n`;
  }
  if (plan.success_metrics && plan.success_metrics.length > 0) {
    text += `--- Success Metrics ---\n${plan.success_metrics.map(s => `  - ${s}`).join('\n')}\n\n`;
  }
  if (laggingKpis && laggingKpis.length > 0 && !suppressTeamData) {
    text += `--- Lagging KPIs ---\n${laggingKpis.map(k => `  - ${k.label}: ${k.percentage}%`).join('\n')}\n\n`;
  }
  if (prioritySkillsets && prioritySkillsets.length > 0 && !suppressTeamData) {
    text += `--- Priority Skillsets ---\n${prioritySkillsets.map(s => `  - ${s.name}: ${Math.round(s.progress)}%`).join('\n')}\n\n`;
  }
  if (xpEstimate && xpEstimate.length > 0 && !suppressTeamData) {
    text += `--- Estimated XP Gain ---\n${xpEstimate.map(e => `  - ~${e.estimatedXp} ${e.skillset} XP`).join('\n')}\n\n`;
  }
  if (plan.notes) text += `--- Coach Notes ---\n${plan.notes}\n\n`;
  if (additionalNotes) text += `--- Additional Notes ---\n${additionalNotes}\n\n`;
  text += `Shared from Apptivia Platform.\nGenerated on ${new Date().toLocaleDateString()}`;
  return text;
}

// ═════════════════════════════════════════════════════════════════════
// ENRICHED PLAN CONTENT (for saving AI context at plan creation)
// ═════════════════════════════════════════════════════════════════════

export interface EnrichedPlanContext {
  currentScore: number;
  laggingKpis: Array<{ key: string; label: string; percentage: number; tier?: number }>;
  onTrackCount: number;
  exceedingCount: number;
  prioritySkillsets: Array<{ name: string; progress: number }>;
  xpEstimate: Array<{ skillset: string; estimatedXp: number }>;
  skillsetImpact?: {
    current: Array<{ skillset_key: string; current_xp: number; current_level?: string }>;
    projected: Array<{ skillset: string; estimatedXp: number; color?: string }>;
  };
}

export interface EnrichedPlanContent {
  version: 2;
  plainText: string;
  context: EnrichedPlanContext;
  createdAt: string;
}

export function buildEnrichedContent(plainText: string, context: EnrichedPlanContext): string {
  return JSON.stringify({
    version: 2,
    plainText,
    context,
    createdAt: new Date().toISOString(),
  } satisfies EnrichedPlanContent);
}

export function parseEnrichedContent(content: string | null | undefined): EnrichedPlanContent | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.version === 2) return parsed as EnrichedPlanContent;
    return null;
  } catch {
    return null; // plain text content — not enriched
  }
}
