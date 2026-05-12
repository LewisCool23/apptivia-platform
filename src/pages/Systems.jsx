import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink, History, RefreshCw, Key } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import ConfigureModal from '../components/ConfigureModal';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { getPermissionOverrides, listPermissionsWithState, normalizeRole } from '../permissions';
import { supabase } from '../supabaseClient';
import { useIntegrations } from '../hooks/useIntegrations';
import { useTeamManagement } from '../hooks/useTeamManagement';
import { SUPPORTED_INTEGRATIONS, API_KEY_PROVIDERS } from '../constants/integrations';
import IntegrationLogo from '../components/IntegrationLogo';
import { ROLES } from '../constants/roles';
import SyncHistoryModal from '../components/shared/SyncHistoryModal';
import DisconnectConfirmModal from '../components/shared/DisconnectConfirmModal';
import CredentialsModal from '../components/shared/CredentialsModal';
import TeamManagementPanel from '../components/shared/TeamManagementPanel';

export default function Systems() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission, updatePermissionOverridesForUser } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [savedPermissionOverrides, setSavedPermissionOverrides] = useState({});
  const [draftPermissionOverrides, setDraftPermissionOverrides] = useState({});
  const [activeTab, setActiveTab] = useState('integrations');
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = role === ROLES.ADMIN;
  const isManager = role === ROLES.MANAGER;
  const canManagePermissions = hasPermission('manage_permissions');
  const canManageTeams = hasPermission('manage_teams');
  const canManageTeamMembers = hasPermission('manage_team_members');

  // ── Integrations ──────────────────────────────────────────────
  const {
    integrations: liveIntegrations,
    templates,
    loading: integrationsLoading,
    syncing,
    error: integrationError,
    connectOAuth,
    connectCredentials,
    disconnect,
    triggerSync,
    getSyncHistory,
    refresh: refreshIntegrations,
  } = useIntegrations();

  const mergedTemplates = useMemo(() => {
    return SUPPORTED_INTEGRATIONS.map(supported => {
      const dbTemplate = templates.find(t => t.integration_type === supported.integration_type);
      return { ...supported, ...(dbTemplate || {}), icon: supported.icon, color: supported.color };
    });
  }, [templates]);

  const [syncHistoryModal, setSyncHistoryModal] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(null);
  const [credentialsModal, setCredentialsModal] = useState(null);

  const connectedIntegrationTypes = useMemo(() =>
    new Set(liveIntegrations.filter(i => i.status === 'connected').map(i => i.integration_type)),
  [liveIntegrations]);

  const integrationNames = useMemo(() =>
    SUPPORTED_INTEGRATIONS.filter(s => connectedIntegrationTypes.has(s.integration_type))
      .map(s => ({ type: s.integration_type, name: s.display_name })),
  [connectedIntegrationTypes]);

  // ── Teams (shared hook) ───────────────────────────────────────
  const teamHook = useTeamManagement();
  const { loadTeams, loadAllProfiles, loadTeamMembers, selectedTeamId } = teamHook;

  // ── Tabs ──────────────────────────────────────────────────────
  const tabs = useMemo(() => {
    const baseTabs = [{ id: 'integrations', label: 'Integrations' }];
    if (canManageTeams || canManageTeamMembers) {
      baseTabs.push({ id: 'teams', label: 'Teams' });
    }
    return baseTabs;
  }, [canManageTeams, canManageTeamMembers]);

  // ── Notifications for disconnected integrations ───────────────
  useEffect(() => {
    if (!templates.length) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem('apptivia.integrationNotices') || '[]');
      const connectedTypes = new Set(liveIntegrations.filter(i => i.status === 'connected').map(i => i.integration_type));
      templates
        .filter(t => !connectedTypes.has(t.integration_type))
        .forEach(t => {
          const key = `integration-${t.integration_type}`;
          if (stored.includes(key)) return;
          addNotification({
            type: 'integration',
            title: 'Integration available',
            message: `Connect ${t.display_name} to unlock data.`,
            link: '/systems',
            dedupeKey: key,
          });
          stored.push(key);
        });
      window.localStorage.setItem('apptivia.integrationNotices', JSON.stringify(stored));
    } catch (e) {}
  }, [templates, liveIntegrations, addNotification]);

  // ── Permissions ───────────────────────────────────────────────
  const loadUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, role, email, team_id, department, title')
        .order('first_name');
      if (profile?.organization_id) query = query.eq('organization_id', profile.organization_id);
      const { data, error } = await query;
      if (!error) setUsersList(data || []);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  useEffect(() => {
    if (showPermissionsModal) loadUsers();
  }, [showPermissionsModal]);

  useEffect(() => {
    if (showTeamModal) {
      Promise.all([loadTeams(), loadAllProfiles()]);
      teamHook.setMemberActionError('');
    }
  }, [showTeamModal]);

  useEffect(() => {
    if (showTeamModal && selectedTeamId) loadTeamMembers(selectedTeamId);
  }, [showTeamModal, selectedTeamId]);

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
    return JSON.stringify(savedPermissionOverrides || {}) !== JSON.stringify(draftPermissionOverrides || {});
  }, [selectedUserId, savedPermissionOverrides, draftPermissionOverrides]);

  const togglePermission = (permKey, enabled) => {
    if (!selectedUserId) return;
    setDraftPermissionOverrides(prev => ({ ...prev, [permKey]: !enabled }));
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

  const closePermissionsModal = () => {
    setShowPermissionsModal(false);
    setDraftPermissionOverrides(savedPermissionOverrides || {});
  };

  // ── Search ────────────────────────────────────────────────────
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
      let profilesSearchQ = supabase.from('profiles').select('id, first_name, last_name, email, role').or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%, email.ilike.%${searchTerm}%`).limit(5);
      if (profile?.organization_id) profilesSearchQ = profilesSearchQ.eq('organization_id', profile.organization_id);
      const { data: profiles } = await profilesSearchQ;
      if (profiles) {
        profiles.forEach((p) => {
          results.push({ type: 'User', title: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email, subtitle: p.role, link: `/profile?user=${p.id}`, icon: '👤' });
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
    const timeoutId = setTimeout(() => { if (searchQuery) handleSearch(searchQuery); }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // ── Refresh ───────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshIntegrations(), loadTeams(), loadAllProfiles()]);
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectCredentials = async (providerType, credentials) => {
    await connectCredentials(providerType, credentials);
    setCredentialsModal(null);
    addNotification({ type: 'success', message: `${providerType} connected successfully` });
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Systems Management</h1>
            <p className="text-apptivia-carbon-500 text-sm">Manage integrations and system settings</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={14} /></button>}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button key={idx} onClick={() => { navigate(result.link); setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="w-full text-left px-4 py-3 hover:bg-apptivia-paper border-b last:border-b-0 transition-colors">
                      <div className="flex items-start gap-3"><span className="text-xl">{result.icon}</span><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-apptivia-ink">{result.title}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-carbon-600">{result.type}</span></div>{result.subtitle && <div className="text-[11px] text-apptivia-carbon-500 mt-0.5 truncate">{result.subtitle}</div>}</div></div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-apptivia-carbon-500 text-center">No results found</div></div>}
              {searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div></div>}
            </div>
            {/* Refresh */}
            <button onClick={handleRefresh} disabled={isRefreshing} className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-apptivia-carbon-700 border border-apptivia-carbon-200 hover:bg-apptivia-paper group ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'}`} title="Refresh data">
              <svg className={`w-[18px] h-[18px] ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-apptivia-ink text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => setConfigPanelOpen(true)}
              onExportClick={() => {}}
              onNotificationsClick={openPanel}
              exportDisabled={true}
              configureDisabled={false}
              notificationBadge={unreadCount}
              actions={[
                ...((isAdmin || isManager) && canManageTeamMembers ? [{
                  label: isManager ? 'Team Settings' : 'Manage Teams',
                  onClick: () => setShowTeamModal(true),
                }] : []),
                ...(isAdmin && canManagePermissions ? [{
                  label: 'Manage Permissions',
                  onClick: () => setShowPermissionsModal(true),
                }] : []),
              ]}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg p-2 shadow-sm border border-apptivia-carbon-100">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-apptivia-coral text-white shadow-sm' : 'text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ════════ Integrations Tab ════════ */}
        {activeTab === 'integrations' && (
        <div className="mt-4">
          {integrationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} />
              {integrationError}
            </div>
          )}

          {integrationsLoading ? (
            <div className="flex items-center justify-center py-12 text-apptivia-carbon-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              Loading integrations...
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mergedTemplates.map((template) => {
              const integration = liveIntegrations.find(i => i.integration_type === template.integration_type);
              const isConnected = integration?.status === 'connected';
              const isSyncing = integration?.status === 'syncing' || syncing === integration?.id;
              const isError = integration?.status === 'error';

              return (
                <div key={template.integration_type} className="bg-white rounded-lg p-5 shadow-sm border border-apptivia-carbon-100 flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <IntegrationLogo type={template.integration_type} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-apptivia-ink">{template.display_name}</div>
                      <div className="text-xs text-apptivia-carbon-500 truncate">{template.description}</div>
                    </div>
                    {isConnected && <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />}
                    {isError && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Error" />}
                  </div>
                  <div className="mb-3">
                    {isConnected && !isSyncing && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium"><CheckCircle size={12} /> Connected</span>}
                    {isSyncing && <span className="inline-flex items-center gap-1 text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2.5 py-1 rounded-full font-medium"><Loader2 size={12} className="animate-spin" /> Syncing...</span>}
                    {isError && <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium"><AlertCircle size={12} /> Error</span>}
                    {!integration && <span className="inline-flex items-center gap-1 text-xs bg-apptivia-paper text-apptivia-carbon-500 px-2.5 py-1 rounded-full font-medium">Available</span>}
                    {integration && integration.status === 'disconnected' && <span className="inline-flex items-center gap-1 text-xs bg-apptivia-paper text-apptivia-carbon-500 px-2.5 py-1 rounded-full font-medium">Disconnected</span>}
                  </div>
                  {isConnected && integration && (
                    <div className="text-xs text-apptivia-carbon-400 mb-3 space-y-1">
                      {integration.last_sync_at && <div className="flex items-center gap-1"><Clock size={11} /> Last synced: {new Date(integration.last_sync_at).toLocaleString()}</div>}
                      {integration.last_sync_error && <div className="text-red-500 truncate" title={integration.last_sync_error}>{integration.last_sync_error}</div>}
                    </div>
                  )}
                  <div className="mt-auto flex flex-col gap-2">
                    {isConnected ? (
                      <>
                        <div className="flex gap-2">
                          <button onClick={() => triggerSync(integration.id)} disabled={isSyncing} className="flex-1 flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral disabled:opacity-50 transition-colors">
                            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={async () => {
                              setSyncHistoryModal(integration.id);
                              setSyncHistoryLoading(true);
                              const history = await getSyncHistory(integration.id);
                              setSyncHistory(history);
                              setSyncHistoryLoading(false);
                            }}
                            className="px-3 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
                            title="Sync History"
                          >
                            <History size={14} />
                          </button>
                        </div>
                        <button onClick={() => setConfirmDisconnect(integration.id)} className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors">
                          Disconnect
                        </button>
                      </>
                    ) : API_KEY_PROVIDERS[template.integration_type] ? (
                      <button
                        onClick={() => setCredentialsModal(template.integration_type)}
                        className="w-full bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral transition-colors flex items-center justify-center gap-2"
                      >
                        <Key size={14} /> Connect with API Key
                      </button>
                    ) : (
                      <button onClick={() => connectOAuth(template.integration_type)} className="w-full bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral transition-colors">
                        Connect
                      </button>
                    )}
                  </div>
                  {template.documentation_url && (
                    <a href={template.documentation_url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-[11px] text-apptivia-carbon-400 hover:text-apptivia-coral transition-colors">
                      <ExternalLink size={10} /> API Docs
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          )}

          <SyncHistoryModal
            isOpen={!!syncHistoryModal}
            onClose={() => setSyncHistoryModal(null)}
            loading={syncHistoryLoading}
            history={syncHistory}
            integration={liveIntegrations.find(i => i.id === syncHistoryModal)}
          />

          <CredentialsModal
            providerType={credentialsModal}
            onClose={() => setCredentialsModal(null)}
            onConnect={handleConnectCredentials}
            error={integrationError}
          />

          <DisconnectConfirmModal
            isOpen={!!confirmDisconnect}
            onClose={() => setConfirmDisconnect(null)}
            onConfirm={async () => {
              await disconnect(confirmDisconnect);
              setConfirmDisconnect(null);
            }}
          />
        </div>
        )}

        {/* ════════ Teams Tab ════════ */}
        {activeTab === 'teams' && (canManageTeams || canManageTeamMembers) && (
        <div className="bg-white rounded-lg shadow-sm p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-apptivia-ink">Team Management</h3>
              <p className="text-xs text-apptivia-carbon-500">
                {isManager ? 'Manage your team members and settings' : 'Manage all teams across the organization'}
              </p>
            </div>
          </div>
          <TeamManagementPanel
            teamHook={teamHook}
            canManageTeams={canManageTeams}
            canManageTeamMembers={canManageTeamMembers}
            isManager={isManager}
            connectedIntegrations={integrationNames}
            onNotify={addNotification}
          />
        </div>
        )}

        <ConfigurePanel isOpen={configPanelOpen} onClose={() => setConfigPanelOpen(false)} onOpenAdvanced={() => setShowConfigModal(true)} />
        <ConfigureModal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} />
        <RightFilterPanel isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="System Filters" subtitle="Filter integrations" showReset>
          <div className="text-xs text-apptivia-carbon-500">No filters available yet.</div>
        </RightFilterPanel>

        {/* ════════ Permissions Modal ════════ */}
        {showPermissionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closePermissionsModal}>
            <div className="bg-white w-[95%] max-w-6xl rounded-lg shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-apptivia-ink">User Permissions</h2>
                  <p className="text-xs text-apptivia-carbon-500">Enable or disable permissions for individual users</p>
                </div>
                <button onClick={closePermissionsModal} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm">Close</button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-apptivia-paper rounded-lg p-3 border">
                    <div className="text-xs font-semibold text-apptivia-carbon-600 mb-2">Users</div>
                    <div className="space-y-2 max-h-[420px] overflow-auto">
                      {usersList.length === 0 ? (
                        <div className="text-xs text-apptivia-carbon-500">No users available.</div>
                      ) : (
                        usersList.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => setSelectedUserId(String(u.id))}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(u.id) === String(selectedUserId) ? 'bg-apptivia-coral text-white' : 'bg-white text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'}`}
                          >
                            <div>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User'}</div>
                            <div className={`${String(u.id) === String(selectedUserId) ? 'text-apptivia-coral-tone-300' : 'text-apptivia-carbon-400'} text-[10px]`}>{normalizeRole(u.role)}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2 bg-white rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-apptivia-carbon-500">Selected user</div>
                        <div className="text-sm font-semibold text-apptivia-ink">
                          {selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email : 'Choose a user'}
                        </div>
                      </div>
                      <button onClick={resetPermissionOverrides} className="text-xs font-semibold text-apptivia-coral hover:text-apptivia-coral" disabled={!selectedUserId}>
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
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${perm.enabled ? 'bg-green-100 text-green-700' : 'bg-apptivia-carbon-200 text-apptivia-carbon-500'}`}>
                            {perm.enabled ? '✓' : '—'}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-apptivia-ink">{perm.label}</div>
                            <div className="text-[11px] text-apptivia-carbon-500">{perm.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={handleDiscardPermissions} className="px-3 py-1.5 text-xs rounded border" disabled={!selectedUserId || !hasPermissionChanges}>
                        Discard
                      </button>
                      <button onClick={handleSavePermissions} className="px-3 py-1.5 text-xs rounded bg-apptivia-coral text-white disabled:opacity-60" disabled={!selectedUserId || !hasPermissionChanges}>
                        Save changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ Team Modal (from header action button) ════════ */}
        {showTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTeamModal(false)}>
            <div className="bg-white w-[95%] max-w-6xl rounded-lg shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-apptivia-ink">{isManager ? 'Team Settings' : 'Team Management'}</h2>
                  <p className="text-xs text-apptivia-carbon-500">{isManager ? 'Manage your assigned team members and integrations' : 'Manage teams and team members across the organization'}</p>
                </div>
                <button onClick={() => setShowTeamModal(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm">Close</button>
              </div>
              <TeamManagementPanel
                teamHook={teamHook}
                canManageTeams={canManageTeams}
                canManageTeamMembers={canManageTeamMembers}
                isManager={isManager}
                connectedIntegrations={integrationNames}
                onNotify={addNotification}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
