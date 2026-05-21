/**
 * reportTemplates.js — Backend email template builders and data aggregation
 * for scheduled reports. Plain CommonJS, importable from server.js.
 *
 * Ported from src/utils/emailTemplates.ts (brand colors, wrapper, stat grid, list sections).
 * Data aggregation patterns mirror runScorecardAlerts, runKpiAnomalyAlerts, etc. in server.js.
 */

'use strict';

// ── Brand Colors (Apptivia Brand Foundation v1.2) ────────────────────
const COLORS = {
  ink: '#0A0A0B',
  coral: '#FF4D2E',
  paper: '#F7F5F2',
  carbon700: '#3F3F46',
  carbon500: '#71717A',
  carbon200: '#E4E4E7',
  green: '#16A34A',
  amber: '#F59E0B',
  red: '#C8341B',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  bgNotes: '#FFF5F2',
};
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://apptivia.app';

// ── Email Template Primitives ────────────────────────────────────────

function buildEmailWrapper(title, subtitle, bodyHtml, options = {}) {
  const { ctaUrl, ctaLabel, headerMeta, notesHtml, footerLabel } = options;
  const date = new Date().toLocaleDateString();
  const year = new Date().getFullYear();
  const ctaBlock = ctaUrl && ctaLabel
    ? `<div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background: ${COLORS.coral}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">${ctaLabel}</a>
      </div>` : '';
  const notesBlock = notesHtml
    ? `<div style="background: ${COLORS.bgNotes}; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>Notes:</strong><br/>${notesHtml}
      </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: ${COLORS.carbon700}; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${COLORS.coral}; color: white; padding: 30px; border-radius: 10px; text-align: center; }
    .stat-box { background: ${COLORS.paper}; padding: 20px; border-radius: 8px; text-align: center; }
    .section { margin: 20px 0; }
    .section-title { font-size: 16px; font-weight: bold; margin: 0 0 10px 0; color: ${COLORS.ink}; }
    .footer { text-align: center; color: ${COLORS.carbon500}; font-size: 12px; margin-top: 30px; border-top: 1px solid ${COLORS.carbon200}; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:28px;letter-spacing:-0.5px;margin-bottom:2px;"><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:900;color:${COLORS.paper};letter-spacing:-0.05em;">app</span><span style="font-family:'Geist',-apple-system,BlinkMacSystemFont,sans-serif;font-weight:500;color:${COLORS.paper};letter-spacing:-0.05em;">tivia</span></div>
      <div style="font-size:11px;opacity:0.85;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Sales Performance Intelligence</div>
      <h1 style="margin: 0 0 5px 0; font-size: 18px;">${title}</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 12px;">${subtitle}</p>
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

function buildStatGrid(stats, columns = 2) {
  const rows = [];
  for (let i = 0; i < stats.length; i += columns) {
    const cells = stats.slice(i, i + columns).map(s => `
      <td style="width: ${Math.round(100 / columns)}%; padding: 8px;">
        <div style="background: ${COLORS.paper}; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: ${s.color || COLORS.coral};">${s.value}</div>
          <div style="font-size: 13px; color: ${COLORS.carbon500};">${s.label}</div>
        </div>
      </td>
    `).join('');
    rows.push(`<tr>${cells}</tr>`);
  }
  return `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">${rows.join('')}</table>`;
}

function buildListSection(icon, title, items, style = 'bullet', borderColor) {
  if (!items || items.length === 0) return '';
  let listHtml;
  if (style === 'numbered') {
    listHtml = items.map((item, i) =>
      `<div style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px;">${i + 1}. ${item}</div>`
    ).join('');
  } else if (style === 'card') {
    listHtml = items.map(item =>
      `<div style="background: ${COLORS.paper}; padding: 12px 15px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${borderColor || COLORS.coral}; font-size: 14px;">${item}</div>`
    ).join('');
  } else {
    listHtml = items.map(item =>
      `<div style="padding: 4px 0; font-size: 14px;">${'\u2022'} ${item}</div>`
    ).join('');
  }
  return `<div style="margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">${icon} ${title}</h3>
    ${listHtml}
  </div>`;
}

