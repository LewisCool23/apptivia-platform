// Utility functions for exporting data to CSV format

interface ExportData {
  headers: string[];
  rows: any[][];
  filename: string;
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

export function exportScorecardToCSV(data: any, filters: any) {
  const headers = [
    'Rep Name',
    'Call Connects',
    'Call Connects %',
    'Talk Time Minutes',
    'Talk Time %',
    'Meetings',
    'Meetings %',
    'Sourced Opportunities',
    'Sourced Opps %',
    'Stage 2 Opportunities',
    'Stage 2 Opps %',
    'Apptivity Score'
  ];

  const rows = data.rows.map((row: any) => [
    row.name,
    Math.round(row.kpis.call_connects?.value || 0),
    Math.round(row.kpis.call_connects?.percentage || 0),
    Math.round(row.kpis.talk_time_minutes?.value || 0),
    Math.round(row.kpis.talk_time_minutes?.percentage || 0),
    Math.round(row.kpis.meetings?.value || 0),
    Math.round(row.kpis.meetings?.percentage || 0),
    Math.round(row.kpis.sourced_opps?.value || 0),
    Math.round(row.kpis.sourced_opps?.percentage || 0),
    Math.round(row.kpis.stage2_opps?.value || 0),
    Math.round(row.kpis.stage2_opps?.percentage || 0),
    row.apptivityScore
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['Summary Statistics']);
  rows.push(['Top Performer', data.topPerformer?.name || 'N/A', '', '', '', '', '', '', '', '', '', data.topPerformer?.score || 0]);
  rows.push(['Team Average', '', '', '', '', '', '', '', '', '', '', data.teamAverage]);
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

export function exportAnalyticsToCSV(data: any, aggregateKPIs: any, filters: any) {
  // Build KPI columns from scorecard keys
  const kpiKeys: string[] = data.scorecardKpiKeys || [];
  const prettify = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const headers = [
    'Rank',
    'Rep Name',
    'Team',
    'Apptivity Score',
    ...kpiKeys.flatMap((k: string) => [prettify(k) + ' (Value)', prettify(k) + ' (% Goal)']),
  ];

  const rows = data.rows.map((row: any, index: number) => [
    index + 1,
    row.name,
    row.team_name || '',
    row.apptivityScore + '%',
    ...kpiKeys.flatMap((k: string) => {
      const kpi = row.kpis?.[k];
      return [kpi?.value ?? '', kpi?.percentage != null ? kpi.percentage + '%' : ''];
    }),
  ]);

  // Add aggregate KPIs summary (dynamic array or legacy object)
  rows.push([]);
  rows.push(['Aggregate KPIs']);
  if (Array.isArray(aggregateKPIs)) {
    aggregateKPIs.forEach((kpi: any) => {
      rows.push([kpi.name, kpi.total]);
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
