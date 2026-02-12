import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, ArrowRight, Building2, Users, Plug, Trophy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

const ONBOARDING_STEPS = [
  { id: 1, title: 'Organization Info', icon: Building2 },
  { id: 2, title: 'Add Team Members', icon: Users },
  { id: 3, title: 'Connect Data Source', icon: Plug },
  { id: 4, title: 'Complete Setup', icon: Trophy },
];

export default function OnboardingWizard({ isOpen, onClose, organizationId }) {
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Step 3: Integration
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [availableIntegrations, setAvailableIntegrations] = useState([]);

  useEffect(() => {
    if (isOpen && currentStep === 3) {
      loadAvailableIntegrations();
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (organizationId) {
      loadOrganizationData();
    }
  }, [organizationId]);

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
        setCurrentStep(data.onboarding_step || 1);
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
      if (currentStep === 1) {
        await saveOrganizationInfo();
      } else if (currentStep === 2) {
        await saveTeamsAndMembers();
      } else if (currentStep === 3) {
        await saveIntegrationSelection();
      }

      if (currentStep < 4) {
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
    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
  };

  const saveTeamsAndMembers = async () => {
    setLoading(true);
    try {
      // Create teams
      const teamInserts = teams.map(team => ({
        organization_id: organizationId,
        name: team.name,
        description: team.description,
      }));

      const { data: createdTeams, error: teamsError } = await supabase
        .from('teams')
        .insert(teamInserts)
        .select();

      if (teamsError) throw teamsError;

      // In production, you'd send invitations to team members
      // For now, just log what would be sent
      console.log('Team members to invite:', teamMembers);
      console.log('Teams created:', createdTeams);
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
      const { error } = await supabase
        .from('organizations')
        .update({
          onboarding_status: 'completed',
          onboarding_step: 4,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', organizationId);

      if (error) throw error;
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

  if (!isOpen) return null;

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
                  <button
                    onClick={addTeam}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Team
                  </button>
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
                  <button
                    onClick={addTeamMember}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Member
                  </button>
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

          {/* Step 3: Connect Data Source */}
          {currentStep === 3 && (
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

          {/* Step 4: Complete */}
          {currentStep === 4 && (
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

          <button
            onClick={handleNextStep}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              'Processing...'
            ) : currentStep === 4 ? (
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
  );
}
