/**
 * Standard job titles — single source of truth across the platform.
 * Used in: OnboardingWizard (Step 1 admin title, Step 3 invite),
 *          OrganizationSettings (invite modal), AccountSetup (read-only).
 */
export const TITLES = [
  { key: 'bdr', label: 'Business Development Rep' },
  { key: 'bd_leader', label: 'Business Development Leader' },
  { key: 'ae', label: 'Account Executive' },
  { key: 'sales_leader', label: 'Sales Leader' },
  { key: 'marketing_rep', label: 'Marketing Rep' },
  { key: 'marketing_leader', label: 'Marketing Leader' },
  { key: 'cs_rep', label: 'Customer Success Rep' },
  { key: 'cs_leader', label: 'Customer Success Leader' },
] as const;

export type TitleKey = (typeof TITLES)[number]['key'];

export const TITLE_LABELS = TITLES.map(t => t.label);
