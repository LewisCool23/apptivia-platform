import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink, History, Key, Building2, User } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import PageActionBar from '../components/PageActionBar';
import { useNotifications } from '../contexts/NotificationContext';
import { useIntegrations } from '../hooks/useIntegrations';
import { backendFetch } from '../utils/backendFetch';
import { SUPPORTED_INTEGRATIONS, API_KEY_PROVIDERS } from '../constants/integrations';
import SyncHistoryModal from '../components/shared/SyncHistoryModal';
import DisconnectConfirmModal from '../components/shared/DisconnectConfirmModal';
import CredentialsModal from '../components/shared/CredentialsModal';

export default function Integrations() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const {
    integrations: liveIntegrations,
    templates,
    loading,
    syncing,
    error: integrationError,
    connectOAuth,
    connecting,
    connectCredentials,
    disconnect,
    triggerSync,
    getSyncHistory,
    refresh,
  } = useIntegrations();

  const {
    integrations: personalIntegrations,
    loading: personalLoading,
    syncing: personalSyncing,
    connectOAuth: connectPersonalOAuth,
    connectCredentials: connectPersonalCredentials,
    disconnect: disconnectPersonal,
    triggerSync: triggerPersonalSync,
    getSyncHistory: getPersonalSyncHistory,
    refresh: refreshPersonal,
  } = useIntegrations({ personal: true });

  const [syncHistoryModal, setSyncHistoryModal] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(null);
  const [credentialsModal, setCredentialsModal] = useState(null);

  // Merge hardcoded list with DB templates
  const mergedTemplates = useMemo(() => {
    return SUPPORTED_INTEGRATIONS.map(supported => {
      const dbTemplate = templates.find(t => t.integration_type === supported.integration_type);
      return { ...supported, ...(dbTemplate || {}), icon: supported.icon, color: supported.color };
    });
  }, [templates]);

  const allIntegrations = [...liveIntegrations, ...personalIntegrations];
  const connectedCount = allIntegrations.filter(i => i.status === 'connected').length;
  const lastSync = allIntegrations
    .filter(i => i.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at) - new Date(a.last_sync_at))[0]?.last_sync_at;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refresh(), refreshPersonal()]);
    setIsRefreshing(false);
  };

  const connectedOrgIntegrations = liveIntegrations.filter(i => i.status === 'connected');
  const connectedPersonalIntegrations = personalIntegrations.filter(i => i.status === 'connected');
  const allConnected = [...connectedOrgIntegrations, ...connectedPersonalIntegrations];

  const handleSyncAll = async () => {
    setSyncingAll(true);
    // Single endpoint syncs ALL org integrations (org-level + all reps' personal)
    await backendFetch('/api/integrations/sync-all', {}).catch(() => {});
    // Poll until none are syncing — check every 3s, max 90s
    const startTime = Date.now();
    const poll = async () => {
      const [freshOrg, freshPersonal] = await Promise.all([refresh(), refreshPersonal()]);
      const stillSyncing = [...freshOrg, ...freshPersonal].some(i => i.status === 'syncing');
      if (stillSyncing && Date.now() - startTime < 90000) {
        setTimeout(poll, 3000);
      } else {
        setSyncingAll(false);
      }
    };
    setTimeout(poll, 3000);
  };

  const handleConnectCredentials = async (providerType, credentials) => {
    await connectCredentials(providerType, credentials);
    setCredentialsModal(null);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Integrations</h1>
            <p className="text-apptivia-carbon-500 text-sm">Connect your sales tools to sync data automatically</p>
          </div>
          <div className="flex gap-2 items-center">
            {allConnected.length > 0 && (
              <button
                onClick={handleSyncAll}
                disabled={syncingAll || !!syncing}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-apptivia-coral text-white hover:bg-apptivia-coral disabled:opacity-50 transition-colors`}
              >
                {syncingAll ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {syncingAll ? 'Syncing All...' : 'Sync All'}
              </button>
            )}
            <button onClick={handleRefresh} disabled={isRefreshing} className={`relative p-2 rounded-lg text-sm bg-white text-apptivia-carbon-700 border border-apptivia-carbon-200 hover:bg-apptivia-paper group ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'}`} title="Refresh">
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <PageActionBar
              onFilterClick={() => {}}
              onConfigureClick={() => {}}
              onExportClick={() => {}}
              onNotificationsClick={openPanel}
              exportDisabled
              configureDisabled
              notificationBadge={unreadCount}
              actions={[]}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-apptivia-carbon-100">
            <div className="text-xs text-apptivia-carbon-500 font-medium">Connected</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{connectedCount}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-apptivia-carbon-100">
            <div className="text-xs text-apptivia-carbon-500 font-medium">Available</div>
            <div className="text-2xl font-bold text-apptivia-ink mt-1">{SUPPORTED_INTEGRATIONS.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-apptivia-carbon-100">
            <div className="text-xs text-apptivia-carbon-500 font-medium">Last Sync</div>
            <div className="text-sm font-medium text-apptivia-ink mt-1">
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
            </div>
          </div>
        </div>

        {/* Error */}
        {integrationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {integrationError}
          </div>
        )}

        {/* Integration Cards — single unified grid with dual-status badges */}
        {(loading || personalLoading) ? (
          <div className="flex items-center justify-center py-16 text-apptivia-carbon-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Loading integrations...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mergedTemplates.map((template) => {
              const orgIntegration = liveIntegrations.find(i => i.integration_type === template.integration_type);
              const personalIntegration = personalIntegrations.find(i => i.integration_type === template.integration_type);
              const orgConnected = orgIntegration?.status === 'connected';
              const personalConnected = personalIntegration?.status === 'connected';
              const isOrgSyncing = orgIntegration?.status === 'syncing' || syncing === orgIntegration?.id;
              const isPersonalSyncing = personalIntegration?.status === 'syncing' || personalSyncing === personalIntegration?.id;
              const isSyncing = isOrgSyncing || isPersonalSyncing;
              const isError = orgIntegration?.status === 'error' || personalIntegration?.status === 'error';
              const anyConnected = orgConnected || personalConnected;

              return (
                <div key={template.integration_type} className="bg-white rounded-xl p-5 shadow-sm border border-apptivia-carbon-100 flex flex-col hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                      {template.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-apptivia-ink">{template.display_name}</div>
                      <div className="text-xs text-apptivia-carbon-500 truncate">{template.description}</div>
                    </div>
                    {anyConnected && <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />}
                    {isError && !anyConnected && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Error" />}
                  </div>

                  {/* Status Badges */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {orgConnected && !isSyncing && (
                      <span className="inline-flex items-center gap-1 text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2.5 py-1 rounded-full font-medium">
                        <Building2 size={11} /> Org-wide
                      </span>
                    )}
                    {isSyncing && (
                      <span className="inline-flex items-center gap-1 text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2.5 py-1 rounded-full font-medium">
                        <Loader2 size={12} className="animate-spin" /> Syncing...
                      </span>
                    )}
                    {personalConnected && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                        <User size={11} /> Personal
                      </span>
                    )}
                    {isError && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                        <AlertCircle size={12} /> Error
                      </span>
                    )}
                    {!anyConnected && !isError && (
                      <span className="inline-flex items-center gap-1 text-xs bg-apptivia-paper text-apptivia-carbon-500 px-2.5 py-1 rounded-full font-medium">
                        Available
                      </span>
                    )}
                  </div>

                  {/* Sync Info */}
                  <div className="text-xs text-apptivia-carbon-400 mb-3 space-y-1">
                    {orgConnected && orgIntegration?.last_sync_at && (
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        Org synced: {new Date(orgIntegration.last_sync_at).toLocaleString()}
                      </div>
                    )}
                    {personalConnected && personalIntegration?.last_sync_at && (
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        Personal synced: {new Date(personalIntegration.last_sync_at).toLocaleString()}
                      </div>
                    )}
                    {orgIntegration?.last_sync_error && (
                      <div className="text-red-500 truncate" title={orgIntegration.last_sync_error}>
                        {orgIntegration.last_sync_error}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex flex-col gap-2">
                    {orgConnected ? (
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => triggerSync(orgIntegration.id)}
                            disabled={isSyncing || syncingAll}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral disabled:opacity-50 transition-colors"
                          >
                            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={async () => {
                              setSyncHistoryModal(orgIntegration.id);
                              setSyncHistoryLoading(true);
                              const history = await getSyncHistory(orgIntegration.id);
                              setSyncHistory(history);
                              setSyncHistoryLoading(false);
                            }}
                            className="px-3 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
                            title="Sync History"
                          >
                            <History size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => setConfirmDisconnect(orgIntegration.id)}
                          className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : personalConnected ? (
                      <>
                        <div className="flex gap-2">
                          <button
                            onClick={() => triggerPersonalSync(personalIntegration.id)}
                            disabled={isPersonalSyncing || syncingAll}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral disabled:opacity-50 transition-colors"
                          >
                            {isPersonalSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            {isPersonalSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            onClick={async () => {
                              setSyncHistoryModal(personalIntegration.id);
                              setSyncHistoryLoading(true);
                              const history = await getPersonalSyncHistory(personalIntegration.id);
                              setSyncHistory(history);
                              setSyncHistoryLoading(false);
                            }}
                            className="px-3 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
                            title="Sync History"
                          >
                            <History size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => setConfirmDisconnect(personalIntegration.id)}
                          className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : API_KEY_PROVIDERS[template.integration_type] ? (
                      <button
                        onClick={() => setCredentialsModal(template.integration_type)}
                        className="w-full flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral transition-colors"
                      >
                        <Key size={14} /> Connect with API Key
                      </button>
                    ) : (
                      <button
                        onClick={() => connectOAuth(template.integration_type)}
                        disabled={connecting === template.integration_type}
                        className="w-full flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral disabled:opacity-50 transition-colors"
                      >
                        {connecting === template.integration_type ? (
                          <><Loader2 size={14} className="animate-spin" /> Connecting...</>
                        ) : (
                          'Connect'
                        )}
                      </button>
                    )}
                  </div>
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
          integration={allIntegrations.find(i => i.id === syncHistoryModal)}
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
            const isPersonal = personalIntegrations.some(i => i.id === confirmDisconnect);
            if (isPersonal) {
              await disconnectPersonal(confirmDisconnect);
            } else {
              await disconnect(confirmDisconnect);
            }
            setConfirmDisconnect(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}
