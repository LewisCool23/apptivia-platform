import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Building2, Radar, DollarSign, Phone, Activity, UserPlus, X } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import PipelineOperator from '../components/PipelineOperator';
import SignalProspecting from '../components/SignalProspecting';
import EngageDiscover from '../components/EngageDiscover';
import AccountIntelligence from '../components/AccountIntelligence';
import ActivityFeed from '../components/ActivityFeed';
import { useTwilioDialer } from '../hooks/useTwilioDialer';
import TwilioDialerWidget from '../components/TwilioDialerWidget';
import EngageContactsPanel from '../components/EngageContactsPanel';
import EngageDialpadPanel from '../components/EngageDialpadPanel';

const TABS = [
  { id: 'signals',  label: 'Signal Prospecting', icon: Radar,     description: 'Detect high-intent buying signals' },
  { id: 'discover', label: 'Discover',            icon: Search,    description: 'AI-powered prospect & company research' },
  { id: 'accounts', label: 'Accounts',            icon: Building2, description: 'Account-based intelligence & scoring' },
  { id: 'pipeline', label: 'Pipeline Operator',   icon: DollarSign, description: 'Monitor deals, flag risks, AI forecasts' },
];

const PANELS = [
  { id: 'dialpad',   icon: Phone,    label: 'Dialpad',       color: 'text-emerald-500' },
  { id: 'contacts',  icon: UserPlus, label: 'Contacts',      color: 'text-blue-500' },
  { id: 'activity',  icon: Activity, label: 'Activity Feed', color: 'text-purple-500' },
];

export default function Engage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const dealFromUrl = searchParams.get('deal');
  const validTabs = TABS.map(t => t.id);
  const [activeTab, setActiveTab] = useState(
    dealFromUrl ? 'pipeline' :
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'signals'
  );
  const [activePanel, setActivePanel] = useState(null);

  // Cross-tab context
  const [discoverContext, setDiscoverContext] = useState(null);
  const [accountsContext, setAccountsContext] = useState(null);

  useEffect(() => {
    if (dealFromUrl) {
      setActiveTab('pipeline');
    } else if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, dealFromUrl]);

  const organizationId = profile?.organization_id || user?.organization_id || '';
  const dialer = useTwilioDialer(organizationId, user?.id ?? '');

  const togglePanel = (id) => setActivePanel(prev => prev === id ? null : id);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 md:p-6">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <Radar size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Apptivia Engage</h1>
              <p className="text-xs text-gray-500">AI-Powered Sales Intelligence & Pipeline Operations</p>
            </div>
          </div>

          {/* Right-panel icon strip */}
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
            {PANELS.map(({ id, icon: Icon, label, color }) => (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                title={label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  activePanel === id
                    ? 'bg-gray-100 shadow-inner'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Icon size={15} className={activePanel === id ? color : 'text-gray-400'} />
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-gray-100 p-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'signals' && (
            <SignalProspecting
              organizationId={organizationId}
              userId={user?.id}
              onCallContact={dialer.startCall}
              onNavigateDiscover={(ctx) => { setDiscoverContext(ctx); setActiveTab('discover'); }}
              onNavigateAccounts={(ctx) => { setAccountsContext(ctx); setActiveTab('accounts'); }}
            />
          )}
          {activeTab === 'discover' && (
            <EngageDiscover
              organizationId={organizationId}
              userId={user?.id}
              initialSearch={discoverContext}
              onInitialSearchConsumed={() => setDiscoverContext(null)}
              onCallContact={dialer.startCall}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountIntelligence
              organizationId={organizationId}
              userId={user?.id}
              initialAccountId={accountsContext?.accountId}
              onInitialAccountConsumed={() => setAccountsContext(null)}
            />
          )}
          {activeTab === 'pipeline' && (
            <PipelineOperator organizationId={organizationId} userId={user?.id} />
          )}
        </div>
      </div>

      {/* Right-panel drawer */}
      {activePanel && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/5"
            onClick={() => setActivePanel(null)}
          />
          <div className="fixed top-0 right-0 h-full w-[360px] bg-white shadow-2xl z-40 border-l border-gray-100 flex flex-col">
            {activePanel === 'dialpad' && (
              <EngageDialpadPanel
                onCall={dialer.startCall}
                isDeviceReady={dialer.isDeviceReady}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === 'contacts' && (
              <EngageContactsPanel
                organizationId={organizationId}
                onCallContact={dialer.startCall}
                onClose={() => setActivePanel(null)}
              />
            )}
            {activePanel === 'activity' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-purple-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Activity Feed</h3>
                  </div>
                  <button
                    onClick={() => setActivePanel(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ActivityFeed organizationId={organizationId} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Twilio floating call widget */}
      <TwilioDialerWidget
        callStatus={dialer.callStatus}
        activeContact={dialer.activeContact}
        callDurationSeconds={dialer.callDurationSeconds}
        isMuted={dialer.isMuted}
        onHangUp={dialer.hangUp}
        onToggleMute={dialer.toggleMute}
      />
    </DashboardLayout>
  );
}
