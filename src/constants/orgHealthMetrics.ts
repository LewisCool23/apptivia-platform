export interface OrgHealthMetricInfo {
  label: string;
  explanation: string;
  dataPoints: string[];
  linkLabel: string;
  linkTo: string;
}

export const ORG_HEALTH_METRICS: Record<string, OrgHealthMetricInfo> = {
  performance: {
    label: 'Team Performance',
    explanation:
      'Measures how well your reps are performing against their KPI goals. This score is based on the rolling average of scorecard scores across all active reps. A higher score means your team is consistently hitting or exceeding targets.',
    dataPoints: [
      'Average KPI attainment across all reps',
      'Number of reps above vs. below 80% attainment',
      'Week-over-week team trend direction',
    ],
    linkLabel: 'View KPI Attainment',
    linkTo: '/analytics?tab=kpi-attainment',
  },
  configuration: {
    label: 'Configuration',
    explanation:
      'Tracks whether your organization has completed essential setup steps. A fully configured org ensures accurate scoring, meaningful dashboards, and proper team structure. Each check represents a critical foundation element.',
    dataPoints: [
      'At least 3 active KPIs configured',
      'At least 3 KPIs visible on scorecard',
      'At least 1 team created',
      'At least 1 rep added',
      'At least 5 total KPIs for depth',
    ],
    linkLabel: 'Go to Settings',
    linkTo: '/settings',
  },
  coaching: {
    label: 'Coaching Activity',
    explanation:
      'Evaluates whether managers are actively coaching their team. This combines coaching plan coverage (target: plans for 25% of reps) with individual development plan adoption (target: IDPs for 10% of reps). Consistent coaching correlates with higher rep performance.',
    dataPoints: [
      'Active coaching plans vs. 25% of reps target',
      'Active IDPs vs. 10% of reps target',
      'Combined coaching coverage ratio',
    ],
    linkLabel: 'Open Coach',
    linkTo: '/coach',
  },
  engagement: {
    label: 'Engagement',
    explanation:
      'Measures team engagement through gamification and recognition. This combines active contest participation with badge earning activity over the last 30 days. High engagement indicates a motivated, competitive team culture.',
    dataPoints: [
      'Number of active contests',
      'Badges earned per rep (last 30 days)',
      'Combined engagement score',
    ],
    linkLabel: 'View Contests',
    linkTo: '/contests',
  },
  outbound: {
    label: 'Outbound Motion',
    explanation:
      'Tracks your team\'s outbound prospecting activity. This combines intent signal detection with active outreach sequence count over the last 30 days. A strong outbound motion means your team is finding and acting on buying signals consistently.',
    dataPoints: [
      'Intent signals detected (last 30 days)',
      'Active outreach sequences',
      'Signal-to-sequence conversion',
    ],
    linkLabel: 'Open Engage',
    linkTo: '/engage',
  },
};
