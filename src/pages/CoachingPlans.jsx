import React, { useState, useEffect } from 'react';
import { backendFetch } from '../utils/backendFetch';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import ConfigureModal from '../components/ConfigureModal';
import CoachingPlanTemplatesModal from '../components/CoachingPlanTemplatesModal';
import ConfirmModal from '../components/ConfirmModal';
import PlanBuilderForm from '../components/coaching/PlanBuilderForm';
import PlanCard from '../components/coaching/PlanCard';
import PlanDetailModal from '../components/coaching/PlanDetailModal';
import AssignPlanModal from '../components/coaching/AssignPlanModal';
import { statusConfig } from '../components/coaching/planStatusConfig';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabaseClient';
import { Target, Calendar, Users, Download, Mail, Share2, Plus, Edit, Trash2, UserPlus, Sparkles, Loader2 } from 'lucide-react';

export default function CoachingPlans() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { openPanel, unreadCount, addNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [draftingField, setDraftingField] = useState(null); // track which field is being AI-drafted
  const [assignmentStatuses, setAssignmentStatuses] = useState({}); // planId -> { userId -> status }
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, plan: null, isLoading: false });

  // AI Draft helper — calls Supabase Edge Function
  const handleAiDraft = async (field) => {
    setDraftingField(field);
    try {
      const { data, error } = await supabase.functions.invoke('ai-draft', {
        body: {
          field,
          planName: planForm.name,
          focusKpis: planForm.focus_kpis.filter(Boolean),
          existingGoals: planForm.goals.filter(g => g.trim()),
          existingActions: planForm.action_items.filter(a => a.trim()),
          existingMetrics: planForm.success_metrics.filter(s => s.trim()),
          notes: planForm.notes,
        },
      });
      if (error) {
        // Try to extract the actual error message from the edge function response
        let errMsg = 'AI draft request failed';
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            errMsg = body?.error || error.message || errMsg;
          } else {
            errMsg = error.message || errMsg;
          }
        } catch (_) {
          errMsg = error.message || errMsg;
        }
        throw new Error(errMsg);
      }
      const { result } = data;

      if (field === 'name') {
        setPlanForm(prev => ({ ...prev, name: result }));
      } else if (field === 'notes') {
        setPlanForm(prev => ({ ...prev, notes: result }));
      } else if (Array.isArray(result)) {
        // For array fields (goals, action_items, success_metrics), merge with existing non-empty values
        setPlanForm(prev => {
          const existing = prev[field].filter(v => v.trim());
          const merged = [...existing, ...result];
          return { ...prev, [field]: merged.length > 0 ? merged : [''] };
        });
      }
      toast.success(`AI draft generated for ${field.replace(/_/g, ' ')}!`);
    } catch (err) {
      console.error('AI draft error:', err);
      toast.error(err.message || 'Failed to generate AI draft');
    } finally {
      setDraftingField(null);
    }
  };

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
  const isPowerUser = role === 'power_user';
  const canManagePlans = hasPermission('manage_coaching_plans') || isAdmin || isManager;
  const canCreatePlans = isAdmin || isManager || role === 'coach'; // power_user cannot create/edit/delete

  // Available KPIs for dropdown — loaded from the org's kpi_metrics table.
  // Fallback defaults cover the case where no metrics are configured yet.
  const DEFAULT_KPIS = [
    'pipeline_created', 'sourced_opps', 'call_connects', 'meetings',
    'talk_time_minutes', 'emails_sent', 'demos_completed', 'win_rate',
    'response_time', 'follow_ups', 'stage2_opps', 'qualified_leads', 'social_touches'
  ];
  const [availableKPIs, setAvailableKPIs] = useState(DEFAULT_KPIS);

  useEffect(() => {
    // kpi_metrics is a global table (no organization_id) — no filter needed
    supabase
      .from('kpi_metrics')
      .select('key')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data?.length > 0) {
          setAvailableKPIs(data.map(k => k.key).filter(Boolean));
        }
      });
  }, []);

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
  }, []);

  // Load team members once we know the user has permission (role loads async)
  useEffect(() => {
    if (canManagePlans) {
      loadTeamMembers();
    }
  }, [canManagePlans]);

  // Load assignment statuses for all plans
  const loadAssignmentStatuses = async (plans) => {
    try {
      const planIds = plans.filter(p => p.assigned_to?.length > 0).map(p => p.id);
      if (planIds.length === 0) return;
      const { data, error } = await supabase
        .from('coaching_plan_assignments')
        .select('plan_id, assigned_to, status, completed_at')
        .in('plan_id', planIds);
      if (!error && data) {
        const statusMap = {};
        data.forEach(a => {
          if (!statusMap[a.plan_id]) statusMap[a.plan_id] = {};
          statusMap[a.plan_id][a.assigned_to] = a.status;
        });
        setAssignmentStatuses(statusMap);
      }
    } catch (e) {
      console.error('Error loading assignment statuses:', e);
    }
  };

  // Get aggregated status for a plan
  const getPlanStatus = (plan) => {
    const statuses = assignmentStatuses[plan.id];
    if (!statuses || !plan.assigned_to?.length) return plan.status || 'draft';
    const values = Object.values(statuses);
    if (values.every(s => s === 'completed')) return 'completed';
    if (values.some(s => s === 'active' || s === 'in_progress')) return 'in_progress';
    return plan.status || 'active';
  };

  // Get the current user's assignment status for a plan
  const getMyAssignmentStatus = (plan) => {
    return assignmentStatuses[plan.id]?.[user?.id] || 'active';
  };

  // Handle status change by assigned user — notifies manager
  const handleStatusChange = async (plan, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
      const { error } = await supabase
        .from('coaching_plan_assignments')
        .update(updateData)
        .eq('plan_id', plan.id)
        .eq('assigned_to', user.id);
      if (error) throw error;

      // Update local state
      setAssignmentStatuses(prev => ({
        ...prev,
        [plan.id]: { ...prev[plan.id], [user.id]: newStatus }
      }));

      const userName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : user?.email || 'A team member';
      const statusLabel = newStatus === 'completed' ? 'completed' : 'marked as in progress';

      // Notify the plan creator (manager)
      if (plan.created_by && plan.created_by !== user.id) {
        addNotification({
          type: 'coaching_plan',
          title: `Coaching Plan ${newStatus === 'completed' ? 'Completed' : 'In Progress'}`,
          message: `${userName} has ${statusLabel} the coaching plan: "${plan.name}"`,
          link: `/coaching-plans?planId=${plan.id}`,
          ownerId: plan.created_by,
          audience: 'team',
          dedupeKey: `coaching-status-${plan.id}-${user.id}-${newStatus}-${Date.now()}`,
          repName: userName,
        });
      }

      toast.success(newStatus === 'completed'
        ? 'Coaching plan marked as completed!'
        : 'Status updated to In Progress');
    } catch (e) {
      console.error('Error updating status:', e);
      toast.error('Failed to update status');
    }
  };

  // Time-based notification checks — runs at most once per browser session per user.
  // Without this guard the check fires on every page load, spamming duplicate notifications.
  const checkTimeBasedNotifications = (plans) => {
    if (!canManagePlans) return;
    const sessionKey = `apptivia.notifChecked.${user?.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    plans.forEach(plan => {
      if (!plan.assigned_to?.length) return;
      const planStatuses = assignmentStatuses[plan.id] || {};

      // Check each assigned member
      plan.assigned_to.forEach(memberId => {
        const memberStatus = planStatuses[memberId] || 'active';
        const member = teamMembers.find(m => m.id === memberId);
        const memberName = member
          ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email
          : 'A team member';

        // 1) Not started within 2 days of start date
        if (plan.date_range_start && memberStatus === 'active') {
          const startDate = new Date(plan.date_range_start);
          const twoDaysAfterStart = new Date(startDate);
          twoDaysAfterStart.setDate(twoDaysAfterStart.getDate() + 2);
          if (now >= twoDaysAfterStart) {
            addNotification({
              type: 'coaching_plan',
              title: 'Coaching Plan Not Started',
              message: `${memberName} has not started the coaching plan "${plan.name}" (started ${plan.date_range_start})`,
              link: `/coaching-plans?planId=${plan.id}`,
              ownerId: plan.created_by || user.id,
              audience: 'team',
              dedupeKey: `coaching-notstarted-${plan.id}-${memberId}`,
              repName: memberName,
            });
          }
        }

        // 2) Deadline approaching (within 2 days)
        if (plan.date_range_end && memberStatus !== 'completed') {
          const endDate = new Date(plan.date_range_end);
          const twoDaysBefore = new Date(endDate);
          twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
          if (now >= twoDaysBefore && now <= endDate) {
            addNotification({
              type: 'coaching_plan',
              title: 'Coaching Plan Deadline Approaching',
              message: `${memberName}'s coaching plan "${plan.name}" is due on ${plan.date_range_end}`,
              link: `/coaching-plans?planId=${plan.id}`,
              ownerId: plan.created_by || user.id,
              audience: 'team',
              dedupeKey: `coaching-approaching-${plan.id}-${memberId}`,
              repName: memberName,
            });
          }
        }

        // 3) Deadline missed
        if (plan.date_range_end && memberStatus !== 'completed') {
          const endDate = new Date(plan.date_range_end);
          if (now > endDate) {
            addNotification({
              type: 'coaching_plan',
              title: 'Coaching Plan Overdue',
              message: `${memberName} did not complete the coaching plan "${plan.name}" by the deadline (${plan.date_range_end})`,
              link: `/coaching-plans?planId=${plan.id}`,
              ownerId: plan.created_by || user.id,
              audience: 'team',
              dedupeKey: `coaching-overdue-${plan.id}-${memberId}`,
              repName: memberName,
            });
          }
        }
      });
    });
  };

  // Deep-link: auto-open a specific plan from URL ?planId=xxx
  useEffect(() => {
    const planId = searchParams.get('planId');
    if (planId && coachingPlans.length > 0 && !selectedPlan) {
      const target = coachingPlans.find(p => p.id === planId);
      if (target) {
        setSelectedPlan(target);
        // Clear the param so refresh doesn't re-open
        searchParams.delete('planId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [coachingPlans, searchParams]);

  // Time-based notifications: check when plans + assignment statuses + team members are loaded
  useEffect(() => {
    if (coachingPlans.length > 0 && Object.keys(assignmentStatuses).length > 0 && teamMembers.length > 0) {
      checkTimeBasedNotifications(coachingPlans);
    }
  }, [coachingPlans, assignmentStatuses, teamMembers]);

  const loadCoachingPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coaching_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        setCoachingPlans(data);
        loadAssignmentStatuses(data);
      }
    } catch (e) {
      console.error('Error loading coaching plans:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .order('first_name');

      // Managers: only load members from their team
      if (isManager && !isAdmin && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }
      // Admins: load all members (no filter)

      const { data, error } = await query;
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

  // Build the save payload using structured columns (no text blob duplication).
  // The contentKey fallback is only used by the base-schema path below.
  const buildPlanPayload = () => {
    return {
      name: planForm.name,
      plan_type: planForm.plan_type,
      template_id: planForm.template_id || null,
      created_by: user?.id,
      goals: planForm.goals.filter(g => g.trim()),
      focus_kpis: planForm.focus_kpis.filter(k => k.trim()),
      action_items: planForm.action_items.filter(a => a.trim()),
      success_metrics: planForm.success_metrics.filter(s => s.trim()),
      notes: planForm.notes,
      date_range_start: planForm.date_range_start || null,
      date_range_end: planForm.date_range_end || null,
      team_id: profile?.team_id || null,
    };
  };

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

      const runQuery = (planData) => {
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

      // Primary path: save structured fields (goals, action_items, etc.)
      let result = await runQuery(buildPlanPayload());

      // Fallback: enhanced columns don't exist → retry with base columns + text blob
      if (result.error && (
        isMissingColumnError(result.error, 'action_items') ||
        isMissingColumnError(result.error, 'goals') ||
        isMissingColumnError(result.error, 'focus_kpis') ||
        isMissingColumnError(result.error, 'success_metrics')
      )) {
        // Try content column first, then plan_text
        const baseData = { name: planForm.name, plan_type: planForm.plan_type, created_by: user?.id, content: generatePlanContent() };
        result = await runQuery(baseData);
        if (result.error && isMissingColumnError(result.error, 'content')) {
          result = await runQuery({ ...baseData, content: undefined, plan_text: generatePlanContent() });
        }
        if (!result.error) {
          toast.info('Plan saved with limited data. Run migration 027 in Supabase to enable all fields.');
        }
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

  const handleDeletePlan = async (plan) => {
    setDeleteConfirm({ isOpen: true, plan, isLoading: false });
  };

  const confirmDeletePlan = async () => {
    const planId = deleteConfirm.plan?.id;
    if (!planId) return;
    
    setDeleteConfirm(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase
        .from('coaching_plans')
        .delete()
        .eq('id', planId);

      setDeleteConfirm({ isOpen: false, plan: null, isLoading: false });
      
      if (!error) {
        setCoachingPlans(coachingPlans.filter(p => p.id !== planId));
        toast.success('Plan deleted successfully');
      }
    } catch (e) {
      console.error('Error deleting plan:', e);
      toast.error('Failed to delete plan');
      setDeleteConfirm({ isOpen: false, plan: null, isLoading: false });
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

      if (error) throw error;

      // Also update the assigned_to array on the plan itself
      const currentAssigned = planToAssign.assigned_to || [];
      const newAssigned = [...new Set([...currentAssigned, ...selectedMembers])];
      await supabase
        .from('coaching_plans')
        .update({ assigned_to: newAssigned })
        .eq('id', planToAssign.id);

      // Update local state
      setCoachingPlans(prev => prev.map(p =>
        p.id === planToAssign.id ? { ...p, assigned_to: newAssigned } : p
      ));

      // Get assigned member details for email + notification
      const assignedMembers = teamMembers.filter(m => selectedMembers.includes(m.id));
      const managerName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : user?.email || 'Your manager';

      // Send in-app notifications
      assignedMembers.forEach(member => {
        addNotification({
          type: 'coaching_plan',
          title: 'New Coaching Plan Assigned',
          message: `${managerName} assigned you the coaching plan: "${planToAssign.name}"`,
          link: `/coaching-plans?planId=${planToAssign.id}`,
          ownerId: member.id,
          audience: 'self',
          dedupeKey: `coaching-assign-${planToAssign.id}-${member.id}`,
          repName: member.first_name || member.email,
        });
      });

      // Send email notifications
      const recipientEmails = assignedMembers.map(m => m.email).filter(Boolean);
      if (recipientEmails.length > 0) {
        try {
          const planContent = [
            `You have been assigned a new coaching plan by ${managerName}.`,
            '',
            `Plan: ${planToAssign.name}`,
            planToAssign.date_range_start && planToAssign.date_range_end
              ? `Date Range: ${planToAssign.date_range_start} to ${planToAssign.date_range_end}`
              : '',
            '',
            planToAssign.goals?.length > 0 ? `Goals:\n${planToAssign.goals.map(g => `  - ${g}`).join('\n')}` : '',
            planToAssign.focus_kpis?.length > 0 ? `\nFocus KPIs:\n${planToAssign.focus_kpis.map(k => `  - ${k.replace(/_/g, ' ')}`).join('\n')}` : '',
            planToAssign.action_items?.length > 0 ? `\nAction Items:\n${planToAssign.action_items.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}` : '',
            planToAssign.success_metrics?.length > 0 ? `\nSuccess Metrics:\n${planToAssign.success_metrics.map(s => `  - ${s}`).join('\n')}` : '',
            planToAssign.notes ? `\nNotes:\n${planToAssign.notes}` : '',
            '',
            'Log in to Apptivia to view the full plan.'
          ].filter(Boolean).join('\n');

          await backendFetch('/api/send-coaching-plan', {
            recipients: recipientEmails,
            subject: `Coaching Plan Assigned: ${planToAssign.name}`,
            body: planContent,
          });
        } catch (emailErr) {
          console.warn('Email notification failed (plan still assigned):', emailErr);
        }
      }

      toast.success(`Plan assigned to ${selectedMembers.length} member(s) — notifications sent!`);
      setShowAssignModal(false);
      setPlanToAssign(null);
      setSelectedMembers([]);
    } catch (e) {
      console.error('Error assigning plan:', e);
      toast.error(e?.message || 'Failed to assign plan');
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
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, plan: null, isLoading: false })}
        onConfirm={confirmDeletePlan}
        title="Delete Coaching Plan?"
        message={`Are you sure you want to delete "${deleteConfirm.plan?.title || 'this plan'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteConfirm.isLoading}
      />
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
            actions={canCreatePlans ? [
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
            ] : []}
          />
        </div>
      </div>

      {/* Saved Plans header with persistent Create button */}
      <div className="flex items-center justify-between mb-4">
        <div />
        {canCreatePlans && (
          <button
            onClick={() => {
              resetPlanForm();
              setShowBuilder(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Create Coaching Plan
          </button>
        )}
      </div>

      {/* Coaching Plan Builder */}
        {showBuilder && canCreatePlans && (
          <PlanBuilderForm
            editingPlan={editingPlan}
            planForm={planForm}
            setPlanForm={setPlanForm}
            handleSavePlan={handleSavePlan}
            savingPlan={savingPlan}
            draftingField={draftingField}
            handleAiDraft={handleAiDraft}
            availableKPIs={availableKPIs}
            handleFocusKpiChange={handleFocusKpiChange}
            addArrayField={addArrayField}
            updateArrayField={updateArrayField}
            removeArrayField={removeArrayField}
            onCancel={() => { setShowBuilder(false); resetPlanForm(); }}
          />
        )}


        {/* Saved Coaching Plans */}
        <div id="saved-plans" className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Saved Plans</h3>
              <p className="text-xs text-gray-500">
                {isPowerUser ? 'Coaching plans assigned to you' : 'View and manage all coaching plans'}
              </p>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading plans...</div>
            ) : coachingPlans.length === 0 ? (
              <div className="text-center py-12">
                <Target className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 mb-4">
                  {isPowerUser ? 'No coaching plans have been assigned to you yet' : 'No coaching plans yet'}
                </p>
                {canCreatePlans && (
                  <button
                    onClick={() => setShowBuilder(true)}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Your First Plan
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coachingPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    canCreatePlans={canCreatePlans}
                    canManagePlans={canManagePlans}
                    assignmentStatuses={assignmentStatuses}
                    user={user}
                    isPowerUser={isPowerUser}
                    getPlanStatus={getPlanStatus}
                    onView={setSelectedPlan}
                    onEdit={handleEditPlan}
                    onAssign={handleAssignPlan}
                    onDelete={handleDeletePlan}
                  />
                ))}
              </div>
            )}
          </div>
        </div>


        {selectedPlan && (
          <PlanDetailModal
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            canCreatePlans={canCreatePlans}
            canManagePlans={canManagePlans}
            assignmentStatuses={assignmentStatuses}
            teamMembers={teamMembers}
            user={user}
            isPowerUser={isPowerUser}
            getMyAssignmentStatus={getMyAssignmentStatus}
            handleStatusChange={handleStatusChange}
            onEdit={handleEditPlan}
            onAssign={handleAssignPlan}
          />
        )}

        {showAssignModal && planToAssign && (
          <AssignPlanModal
            plan={planToAssign}
            teamMembers={teamMembers}
            selectedMembers={selectedMembers}
            setSelectedMembers={setSelectedMembers}
            onSave={handleSaveAssignments}
            onClose={() => setShowAssignModal(false)}
          />
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
