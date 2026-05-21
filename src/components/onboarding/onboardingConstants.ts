/**
 * Onboarding Wizard Constants & Types
 * Single source of truth for step definitions, state shape, and validation.
 */

import { Building2, Compass, Users, BarChart3, Target, CreditCard, Plug, Settings, Trophy } from 'lucide-react';

// ── Step Definitions ─────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { id: 1, title: 'Organization Info', icon: Building2 },
  { id: 2, title: 'Sales DNA', icon: Compass },
  { id: 3, title: 'Team Structure', icon: Users },
  { id: 4, title: 'KPI Configuration', icon: BarChart3 },
  { id: 5, title: 'Your Market', icon: Target },
  { id: 6, title: 'Choose Your Plan', icon: CreditCard },
  { id: 7, title: 'Connect Integration', icon: Plug },
  { id: 8, title: 'Optional Setup', icon: Settings },
  { id: 9, title: 'Review & Launch', icon: Trophy },
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

// Steps where the "Skip" button should NOT appear
export const MANDATORY_STEPS = [1, 2, 3, 4, 5, 6, 7, 9];

// ── Default KPIs ─────────────────────────────────────────────────────
// Empty so StepKpiConfig always fetches the full catalog from kpi_metrics.
export const DEFAULT_KPIS: KpiGoal[] = [];

// ── Industry Options ─────────────────────────────────────────────────

export const INDUSTRY_OPTIONS = [
  'Automotive',
  'Construction',
  'Education',
  'Energy / Utilities',
  'Financial Services',
  'Government',
  'Healthcare',
  'Hospitality',
  'Insurance',
  'Legal',
  'Logistics / Transportation',
  'Manufacturing',
  'Media / Entertainment',
  'Nonprofit',
  'Pharma / Life Sciences',
  'Professional Services',
  'Real Estate',
  'Retail / E-Commerce',
  'Technology / SaaS',
  'Telecommunications',
  'Other',
];

// ── Wizard State Shape ───────────────────────────────────────────────

export interface OrgData {
  name: string;
  industry: string;
  primary_contact_name: string;
  primary_contact_email: string;
}

export interface Department {
  id?: string;
  name: string;
  sort_order: number;
}

export interface TeamData {
  id?: string;
  name: string;
  description: string;
  departmentName: string;
  managerId: string | null;
}

export interface TeamMember {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  title: string;
  title_key?: string;
  teamName: string;
}

export interface KpiGoal {
  key: string;
  name: string;
  goal: number;
  weight: number;
  unit: string;
  enabled: boolean;
  category?: string;
}

export interface IcpConfig {
  enabled: boolean;
  target_industries: string[];
  headcount_min: string;
  headcount_max: string;
  revenue_min_m: string;
  revenue_max_m: string;
  target_technologies: string[];
}

export interface SignalConfig {
  pain_points: string[];
  solution_keywords: string[];
  job_titles_to_track: string[];
  competitors: string[];
  tech_stack_churning: string[];
}

export interface IcpProfileDraft {
  name: string;
  description: string;
  icp_config: {
    enabled: boolean;
    target_industries: string[];
    headcount_min: number | null;
    headcount_max: number | null;
    revenue_min_m: number | null;
    revenue_max_m: number | null;
    target_technologies: string[];
    exclude_industries: string[];
    weights: { industry: number; headcount: number; revenue: number; technology: number };
  };
  signal_config: {
    pain_points: string[];
    solution_keywords: string[];
    job_titles_to_track: string[];
    competitors: string[];
    tech_stack_churning: string[];
    exclude_industries: string[];
  };
  is_default: boolean;
}

export interface WallboardSlide {
  enabled: boolean;
  duration: number;
}

export interface WallboardSettings {
  slides: Record<string, WallboardSlide>;
  celebrations: boolean;
}

export interface WizardState {
  orgData: OrgData;
  adminTitle: string;
  salesDna: any;
  departments: Department[];
  teams: TeamData[];
  teamMembers: TeamMember[];
  kpiGoals: KpiGoal[];
  selectedTemplate: string | null;
  icpConfig: IcpConfig;
  signalConfig: SignalConfig;
  icpProfiles?: IcpProfileDraft[];
  selectedTier: string;
  selectedIntegration: any;
  integrationApiKey: string;
  integrationTestStatus: string | null;
  integrationMethod: 'crm' | 'csv' | null;
  wallboardSettings: WallboardSettings;
  cepSeeded: boolean;
}

// ── Default State ────────────────────────────────────────────────────

export const DEFAULT_WALLBOARD_SETTINGS: WallboardSettings = {
  slides: {
    leaderboard:  { enabled: true, duration: 15 },
    spotlight:    { enabled: true, duration: 15 },
    contests:     { enabled: true, duration: 15 },
    team_stats:   { enabled: true, duration: 15 },
    badges:       { enabled: true, duration: 15 },
    activity:     { enabled: true, duration: 15 },
    achievements: { enabled: true, duration: 15 },
    goals:        { enabled: true, duration: 15 },
  },
  celebrations: true,
};

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  pain_points: [],
  solution_keywords: [],
  job_titles_to_track: [],
  competitors: [],
  tech_stack_churning: [],
};

