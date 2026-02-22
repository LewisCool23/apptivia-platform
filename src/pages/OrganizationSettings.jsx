import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, CreditCard, Bell, Shield, Save, Search, X, UserPlus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import PageActionBar from '../components/PageActionBar';
import OnboardingWizard from '../components/OnboardingWizard';
import { useNotifications } from '../contexts/NotificationContext';

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [noOrgDetected, setNoOrgDetected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [organization, setOrganization] = useState(null);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);

  // Add Existing Users modal state
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [unassignedUsers, setUnassignedUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [assigningUsers, setAssigningUsers] = useState(false);
  const [addUsersSearch, setAddUsersSearch] = useState('');

  const isAdmin = role === 'admin';

  useEffect(() => {
    loadData();
  }, [profile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!profile?.organization_id) {
        setNoOrgDetected(true);
        setShowOnboarding(true);
        setLoading(false);
        return;
      }
      setNoOrgDetected(false);

      // Load organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);

      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*, profiles(count)')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('first_name');

      if (membersError) throw membersError;
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  };

  // ICP config is stored as a parsed object alongside the org row.
  // We parse it once from organization.icp_config and track edits locally.
  const [icpConfig, setIcpConfig] = useState({
    enabled: false,
    target_industries: '',
    headcount_min: '',
    headcount_max: '',
    revenue_min_m: '',
    revenue_max_m: '',
    target_technologies: '',
  });

  // Sync icpConfig when organization row loads
  useEffect(() => {
    if (!organization?.icp_config) return;
    const c = typeof organization.icp_config === 'string'
      ? JSON.parse(organization.icp_config)
      : organization.icp_config;
    setIcpConfig({
      enabled: c.enabled ?? false,
      target_industries: (c.target_industries || []).join(', '),
      headcount_min: c.headcount_min ?? '',
      headcount_max: c.headcount_max ?? '',
      revenue_min_m: c.revenue_min_m ?? '',
      revenue_max_m: c.revenue_max_m ?? '',
      target_technologies: (c.target_technologies || []).join(', '),
    });
  }, [organization?.id]);

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

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

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: organization.name,
          industry: organization.industry,
          primary_contact_name: organization.primary_contact_name,
          primary_contact_email: organization.primary_contact_email,
          icp_config: builtIcpConfig,
        })
        .eq('id', organization.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // ── Add Existing Users helpers ──────────────────────────

  const fetchUnassignedUsers = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .is('organization_id', null)
        .order('email');
      if (error) throw error;
      setUnassignedUsers(data || []);
    } catch (err) {
      console.error('Error fetching unassigned users:', err);
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  const openAddUsersModal = () => {
    setSelectedUserIds([]);
    setAddUsersSearch('');
    setShowAddUsersModal(true);
    fetchUnassignedUsers();
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllFiltered = (filteredUsers) => {
    const allIds = filteredUsers.map(u => u.id);
    const allSelected = allIds.every(id => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedUserIds(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const assignSelectedUsers = async () => {
    if (!selectedUserIds.length || !organization?.id) return;
    setAssigningUsers(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: organization.id })
        .in('id', selectedUserIds);
      if (error) throw error;
      setShowAddUsersModal(false);
      setSelectedUserIds([]);
      setMessage({ type: 'success', text: `${selectedUserIds.length} user(s) added to the organization` });
      await loadData();
    } catch (err) {
      console.error('Error assigning users:', err);
      setMessage({ type: 'error', text: 'Failed to add users: ' + err.message });
    } finally {
      setAssigningUsers(false);
    }
  };

  // Search functionality — must be before early returns to preserve hook order
  const handleSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    setShowSearchResults(true);
    const results = [];
    try {
      const searchTerm = query.trim().toLowerCase();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (profiles) {
        profiles.forEach((profile) => {
          results.push({
            type: 'User',
            title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            subtitle: profile.role,
            link: `/profile?user=${profile.id}`,
            icon: '👤'
          });
        });
      }
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Shield size={48} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Admin Access Required</h2>
          <p className="text-gray-500">You don't have permission to access organization settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-gray-500">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Organization Settings</h1>
            <p className="text-gray-500 text-sm">Manage your organization and team settings</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
              )}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button key={idx} onClick={() => { navigate(result.link); setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{result.type}</span>
                          </div>
                          {result.subtitle && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{result.subtitle}</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            <button onClick={handleRefresh} disabled={isRefreshing} className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 group ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'}`} title="Refresh data">
              <svg className={`w-[18px] h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => {}}
              onConfigureClick={() => {}}
              onExportClick={() => {}}
              onNotificationsClick={openPanel}
              exportDisabled={true}
              configureDisabled={true}
              notificationBadge={unreadCount}
              actions={[]}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            {[
              { id: 'general', label: 'General', icon: Building2 },
              { id: 'teams', label: 'Teams & Members', icon: Users },
              { id: 'subscription', label: 'Subscription', icon: CreditCard },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {message.text && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <form onSubmit={handleSaveGeneral} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Organization Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={organization?.name || ''}
                      onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <select
                      value={organization?.industry || ''}
                      onChange={(e) => setOrganization({ ...organization, industry: e.target.value })}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Name
                    </label>
                    <input
                      type="text"
                      value={organization?.primary_contact_name || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Email
                    </label>
                    <input
                      type="email"
                      value={organization?.primary_contact_email || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* ICP Configuration */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">ICP Configuration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Define your Ideal Customer Profile. Apptivia scores accounts 0–100 based on how well they match these criteria.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-600">Enable ICP Scoring</span>
                    <div
                      onClick={() => setIcpConfig(c => ({ ...c, enabled: !c.enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${icpConfig.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${icpConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                {icpConfig.enabled && (
                  <div className="space-y-4 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Industries <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_industries}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_industries: e.target.value }))}
                        placeholder="e.g. SaaS, Financial Services, Technology"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_min}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_min: e.target.value }))}
                          placeholder="e.g. 50"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_max}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_max: e.target.value }))}
                          placeholder="e.g. 5000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_min_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_min_m: e.target.value }))}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_max_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_max_m: e.target.value }))}
                          placeholder="e.g. 500"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Technologies <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_technologies}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_technologies: e.target.value }))}
                        placeholder="e.g. Salesforce, HubSpot, Outreach, Slack"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <p className="text-xs text-gray-400">Scoring weights: Industry 30% · Headcount 25% · Revenue 25% · Tech Stack 20%</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Onboarding Status</h4>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      {organization?.onboarding_status === 'completed' ? (
                        <span className="text-green-600">✓ Onboarding Completed</span>
                      ) : (
                        <span className="text-amber-600">⚠ Onboarding In Progress</span>
                      )}
                    </div>
                    {organization?.onboarding_completed_at && (
                      <div className="text-xs text-gray-500">
                        Completed: {new Date(organization.onboarding_completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {organization?.onboarding_status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Resume Onboarding
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Teams & Members Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            {/* Teams */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Teams</h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  + Add Team
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4">
                    <div className="font-semibold">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-gray-600 mt-1">{team.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {team.profiles?.[0]?.count || 0} members
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Members */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Team Members ({members.length})</h3>
                <div className="flex gap-2">
                  <button
                    onClick={openAddUsersModal}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-2"
                  >
                    <UserPlus size={14} />
                    Add Existing Users
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    + Invite Members
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2 font-semibold">Name</th>
                      <th className="pb-2 font-semibold">Email</th>
                      <th className="pb-2 font-semibold">Role</th>
                      <th className="pb-2 font-semibold">Team</th>
                      <th className="pb-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b">
                        <td className="py-3">
                          {member.first_name} {member.last_name}
                        </td>
                        <td className="py-3 text-gray-600">{member.email}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">
                          {teams.find(t => t.id === member.team_id)?.name || '-'}
                        </td>
                        <td className="py-3">
                          <button className="text-blue-600 hover:text-blue-700 text-sm">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Subscription Details</h3>
            
            <div className="border rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold">{organization?.subscription_plan || 'Pro'} Plan</div>
                  <div className="text-sm text-gray-600">Active subscription</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">$99/mo</div>
                  <div className="text-sm text-gray-600">Billed monthly</div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Users</span>
                  <span className="font-medium">{members.length} / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Teams</span>
                  <span className="font-medium">{teams.length} / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Integrations</span>
                  <span className="font-medium">All included</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Support</span>
                  <span className="font-medium">Priority</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Upgrade Plan
              </button>
              <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Manage Billing
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
            
            <div className="space-y-4">
              {[
                { label: 'New badges earned', description: 'Get notified when team members earn badges' },
                { label: 'Contest updates', description: 'Notifications about contest winners and leaderboards' },
                { label: 'Achievement milestones', description: 'When team members reach achievement milestones' },
                { label: 'Data sync status', description: 'Integration sync success and error notifications' },
                { label: 'User activity', description: 'New user signups and logins' },
              ].map((setting, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{setting.label}</div>
                    <div className="text-sm text-gray-600">{setting.description}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Existing Users Modal */}
      {showAddUsersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Existing Users</h2>
                <p className="text-sm text-gray-500 mt-1">Select users to add to {organization?.name || 'your organization'}</p>
              </div>
              <button onClick={() => setShowAddUsersModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={addUsersSearch}
                  onChange={(e) => setAddUsersSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loadingUnassigned ? (
                <div className="text-center py-8 text-gray-500 text-sm">Loading users...</div>
              ) : (() => {
                const term = addUsersSearch.trim().toLowerCase();
                const filtered = term
                  ? unassignedUsers.filter(u =>
                      (u.first_name || '').toLowerCase().includes(term) ||
                      (u.last_name || '').toLowerCase().includes(term) ||
                      (u.email || '').toLowerCase().includes(term)
                    )
                  : unassignedUsers;

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <Users size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">
                        {unassignedUsers.length === 0
                          ? 'All users are already assigned to an organization'
                          : 'No users match your search'}
                      </p>
                    </div>
                  );
                }

                const allFilteredSelected = filtered.every(u => selectedUserIds.includes(u.id));

                return (
                  <div className="space-y-1">
                    {/* Select All */}
                    <button
                      onClick={() => selectAllFiltered(filtered)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700 border-b mb-1"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allFilteredSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {allFilteredSelected && <Check size={14} className="text-white" />}
                      </div>
                      Select All ({filtered.length})
                    </button>

                    {filtered.map(u => {
                      const selected = selectedUserIds.includes(u.id);
                      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
                      return (
                        <button
                          key={u.id}
                          onClick={() => toggleUserSelection(u.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                            selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {selected && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name || u.email}</div>
                            {name && <div className="text-xs text-gray-500 truncate">{u.email}</div>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
                            {u.role || 'user'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50">
              <span className="text-sm text-gray-500">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddUsersModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={assignSelectedUsers}
                  disabled={selectedUserIds.length === 0 || assigningUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <UserPlus size={14} />
                  {assigningUsers ? 'Adding...' : `Add ${selectedUserIds.length || ''} User${selectedUserIds.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setNoOrgDetected(false);
          loadData();
        }}
        organizationId={organization?.id}
      />
    </DashboardLayout>
  );
}
