import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Building2, Radar, DollarSign, Phone, Activity, UserPlus, X, ListOrdered, CalendarDays } from 'lucide-react';
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
import SavedContactsModal from '../components/SavedContactsModal';
import EngageActivityModal from '../components/EngageActivityModal';
import SignalOutreachModal from '../components/SignalOutreachModal';
import SavedBriefModal from '../components/SavedBriefModal';
import SequenceBuilder from '../components/SequenceBuilder';
import EngageCalendar from '../components/EngageCalendar';

const TABS = [
  { id: 'signals',  label: 'Signal Prospecting', icon: Radar,     description: 'Detect high-intent buying signals' },
  { id: 'discover', label: 'Discover',            icon: Search,    description: 'AI-powered prospect & company research' },
  { id: 'accounts', label: 'Accounts',            icon: Building2, description: 'Account-based intelligence & scoring' },
  { id: 'pipeline',   label: 'Pipeline Operator',   icon: DollarSign,  description: 'Monitor deals, flag risks, AI forecasts' },
  { id: 'calendar',   label: 'Calendar',             icon: CalendarDays, description: 'Synced calendar with meeting intelligence' },
];

const PANELS = [
  { id: 'dialpad',   icon: Phone,    label: 'Dialpad',       color: 'text-emerald-500' },
  { id: 'contacts',  icon: UserPlus, label: 'Contacts',      color: 'text-apptivia-coral' },
  { id: 'activity',  icon: Activity, label: 'Activity Feed', color: 'text-apptivia-ink' },
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
  const [contactsRefreshKey, setContactsRefreshKey] = useState(0);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [outreachTarget, setOutreachTarget] = useState(null); // { contact, signal? }
  const [briefTarget, setBriefTarget] = useState(null); // prospect object for SavedBriefModal

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

  // Broadcast active tab to Aaron AI for page-aware presets
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aaron-page-context', { detail: { tab: activeTab } }));
  }, [activeTab]);

  const organizationId = profile?.organization_id || user?.organization_id || '';
  const dialer = useTwilioDialer(organizationId, user?.id ?? '');

  const togglePanel = (id) => setActivePanel(prev => prev === id ? null : id);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-apptivia-paper p-4 md:p-6">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-apptivia-ink rounded-lg flex items-center justify-center shadow-lg">
              <Radar size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-apptivia-coral">Apptivia Engage</h1>
              <p className="text-xs text-apptivia-carbon-500">AI-Powered Sales Intelligence & Pipeline Operations</p>
            </div>
          </div>

          {/* Right-panel icon strip */}
          <div className="flex items-center gap-1 bg-white border border-apptivia-carbon-100 rounded-lg p-1 shadow-sm">
            {PANELS.map(({ id, icon: Icon, label, color }) => (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                title={label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  activePanel === id
                    ? 'bg-apptivia-carbon-100 shadow-inner'
                    : 'hover:bg-apptivia-paper'
                }`}
              >
                <Icon size={15} className={activePanel === id ? color : 'text-apptivia-carbon-400'} />
              </button>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-5 bg-white rounded-lg border border-apptivia-carbon-100 p-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-apptivia-coral text-white shadow-sm'
                    : 'text-apptivia-carbon-600 hover:bg-apptivia-paper hover:text-apptivia-ink'
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
              onContactSaved={() => setContactsRefreshKey(k => k + 1)}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountIntelligence
              organizationId={organizationId}
              userId={user?.id}
              initialAccountId={accountsContext?.accountId}
              onInitialAccountConsumed={() => setAccountsContext(null)}
              onNavigateDiscover={(ctx) => { setDiscoverContext(ctx); setActiveTab('discover'); }}
              onEmailContact={(contact) => setOutreachTarget({ contact })}
              onViewBrief={(prospect) => setBriefTarget(prospect)}
            />
          )}
          {activeTab === 'pipeline' && (
            <PipelineOperator organizationId={organizationId} userId={user?.id} />
          )}
          {activeTab === 'calendar' && (
            <EngageCalendar organizationId={organizationId} userId={user?.id} />
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
          <div className="fixed top-0 right-0 h-full w-[360px] bg-white shadow-2xl z-40 border-l border-apptivia-carbon-100 flex flex-col">
            {activePanel === 'dialpad' && (
              <EngageDialpadPanel
                onCall={dialer.startCall}
                isDeviceReady={dialer.isDeviceReady}
                onClose={() => setActivePanel(null)}
                userId={user?.id}
              />
            )}
            {activePanel === 'contacts' && (
              <EngageContactsPanel
                organizationId={organizationId}
                onCallContact={dialer.startCall}
                onClose={() => setActivePanel(null)}
                refreshKey={contactsRefreshKey}
                onSeeAll={() => setShowContactsModal(true)}
                onEmailContact={(contact) => setOutreachTarget({ contact })}
                onViewBrief={(prospect) => setBriefTarget(prospect)}
              />
            )}
            {activePanel === 'activity' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-apptivia-carbon-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-apptivia-ink" />
                    <h3 className="font-semibold text-apptivia-ink text-sm">Activity Feed</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowActivityModal(true)}
                      className="text-[10px] font-medium text-apptivia-coral hover:underline"
                    >
                      View All
                    </button>
                  <button
                    onClick={() => setActivePanel(null)}
                    className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors"
                  >
                    <X size={15} />
                  </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ActivityFeed organizationId={organizationId} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Saved Contacts Modal */}
      <SavedContactsModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        organizationId={organizationId}
        onCallContact={dialer.startCall}
        onResearchContact={(contact) => {
          setShowContactsModal(false);
          setDiscoverContext({ mode: 'prospect', query: contact.full_name || contact.first_name || '' });
          setActiveTab('discover');
        }}
        onDraftOutreach={(contact) => {
          setShowContactsModal(false);
          setOutreachTarget({ contact });
        }}
        onViewBrief={(prospect) => {
          setBriefTarget(prospect);
        }}
      />

      {/* Engage Activity Modal */}
      <EngageActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        organizationId={organizationId}
      />

      {/* Signal Outreach Modal — unified draft modal */}
      <SignalOutreachModal
        isOpen={!!outreachTarget}
        onClose={() => setOutreachTarget(null)}
        signal={outreachTarget?.signal || null}
        contact={outreachTarget?.contact || null}
        organizationId={organizationId}
      />

      {/* Saved Brief Modal — cached AI prospect briefs */}
      <SavedBriefModal
        isOpen={!!briefTarget}
        onClose={() => setBriefTarget(null)}
        prospect={briefTarget}
        organizationId={organizationId}
        onResearchComplete={() => setContactsRefreshKey(k => k + 1)}
      />

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