export const DEFAULT_ICP_CONFIG: IcpConfig = {
  enabled: true,
  target_industries: [],
  headcount_min: '',
  headcount_max: '',
  revenue_min_m: '',
  revenue_max_m: '',
  target_technologies: [],
};

// ── Validation Helpers ───────────────────────────────────────────────

export function validateOrgInfo(data: OrgData): string | null {
  if (!data.name.trim()) return 'Company name is required';
  if (!data.industry) return 'Industry is required';
  if (!data.primary_contact_name.trim()) return 'Contact name is required';
  if (!data.primary_contact_email.trim()) return 'Contact email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primary_contact_email))
    return 'Please enter a valid email address';
  return null;
}

export function validateSalesDna(salesDna: any): string | null {
  if (salesDna.qualification_framework === 'custom') {
    if (!salesDna.custom_qualification_name?.trim()) return 'Please enter your custom qualification framework name';
    if (!salesDna.custom_qualification_criteria?.length || salesDna.custom_qualification_criteria.length < 2)
      return 'Custom framework needs at least 2 criteria';
  } else if (!salesDna.qualification_framework) {
    return 'Please select a qualification framework';
  }
  if (salesDna.methodology_approach === 'custom') {
    if (!salesDna.custom_methodology_name?.trim())
      return 'Please enter your custom methodology name';
  } else {
    if (!salesDna.primary_methodology)
      return 'Please select a sales methodology';
    if (salesDna.methodology_approach === 'hybrid' && !salesDna.secondary_methodology)
      return 'Please select a secondary methodology for hybrid approach';
  }
  return null;
}

export function validateTeamStructure(
  departments: Department[],
  teams: TeamData[],
  teamMembers?: TeamMember[],
): string | null {
  if (departments.length === 0 || !departments.some(d => d.name.trim()))
    return 'At least one department is required';
  if (teams.length === 0 || !teams.some(t => t.name.trim()))
    return 'At least one team is required';
  const namedTeams = teams.filter(t => t.name.trim());
  const missingManager = namedTeams.find(t => !t.managerId);
  if (missingManager)
    return `Team "${missingManager.name}" needs a manager assigned`;
  if (teamMembers) {
    const members = teamMembers.filter(m => m.email.trim() || m.first_name.trim());
    if (members.length === 0)
      return 'Invite at least one team member';
    const invalidEmail = members.find(m => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email.trim()));
    if (invalidEmail)
      return `"${invalidEmail.first_name || invalidEmail.email || 'A member'}" has an invalid email`;
    const noTeam = members.find(m => !m.teamName);
    if (noTeam)
      return `"${noTeam.first_name || noTeam.email}" needs a team assigned`;
  }
  return null;
}

export function validateKpiGoals(goals: KpiGoal[]): string | null {
  const enabled = goals.filter(k => k.enabled);
  if (enabled.length < 3) return 'At least 3 KPIs must be enabled';
  if (enabled.length > 5) return 'Maximum 5 KPIs can be enabled';
  const total = enabled.reduce((sum, k) => sum + k.weight, 0);
  if (Math.abs(total - 100) > 0.5) return `KPI weights must sum to 100% (currently ${total}%)`;
  if (enabled.some(k => k.goal <= 0)) return 'All KPI goals must be greater than 0';
  return null;
}

export function validateMarket(
  icpConfig: IcpConfig,
  signalConfig: SignalConfig,
  icpProfiles?: IcpProfileDraft[],
): string | null {
  // Multi-profile validation: if profiles exist, validate them instead
  if (icpProfiles && icpProfiles.length > 0) {
    const hasValidProfile = icpProfiles.some(
      (p) =>
        p.icp_config.target_industries.length > 0 &&
        p.signal_config.pain_points.length > 0,
    );
    if (!hasValidProfile)
      return 'At least one ICP profile must have 1+ target industry and 1+ pain point';
    // Validate headcount ranges on each profile
    for (const p of icpProfiles) {
      if (
        p.icp_config.headcount_min != null &&
        p.icp_config.headcount_max != null &&
        p.icp_config.headcount_min > p.icp_config.headcount_max
      )
        return `Profile "${p.name}": headcount minimum cannot be greater than maximum`;
    }
    return null;
  }
  // Single-profile fallback (backward compat)
  if (!icpConfig.target_industries || icpConfig.target_industries.length === 0) return 'At least one target industry is required';
  if (
    icpConfig.headcount_min && icpConfig.headcount_max &&
    Number(icpConfig.headcount_min) > Number(icpConfig.headcount_max)
  ) return 'Headcount minimum cannot be greater than maximum';
  if (signalConfig.pain_points.length === 0) return 'At least one pain point is required';
  if (signalConfig.solution_keywords.length === 0) return 'At least one solution keyword is required';
  return null;
}

export function validateIntegration(
  method: 'crm' | 'csv' | null,
  selectedIntegration: any,
  testStatus: string | null,
): string | null {
  if (!method) return 'Please select a data source (CRM integration or CSV/Manual)';
  if (method === 'crm' && !selectedIntegration) return 'Please select a CRM integration';
  if (method === 'crm' && testStatus !== 'success') return 'Please test and verify your integration connection';
  return null;
}
