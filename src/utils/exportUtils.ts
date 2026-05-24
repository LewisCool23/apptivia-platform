// Utility functions for exporting data to CSV format
import { prettifyKpiKey } from '../constants/kpiGuidance';

interface ExportData {
  headers: string[];
  rows: any[][];
  filename: string;
}

/** Map of kpi_key → unit string (e.g. 'currency', 'minutes', 'percentage') */
export type KpiUnitMap = Record<string, string>;

/** Format a raw KPI value based on its unit type */
export function formatKpiValue(value: number, unit?: string): string {
  if (value == null || isNaN(value)) return '0';
  if (unit === 'currency' || unit === 'dollars') return '$' + Math.round(value).toLocaleString();
  if (unit === 'percentage' || unit === 'percent') return value.toFixed(1) + '%';
  if (unit === 'minutes') return Math.round(value).toLocaleString() + 'm';
  if (unit === 'seconds') return Math.round(value).toLocaleString() + 's';
  if (unit === 'hours') return Math.round(value).toLocaleString() + ' hrs';
  if (unit === 'days') return Math.round(value).toLocaleString() + ' days';
  return Math.round(value).toLocaleString();
}

export function exportToCSV(data: ExportData) {
  const { headers, rows, filename } = data;

  // Build CSV content
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add data rows
  rows.forEach(row => {
    const values = row.map(value => {
      // Handle values that contain commas, quotes, or newlines
      const stringValue = value?.toString() || '';
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  });

  const csvContent = csvRows.join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportScorecardToCSV(data: any, filters: any, kpiUnits: KpiUnitMap = {}) {
  const kpiKeys: string[] = data.scorecardKpiKeys || [];

  const headers = [
    'Rep Name',
    ...kpiKeys.flatMap((k: string) => [prettifyKpiKey(k), prettifyKpiKey(k) + ' %']),
    'Apptivity Score'
  ];

  const rows = data.rows.map((row: any) => [
    row.name,
    ...kpiKeys.flatMap((k: string) => [
      formatKpiValue(row.kpis?.[k]?.value || 0, kpiUnits[k]),
      Math.round(row.kpis?.[k]?.percentage || 0),
    ]),
    row.apptivityScore
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['Summary Statistics']);
  rows.push(['Top Performer', data.topPerformer?.name || 'N/A', ...Array(kpiKeys.length * 2 - 1).fill(''), data.topPerformer?.score || 0]);
  rows.push(['Team Average', ...Array(kpiKeys.length * 2).fill(''), data.teamAverage]);
  rows.push(['Above Target', data.aboveTarget]);
  rows.push(['Need Coaching', data.needCoaching]);

  exportToCSV({
    headers,
    rows,
    filename: 'apptivia_scorecard'
  });
}

export function exportCoachDataToCSV(data: any, filters: any) {
  const headers = [
    'Skillset',
    'Progress %',
    'Next Achievement',
    'Achievements Completed',
    'Skillset Points'
  ];

  const rows = data.skillsets.map((skillset: any) => [
    skillset.skillset_name,
    skillset.progress,
    skillset.next_achievement,
    skillset.achievements_completed,
    skillset.points
  ]);

  // Add summary
  rows.push([]);
  rows.push(['Team Summary']);
  rows.push(['Average Level', data.avgLevel]);
  rows.push(['Average Score', data.avgScore + '%']);
  rows.push(['Total Members', data.totalMembers]);
  rows.push(['Scorecard Streak', data.scorecardStreak]);
  rows.push(['Total Badges', data.totalBadges]);
  rows.push(['Total Achievements', data.totalAchievements]);
  rows.push(['Total Points', data.totalPoints]);
  rows.push(['Average Level Points', data.avgPoints]);
  rows.push(['Level Progress %', data.levelProgress]);
  rows.push(['Points to Next Level', data.pointsToNextLevel]);

  exportToCSV({
    headers,
    rows,
    filename: 'apptivia_coach'
  });
}

export function exportContestResultsToCSV(contest: any) {
  const headers = [
    'Rank',
    'Participant',
    'Team',
    'Score',
    'Previous Rank',
    'Rank Change',
  ];

  const leaderboard = contest.leaderboard || [];
  const rows = leaderboard.map((entry: any) => [
    entry.rank,
    entry.profile_name || 'Unknown',
    entry.team_name || '-',
    entry.score,
    entry.previous_rank ?? '-',
    entry.rank_change || '-',
  ]);

  // Add contest metadata
  rows.push([]);
  rows.push(['Contest Details']);
  rows.push(['Name', contest.name]);
  rows.push(['Status', contest.status]);
  rows.push(['Start Date', contest.start_date]);
  rows.push(['End Date', contest.end_date]);
  rows.push(['KPI', contest.kpi_key]);
  rows.push(['Calculation', contest.calculation_type]);
  rows.push(['Participants', contest.participant_count || leaderboard.length]);
  if (contest.winner_name) rows.push(['Winner', contest.winner_name]);
  if (contest.reward_value) rows.push(['Reward', contest.reward_value]);

  const contestName = (contest.name || 'contest').replace(/\s+/g, '_').toLowerCase();
  exportToCSV({
    headers,
    rows,
    filename: `contest_${contestName}`,
  });
}

export function exportBadgesToCSV(badges: any[], profile?: any) {
  const earned = badges.filter((b: any) => b.earned_at || b.is_earned);
  const headers = ['Badge Name', 'Category', 'Rarity', 'Points', 'Earned Date'];

  const rows = earned.map((b: any) => [
    b.badge_name || b.name || 'Badge',
    b.badge_type || b.category || '',
    b.rarity || 'common',
    b.points || 0,
    b.earned_at ? new Date(b.earned_at).toLocaleDateString() : '-',
  ]);

  // Summary
  rows.push([]);
  rows.push(['Badge Summary']);
  rows.push(['Total Earned', earned.length]);
  rows.push(['Legendary', earned.filter((b: any) => b.rarity === 'legendary').length]);
  rows.push(['Epic', earned.filter((b: any) => b.rarity === 'epic').length]);
  rows.push(['Rare', earned.filter((b: any) => b.rarity === 'rare').length]);
  rows.push(['Uncommon', earned.filter((b: any) => b.rarity === 'uncommon').length]);
  rows.push(['Common', earned.filter((b: any) => b.rarity === 'common').length]);
  if (profile) {
    rows.push([]);
    rows.push(['Profile', `${profile.first_name || ''} ${profile.last_name || ''}`.trim()]);
  }

  exportToCSV({ headers, rows, filename: 'apptivia_badges' });
}

export function exportAnalyticsToCSV(data: any, aggregateKPIs: any, filters: any, kpiUnits: KpiUnitMap = {}) {
  // Build KPI columns from scorecard keys
  const kpiKeys: string[] = data.scorecardKpiKeys || [];

  const headers = [
    'Rank',
    'Rep Name',
    'Team',
    'Apptivity Score',
    ...kpiKeys.flatMap((k: string) => [prettifyKpiKey(k) + ' (Value)', prettifyKpiKey(k) + ' (% Goal)']),
  ];

  const rows = data.rows.map((row: any, index: number) => [
    index + 1,
    row.name,
    row.team_name || '',
    row.apptivityScore + '%',
    ...kpiKeys.flatMap((k: string) => {
      const kpi = row.kpis?.[k];
      return [kpi?.value != null ? formatKpiValue(kpi.value, kpiUnits[k]) : '', kpi?.percentage != null ? kpi.percentage + '%' : ''];
    }),
  ]);

  // Add aggregate KPIs summary (dynamic array or legacy object)
  rows.push([]);
  rows.push(['Aggregate KPIs']);
  if (Array.isArray(aggregateKPIs)) {
    aggregateKPIs.forEach((kpi: any) => {
      rows.push([kpi.name, formatKpiValue(kpi.total, kpi.unit)]);
    });
  } else {
    // Legacy fallback
    if (aggregateKPIs.totalCalls != null) rows.push(['Total Call Connects', aggregateKPIs.totalCalls]);
    if (aggregateKPIs.totalMeetings != null) rows.push(['Total Meetings', aggregateKPIs.totalMeetings]);
    if (aggregateKPIs.totalTalkTime != null) rows.push(['Total Talk Time (minutes)', aggregateKPIs.totalTalkTime]);
  }

  // Add filter context
  rows.push([]);
  rows.push(['Export Filters']);
  if (filters.dateRange) rows.push(['Date Range', filters.dateRange]);
  if (filters.teams?.length) rows.push(['Teams', filters.teams.join(', ')]);
  if (filters.departments?.length) rows.push(['Departments', filters.departments.join(', ')]);

  exportToCSV({
    headers,
    rows,
    filename: 'apptivia_analytics'
  });
}
