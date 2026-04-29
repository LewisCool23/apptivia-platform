/**
 * OnboardingWizard — 9-step orchestrator for new organization setup.
 * Decomposed from the original 1165-line monolith.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Circle, ArrowRight, ArrowLeft, Loader2, RotateCcw, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../AuthContext';
import { backendFetch } from '../../utils/backendFetch';
import { DEFAULT_SALES_DNA } from '../../constants/salesDna';
import { STANDARD_B2B_TEMPLATE } from '../../constants/cepDefaults';
import { useCepConfig } from '../../hooks/useCepConfig';

import {
  ONBOARDING_STEPS, TOTAL_STEPS, MANDATORY_STEPS,
  DEFAULT_KPIS, DEFAULT_ICP_CONFIG, DEFAULT_SIGNAL_CONFIG, DEFAULT_WALLBOARD_SETTINGS,
} from './onboardingConstants';
import { loadDraft, clearDraft, useOnboardingDraft } from './useOnboardingDraft';
import { useOnboardingReadiness, buildReadinessSnapshot } from './useOnboardingReadiness';

import StepOrgInfo from './StepOrgInfo';
import StepSalesDna from './StepSalesDna';
import StepTeamStructure from './StepTeamStructure';
import StepKpiConfig from './StepKpiConfig';
import StepYourMarket from './StepYourMarket';
import StepChoosePlan from './StepChoosePlan';
import StepIntegration from './StepIntegration';
import StepOptionalSetup from './StepOptionalSetup';
import StepReviewLaunch from './StepReviewLaunch';

const STEP_COMPONENTS = [
  null, // index 0 unused
  StepOrgInfo,       // 1
  StepSalesDna,      // 2
  StepTeamStructure, // 3
  StepKpiConfig,     // 4
  StepYourMarket,    // 5
  StepChoosePlan,    // 6
  StepIntegration,   // 7
  StepOptionalSetup, // 8
  StepReviewLaunch,  // 9
];

export default function OnboardingWizard({ isOpen, onClose, onComplete, organizationId: initialOrgId }) {
  const { profile, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [createdOrgId, setCreatedOrgId] = useState(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [launchPending, setLaunchPending] = useState(false);

  const organizationId = initialOrgId || createdOrgId;
  const isNewOrg = !initialOrgId;

  // ── Wizard State ───────────────────────────────────────────────────

  const [wizardState, setWizardState] = useState({
    orgData: { name: '', industry: '', primary_contact_name: '', primary_contact_email: '' },
    adminTitle: '',
    salesDna: { ...DEFAULT_SALES_DNA },
    departments: [{ name: 'Sales', sort_order: 0 }],
    teams: [{ name: 'Sales Team', description: '', departmentName: 'Sales', managerId: null }],
    teamMembers: [{ email: '', first_name: '', last_name: '', role: 'power_user', title: '', teamName: 'Sales Team', segment: null }],
    kpiGoals: DEFAULT_KPIS.map(k => ({ ...k, enabled: true })),
    selectedTemplate: null,
    icpConfig: { ...DEFAULT_ICP_CONFIG },
    signalConfig: { ...DEFAULT_SIGNAL_CONFIG },
    selectedTier: '',
    selectedIntegration: null,
    integrationApiKey: '',
    integrationTestStatus: null,
    integrationMethod: null,
    wallboardSettings: { ...DEFAULT_WALLBOARD_SETTINGS },
    cepStages: null, // null = use STANDARD_B2B_TEMPLATE defaults; array = user-customized
    cepSeeded: false,
  });

  const updateState = useCallback((patch) => {
    // Clear stale validation errors when user makes changes
    setError('');
    setWarning('');
    setWizardState(prev => ({ ...prev, ...patch }));
  }, []);

  // CEP config hook for seeding
  const { seedDefaultStages, stages: cepStages } = useCepConfig(organizationId);

  // Draft persistence
  useOnboardingDraft(isOpen, currentStep, wizardState, createdOrgId);

  // Readiness checklist
  const readinessItems = useOnboardingReadiness(wizardState);

  // ── Restore Draft ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const draft = loadDraft();
    if (draft && draft.savedAt) {
      const restored = {};
      if (draft.orgData) restored.orgData = { ...wizardState.orgData, ...draft.orgData };
      if (draft.adminTitle) restored.adminTitle = draft.adminTitle;
      if (draft.salesDna) restored.salesDna = draft.salesDna;
      if (draft.departments) restored.departments = draft.departments;
      if (draft.teams) restored.teams = draft.teams;
      if (draft.teamMembers) restored.teamMembers = draft.teamMembers;
      if (draft.kpiGoals) restored.kpiGoals = draft.kpiGoals;
      if (draft.selectedTemplate) restored.selectedTemplate = draft.selectedTemplate;
      if (draft.icpConfig) restored.icpConfig = draft.icpConfig;
      if (draft.signalConfig) restored.signalConfig = draft.signalConfig;
      if (draft.selectedTier) restored.selectedTier = draft.selectedTier;
      if (draft.integrationMethod) restored.integrationMethod = draft.integrationMethod;
      if (draft.wallboardSettings) restored.wallboardSettings = draft.wallboardSettings;
      if (draft.cepSeeded) restored.cepSeeded = draft.cepSeeded;
      setWizardState(prev => ({ ...prev, ...restored }));
      if (draft.createdOrgId) setCreatedOrgId(draft.createdOrgId);
      if (draft.currentStep > 1) {
        setCurrentStep(draft.currentStep);
        setShowResumeBanner(true);
      }
    }
  }, [isOpen]);

  // Load existing org data if editing
  useEffect(() => {
    if (!organizationId || !isOpen) return;
    (async () => {
      const { data } = await supabase.from('organizations').select('*').eq('id', organizationId).single();
      if (data) {
        updateState({
          orgData: {
            name: data.name || '',
            industry: data.industry || '',
            primary_contact_name: data.primary_contact_name || '',
            primary_contact_email: data.primary_contact_email || '',
          },
          ...(data.sales_dna ? { salesDna: data.sales_dna } : {}),
          ...(data.icp_config ? {
            icpConfig: {
              enabled: true,
              target_industries: data.icp_config.target_industries || [],
              headcount_min: data.icp_config.headcount_min?.toString() || '',
              headcount_max: data.icp_config.headcount_max?.toString() || '',
              revenue_min_m: data.icp_config.revenue_min_m?.toString() || '',
              revenue_max_m: data.icp_config.revenue_max_m?.toString() || '',
              target_technologies: data.icp_config.target_technologies || [],
            },
          } : {}),
          ...(data.signal_config ? { signalConfig: data.signal_config } : {}),
          selectedTier: data.subscription_plan || '',
        });
      }
      // Check if CEP stages exist
      const { count } = await supabase.from('cep_stages').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId);
      if (count > 0) updateState({ cepSeeded: true });
    })();
  }, [organizationId, isOpen]);

  // ── Step Save Logic ────────────────────────────────────────────────

  const saveStep = async (step) => {
    switch (step) {
      case 1: return await saveOrgInfo();
      case 2: return await saveSalesDna();
      case 3: return await saveTeamStructure();
      case 4: return await saveKpiConfig();
      case 5: return await saveMarket();
      case 6: return await savePlan();
      case 7: return await saveIntegration();
      case 8: return await saveOptionalSetup();
      case 9: return await completeLaunch();
      default: return;
    }
  };

  // Step 1: Organization Info
  const saveOrgInfo = async () => {
    const { orgData, adminTitle } = wizardState;
    if (isNewOrg && !createdOrgId) {
      // F3: Create org via server endpoint (trial abuse prevention + created_by_user_id tracking)
      const result = await backendFetch('/api/onboarding/create-org', {
        name: orgData.name.trim(),
        industry: orgData.industry,
        primary_contact_name: orgData.primary_contact_name.trim(),
        primary_contact_email: orgData.primary_contact_email.trim(),
      });
      setCreatedOrgId(result.id);
      if (result.already_exists) {
        // User already linked to an org — update its info
        const { error: err } = await supabase.from('organizations').update({
          name: orgData.name.trim(),
          industry: orgData.industry,
          primary_contact_name: orgData.primary_contact_name.trim(),
          primary_contact_email: orgData.primary_contact_email.trim(),
        }).eq('id', result.id);
        if (err) throw new Error(err.message);
        if (adminTitle) {
          await backendFetch('/api/onboarding/link-org', {
            organization_id: result.id,
            title: adminTitle,
          });
        }
        return;
      }
      // Link current user to org via backend admin client (bypasses RLS)
      await backendFetch('/api/onboarding/link-org', {
        organization_id: result.id,
        title: adminTitle || undefined,
      });
      await refreshProfile();
      // Verify the link actually worked
      const { data: check } = await supabase.from('profiles').select('organization_id').eq('id', profile.id).single();
      if (!check?.organization_id) {
        throw new Error('Failed to link your account to the organization. Please try again.');
      }
    } else {
      const { error: err } = await supabase.from('organizations').update({
        name: orgData.name.trim(),
        industry: orgData.industry,
        primary_contact_name: orgData.primary_contact_name.trim(),
        primary_contact_email: orgData.primary_contact_email.trim(),
      }).eq('id', organizationId);
      if (err) throw new Error(err.message);
      // Update admin title via backend (bypasses RLS)
      if (adminTitle) {
        await backendFetch('/api/onboarding/link-org', {
          organization_id: organizationId,
          title: adminTitle,
        });
      }
    }
  };

  // Step 2: Sales DNA + CEP stage seeding (direct insert, bypasses hook RLS timing)
  const saveSalesDna = async () => {
    const { salesDna } = wizardState;
    const { error: err } = await supabase.from('organizations').update({
      sales_dna: salesDna,
    }).eq('id', organizationId);
    if (err) throw new Error(err.message);

    // Seed CEP pipeline if not already done
    if (!wizardState.cepSeeded && cepStages.length === 0) {
      try {
        const template = wizardState.cepStages || STANDARD_B2B_TEMPLATE;
        const stageRows = template.map((t, i) => ({
          organization_id: organizationId,
          cep_type: 'new_business',
          stage_key: t.stage_key,
          stage_name: t.stage_name,
          stage_order: i + 1,
          color: t.color,
          win_probability: t.win_probability,
          expected_days: t.expected_days || 7,
          is_terminal: t.is_terminal || false,
          checklist_items: t.checklist_items || [],
          exit_criteria: t.exit_criteria || [],
          role_responsibilities: t.role_responsibilities || [],
        }));

        const { error: stageErr } = await supabase.from('cep_stages').insert(stageRows);
        if (stageErr) throw stageErr;
        updateState({ cepSeeded: true });
      } catch (seedErr) {
        console.error('CEP seed error:', seedErr);
        // Non-blocking — stages can be configured later in Org Settings
        console.warn('CEP stages will need to be configured in Organization Settings.');
        updateState({ cepSeeded: false });
      }
    }
  };

  // Step 3: Team Structure
  const saveTeamStructure = async () => {
    const { departments, teams, teamMembers } = wizardState;

    // Insert departments
    const deptMap = {};
    for (const dept of departments.filter(d => d.name.trim())) {
      const { data, error: err } = await supabase.from('departments').upsert({
        organization_id: organizationId,
        name: dept.name.trim(),
        sort_order: dept.sort_order,
      }, { onConflict: 'organization_id,name' }).select().single();
      if (!err && data) deptMap[dept.name] = data.id;
    }

    // Insert teams (defer invite-based manager_id until after invites)
    const teamMap = {};
    const pendingManagerTeams = []; // { teamName, memberIndex }
    for (const team of teams.filter(t => t.name.trim())) {
      const deptId = deptMap[team.departmentName] || null;
      const isInviteManager = typeof team.managerId === 'string' && team.managerId.startsWith('invite_');
      const directManagerId = (!isInviteManager && team.managerId) ? team.managerId : null;
      if (isInviteManager) {
        pendingManagerTeams.push({ teamName: team.name, memberIndex: parseInt(team.managerId.replace('invite_', ''), 10) });
      }
      const { data, error: err } = await supabase.from('teams').insert({
        organization_id: organizationId,
        name: team.name.trim(),
        description: team.description || '',
        department_id: deptId,
        department: team.departmentName || null,
        manager_id: directManagerId,
      }).select().single();
      if (!err && data) teamMap[team.name] = data.id;
    }

    // Send invites per member
    const inviteFailures = [];
    for (const member of teamMembers.filter(m => m.email.trim())) {
      const teamId = teamMap[member.teamName] || Object.values(teamMap)[0] || null;
      try {
        await backendFetch('/api/users/invite', {
          emails: [member.email.trim()],
          role: member.role || 'power_user',
          team_id: teamId,
          ...(member.title ? { title: member.title } : {}),
          ...(member.title_key ? { title_key: member.title_key } : {}),
          ...(member.first_name ? { first_name: member.first_name.trim() } : {}),
          ...(member.last_name ? { last_name: member.last_name.trim() } : {}),
          ...(member.segment ? { segment: member.segment } : {}),
        });
      } catch (inviteErr) {
        console.warn(`Invite failed for ${member.email}:`, inviteErr.message);
        inviteFailures.push(member.email.trim());
      }
    }

    // Backfill manager_id for teams whose manager was an invited member
    for (const pending of pendingManagerTeams) {
      const member = teamMembers[pending.memberIndex];
      if (!member?.email) continue;
      const teamId = teamMap[pending.teamName];
      if (!teamId) continue;
      const { data: mgrProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', member.email.trim())
        .maybeSingle();
      if (mgrProfile?.id) {
        await supabase.from('teams').update({ manager_id: mgrProfile.id }).eq('id', teamId);
      }
    }

    if (inviteFailures.length > 0) {
      setWarning(`Some invites couldn't be sent: ${inviteFailures.join(', ')}. Teams were created. You can resend invites from Organization Settings.`);
    }
  };

  // Step 4: KPI Configuration — uses backend admin client to bypass RLS
  // (kpi_org_configs write policy requires admin role which may not be in JWT yet)
  const saveKpiConfig = async () => {
    if (!organizationId) {
      throw new Error('Organization not found. Please go back to Step 1 and try again.');
    }
    await backendFetch('/api/onboarding/save-kpis', {
      organization_id: organizationId,
      kpiGoals: wizardState.kpiGoals,
    });
  };

  // Step 5: Your Market
  const saveMarket = async () => {
    const { icpConfig, signalConfig } = wizardState;
    // Safely coerce to arrays (handles old string-format drafts)
    const industries = Array.isArray(icpConfig.target_industries)
      ? icpConfig.target_industries
      : (icpConfig.target_industries || '').split(',').map(s => s.trim()).filter(Boolean);
    const technologies = Array.isArray(icpConfig.target_technologies)
      ? icpConfig.target_technologies
      : (icpConfig.target_technologies || '').split(',').map(s => s.trim()).filter(Boolean);

    const icpData = {
      enabled: true,
      target_industries: industries,
      headcount_min: icpConfig.headcount_min ? Number(icpConfig.headcount_min) : null,
      headcount_max: icpConfig.headcount_max ? Number(icpConfig.headcount_max) : null,
      revenue_min_m: icpConfig.revenue_min_m ? Number(icpConfig.revenue_min_m) : null,
      revenue_max_m: icpConfig.revenue_max_m ? Number(icpConfig.revenue_max_m) : null,
      target_technologies: technologies,
      weights: { industry: 30, headcount: 25, revenue: 25, technology: 20 },
    };

    const { error: err } = await supabase.from('organizations').update({
      icp_config: icpData,
      signal_config: signalConfig,
    }).eq('id', organizationId);
    if (err) throw new Error(err.message);
  };

  // Step 6: Subscription Plan — save preference for post-trial; don't overwrite active trial
  const savePlan = async () => {
    const { data: org } = await supabase.from('organizations')
      .select('subscription_status').eq('id', organizationId).single();
    const isTrial = org?.subscription_status === 'trialing';
    const update = isTrial
      ? { preferred_plan: wizardState.selectedTier } // Save preference; keep Pro during trial
      : { subscription_plan: wizardState.selectedTier }; // Non-trial: update directly
    const { error: err } = await supabase.from('organizations').update(update).eq('id', organizationId);
    if (err) throw new Error(err.message);
  };

  // Step 7: Integration
  const saveIntegration = async () => {
    const { integrationMethod, selectedIntegration, integrationApiKey } = wizardState;

    if (integrationMethod === 'csv') {
      // Save CSV placeholder
      await supabase.from('integrations').insert({
        organization_id: organizationId,
        integration_type: 'csv_manual',
        display_name: 'CSV / Manual Upload',
        is_enabled: true,
        status: 'active',
      });
      return;
    }

    if (!selectedIntegration) return;

    // Save CRM integration
    const { data: integ, error: err } = await supabase.from('integrations').insert({
      organization_id: organizationId,
      integration_type: selectedIntegration.integration_type,
      display_name: selectedIntegration.display_name,
      is_enabled: true,
      status: 'pending',
      field_mappings: selectedIntegration.default_field_mappings || {},
    }).select().single();
    if (err) throw new Error(err.message);

    // Save credentials if API key provided
    if (integrationApiKey.trim()) {
      try {
        await backendFetch(`/api/integrations/${integ.id}`, {
          credentials: { api_key: integrationApiKey },
          status: 'active',
        }, 'PATCH');
        // Trigger backfill (fire and forget)
        backendFetch(`/api/integrations/${integ.id}/backfill`, { days: 90 }).catch(() => {});
      } catch (credErr) {
        console.warn('Integration credential save warning:', credErr.message);
      }
    }
  };

  // Step 8: Optional Setup
  const saveOptionalSetup = async () => {
    const { wallboardSettings } = wizardState;
    // Merge wallboard into existing org settings
    const { data: org } = await supabase.from('organizations').select('settings').eq('id', organizationId).single();
    const existingSettings = org?.settings || {};
    const { error: err } = await supabase.from('organizations').update({
      settings: { ...existingSettings, wallboard: wallboardSettings },
    }).eq('id', organizationId);
    if (err) throw new Error(err.message);
  };

  // Step 9: Complete & Launch
  const completeLaunch = async () => {
    const snapshot = buildReadinessSnapshot(readinessItems);
    const { error: err } = await supabase.from('organizations').update({
      onboarding_status: 'completed',
      onboarding_step: TOTAL_STEPS,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_readiness: snapshot,
    }).eq('id', organizationId);
    if (err) throw new Error(err.message);

    // Auto-create default weekly scorecard email for the admin
    try {
      const adminEmail = wizardState.orgData.primary_contact_email?.trim();
      if (adminEmail && organizationId) {
        // Compute next Monday
        const now = new Date();
        const daysUntilMon = ((1 - now.getDay() + 7) % 7) || 7;
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + daysUntilMon);
        nextMonday.setHours(9, 0, 0, 0);

        await supabase.from('scheduled_reports').insert({
          organization_id: organizationId,
          created_by: profile.id,
          report_type: 'scorecard',
          frequency: 'weekly',
          day_of_week: 'monday',
          time: '09:00',
          recipients: [adminEmail],
          include_charts: true,
          include_summary: true,
          active: true,
          next_scheduled_at: nextMonday.toISOString(),
        });
      }
    } catch (reportErr) {
      console.warn('Failed to create default weekly report:', reportErr.message);
    }

    await refreshProfile();
    // Signal scorecard and other components to refetch after onboarding
    window.dispatchEvent(new CustomEvent('apptivia:onboarding-complete'));
    // Defer navigation: set flag and let useEffect navigate after profile state settles.
    // This prevents ProtectedRoute from seeing stale profile (without organization_id)
    // and redirecting back to /organization-settings.
    setLaunchPending(true);
  };

  // Navigate to dashboard after React has flushed all pending state updates
  useEffect(() => {
    if (!launchPending) return;
    setLaunchPending(false);
    clearDraft();
    (onComplete || onClose)();
  }, [launchPending]);

  // ── Navigation ─────────────────────────────────────────────────────

  const handleNext = async () => {
    setError('');
    setWarning('');
    const StepComponent = STEP_COMPONENTS[currentStep];

    // Validate (unless optional step being skipped)
    if (StepComponent?.validate) {
      const validationError = StepComponent.validate(wizardState);
      if (validationError && MANDATORY_STEPS.includes(currentStep)) {
        setError(validationError);
        return;
      }
    }

    // Save step data
    setLoading(true);
    try {
      await saveStep(currentStep);
      // Track progress
      if (organizationId && currentStep < TOTAL_STEPS) {
        try {
          await supabase.from('organizations').update({
            onboarding_step: currentStep,
            onboarding_status: 'in_progress',
          }).eq('id', organizationId);
        } catch {}
      }
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setError('');
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (!MANDATORY_STEPS.includes(currentStep) && currentStep < TOTAL_STEPS) {
      setError('');
      setCurrentStep(currentStep + 1);
    }
  };

  const goToStep = (step) => {
    setError('');
    setCurrentStep(step);
  };

  const handleStartOver = () => {
    clearDraft();
    setCurrentStep(1);
    setShowResumeBanner(false);
    setCreatedOrgId(null);
    setWizardState({
      orgData: { name: '', industry: '', primary_contact_name: '', primary_contact_email: '' },
      adminTitle: '',
      salesDna: { ...DEFAULT_SALES_DNA },
      departments: [{ name: 'Sales', sort_order: 0 }],
      teams: [{ name: 'Sales Team', description: '', departmentName: 'Sales', managerId: null }],
      teamMembers: [{ email: '', first_name: '', last_name: '', role: 'power_user', title: '', teamName: 'Sales Team', segment: null }],
      kpiGoals: DEFAULT_KPIS.map(k => ({ ...k, enabled: true })),
      selectedTemplate: null,
      icpConfig: { ...DEFAULT_ICP_CONFIG },
      signalConfig: { ...DEFAULT_SIGNAL_CONFIG },
      selectedTier: '',
      selectedIntegration: null,
      integrationApiKey: '',
      integrationTestStatus: null,
      integrationMethod: null,
      wallboardSettings: { ...DEFAULT_WALLBOARD_SETTINGS },
      cepSeeded: false,
    });
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const StepComponent = STEP_COMPONENTS[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS;
  const isOptionalStep = !MANDATORY_STEPS.includes(currentStep);
  const canLaunch = isLastStep && readinessItems.every(i => !i.mandatory || i.status === 'complete');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-apptivia-ink">Set Up Your Workspace</h2>
            <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
              <X size={20} />
            </button>
          </div>

          {/* Progress Stepper */}
          <div className="flex items-center gap-1">
            {ONBOARDING_STEPS.map((step) => (
              <div key={step.id} className="flex-1 flex items-center gap-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-colors ${
                    step.id < currentStep
                      ? 'bg-apptivia-coral'
                      : step.id === currentStep
                        ? 'bg-apptivia-coral'
                        : 'bg-apptivia-carbon-200'
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-apptivia-carbon-500">
              Step {currentStep} of {TOTAL_STEPS}: {ONBOARDING_STEPS[currentStep - 1]?.title}
            </span>
            <span className="text-xs text-apptivia-carbon-400">
              {Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100)}% complete
            </span>
          </div>
        </div>

        {/* Resume Banner */}
        {showResumeBanner && (
          <div className="px-6 py-2 bg-apptivia-coral-tone-50 border-b border-blue-100 flex items-center justify-between flex-shrink-0">
            <span className="text-sm text-apptivia-coral">Resumed from your previous session</span>
            <button
              onClick={handleStartOver}
              className="flex items-center gap-1 text-xs text-apptivia-coral hover:text-apptivia-coral font-medium"
            >
              <RotateCcw size={12} /> Start Over
            </button>
          </div>
        )}

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {StepComponent && (
            <StepComponent
              wizardState={wizardState}
              updateState={updateState}
              organizationId={organizationId}
              profile={profile}
              selectedTier={wizardState.selectedTier}
              onError={setError}
              loading={loading}
              setLoading={setLoading}
              onGoToStep={goToStep}
            />
          )}
        </div>

        {/* Warning (non-blocking) */}
        {warning && (
          <div className="px-6 py-2 bg-amber-50 border-t border-amber-100 flex-shrink-0">
            <p className="text-sm text-amber-700">{warning}</p>
          </div>
        )}
        {/* Error */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-100 flex-shrink-0">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t bg-apptivia-paper rounded-b-2xl flex items-center justify-between flex-shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="flex items-center gap-1 px-4 py-2 text-apptivia-carbon-600 hover:text-apptivia-ink text-sm font-medium disabled:opacity-50"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isOptionalStep && !isLastStep && (
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="px-4 py-2 text-apptivia-carbon-500 hover:text-apptivia-carbon-700 text-sm font-medium disabled:opacity-50"
              >
                Skip for now
              </button>
            )}
            {isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading || !canLaunch}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Launch Apptivia
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-apptivia-coral text-white rounded-lg text-sm font-semibold hover:bg-apptivia-coral disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Next <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
