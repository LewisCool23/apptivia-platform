import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, ArrowRight, Building2, Users, Plug, Trophy, Target, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { backendFetch } from '../utils/backendFetch';

const ONBOARDING_STEPS = [
  { id: 1, title: 'Organization Info', icon: Building2 },
  { id: 2, title: 'Teams & Invites', icon: Users },
  { id: 3, title: 'KPI Goals', icon: BarChart3 },
  { id: 4, title: 'ICP Profile', icon: Target },
  { id: 5, title: 'Connect Integration', icon: Plug },
  { id: 6, title: 'Complete Setup', icon: Trophy },
];

const TOTAL_STEPS = ONBOARDING_STEPS.length;

const DEFAULT_KPIS = [
  { key: 'call_connects', name: 'Call Connects', goal: 100, weight: 30, unit: 'count' },
  { key: 'talk_time_minutes', name: 'Talk Time Minutes', goal: 100, weight: 30, unit: 'minutes' },
  { key: 'meetings', name: 'Meetings', goal: 3, weight: 10, unit: 'count' },
  { key: 'sourced_opps', name: 'Sourced Opportunities', goal: 4, weight: 10, unit: 'count' },
  { key: 'stage2_opps', name: 'Stage 2 Opportunities', goal: 3, weight: 20, unit: 'count' },
];