function buildTable(headers, rows, options = {}) {
  const headerCells = headers.map(h =>
    `<th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: ${COLORS.gray}; background: ${COLORS.lightGray}; border-bottom: 2px solid #e5e7eb;">${h}</th>`
  ).join('');
  const bodyRows = rows.map(row =>
    `<tr>${row.map(cell =>
      `<td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${cell}</td>`
    ).join('')}</tr>`
  ).join('');
  return `<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

// ── Shared Helpers (duplicated from server.js — small pure functions) ────

function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function fetchHistoricalConfig(sb, metricIds, rangeStart, rangeEnd) {
  const { data: historyRows } = await sb
    .from('kpi_metric_history')
    .select('kpi_id, goal, weight, direction, valid_from, valid_to')
    .in('kpi_id', metricIds)
    .lte('valid_from', rangeEnd)
    .or(`valid_to.is.null,valid_to.gte.${rangeStart}`);

  function getConfigAt(kpiId, atDate, fallbackMetrics) {
    const rows = historyRows || [];
    const dt = typeof atDate === 'string' ? new Date(atDate) : atDate;
    const match = rows.find(h =>
      h.kpi_id === kpiId &&
      new Date(h.valid_from) <= dt &&
      (h.valid_to === null || new Date(h.valid_to) > dt)
    );
    if (match) return { goal: match.goal, weight: match.weight, direction: match.direction || 'higher' };
    const fb = (fallbackMetrics || []).find(m => m.id === kpiId);
    return fb ? { goal: fb.goal, weight: fb.weight, direction: fb.direction || 'higher' } : { goal: 1, weight: 1, direction: 'higher' };
  }

  return { historyRows: historyRows || [], getConfigAt };
}

function computeNextScheduledAt(report) {
  const DOW_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const next = new Date(now);
  if (report.frequency === 'daily') {
    next.setDate(now.getDate() + 1);
  } else if (report.frequency === 'weekly' && report.day_of_week) {
    const targetDow = DOW_NAMES.indexOf(report.day_of_week.toLowerCase());
    const currentDow = now.getDay();
    const daysUntil = ((targetDow - currentDow + 7) % 7) || 7;
    next.setDate(now.getDate() + daysUntil);
  } else {
    // monthly: first of next month
    next.setMonth(now.getMonth() + 1);
    next.setDate(1);
  }
  // Apply the report's scheduled time (HH:MM) if set
  if (report.time) {
    const [hours, minutes] = report.time.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      next.setHours(hours, minutes, 0, 0);
    }
  } else {
    next.setHours(9, 0, 0, 0); // Default to 9:00 AM
  }
  return next.toISOString();
}

// ── Shared score computation ─────────────────────────────────────────

function sumByProfileKpi(values) {
  const map = {};
  for (const v of (values || [])) {
    const key = `${v.profile_id}:${v.kpi_id}`;
    map[key] = (map[key] || 0) + (v.value || 0);
  }
  return map;
}

function computeScore(profileId, sums, metrics, getConfigAt, weekDate) {
  let score = 0;
  let totalWeight = 0;
  for (const metric of metrics) {
    const cfg  = getConfigAt(metric.id, weekDate, metrics);
    const val  = sums[`${profileId}:${metric.id}`] || 0;
    const goal = cfg.goal || 1;
    const w    = cfg.weight || 1;
    const dir  = cfg.direction || 'higher';
    const pct  = dir === 'lower'
      ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
      : Math.min((val / goal) * 100, 200);
    score += pct * w;
    totalWeight += w;
  }
  return Math.round(totalWeight > 0 ? score / totalWeight : 0);
}

function repName(rep) {
  return `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'Team Member';
}

function reportScoreColor(score) {
  if (score >= 90) return COLORS.green;
  if (score >= 70) return COLORS.coral;
  if (score >= 50) return COLORS.amber;
  return COLORS.red;
}

function prettifyKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Scorecard helpers shared across reports ──────────────────────────

// Mon-Sun week boundaries matching the frontend scorecard
function getReportMonday(d) {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - ((day + 6) % 7));
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

