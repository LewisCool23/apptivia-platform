/**
 * Shared Email Template Utilities
 *
 * Centralized HTML email builders for all Apptivia email types.
 * Uses consistent Apptivia branding: coral header, stat boxes, footer.
 */

// ── Brand Colors ─────────────────────────────────────────────────────
export const EMAIL_COLORS = {
  ink: '#0A0A0B',
  coral: '#FF4D2E',
  paper: '#F7F5F2',
  carbon700: '#3F3F46',
  carbon500: '#71717A',
  carbon200: '#E4E4E7',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#C8341B',
  bgNotes: '#FFF5F2',
  bgWarning: '#fef3c7',
} as const;

const HEADER_BG = '#FF4D2E';

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
        <a href="${ctaUrl}" style="display: inline-block; background: ${HEADER_BG}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">${ctaLabel}</a>
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
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #3F3F46; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${HEADER_BG}; color: white; padding: 30px; border-radius: 10px; text-align: center; }
    .stat-box { background: ${EMAIL_COLORS.paper}; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: ${EMAIL_COLORS.coral}; }
    .stat-label { font-size: 14px; color: ${EMAIL_COLORS.carbon500}; }
    .section { margin: 20px 0; }
    .section-title { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; color: #0A0A0B; }
    .footer { text-align: center; color: ${EMAIL_COLORS.carbon500}; font-size: 12px; margin-top: 30px; border-top: 1px solid #E4E4E7; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:28px;letter-spacing:-0.5px;margin-bottom:2px;"><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:900;color:#F7F5F2;letter-spacing:-0.05em;">app</span><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;color:#F7F5F2;letter-spacing:-0.05em;">tivia</span></div>
      <div style="font-size:11px;opacity:0.85;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Sales Performance Intelligence</div>
      <h1 style="margin: 0 0 5px 0;font-size:18px;">${title}</h1>
      <p style="margin: 0; opacity: 0.9;font-size:12px;">${subtitle}</p>
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
        <div style="background: ${EMAIL_COLORS.paper}; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: ${s.color || EMAIL_COLORS.coral};">${s.value}</div>
          <div style="font-size: 13px; color: ${EMAIL_COLORS.carbon500};">${s.label}</div>
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
      `<div style="padding: 8px 0; border-bottom: 1px solid #F7F5F2; font-size: 14px;">${i + 1}. ${item}</div>`
    ).join('');
  } else if (style === 'card') {
    listHtml = items.map(item =>
      `<div style="background: #F7F5F2; padding: 12px 15px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${cardBorderColor || EMAIL_COLORS.coral}; font-size: 14px;">${item}</div>`
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

function buildBadgePills(items: string[], bgColor = '#FFE2DA', textColor = '#C8341B'): string {
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
  bodyHtml += `<div style="margin: 20px 0; background: #F7F5F2; padding: 15px; border-radius: 8px;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">📈 Score Distribution</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.success};">${scoreDistribution.excellent}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.carbon500};">Excellent (≥90%)</div>
        </td>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.coral};">${scoreDistribution.good}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.carbon500};">Good (70-89%)</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.warning};">${scoreDistribution.fair}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.carbon500};">Fair (50-69%)</div>
        </td>
        <td style="width: 50%; text-align: center; padding: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.error};">${scoreDistribution.poor}</div>
          <div style="font-size: 12px; color: ${EMAIL_COLORS.carbon500};">Needs Focus (&lt;50%)</div>
        </td>
      </tr>
    </table>
  </div>`;

  // 5-Week Trend Table (new)
  if (trendWeeks && trendWeeks.length > 0) {
    const trendRows = trendWeeks.map(w => {
      const deltaStr = w.delta != null
        ? `<span style="color: ${w.delta >= 0 ? EMAIL_COLORS.success : EMAIL_COLORS.error}; font-weight: bold;">${w.delta >= 0 ? '▲' : '▼'} ${Math.abs(w.delta)}%</span>`
        : '<span style="color: #71717A;">—</span>';
      return `<tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E4E4E7; font-size: 14px;">${w.week}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E4E4E7; font-size: 14px; text-align: right; font-weight: bold;">${w.score}%</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E4E4E7; font-size: 14px; text-align: right;">${deltaStr}</td>
      </tr>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">📊 5-Week Trend</h3>
      <table style="width: 100%; border-collapse: collapse; background: #F7F5F2; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: ${EMAIL_COLORS.paper};">
            <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: ${EMAIL_COLORS.carbon500};">Week</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: ${EMAIL_COLORS.carbon500};">Score</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: ${EMAIL_COLORS.carbon500};">Change</th>
          </tr>
        </thead>
        <tbody>${trendRows}</tbody>
      </table>
    </div>`;
  }

  // Per-KPI Score Breakdown (new)
  if (kpiScores && kpiScores.length > 0) {
    const kpiRows = kpiScores.map(kpi => {
      const color = kpi.percentage >= 80 ? EMAIL_COLORS.success : kpi.percentage >= 50 ? EMAIL_COLORS.warning : EMAIL_COLORS.error;
      return `<table style="width: 100%; border-collapse: collapse;"><tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #F7F5F2; font-size: 14px; text-align: left;">${kpi.label}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #F7F5F2; font-size: 14px; text-align: right; font-weight: bold; color: ${color};">${kpi.percentage}%</td>
      </tr></table>`;
    }).join('');

    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">🎯 KPI Score Breakdown</h3>
      <div style="background: #F7F5F2; border-radius: 8px; overflow: hidden;">${kpiRows}</div>
    </div>`;
  }

  // Top Performers
  if (topPerformers.length > 0) {
    bodyHtml += buildListSection('🏆', 'Top Performers',
      topPerformers.map((p, i) => `<strong>${i + 1}. ${p.name || 'Team Member'}</strong> <span style="color: ${EMAIL_COLORS.carbon500};">${p.score}%</span>`),
      'card', EMAIL_COLORS.success,
    );
  }

  // Needs Improvement
  if (needsImprovement.length > 0) {
    bodyHtml += buildListSection('📈', 'Needs Improvement',
      needsImprovement.map(m => `<strong>${m.name || 'Team Member'}</strong> <span style="color: ${EMAIL_COLORS.carbon500};">${m.score}%</span>`),
      'card', EMAIL_COLORS.warning,
    );
  }

  return buildEmailWrapper(
    '📊 Weekly Scorecard Snapshot',
    'Team Performance',
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
      return `<strong>${name}</strong><div style="font-size: 14px; color: ${EMAIL_COLORS.carbon500};">Progress: ${Math.round(s.progress || 0)}% • Achievements: ${s.achievements_completed || 0} • Points: ${s.points || 0}</div>`;
    });
    bodyHtml += buildListSection('🎯', 'Skillset Mastery Progress', skillsetCards, 'card', EMAIL_COLORS.coral);
  }

  return buildEmailWrapper(
    '📋 Coaching Progress Snapshot',
    'Coaching & Development',
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
    bodyHtml += `<div style="margin: 20px 0; padding: 15px; background: #FFF5F2; border-radius: 8px; border-left: 4px solid ${EMAIL_COLORS.coral}; font-size: 14px;">
      ${introMessage}
    </div>`;
  }

  // Plan name heading
  bodyHtml += `<h2 style="margin: 20px 0 5px 0; font-size: 20px; color: #0A0A0B;">${plan.name}</h2>`;

  // Date range banner
  if (plan.date_range_start && plan.date_range_end) {
    bodyHtml += `<div style="margin: 0 0 20px 0; padding: 8px 16px; background: ${EMAIL_COLORS.paper}; border-radius: 6px; display: inline-block; font-size: 13px; color: ${EMAIL_COLORS.carbon500};">
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
      `<div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; ${i < plan.goals!.length - 1 ? 'border-bottom: 1px solid #FFE2DA;' : ''} font-size: 14px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #FFE2DA; color: #FF4D2E; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
        <span style="color: #3F3F46;">${g}</span>
      </div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #FFF5F2; border-left: 4px solid ${EMAIL_COLORS.coral}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0A0A0B;">&#127919; Goals</h3>
      ${goalItems}
    </div>`;
  }

  // Focus KPIs — indigo left border card with badge pills
  if (plan.focus_kpis && plan.focus_kpis.length > 0) {
    const kpiLabels = plan.focus_kpis.map(k => k.replace(/_/g, ' ').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase()));
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #FFF5F2; border-left: 4px solid #FF4D2E; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0A0A0B;">&#128202; Focus KPIs</h3>
      <div>${buildBadgePills(kpiLabels, '#FFE2DA', '#C8341B')}</div>
    </div>`;
  }

  // Action Items — green left border card
  if (plan.action_items && plan.action_items.length > 0) {
    const actionItems = plan.action_items.map((a, i) =>
      `<div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; ${i < plan.action_items!.length - 1 ? 'border-bottom: 1px solid #DCFCE7;' : ''} font-size: 14px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #DCFCE7; color: #16A34A; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i + 1}</span>
        <span style="color: #3F3F46;">${a}</span>
      </div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #F0FDF4; border-left: 4px solid ${EMAIL_COLORS.success}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0A0A0B;">&#9989; Action Items</h3>
      ${actionItems}
    </div>`;
  }

  // Success Metrics — purple left border card
  if (plan.success_metrics && plan.success_metrics.length > 0) {
    const metricItems = plan.success_metrics.map(s =>
      `<div style="padding: 8px 0; font-size: 14px; color: #3F3F46;">&#8226; ${s}</div>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #F7F5F2; border-left: 4px solid ${EMAIL_COLORS.ink}; border-radius: 8px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0A0A0B;">&#128200; Success Metrics</h3>
      ${metricItems}
    </div>`;
  }

  // Lagging KPI Analysis (color-coded) — suppress for team-visibility plans
  if (laggingKpis && laggingKpis.length > 0 && !suppressTeamData) {
    const kpiRows = laggingKpis.map(kpi => {
      const color = kpi.percentage < 50 ? EMAIL_COLORS.error : EMAIL_COLORS.warning;
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
          <span style="color: ${EMAIL_COLORS.carbon500};">${Math.round(s.progress)}%</span>
        </div>
        <div style="background: #E4E4E7; border-radius: 999px; height: 8px; overflow: hidden;">
          <div style="background: ${EMAIL_COLORS.coral}; height: 8px; border-radius: 999px; width: ${barWidth}%;"></div>
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
      `<span style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: #FFFBEB; color: #92400E; font-size: 12px; font-weight: 600; margin: 2px 4px 2px 0;">~${e.estimatedXp} ${e.skillset} XP</span>`
    ).join('');
    bodyHtml += `<div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">&#9889; Estimated XP Gain</h3>
      <div>${xpPills}</div>
    </div>`;
  }

  // Notes — gray left border card
  if (plan.notes) {
    bodyHtml += `<div style="margin: 20px 0; padding: 16px; background: #F7F5F2; border-left: 4px solid ${EMAIL_COLORS.carbon500}; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0A0A0B;">&#128172; Coach Notes</h3>
      <span style="font-size: 14px; color: #3F3F46;">${plan.notes.replace(/\n/g, '<br/>')}</span>
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

// ═════════════════════════════════════════════════════════════════════
// PIPELINE FORECAST EMAIL
// ═════════════════════════════════════════════════════════════════════

interface ForecastEmailData {
  totalPipeline: number;
  weightedValue: number;
  dealCount: number;
  atRiskCount: number;
  closingThisMonth: number;
  forecastText: string;
}

interface ForecastEmailOptions {
  notes?: string;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

/** Convert basic markdown to inline HTML for emails */
function markdownToEmailHtml(text: string): string {
  // Escape HTML entities first
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Headers (### → h4, ## → h3)
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin: 12px 0 4px 0; font-size: 14px; font-weight: 700; color: #18181b;">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin: 14px 0 6px 0; font-size: 15px; font-weight: 700; color: #18181b;">$1</h3>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Bullet lists (- item or * item)
  html = html.replace(/^[-*] (.+)$/gm, '<li style="margin: 2px 0; padding-left: 4px;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin: 6px 0; padding-left: 18px; list-style: disc;">${match}</ul>`);
  // Numbered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin: 2px 0; padding-left: 4px;">$1</li>');
  // Double newlines → paragraph breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  // Single newlines (not already handled) → <br/>
  html = html.replace(/\n/g, '<br/>');
  return html;
}

export function buildForecastEmailHtml(data: ForecastEmailData, options: ForecastEmailOptions = {}): string {
  const stats = buildStatGrid([
    { value: formatCurrency(data.totalPipeline), label: `Total Pipeline · ${data.dealCount} deals` },
    { value: formatCurrency(data.weightedValue), label: 'Weighted Value', color: EMAIL_COLORS.success },
    { value: String(data.atRiskCount), label: 'At Risk Deals', color: EMAIL_COLORS.error },
    { value: String(data.closingThisMonth), label: 'Closing This Month' },
  ], 2);

  const forecastSection = `
    <div style="margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; font-size: 16px;">🔮 AI Pipeline Analysis</h3>
      <div style="background: ${EMAIL_COLORS.paper}; padding: 16px; border-radius: 8px; border-left: 4px solid ${EMAIL_COLORS.coral}; font-size: 14px; line-height: 1.7; color: ${EMAIL_COLORS.carbon700};">
        ${markdownToEmailHtml(data.forecastText)}
      </div>
    </div>
  `;

  return buildEmailWrapper(
    '📊 Pipeline Forecast',
    'AI-Powered Pipeline Analysis',
    stats + forecastSection,
    {
      ctaUrl: `${typeof window !== 'undefined' ? window.location.origin : 'https://apptivia.app'}/engage?tab=pipeline`,
      ctaLabel: 'View Pipeline',
      notesHtml: options.notes?.replace(/\n/g, '<br/>'),
      footerLabel: 'Apptivia Engage — Pipeline Intelligence',
    },
  );
}

export function buildForecastEmailText(data: ForecastEmailData, options: ForecastEmailOptions = {}): string {
  let text = 'APPTIVIA PIPELINE FORECAST\n';
  text += '═══════════════════════════\n\n';
  text += `Total Pipeline: ${formatCurrency(data.totalPipeline)} (${data.dealCount} deals)\n`;
  text += `Weighted Value: ${formatCurrency(data.weightedValue)}\n`;
  text += `At Risk: ${data.atRiskCount}\n`;
  text += `Closing This Month: ${data.closingThisMonth}\n\n`;
  text += '--- AI ANALYSIS ---\n\n';
  text += data.forecastText + '\n';
  if (options.notes) {
    text += '\n--- NOTES ---\n' + options.notes + '\n';
  }
  return text;
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
