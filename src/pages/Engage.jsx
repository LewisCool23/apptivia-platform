import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Building2, Sparkles, Radar, DollarSign, BookOpen, Phone, Activity } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import PipelineOperator from '../components/PipelineOperator';
import SignalProspecting from '../components/SignalProspecting';
import EngageDiscover from '../components/EngageDiscover';
import AccountIntelligence from '../components/AccountIntelligence';
import PlaybookBuilder from '../components/PlaybookBuilder';
import PromptLibrary from '../components/PromptLibrary';
import CallIntelligence from '../components/CallIntelligence';
import ActivityFeed from '../components/ActivityFeed';

const TABS = [
  { id: 'pipeline', label: 'Pipeline Operator', icon: DollarSign, description: 'Monitor deals, flag risks, AI forecasts' },
  { id: 'signals', label: 'Signal Prospecting', icon: Radar, description: 'Detect high-intent buying signals' },
  { id: 'calls', label: 'Call Intelligence', icon: Phone, description: 'Log calls, extract next steps & insights with AI' },
  { id: 'activity', label: 'Activity Feed', icon: Activity, description: 'Live timeline of team deal moves, calls, and badges' },
  { id: 'discover', label: 'Discover', icon: Search, description: 'AI-powered prospect & company research' },
  { id: 'accounts', label: 'Accounts', icon: Building2, description: 'Account-based intelligence & scoring' },
  { id: 'playbooks', label: 'Playbooks', icon: BookOpen, description: 'AI-generated sales playbooks' },
  { id: 'prompts', label: 'Prompt Library', icon: Sparkles, description: 'Outbound AI prompt templates' },
];

export default function Engage() {
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = TABS.map(t => t.id);
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'pipeline'
  );

  // Cross-tab context: allows Signal Prospecting to push a search into Discover
  const [discoverContext, setDiscoverContext] = useState(null);

  // Sync when URL query changes (deep links from other pages)
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const organizationId = profile?.organization_id || user?.organization_id || '';

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 md:p-6">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <Radar size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Apptivia Engage</h1>
              <p className="text-xs text-gray-500">AI-Powered Sales Intelligence & Pipeline Operations</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-gray-100 p-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.comingSoon && setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm'
                    : tab.comingSoon
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
                {tab.comingSoon && (
                  <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">Soon</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'pipeline' && (
            <PipelineOperator organizationId={organizationId} userId={user?.id} />
          )}
          {activeTab === 'signals' && (
            <SignalProspecting
              organizationId={organizationId}
              userId={user?.id}
              onNavigateDiscover={(ctx) => {
                setDiscoverContext(ctx);
                setActiveTab('discover');
              }}
            />
          )}
          {activeTab === 'calls' && (
            <CallIntelligence organizationId={organizationId} userId={user?.id} />
          )}
          {activeTab === 'activity' && (
            <ActivityFeed organizationId={organizationId} />
          )}
          {activeTab === 'discover' && (
            <EngageDiscover
              organizationId={organizationId}
              userId={user?.id}
              initialSearch={discoverContext}
              onInitialSearchConsumed={() => setDiscoverContext(null)}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountIntelligence organizationId={organizationId} userId={user?.id} />
          )}
          {activeTab === 'playbooks' && (
            <PlaybookBuilder organizationId={organizationId} userId={user?.id} />
          )}
          {activeTab === 'prompts' && (
            <PromptLibrary organizationId={organizationId} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
