/**
 * CEP (Customer Engagement Process) default templates and constants.
 * Used by useCepConfig.seedDefaultStages() and PipelineOperator fallback rendering.
 */

// Color map for legacy (non-CEP) pipeline stage keys
export const DEFAULT_STAGE_COLORS: Record<string, string> = {
  discovery: '#3b82f6',
  qualification: '#6366f1',
  proposal: '#8b5cf6',
  negotiation: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
};

// Palette for assigning colors to new stages
export const STAGE_COLOR_PALETTE = [
  '#94a3b8', '#60a5fa', '#818cf8', '#a78bfa',
  '#c084fc', '#e879f9', '#f472b6', '#fb7185',
  '#f59e0b', '#34d399', '#2dd4bf', '#38bdf8',
];

export function getStageColor(index: number): string {
  return STAGE_COLOR_PALETTE[index % STAGE_COLOR_PALETTE.length];
}

export interface CepStageTemplate {
  stage_key: string;
  stage_name: string;
  stage_order: number;
  color: string;
  win_probability: number;
  expected_days: number | null;
  is_terminal: boolean;
  checklist_items: { key: string; label: string; required: boolean }[];
  exit_criteria: { key: string; label: string }[];
  role_responsibilities: { title: string; responsibility: string }[];
}

export const STANDARD_B2B_TEMPLATE: CepStageTemplate[] = [
  {
    stage_key: 'lead',
    stage_name: 'Lead',
    stage_order: 1,
    color: '#94a3b8',
    win_probability: 5,
    expected_days: 7,
    is_terminal: false,
    checklist_items: [
      { key: 'lead_source_identified', label: 'Lead source identified', required: true },
      { key: 'contact_info_verified', label: 'Contact info verified', required: true },
    ],
    exit_criteria: [{ key: 'initial_outreach_complete', label: 'Initial outreach completed' }],
    role_responsibilities: [{ title: 'BDR', responsibility: 'Qualify inbound lead and schedule first meeting' }],
  },
  {
    stage_key: 'opp_creation',
    stage_name: 'Opp Creation',
    stage_order: 2,
    color: '#60a5fa',
    win_probability: 10,
    expected_days: 5,
    is_terminal: false,
    checklist_items: [
      { key: 'opportunity_created_in_crm', label: 'Opportunity created in CRM', required: true },
      { key: 'stakeholder_mapped', label: 'Key stakeholders mapped', required: false },
    ],
    exit_criteria: [{ key: 'discovery_call_scheduled', label: 'Discovery call scheduled' }],
    role_responsibilities: [
      { title: 'BDR', responsibility: 'Create opportunity record' },
      { title: 'AE', responsibility: 'Confirm deal viability' },
    ],
  },
  {
    stage_key: 'qualification',
    stage_name: 'Qualification',
    stage_order: 3,
    color: '#818cf8',
    win_probability: 20,
    expected_days: 14,
    is_terminal: false,
    checklist_items: [
      { key: 'bant_completed', label: 'BANT/MEDDPICC qualification completed', required: true },
      { key: 'champion_identified', label: 'Champion/economic buyer identified', required: true },
      { key: 'pain_points_documented', label: 'Pain points documented', required: false },
      { key: 'competitive_landscape_mapped', label: 'Competitive landscape mapped', required: false },
    ],
    exit_criteria: [
      { key: 'budget_range_confirmed', label: 'Budget range confirmed' },
      { key: 'timeline_established', label: 'Timeline established' },
    ],
    role_responsibilities: [
      { title: 'BDR', responsibility: 'Conduct initial discovery and hand off qualified details' },
      { title: 'AE', responsibility: 'Lead deeper qualification calls and discovery' },
      { title: 'PS', responsibility: 'Provide technical validation if needed' },
    ],
  },
  {
    stage_key: 'best_case',
    stage_name: 'Best Case',
    stage_order: 4,
    color: '#a78bfa',
    win_probability: 40,
    expected_days: 14,
    is_terminal: false,
    checklist_items: [
      { key: 'demo_delivered', label: 'Demo/proof-of-concept delivered', required: true },
      { key: 'proposal_sent', label: 'Proposal/quote sent', required: true },
      { key: 'decision_criteria_agreed', label: 'Decision criteria agreed upon', required: false },
    ],
    exit_criteria: [{ key: 'verbal_intent', label: 'Verbal intent to proceed received' }],
    role_responsibilities: [
      { title: 'AE', responsibility: 'Deliver tailored demo and proposal' },
      { title: 'PS', responsibility: 'Support technical proof-of-concept' },
    ],
  },
  {
    stage_key: 'forecast',
    stage_name: 'Forecast',
    stage_order: 5,
    color: '#c084fc',
    win_probability: 60,
    expected_days: 10,
    is_terminal: false,
    checklist_items: [
      { key: 'pricing_agreed', label: 'Pricing and terms agreed', required: true },
      { key: 'legal_review_started', label: 'Legal/procurement review started', required: false },
      { key: 'implementation_plan_shared', label: 'Implementation plan shared', required: false },
    ],
    exit_criteria: [{ key: 'written_confirmation', label: 'Written confirmation of intent' }],
    role_responsibilities: [
      { title: 'AE', responsibility: 'Negotiate final terms' },
      { title: 'CSS', responsibility: 'Prepare implementation timeline' },
    ],
  },
  {
    stage_key: 'commit',
    stage_name: 'Commit',
    stage_order: 6,
    color: '#e879f9',
    win_probability: 80,
    expected_days: 7,
    is_terminal: false,
    checklist_items: [
      { key: 'contract_sent', label: 'Contract sent for signature', required: true },
      { key: 'internal_approvals_complete', label: 'Internal approvals complete', required: true },
    ],
    exit_criteria: [{ key: 'signature_received', label: 'Contract signed' }],
    role_responsibilities: [
      { title: 'AE', responsibility: 'Shepherd contract through signature' },
      { title: 'CSS', responsibility: 'Begin onboarding prep' },
    ],
  },
  {
    stage_key: 'closed_won',
    stage_name: 'Closed Won',
    stage_order: 7,
    color: '#34d399',
    win_probability: 100,
    expected_days: null,
    is_terminal: true,
    checklist_items: [
      { key: 'revenue_booked', label: 'Revenue booked in system', required: true },
      { key: 'handoff_complete', label: 'AE-to-CS handoff complete', required: true },
    ],
    exit_criteria: [],
    role_responsibilities: [
      { title: 'AE', responsibility: 'Complete handoff documentation' },
      { title: 'CSS', responsibility: 'Begin customer onboarding' },
    ],
  },
  {
    stage_key: 'closed_lost',
    stage_name: 'Closed Lost',
    stage_order: 8,
    color: '#f87171',
    win_probability: 0,
    expected_days: null,
    is_terminal: true,
    checklist_items: [
      { key: 'loss_reason_documented', label: 'Loss reason documented', required: true },
    ],
    exit_criteria: [],
    role_responsibilities: [
      { title: 'AE', responsibility: 'Document loss reason and competitive intel' },
    ],
  },
];

export interface TitleTemplate {
  title_key: string;
  title_name: string;
  description: string;
  sort_order: number;
}

export const DEFAULT_TITLES: TitleTemplate[] = [
  { title_key: 'bdr', title_name: 'BDR', description: 'Business Development Representative', sort_order: 1 },
  { title_key: 'ae', title_name: 'AE', description: 'Account Executive', sort_order: 2 },
  { title_key: 'ps', title_name: 'PS', description: 'Pre-Sales / Solutions Engineer', sort_order: 3 },
  { title_key: 'ts', title_name: 'TS', description: 'Technical Specialist', sort_order: 4 },
  { title_key: 'css', title_name: 'CSS', description: 'Customer Success Specialist', sort_order: 5 },
];
