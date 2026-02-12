import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import ConfigureModal from '../components/ConfigureModal';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { getPermissionOverrides, listPermissionsWithState, normalizeRole } from '../permissions';
import { supabase } from '../supabaseClient';

export default function PermissionsTeams() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission, updatePermissionOverridesForUser } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [selectedAddMemberId, setSelectedAddMemberId] = useState('');
  const [selectedRemoveMemberId, setSelectedRemoveMemberId] = useState('');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [savedPermissionOverrides, setSavedPermissionOverrides] = useState({});
  const [draftPermissionOverrides, setDraftPermissionOverrides] = useState({});
  const [activeTab, setActiveTab] = useState('teams');
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const canManagePermissions = hasPermission('manage_permissions');
  const canManageTeams = hasPermission('manage_teams');
  const canManageTeamMembers = hasPermission('manage_team_members');
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;

  const tabs = useMemo(() => {
    const baseTabs = [];
    
    // Only show Teams tab if user has permission
    if (canManageTeams || canManageTeamMembers) {
      baseTabs.push({ id: 'teams', label: 'Manage Teams' });
    }
    
    // Only show Permissions tab if user has permission
    if (canManagePermissions) {
      baseTabs.push({ id: 'permissions', label: 'Manage Permissions' });
    }
    
    return baseTabs;
  }, [canManageTeams, canManageTeamMembers, canManagePermissions]);

  const integrations = useMemo(() => (['Salesforce', 'Gong', 'Outreach', 'Calendar']), []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, email, team_id, department, title')
        .order('first_name');
      if (!error) setUsersList(data || []);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*').order('name');
      if (!error) {
        setTeams(data || []);
        if (!selectedTeamId) {
          if (isManager && teamId) {
            setSelectedTeamId(String(teamId));
          } else if (data?.length) {
            setSelectedTeamId(String(data[0].id));
          }
        }
      }
    } catch (e) {
      console.error('Error loading teams:', e);
    }
  };

  const loadTeamMembers = async (teamIdValue) => {
    if (!teamIdValue) {
      setTeamMembers([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .eq('team_id', teamIdValue)
        .order('first_name');
      if (!error) setTeamMembers(data || []);
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  };

  const loadAllProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .order('first_name');
      if (!error) setAllProfiles(data || []);
    } catch (e) {
      console.error('Error loading profiles:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'permissions' && canManagePermissions) {
      loadUsers();
    }
  }, [activeTab, canManagePermissions]);

  useEffect(() => {
    if (activeTab === 'teams' && (canManageTeams || canManageTeamMembers)) {
      loadTeams();
      loadAllProfiles();
      setMemberActionError('');
    }
  }, [activeTab, canManageTeams, canManageTeamMembers]);

  useEffect(() => {
    if (activeTab === 'teams' && selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    }
  }, [activeTab, selectedTeamId]);

  useEffect(() => {
    if (!showPermissionsModal) return;
    if (selectedUserId || usersList.length === 0) return;
    setSelectedUserId(String(usersList[0].id));
  }, [showPermissionsModal, selectedUserId, usersList]);

  useEffect(() => {
    if (!selectedUserId) return;
    const current = getPermissionOverrides(selectedUserId);
    setSavedPermissionOverrides(current);
    setDraftPermissionOverrides(current);
  }, [selectedUserId, showPermissionsModal]);

  const selectedUser = usersList.find(u => String(u.id) === String(selectedUserId));
  const selectedUserRole = normalizeRole(selectedUser?.role);
  const permissionList = listPermissionsWithState({
    role: selectedUserRole,
    overrides: draftPermissionOverrides,
    explicitPermissions: Array.isArray(selectedUser?.permissions) ? selectedUser.permissions : []
  });

  const hasPermissionChanges = useMemo(() => {
    if (!selectedUserId) return false;
    const saved = savedPermissionOverrides || {};
    const draft = draftPermissionOverrides || {};
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [selectedUserId, savedPermissionOverrides, draftPermissionOverrides]);

  const togglePermission = (permKey, enabled) => {
    if (!selectedUserId) return;
    const nextOverrides = {
      ...draftPermissionOverrides,
      [permKey]: enabled ? false : true,
    };
    setDraftPermissionOverrides(nextOverrides);
  };

  const resetPermissionOverrides = () => {
    if (!selectedUserId) return;
    setDraftPermissionOverrides({});
  };

  const handleSavePermissions = () => {
    if (!selectedUserId) return;
    updatePermissionOverridesForUser(selectedUserId, draftPermissionOverrides);
    setSavedPermissionOverrides(draftPermissionOverrides);
  };

  const handleDiscardPermissions = () => {
    if (!selectedUserId) return;
    setDraftPermissionOverrides(savedPermissionOverrides || {});
  };

  const availableMembers = useMemo(() => {
    if (!selectedTeamId) return [];
    return allProfiles.filter(p => String(p.team_id) !== String(selectedTeamId));
  }, [allProfiles, selectedTeamId]);

  useEffect(() => {
    if (!showAddMemberModal) return;
    if (!selectedAddMemberId && availableMembers.length > 0) {
      setSelectedAddMemberId(String(availableMembers[0].id));
    }
  }, [showAddMemberModal, availableMembers, selectedAddMemberId]);

  useEffect(() => {
    if (!showRemoveMemberModal) return;
    if (!selectedRemoveMemberId && teamMembers.length > 0) {
      setSelectedRemoveMemberId(String(teamMembers[0].id));
    }
  }, [showRemoveMemberModal, teamMembers, selectedRemoveMemberId]);

  const handleAddMember = async () => {
    if (!selectedAddMemberId || !selectedTeamId) return;
    setMemberActionLoading(true);
    setMemberActionError('');
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: selectedTeamId })
      .eq('id', selectedAddMemberId);
    if (error) {
      setMemberActionError(error.message || 'Unable to add member.');
    } else {
      setShowAddMemberModal(false);
      setSelectedAddMemberId('');
      await loadTeamMembers(selectedTeamId);
      await loadAllProfiles();
    }
    setMemberActionLoading(false);
  };

  const handleRemoveMember = async () => {
    if (!selectedRemoveMemberId) return;
    setMemberActionLoading(true);
    setMemberActionError('');
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: null })
      .eq('id', selectedRemoveMemberId);
    if (error) {
      setMemberActionError(error.message || 'Unable to remove member.');
    } else {
      setShowRemoveMemberModal(false);
      setSelectedRemoveMemberId('');
      await loadTeamMembers(selectedTeamId);
      await loadAllProfiles();
    }
    setMemberActionLoading(false);
  };

  const getIntegrationStatus = (memberId, integrationName) => {
    const seed = `${memberId || ''}-${integrationName}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash + seed.charCodeAt(i)) % 10;
    }
    return hash % 2 === 0;
  };

  // Search functionality
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
      window.location.reload();
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Permissions & Teams</h1>
            <p className="text-gray-500 text-sm">Manage user permissions and team settings</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result,idx) => (
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
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-gray-500 text-center">No results found</div></div>}
              {searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-gray-500 text-center">Searching...</div></div>}
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
              onFilterClick={() => setFiltersOpen(true)}
            onConfigureClick={() => setConfigPanelOpen(true)}
            onExportClick={() => {}}
            onNotificationsClick={openPanel}
            exportDisabled={false}
            configureDisabled={false}
            notificationBadge={unreadCount}
            actions={[
              ...((isAdmin || isManager) && canManageTeamMembers ? [{
                label: isManager ? 'Team Settings' : 'Manage Teams',
                onClick: () => setActiveTab('teams'),
              }] : []),
              ...(isAdmin && canManagePermissions ? [{
                label: 'Manage Permissions',
                onClick: () => setActiveTab('permissions'),
              }] : []),
            ]}
          />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Removed Integrations Tab - now in separate Integrations page */}

        {/* Manage Teams Tab */}
        {activeTab === 'teams' && (canManageTeams || canManageTeamMembers) && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{isManager ? 'Team Settings' : 'Team Management'}</h3>
              <p className="text-xs text-gray-500">{isManager ? 'Manage your assigned team members and integrations' : 'Manage teams and team members across the organization'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-600">Teams</div>
                <button className="text-xs text-blue-600 font-semibold" disabled={!canManageTeams}>+ Add Team</button>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto">
                {teams.length === 0 ? (
                  <div className="text-xs text-gray-500">No teams found.</div>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(String(team.id))}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(team.id) === String(selectedTeamId) ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                    >
                      <div>{team.name}</div>
                      <div className={`${String(team.id) === String(selectedTeamId) ? 'text-blue-100' : 'text-gray-400'} text-[10px]`}>{team.department || 'No department'}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-gray-500">Team members</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Select a team'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs font-semibold text-blue-600 disabled:text-gray-300"
                    onClick={() => setShowAddMemberModal(true)}
                    disabled={!canManageTeamMembers || !selectedTeamId}
                  >
                    + Add Member
                  </button>
                  <button
                    className="text-xs font-semibold text-red-500 disabled:text-gray-300"
                    onClick={() => setShowRemoveMemberModal(true)}
                    disabled={!canManageTeamMembers || teamMembers.length === 0}
                  >
                    Remove Member
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-auto">
                {teamMembers.length === 0 ? (
                  <div className="text-xs text-gray-500">No team members found.</div>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                        <div className="text-[11px] text-gray-500">{normalizeRole(member.role)}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        {integrations.map((integration) => (
                          <div key={integration} className="flex items-center gap-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${getIntegrationStatus(member.id, integration) ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span>{integration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        <ConfigurePanel
          isOpen={configPanelOpen}
          onClose={() => setConfigPanelOpen(false)}
          onOpenAdvanced={() => setShowConfigModal(true)}
        />
        <ConfigureModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />
        <RightFilterPanel
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="System Filters"
          subtitle="Filter integrations"
          showReset
        >
          <div className="text-xs text-gray-500">No filters available yet.</div>
        </RightFilterPanel>
        {/* Manage Permissions Tab */}
        {activeTab === 'permissions' && canManagePermissions && (
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Permissions</h3>
                <p className="text-xs text-gray-500">Enable or disable permissions for individual users</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-3 border">
                <div className="text-xs font-semibold text-gray-600 mb-2">Users</div>
                <div className="space-y-2 max-h-[420px] overflow-auto">
                  {usersList.length === 0 ? (
                    <div className="text-xs text-gray-500">No users available.</div>
                  ) : (
                    usersList.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUserId(String(u.id))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(u.id) === String(selectedUserId) ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                      >
                        <div>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User'}</div>
                        <div className={`${String(u.id) === String(selectedUserId) ? 'text-blue-100' : 'text-gray-400'} text-[10px]`}>{normalizeRole(u.role)}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500">Selected user</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email : 'Choose a user'}
                    </div>
                  </div>
                  <button
                    onClick={resetPermissionOverrides}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    disabled={!selectedUserId}
                  >
                    Reset to role defaults
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {permissionList.map((perm) => (
                    <button
                      key={perm.key}
                      onClick={() => togglePermission(perm.key, perm.enabled)}
                      className="flex items-start gap-3 border rounded-lg p-3 text-left hover:shadow-sm transition-all"
                      disabled={!selectedUserId}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${perm.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        {perm.enabled ? '✓' : '—'}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-900">{perm.label}</div>
                        <div className="text-[11px] text-gray-500">{perm.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={handleDiscardPermissions}
                    className="px-3 py-1.5 text-xs rounded border"
                    disabled={!selectedUserId || !hasPermissionChanges}
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSavePermissions}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                    disabled={!selectedUserId || !hasPermissionChanges}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showTeamModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowTeamModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-6xl rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{isManager ? 'Team Settings' : 'Team Management'}</h2>
                  <p className="text-xs text-gray-500">{isManager ? 'Manage your assigned team members and integrations' : 'Manage teams and team members across the organization'}</p>
                </div>
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-600">Teams</div>
                    <button className="text-xs text-blue-600 font-semibold" disabled={!canManageTeams}>+ Add Team</button>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {teams.length === 0 ? (
                      <div className="text-xs text-gray-500">No teams found.</div>
                    ) : (
                      teams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => setSelectedTeamId(String(team.id))}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(team.id) === String(selectedTeamId) ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                        >
                          <div>{team.name}</div>
                          <div className={`${String(team.id) === String(selectedTeamId) ? 'text-blue-100' : 'text-gray-400'} text-[10px]`}>{team.department || 'No department'}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Team members</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Select a team'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="text-xs font-semibold text-blue-600 disabled:text-gray-300"
                        onClick={() => setShowAddMemberModal(true)}
                        disabled={!canManageTeamMembers || !selectedTeamId}
                      >
                        + Add Member
                      </button>
                      <button
                        className="text-xs font-semibold text-red-500 disabled:text-gray-300"
                        onClick={() => setShowRemoveMemberModal(true)}
                        disabled={!canManageTeamMembers || teamMembers.length === 0}
                      >
                        Remove Member
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {teamMembers.length === 0 ? (
                      <div className="text-xs text-gray-500">No team members found.</div>
                    ) : (
                      teamMembers.map((member) => (
                        <div key={member.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                            <div className="text-[11px] text-gray-500">{normalizeRole(member.role)}</div>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            {integrations.map((integration) => (
                              <div key={integration} className="flex items-center gap-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${getIntegrationStatus(member.id, integration) ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span>{integration}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showAddMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowAddMemberModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-md rounded-2xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Team Member</h3>
                  <p className="text-xs text-gray-500">Assign a user to the selected team</p>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Available users</label>
                  <select
                    value={selectedAddMemberId}
                    onChange={(e) => setSelectedAddMemberId(e.target.value)}
                    className="w-full border rounded px-2 py-2 text-sm"
                  >
                    {availableMembers.length === 0 ? (
                      <option value="">No available users</option>
                    ) : (
                      availableMembers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {memberActionError && (
                  <div className="text-xs text-red-500">{memberActionError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddMemberModal(false)}
                    className="px-3 py-1.5 text-xs rounded border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={memberActionLoading || !selectedAddMemberId}
                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                  >
                    {memberActionLoading ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showRemoveMemberModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowRemoveMemberModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-md rounded-2xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Remove Team Member</h3>
                  <p className="text-xs text-gray-500">Remove a user from the selected team</p>
                </div>
                <button
                  onClick={() => setShowRemoveMemberModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Current members</label>
                  <select
                    value={selectedRemoveMemberId}
                    onChange={(e) => setSelectedRemoveMemberId(e.target.value)}
                    className="w-full border rounded px-2 py-2 text-sm"
                  >
                    {teamMembers.length === 0 ? (
                      <option value="">No team members</option>
                    ) : (
                      teamMembers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {memberActionError && (
                  <div className="text-xs text-red-500">{memberActionError}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRemoveMemberModal(false)}
                    className="px-3 py-1.5 text-xs rounded border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveMember}
                    disabled={memberActionLoading || !selectedRemoveMemberId}
                    className="px-3 py-1.5 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                  >
                    {memberActionLoading ? 'Removing...' : 'Remove Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