async function fetchScorecardData(sb, orgId) {
  // Use the most recently completed Mon-Sun week (not the current incomplete week)
  const thisMonday = getReportMonday(new Date());
  const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const lastSunday = new Date(thisMonday.getTime() - 1 * 86400000);
  const twoWeeksAgoMonday = new Date(lastMonday.getTime() - 7 * 86400000);
  const twoWeeksAgoSunday = new Date(lastMonday.getTime() - 1 * 86400000);

  const currStart  = lastMonday.toISOString().split('T')[0];
  const currEnd    = lastSunday.toISOString().split('T')[0];
  const priorStart = twoWeeksAgoMonday.toISOString().split('T')[0];
  const priorEnd   = twoWeeksAgoSunday.toISOString().split('T')[0];

  // Use org-specific KPI configs when orgId is available (matches scorecard logic)
  let metrics = [];
  if (orgId) {
    const { data } = await sb
      .from('kpi_org_configs')
      .select('kpi_id, goal, weight, is_active, show_on_scorecard, kpi_metrics!inner(id, key, name, direction)')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = (data || []).map(c => ({
      id: c.kpi_metrics.id, key: c.kpi_metrics.key,
      name: c.kpi_metrics.name, direction: c.kpi_metrics.direction,
      goal: c.goal, weight: c.weight,
    }));
  }
  // Fallback to global kpi_metrics if no org configs found
  if (metrics.length === 0) {
    const { data } = await sb
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);
    metrics = data || [];
  }

  if (!metrics || metrics.length === 0) return null;

  const metricIds = metrics.map(m => m.id);
  const { getConfigAt } = await fetchHistoricalConfig(sb, metricIds, priorStart, currEnd);

  const [{ data: reps }, { data: teams }] = await Promise.all([
    sb.from('profiles')
      .select('id, first_name, last_name, team_id')
      .eq('organization_id', orgId)
      .not('role', 'in', '("admin","manager","coach")'),
    sb.from('teams')
      .select('id, name')
      .eq('organization_id', orgId),
  ]);

  const teamLookup = {};
  for (const t of (teams || [])) { teamLookup[t.id] = t.name; }

  if (!reps || reps.length === 0) return { metrics, reps: [], scores: [], teamAvg: 0 };

  const repIds = reps.map(r => r.id);
  const [{ data: currValues }, { data: priorValues }] = await Promise.all([
    sb.from('kpi_values').select('kpi_id, profile_id, value')
      .in('kpi_id', metricIds).in('profile_id', repIds)
      .lte('period_start', currEnd).gte('period_end', currStart),
    sb.from('kpi_values').select('kpi_id, profile_id, value')
      .in('kpi_id', metricIds).in('profile_id', repIds)
      .lte('period_start', priorEnd).gte('period_end', priorStart),
  ]);

  const currSums  = sumByProfileKpi(currValues);
  const priorSums = sumByProfileKpi(priorValues);

  const scores = reps.map(r => {
    const curr  = computeScore(r.id, currSums, metrics, getConfigAt, currStart);
    const prior = computeScore(r.id, priorSums, metrics, getConfigAt, priorStart);
    // Per-KPI percentages for this rep
    const kpis = {};
    for (const metric of metrics) {
      const cfg  = getConfigAt(metric.id, currStart, metrics);
      const val  = currSums[`${r.id}:${metric.id}`] || 0;
      const goal = cfg.goal || 1;
      const dir  = cfg.direction || 'higher';
      const pct  = dir === 'lower'
        ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
        : Math.min((val / goal) * 100, 200);
      kpis[metric.key] = { value: val, percentage: Math.round(pct) };
    }
    return {
      rep: r, name: repName(r), team_name: teamLookup[r.team_id] || '',
      currentScore: curr, priorScore: prior, delta: curr - prior, kpis,
    };
  }).sort((a, b) => b.currentScore - a.currentScore);

  const teamAvg = scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r.currentScore, 0) / scores.length)
    : 0;

  return { metrics, reps, scores, teamAvg, currStart, currEnd, priorStart };
}

// ═════════════════════════════════════════════════════════════════════
// REPORT GENERATORS (each returns { html, text, subject })
// ═════════════════════════════════════════════════════════════════════

// ── Scorecard Report ────────────────────────────────────────────────

