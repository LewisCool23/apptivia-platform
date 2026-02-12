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

export function exportAnalyticsToCSV(data: any, aggregateKPIs: any, filters: any) {
  const headers = [
    'Rank',
    'Rep Name',
    'Apptivity Score'
  ];

  const rows = data.rows.map((row: any, index: number) => [
    index + 1,
    row.name,
    row.apptivityScore + '%'
  ]);

  // Add aggregate KPIs
  rows.push([]);
  rows.push(['Aggregate KPIs']);
  rows.push(['Total Call Connects', aggregateKPIs.totalCalls]);
  rows.push(['Total Meetings', aggregateKPIs.totalMeetings]);
  rows.push(['Total Talk Time (minutes)', aggregateKPIs.totalTalkTime]);

  exportToCSV({
    headers,
    rows,
    filename: 'apptivia_analytics'
  });
}
