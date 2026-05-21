/**
 * useOnboardingDraft — localStorage draft persistence for the onboarding wizard.
 * Extracted from the old OnboardingWizard.jsx monolith.
 *
 * - Auto-saves every 1s (debounced) when wizard is open and past step 1
 * - Restores draft if less than 7 days old
 * - Now includes kpiGoals (previously missing from draft)
 */

import { useEffect, useCallback, useRef } from 'react';
import type { WizardState, IcpProfileDraft } from './onboardingConstants';

const DRAFT_KEY = 'onboarding_draft';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftData {
  orgData: WizardState['orgData'];
  salesDna: WizardState['salesDna'];
  departments: WizardState['departments'];
  teams: WizardState['teams'];
  teamMembers: WizardState['teamMembers'];
  kpiGoals: WizardState['kpiGoals'];
  selectedTemplate: WizardState['selectedTemplate'];
  icpConfig: WizardState['icpConfig'];
  signalConfig: WizardState['signalConfig'];
  icpProfiles?: IcpProfileDraft[];
  selectedTier: WizardState['selectedTier'];
  integrationMethod: WizardState['integrationMethod'];
  wallboardSettings: WizardState['wallboardSettings'];
  cepSeeded: WizardState['cepSeeded'];
  currentStep: number;
  createdOrgId: string | null;
  savedAt: number;
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

/**
 * Hook that auto-saves wizard state to localStorage with 1s debounce.
 */
export function useOnboardingDraft(
  isOpen: boolean,
  currentStep: number,
  state: WizardState,
  createdOrgId: string | null,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    try {
      const draft: DraftData = {
        orgData: state.orgData,
        salesDna: state.salesDna,
        departments: state.departments,
        teams: state.teams,
        teamMembers: state.teamMembers,
        kpiGoals: state.kpiGoals,
        selectedTemplate: state.selectedTemplate,
        icpConfig: state.icpConfig,
        signalConfig: state.signalConfig,
        icpProfiles: state.icpProfiles,
        selectedTier: state.selectedTier,
        integrationMethod: state.integrationMethod,
        wallboardSettings: state.wallboardSettings,
        cepSeeded: state.cepSeeded,
        currentStep,
        createdOrgId,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [state, currentStep, createdOrgId]);

  useEffect(() => {
    if (!isOpen || currentStep <= 1) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, 1000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen, currentStep, save]);
}