async function generateScorecardReport(sb, orgId, opts) {
  const data = await fetchScorecardData(sb, orgId);
  if (!data || !data.metrics || data.metrics.length === 0) {
    return noDataReport('Scorecard Summary', 'No KPI metrics configured. Set up your scorecard KPIs to start tracking.');
  }
  if (data.scores.length === 0) {
    return noDataReport('Scorecard Summary', 'No rep data available for this period.');
  }

  const { scores, teamAvg } = data;
  const top5 = scores.slice(0, 5);
  const bottom5 = scores.slice(-5).reverse();
  const dist = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const s of scores) {
    if (s.currentScore >= 90) dist.excellent++;
    else if (s.currentScore >= 70) dist.good++;
    else if (s.currentScore >= 50) dist.fair++;
    else dist.poor++;
  }

  const priorAvg = scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r.priorScore, 0) / scores.length) : 0;
  const avgDelta = teamAvg - priorAvg;
  const deltaStr = avgDelta >= 0 ? `+${avgDelta}` : `${avgDelta}`;

  let bodyHtml = '';

  // Stats row
  bodyHtml += buildStatGrid([
    { value: teamAvg, label: 'Team Average', color: teamAvg >= 80 ? COLORS.green : teamAvg >= 60 ? COLORS.amber : COLORS.red },
    { value: `${deltaStr} pts`, label: 'vs Last Week', color: avgDelta >= 0 ? COLORS.green : COLORS.red },
    { value: scores.length, label: 'Reps Tracked' },
    { value: `${dist.excellent}`, label: 'Excellent (90+)', color: COLORS.green },
  ]);

  // Score distribution
  bodyHtml += `<div style="margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">Score Distribution</h3>
    <div style="display: flex; gap: 8px;">
      <div style="flex:1; background: #d1fae5; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;"><strong>${dist.excellent}</strong> Excellent</div>
      <div style="flex:1; background: #dbeafe; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;"><strong>${dist.good}</strong> Good</div>
      <div style="flex:1; background: #fef3c7; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;"><strong>${dist.fair}</strong> Fair</div>
      <div style="flex:1; background: #fee2e2; padding: 8px; border-radius: 6px; text-align: center; font-size: 13px;"><strong>${dist.poor}</strong> Poor</div>
    </div>
  </div>`;

  // Top performers
  bodyHtml += buildListSection('🏆', 'Top Performers', top5.map(s =>
    `<strong>${s.name}</strong> — ${s.currentScore} pts ${s.delta >= 0 ? `<span style="color:${COLORS.green}">▲${s.delta}</span>` : `<span style="color:${COLORS.red}">▼${Math.abs(s.delta)}</span>`}`
  ), 'numbered');

  // Needs improvement
  if (bottom5.some(s => s.currentScore < 70)) {
    bodyHtml += buildListSection('📋', 'Needs Improvement', bottom5.filter(s => s.currentScore < 70).map(s =>
      `<strong>${s.name}</strong> — ${s.currentScore} pts ${s.delta >= 0 ? `<span style="color:${COLORS.green}">▲${s.delta}</span>` : `<span style="color:${COLORS.red}">▼${Math.abs(s.delta)}</span>`}`
    ), 'card', COLORS.amber);
  }

  // Full Rep Performance Table
  const kpiKeys = data.metrics.map(m => m.key);
  const kpiHeaders = kpiKeys.map(k => {
    const m = data.metrics.find(mt => mt.key === k);
    return m?.name || prettifyKey(k);
  });
  bodyHtml += `<div style="margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; font-size: 16px;">📋 Full Rep Performance</h3>
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: ${COLORS.lightGray};">
            <th style="padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${COLORS.gray}; border-bottom: 2px solid #e5e7eb;">#</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${COLORS.gray}; border-bottom: 2px solid #e5e7eb;">Rep</th>
            <th style="padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: ${COLORS.gray}; border-bottom: 2px solid #e5e7eb;">Team</th>
            <th style="padding: 6px 8px; text-align: center; font-size: 11px; text-transform: uppercase; color: ${COLORS.gray}; border-bottom: 2px solid #e5e7eb;">Score</th>
            ${kpiHeaders.map(h => `<th style="padding: 6px 8px; text-align: center; font-size: 11px; text-transform: uppercase; color: ${COLORS.gray}; border-bottom: 2px solid #e5e7eb;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${scores.map((s, idx) => {
            const sc = reportScoreColor(s.currentScore);
            return `<tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 6px 8px; font-size: 12px;">${idx + 1}</td>
              <td style="padding: 6px 8px; font-size: 12px; font-weight: 600;">${s.name}</td>
              <td style="padding: 6px 8px; font-size: 12px; color: ${COLORS.gray};">${s.team_name || '—'}</td>
              <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${sc};">${s.currentScore}%</td>
              ${kpiKeys.map(k => {
                const pct = s.kpis?.[k]?.percentage || 0;
                return `<td style="padding: 6px 8px; text-align: center; color: ${reportScoreColor(pct)};">${pct}%</td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateSubtitle = data.currEnd
    ? `${fmtDate(data.currStart)} — ${fmtDate(data.currEnd)}`
    : `Week of ${fmtDate(data.currStart)}`;

  const html = buildEmailWrapper('Scorecard Summary', dateSubtitle, bodyHtml, {
    ctaUrl: `${FRONTEND_URL}/analytics`,
    ctaLabel: 'View Full Scorecard',
  });

  const text = [
    `Scorecard Summary — ${dateSubtitle}`,
    `Team Average: ${teamAvg} (${deltaStr} vs last week)`,
    `Reps: ${scores.length} | Excellent: ${dist.excellent} | Good: ${dist.good} | Fair: ${dist.fair} | Poor: ${dist.poor}`,
    '',
    'Top Performers:',
    ...top5.map((s, i) => `  ${i + 1}. ${s.name} — ${s.currentScore} pts (${s.delta >= 0 ? '+' : ''}${s.delta})`),
    '',
    'Full Rep Scores:',
    ...scores.map((s, i) => `  ${i + 1}. ${s.name} ${s.team_name ? `(${s.team_name})` : ''} — ${s.currentScore}%`),
    '',
    `View full report: ${FRONTEND_URL}/analytics`,
  ].join('\n');

  return { html, text, subject: 'Your Apptivia Scorecard Summary' };
}

