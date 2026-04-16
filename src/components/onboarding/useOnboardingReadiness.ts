/**
 * useOnboardingReadiness — computes the readiness checklist from wizard state.
 */

import { useMemo } from 'react';
import type { WizardState } from './onboardingConstants';

export interface ReadinessItem {
  key: string;
  label: string;
  description: string;
  status: 'complete' | 'incomplete' | 'skipped';
  mandatory: boolean;
  stepNumber: number;
}

export function useOnboardingReadiness(state: WizardState): ReadinessItem[] {
  return useMemo(() => {
    const enabledKpis = state.kpiGoals.filter(k => k.enabled);
    const totalWeight = enabledKpis.reduce((sum, k) => sum + k.weight, 0);

    return [
      {
        key: 'org_info',
        label: 'Organization Info',
        description: 'Company name, industry, and contact',
        status: state.orgData.name.trim() && state.orgData.industry ? 'complete' : 'incomplete',
        mandatory: true,
        stepNumber: 1,
      },
      {
        key: 'sales_dna',
        label: 'Sales DNA & Pipeline',
        description: 'Methodology, qualification framework, and CEP stages seeded',
        status:
          state.salesDna.qualification_framework && state.cepSeeded
            ? 'complete'
            : state.salesDna.qualification_framework
              ? 'complete' // CEP will be seeded on save
              : 'incomplete',
        mandatory: true,
        stepNumber: 2,
      },
      {
        key: 'team_structure',
        label: 'Team Structure',
        description: 'Departments, teams, and member invites',
        status:
          state.departments.some(d => d.name.trim()) && state.teams.some(t => t.name.trim())
            ? 'complete'
            : 'incomplete',
        mandatory: true,
        stepNumber: 3,
      },
      {
        key: 'kpi_config',
        label: 'KPI Configuration',
        description: `${enabledKpis.length} KPIs, weights ${totalWeight}%`,
        status:
          enabledKpis.length >= 3 && enabledKpis.length <= 5 && Math.abs(totalWeight - 100) <= 0.5
            ? 'complete'
            : 'incomplete',
        mandatory: true,
        stepNumber: 4,
      },
      {
        key: 'market',
        label: 'Your Market',
        description: 'ICP profile and buyer signals',
        status:
          state.icpConfig.target_industries.length > 0 && state.signalConfig.pain_points.length > 0
            ? 'complete'
            : 'incomplete',
        mandatory: true,
        stepNumber: 5,
      },
      {
        key: 'subscription',
        label: 'Subscription Plan',
        description: state.selectedTier
          ? `${state.selectedTier === 'Basic' ? 'Starter' : state.selectedTier} selected`
          : 'Not selected',
        status: state.selectedTier ? 'complete' : 'incomplete',
        mandatory: true,
        stepNumber: 6,
      },
      {
        key: 'integration',
        label: 'Data Integration',
        description: state.integrationMethod === 'csv'
          ? 'CSV / Manual Upload'
          : state.selectedIntegration?.display_name || 'Not configured',
        status:
          state.integrationMethod === 'csv' ||
          (state.integrationMethod === 'crm' && state.integrationTestStatus === 'success')
            ? 'complete'
            : 'incomplete',
        mandatory: true,
        stepNumber: 7,
      },
      {
        key: 'optional_setup',
        label: 'Wallboard & Reports',
        description: 'Wallboard slides, reports, notifications',
        status: state.wallboardSettings?.slides
          && Object.values(state.wallboardSettings.slides).some((s: any) => s.enabled)
          ? 'complete'
          : 'skipped',
        mandatory: false,
        stepNumber: 8,
      },
    ];
  }, [state]);
}

/** Build a snapshot object for storing in organizations.onboarding_readiness */
export function buildReadinessSnapshot(items: ReadinessItem[]): Record<string, string> {
  const snapshot: Record<string, string> = {};
  items.forEach(item => {
    snapshot[item.key] = item.status;
  });
  return snapshot;
}
