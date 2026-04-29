import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, CreditCard, Bell, Shield, Save, Search, X, UserPlus, Check, Plus, ChevronDown, ChevronRight, Maximize2, CalendarClock, FileText, Play, Pause, Trash2, Pencil, Send, Calendar, Clock, Mail, Layers, Database, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import PageActionBar from '../components/PageActionBar';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import { useNotifications } from '../contexts/NotificationContext';
import { backendFetch } from '../utils/backendFetch';
import { useTeamManagement } from '../hooks/useTeamManagement';
import CepConfigSection from '../components/CepConfigSection';
import SalesDnaConfigSection from '../components/SalesDnaConfigSection';
import ScheduleReportModal from '../components/ScheduleReportModal';
import { useKpiTemplates } from '../hooks/useKpiTemplates';
import KpiImportModal from '../components/KpiImportModal';
import { useTitles } from '../hooks/useTitles';
import ConfirmModal from '../components/ConfirmModal';
import { ROLES } from '../constants/roles';
import { INDUSTRY_OPTIONS } from '../components/onboarding/onboardingConstants';

function SignalTagField({ label, hint, items, value, onChange, onAdd, onRemove, placeholder, tagClass }) {
  return (
    <div>
      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-apptivia-carbon-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item, i) => (
          <span key={i} className={`inline-flex items-center gap-1 ${tagClass} text-xs font-medium px-2.5 py-1 rounded-full`}>
            {item}
            <button type="button" onClick={() => onRemove(i)} className="hover:opacity-70 leading-none"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="flex-1 border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
        />
        <button type="button" onClick={onAdd} className="px-3 py-2 bg-apptivia-carbon-100 rounded-lg hover:bg-apptivia-carbon-200 text-apptivia-carbon-600">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

const TIER_DISPLAY = { Basic: 'Starter', Pro: 'Pro', Enterprise: 'Enterprise' };
const TIER_SEAT_PRICES = { Basic: 19, Pro: 49, Enterprise: null };
const TIER_SUPPORT = { Basic: 'Email', Pro: 'Priority', Enterprise: 'Dedicated' };
const TIER_ORDER = ['Basic', 'Pro', 'Enterprise'];

function SubscriptionTab({ organization, members, teams, setMessage }) {
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    backendFetch('/api/billing/subscription', undefined, 'GET')
      .then(data => { if (!cancelled) { setBillingData(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const currentTier = billingData?.plan || organization?.subscription_plan || 'Pro';
  const status = billingData?.status || 'active';
  const userCount = billingData?.usage?.users || members.length;
  const seats = billingData?.seats || userCount;
  const pricePerSeat = billingData?.pricePerSeat ?? TIER_SEAT_PRICES[currentTier] ?? null;
  const monthlyTotal = pricePerSeat ? pricePerSeat * seats : null;
  const periodEnd = billingData?.periodEnd;
  const hasStripe = billingData?.hasStripe;

  const handleCheckout = async (plan) => {
    setActionLoading(true);
    try {
      const data = await backendFetch('/api/billing/checkout', { plan });
      if (data.url) { window.location.href = data.url; return; }
      if (data.error) setMessage({ type: 'error', text: data.error });
    } catch (err) { setMessage({ type: 'error', text: err.message || 'Failed to start checkout' }); }
    setActionLoading(false);
  };

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const data = await backendFetch('/api/billing/portal', {});
      if (data.url) { window.location.href = data.url; return; }
      if (data.error) setMessage({ type: 'error', text: data.error });
    } catch (err) { setMessage({ type: 'error', text: err.message || 'Failed to open billing portal' }); }
    setActionLoading(false);
  };

  const statusColor = status === 'active' ? 'bg-green-100 text-green-700' : status === 'trialing' ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' : status === 'past_due' ? 'bg-red-100 text-red-700' : 'bg-apptivia-carbon-100 text-apptivia-carbon-600';

  if (loading) return <div className="bg-white rounded-lg shadow-sm p-6"><div className="animate-pulse h-40 bg-apptivia-carbon-100 rounded-lg" /></div>;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Current Plan</h3>
        <div className="border rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{TIER_DISPLAY[currentTier] || currentTier} Plan</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}>
                  {status === 'active' ? 'Active' : status === 'trialing' ? 'Trial' : status === 'past_due' ? 'Past Due' : status === 'canceled' ? 'Canceled' : status}
                </span>
              </div>
              {periodEnd && <div className="text-sm text-apptivia-carbon-500 mt-1">Renews {new Date(periodEnd).toLocaleDateString()}</div>}
            </div>
            <div className="text-right">
              {pricePerSeat ? (
                <>
                  <div className="text-2xl font-bold">${pricePerSeat}<span className="text-sm font-normal text-apptivia-carbon-500">/seat/mo</span></div>
                  {monthlyTotal && <div className="text-sm text-apptivia-carbon-500">${monthlyTotal}/mo total ({seats} {seats === 1 ? 'seat' : 'seats'})</div>}
                </>
              ) : (
                <div className="text-2xl font-bold">Custom</div>
              )}
            </div>
          </div>
          <div className="border-t pt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-apptivia-carbon-600">Active Users</span><span className="font-medium">{userCount}</span></div>
            <div className="flex justify-between"><span className="text-apptivia-carbon-600">Seats</span><span className="font-medium">{seats}</span></div>
            <div className="flex justify-between"><span className="text-apptivia-carbon-600">Teams</span><span className="font-medium">{teams.length}</span></div>
            <div className="flex justify-between"><span className="text-apptivia-carbon-600">Support</span><span className="font-medium">{TIER_SUPPORT[currentTier] || 'Email'}</span></div>
          </div>
          {status === 'past_due' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Your payment failed. Please update your payment method to avoid service interruption.
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {hasStripe ? (
            <button onClick={handlePortal} disabled={actionLoading} className="px-6 py-2 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral disabled:opacity-50">
              {actionLoading ? 'Loading...' : 'Manage Billing'}
            </button>
          ) : (
            <button onClick={() => handleCheckout(currentTier)} disabled={actionLoading} className="px-6 py-2 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral disabled:opacity-50">
              {actionLoading ? 'Loading...' : 'Set Up Billing'}
            </button>
          )}
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIER_ORDER.map(tier => {
            const isCurrent = tier === currentTier;
            const isUpgrade = (({ Basic: 1, Pro: 2, Enterprise: 3 })[tier] || 0) > (({ Basic: 1, Pro: 2, Enterprise: 3 })[currentTier] || 0);
            const features = {
              Basic: ['Scorecard & Wallboard', 'Aaron AI Chatbot', 'CRM Integrations', 'CSV Upload', 'Email support'],
              Pro: ['Everything in Starter', 'Coach & Coaching Plans', 'Contests & Engage', 'Signal Prospecting', 'Advanced Analytics', 'Priority support'],
              Enterprise: ['Everything in Pro', 'Custom integrations', 'SSO & audit log', 'API access', 'Dedicated support', 'SLA guarantee'],
            };
            return (
              <div key={tier} className={`border rounded-lg p-5 ${isCurrent ? 'border-apptivia-coral bg-apptivia-coral-tone-50/30 ring-1 ring-blue-200' : 'border-apptivia-carbon-200'} ${tier === 'Pro' && !isCurrent ? 'border-apptivia-carbon-300' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-lg">{TIER_DISPLAY[tier]}</h4>
                  {isCurrent && <span className="text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2 py-0.5 rounded-full">Current</span>}
                  {tier === 'Pro' && !isCurrent && <span className="text-xs bg-apptivia-carbon-100 text-apptivia-ink px-2 py-0.5 rounded-full">Popular</span>}
                </div>
                <div className="text-2xl font-bold mb-3">{TIER_SEAT_PRICES[tier] ? `$${TIER_SEAT_PRICES[tier]}` : 'Custom'}{TIER_SEAT_PRICES[tier] && <span className="text-sm font-normal text-apptivia-carbon-500">/seat/mo</span>}</div>
                <ul className="space-y-1.5 text-sm text-apptivia-carbon-600 mb-4">
                  {(features[tier] || []).map((f, i) => <li key={i} className="flex items-start gap-1.5"><Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />{f}</li>)}
                </ul>
                {!isCurrent && isUpgrade && tier !== 'Enterprise' && (
                  <button onClick={() => handleCheckout(tier)} disabled={actionLoading} className="w-full py-2 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral text-sm disabled:opacity-50">
                    {actionLoading ? 'Loading...' : `Upgrade to ${TIER_DISPLAY[tier]}`}
                  </button>
                )}
                {tier === 'Enterprise' && !isCurrent && (
                  <a href="mailto:support@apptivia.app?subject=Enterprise Plan Inquiry" className="block w-full py-2 text-center border border-apptivia-carbon-300 rounded-lg hover:bg-apptivia-paper text-sm">Contact Sales</a>
                )}
                {isCurrent && <div className="text-center text-sm text-apptivia-carbon-400 py-2">Your current plan</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, role } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const titles = useTitles(profile?.organization_id);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general');

  // Sync tab when navigating to this page with a ?tab= param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

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
  const [members, setMembers] = useState([]);
  const teamHook = useTeamManagement();

  // Add Existing Users modal state
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [unassignedUsers, setUnassignedUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [assigningUsers, setAssigningUsers] = useState(false);
  const [addUsersSearch, setAddUsersSearch] = useState('');

  // Invite Members modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('power_user');
  const [inviteTitle, setInviteTitle] = useState('');
  const [inviteTitleKey, setInviteTitleKey] = useState('');
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  // Add Team — delegated to teamHook

  // Edit Member modal state
  const [editingMember, setEditingMember] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editSecondaryRole, setEditSecondaryRole] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSegment, setEditSegment] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  // Delete Team / Remove Member state
  const [deleteTeamTarget, setDeleteTeamTarget] = useState(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Scheduled Reports state
  const [scheduledReports, setScheduledReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);

  const isAdmin = role === ROLES.ADMIN;
  const isManagerOrAbove = [ROLES.ADMIN, ROLES.MANAGER].includes(role);

  // 4C: KPI Role Templates
  const kpiTemplates = useKpiTemplates(profile?.organization_id || null);
  const [applyingTemplate, setApplyingTemplate] = useState(null);

  // Data Import state
  const [showKpiImport, setShowKpiImport] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [loadingImportHistory, setLoadingImportHistory] = useState(false);

  useEffect(() => {
    // Skip reloading while onboarding wizard is open — refreshProfile() during
    // step 1 changes organization_id which would re-trigger loadData mid-wizard
    if (showOnboarding) return;
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

      // Load organization and members in parallel; teams via shared hook
      const [orgResult, membersResult] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.organization_id).single(),
        supabase.from('profiles').select('*').eq('organization_id', profile.organization_id).order('first_name'),
      ]);

      if (orgResult.error) throw orgResult.error;
      setOrganization(orgResult.data);
      setMembers(membersResult.data || []);
      await teamHook.loadTeams();
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load organization data' });
    } finally {
      setLoading(false);
    }
  };

  // ── Scheduled Reports ──────────────────────────
  const loadScheduledReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const data = await backendFetch('/api/scheduled-reports', undefined, 'GET');
      setScheduledReports(Array.isArray(data?.reports) ? data.reports : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load scheduled reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports' && organization?.id) loadScheduledReports();
  }, [activeTab, organization?.id, loadScheduledReports]);

  // Load import history when Data Import tab is active
  const loadImportHistory = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingImportHistory(true);
    try {
      const { data, error } = await supabase
        .from('kpi_import_jobs')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error) setImportHistory(data || []);
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoadingImportHistory(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (activeTab === 'data' && organization?.id) loadImportHistory();
  }, [activeTab, organization?.id, loadImportHistory]);

  const handleToggleReport = async (report) => {
    try {
      await backendFetch(`/api/scheduled-reports/${report.id}`, { active: !report.active }, 'PATCH');
      loadScheduledReports();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle report' });
    }
  };

  const handleDeleteReport = async (id) => {
    if (!window.confirm('Delete this scheduled report? This cannot be undone.')) return;
    try {
      await backendFetch(`/api/scheduled-reports/${id}`, undefined, 'DELETE');
      loadScheduledReports();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete report' });
    }
  };

  const handleSendNow = async (id) => {
    if (!window.confirm('Send this report immediately?')) return;
    try {
      await backendFetch(`/api/scheduled-reports/${id}/send-now`, {}, 'POST');
      setMessage({ type: 'success', text: 'Report sent successfully!' });
      loadScheduledReports();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to send report' });
    }
  };

  const REPORT_TYPE_LABELS = {
    scorecard: 'Scorecard Summary',
    analytics: 'Analytics Report',
    coach: 'Coaching Insights',
    contests: 'Contest Results',
    team_performance: 'Team Performance',
  };

  const FREQUENCY_LABELS = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
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

  // Signal prospecting config — stored in organizations.signal_config
  const [signalConfig, setSignalConfig] = useState({
    pain_points: [],
    solution_keywords: [],
    job_titles_to_track: [],
    competitors: [],
    tech_stack_churning: [],
  });
  const [newSignalItems, setNewSignalItems] = useState({
    pain_point: '',
    solution_keyword: '',
    job_title: '',
    competitor: '',
    churn_tech: '',
  });

  const addSignalItem = (field, inputKey) => {
    const value = newSignalItems[inputKey];
    if (!value.trim()) return;
    setSignalConfig(c => ({ ...c, [field]: [...c[field], value.trim()] }));
    setNewSignalItems(s => ({ ...s, [inputKey]: '' }));
  };

  const removeSignalItem = (field, index) => {
    setSignalConfig(c => ({ ...c, [field]: c[field].filter((_, i) => i !== index) }));
  };

  // ── Wallboard config ────────────────────────────
  const [wallboardSettings, setWallboardSettings] = useState({
    slides: {
      leaderboard:  { enabled: true, duration: 15 },
      spotlight:    { enabled: true, duration: 15 },
      contests:     { enabled: true, duration: 15 },
      team_stats:   { enabled: true, duration: 15 },
      badges:       { enabled: true, duration: 15 },
      activity:     { enabled: true, duration: 15 },
      achievements: { enabled: true, duration: 15 },
      goals:        { enabled: true, duration: 15 },
    },
    celebrations: true,
  });

  // ── Signal Library management ────────────────────────────

  const [signalLibrary, setSignalLibrary] = useState({ universalDefs: [], orgConfigs: [] });
  const [loadingSignalLibrary, setLoadingSignalLibrary] = useState(false);
  const [savingSignal, setSavingSignal] = useState(false);
  const [showAddSignalForm, setShowAddSignalForm] = useState(false);
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState({
    buyerIntent: true,
    competitorIntel: true,
    customSignals: true,
    universalCompany: false,
    universalInterest: false,
    salesMethodology: false,
    salesProcess: false,
  });
  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [newCustomSignal, setNewCustomSignal] = useState({
    signal_key: '', signal_name: '', category: 'buyer_intent',
    description: '', default_score: 60, default_strength: 'medium',
  });

  // ── Feedback Insights ────────────────────────────
  const [feedbackInsights, setFeedbackInsights] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const loadSignalLibrary = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingSignalLibrary(true);
    try {
      const [{ data: defs }, { data: configs }] = await Promise.all([
        supabase.from('engage_signal_definitions').select('*').eq('is_universal', true).eq('is_active', true).order('sort_order'),
        supabase.from('engage_org_signal_configs').select('*').eq('organization_id', organization.id),
      ]);
      setSignalLibrary({ universalDefs: defs || [], orgConfigs: configs || [] });
    } finally {
      setLoadingSignalLibrary(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (organization?.id) loadSignalLibrary();
  }, [organization?.id, loadSignalLibrary]);

  const loadFeedbackInsights = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingFeedback(true);
    try {
      const { data } = await supabase
        .from('feedback_signals')
        .select('feature_area, helpful')
        .eq('organization_id', organization.id);
      if (!data || data.length === 0) { setFeedbackInsights(null); return; }
      const total = data.length;
      const helpfulCount = data.filter(r => r.helpful).length;
      const overallPct = Math.round((helpfulCount / total) * 100);
      const byArea = {};
      data.forEach(r => {
        if (!byArea[r.feature_area]) byArea[r.feature_area] = { total: 0, helpful: 0 };
        byArea[r.feature_area].total++;
        if (r.helpful) byArea[r.feature_area].helpful++;
      });
      const areaLabels = {
        coaching_opportunity: 'Coaching Opportunities',
        performance_insight: 'Performance Insights',
        playbook_insight: 'Manager Playbook',
        ai_coaching_plan: 'AI Coaching Plans',
        kpi_watchdog: 'KPI Watchdog',
        '1on1_prep': '1:1 Meeting Prep',
      };
      const breakdown = Object.entries(byArea)
        .map(([area, stats]) => ({
          area,
          label: areaLabels[area] || area.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          total: stats.total,
          helpful: stats.helpful,
          pct: Math.round((stats.helpful / stats.total) * 100),
        }))
        .sort((a, b) => a.pct - b.pct);
      setFeedbackInsights({ total, helpfulCount, overallPct, breakdown });
    } catch (e) {
      console.warn('Failed to load feedback insights:', e);
    } finally {
      setLoadingFeedback(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (organization?.id) loadFeedbackInsights();
  }, [organization?.id, loadFeedbackInsights]);

  const toggleUniversalSignal = async (defId, currentEnabled) => {
    setSavingSignal(true);
    try {
      const existing = signalLibrary.orgConfigs.find(c => c.signal_definition_id === defId);
      if (existing) {
        await supabase.from('engage_org_signal_configs').update({ is_enabled: !currentEnabled }).eq('id', existing.id);
      } else {
        // No override row yet — create one to disable it (default is enabled)
        await supabase.from('engage_org_signal_configs').insert({
          organization_id: organization.id,
          signal_definition_id: defId,
          is_enabled: false,
        });
      }
      await loadSignalLibrary();
    } finally {
      setSavingSignal(false);
    }
  };

  const addCustomSignal = async () => {
    if (!newCustomSignal.signal_key.trim() || !newCustomSignal.signal_name.trim()) return;
    setSavingSignal(true);
    try {
      await supabase.from('engage_org_signal_configs').insert({
        organization_id: organization.id,
        signal_key: newCustomSignal.signal_key.trim().toLowerCase().replace(/\s+/g, '_'),
        signal_name: newCustomSignal.signal_name.trim(),
        category: newCustomSignal.category,
        description: newCustomSignal.description.trim() || null,
        default_score: parseInt(newCustomSignal.default_score),
        default_strength: newCustomSignal.default_strength,
      });
      setNewCustomSignal({ signal_key: '', signal_name: '', category: 'buyer_intent', description: '', default_score: 60, default_strength: 'medium' });
      setShowAddSignalForm(false);
      await loadSignalLibrary();
    } finally {
      setSavingSignal(false);
    }
  };

  const deleteCustomSignal = async (configId) => {
    setSavingSignal(true);
    try {
      await supabase.from('engage_org_signal_configs').delete().eq('id', configId);
      await loadSignalLibrary();
    } finally {
      setSavingSignal(false);
    }
  };

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

  // Sync signalConfig when organization row loads
  useEffect(() => {
    if (!organization?.signal_config) return;
    const c = typeof organization.signal_config === 'string'
      ? JSON.parse(organization.signal_config)
      : organization.signal_config;
    setSignalConfig({
      pain_points: c.pain_points || [],
      solution_keywords: c.solution_keywords || [],
      job_titles_to_track: c.job_titles_to_track || [],
      competitors: c.competitors || [],
      tech_stack_churning: c.tech_stack_churning || [],
    });
  }, [organization?.id]);

  // Sync wallboardSettings when organization row loads
  useEffect(() => {
    if (!organization?.settings?.wallboard) return;
    const wb = organization.settings.wallboard;
    setWallboardSettings(prev => ({
      slides: { ...prev.slides, ...(wb.slides || {}) },
      celebrations: wb.celebrations !== false,
    }));
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
          signal_config: signalConfig,
          settings: { ...(organization.settings || {}), wallboard: wallboardSettings },
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

  // ── Invite Members helpers ─────────────────────────────
  const handleInviteMembers = async () => {
    const emails = inviteEmails.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setInviteSending(true);
    try {
      const result = await backendFetch('/api/users/invite', {
        emails,
        role: inviteRole,
        ...(inviteTitle ? { title: inviteTitle } : {}),
        ...(inviteTitleKey ? { title_key: inviteTitleKey } : {}),
        ...(inviteTeamId ? { team_id: inviteTeamId } : {}),
      });
      const { invited = 0, skipped = 0, errors: inviteErrors = [] } = result;
      setShowInviteModal(false);
      setInviteEmails('');
      setInviteRole('power_user');
      setInviteTitle('');
      setInviteTitleKey('');
      setInviteTeamId('');
      const parts = [`${invited} invitation(s) sent`];
      if (skipped > 0) parts.push(`${skipped} skipped (already in org)`);
      if (inviteErrors.length > 0) parts.push(`${inviteErrors.length} failed: ${inviteErrors.join('; ')}`);
      setMessage({ type: inviteErrors.length > 0 ? 'warning' : 'success', text: parts.join(', ') });
      await loadData();
    } catch (err) {
      console.error('Invite error:', err);
      setMessage({ type: 'error', text: 'Failed to send invitations: ' + err.message });
    } finally {
      setInviteSending(false);
    }
  };

  // ── Add Team (via shared hook) ────────────────────────
  const handleAddTeam = async () => {
    const teamName = teamHook.newTeamName.trim();
    const result = await teamHook.handleAddTeam();
    if (result.success) {
      setMessage({ type: 'success', text: `Team "${teamName}" created` });
    } else {
      setMessage({ type: 'error', text: 'Failed to create team: ' + (result.error || '') });
    }
  };

  // ── Edit Member helpers ───────────────────────────────
  const openEditMember = (member) => {
    setEditingMember(member);
    setEditRole(member.role || 'power_user');
    setEditSecondaryRole(member.secondary_role || '');
    setEditTeamId(member.team_id || '');
    setEditTitle(member.title || '');
    setEditSegment(member.segment || '');
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      // Auto-resolve department from the selected team
      let department = null;
      if (editTeamId) {
        const team = teamHook.teams.find(t => t.id === editTeamId);
        if (team?.department_id) {
          const { data: dept } = await supabase.from('departments').select('name').eq('id', team.department_id).maybeSingle();
          department = dept?.name || null;
        }
      }

      const { error } = await supabase.from('profiles').update({
        role: editRole,
        secondary_role: editSecondaryRole || null,
        team_id: editTeamId || null,
        title: editTitle || null,
        segment: editSegment || null,
        department: department,
      }).eq('id', editingMember.id);
      if (error) throw error;
      setEditingMember(null);
      setMessage({ type: 'success', text: 'Member updated successfully' });
      await loadData();
    } catch (err) {
      console.error('Edit member error:', err);
      setMessage({ type: 'error', text: 'Failed to update member: ' + err.message });
    } finally {
      setSavingMember(false);
    }
  };

  // ── Delete Team handler ───────────────────────────────
  const handleDeleteTeam = async () => {
    if (!deleteTeamTarget) return;
    setDeleteLoading(true);
    try {
      const result = await teamHook.handleDeleteTeam(deleteTeamTarget.id);
      if (!result.success) throw new Error(result.error);
      setDeleteTeamTarget(null);
      setMessage({ type: 'success', text: `Team "${deleteTeamTarget.name}" deleted. Members have been unassigned.` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete team: ' + err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Remove Member handler ──────────────────────────────
  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        organization_id: null,
        team_id: null,
      }).eq('id', removeMemberTarget.id);
      if (error) throw error;
      // Clean up pending invitations
      await supabase.from('invitations')
        .delete()
        .eq('email', removeMemberTarget.email)
        .eq('status', 'pending');
      setRemoveMemberTarget(null);
      setMessage({ type: 'success', text: `${removeMemberTarget.first_name ? removeMemberTarget.first_name + ' ' + removeMemberTarget.last_name : removeMemberTarget.email} removed from organization` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove member: ' + err.message });
    } finally {
      setDeleteLoading(false);
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
          <Shield size={48} className="mx-auto text-apptivia-carbon-300 mb-3" />
          <h2 className="text-xl font-semibold text-apptivia-carbon-700 mb-2">Admin Access Required</h2>
          <p className="text-apptivia-carbon-500">You don't have permission to access organization settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-apptivia-carbon-500">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Organization Settings</h1>
            <p className="text-apptivia-carbon-500 text-sm">Manage your organization and team settings</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={14} /></button>
              )}
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
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div>
                </div>
              )}
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
              { id: 'reports', label: 'Reports', icon: CalendarClock },
              ...(isManagerOrAbove ? [{ id: 'kpi_templates', label: 'KPI Templates', icon: Layers }] : []),
              ...(isAdmin ? [{ id: 'data', label: 'Data Import', icon: Database }] : []),
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-b-2 border-apptivia-coral text-apptivia-coral'
                    : 'text-apptivia-carbon-600 hover:text-apptivia-ink'
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
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={organization?.name || ''}
                      onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      Industry
                    </label>
                    <select
                      value={organization?.industry || ''}
                      onChange={(e) => setOrganization({ ...organization, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select industry</option>
                      {INDUSTRY_OPTIONS.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      Primary Contact Name
                    </label>
                    <input
                      type="text"
                      value={organization?.primary_contact_name || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                      Primary Contact Email
                    </label>
                    <input
                      type="email"
                      value={organization?.primary_contact_email || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* ICP Configuration */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">ICP Configuration</h3>
                    <p className="text-xs text-apptivia-carbon-500 mt-0.5">Define your Ideal Customer Profile. Apptivia scores accounts 0–100 based on how well they match these criteria.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-apptivia-carbon-600">Enable ICP Scoring</span>
                    <div
                      onClick={() => setIcpConfig(c => ({ ...c, enabled: !c.enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${icpConfig.enabled ? 'bg-apptivia-coral' : 'bg-apptivia-carbon-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${icpConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                {icpConfig.enabled && (
                  <div className="space-y-4 bg-apptivia-coral-tone-50/50 border border-apptivia-coral-tone-100 rounded-lg p-4">
                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Target Industries <span className="text-apptivia-carbon-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_industries}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_industries: e.target.value }))}
                        placeholder="e.g. SaaS, Financial Services, Technology"
                        className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Min Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_min}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_min: e.target.value }))}
                          placeholder="e.g. 50"
                          className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Max Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_max}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_max: e.target.value }))}
                          placeholder="e.g. 5000"
                          className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Min Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_min_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_min_m: e.target.value }))}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Max Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_max_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_max_m: e.target.value }))}
                          placeholder="e.g. 500"
                          className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Target Technologies <span className="text-apptivia-carbon-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_technologies}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_technologies: e.target.value }))}
                        placeholder="e.g. Salesforce, HubSpot, Outreach, Slack"
                        className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <p className="text-xs text-apptivia-carbon-400">Scoring weights: Industry 30% · Headcount 25% · Revenue 25% · Tech Stack 20%</p>
                  </div>
                )}
              </div>

              {/* Signal Prospecting Configuration */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Signal Prospecting Configuration</h3>
                    <p className="text-xs text-apptivia-carbon-500 mt-0.5">Define what Apptivia Engage looks for when scanning for buyer intent signals. Reps will use these settings when running a signal scan.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAddSignalForm(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        showAddSignalForm
                          ? 'bg-apptivia-carbon-200 text-apptivia-carbon-700 hover:bg-apptivia-carbon-300'
                          : 'bg-apptivia-coral text-white hover:bg-apptivia-coral'
                      }`}
                    >
                      <Plus size={14} />
                      {showAddSignalForm ? 'Cancel' : 'Add Custom Signal'}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 bg-cyan-50/40 border border-cyan-100 rounded-lg p-4">
                  {/* Buyer Intent — collapsible */}
                  <div className="rounded-lg border border-cyan-200/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('buyerIntent')}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-cyan-50/80 hover:bg-cyan-100/60 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-cyan-800 uppercase tracking-wide">Buyer Intent</h4>
                      {expandedSections.buyerIntent ? <ChevronDown size={14} className="text-cyan-500" /> : <ChevronRight size={14} className="text-cyan-500" />}
                    </button>
                    {expandedSections.buyerIntent && (
                      <div className="px-4 py-3 space-y-4 bg-white/50">
                        <SignalTagField
                          label="Pain Points You Solve"
                          hint="Problems your product addresses — we'll find companies expressing these"
                          items={signalConfig.pain_points}
                          value={newSignalItems.pain_point}
                          onChange={(v) => setNewSignalItems(s => ({ ...s, pain_point: v }))}
                          onAdd={() => addSignalItem('pain_points', 'pain_point')}
                          onRemove={(i) => removeSignalItem('pain_points', i)}
                          placeholder="e.g. disconnected sales tools, no rep visibility"
                          tagClass="bg-emerald-100 text-emerald-700"
                        />
                        <SignalTagField
                          label="Solution Keywords"
                          hint="What buyers search for when looking for your solution"
                          items={signalConfig.solution_keywords}
                          value={newSignalItems.solution_keyword}
                          onChange={(v) => setNewSignalItems(s => ({ ...s, solution_keyword: v }))}
                          onAdd={() => addSignalItem('solution_keywords', 'solution_keyword')}
                          onRemove={(i) => removeSignalItem('solution_keywords', i)}
                          placeholder="e.g. sales gamification, SDR coaching software"
                          tagClass="bg-cyan-100 text-cyan-700"
                        />
                        <SignalTagField
                          label="Job Titles That Signal Need"
                          hint="Companies hiring these roles likely need your product"
                          items={signalConfig.job_titles_to_track}
                          value={newSignalItems.job_title}
                          onChange={(v) => setNewSignalItems(s => ({ ...s, job_title: v }))}
                          onAdd={() => addSignalItem('job_titles_to_track', 'job_title')}
                          onRemove={(i) => removeSignalItem('job_titles_to_track', i)}
                          placeholder="e.g. VP Sales, SDR Manager, RevOps"
                          tagClass="bg-apptivia-coral-tone-50 text-apptivia-coral"
                        />
                      </div>
                    )}
                  </div>
                  {/* Competitor Intelligence — collapsible */}
                  <div className="rounded-lg border border-red-200/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('competitorIntel')}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50/60 hover:bg-red-100/40 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Competitor Intelligence</h4>
                      {expandedSections.competitorIntel ? <ChevronDown size={14} className="text-red-400" /> : <ChevronRight size={14} className="text-red-400" />}
                    </button>
                    {expandedSections.competitorIntel && (
                      <div className="px-4 py-3 space-y-4 bg-white/50">
                        <SignalTagField
                          label="Competitors to Track"
                          items={signalConfig.competitors}
                          value={newSignalItems.competitor}
                          onChange={(v) => setNewSignalItems(s => ({ ...s, competitor: v }))}
                          onAdd={() => addSignalItem('competitors', 'competitor')}
                          onRemove={(i) => removeSignalItem('competitors', i)}
                          placeholder="e.g. Ambition, Gong, Outreach, Salesloft"
                          tagClass="bg-red-100 text-red-700"
                        />
                        <SignalTagField
                          label="Detect Churn From (Tech/Competitors)"
                          hint="Find companies leaving these products — prime prospects"
                          items={signalConfig.tech_stack_churning}
                          value={newSignalItems.churn_tech}
                          onChange={(v) => setNewSignalItems(s => ({ ...s, churn_tech: v }))}
                          onAdd={() => addSignalItem('tech_stack_churning', 'churn_tech')}
                          onRemove={(i) => removeSignalItem('tech_stack_churning', i)}
                          placeholder="e.g. Ambition, Hoopla, LevelEleven"
                          tagClass="bg-orange-100 text-orange-700"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Signal Library */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Signal Library</h3>
                  <p className="text-xs text-apptivia-carbon-500 mt-0.5">
                    Universal signals are available to all orgs. Toggle off any that aren't relevant.
                    Add custom signals specific to your ICP and what you sell.
                  </p>
                </div>

                {loadingSignalLibrary ? (
                  <p className="text-sm text-apptivia-carbon-400">Loading signal library...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Add custom signal form — appears at top of library */}
                    {showAddSignalForm && (
                      <div className="border border-apptivia-coral-tone-100 rounded-lg p-4 bg-apptivia-coral-tone-50/40 space-y-3">
                        <h4 className="text-sm font-semibold text-apptivia-carbon-700">New Custom Signal</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Signal Name *</label>
                            <input
                              type="text"
                              value={newCustomSignal.signal_name}
                              onChange={e => setNewCustomSignal(s => ({ ...s, signal_name: e.target.value }))}
                              placeholder="e.g. Researching Sales Tools"
                              className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Signal Key * <span className="text-apptivia-carbon-400 font-normal">(unique ID)</span></label>
                            <input
                              type="text"
                              value={newCustomSignal.signal_key}
                              onChange={e => setNewCustomSignal(s => ({ ...s, signal_key: e.target.value }))}
                              placeholder="e.g. researching_sales_tools"
                              className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Category</label>
                            <select
                              value={newCustomSignal.category}
                              onChange={e => setNewCustomSignal(s => ({ ...s, category: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="buyer_intent">Buyer Intent</option>
                              <option value="interest">Interest</option>
                              <option value="company_event">Company Event</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Default Score (0–100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newCustomSignal.default_score}
                              onChange={e => setNewCustomSignal(s => ({ ...s, default_score: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Strength</label>
                            <select
                              value={newCustomSignal.default_strength}
                              onChange={e => setNewCustomSignal(s => ({ ...s, default_strength: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="very_high">Very High</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Description</label>
                          <input
                            type="text"
                            value={newCustomSignal.description}
                            onChange={e => setNewCustomSignal(s => ({ ...s, description: e.target.value }))}
                            placeholder="What this signal means and why it matters"
                            className="w-full px-3 py-1.5 border border-apptivia-carbon-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowAddSignalForm(false)} className="px-3 py-1.5 text-sm text-apptivia-carbon-600 hover:text-apptivia-ink">Cancel</button>
                          <button
                            type="button"
                            onClick={addCustomSignal}
                            disabled={savingSignal || !newCustomSignal.signal_name.trim() || !newCustomSignal.signal_key.trim()}
                            className="px-4 py-1.5 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral disabled:opacity-50"
                          >
                            {savingSignal ? 'Saving...' : 'Add Signal'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Custom signals for this org — collapsible, expanded by default */}
                    {(() => {
                      const customs = signalLibrary.orgConfigs.filter(c => !c.signal_definition_id);
                      const catLabels = { buyer_intent: 'Buyer Intent', interest: 'Interest', company_event: 'Company / Trigger Events', universal: 'Universal' };
                      const catColors = { buyer_intent: 'purple', interest: 'cyan', company_event: 'amber', universal: 'gray' };
                      return (
                        <div className="rounded-lg border border-apptivia-carbon-300 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleSection('customSignals')}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-apptivia-carbon-100/60 hover:bg-apptivia-carbon-100/50 transition-colors"
                          >
                            <h4 className="text-xs font-bold text-apptivia-ink uppercase tracking-wide">
                              Custom Signals — This Org Only ({customs.length})
                            </h4>
                            {expandedSections.customSignals ? <ChevronDown size={14} className="text-apptivia-ink" /> : <ChevronRight size={14} className="text-apptivia-ink" />}
                          </button>
                          {expandedSections.customSignals && (
                            <div className="px-3 py-2">
                              {customs.length === 0 ? (
                                <p className="text-xs text-apptivia-carbon-400 italic px-1 py-2">No custom signals yet. Click "Add Custom Signal" above to create one.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {customs.map(cfg => {
                                    const colorMap = { purple: 'bg-apptivia-carbon-100 border-apptivia-carbon-300', cyan: 'bg-cyan-50 border-cyan-100', amber: 'bg-amber-50 border-amber-100', gray: 'bg-apptivia-paper border-apptivia-carbon-200' };
                                    const badgeMap = { purple: 'bg-apptivia-carbon-100 text-apptivia-ink', cyan: 'bg-cyan-100 text-cyan-700', amber: 'bg-amber-100 text-amber-700', gray: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' };
                                    const col = catColors[cfg.category] || 'gray';
                                    return (
                                      <div key={cfg.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colorMap[col]}`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-apptivia-ink">{cfg.signal_name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeMap[col]}`}>{catLabels[cfg.category]}</span>
                                          </div>
                                          {cfg.description && <p className="text-xs text-apptivia-carbon-500 mt-0.5 truncate">{cfg.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-3 ml-3 shrink-0">
                                          <span className="text-xs text-apptivia-carbon-400">Score {cfg.default_score}</span>
                                          <button
                                            type="button"
                                            onClick={() => !savingSignal && deleteCustomSignal(cfg.id)}
                                            disabled={savingSignal}
                                            className="text-apptivia-carbon-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Universal signals grouped by category — collapsible, collapsed by default */}
                    {[
                      { key: 'company_event', label: 'Company / Trigger Events', color: 'amber', stateKey: 'universalCompany' },
                      { key: 'interest', label: 'Interest Signals', color: 'blue', stateKey: 'universalInterest' },
                    ].map(({ key, label, color, stateKey }) => {
                      const defs = signalLibrary.universalDefs.filter(d => d.category === key);
                      if (!defs.length) return null;
                      const isExpanded = expandedSections[stateKey];
                      const borderColor = color === 'amber' ? 'border-amber-200' : 'border-apptivia-coral-tone-100';
                      const bgColor = color === 'amber' ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'bg-apptivia-coral-tone-50/60 hover:bg-apptivia-coral-tone-50/50';
                      const textColor = color === 'amber' ? 'text-amber-700' : 'text-apptivia-coral';
                      const chevronColor = color === 'amber' ? 'text-amber-400' : 'text-apptivia-coral-tone-300';
                      return (
                        <div key={key} className={`rounded-lg border ${borderColor} overflow-hidden`}>
                          <button
                            type="button"
                            onClick={() => toggleSection(stateKey)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 ${bgColor} transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold uppercase tracking-wide ${textColor}`}>
                                Universal — {label}
                              </h4>
                              <span className="text-[10px] text-apptivia-carbon-400">({defs.length})</span>
                            </div>
                            {isExpanded ? <ChevronDown size={14} className={chevronColor} /> : <ChevronRight size={14} className={chevronColor} />}
                          </button>
                          {isExpanded && (
                            <div className="px-3 py-2 space-y-1.5">
                              {defs.map(def => {
                                const override = signalLibrary.orgConfigs.find(c => c.signal_definition_id === def.id);
                                const isEnabled = override ? override.is_enabled : true;
                                return (
                                  <div key={def.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isEnabled ? 'bg-white border-apptivia-carbon-200' : 'bg-apptivia-paper border-apptivia-carbon-100 opacity-60'}`}>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium text-apptivia-ink">{def.signal_name}</span>
                                      {def.description && <p className="text-xs text-apptivia-carbon-500 mt-0.5 truncate">{def.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-3 ml-3 shrink-0">
                                      <span className="text-xs text-apptivia-carbon-400">Score {def.default_score}</span>
                                      <div
                                        onClick={() => !savingSignal && toggleUniversalSignal(def.id, isEnabled)}
                                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${isEnabled ? 'bg-apptivia-coral' : 'bg-apptivia-carbon-300'} ${savingSignal ? 'opacity-50 pointer-events-none' : ''}`}
                                      >
                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sales DNA — Methodology, Qualification & Sales Process */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Sales DNA</h3>
                  <p className="text-xs text-apptivia-carbon-500 mt-0.5">
                    Define how your team sells, qualifies deals, and manages the sales process. This drives all AI coaching recommendations.
                  </p>
                </div>
                <div className="space-y-3">
                  {/* Methodology & Qualification — collapsible */}
                  <div className="rounded-lg border border-apptivia-coral-tone-100/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('salesMethodology')}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-apptivia-coral-tone-50/80 hover:bg-apptivia-coral-tone-50/60 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-apptivia-coral-tone-700 uppercase tracking-wide">Methodology & Qualification</h4>
                      {expandedSections.salesMethodology ? <ChevronDown size={14} className="text-apptivia-coral" /> : <ChevronRight size={14} className="text-apptivia-coral" />}
                    </button>
                    {expandedSections.salesMethodology && (
                      <div className="px-4 py-4 bg-white/50">
                        <SalesDnaConfigSection organizationId={organization?.id} compact showSave />
                      </div>
                    )}
                  </div>

                  {/* Sales Process (CEP) — collapsible */}
                  <div className="rounded-lg border border-apptivia-carbon-300/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('salesProcess')}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-apptivia-carbon-100/80 hover:bg-apptivia-carbon-100/60 transition-colors"
                    >
                      <h4 className="text-xs font-bold text-apptivia-ink uppercase tracking-wide">Sales Process (CEP)</h4>
                      {expandedSections.salesProcess ? <ChevronDown size={14} className="text-apptivia-ink" /> : <ChevronRight size={14} className="text-apptivia-ink" />}
                    </button>
                    {expandedSections.salesProcess && (
                      <div className="px-4 py-4 bg-white/50">
                        <CepConfigSection organizationId={organization?.id} compact />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feedback Insights (admin only) */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Feedback Insights</h3>
                  <p className="text-xs text-apptivia-carbon-500 mt-0.5">
                    Aggregated "Was this helpful?" feedback from your team across AI suggestions and coaching content.
                  </p>
                </div>
                {loadingFeedback ? (
                  <p className="text-sm text-apptivia-carbon-400">Loading feedback data...</p>
                ) : !feedbackInsights ? (
                  <div className="text-xs text-apptivia-carbon-400 bg-apptivia-paper rounded-lg p-4 text-center">
                    No feedback collected yet. Feedback widgets appear next to coaching suggestions throughout the app.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl font-bold ${feedbackInsights.overallPct >= 70 ? 'text-emerald-600' : feedbackInsights.overallPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {feedbackInsights.overallPct}%
                      </div>
                      <div>
                        <div className="text-sm font-medium text-apptivia-ink">Overall Helpful</div>
                        <div className="text-xs text-apptivia-carbon-500">{feedbackInsights.total} total ratings</div>
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-apptivia-paper text-left text-xs text-apptivia-carbon-500 uppercase tracking-wide">
                            <th className="px-3 py-2">Feature Area</th>
                            <th className="px-3 py-2 text-center">Ratings</th>
                            <th className="px-3 py-2 text-center">Helpful %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedbackInsights.breakdown.map(row => (
                            <tr key={row.area} className="border-t">
                              <td className="px-3 py-2 font-medium text-apptivia-ink">{row.label}</td>
                              <td className="px-3 py-2 text-center text-apptivia-carbon-500">{row.total}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                  row.pct >= 70 ? 'bg-emerald-100 text-emerald-700'
                                    : row.pct >= 40 ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {row.pct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Wallboard Configuration */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Maximize2 size={18} className="text-apptivia-coral" />
                    Wallboard Configuration
                  </h3>
                  <p className="text-xs text-apptivia-carbon-500 mt-0.5">
                    Choose which slides appear on the Wallboard and how long each displays.
                  </p>
                </div>

                <div className="space-y-2">
                  {[
                    { key: 'leaderboard',  label: 'Leaderboard' },
                    { key: 'spotlight',    label: 'Top Performer Spotlight' },
                    { key: 'contests',     label: 'Active Contests' },
                    { key: 'team_stats',   label: 'Team Performance' },
                    { key: 'badges',       label: 'Recent Badges' },
                    { key: 'activity',     label: "This Week's Activity" },
                    { key: 'achievements', label: 'Recent Achievements' },
                    { key: 'goals',        label: 'Goal Progress' },
                  ].map(({ key, label }) => {
                    const slideEnabled = wallboardSettings.slides[key]?.enabled !== false;
                    const slideDuration = wallboardSettings.slides[key]?.duration || 15;
                    return (
                      <div key={key} className="flex items-center justify-between py-2 px-3 bg-apptivia-paper rounded-lg">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setWallboardSettings(ws => ({
                              ...ws,
                              slides: { ...ws.slides, [key]: { ...ws.slides[key], enabled: !slideEnabled } }
                            }))}
                            className={`w-10 h-5 rounded-full transition-colors ${slideEnabled ? 'bg-apptivia-coral' : 'bg-apptivia-carbon-300'} relative flex-shrink-0`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${slideEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                          <span className="text-sm font-medium text-apptivia-carbon-700">{label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={5}
                            max={120}
                            value={slideDuration}
                            onChange={(e) => setWallboardSettings(ws => ({
                              ...ws,
                              slides: { ...ws.slides, [key]: { ...ws.slides[key], duration: parseInt(e.target.value) || 15 } }
                            }))}
                            className="w-16 text-center text-sm border rounded px-2 py-1"
                          />
                          <span className="text-xs text-apptivia-carbon-500">sec</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 mt-4 py-2 px-3 bg-apptivia-paper rounded-lg">
                  <button
                    type="button"
                    onClick={() => setWallboardSettings(ws => ({ ...ws, celebrations: !ws.celebrations }))}
                    className={`w-10 h-5 rounded-full transition-colors ${wallboardSettings.celebrations ? 'bg-apptivia-coral' : 'bg-apptivia-carbon-300'} relative flex-shrink-0`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${wallboardSettings.celebrations ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm font-medium text-apptivia-carbon-700">Celebration Overlays</span>
                  <span className="text-xs text-apptivia-carbon-400 ml-1">(confetti for level-ups, rare badges, contest wins)</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-2">Onboarding Status</h4>
                <div className="flex items-center justify-between p-3 bg-apptivia-paper rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      {organization?.onboarding_status === 'completed' ? (
                        <span className="text-green-600">✓ Onboarding Completed</span>
                      ) : (
                        <span className="text-amber-600">⚠ Onboarding In Progress</span>
                      )}
                    </div>
                    {organization?.onboarding_completed_at && (
                      <div className="text-xs text-apptivia-carbon-500">
                        Completed: {new Date(organization.onboarding_completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {organization?.onboarding_status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(true)}
                      className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral"
                    >
                      Resume Onboarding
                    </button>
                  )}
                </div>
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
                <button onClick={teamHook.openAddTeamModal} className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral">
                  + Add Team
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamHook.teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="font-semibold">{team.name}</div>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteTeamTarget(team)}
                          className="p-1 text-apptivia-carbon-400 hover:text-red-500 transition-colors"
                          title="Delete team"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {team.description && (
                      <div className="text-sm text-apptivia-carbon-600 mt-1">{team.description}</div>
                    )}
                    <div className="text-xs text-apptivia-carbon-500 mt-2">
                      {members.filter(m => m.team_id === team.id).length} members
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
                  <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral">
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
                      <th className="pb-2 font-semibold">Title</th>
                      <th className="pb-2 font-semibold">Role</th>
                      <th className="pb-2 font-semibold">Team</th>
                      <th className="pb-2 font-semibold">Segment</th>
                      <th className="pb-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => {
                      const isPending = !member.first_name;
                      return (
                        <tr key={member.id} className="border-b">
                          <td className="py-3">
                            {isPending ? (
                              <span className="text-apptivia-carbon-400 italic">Pending setup</span>
                            ) : (
                              <>{member.first_name} {member.last_name}</>
                            )}
                          </td>
                          <td className="py-3 text-apptivia-carbon-600">{member.email}</td>
                          <td className="py-3 text-apptivia-carbon-600 text-xs">{member.title || '-'}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-apptivia-coral-tone-50 text-apptivia-coral rounded text-xs">
                              {member.role}
                            </span>
                            {isPending && (
                              <span className="ml-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                                invited
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-apptivia-carbon-600">
                            {teamHook.teams.find(t => t.id === member.team_id)?.name || '-'}
                          </td>
                          <td className="py-3 text-apptivia-carbon-600 text-xs">{member.segment || '-'}</td>
                          <td className="py-3 flex items-center gap-2">
                            <button onClick={() => openEditMember(member)} className="text-apptivia-coral hover:text-apptivia-coral text-sm">
                              Edit
                            </button>
                            {isPending && isAdmin && (
                              <button
                                onClick={async () => {
                                  try {
                                    await backendFetch('/api/users/resend-invite', { email: member.email });
                                    setMessage({ type: 'success', text: `Invite resent to ${member.email}` });
                                  } catch (err) {
                                    setMessage({ type: 'error', text: err.message || 'Failed to resend invite' });
                                  }
                                }}
                                className="text-amber-600 hover:text-amber-700 text-sm flex items-center gap-1"
                              >
                                <Send size={12} />
                                Resend
                              </button>
                            )}
                            {isAdmin && member.id !== profile?.id && (
                              <button
                                onClick={() => setRemoveMemberTarget(member)}
                                className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                              >
                                <Trash2 size={12} />
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <SubscriptionTab organization={organization} members={members} teams={teamHook.teams} setMessage={setMessage} />
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Scheduled Reports</h3>
                <p className="text-xs text-apptivia-carbon-500 mt-0.5">
                  Automate periodic email delivery of Apptivia reports to your team.
                </p>
              </div>
              {isManagerOrAbove && (
                <button
                  onClick={() => { setEditingReport(null); setShowScheduleModal(true); }}
                  className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral flex items-center gap-2"
                >
                  <Plus size={14} />
                  New Report Schedule
                </button>
              )}
            </div>

            {loadingReports ? (
              <div className="text-center py-12 text-apptivia-carbon-400 text-sm">Loading scheduled reports...</div>
            ) : scheduledReports.length === 0 ? (
              <div className="text-center py-12">
                <CalendarClock size={40} className="mx-auto text-apptivia-carbon-300 mb-3" />
                <p className="text-sm text-apptivia-carbon-500 mb-1">No scheduled reports yet</p>
                <p className="text-xs text-apptivia-carbon-400">
                  {isManagerOrAbove
                    ? 'Create your first report schedule above to start receiving automated email reports.'
                    : 'A manager or admin can set up automated report delivery.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledReports.map((report) => {
                  const recipientCount = Array.isArray(report.recipients) ? report.recipients.length : 0;
                  return (
                    <div key={report.id} className={`border rounded-lg p-4 ${report.active ? 'bg-white' : 'bg-apptivia-paper opacity-75'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={16} className="text-apptivia-coral flex-shrink-0" />
                            <span className="font-medium text-apptivia-ink text-sm">
                              {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                            </span>
                            {!report.active && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-apptivia-carbon-200 text-apptivia-carbon-600 rounded-full">Paused</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-apptivia-carbon-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {FREQUENCY_LABELS[report.frequency] || report.frequency}
                              {report.frequency === 'weekly' && report.day_of_week
                                ? ` on ${report.day_of_week.charAt(0).toUpperCase() + report.day_of_week.slice(1)}`
                                : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {report.time || '09:00'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail size={12} />
                              {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {report.last_sent_at && (
                            <div className="text-xs text-apptivia-carbon-400 mt-1">
                              Last sent: {new Date(report.last_sent_at).toLocaleString()}
                            </div>
                          )}
                          {report.next_scheduled_at && report.active && (
                            <div className="text-xs text-apptivia-coral mt-0.5">
                              Next: {new Date(report.next_scheduled_at).toLocaleString()}
                            </div>
                          )}
                        </div>

                        {isManagerOrAbove && (
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <button
                              onClick={() => { setEditingReport(report); setShowScheduleModal(true); }}
                              className="p-1.5 text-apptivia-carbon-400 hover:text-apptivia-coral hover:bg-apptivia-coral-tone-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleReport(report)}
                              className={`p-1.5 rounded transition-colors ${
                                report.active
                                  ? 'text-apptivia-carbon-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-apptivia-carbon-400 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={report.active ? 'Pause' : 'Resume'}
                            >
                              {report.active ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleSendNow(report.id)}
                                className="p-1.5 text-apptivia-carbon-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Send now"
                              >
                                <Send size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1.5 text-apptivia-carbon-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4C: KPI Templates Tab */}
        {activeTab === 'kpi_templates' && isManagerOrAbove && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">KPI Role Templates</h3>
                <p className="text-sm text-apptivia-carbon-500 mt-1">Pre-configured KPI goals and weights by job title. Apply a template to instantly update your scorecard configuration.</p>
              </div>
            </div>

            {kpiTemplates.loading ? (
              <div className="text-center py-8 text-apptivia-carbon-400">Loading templates...</div>
            ) : kpiTemplates.error ? (
              <div className="text-center py-8 text-red-500">{kpiTemplates.error}</div>
            ) : kpiTemplates.templates.length === 0 ? (
              <div className="text-center py-8 text-apptivia-carbon-400">No templates available. Run migration 097 to seed defaults.</div>
            ) : (
              <div className="space-y-4">
                {kpiTemplates.templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-medium text-apptivia-ink">{template.template_name}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-carbon-600">
                          {template.title_key}
                        </span>
                        {template.is_default && !template.organization_id && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-apptivia-coral-tone-50 text-apptivia-coral">Global Default</span>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          // F22: Confirm before destructive template apply
                          if (!window.confirm(`Apply "${template.template_name}"? This will replace your current KPI goals, weights, and scorecard visibility settings.`)) return;
                          setApplyingTemplate(template.id);
                          try {
                            await kpiTemplates.applyTemplate(template);
                            setMessage({ type: 'success', text: `Applied "${template.template_name}" — scorecard KPIs updated. Refresh your dashboard to see changes.` });
                          } catch (err) {
                            setMessage({ type: 'error', text: `Failed to apply template: ${err.message}` });
                          } finally {
                            setApplyingTemplate(null);
                          }
                        }}
                        disabled={applyingTemplate === template.id}
                        className="px-3 py-1.5 bg-apptivia-coral text-white text-sm rounded-lg hover:bg-apptivia-coral disabled:opacity-50"
                      >
                        {applyingTemplate === template.id ? 'Applying...' : 'Apply to Scorecard'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {(template.kpi_configs || []).map((cfg, i) => (
                        <div key={i} className="bg-apptivia-paper rounded px-3 py-2 text-center">
                          <div className="text-xs font-medium text-apptivia-carbon-700 truncate">{cfg.kpi_key.replace(/_/g, ' ')}</div>
                          <div className="text-sm font-semibold text-apptivia-ink mt-0.5">{cfg.goal}</div>
                          <div className="text-[10px] text-apptivia-carbon-500">Weight: {Math.round(cfg.weight * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data Import Tab */}
        {activeTab === 'data' && isAdmin && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Import KPI Data</h3>
                <p className="text-sm text-apptivia-carbon-500 mt-1">Upload historical KPI data via CSV to populate your scorecard</p>
              </div>
              <button
                onClick={() => setShowKpiImport(true)}
                className="flex items-center gap-2 px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm font-medium hover:bg-apptivia-coral transition-colors"
              >
                <Upload size={16} />
                Import CSV
              </button>
            </div>

            {/* Import History */}
            <div>
              <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Import History</h4>
              {loadingImportHistory ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-apptivia-carbon-100 rounded-lg" />)}
                </div>
              ) : importHistory.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-apptivia-carbon-200 rounded-lg">
                  <Database size={32} className="mx-auto text-apptivia-carbon-300 mb-2" />
                  <p className="text-sm text-apptivia-carbon-500">No imports yet</p>
                  <p className="text-xs text-apptivia-carbon-400 mt-1">Upload a CSV to get started</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-apptivia-paper text-apptivia-carbon-600">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Date</th>
                        <th className="text-left px-4 py-2.5 font-medium">File</th>
                        <th className="text-left px-4 py-2.5 font-medium">Status</th>
                        <th className="text-right px-4 py-2.5 font-medium">Imported</th>
                        <th className="text-right px-4 py-2.5 font-medium">Failed</th>
                        <th className="text-left px-4 py-2.5 font-medium">Week Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importHistory.map(job => {
                        const statusColors = {
                          completed: 'bg-green-100 text-green-700',
                          partial: 'bg-yellow-100 text-yellow-700',
                          failed: 'bg-red-100 text-red-700',
                          processing: 'bg-apptivia-coral-tone-50 text-apptivia-coral',
                        };
                        return (
                          <tr key={job.id} className="hover:bg-apptivia-paper">
                            <td className="px-4 py-2.5 text-apptivia-carbon-600">
                              {new Date(job.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 text-apptivia-ink font-medium truncate max-w-[200px]">
                              {job.filename || '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status] || 'bg-apptivia-carbon-100 text-apptivia-carbon-600'}`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-green-600 font-medium">
                              {job.rows_imported}
                            </td>
                            <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                              {job.rows_failed || 0}
                            </td>
                            <td className="px-4 py-2.5 text-apptivia-carbon-500 text-xs">
                              {job.week_range || '—'}
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
                    <div className="text-sm text-apptivia-carbon-600">{setting.description}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-apptivia-carbon-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-apptivia-carbon-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apptivia-coral"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Members Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-apptivia-ink">Invite Members</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-apptivia-carbon-100 rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-apptivia-carbon-500 mb-4">Enter email addresses (one per line or comma-separated)</p>

            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="user@example.com&#10;another@example.com"
              rows={4}
              className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral mb-3"
            />

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="power_user">Power User</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Title</label>
                <select
                  value={inviteTitle}
                  onChange={(e) => {
                    setInviteTitle(e.target.value);
                    const selected = titles.find(t => t.label === e.target.value);
                    setInviteTitleKey(selected?.key || '');
                  }}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select title</option>
                  {titles.map(t => <option key={t.key} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Team (optional)</label>
                <select
                  value={inviteTeamId}
                  onChange={(e) => setInviteTeamId(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No team</option>
                  {teamHook.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg text-sm hover:bg-apptivia-carbon-200">Cancel</button>
              <button
                onClick={handleInviteMembers}
                disabled={!inviteEmails.trim() || inviteSending}
                className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral disabled:opacity-50"
              >
                {inviteSending ? 'Sending...' : 'Send Invitations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {teamHook.showAddTeamModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-apptivia-ink">Create Team</h2>
              <button onClick={() => teamHook.setShowAddTeamModal(false)} className="p-1 hover:bg-apptivia-carbon-100 rounded"><X size={18} /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamHook.newTeamName}
                  onChange={(e) => teamHook.setNewTeamName(e.target.value)}
                  placeholder="e.g. Enterprise Sales"
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={teamHook.newTeamDescription}
                  onChange={(e) => teamHook.setNewTeamDescription(e.target.value)}
                  placeholder="Brief team description"
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Manager (optional)</label>
                <select
                  value={teamHook.newTeamManagerId}
                  onChange={(e) => teamHook.setNewTeamManagerId(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
                >
                  <option value="">No manager assigned</option>
                  {teamHook.allProfiles
                    .filter(p => p.role === ROLES.MANAGER || p.role === ROLES.ADMIN)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}{p.role === ROLES.ADMIN ? ' (Admin)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => teamHook.setShowAddTeamModal(false)} className="px-4 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg text-sm hover:bg-apptivia-carbon-200">Cancel</button>
              <button
                onClick={handleAddTeam}
                disabled={!teamHook.newTeamName.trim() || teamHook.addingTeam}
                className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral disabled:opacity-50"
              >
                {teamHook.addingTeam ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-apptivia-ink">Edit Member</h2>
              <button onClick={() => setEditingMember(null)} className="p-1 hover:bg-apptivia-carbon-100 rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-apptivia-carbon-500 mb-4">{editingMember.first_name} {editingMember.last_name} ({editingMember.email})</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Title</label>
                <select
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No title</option>
                  {titles.map(t => <option key={t.key} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="power_user">Power User</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Secondary Role</label>
                <select
                  value={editSecondaryRole}
                  onChange={(e) => setEditSecondaryRole(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {[ROLES.POWER_USER, ROLES.COACH, ROLES.MANAGER, ROLES.ADMIN]
                    .filter(r => r !== editRole)
                    .map(r => <option key={r} value={r}>{r === ROLES.POWER_USER ? 'Power User' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Team</label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No team</option>
                  {teamHook.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Segment</label>
                <select
                  value={editSegment}
                  onChange={(e) => setEditSegment(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No segment</option>
                  <option value="Territory">Territory</option>
                  <option value="Mid-Market">Mid-Market</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingMember(null)} className="px-4 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg text-sm hover:bg-apptivia-carbon-200">Cancel</button>
              <button
                onClick={handleSaveMember}
                disabled={savingMember}
                className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm hover:bg-apptivia-coral disabled:opacity-50"
              >
                {savingMember ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTeamTarget}
        onClose={() => setDeleteTeamTarget(null)}
        onConfirm={handleDeleteTeam}
        title="Delete Team"
        message={deleteTeamTarget ? `Are you sure you want to delete "${deleteTeamTarget.name}"? ${members.filter(m => m.team_id === deleteTeamTarget.id).length} member(s) will be unassigned from this team.` : ''}
        confirmText="Delete Team"
        variant="danger"
        isLoading={deleteLoading}
      />

      {/* Remove Member Confirmation */}
      <ConfirmModal
        isOpen={!!removeMemberTarget}
        onClose={() => setRemoveMemberTarget(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        message={removeMemberTarget ? `Remove ${removeMemberTarget.first_name ? removeMemberTarget.first_name + ' ' + removeMemberTarget.last_name : removeMemberTarget.email} from the organization? They will lose access to all org data.` : ''}
        confirmText="Remove"
        variant="danger"
        isLoading={deleteLoading}
      />

      {/* Add Existing Users Modal */}
      {showAddUsersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-apptivia-ink">Add Existing Users</h2>
                <p className="text-sm text-apptivia-carbon-500 mt-1">Select users to add to {organization?.name || 'your organization'}</p>
              </div>
              <button onClick={() => setShowAddUsersModal(false)} className="p-1 hover:bg-apptivia-carbon-100 rounded">
                <X size={20} className="text-apptivia-carbon-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={addUsersSearch}
                  onChange={(e) => setAddUsersSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-apptivia-carbon-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
                />
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loadingUnassigned ? (
                <div className="text-center py-8 text-apptivia-carbon-500 text-sm">Loading users...</div>
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
                      <Users size={32} className="mx-auto text-apptivia-carbon-300 mb-2" />
                      <p className="text-sm text-apptivia-carbon-500">
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
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-apptivia-paper text-sm font-medium text-apptivia-carbon-700 border-b mb-1"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allFilteredSelected ? 'bg-apptivia-coral border-apptivia-coral' : 'border-apptivia-carbon-300'
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
                            selected ? 'bg-apptivia-coral-tone-50' : 'hover:bg-apptivia-paper'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? 'bg-apptivia-coral border-apptivia-coral' : 'border-apptivia-carbon-300'
                          }`}>
                            {selected && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-apptivia-ink truncate">{name || u.email}</div>
                            {name && <div className="text-xs text-apptivia-carbon-500 truncate">{u.email}</div>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-full flex-shrink-0">
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
            <div className="flex items-center justify-between p-6 border-t bg-apptivia-paper">
              <span className="text-sm text-apptivia-carbon-500">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddUsersModal(false)}
                  className="px-4 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-md text-sm hover:bg-apptivia-carbon-200"
                >
                  Cancel
                </button>
                <button
                  onClick={assignSelectedUsers}
                  disabled={selectedUserIds.length === 0 || assigningUsers}
                  className="px-4 py-2 bg-apptivia-coral text-white rounded-md text-sm hover:bg-apptivia-coral disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <UserPlus size={14} />
                  {assigningUsers ? 'Adding...' : `Add ${selectedUserIds.length || ''} User${selectedUserIds.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <KpiImportModal
        isOpen={showKpiImport}
        onClose={() => setShowKpiImport(false)}
        onImportComplete={() => { setShowKpiImport(false); loadImportHistory(); }}
        organizationId={organization?.id}
      />

      <ScheduleReportModal
        isOpen={showScheduleModal}
        onClose={() => { setShowScheduleModal(false); setEditingReport(null); }}
        editReport={editingReport}
        onSuccess={() => {
          loadScheduledReports();
          setMessage({ type: 'success', text: editingReport ? 'Report schedule updated.' : 'Report scheduled successfully.' });
        }}
      />

      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setNoOrgDetected(false);
          loadData();
        }}
        onComplete={() => {
          setShowOnboarding(false);
          setNoOrgDetected(false);
          navigate('/dashboard');
        }}
        organizationId={organization?.id}
      />
    </DashboardLayout>
  );
}