// ── Analytics Report ────────────────────────────────────────────────

async function generateAnalyticsReport(sb, orgId, opts) {
  // Use org-specific KPI configs when orgId is available
  let metrics = [];
  if (orgId) {
    const { data } = await sb
      .from('kpi_org_configs')
      .select('kpi_id, goal, weight, is_active, kpi_metrics!inner(id, key, name, direction)')
      .eq('organization_id', orgId)
      .eq('is_active', true);
    metrics = (data || []).map(c => ({
      id: c.kpi_metrics.id, key: c.kpi_metrics.key,
      name: c.kpi_metrics.name, direction: c.kpi_metrics.direction,
      goal: c.goal, weight: c.weight,
    }));
  }
  // Fallback to global kpi_metrics
  if (metrics.length === 0) {
    const { data } = await sb
      .from('kpi_metrics')
      .select('id, key, name, goal, weight, direction')
      .eq('is_active', true);
    metrics = data || [];
  }

  if (!metrics || metrics.length === 0) {
    return noDataReport('Analytics Report', 'No KPI metrics configured.');
  }

  const { data: reps } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('organization_id', orgId)
    .not('role', 'in', '("admin","manager","coach")');

  if (!reps || reps.length === 0) {
    return noDataReport('Analytics Report', 'No rep data available.');
  }

  const metricIds = metrics.map(m => m.id);
  const repIds = reps.map(r => r.id);
  // Use Mon-Sun boundaries matching the scorecard
  const thisMonday = getReportMonday(new Date());
  const lastMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const lastSunday = new Date(thisMonday.getTime() - 1 * 86400000);
  const currStart = lastMonday.toISOString().split('T')[0];
  const currEnd   = lastSunday.toISOString().split('T')[0];
  // 4-week lookback ending at the start of the reported week
  const avgEnd   = new Date(lastMonday.getTime() - 1 * 86400000).toISOString().split('T')[0];
  const avgStart = new Date(lastMonday.getTime() - 28 * 86400000).toISOString().split('T')[0];

  const [{ data: currValues }, { data: avgValues }] = await Promise.all([
    sb.from('kpi_values').select('kpi_id, profile_id, value')
      .in('kpi_id', metricIds).in('profile_id', repIds)
      .lte('period_start', currEnd).gte('period_end', currStart),
    sb.from('kpi_values').select('kpi_id, profile_id, value')
      .in('kpi_id', metricIds).in('profile_id', repIds)
      .lte('period_start', avgEnd).gte('period_end', avgStart),
  ]);

  // Sum current week by KPI (org-wide)
  const currByKpi = {};
  for (const v of (currValues || [])) {
    currByKpi[v.kpi_id] = (currByKpi[v.kpi_id] || 0) + (v.value || 0);
  }
  // 4-week average by KPI
  const avgByKpi = {};
  const avgCounts = {};
  for (const v of (avgValues || [])) {
    avgByKpi[v.kpi_id] = (avgByKpi[v.kpi_id] || 0) + (v.value || 0);
    avgCounts[v.kpi_id] = (avgCounts[v.kpi_id] || 0) + 1;
  }

  const anomalies = [];
  const kpiSummary = [];
  for (const m of metrics) {
    const currVal = currByKpi[m.id] || 0;
    const avgTotal = avgByKpi[m.id] || 0;
    const avgVal = avgCounts[m.id] ? avgTotal / 4 : 0; // divide by 4 weeks
    const deviation = avgVal > 0 ? ((currVal - avgVal) / avgVal * 100) : 0;
    kpiSummary.push({ name: m.name, current: currVal, avg: Math.round(avgVal), deviation: Math.round(deviation) });
    if (deviation <= -30) {
      anomalies.push({ name: m.name, deviation: Math.round(deviation), current: currVal, avg: Math.round(avgVal) });
    }
  }
  anomalies.sort((a, b) => a.deviation - b.deviation);

  let bodyHtml = '';
  bodyHtml += buildStatGrid([
    { value: metrics.length, label: 'KPIs Tracked' },
    { value: anomalies.length, label: 'Anomalies', color: anomalies.length > 0 ? COLORS.red : COLORS.green },
    { value: reps.length, label: 'Active Reps' },
  ], 3);

  if (anomalies.length > 0) {
    bodyHtml += buildListSection('⚠️', 'KPI Anomalies (>30% below average)', anomalies.slice(0, 5).map(a =>
      `<strong>${a.name}</strong> — ${a.deviation}% vs 4-week avg (current: ${a.current}, avg: ${a.avg})`
    ), 'card', COLORS.red);
  }

  bodyHtml += '<div style="margin: 20px 0;"><h3 style="margin: 0 0 10px 0; font-size: 16px;">KPI Overview</h3>';
  bodyHtml += buildTable(
    ['KPI', 'This Week', '4-Wk Avg', 'Change'],
    kpiSummary.slice(0, 10).map(k => [
      k.name,
      String(k.current),
      String(k.avg),
      `<span style="color: ${k.deviation >= 0 ? COLORS.green : COLORS.red}">${k.deviation >= 0 ? '+' : ''}${k.deviation}%</span>`,
    ])
  );
  bodyHtml += '</div>';

  const html = buildEmailWrapper('Analytics Report', `Week of ${new Date(currStart).toLocaleDateString()}`, bodyHtml, {
    ctaUrl: `${FRONTEND_URL}/analytics`,
    ctaLabel: 'View Full Analytics',
  });

  const text = [
    `Analytics Report — Week of ${new Date(currStart).toLocaleDateString()}`,
    `KPIs: ${metrics.length} | Anomalies: ${anomalies.length} | Reps: ${reps.length}`,
    '',
    ...(anomalies.length > 0 ? [
      'Anomalies:',
      ...anomalies.slice(0, 5).map(a => `  ${a.name}: ${a.deviation}% (current: ${a.current}, avg: ${a.avg})`),
      '',
    ] : []),
    `View full report: ${FRONTEND_URL}/analytics`,
  ].join('\n');

  return { html, text, subject: 'Your Apptivia Analytics Report' };
}

