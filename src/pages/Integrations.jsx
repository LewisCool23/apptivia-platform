import React, { useState, useEffect } from 'react';
import { Plug, CheckCircle, AlertCircle, RefreshCw, Settings, Plus, Upload, Download, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import PageActionBar from '../components/PageActionBar';
import { useNotifications } from '../contexts/NotificationContext';

export default function Integrations() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const [integrations, setIntegrations] = useState([]);
  const [availableIntegrations, setAvailableIntegrations] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = role === 'admin';
  const canManageIntegrations = isAdmin || hasPermission('manage_integrations');

  useEffect(() => {
    loadData();
  }, [profile?.organization_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load available integration templates
      const { data: templates, error: templatesError } = await supabase
        .from('integration_mapping_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (templatesError) throw templatesError;
      setAvailableIntegrations(templates || []);

      // Only load org-specific data if we have an organization_id
      if (profile?.organization_id) {
        // Load configured integrations for this organization
        const { data: configs, error: configsError } = await supabase
          .from('integrations')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false });

        if (configsError) throw configsError;
        setIntegrations(configs || []);

        // Load recent sync history
        const { data: history, error: historyError } = await supabase
          .from('integration_sync_history')
          .select('*, integrations(display_name, integration_type)')
          .eq('organization_id', profile.organization_id)
          .order('sync_started_at', { ascending: false })
          .limit(20);

        if (historyError) throw historyError;
        setSyncHistory(history || []);
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-600" />;
      case 'syncing':
        return <RefreshCw size={20} className="text-blue-600 animate-spin" />;
      default:
        return <Plug size={20} className="text-gray-400" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'syncing':
        return 'Syncing...';
      default:
        return 'Disconnected';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'syncing':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleConnectIntegration = (template) => {
    setSelectedIntegration(template);
    setShowConfigModal(true);
  };

  const handleConfigureMapping = (integration) => {
    setSelectedIntegration(integration);
    setShowMappingModal(true);
  };

  const handleToggleIntegration = async (integrationId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ is_enabled: !currentStatus })
        .eq('id', integrationId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error toggling integration:', error);
    }
  };

  const handleTriggerSync = async (integrationId) => {
    try {
      // Create sync history entry
      const { error } = await supabase
        .from('integration_sync_history')
        .insert({
          integration_id: integrationId,
          organization_id: profile.organization_id,
          status: 'running',
        });

      if (error) throw error;

      // Update integration status
      await supabase
        .from('integrations')
        .update({ status: 'syncing', last_sync_at: new Date().toISOString() })
        .eq('id', integrationId);

      // In production, this would trigger a backend job
      // For now, just reload data after a delay
      setTimeout(() => loadData(), 2000);
    } catch (error) {
      console.error('Error triggering sync:', error);
    }
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
      await loadData();
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-gray-500">Loading integrations...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Integrations</h1>
            <p className="text-gray-500 text-sm">Connect and manage your CRM integrations</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Connected</div>
            <div className="text-2xl font-bold text-green-600">
              {integrations.filter(i => i.status === 'connected').length}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Available</div>
            <div className="text-2xl font-bold text-gray-900">
              {availableIntegrations.length}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Last Sync</div>
            <div className="text-sm font-medium text-gray-900">
              {syncHistory[0] ? new Date(syncHistory[0].sync_started_at).toLocaleString() : 'Never'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Records Today</div>
            <div className="text-2xl font-bold text-blue-600">
              {syncHistory.filter(h => 
                new Date(h.sync_started_at).toDateString() === new Date().toDateString()
              ).reduce((sum, h) => sum + (h.records_processed || 0), 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Last Sync</div>
            <div className="text-sm font-medium text-gray-900">
              {syncHistory[0] ? new Date(syncHistory[0].sync_started_at).toLocaleString() : 'Never'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-sm text-gray-600">Records Today</div>
            <div className="text-2xl font-bold text-blue-600">
              {syncHistory.filter(h => 
                new Date(h.sync_started_at).toDateString() === new Date().toDateString()
              ).reduce((sum, h) => sum + (h.records_processed || 0), 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configured Integrations */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plug size={20} />
              Active Integrations
            </h2>

            {integrations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Plug size={48} className="mx-auto mb-3 text-gray-300" />
                <p>No integrations configured yet</p>
                <p className="text-sm mt-1">Connect a data source to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{integration.icon || '🔌'}</span>
                        <div>
                          <div className="font-semibold">{integration.display_name}</div>
                          <div className="text-xs text-gray-500">{integration.integration_type}</div>
                        </div>
                      </div>
                      {getStatusIcon(integration.status)}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(integration.status)}`}>
                        {getStatusLabel(integration.status)}
                      </span>
                      {integration.last_sync_at && (
                        <span className="text-xs text-gray-500">
                          Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {canManageIntegrations && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfigureMapping(integration)}
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          <Settings size={14} className="inline mr-1" />
                          Configure
                        </button>
                        <button
                          onClick={() => handleTriggerSync(integration.id)}
                          disabled={integration.status === 'syncing'}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <RefreshCw size={14} className="inline mr-1" />
                          Sync Now
                        </button>
                        <button
                          onClick={() => handleToggleIntegration(integration.id, integration.is_enabled)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            integration.is_enabled
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {integration.is_enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Integrations */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus size={20} />
              Available Integrations
            </h2>

            <div className="space-y-3">
              {availableIntegrations.map((template) => {
                const alreadyConfigured = integrations.some(
                  i => i.integration_type === template.integration_type
                );

                return (
                  <div
                    key={template.id}
                    className={`border rounded-lg p-4 ${
                      alreadyConfigured ? 'opacity-50 bg-gray-50' : 'hover:shadow-md'
                    } transition-shadow`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div>
                          <div className="font-semibold">{template.display_name}</div>
                          <div className="text-xs text-gray-500">{template.integration_type}</div>
                        </div>
                      </div>
                      {alreadyConfigured && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Connected
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>

                    {canManageIntegrations && !alreadyConfigured && (
                      <button
                        onClick={() => handleConnectIntegration(template)}
                        className="w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus size={14} className="inline mr-1" />
                        Connect {template.display_name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sync History */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <RefreshCw size={20} />
            Recent Sync History
          </h2>

          {syncHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sync history yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2 font-semibold">Integration</th>
                    <th className="pb-2 font-semibold">Started</th>
                    <th className="pb-2 font-semibold">Duration</th>
                    <th className="pb-2 font-semibold">Records</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {syncHistory.map((sync) => {
                    const duration = sync.sync_completed_at
                      ? Math.round((new Date(sync.sync_completed_at) - new Date(sync.sync_started_at)) / 1000)
                      : null;

                    return (
                      <tr key={sync.id} className="border-b last:border-0">
                        <td className="py-3">
                          {sync.integrations?.display_name || 'Unknown'}
                        </td>
                        <td className="py-3 text-gray-600">
                          {new Date(sync.sync_started_at).toLocaleString()}
                        </td>
                        <td className="py-3 text-gray-600">
                          {duration ? `${duration}s` : '-'}
                        </td>
                        <td className="py-3">
                          <div className="text-xs">
                            <div className="text-green-600">+{sync.records_created} created</div>
                            <div className="text-blue-600">~{sync.records_updated} updated</div>
                            {sync.records_failed > 0 && (
                              <div className="text-red-600">✗ {sync.records_failed} failed</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sync.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : sync.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {sync.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals would go here - ConfigModal, MappingModal */}
    </DashboardLayout>
  );
}
