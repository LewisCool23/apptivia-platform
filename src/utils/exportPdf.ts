/**
 * exportPdf.ts — Branded PDF report generation using jsPDF + html2canvas.
 *
 * Each export function:
 * 1. Creates a hidden, styled HTML div with branded Apptivia content
 * 2. Renders it to a canvas via html2canvas
 * 3. Adds the canvas image to a jsPDF document
 * 4. Triggers browser download
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatKpiValue, type KpiUnitMap } from './exportUtils';
import { prettifyKpiKey } from '../constants/kpiGuidance';

// ── Apptivia brand constants ────────────────────────────────
const BRAND = {
  ink: '#0A0A0B',
  coral: '#FF4D2E',
  paper: '#F7F5F2',
  carbon200: '#E4E4E7',
  carbon500: '#71717A',
  carbon700: '#3F3F46',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#C8341B',
};

const HEADER_BG = BRAND.coral;

const today = () => new Date().toISOString().split('T')[0];

// ── HTML Rendering helpers ──────────────────────────────────

function brandedHeader(title: string, subtitle?: string): string {
  return `
    <div style="background:${HEADER_BG};color:white;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <div style="font-size:28px;letter-spacing:-0.5px;margin-bottom:2px;"><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:900;color:#F7F5F2;letter-spacing:-0.05em;">app</span><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;color:#F7F5F2;letter-spacing:-0.05em;">tivia</span></div>
      <div style="font-size:11px;opacity:0.85;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Sales Performance Intelligence</div>
      <div style="font-size:18px;font-weight:700;">${title}</div>
      ${subtitle ? `<div style="font-size:12px;opacity:0.9;margin-top:4px;">${subtitle}</div>` : ''}
    </div>`;
}

function brandedFooter(): string {
  return `
    <div style="padding:16px 32px;background:#F7F5F2;border-top:1px solid #E4E4E7;border-radius:0 0 12px 12px;text-align:center;">
      <div style="font-size:10px;color:#71717A;">
        Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; Powered by <strong style="color:${BRAND.ink};">Apptivia</strong>
      </div>
    </div>`;
}

function statBox(label: string, value: string | number, color?: string): string {
  return `
    <div style="flex:1;background:#F7F5F2;border-radius:8px;padding:12px 16px;text-align:center;min-width:100px;">
      <div style="font-size:22px;font-weight:700;color:${color || BRAND.ink};">${value}</div>
      <div style="font-size:10px;color:${BRAND.carbon500};margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    </div>`;
}

function scoreColor(score: number): string {
  if (score >= 90) return BRAND.success;
  if (score >= 70) return BRAND.coral;
  if (score >= 50) return BRAND.warning;
  return BRAND.error;
}

function tableRow(cells: string[], isHeader = false): string {
  const tag = isHeader ? 'th' : 'td';
  const style = isHeader
    ? 'padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#71717A;border-bottom:2px solid #E4E4E7;'
    : 'padding:8px 12px;font-size:12px;color:#3F3F46;border-bottom:1px solid #F7F5F2;';
  return `<tr>${cells.map(c => `<${tag} style="${style}">${c}</${tag}>`).join('')}</tr>`;
}

// ── Core renderer ───────────────────────────────────────────

async function renderAndDownload(htmlContent: string, filename: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<void> {
  // Create hidden container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = orientation === 'landscape' ? '1100px' : '800px';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.lineHeight = '1.5';
  container.innerHTML = `<div style="background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">${htmlContent}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = orientation === 'landscape' ? 297 : 210; // A4 mm
    const pageHeight = orientation === 'landscape' ? 210 : 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Additional pages if content overflows
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}_${today()}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// ── Scorecard / Analytics PDF ───────────────────────────────

export async function exportScorecardToPDF(data: any, filters?: any): Promise<void> {
  const rows = data.rows || [];
  const dateLabel = filters?.dateRange || 'Current Week';

  // Use only scorecard KPI keys (show_on_scorecard = true), not all KPIs
  const kpiKeys: string[] = data.scorecardKpiKeys || [];

  const repRows = rows
    .sort((a: any, b: any) => (b.apptivityScore || 0) - (a.apptivityScore || 0))
    .map((row: any, i: number) => {
      const score = row.apptivityScore || 0;
      const kpiCells = kpiKeys.map((k: string) => {
        const pct = row.kpis?.[k]?.percentage ?? 0;
        return `<span style="color:${scoreColor(pct)};">${Math.round(pct)}%</span>`;
      });
      return tableRow([
        `${i + 1}`,
        row.name || 'Unknown',
        row.team_name || '-',
        `<strong style="color:${scoreColor(score)};">${score}%</strong>`,
        ...kpiCells,
      ]);
    })
    .join('');

  const html = `
    ${brandedHeader('Scorecard Report', dateLabel)}
    <div style="padding:24px 32px;">
      <!-- Stats -->
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Team Avg', (data.teamAverage || 0) + '%', scoreColor(data.teamAverage || 0))}
        ${statBox('Reps Tracked', rows.length)}
        ${statBox('Above Target', data.aboveTarget || 0, BRAND.success)}
        ${statBox('Need Coaching', data.needCoaching || 0, BRAND.error)}
      </div>

      <!-- Score Distribution -->
      <div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Score Distribution</div>
        ${buildDistribution(rows)}
      </div>

      <!-- Full Rep Table -->
      <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Rep Performance</div>
      <table style="width:100%;border-collapse:collapse;">
        ${tableRow(['#', 'Rep', 'Team', 'Score', ...kpiKeys.map(prettifyKpiKey)], true)}
        ${repRows}
      </table>

      ${data.topPerformer ? `
      <div style="margin-top:20px;padding:12px 16px;background:#F0FDF4;border-left:4px solid ${BRAND.success};border-radius:6px;">
        <div style="font-size:11px;color:${BRAND.success};font-weight:600;">Top Performer</div>
        <div style="font-size:14px;font-weight:700;color:${BRAND.ink};">${data.topPerformer.name} — ${data.topPerformer.score}%</div>
      </div>` : ''}
    </div>
    ${brandedFooter()}`;

  await renderAndDownload(html, 'apptivia_scorecard');
}

function buildDistribution(rows: any[]): string {
  const buckets = [
    { label: 'Excellent (90+)', color: BRAND.success, count: 0 },
    { label: 'Good (70-89)', color: BRAND.coral, count: 0 },
    { label: 'Fair (50-69)', color: BRAND.warning, count: 0 },
    { label: 'Poor (<50)', color: BRAND.error, count: 0 },
  ];
  rows.forEach((r: any) => {
    const s = r.apptivityScore || 0;
    if (s >= 90) buckets[0].count++;
    else if (s >= 70) buckets[1].count++;
    else if (s >= 50) buckets[2].count++;
    else buckets[3].count++;
  });
  const total = rows.length || 1;
  return buckets.map(b => {
    const pct = Math.round((b.count / total) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <div style="width:120px;font-size:11px;color:${BRAND.carbon700};">${b.label}</div>
        <div style="flex:1;background:#E4E4E7;border-radius:4px;height:16px;overflow:hidden;">
          <div style="width:${pct}%;background:${b.color};height:100%;border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <div style="width:40px;text-align:right;font-size:11px;font-weight:600;color:${BRAND.carbon700};">${b.count}</div>
      </div>`;
  }).join('');
}

// ── Analytics PDF ───────────────────────────────────────────

export async function exportAnalyticsToPDF(data: any, aggregateKPIs: any, filters?: any, kpiUnits: KpiUnitMap = {}): Promise<void> {
  const rows = data.rows || [];
  const sortedRows = [...rows].sort((a: any, b: any) => (b.apptivityScore || 0) - (a.apptivityScore || 0));
  const dateLabel = filters?.dateRange || 'Current Week';
  const kpiKeys: string[] = data.scorecardKpiKeys || [];

  // Aggregate KPIs section — format values using unit metadata
  const aggRows = Array.isArray(aggregateKPIs)
    ? aggregateKPIs.map((k: any) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #F7F5F2;"><span style="font-size:12px;color:${BRAND.carbon700};">${k.name}</span><span style="font-size:12px;font-weight:600;">${formatKpiValue(k.total, k.unit || kpiUnits[k.key])}</span></div>`).join('')
    : '';

  // Chunk KPIs into groups of 5 to prevent horizontal overflow
  const KPI_CHUNK_SIZE = 5;
  const kpiChunks: string[][] = [];
  for (let i = 0; i < kpiKeys.length; i += KPI_CHUNK_SIZE) {
    kpiChunks.push(kpiKeys.slice(i, i + KPI_CHUNK_SIZE));
  }
  // Ensure at least one chunk even if no KPIs
  if (kpiChunks.length === 0) kpiChunks.push([]);

  const buildChunkTable = (chunk: string[], chunkIndex: number) => {
    const chunkRepRows = sortedRows.map((row: any, i: number) => {
      const score = row.apptivityScore || 0;
      const cells = chunk.map(k => {
        const pct = row.kpis?.[k]?.percentage ?? 0;
        return `<span style="color:${scoreColor(pct)};font-weight:600;">${Math.round(pct)}%</span>`;
      });
      return tableRow([`${i + 1}`, row.name || 'Unknown', row.team_name || '-', `<strong style="color:${scoreColor(score)};">${score}%</strong>`, ...cells]);
    }).join('');

    const sectionLabel = kpiChunks.length > 1 ? ` (${chunkIndex + 1} of ${kpiChunks.length})` : '';
    return `
      <div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Rep Performance${sectionLabel}</div>
        <table style="width:100%;border-collapse:collapse;">
          ${tableRow(['#', 'Rep', 'Team', 'Score', ...chunk.map(prettifyKpiKey)], true)}
          ${chunkRepRows}
        </table>
      </div>`;
  };

  const html = `
    ${brandedHeader('Analytics Report', dateLabel)}
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Reps', rows.length)}
        ${statBox('KPIs Tracked', kpiKeys.length)}
        ${statBox('Team Avg', (data.teamAverage || 0) + '%', scoreColor(data.teamAverage || 0))}
      </div>

      ${aggRows ? `
      <div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Aggregate KPIs</div>
        <div style="background:#F7F5F2;border-radius:8px;padding:12px 16px;">${aggRows}</div>
      </div>` : ''}

      ${kpiChunks.map((chunk, idx) => buildChunkTable(chunk, idx)).join('')}
    </div>
    ${brandedFooter()}`;

  await renderAndDownload(html, 'apptivia_analytics', 'landscape');
}

// ── Coach PDF ───────────────────────────────────────────────

export async function exportCoachToPDF(data: any, filters?: any): Promise<void> {
  const skillsets = data.skillsets || [];

  const skillsetRows = skillsets.map((s: any) =>
    tableRow([
      s.skillset_name || 'Unknown',
      `<div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;background:#E4E4E7;border-radius:4px;height:12px;overflow:hidden;min-width:80px;">
          <div style="width:${Math.min(s.progress || 0, 100)}%;background:${BRAND.ink};height:100%;border-radius:4px;"></div>
        </div>
        <span style="font-size:11px;font-weight:600;color:${BRAND.carbon700};">${Math.round(s.progress || 0)}%</span>
      </div>`,
      `${s.achievements_completed || 0}`,
      `${s.points || 0}`,
    ])
  ).join('');

  const html = `
    ${brandedHeader('Coaching & Development Report')}
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Avg Score', (data.avgScore || 0) + '%', scoreColor(data.avgScore || 0))}
        ${statBox('Total Badges', data.totalBadges || 0, BRAND.ink)}
        ${statBox('Achievements', data.totalAchievements || 0, BRAND.coral)}
        ${statBox('Total Points', data.totalPoints || 0)}
      </div>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Avg Level', data.avgLevel || 'N/A')}
        ${statBox('Members', data.totalMembers || 0)}
        ${statBox('Streak', (data.scorecardStreak || 0) + ' wk')}
        ${statBox('Next Level', (data.pointsToNextLevel || 0) + ' pts')}
      </div>

      <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Skillset Progress</div>
      <table style="width:100%;border-collapse:collapse;">
        ${tableRow(['Skillset', 'Progress', 'Achievements', 'Points'], true)}
        ${skillsetRows}
      </table>
    </div>
    ${brandedFooter()}`;

  await renderAndDownload(html, 'apptivia_coach');
}

// ── Contests PDF ────────────────────────────────────────────

export async function exportContestToPDF(contest: any): Promise<void> {
  const leaderboard = contest.leaderboard || [];
  const medals = ['🥇', '🥈', '🥉'];

  const lbRows = leaderboard.map((entry: any, i: number) =>
    tableRow([
      `${medals[i] || (i + 1)}`,
      `<strong>${entry.profile_name || 'Unknown'}</strong>`,
      entry.team_name || '-',
      `<strong>${entry.score || 0}</strong>`,
      entry.rank_change != null ? (entry.rank_change > 0 ? `<span style="color:${BRAND.success};">▲ ${entry.rank_change}</span>` : entry.rank_change < 0 ? `<span style="color:${BRAND.error};">▼ ${Math.abs(entry.rank_change)}</span>` : '-') : '-',
    ])
  ).join('');

  const statusColor = contest.status === 'active' ? BRAND.success : contest.status === 'completed' ? BRAND.coral : BRAND.warning;

  const html = `
    ${brandedHeader('Contest Report', contest.name || 'Contest')}
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Status', contest.status || 'N/A', statusColor)}
        ${statBox('Participants', leaderboard.length)}
        ${statBox('KPI', prettifyKpiKey(contest.kpi_key || 'N/A'))}
        ${statBox('Type', prettifyKpiKey(contest.calculation_type || 'total'))}
      </div>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Start', contest.start_date?.split('T')[0] || '-')}
        ${statBox('End', contest.end_date?.split('T')[0] || '-')}
        ${contest.winner_name ? statBox('Winner', contest.winner_name, BRAND.success) : ''}
        ${contest.reward_value ? statBox('Reward', contest.reward_value, BRAND.ink) : ''}
      </div>

      <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:10px;">Leaderboard</div>
      <table style="width:100%;border-collapse:collapse;">
        ${tableRow(['Rank', 'Participant', 'Team', 'Score', 'Change'], true)}
        ${lbRows}
      </table>
    </div>
    ${brandedFooter()}`;

  await renderAndDownload(html, `apptivia_contest_${(contest.name || 'report').replace(/\s+/g, '_').toLowerCase()}`);
}

// ── Badges / Profile PDF ────────────────────────────────────

export async function exportBadgesToPDF(badges: any[], profile: any): Promise<void> {
  const earnedBadges = badges.filter((b: any) => b.earned_at || b.is_earned);
  const rarityOrder: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  earnedBadges.sort((a: any, b: any) => (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5));

  const rarityColor = (r: string) => {
    switch (r) {
      case 'legendary': return '#f59e0b';
      case 'epic': return '#FF4D2E';
      case 'rare': return '#FF4D2E';
      case 'uncommon': return '#16A34A';
      default: return '#71717A';
    }
  };

  const badgeCards = earnedBadges.map((b: any) => `
    <div style="display:inline-block;width:calc(33% - 12px);margin:6px;background:#F7F5F2;border-radius:8px;padding:12px;border-left:3px solid ${rarityColor(b.rarity || 'common')};vertical-align:top;">
      <div style="font-size:12px;font-weight:700;color:${BRAND.ink};margin-bottom:2px;">${b.badge_name || b.name || 'Badge'}</div>
      <div style="font-size:10px;color:${BRAND.carbon500};margin-bottom:4px;">${b.badge_type || b.category || ''}</div>
      <div style="font-size:10px;color:${rarityColor(b.rarity || 'common')};font-weight:600;text-transform:capitalize;">${b.rarity || 'Common'}</div>
      ${b.earned_at ? `<div style="font-size:9px;color:${BRAND.carbon500};margin-top:2px;">Earned: ${new Date(b.earned_at).toLocaleDateString()}</div>` : ''}
    </div>
  `).join('');

  const profileName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'User';

  const html = `
    ${brandedHeader('Badge Collection', profileName)}
    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        ${statBox('Total Earned', earnedBadges.length, BRAND.ink)}
        ${statBox('Legendary', earnedBadges.filter((b: any) => b.rarity === 'legendary').length, '#f59e0b')}
        ${statBox('Epic', earnedBadges.filter((b: any) => b.rarity === 'epic').length, BRAND.ink)}
        ${statBox('Rare', earnedBadges.filter((b: any) => b.rarity === 'rare').length, BRAND.coral)}
      </div>

      <div style="font-size:13px;font-weight:600;color:${BRAND.ink};margin-bottom:12px;">Earned Badges</div>
      <div style="font-size:0;">
        ${badgeCards || '<div style="font-size:12px;color:#71717A;padding:20px;text-align:center;">No badges earned yet.</div>'}
      </div>
    </div>
    ${brandedFooter()}`;

  await renderAndDownload(html, 'apptivia_badges');
}