// ── Coach Report ────────────────────────────────────────────────────

async function generateCoachReport(sb, orgId, opts) {
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  // Coaching plans by status
  const { data: plans } = await sb
    .from('coaching_plans')
    .select('id, status')
    .eq('organization_id', orgId);

  const planCounts = { draft: 0, active: 0, completed: 0, overdue: 0, total: 0 };
  for (const p of (plans || [])) {
    planCounts.total++;
    if (planCounts[p.status] !== undefined) planCounts[p.status]++;
  }

  // Recent badges
  const { data: orgReps } = await sb
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .not('role', 'in', '("admin","manager","coach")');

  const repIds = (orgReps || []).map(r => r.id);
  let recentBadges = [];
  if (repIds.length > 0) {
    const { data: badges } = await sb
      .from('profile_badges')
      .select('badge_name, rarity, earned_at, profile:profiles(first_name, last_name)')
      .in('profile_id', repIds)
      .gte('earned_at', since7d)
      .order('earned_at', { ascending: false })
      .limit(10);
    recentBadges = badges || [];
  }

  // Skillset progress
  let skillsetHighlights = [];
  if (repIds.length > 0) {
    const { data: skillsets } = await sb
      .from('profile_skillsets')
      .select('skillset:skillsets(name), progress, profile:profiles(first_name, last_name)')
      .in('profile_id', repIds)
      .gte('progress', 80)
      .order('progress', { ascending: false })
      .limit(5);
    skillsetHighlights = skillsets || [];
  }

  let bodyHtml = '';
  bodyHtml += buildStatGrid([
    { value: planCounts.total, label: 'Total Plans' },
    { value: planCounts.active, label: 'Active', color: COLORS.coral },
    { value: planCounts.completed, label: 'Completed', color: COLORS.green },
    { value: planCounts.overdue, label: 'Overdue', color: planCounts.overdue > 0 ? COLORS.red : COLORS.gray },
  ]);

  if (recentBadges.length > 0) {
    bodyHtml += buildListSection('🏅', 'Badges Earned This Week', recentBadges.map(b => {
      const name = `${b.profile?.first_name || ''} ${b.profile?.last_name || ''}`.trim() || 'Team Member';
      const rarity = b.rarity ? ` [${b.rarity.toUpperCase()}]` : '';
      return `<strong>${b.badge_name}</strong>${rarity} — ${name}`;
    }), 'bullet');
  }

  if (skillsetHighlights.length > 0) {
    bodyHtml += buildListSection('📈', 'Skillset Milestones (80%+)', skillsetHighlights.map(s => {
      const name = `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim() || 'Team Member';
      return `<strong>${s.skillset?.name || 'Skillset'}</strong> — ${name} (${s.progress}%)`;
    }), 'card', COLORS.coral);
  }

  if (planCounts.total === 0 && recentBadges.length === 0) {
    bodyHtml += `<div style="text-align: center; padding: 30px; color: ${COLORS.gray}; font-size: 14px;">No coaching activity this period. Create coaching plans to start tracking progress.</div>`;
  }

  const html = buildEmailWrapper('Coaching Insights', 'Weekly coaching activity summary', bodyHtml, {
    ctaUrl: `${FRONTEND_URL}/coaching-plans`,
    ctaLabel: 'View Coaching Dashboard',
  });

  const text = [
    'Coaching Insights — Weekly Summary',
    `Plans: ${planCounts.total} total (${planCounts.active} active, ${planCounts.completed} completed, ${planCounts.overdue} overdue)`,
    `Badges earned: ${recentBadges.length}`,
    '',
    `View full report: ${FRONTEND_URL}/coaching-plans`,
  ].join('\n');

  return { html, text, subject: 'Your Apptivia Coaching Insights' };
}

// ── Contests Report ─────────────────────────────────────────────────

async function generateContestsReport(sb, orgId, opts) {
  const now = new Date().toISOString();
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: contests } = await sb
    .from('contests')
    .select('id, name, kpi_key, status, start_date, end_date')
    .eq('organization_id', orgId)
    .in('status', ['active', 'completed', 'upcoming'])
    .order('start_date', { ascending: false });

  const active = (contests || []).filter(c => c.status === 'active');
  const completed = (contests || []).filter(c => c.status === 'completed' && c.end_date >= since7d);
  const upcoming = (contests || []).filter(c => c.status === 'upcoming');

  // Get leaderboard top 3 for active contests
  const leaderboardData = {};
  for (const c of active.slice(0, 5)) {
    const { data: lb } = await sb
      .from('contest_leaderboards')
      .select('rank, score, profile:profiles(first_name, last_name)')
      .eq('contest_id', c.id)
      .order('rank', { ascending: true })
      .limit(3);
    leaderboardData[c.id] = lb || [];
  }

  let bodyHtml = '';
  bodyHtml += buildStatGrid([
    { value: active.length, label: 'Active Contests', color: COLORS.green },
    { value: completed.length, label: 'Completed (7d)' },
    { value: upcoming.length, label: 'Upcoming', color: COLORS.coral },
  ], 3);

  if (active.length > 0) {
    bodyHtml += '<div style="margin: 20px 0;"><h3 style="margin: 0 0 10px 0; font-size: 16px;">🏁 Active Contests</h3>';
    for (const c of active.slice(0, 5)) {
      const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date) - Date.now()) / 86400000));
      bodyHtml += `<div style="background: #f9fafb; padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${COLORS.green};">
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${c.name}</div>
        <div style="font-size: 12px; color: ${COLORS.gray};">${daysLeft} days remaining | KPI: ${c.kpi_key || 'N/A'}</div>`;
      const lb = leaderboardData[c.id] || [];
      if (lb.length > 0) {
        bodyHtml += '<div style="margin-top: 6px; font-size: 13px;">';
        for (const entry of lb) {
          const name = `${entry.profile?.first_name || ''} ${entry.profile?.last_name || ''}`.trim() || 'Team Member';
          bodyHtml += `<div style="padding: 2px 0;">${entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'} ${name} — ${entry.score}</div>`;
        }
        bodyHtml += '</div>';
      }
      bodyHtml += '</div>';
    }
    bodyHtml += '</div>';
  }

  if (completed.length > 0) {
    bodyHtml += buildListSection('✅', 'Recently Completed', completed.slice(0, 5).map(c =>
      `<strong>${c.name}</strong> — ended ${new Date(c.end_date).toLocaleDateString()}`
    ), 'bullet');
  }

  if (upcoming.length > 0) {
    bodyHtml += buildListSection('📅', 'Upcoming', upcoming.slice(0, 5).map(c =>
      `<strong>${c.name}</strong> — starts ${new Date(c.start_date).toLocaleDateString()}`
    ), 'bullet');
  }

  if (!contests || contests.length === 0) {
    bodyHtml += `<div style="text-align: center; padding: 30px; color: ${COLORS.gray}; font-size: 14px;">No active contests. Create a contest to start gamifying performance!</div>`;
  }

  const html = buildEmailWrapper('Contest Results', 'Weekly contest standings', bodyHtml, {
    ctaUrl: `${FRONTEND_URL}/contests`,
    ctaLabel: 'View Contests',
  });

  const text = [
    'Contest Results — Weekly Summary',
    `Active: ${active.length} | Completed (7d): ${completed.length} | Upcoming: ${upcoming.length}`,
    '',
    `View full report: ${FRONTEND_URL}/contests`,
  ].join('\n');

  return { html, text, subject: 'Your Apptivia Contest Results' };
}

// ── Team Performance Report ─────────────────────────────────────────

async function generateTeamPerformanceReport(sb, orgId, opts) {
  const data = await fetchScorecardData(sb, orgId);
  if (!data || data.scores.length === 0) {
    return noDataReport('Team Performance', 'No rep data available for this period.');
  }

  const { data: teams } = await sb
    .from('teams')
    .select('id, name, manager_id')
    .eq('organization_id', orgId);

  const teamMap = {};
  for (const t of (teams || [])) {
    teamMap[t.id] = { ...t, scores: [] };
  }
  // Unassigned bucket
  teamMap['unassigned'] = { id: null, name: 'Unassigned', scores: [] };

  for (const s of data.scores) {
    const teamId = s.rep.team_id || 'unassigned';
    if (teamMap[teamId]) {
      teamMap[teamId].scores.push(s);
    } else {
      teamMap['unassigned'].scores.push(s);
    }
  }

  const teamStats = Object.values(teamMap)
    .filter(t => t.scores.length > 0)
    .map(t => {
      const avg = Math.round(t.scores.reduce((s, r) => s + r.currentScore, 0) / t.scores.length);
      const top = t.scores[0]; // already sorted by score desc
      return { name: t.name, avg, count: t.scores.length, topPerformer: top.name, topScore: top.currentScore };
    })
    .sort((a, b) => b.avg - a.avg);

  let bodyHtml = '';
  bodyHtml += buildStatGrid([
    { value: teamStats.length, label: 'Teams' },
    { value: data.teamAvg, label: 'Org Average', color: data.teamAvg >= 80 ? COLORS.green : COLORS.amber },
    { value: data.scores.length, label: 'Total Reps' },
  ], 3);

  bodyHtml += '<div style="margin: 20px 0;"><h3 style="margin: 0 0 10px 0; font-size: 16px;">Team Rankings</h3>';
  bodyHtml += buildTable(
    ['Rank', 'Team', 'Avg Score', 'Reps', 'Top Performer'],
    teamStats.map((t, i) => [
      `#${i + 1}`,
      `<strong>${t.name}</strong>`,
      `<span style="color: ${t.avg >= 80 ? COLORS.green : t.avg >= 60 ? COLORS.amber : COLORS.red}">${t.avg}</span>`,
      String(t.count),
      `${t.topPerformer} (${t.topScore})`,
    ])
  );
  bodyHtml += '</div>';

  const html = buildEmailWrapper('Team Performance', `Week of ${new Date(data.currStart).toLocaleDateString()}`, bodyHtml, {
    ctaUrl: `${FRONTEND_URL}/analytics`,
    ctaLabel: 'View Full Dashboard',
  });

  const text = [
    `Team Performance — Week of ${new Date(data.currStart).toLocaleDateString()}`,
    `Org Average: ${data.teamAvg} | Teams: ${teamStats.length} | Reps: ${data.scores.length}`,
    '',
    'Team Rankings:',
    ...teamStats.map((t, i) => `  ${i + 1}. ${t.name} — Avg: ${t.avg}, Top: ${t.topPerformer} (${t.topScore})`),
    '',
    `View full report: ${FRONTEND_URL}/analytics`,
  ].join('\n');

  return { html, text, subject: 'Your Apptivia Team Performance Report' };
}

// ── No-data fallback ────────────────────────────────────────────────

function noDataReport(title, message) {
  const bodyHtml = `<div style="text-align: center; padding: 40px; color: ${COLORS.gray}; font-size: 14px;">${message}</div>`;
  const html = buildEmailWrapper(title, 'Automated Report', bodyHtml, {
    ctaUrl: FRONTEND_URL,
    ctaLabel: 'Open Apptivia',
  });
  return { html, text: `${title}\n\n${message}\n\n${FRONTEND_URL}`, subject: `Apptivia ${title}` };
}

// ── Router ──────────────────────────────────────────────────────────

async function generateReport(sb, report) {
  const opts = {
    includeSummary: report.include_summary !== false,
    includeCharts: report.include_charts !== false,
  };
  switch (report.report_type) {
    case 'scorecard':        return generateScorecardReport(sb, report.organization_id, opts);
    case 'analytics':        return generateAnalyticsReport(sb, report.organization_id, opts);
    case 'coach':            return generateCoachReport(sb, report.organization_id, opts);
    case 'contests':         return generateContestsReport(sb, report.organization_id, opts);
    case 'team_performance': return generateTeamPerformanceReport(sb, report.organization_id, opts);
    default:
      return noDataReport('Report', `Unknown report type: ${report.report_type}`);
  }
}

// ── Exports ─────────────────────────────────────────────────────────

module.exports = {
  generateReport,
  computeNextScheduledAt,
  buildEmailWrapper,
};
