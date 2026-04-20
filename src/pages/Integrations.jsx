import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, AlertCircle, Loader2, Clock, ExternalLink, History, Key, Building2, User } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import PageActionBar from '../components/PageActionBar';
import { useNotifications } from '../contexts/NotificationContext';
import { useIntegrations } from '../hooks/useIntegrations';
import { SUPPORTED_INTEGRATIONS, API_KEY_PROVIDERS } from '../constants/integrations';
import SyncHistoryModal from '../components/shared/SyncHistoryModal';
import DisconnectConfirmModal from '../components/shared/DisconnectConfirmModal';
import CredentialsModal from '../components/shared/CredentialsModal';

export default function Integrations() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    integrations: liveIntegrations,
    templates,
    loading,
    syncing,
    error: integrationError,
    connectOAuth,
    connectCredentials,
    disconnect,
    triggerSync,
    getSyncHistory,
    refresh,
  } = useIntegrations();

  const {
    integrations: personalIntegrations,
    loading: personalLoading,
    connectOAuth: connectPersonalOAuth,
    connectCredentials: connectPersonalCredentials,
    disconnect: disconnectPersonal,
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

  const orgConnectedCount = liveIntegrations.filter(i => i.status === 'connected').length;
  const personalConnectedCount = personalIntegrations.filter(i => i.status === 'connected').length;
  const connectedCount = orgConnectedCount + personalConnectedCount;
  const allIntegrations = [...liveIntegrations, ...personalIntegrations];
  const lastSync = allIntegrations
    .filter(i => i.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at) - new Date(a.last_sync_at))[0]?.last_sync_at;

  // Types already connected at org level — exclude from personal section
  const orgConnectedTypes = useMemo(
    () => new Set(liveIntegrations.filter(i => i.status === 'connected').map(i => i.integration_type)),
    [liveIntegrations]
  );
  // Templates for personal section: exclude org-connected types
  const personalTemplates = useMemo(
    () => mergedTemplates.filter(t => !orgConnectedTypes.has(t.integration_type)),
    [mergedTemplates, orgConnectedTypes]
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refresh(), refreshPersonal()]);
    setIsRefreshing(false);
  };

  const handleConnectCredentials = async (providerType, credentials) => {
    await connectPersonalCredentials(providerType, credentials);
    setCredentialsModal(null);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Integrations</h1>
            <p className="text-gray-500 text-sm">Connect your sales tools to sync data automatically</p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleRefresh} disabled={isRefreshing} className={`relative p-2 rounded-lg text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 group ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'}`} title="Refresh">
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
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Connected</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{connectedCount}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Available</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{SUPPORTED_INTEGRATIONS.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 font-medium">Last Sync</div>
            <div className="text-sm font-medium text-gray-900 mt-1">
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

        {/* Integration Cards */}
        {(loading || personalLoading) ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Loading integrations...
          </div>
        ) : (<>

          {/* Org Integrations Section */}
          <div className="bg-white rounded-lg shadow-sm p-5 mb-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Org Integrations</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 ml-7">Organization-wide integrations — data syncs for all team members</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {mergedTemplates.map((template) => {
                const integration = liveIntegrations.find(i => i.integration_type === template.integration_type);
                const isConnected = integration?.status === 'connected';
                const isSyncing = integration?.status === 'syncing' || syncing === integration?.id;
                const isError = integration?.status === 'error';

                return (
                  <div key={template.integration_type} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{template.display_name}</div>
                        <div className="text-xs text-gray-500 truncate">{template.description}</div>
                      </div>
                      {isConnected && <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />}
                      {isError && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Error" />}
                    </div>

                    <div className="mb-3">
                      {isConnected && !isSyncing && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle size={12} /> Connected
                        </span>
                      )}
                      {isSyncing && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                          <Loader2 size={12} className="animate-spin" /> Syncing...
                        </span>
                      )}
                      {isError && (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                          <AlertCircle size={12} /> Error
                        </span>
                      )}
                      {!integration && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                          Available
                        </span>
                      )}
                      {integration && integration.status === 'disconnected' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                          Disconnected
                        </span>
                      )}
                    </div>

                    {isConnected && integration && (
                      <div className="text-xs text-gray-400 mb-3 space-y-1">
                        {integration.last_sync_at && (
                          <div className="flex items-center gap-1">
                            <Clock size={11} />
                            Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                          </div>
                        )}
                        {integration.last_sync_error && (
                          <div className="text-red-500 truncate" title={integration.last_sync_error}>
                            {integration.last_sync_error}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-auto flex flex-col gap-2">
                      {isConnected ? (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={() => triggerSync(integration.id)}
                              disabled={isSyncing}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
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
                              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                              title="Sync History"
                            >
                              <History size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => setConfirmDisconnect(integration.id)}
                            className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => connectOAuth(template.integration_type)}
                          className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personal Integrations Section */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <User size={18} className="text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Personal Integrations</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 ml-7">Your personal account connections — syncs data for you only</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {personalTemplates.map((template) => {
                const integration = personalIntegrations.find(i => i.integration_type === template.integration_type);
                const isConnected = integration?.status === 'connected';
                const isError = integration?.status === 'error';

                return (
                  <div key={template.integration_type} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{template.display_name}</div>
                        <div className="text-xs text-gray-500 truncate">{template.description}</div>
                      </div>
                      {isConnected && <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />}
                      {isError && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Error" />}
                    </div>

                    <div className="mb-3">
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle size={12} /> Connected
                        </span>
                      )}
                      {isError && (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                          <AlertCircle size={12} /> Error
                        </span>
                      )}
                      {!integration && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                          Available
                        </span>
                      )}
                    </div>

                    {isConnected && integration?.last_sync_at && (
                      <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                        <Clock size={11} />
                        Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                      </div>
                    )}

                    <div className="mt-auto">
                      {isConnected ? (
                        <button
                          onClick={() => setConfirmDisconnect(integration.id)}
                          className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : API_KEY_PROVIDERS[template.integration_type] ? (
                        <button
                          onClick={() => setCredentialsModal(template.integration_type)}
                          className="w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Key size={14} /> Connect with API Key
                        </button>
                      ) : (
                        <button
                          onClick={() => connectPersonalOAuth(template.integration_type)}
                          className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </>)}

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
