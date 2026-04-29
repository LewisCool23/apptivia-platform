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
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [savedPermissionOverrides, setSavedPermissionOverrides] = useState({});
  const [draftPermissionOverrides, setDraftPermissionOverrides] = useState({});
  const { openPanel, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManagePermissions = hasPermission('manage_permissions');

  // ── Load users for permissions grid ─────────────────────────
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
    if (canManagePermissions) loadUsers();
  }, [canManagePermissions]);

  useEffect(() => {
    if (selectedUserId || usersList.length === 0) return;
    setSelectedUserId(String(usersList[0].id));
  }, [selectedUserId, usersList]);

  useEffect(() => {
    if (!selectedUserId) return;
    const current = getPermissionOverrides(selectedUserId);
    setSavedPermissionOverrides(current);
    setDraftPermissionOverrides(current);
  }, [selectedUserId]);

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

  const handleSavePermissions = async () => {
    if (!selectedUserId) return;
    updatePermissionOverridesForUser(selectedUserId, draftPermissionOverrides);
    setSavedPermissionOverrides(draftPermissionOverrides);
    // Persist to DB as well (not just localStorage)
    try {
      const orgId = profile?.organization_id;
      if (orgId) {
        const { savePermissionOverridesToDb } = await import('../permissions');
        await savePermissionOverridesToDb(selectedUserId, orgId, draftPermissionOverrides);
      }
    } catch (err) {
      console.error('Failed to persist permission overrides to DB:', err);
    }
  };

  const handleDiscardPermissions = () => {
    if (!selectedUserId) return;
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
      let searchQ = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (profile?.organization_id) searchQ = searchQ.eq('organization_id', profile.organization_id);
      const { data: profiles } = await searchQ;
      if (profiles) {
        profiles.forEach((p) => {
          results.push({
            type: 'User',
            title: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
            subtitle: p.role,
            link: `/profile?user=${p.id}`,
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
      await loadUsers();
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Permissions</h1>
            <p className="text-apptivia-carbon-500 text-sm">Manage user permissions</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={14} /></button>}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button key={idx} onClick={() => { navigate(result.link); setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="w-full text-left px-4 py-3 hover:bg-apptivia-paper border-b last:border-b-0 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-apptivia-ink">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-carbon-600">{result.type}</span>
                          </div>
                          {result.subtitle && <div className="text-[11px] text-apptivia-carbon-500 mt-0.5 truncate">{result.subtitle}</div>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-apptivia-carbon-500 text-center">No results found</div></div>}
              {searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div></div>}
            </div>
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
              exportDisabled
              configureDisabled
              notificationBadge={unreadCount}
              actions={[]}
            />
          </div>
        </div>

        <ConfigurePanel isOpen={configPanelOpen} onClose={() => setConfigPanelOpen(false)} onOpenAdvanced={() => setShowConfigModal(true)} />
        <ConfigureModal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} />
        <RightFilterPanel isOpen={filtersOpen} onClose={() => setFiltersOpen(false)} title="Permission Filters" subtitle="Filter permissions" showReset>
          <div className="text-xs text-apptivia-carbon-500">No filters available yet.</div>
        </RightFilterPanel>

        {/* ════════ Permissions Management ════════ */}
        {canManagePermissions ? (
          <div className="bg-white rounded-lg shadow-sm p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-apptivia-ink">User Permissions</h3>
                <p className="text-xs text-apptivia-carbon-500">Enable or disable permissions for individual users</p>
              </div>
            </div>
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
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-8 mt-4 text-center">
            <p className="text-apptivia-carbon-500 text-sm">You don't have permission to manage user permissions.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
