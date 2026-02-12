import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import ConfigureModal from '../components/ConfigureModal';
import CoachingPlanTemplatesModal from '../components/CoachingPlanTemplatesModal';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabaseClient';
import { Target, Calendar, Users, Download, Mail, Share2, Plus, Edit, Trash2, UserPlus } from 'lucide-react';

export default function CoachingPlans() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const toast = useToast();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [coachingPlans, setCoachingPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [planToAssign, setPlanToAssign] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const { openPanel, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  // Plan form state
  const [planForm, setPlanForm] = useState({
    name: '',
    goals: [''],
    focus_kpis: [''],
    action_items: [''],
    success_metrics: [''],
    notes: '',
    date_range_start: '',
    date_range_end: '',
    plan_type: 'custom'
  });

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const canManagePlans = hasPermission('manage_coaching_plans') || isAdmin || isManager;

  // Available KPIs for dropdown
  const availableKPIs = [
    'pipeline_created',
    'sourced_opps',
    'call_connects',
    'meetings',
    'talk_time_minutes',
    'emails_sent',
    'demos_completed',
    'win_rate',
    'response_time',
    'follow_ups',
    'stage2_opps',
    'qualified_leads',
    'social_touches'
  ];

  const kpiSuggestions = {
    pipeline_created: {
      goals: ['Increase qualified pipeline by 25% this period'],
      actions: ['Block 2 hours daily for prospecting', 'Target 20 high-intent accounts per week']
    },
    call_connects: {
      goals: ['Reach 50+ call connects this week'],
      actions: ['Use peak call windows (8-10am, 4-6pm)', 'Pre-plan call lists the night before']
    },
    meetings: {
      goals: ['Book 10+ meetings this week'],
      actions: ['End every call with a calendar ask', 'Send same-day follow-ups with availability']
    },
    emails_sent: {
      goals: ['Send 100+ personalized emails this week'],
      actions: ['Personalize first lines', 'Batch email blocks twice daily']
    },
    win_rate: {
      goals: ['Achieve 25%+ win rate on qualified opportunities'],
      actions: ['Create mutual action plans', 'Review objections and responses weekly']
    },
    response_time: {
      goals: ['Respond to inbound leads within 2 hours'],
      actions: ['Set response SLAs', 'Batch inbox reviews morning and afternoon']
    }
  };

  useEffect(() => {
    loadCoachingPlans();
    if (canManagePlans) {
      loadTeamMembers();
    }
  }, []);

  const loadCoachingPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coaching_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCoachingPlans(data);
      }
    } catch (e) {
      console.error('Error loading coaching plans:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .order('first_name');

      if (!error && data) {
        setTeamMembers(data);
      }
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  };

  const handleTemplateSelect = (templateData) => {
    setPlanForm({
      name: templateData.name,
      goals: templateData.goals || [''],
      focus_kpis: templateData.focus_kpis || [''],
      action_items: templateData.action_items || [''],
      success_metrics: templateData.success_metrics || [''],
      notes: templateData.notes || '',
      date_range_start: templateData.date_range_start || '',
      date_range_end: templateData.date_range_end || '',
      plan_type: 'auto',
      template_id: templateData.template_id
    });
    setShowBuilder(true);
  };

  const addArrayField = (field) => {
    setPlanForm({
      ...planForm,
      [field]: [...planForm[field], '']
    });
  };

  const updateArrayField = (field, index, value) => {
    const newArray = [...planForm[field]];
    newArray[index] = value;
    setPlanForm({
      ...planForm,
      [field]: newArray
    });
  };

  const handleFocusKpiChange = (index, value) => {
    updateArrayField('focus_kpis', index, value);
    const suggestions = kpiSuggestions[value];
    if (!suggestions || planForm.plan_type !== 'auto') return;

    const hasGoals = planForm.goals.some((goal) => goal.trim());
    const hasActions = planForm.action_items.some((action) => action.trim());

    setPlanForm((prev) => ({
      ...prev,
      goals: hasGoals ? prev.goals : suggestions.goals,
      action_items: hasActions ? prev.action_items : suggestions.actions
    }));
  };

  const removeArrayField = (field, index) => {
    const newArray = planForm[field].filter((_, i) => i !== index);
    setPlanForm({
      ...planForm,
      [field]: newArray.length > 0 ? newArray : ['']
    });
  };

  const resetPlanForm = () => {
    setPlanForm({
      name: '',
      goals: [''],
      focus_kpis: [''],
      action_items: [''],
      success_metrics: [''],
      notes: '',
      date_range_start: '',
      date_range_end: '',
      plan_type: 'custom'
    });
    setEditingPlan(null);
  };

  const buildPlanPayload = (contentKey) => ({
    name: planForm.name,
    goals: planForm.goals.filter(g => g.trim()),
    focus_kpis: planForm.focus_kpis.filter(k => k.trim()),
    action_items: planForm.action_items.filter(a => a.trim()),
    success_metrics: planForm.success_metrics.filter(s => s.trim()),
    notes: planForm.notes,
    date_range_start: planForm.date_range_start || null,
    date_range_end: planForm.date_range_end || null,
    plan_type: planForm.plan_type,
    template_id: planForm.template_id || null,
    created_by: user?.id,
    [contentKey]: generatePlanContent()
  });

  const isMissingColumnError = (error, columnName) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes(`column "${columnName}"`) || message.includes(columnName);
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error('Please enter a plan name');
      return;
    }
    if (!user?.id) {
      toast.error('You must be signed in to save a plan');
      return;
    }
    if (savingPlan) return;

    try {
      setSavingPlan(true);
      const saveWithContentKey = async (contentKey) => {
        const planData = buildPlanPayload(contentKey);
        if (editingPlan) {
          return supabase
            .from('coaching_plans')
            .update(planData)
            .eq('id', editingPlan)
            .select()
            .single();
        }
        return supabase
          .from('coaching_plans')
          .insert([planData])
          .select()
          .single();
      };

      let result = await saveWithContentKey('content');
      if (result.error && isMissingColumnError(result.error, 'content')) {
        result = await saveWithContentKey('plan_text');
      }
      if (result.error) throw result.error;

      if (editingPlan) {
        setCoachingPlans(coachingPlans.map(p => p.id === editingPlan ? result.data : p));
        toast.success('Plan updated successfully!');
      } else {
        setCoachingPlans([result.data, ...coachingPlans]);
        toast.success('Plan saved successfully! View it in Saved Plans below.');
      }
      setTimeout(() => {
        document.getElementById('saved-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

      resetPlanForm();
      setShowBuilder(false);
    } catch (e) {
      console.error('Error saving plan:', e);
      toast.error(e?.message || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const generatePlanContent = () => {
    let content = `${planForm.name}\n\n`;
    if (planForm.date_range_start && planForm.date_range_end) {
      content += `Date Range: ${planForm.date_range_start} to ${planForm.date_range_end}\n\n`;
    }
    if (planForm.goals.filter(g => g.trim()).length > 0) {
      content += `Goals:\n${planForm.goals.filter(g => g.trim()).map(g => `- ${g}`).join('\n')}\n\n`;
    }
    if (planForm.focus_kpis.filter(k => k.trim()).length > 0) {
      content += `Focus KPIs:\n${planForm.focus_kpis.filter(k => k.trim()).map(k => `- ${k}`).join('\n')}\n\n`;
    }
    if (planForm.action_items.filter(a => a.trim()).length > 0) {
      content += `Action Items:\n${planForm.action_items.filter(a => a.trim()).map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n`;
    }
    if (planForm.success_metrics.filter(s => s.trim()).length > 0) {
      content += `Success Metrics:\n${planForm.success_metrics.filter(s => s.trim()).map(s => `- ${s}`).join('\n')}\n\n`;
    }
    if (planForm.notes.trim()) {
      content += `Notes:\n${planForm.notes}\n`;
    }
    return content;
  };

  const handleEditPlan = (plan) => {
    setPlanForm({
      name: plan.name || '',
      goals: plan.goals && plan.goals.length > 0 ? plan.goals : [''],
      focus_kpis: plan.focus_kpis && plan.focus_kpis.length > 0 ? plan.focus_kpis : [''],
      action_items: plan.action_items && plan.action_items.length > 0 ? plan.action_items : [''],
      success_metrics: plan.success_metrics && plan.success_metrics.length > 0 ? plan.success_metrics : [''],
      notes: plan.notes || '',
      date_range_start: plan.date_range_start || '',
      date_range_end: plan.date_range_end || '',
      plan_type: plan.plan_type || 'custom',
      template_id: plan.template_id
    });
    setEditingPlan(plan.id);
    setShowBuilder(true);
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const { error } = await supabase
        .from('coaching_plans')
        .delete()
        .eq('id', planId);

      if (!error) {
        setCoachingPlans(coachingPlans.filter(p => p.id !== planId));
        toast.success('Plan deleted successfully');
      }
    } catch (e) {
      console.error('Error deleting plan:', e);
      toast.error('Failed to delete plan');
    }
  };

  const handleAssignPlan = (plan) => {
    setPlanToAssign(plan);
    setSelectedMembers([]);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    try {
      const assignments = selectedMembers.map(memberId => ({
        plan_id: planToAssign.id,
        assigned_to: memberId,
        assigned_by: user.id,
        status: 'active'
      }));

      const { error } = await supabase
        .from('coaching_plan_assignments')
        .insert(assignments);

      if (!error) {
        toast.success(`Plan assigned to ${selectedMembers.length} member(s)`);
        setShowAssignModal(false);
        setPlanToAssign(null);
        setSelectedMembers([]);
      }
    } catch (e) {
      console.error('Error assigning plan:', e);
      toast.error('Failed to assign plan');
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
      const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email, role').or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`).limit(5);
      if (profiles) {
        profiles.forEach((profile) => {
          results.push({ type: 'User', title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email, subtitle: profile.role, link: `/profile?user=${profile.id}`, icon: '👤' });
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadCoachingPlans();
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Coaching Plans</h1>
            <p className="text-gray-500 text-sm">Create, manage, and assign structured coaching plans</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchResults(true)} className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result,idx) => (
                    <button key={idx} onClick={() => { navigate(result.link); setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors">
                      <div className="flex items-start gap-3"><span className="text-xl">{result.icon}</span><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-900">{result.title}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{result.type}</span></div>{result.subtitle && <div className="text-[11px] text-gray-500 mt-0.5 truncate">{result.subtitle}</div>}</div></div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-gray-500 text-center">No results found</div></div>}
              {searching && <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50"><div className="text-sm text-gray-500 text-center">Searching...</div></div>}
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
              onFilterClick={() => setFiltersOpen(true)}
            onConfigureClick={() => setConfigPanelOpen(true)}
            onExportClick={() => {}}
            onNotificationsClick={openPanel}
            exportDisabled={false}
            configureDisabled={false}
            notificationBadge={unreadCount}
            actions={[
              {
                label: 'Use Template',
                onClick: () => setShowTemplates(true),
              },
              {
                label: 'Create Custom Plan',
                onClick: () => {
                  resetPlanForm();
                  setShowBuilder(true);
                },
              }
            ]}
          />
        </div>
      </div>

      {/* Coaching Plan Builder */}
        {showBuilder && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingPlan ? 'Edit Coaching Plan' : 'Create Coaching Plan'}
                </h3>
                <p className="text-xs text-gray-500">Build a structured coaching plan</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowBuilder(false);
                    resetPlanForm();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Plan Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Q1 Pipeline Acceleration Plan"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={planForm.date_range_start}
                    onChange={(e) => setPlanForm({ ...planForm, date_range_start: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={planForm.date_range_end}
                    onChange={(e) => setPlanForm({ ...planForm, date_range_end: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Goals */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Goals (1-3)
                  </label>
                  <button
                    onClick={() => addArrayField('goals')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Goal
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.goals.map((goal, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={goal}
                        onChange={(e) => updateArrayField('goals', index, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Increase pipeline by 25% this quarter"
                      />
                      {planForm.goals.length > 1 && (
                        <button
                          onClick={() => removeArrayField('goals', index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Focus KPIs with Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Focus KPIs (2-5)
                  </label>
                  <button
                    onClick={() => addArrayField('focus_kpis')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add KPI
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.focus_kpis.map((kpi, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        value={kpi}
                        onChange={(e) => handleFocusKpiChange(index, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a KPI...</option>
                        {availableKPIs.map(k => (
                          <option key={k} value={k}>
                            {k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </option>
                        ))}
                      </select>
                      {planForm.focus_kpis.length > 1 && (
                        <button
                          onClick={() => removeArrayField('focus_kpis', index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Action Items
                  </label>
                  <button
                    onClick={() => addArrayField('action_items')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Action
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.action_items.map((action, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={action}
                        onChange={(e) => updateArrayField('action_items', index, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Action item ${index + 1}`}
                      />
                      {planForm.action_items.length > 1 && (
                        <button
                          onClick={() => removeArrayField('action_items', index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Metrics */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Success Metrics
                  </label>
                  <button
                    onClick={() => addArrayField('success_metrics')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Metric
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.success_metrics.map((metric, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={metric}
                        onChange={(e) => updateArrayField('success_metrics', index, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., Achieve 20% conversion rate"
                      />
                      {planForm.success_metrics.length > 1 && (
                        <button
                          onClick={() => removeArrayField('success_metrics', index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={planForm.notes}
                  onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes or context..."
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowBuilder(false);
                    resetPlanForm();
                  }}
                  className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePlan}
                  disabled={savingPlan}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingPlan ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Save Plan')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved Coaching Plans */}
        <div id="saved-plans" className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Saved Plans</h3>
            <p className="text-xs text-gray-500">View and manage all coaching plans</p>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading plans...</div>
            ) : coachingPlans.length === 0 ? (
              <div className="text-center py-12">
                <Target className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 mb-4">No coaching plans yet</p>
                <button
                  onClick={() => setShowBuilder(true)}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Your First Plan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coachingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{plan.name}</h4>
                        <p className="text-xs text-gray-500">
                          {new Date(plan.created_at).toLocaleDateString()}
                        </p>
                        {plan.date_range_start && plan.date_range_end && (
                          <p className="text-xs text-gray-500">
                            {plan.date_range_start} → {plan.date_range_end}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        plan.plan_type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {plan.plan_type === 'auto' ? 'Template' : 'Custom'}
                      </span>
                    </div>

                    {plan.focus_kpis && plan.focus_kpis.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Focus KPIs:</div>
                        <div className="flex flex-wrap gap-1">
                          {plan.focus_kpis.slice(0, 2).map((kpi, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              {kpi.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {plan.focus_kpis.length > 2 && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                              +{plan.focus_kpis.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedPlan(plan)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                      >
                        <Target size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                        title="Edit Plan"
                      >
                        <Edit size={14} />
                      </button>
                      {canManagePlans && (
                        <button
                          onClick={() => handleAssignPlan(plan)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-600 border border-green-600 rounded-md hover:bg-green-50"
                          title="Assign to Members"
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                        title="Delete Plan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Plan Detail Modal */}
        {selectedPlan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setSelectedPlan(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedPlan.name}</h3>
                  {selectedPlan.date_range_start && selectedPlan.date_range_end && (
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedPlan.date_range_start} to {selectedPlan.date_range_end}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {selectedPlan.goals && selectedPlan.goals.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Goals</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {selectedPlan.goals.map((goal, idx) => (
                        <li key={idx}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedPlan.focus_kpis && selectedPlan.focus_kpis.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Focus KPIs</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlan.focus_kpis.map((kpi, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {kpi.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedPlan.action_items && selectedPlan.action_items.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Action Items</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                      {selectedPlan.action_items.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {selectedPlan.success_metrics && selectedPlan.success_metrics.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Success Metrics</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {selectedPlan.success_metrics.map((metric, idx) => (
                        <li key={idx}>{metric}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedPlan.notes && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedPlan.notes}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setSelectedPlan(null);
                    handleEditPlan(selectedPlan);
                  }}
                  className="px-4 py-2 text-sm font-semibold border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
                >
                  Edit Plan
                </button>
                {canManagePlans && (
                  <button
                    onClick={() => {
                      setSelectedPlan(null);
                      handleAssignPlan(selectedPlan);
                    }}
                    className="px-4 py-2 text-sm font-semibold border border-green-600 text-green-600 rounded-md hover:bg-green-50"
                  >
                    Assign Plan
                  </button>
                )}
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assignment Modal */}
        {showAssignModal && planToAssign && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowAssignModal(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Assign Plan</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Select team members to assign <strong>{planToAssign.name}</strong>
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {teamMembers.map(member => (
                    <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, member.id]);
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.id));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-xs text-gray-500">{member.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignments}
                  disabled={selectedMembers.length === 0}
                  className={`px-4 py-2 text-sm font-semibold rounded-md ${
                    selectedMembers.length > 0
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Assign to {selectedMembers.length} Member{selectedMembers.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Template Selection Modal */}
        <CoachingPlanTemplatesModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onTemplateSelect={handleTemplateSelect}
        />

        <ConfigurePanel
          isOpen={configPanelOpen}
          onClose={() => setConfigPanelOpen(false)}
          onOpenAdvanced={() => setShowConfigModal(true)}
        />
        <ConfigureModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />
        <RightFilterPanel
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Plan Filters"
          subtitle="Filter coaching plans"
          showReset
        >
          <div className="text-xs text-gray-500">Filters coming soon</div>
        </RightFilterPanel>
      </div>
    </DashboardLayout>
  );
}