export default function OnboardingWizard({ isOpen, onClose, organizationId: initialOrgId }) {
  const { profile, refreshProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdOrgId, setCreatedOrgId] = useState(null);

  const organizationId = initialOrgId || createdOrgId;
  const isNewOrg = !initialOrgId;

  // Step 1: Organization Info
  const [orgData, setOrgData] = useState({
    name: '',
    industry: '',
    subscription_plan: 'Pro',
    primary_contact_name: '',
    primary_contact_email: '',
  });

  // Step 2: Team Members
  const [teamMembers, setTeamMembers] = useState([
    { email: '', first_name: '', last_name: '', role: 'power_user', team: '' }
  ]);
  const [teams, setTeams] = useState([{ name: 'Sales Team', description: '' }]);

  // Step 3: KPI Goals
  const [kpiGoals, setKpiGoals] = useState(
    DEFAULT_KPIS.map(k => ({ ...k, enabled: true }))
  );

  // Step 4: ICP Profile
  const [icpConfig, setIcpConfig] = useState({
    enabled: false,
    target_industries: '',
    headcount_min: '',
    headcount_max: '',
    revenue_min_m: '',
    revenue_max_m: '',
    target_technologies: '',
  });

  // Step 5: Integration
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [availableIntegrations, setAvailableIntegrations] = useState([]);

  useEffect(() => {
    if (isOpen && currentStep === 5) {
      loadAvailableIntegrations();
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (organizationId) {
      loadOrganizationData();
    }
  }, [organizationId]);

  // Load KPIs from DB if they exist
  useEffect(() => {
    if (isOpen && currentStep === 3) {
      loadKpiMetrics();
    }
  }, [isOpen, currentStep]);

  const loadKpiMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('key, name, goal, weight, unit, is_active')
        .order('key');
      if (!error && data?.length > 0) {
        setKpiGoals(data.map(k => ({
          key: k.key,
          name: k.name,
          goal: k.goal,
          weight: Math.round((k.weight || 0) * 100),
          unit: k.unit,
          enabled: k.is_active !== false,
        })));
      }
    } catch (e) {
      console.warn('Could not load KPI metrics:', e);
    }
  };

  const loadOrganizationData = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      if (data) {
        setOrgData({
          name: data.name || '',
          industry: data.industry || '',
          subscription_plan: data.subscription_plan || 'Pro',
          primary_contact_name: data.primary_contact_name || '',
          primary_contact_email: data.primary_contact_email || '',
        });
        // Map old 4-step progress to new 6-step
        const saved = data.onboarding_step || 1;
        if (saved <= 2) setCurrentStep(saved);
        else if (saved === 3) setCurrentStep(5);
        else if (saved >= 4) setCurrentStep(6);

        // Load ICP config if exists
        if (data.icp_config) {
          const c = typeof data.icp_config === 'string' ? JSON.parse(data.icp_config) : data.icp_config;
          setIcpConfig({
            enabled: c.enabled ?? false,
            target_industries: (c.target_industries || []).join(', '),
            headcount_min: c.headcount_min ?? '',
            headcount_max: c.headcount_max ?? '',
            revenue_min_m: c.revenue_min_m ?? '',
            revenue_max_m: c.revenue_max_m ?? '',
            target_technologies: (c.target_technologies || []).join(', '),
          });
        }
      }
    } catch (err) {
      console.error('Error loading organization:', err);
    }
  };

  const loadAvailableIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_mapping_templates')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setAvailableIntegrations(data || []);
    } catch (err) {
      console.error('Error loading integrations:', err);
    }
  };

  const handleNextStep = async () => {
    setError('');

    try {
      if (currentStep === 1) await saveOrganizationInfo();
      else if (currentStep === 2) await saveTeamsAndMembers();
      else if (currentStep === 3) await saveKpiGoals();
      else if (currentStep === 4) await saveIcpConfig();
      else if (currentStep === 5) await saveIntegrationSelection();

      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
        await updateOnboardingProgress(currentStep + 1);
      } else {
        await completeOnboarding();
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    }
  };

  const saveOrganizationInfo = async () => {
    if (!orgData.name?.trim()) throw new Error('Company name is required');
    if (!orgData.primary_contact_name?.trim()) throw new Error('Contact name is required');
    if (!orgData.primary_contact_email?.trim()) throw new Error('Contact email is required');

    setLoading(true);
    try {
      if (isNewOrg && !createdOrgId) {
        const { data: newOrg, error: insertError } = await supabase
          .from('organizations')
          .insert({
            name: orgData.name,
            industry: orgData.industry || null,
            subscription_plan: orgData.subscription_plan,
            primary_contact_name: orgData.primary_contact_name,
            primary_contact_email: orgData.primary_contact_email,
            onboarding_status: 'in_progress',
            onboarding_step: 1,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setCreatedOrgId(newOrg.id);

        if (profile?.id) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ organization_id: newOrg.id })
            .eq('id', profile.id);
          if (profileError) throw profileError;
          await refreshProfile();
        }
      } else {
        const { error } = await supabase
          .from('organizations')
          .update({
            name: orgData.name,
            industry: orgData.industry,
            subscription_plan: orgData.subscription_plan,
            primary_contact_name: orgData.primary_contact_name,
            primary_contact_email: orgData.primary_contact_email,
          })
          .eq('id', organizationId);
        if (error) throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  const saveTeamsAndMembers = async () => {
    setLoading(true);
    try {
      const teamInserts = teams.filter(t => t.name.trim()).map(team => ({
        organization_id: organizationId,
        name: team.name,
        description: team.description,
      }));

      if (teamInserts.length === 0) return;

      const { data: createdTeams, error: teamsError } = await supabase
        .from('teams')
        .insert(teamInserts)
        .select();

      if (teamsError) throw teamsError;

      if (teamMembers.length > 0 && createdTeams?.length > 0) {
        const firstTeamId = createdTeams[0].id;
        const emails = teamMembers.map(m => m.email).filter(Boolean);
        if (emails.length > 0) {
          try {
            await backendFetch('/api/users/invite', {
              emails, role: 'power_user', team_id: firstTeamId,
            });
          } catch (inviteErr) {
            console.warn('Could not send invitations:', inviteErr.message);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const saveKpiGoals = async () => {
    setLoading(true);
    try {
      // Validate weights sum to 100
      const enabledKpis = kpiGoals.filter(k => k.enabled);
      const totalWeight = enabledKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
      if (enabledKpis.length > 0 && totalWeight !== 100) {
        throw new Error(`KPI weights must sum to 100 (currently ${totalWeight})`);
      }

      // Update each KPI metric in the DB
      for (const kpi of kpiGoals) {
        await supabase
          .from('kpi_metrics')
          .update({
            goal: Number(kpi.goal) || 0,
            weight: (Number(kpi.weight) || 0) / 100,
            is_active: kpi.enabled,
          })
          .eq('key', kpi.key);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveIcpConfig = async () => {
    if (!icpConfig.enabled) return; // Skip if not enabled
    setLoading(true);
    try {
      const builtIcpConfig = {
        enabled: icpConfig.enabled,
        target_industries: icpConfig.target_industries.split(',').map(s => s.trim()).filter(Boolean),
        headcount_min: icpConfig.headcount_min !== '' ? parseInt(icpConfig.headcount_min) : null,
        headcount_max: icpConfig.headcount_max !== '' ? parseInt(icpConfig.headcount_max) : null,
        revenue_min_m: icpConfig.revenue_min_m !== '' ? parseFloat(icpConfig.revenue_min_m) : null,
        revenue_max_m: icpConfig.revenue_max_m !== '' ? parseFloat(icpConfig.revenue_max_m) : null,
        target_technologies: icpConfig.target_technologies.split(',').map(s => s.trim()).filter(Boolean),
        weights: { industry: 30, headcount: 25, revenue: 25, technology: 20 },
      };

      const { error } = await supabase
        .from('organizations')
        .update({ icp_config: builtIcpConfig })
        .eq('id', organizationId);
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const saveIntegrationSelection = async () => {
    if (!selectedIntegration) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('integrations')
        .insert({
          organization_id: organizationId,
          integration_type: selectedIntegration.integration_type,
          display_name: selectedIntegration.display_name,
          is_enabled: false,
          status: 'disconnected',
          field_mappings: selectedIntegration.default_field_mappings,
          created_by: profile?.id,
        });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateOnboardingProgress = async (step) => {
    await supabase
      .from('organizations')
      .update({ onboarding_step: step })
      .eq('id', organizationId);
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      if (organizationId) {
        const { error } = await supabase
          .from('organizations')
          .update({
            onboarding_status: 'completed',
            onboarding_step: TOTAL_STEPS,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('id', organizationId);
        if (error) throw error;
      }
      await refreshProfile();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, { email: '', first_name: '', last_name: '', role: 'power_user', team: '' }]);
  };

  const removeTeamMember = (index) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const addTeam = () => {
    setTeams([...teams, { name: '', description: '' }]);
  };

  const updateKpi = (index, field, value) => {
    setKpiGoals(prev => prev.map((k, i) => i === index ? { ...k, [field]: value } : k));
  };

  if (!isOpen) return null;

  const enabledKpis = kpiGoals.filter(k => k.enabled);
  const totalWeight = enabledKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to Apptivia Platform</h2>
          <p className="text-blue-100">Let's get your organization set up in just a few steps</p>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {ONBOARDING_STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentStep > step.id
                        ? 'bg-green-600 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle size={20} />
                    ) : (
                      <step.icon size={20} />
                    )}
                  </div>
                  <div className="hidden md:block">
                    <div className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Organization Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Tell us about your organization</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={orgData.industry}
                  onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                  <input
                    type="text"
                    value={orgData.primary_contact_name}
                    onChange={(e) => setOrgData({ ...orgData, primary_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    value={orgData.primary_contact_email}
                    onChange={(e) => setOrgData({ ...orgData, primary_contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="john@acmecorp.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Team Members */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Create teams and invite members</h3>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Teams</label>
                  <button onClick={addTeam} className="text-sm text-blue-600 hover:text-blue-700">+ Add Team</button>
                </div>
                {teams.map((team, index) => (
                  <div key={index} className="mb-2 p-3 border border-gray-200 rounded-lg">
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => {
                        const newTeams = [...teams];
                        newTeams[index].name = e.target.value;
                        setTeams(newTeams);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Team name"
                    />
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Team Members</label>
                  <button onClick={addTeamMember} className="text-sm text-blue-600 hover:text-blue-700">+ Add Member</button>
                </div>
                {teamMembers.map((member, index) => (
                  <div key={index} className="mb-3 p-3 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={member.first_name}
                        onChange={(e) => {
                          const newMembers = [...teamMembers];
                          newMembers[index].first_name = e.target.value;
                          setTeamMembers(newMembers);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="First name"
                      />
                      <input
                        type="text"
                        value={member.last_name}
                        onChange={(e) => {
                          const newMembers = [...teamMembers];
                          newMembers[index].last_name = e.target.value;
                          setTeamMembers(newMembers);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Last name"
                      />
                      <input
                        type="email"
                        value={member.email}
                        onChange={(e) => {
                          const newMembers = [...teamMembers];
                          newMembers[index].email = e.target.value;
                          setTeamMembers(newMembers);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="email@company.com"
                      />
                    </div>
                    {teamMembers.length > 1 && (
                      <button
                        onClick={() => removeTeamMember(index)}
                        className="mt-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: KPI Goals */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-2">Set your KPI goals</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure which KPIs to track and set weekly targets for your team. Weights must sum to 100%.
              </p>

              <div className="space-y-3">
                {kpiGoals.map((kpi, index) => (
                  <div key={kpi.key} className={`border rounded-lg p-4 transition-colors ${kpi.enabled ? 'border-blue-200 bg-white' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={kpi.enabled}
                          onChange={(e) => updateKpi(index, 'enabled', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className={`text-sm font-medium ${kpi.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                          {kpi.name}
                        </span>
                      </label>

                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Goal:</label>
                          <input
                            type="number"
                            value={kpi.goal}
                            onChange={(e) => updateKpi(index, 'goal', e.target.value)}
                            disabled={!kpi.enabled}
                            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          <span className="text-xs text-gray-400">{kpi.unit === 'minutes' ? 'min' : ''}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Weight:</label>
                          <input
                            type="number"
                            value={kpi.weight}
                            onChange={(e) => updateKpi(index, 'weight', e.target.value)}
                            disabled={!kpi.enabled}
                            min={0}
                            max={100}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${totalWeight === 100 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                Total weight: {totalWeight}% {totalWeight === 100 ? '— Perfect!' : `— Must equal 100%`}
              </div>
            </div>
          )}

          {/* Step 4: ICP Profile */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-2">Define your Ideal Customer Profile</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure your ICP to power signal prospecting and account scoring. You can skip this and configure later.
              </p>

              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={icpConfig.enabled}
                  onChange={(e) => setIcpConfig({ ...icpConfig, enabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-900">Enable ICP Scoring</span>
              </label>

              {icpConfig.enabled && (
                <div className="space-y-4 pl-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Industries</label>
                    <input
                      type="text"
                      value={icpConfig.target_industries}
                      onChange={(e) => setIcpConfig({ ...icpConfig, target_industries: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Technology, Finance, Healthcare (comma-separated)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Headcount</label>
                      <input
                        type="number"
                        value={icpConfig.headcount_min}
                        onChange={(e) => setIcpConfig({ ...icpConfig, headcount_min: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Headcount</label>
                      <input
                        type="number"
                        value={icpConfig.headcount_max}
                        onChange={(e) => setIcpConfig({ ...icpConfig, headcount_max: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue ($M)</label>
                      <input
                        type="number"
                        value={icpConfig.revenue_min_m}
                        onChange={(e) => setIcpConfig({ ...icpConfig, revenue_min_m: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Revenue ($M)</label>
                      <input
                        type="number"
                        value={icpConfig.revenue_max_m}
                        onChange={(e) => setIcpConfig({ ...icpConfig, revenue_max_m: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Technologies</label>
                    <input
                      type="text"
                      value={icpConfig.target_technologies}
                      onChange={(e) => setIcpConfig({ ...icpConfig, target_technologies: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Salesforce, AWS, Snowflake (comma-separated)"
                    />
                  </div>
                </div>
              )}

              {!icpConfig.enabled && (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                  You can configure your ICP later from Organization Settings.
                </div>
              )}
            </div>
          )}

          {/* Step 5: Connect Data Source */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Connect your data source</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose how you'll sync your sales data to Apptivia. You can skip this and configure later.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    onClick={() => setSelectedIntegration(integration)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedIntegration?.id === integration.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{integration.icon}</span>
                      <div>
                        <div className="font-semibold">{integration.display_name}</div>
                        <div className="text-xs text-gray-500">{integration.integration_type}</div>
                      </div>
                      {selectedIntegration?.id === integration.id && (
                        <CheckCircle size={20} className="text-blue-600 ml-auto" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{integration.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <strong>Note:</strong> You can skip this step and configure integrations later from the Integrations page.
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {currentStep === 6 && (
            <div className="text-center py-8">
              <Trophy size={64} className="mx-auto text-yellow-500 mb-4" />
              <h3 className="text-2xl font-bold mb-2">You're all set!</h3>
              <p className="text-gray-600 mb-6">
                Your organization is now configured and ready to use Apptivia Platform.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
                <h4 className="font-semibold mb-2">Next steps:</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Configure your integration to start syncing data</li>
                  <li>• Invite your team members to join</li>
                  <li>• Set up contests and achievements</li>
                  <li>• Explore the dashboard and analytics</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1 || loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            {(currentStep === 3 || currentStep === 4 || currentStep === 5) && (
              <button
                onClick={() => {
                  setCurrentStep(currentStep + 1);
                  updateOnboardingProgress(currentStep + 1);
                }}
                disabled={loading}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip
              </button>
            )}

            <button
              onClick={handleNextStep}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : currentStep === TOTAL_STEPS ? (
                'Complete Setup'
              ) : (
                <>
                  Next <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
