import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, CreditCard, Bell, Shield, Save, Search, X, UserPlus, Check, Plus, ChevronDown, ChevronRight, Maximize2, CalendarClock, FileText, Play, Pause, Trash2, Pencil, Send, Calendar, Clock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import PageActionBar from '../components/PageActionBar';
import OnboardingWizard from '../components/OnboardingWizard';
import { useNotifications } from '../contexts/NotificationContext';
import { backendFetch } from '../utils/backendFetch';
import { useTeamManagement } from '../hooks/useTeamManagement';
import CepConfigSection from '../components/CepConfigSection';
import ScheduleReportModal from '../components/ScheduleReportModal';

function SignalTagField({ label, hint, items, value, onChange, onAdd, onRemove, placeholder, tagClass }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
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
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button type="button" onClick={onAdd} className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const [activeTab, setActiveTab] = useState('general');
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
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  // Add Team — delegated to teamHook

  // Edit Member modal state
  const [editingMember, setEditingMember] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editTeamId, setEditTeamId] = useState('');
  const [savingMember, setSavingMember] = useState(false);

  // Scheduled Reports state
  const [scheduledReports, setScheduledReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);

  const isAdmin = role === 'admin';
  const isManagerOrAbove = ['admin', 'manager'].includes(role);

  useEffect(() => {
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
      setScheduledReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load scheduled reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reports' && organization?.id) loadScheduledReports();
  }, [activeTab, organization?.id, loadScheduledReports]);

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
        ...(inviteTeamId ? { team_id: inviteTeamId } : {}),
      });
      const { invited = 0, skipped = 0, errors: inviteErrors = [] } = result;
      setShowInviteModal(false);
      setInviteEmails('');
      setInviteRole('power_user');
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
    setEditTeamId(member.team_id || '');
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    setSavingMember(true);
    try {
      const { error } = await supabase.from('profiles').update({
        role: editRole,
        team_id: editTeamId || null,
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
          <Shield size={48} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Admin Access Required</h2>
          <p className="text-gray-500">You don't have permission to access organization settings.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-gray-500">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Organization Settings</h1>
            <p className="text-gray-500 text-sm">Manage your organization and team settings</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
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

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            {[
              { id: 'general', label: 'General', icon: Building2 },
              { id: 'teams', label: 'Teams & Members', icon: Users },
              { id: 'subscription', label: 'Subscription', icon: CreditCard },
              { id: 'reports', label: 'Reports', icon: CalendarClock },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      value={organization?.name || ''}
                      onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry
                    </label>
                    <select
                      value={organization?.industry || ''}
                      onChange={(e) => setOrganization({ ...organization, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select industry</option>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Retail">Retail</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Name
                    </label>
                    <input
                      type="text"
                      value={organization?.primary_contact_name || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Primary Contact Email
                    </label>
                    <input
                      type="email"
                      value={organization?.primary_contact_email || ''}
                      onChange={(e) => setOrganization({ ...organization, primary_contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* ICP Configuration */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">ICP Configuration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Define your Ideal Customer Profile. Apptivia scores accounts 0–100 based on how well they match these criteria.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-600">Enable ICP Scoring</span>
                    <div
                      onClick={() => setIcpConfig(c => ({ ...c, enabled: !c.enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${icpConfig.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${icpConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                {icpConfig.enabled && (
                  <div className="space-y-4 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Industries <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_industries}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_industries: e.target.value }))}
                        placeholder="e.g. SaaS, Financial Services, Technology"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_min}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_min: e.target.value }))}
                          placeholder="e.g. 50"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Headcount</label>
                        <input
                          type="number"
                          value={icpConfig.headcount_max}
                          onChange={(e) => setIcpConfig(c => ({ ...c, headcount_max: e.target.value }))}
                          placeholder="e.g. 5000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_min_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_min_m: e.target.value }))}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Revenue ($M)</label>
                        <input
                          type="number"
                          value={icpConfig.revenue_max_m}
                          onChange={(e) => setIcpConfig(c => ({ ...c, revenue_max_m: e.target.value }))}
                          placeholder="e.g. 500"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target Technologies <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                      <input
                        type="text"
                        value={icpConfig.target_technologies}
                        onChange={(e) => setIcpConfig(c => ({ ...c, target_technologies: e.target.value }))}
                        placeholder="e.g. Salesforce, HubSpot, Outreach, Slack"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <p className="text-xs text-gray-400">Scoring weights: Industry 30% · Headcount 25% · Revenue 25% · Tech Stack 20%</p>
                  </div>
                )}
              </div>

              {/* Signal Prospecting Configuration */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Signal Prospecting Configuration</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Define what Apptivia Engage looks for when scanning for buyer intent signals. Reps will use these settings when running a signal scan.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAddSignalForm(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        showAddSignalForm
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
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
                          tagClass="bg-blue-100 text-blue-700"
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
                  <p className="text-xs text-gray-500 mt-0.5">
                    Universal signals are available to all orgs. Toggle off any that aren't relevant.
                    Add custom signals specific to your ICP and what you sell.
                  </p>
                </div>

                {loadingSignalLibrary ? (
                  <p className="text-sm text-gray-400">Loading signal library...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Add custom signal form — appears at top of library */}
                    {showAddSignalForm && (
                      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/40 space-y-3">
                        <h4 className="text-sm font-semibold text-gray-700">New Custom Signal</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Signal Name *</label>
                            <input
                              type="text"
                              value={newCustomSignal.signal_name}
                              onChange={e => setNewCustomSignal(s => ({ ...s, signal_name: e.target.value }))}
                              placeholder="e.g. Researching Sales Tools"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Signal Key * <span className="text-gray-400 font-normal">(unique ID)</span></label>
                            <input
                              type="text"
                              value={newCustomSignal.signal_key}
                              onChange={e => setNewCustomSignal(s => ({ ...s, signal_key: e.target.value }))}
                              placeholder="e.g. researching_sales_tools"
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                            <select
                              value={newCustomSignal.category}
                              onChange={e => setNewCustomSignal(s => ({ ...s, category: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="buyer_intent">Buyer Intent</option>
                              <option value="interest">Interest</option>
                              <option value="company_event">Company Event</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Default Score (0–100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={newCustomSignal.default_score}
                              onChange={e => setNewCustomSignal(s => ({ ...s, default_score: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Strength</label>
                            <select
                              value={newCustomSignal.default_strength}
                              onChange={e => setNewCustomSignal(s => ({ ...s, default_strength: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="very_high">Very High</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                          <input
                            type="text"
                            value={newCustomSignal.description}
                            onChange={e => setNewCustomSignal(s => ({ ...s, description: e.target.value }))}
                            placeholder="What this signal means and why it matters"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowAddSignalForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                          <button
                            type="button"
                            onClick={addCustomSignal}
                            disabled={savingSignal || !newCustomSignal.signal_name.trim() || !newCustomSignal.signal_key.trim()}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
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
                        <div className="rounded-lg border border-purple-200 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleSection('customSignals')}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-purple-50/60 hover:bg-purple-100/50 transition-colors"
                          >
                            <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                              Custom Signals — This Org Only ({customs.length})
                            </h4>
                            {expandedSections.customSignals ? <ChevronDown size={14} className="text-purple-400" /> : <ChevronRight size={14} className="text-purple-400" />}
                          </button>
                          {expandedSections.customSignals && (
                            <div className="px-3 py-2">
                              {customs.length === 0 ? (
                                <p className="text-xs text-gray-400 italic px-1 py-2">No custom signals yet. Click "Add Custom Signal" above to create one.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {customs.map(cfg => {
                                    const colorMap = { purple: 'bg-purple-50 border-purple-100', cyan: 'bg-cyan-50 border-cyan-100', amber: 'bg-amber-50 border-amber-100', gray: 'bg-gray-50 border-gray-200' };
                                    const badgeMap = { purple: 'bg-purple-100 text-purple-700', cyan: 'bg-cyan-100 text-cyan-700', amber: 'bg-amber-100 text-amber-700', gray: 'bg-gray-100 text-gray-600' };
                                    const col = catColors[cfg.category] || 'gray';
                                    return (
                                      <div key={cfg.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${colorMap[col]}`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-800">{cfg.signal_name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeMap[col]}`}>{catLabels[cfg.category]}</span>
                                          </div>
                                          {cfg.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{cfg.description}</p>}
                                        </div>
                                        <div className="flex items-center gap-3 ml-3 shrink-0">
                                          <span className="text-xs text-gray-400">Score {cfg.default_score}</span>
                                          <button
                                            type="button"
                                            onClick={() => !savingSignal && deleteCustomSignal(cfg.id)}
                                            disabled={savingSignal}
                                            className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
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
                      const borderColor = color === 'amber' ? 'border-amber-200' : 'border-blue-200';
                      const bgColor = color === 'amber' ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'bg-blue-50/60 hover:bg-blue-100/50';
                      const textColor = color === 'amber' ? 'text-amber-700' : 'text-blue-700';
                      const chevronColor = color === 'amber' ? 'text-amber-400' : 'text-blue-400';
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
                              <span className="text-[10px] text-gray-400">({defs.length})</span>
                            </div>
                            {isExpanded ? <ChevronDown size={14} className={chevronColor} /> : <ChevronRight size={14} className={chevronColor} />}
                          </button>
                          {isExpanded && (
                            <div className="px-3 py-2 space-y-1.5">
                              {defs.map(def => {
                                const override = signalLibrary.orgConfigs.find(c => c.signal_definition_id === def.id);
                                const isEnabled = override ? override.is_enabled : true;
                                return (
                                  <div key={def.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${isEnabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-medium text-gray-800">{def.signal_name}</span>
                                      {def.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{def.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-3 ml-3 shrink-0">
                                      <span className="text-xs text-gray-400">Score {def.default_score}</span>
                                      <div
                                        onClick={() => !savingSignal && toggleUniversalSignal(def.id, isEnabled)}
                                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${isEnabled ? 'bg-blue-500' : 'bg-gray-300'} ${savingSignal ? 'opacity-50 pointer-events-none' : ''}`}
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

              {/* Sales Process (CEP) */}
              <CepConfigSection organizationId={organization?.id} />

              {/* Feedback Insights (admin only) */}
              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Feedback Insights</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Aggregated "Was this helpful?" feedback from your team across AI suggestions and coaching content.
                  </p>
                </div>
                {loadingFeedback ? (
                  <p className="text-sm text-gray-400">Loading feedback data...</p>
                ) : !feedbackInsights ? (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4 text-center">
                    No feedback collected yet. Feedback widgets appear next to coaching suggestions throughout the app.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl font-bold ${feedbackInsights.overallPct >= 70 ? 'text-emerald-600' : feedbackInsights.overallPct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {feedbackInsights.overallPct}%
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Overall Helpful</div>
                        <div className="text-xs text-gray-500">{feedbackInsights.total} total ratings</div>
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                            <th className="px-3 py-2">Feature Area</th>
                            <th className="px-3 py-2 text-center">Ratings</th>
                            <th className="px-3 py-2 text-center">Helpful %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedbackInsights.breakdown.map(row => (
                            <tr key={row.area} className="border-t">
                              <td className="px-3 py-2 font-medium text-gray-800">{row.label}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{row.total}</td>
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
                    <Maximize2 size={18} className="text-blue-600" />
                    Wallboard Configuration
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
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
                      <div key={key} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setWallboardSettings(ws => ({
                              ...ws,
                              slides: { ...ws.slides, [key]: { ...ws.slides[key], enabled: !slideEnabled } }
                            }))}
                            className={`w-9 h-5 rounded-full transition-colors ${slideEnabled ? 'bg-blue-600' : 'bg-gray-300'} relative`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${slideEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                          <span className="text-sm font-medium text-gray-700">{label}</span>
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
                          <span className="text-xs text-gray-500">sec</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 mt-4 py-2 px-3 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setWallboardSettings(ws => ({ ...ws, celebrations: !ws.celebrations }))}
                    className={`w-9 h-5 rounded-full transition-colors ${wallboardSettings.celebrations ? 'bg-blue-600' : 'bg-gray-300'} relative`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${wallboardSettings.celebrations ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Celebration Overlays</span>
                  <span className="text-xs text-gray-400 ml-1">(confetti for level-ups, rare badges, contest wins)</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Onboarding Status</h4>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium">
                      {organization?.onboarding_status === 'completed' ? (
                        <span className="text-green-600">✓ Onboarding Completed</span>
                      ) : (
                        <span className="text-amber-600">⚠ Onboarding In Progress</span>
                      )}
                    </div>
                    {organization?.onboarding_completed_at && (
                      <div className="text-xs text-gray-500">
                        Completed: {new Date(organization.onboarding_completed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {organization?.onboarding_status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
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
                <button onClick={teamHook.openAddTeamModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  + Add Team
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamHook.teams.map((team) => (
                  <div key={team.id} className="border rounded-lg p-4">
                    <div className="font-semibold">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-gray-600 mt-1">{team.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
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
                  <button onClick={() => setShowInviteModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
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
                      <th className="pb-2 font-semibold">Role</th>
                      <th className="pb-2 font-semibold">Team</th>
                      <th className="pb-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b">
                        <td className="py-3">
                          {member.first_name} {member.last_name}
                        </td>
                        <td className="py-3 text-gray-600">{member.email}</td>
                        <td className="py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">
                          {teamHook.teams.find(t => t.id === member.team_id)?.name || '-'}
                        </td>
                        <td className="py-3">
                          <button onClick={() => openEditMember(member)} className="text-blue-600 hover:text-blue-700 text-sm">
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Subscription Details</h3>
            
            <div className="border rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold">{organization?.subscription_plan || 'Pro'} Plan</div>
                  <div className="text-sm text-gray-600">Active subscription</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">$99/mo</div>
                  <div className="text-sm text-gray-600">Billed monthly</div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Users</span>
                  <span className="font-medium">{members.length} / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Teams</span>
                  <span className="font-medium">{teamHook.teams.length} / Unlimited</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Integrations</span>
                  <span className="font-medium">All included</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Support</span>
                  <span className="font-medium">Priority</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMessage({ type: 'info', text: 'Plan upgrades coming soon. Contact support@apptivia.app for changes.' })} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Upgrade Plan
              </button>
              <button onClick={() => setMessage({ type: 'info', text: 'Billing management coming soon. Contact support@apptivia.app.' })} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Manage Billing
              </button>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Scheduled Reports</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automate periodic email delivery of Apptivia reports to your team.
                </p>
              </div>
              {isManagerOrAbove && (
                <button
                  onClick={() => { setEditingReport(null); setShowScheduleModal(true); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={14} />
                  New Report Schedule
                </button>
              )}
            </div>

            {loadingReports ? (
              <div className="text-center py-12 text-gray-400 text-sm">Loading scheduled reports...</div>
            ) : scheduledReports.length === 0 ? (
              <div className="text-center py-12">
                <CalendarClock size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-1">No scheduled reports yet</p>
                <p className="text-xs text-gray-400">
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
                    <div key={report.id} className={`border rounded-lg p-4 ${report.active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText size={16} className="text-blue-600 flex-shrink-0" />
                            <span className="font-medium text-gray-900 text-sm">
                              {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                            </span>
                            {!report.active && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">Paused</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
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
                            <div className="text-xs text-gray-400 mt-1">
                              Last sent: {new Date(report.last_sent_at).toLocaleString()}
                            </div>
                          )}
                          {report.next_scheduled_at && report.active && (
                            <div className="text-xs text-blue-500 mt-0.5">
                              Next: {new Date(report.next_scheduled_at).toLocaleString()}
                            </div>
                          )}
                        </div>

                        {isManagerOrAbove && (
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <button
                              onClick={() => { setEditingReport(report); setShowScheduleModal(true); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleReport(report)}
                              className={`p-1.5 rounded transition-colors ${
                                report.active
                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={report.active ? 'Pause' : 'Resume'}
                            >
                              {report.active ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleSendNow(report.id)}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Send now"
                              >
                                <Send size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
                    <div className="text-sm text-gray-600">{setting.description}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
              <h2 className="text-lg font-bold text-gray-900">Invite Members</h2>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Enter email addresses (one per line or comma-separated)</p>

            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="user@example.com&#10;another@example.com"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-3"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="power_user">Power User</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Team (optional)</label>
                <select
                  value={inviteTeamId}
                  onChange={(e) => setInviteTeamId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No team</option>
                  {teamHook.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleInviteMembers}
                disabled={!inviteEmails.trim() || inviteSending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
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
              <h2 className="text-lg font-bold text-gray-900">Create Team</h2>
              <button onClick={() => teamHook.setShowAddTeamModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamHook.newTeamName}
                  onChange={(e) => teamHook.setNewTeamName(e.target.value)}
                  placeholder="e.g. Enterprise Sales"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={teamHook.newTeamDescription}
                  onChange={(e) => teamHook.setNewTeamDescription(e.target.value)}
                  placeholder="Brief team description"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => teamHook.setShowAddTeamModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleAddTeam}
                disabled={!teamHook.newTeamName.trim() || teamHook.addingTeam}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
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
              <h2 className="text-lg font-bold text-gray-900">Edit Member</h2>
              <button onClick={() => setEditingMember(null)} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{editingMember.first_name} {editingMember.last_name} ({editingMember.email})</p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="power_user">Power User</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Team</label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">No team</option>
                  {teamHook.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingMember(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleSaveMember}
                disabled={savingMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingMember ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Existing Users Modal */}
      {showAddUsersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Existing Users</h2>
                <p className="text-sm text-gray-500 mt-1">Select users to add to {organization?.name || 'your organization'}</p>
              </div>
              <button onClick={() => setShowAddUsersModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pt-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={addUsersSearch}
                  onChange={(e) => setAddUsersSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loadingUnassigned ? (
                <div className="text-center py-8 text-gray-500 text-sm">Loading users...</div>
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
                      <Users size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">
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
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700 border-b mb-1"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allFilteredSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
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
                            selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {selected && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{name || u.email}</div>
                            {name && <div className="text-xs text-gray-500 truncate">{u.email}</div>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">
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
            <div className="flex items-center justify-between p-6 border-t bg-gray-50">
              <span className="text-sm text-gray-500">
                {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddUsersModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={assignSelectedUsers}
                  disabled={selectedUserIds.length === 0 || assigningUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <UserPlus size={14} />
                  {assigningUsers ? 'Adding...' : `Add ${selectedUserIds.length || ''} User${selectedUserIds.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
        organizationId={organization?.id}
      />
    </DashboardLayout>
  );
}
