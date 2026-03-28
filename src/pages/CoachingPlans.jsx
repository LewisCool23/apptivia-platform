import React, { useState, useEffect, useMemo, useRef } from 'react';
import { backendFetch } from '../utils/backendFetch';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
import ShareCoachingPlanSnapshotModal from '../components/coaching/ShareCoachingPlanSnapshotModal';
import IdpTab from '../components/coaching/IdpTab';
import ReviewTab from '../components/coaching/ReviewTab';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabaseClient';
import { buildCoachingPlanEmailHtml, buildCoachingPlanEmailText, parseEnrichedContent, buildEnrichedContent } from '../utils/emailTemplates';
import { KPI_GUIDANCE, buildLabel } from '../constants/kpiGuidance';
import { estimateSkillsetXp } from '../constants/skillsets';
import { fetchScorecardDataForTeam, fetchHistoricalScoresForTeam } from '../utils/scorecardFetch';
import { buildPlaybookSummary } from '../components/DataDrivenPlaybook';
import { Target, Calendar, Users, Download, Mail, Share2, Plus, Edit, Trash2, UserPlus } from 'lucide-react';

export default function CoachingPlans() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [statusTab, setStatusTab] = useState('all');
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [assignmentStatuses, setAssignmentStatuses] = useState({}); // planId -> { userId -> status }
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, plan: null, isLoading: false });
  const [planToShare, setPlanToShare] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareNotes, setShareNotes] = useState('');
  const [sharingPlan, setSharingPlan] = useState(false);
  const [savedCoachingContext, setSavedCoachingContext] = useState(null); // coaching context for enriched content on save
  const [planFor, setPlanFor] = useState({ type: 'individual', memberId: null }); // who is this plan for?
  const [activeTab, setActiveTab] = useState('rep-plans'); // 'rep-plans' | 'playbooks'
  const [managers, setManagers] = useState([]);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [skillsetPreview, setSkillsetPreview] = useState(null);
  const [fulfillingRequestId, setFulfillingRequestId] = useState(null);
  const [planRequests, setPlanRequests] = useState([]);
  const [planRequestsLoading, setPlanRequestsLoading] = useState(false);
  const [snapshotPlan, setSnapshotPlan] = useState(null);

  // Auto-generate a complete coaching plan when a person is selected.
  // For Rep Plans: fetches the rep's KPI data, generates a rep-specific plan, and builds skillset preview.
  // For Manager Playbooks: fetches full team scorecard + 5-week trends via scorecardFetch, runs buildPlaybookSummary.
  const handleAutoGenerate = async (personId, isPlaybook = false) => {
    if (!personId || autoGenerating) return;
    setAutoGenerating(true);
    setSkillsetPreview(null);
    try {
      // 1. Fetch KPI metrics (scorecard KPIs with goals)
      const { data: kpiDefs } = await supabase
        .from('kpi_metrics')
        .select('id, key, name, goal, weight, show_on_scorecard, direction')
        .eq('is_active', true);
      if (!kpiDefs?.length) throw new Error('No KPI metrics found');

      // 2. Compute current week boundaries
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      const lastMonday = new Date(monday.getTime() - 7 * 86400000);
      const lastSunday = new Date(monday.getTime() - 86400000);
      const fmtDate = d => d.toISOString().split('T')[0];

      let audienceLabel = '';
      let currentScore = 0;
      let laggingKpis = [];
      let onTrackCount = 0;
      let exceedingCount = 0;
      let playbookInsights = null;

      if (isPlaybook) {
        // ── Manager Playbook: rich data via scorecardFetch + buildPlaybookSummary ──
        const mgr = managers.find(m => m.id === personId);
        if (!mgr?.team_id) throw new Error('Manager has no team assigned');
        audienceLabel = `${mgr.first_name} ${mgr.last_name}'s Team`;

        // Fetch full scorecard + historical data in parallel
        const [currentWeekData, lastWeekData, historicalResult] = await Promise.all([
          fetchScorecardDataForTeam(mgr.team_id, fmtDate(monday), fmtDate(sunday)),
          fetchScorecardDataForTeam(mgr.team_id, fmtDate(lastMonday), fmtDate(lastSunday)),
          fetchHistoricalScoresForTeam(mgr.team_id, 5),
        ]);

        // Use buildPlaybookSummary for rich insights (team weaknesses, reps needing coaching, trends)
        playbookInsights = buildPlaybookSummary(
          currentWeekData,
          historicalResult.data,
          historicalResult.repNames,
          lastWeekData
        );

        currentScore = currentWeekData.teamAverage || lastWeekData.teamAverage || 0;

        // Extract lagging KPIs from playbook insights
        laggingKpis = (playbookInsights.teamWeaknesses || []).map(w => ({
          key: w.key,
          label: w.label,
          percentage: w.avgPct,
          tier: w.tier,
          tierLabel: w.tierLabel,
        }));

        // Count on-track / exceeding from scorecard rows
        const useData = currentWeekData.rows?.length > 0 ? currentWeekData : lastWeekData;
        (useData.scorecardKpiKeys || []).forEach(kpiKey => {
          const avgPcts = (useData.rows || []).map(r => r.kpis?.[kpiKey]?.percentage || 0);
          const avg = avgPcts.length > 0 ? avgPcts.reduce((s, v) => s + v, 0) / avgPcts.length : 0;
          if (avg >= 100) exceedingCount++;
          else if (avg >= 80) onTrackCount++;
        });
      } else {
        // ── Rep Plan: single rep KPI data ──
        const rep = teamMembers.find(m => m.id === personId);
        audienceLabel = rep ? `${rep.first_name} ${rep.last_name}` : 'Rep';

        const { data: kpiVals } = await supabase
          .from('kpi_values')
          .select('kpi_id, profile_id, value')
          .eq('profile_id', personId)
          .gte('period_start', fmtDate(lastMonday))
          .lte('period_end', fmtDate(sunday));

        const scorecardKpis = kpiDefs.filter(k => k.show_on_scorecard);
        const kpiSums = {};
        (kpiVals || []).forEach(v => {
          if (!kpiSums[v.kpi_id]) kpiSums[v.kpi_id] = 0;
          kpiSums[v.kpi_id] += v.value || 0;
        });

        const numWeeks = 2;
        let totalWeightedPct = 0;
        let totalWeight = 0;

        scorecardKpis.forEach(metric => {
          const rawSum = kpiSums[metric.id] || 0;
          const weeklyAvg = rawSum / numWeeks;
          const dir = metric.direction || 'higher';
          const pct = metric.goal > 0
            ? Math.round(dir === 'lower' ? (weeklyAvg > 0 ? Math.min((metric.goal / weeklyAvg) * 100, 200) : 200) : (weeklyAvg / metric.goal) * 100)
            : 0;
          const weight = metric.weight || 0;
          totalWeightedPct += pct * weight;
          totalWeight += weight;

          const guidance = KPI_GUIDANCE[metric.key];
          const tier = guidance?.tier || 4;
          const tierLabel = tier === 1 ? 'Scorecard Priority' : tier === 2 ? 'Core Skill' : tier === 3 ? 'Engage Adoption' : 'Other';

          if (pct < 80) {
            laggingKpis.push({ key: metric.key, label: buildLabel(metric.key), percentage: pct, tier, tierLabel });
          } else if (pct >= 100) {
            exceedingCount++;
          } else {
            onTrackCount++;
          }
        });

        laggingKpis.sort((a, b) => a.tier - b.tier || a.percentage - b.percentage);
        currentScore = totalWeight > 0 ? Math.round(totalWeightedPct / totalWeight) : 0;
      }

      // 3. Call the backend AI endpoint
      const response = await backendFetch('/api/ai/coaching-plan', {
        audienceLabel,
        currentScore,
        laggingKpis,
        onTrackCount,
        exceedingCount,
        playbookInsights: playbookInsights || {
          teamSize: 1,
          teamTrend: null,
          teamWeaknesses: laggingKpis.map(k => ({
            key: k.key, label: k.label, avgPct: k.percentage,
            belowCount: 1, totalReps: 1, tier: k.tier, tierLabel: k.tierLabel,
            diagnosis: KPI_GUIDANCE[k.key]?.diagnosis || null,
          })),
          repsNeedingCoaching: [],
        },
        mode: isPlaybook ? undefined : 'rep_self_coaching',
      });

      const plan = response?.plan;
      if (!plan) throw new Error('AI did not return a valid plan');

      // 4. Populate form
      setPlanForm({
        name: plan.name || '',
        goals: plan.goals?.length ? plan.goals : [''],
        focus_kpis: plan.focus_kpis?.length ? plan.focus_kpis : [''],
        action_items: plan.action_items?.length ? plan.action_items : [''],
        success_metrics: plan.success_metrics?.length ? plan.success_metrics : [''],
        notes: plan.notes || '',
        date_range_start: planForm.date_range_start,
        date_range_end: planForm.date_range_end,
        plan_type: 'auto',
      });

      // 5. Build skillset impact preview for rep plans
      let skillsetImpactData = null;
      if (!isPlaybook && plan.focus_kpis?.length) {
        try {
          const projected = estimateSkillsetXp(plan.focus_kpis);
          const { data: repSkillsets } = await supabase
            .from('profile_skillsets')
            .select('skillset_key, current_xp, current_level')
            .eq('profile_id', personId);
          const preview = { current: repSkillsets || [], projected };
          setSkillsetPreview(preview);
          skillsetImpactData = preview;
        } catch (skillErr) {
          console.warn('Skillset preview failed:', skillErr);
        }
      }

      // 6. Save coaching context for enriched content on save
      const prioritySkillsets = (skillsetImpactData?.current || []).map(s => ({
        name: buildLabel(s.skillset_key),
        progress: s.current_xp || 0,
      }));
      const xpEstimate = (skillsetImpactData?.projected || []).map(p => ({
        skillset: p.skillset,
        estimatedXp: p.estimatedXp,
      }));
      setSavedCoachingContext({
        currentScore,
        laggingKpis,
        onTrackCount,
        exceedingCount,
        prioritySkillsets,
        xpEstimate,
        skillsetImpact: skillsetImpactData,
      });

      toast.success('AI coaching plan generated! Review and edit as needed.');
    } catch (err) {
      console.error('Auto-generate error:', err);
      toast.error(err.message || 'Failed to generate coaching plan. You can fill in the fields manually.');
    } finally {
      setAutoGenerating(false);
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

  // Pre-fill form from AI-generated plan (navigated with state)
  useEffect(() => {
    const aiPlan = location.state?.aiPlan;
    if (aiPlan) {
      setPlanForm({
        name: aiPlan.name || '',
        goals: aiPlan.goals?.length ? aiPlan.goals : [''],
        focus_kpis: aiPlan.focus_kpis?.length ? aiPlan.focus_kpis : [''],
        action_items: aiPlan.action_items?.length ? aiPlan.action_items : [''],
        success_metrics: aiPlan.success_metrics?.length ? aiPlan.success_metrics : [''],
        notes: aiPlan.notes || '',
        date_range_start: aiPlan.date_range_start || '',
        date_range_end: aiPlan.date_range_end || '',
        plan_type: 'auto',
      });
      // Preserve coaching context for enriched content on save
      if (location.state?.coachingContext) {
        setSavedCoachingContext(location.state.coachingContext);
      }
      setShowBuilder(true);
      // Clear state so refresh doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isPowerUser = role === 'power_user';
  const canManagePlans = hasPermission('manage_coaching_plans') || isAdmin || isManager;
  const canCreatePlans = isAdmin || isManager || role === 'coach'; // power_user cannot create/edit/delete

  // Hash-based tab navigation (e.g. /coaching-plans#idps or #reviews)
  useEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (hash === 'idps' || hash === 'reviews') {
      setActiveTab(hash);
    } else if (isPowerUser && !canManagePlans && activeTab === 'rep-plans') {
      // Power users default to IDPs since they can't see rep-plans/playbooks tabs
      setActiveTab('idps');
    }
  }, [location.hash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter rep members: admins see all reps, managers only see their team's reps
  const filteredRepMembers = useMemo(() => {
    if (!teamMembers?.length) return [];
    const reps = teamMembers.filter(m => !['admin', 'manager', 'coach'].includes(m.role));
    if (isAdmin) return reps;
    // Managers see only their direct team
    return reps.filter(m => m.team_id === profile?.team_id);
  }, [teamMembers, isAdmin, profile?.team_id]);

  // Available KPIs for dropdown — loaded from the org's kpi_metrics table.
  // Fallback defaults cover the case where no metrics are configured yet.
  const DEFAULT_KPIS = [
    'pipeline_created', 'sourced_opps', 'call_connects', 'meetings',
    'talk_time_minutes', 'emails_sent', 'demos_completed', 'win_rate',
    'response_time', 'follow_ups', 'stage2_opps', 'qualified_leads', 'social_touches',
    'talk_to_listen_ratio', 'longest_monologue_sec', 'questions_asked',
    'next_steps_mentioned', 'interactivity_score',
    'sequences_started', 'emails_opened', 'tasks_completed',
    'gifts_sent', 'gifts_accepted', 'gift_influenced_meetings',
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

  // Load team members + managers once we know the user has permission (role loads async)
  useEffect(() => {
    if (canManagePlans) {
      Promise.all([loadTeamMembers(), loadManagers(), loadPlanRequests()]);
    }
  }, [canManagePlans]);

  // Load assignment statuses (+ effectiveness data) for all plans
  const [assignmentEffectiveness, setAssignmentEffectiveness] = useState({}); // planId -> { userId -> { baseline, final, score } }
  const loadAssignmentStatuses = async (plans) => {
    try {
      const planIds = plans.map(p => p.id);
      if (planIds.length === 0) return;
      const { data, error } = await supabase
        .from('coaching_plan_assignments')
        .select('plan_id, assigned_to, status, completed_at, baseline_kpi_snapshot, final_kpi_snapshot, effectiveness_score')
        .in('plan_id', planIds);
      if (!error && data) {
        const statusMap = {};
        const effMap = {};
        data.forEach(a => {
          if (!statusMap[a.plan_id]) statusMap[a.plan_id] = {};
          statusMap[a.plan_id][a.assigned_to] = a.status;
          if (a.effectiveness_score != null || a.baseline_kpi_snapshot || a.final_kpi_snapshot) {
            if (!effMap[a.plan_id]) effMap[a.plan_id] = {};
            effMap[a.plan_id][a.assigned_to] = {
              baseline: a.baseline_kpi_snapshot,
              final: a.final_kpi_snapshot,
              score: a.effectiveness_score,
            };
          }
        });
        setAssignmentStatuses(statusMap);
        setAssignmentEffectiveness(effMap);
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

  // Summary stats for the stats bar and status tabs
  const planStats = useMemo(() => {
    const total = coachingPlans.length;
    const draft = coachingPlans.filter(p => getPlanStatus(p) === 'draft').length;
    const active = coachingPlans.filter(p => getPlanStatus(p) === 'active').length;
    const inProgress = coachingPlans.filter(p => getPlanStatus(p) === 'in_progress').length;
    const completed = coachingPlans.filter(p => getPlanStatus(p) === 'completed').length;
    const effScores = Object.values(assignmentEffectiveness)
      .flatMap(planEff => Object.values(planEff))
      .filter(d => d.score != null)
      .map(d => d.score);
    const avgEffectiveness = effScores.length > 0
      ? Math.round(effScores.reduce((s, v) => s + v, 0) / effScores.length)
      : null;
    return { total, draft, active, inProgress, completed, avgEffectiveness };
  }, [coachingPlans, assignmentStatuses, assignmentEffectiveness]);

  // Filter plans by active tab (rep-plans vs playbooks), status tab, and search query
  const filteredPlans = useMemo(() => {
    let plans = coachingPlans;
    // Filter by main tab: rep-plans = individual visibility, playbooks = team visibility
    if (activeTab === 'playbooks') {
      plans = plans.filter(p => p.visibility === 'team');
    } else {
      plans = plans.filter(p => p.visibility !== 'team');
    }
    if (statusTab !== 'all') {
      plans = plans.filter(p => getPlanStatus(p) === statusTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      plans = plans.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q) ||
        (p.focus_kpis || []).some(k => k.toLowerCase().includes(q)) ||
        (p.goals || []).some(g => g.toLowerCase().includes(q))
      );
    }
    return plans;
  }, [coachingPlans, activeTab, statusTab, searchQuery, assignmentStatuses]);

  // Handle status change by assigned user — notifies manager
  const handleStatusChange = async (plan, newStatus) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }
      // If completing, snapshot final KPIs and compute effectiveness
      if (newStatus === 'completed' && plan.focus_kpis?.length > 0) {
        try {
          const { data: metrics } = await supabase
            .from('kpi_metrics')
            .select('id, key, goal')
            .in('key', plan.focus_kpis)
            .eq('is_active', true);
          if (metrics?.length > 0) {
            const metricIds = metrics.map(m => m.id);
            const now = new Date();
            const weekEnd = now.toISOString().split('T')[0];
            const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
            const { data: vals } = await supabase
              .from('kpi_values')
              .select('kpi_id, value')
              .eq('profile_id', user.id)
              .in('kpi_id', metricIds)
              .gte('period_start', weekStart)
              .lte('period_end', weekEnd);
            const finalSnapshot = {};
            for (const m of metrics) {
              const val = (vals || []).filter(v => v.kpi_id === m.id).reduce((s, v) => s + (v.value || 0), 0);
              finalSnapshot[m.key] = { value: val, pct: m.goal ? Math.round((val / m.goal) * 100) : 0 };
            }
            // Fetch baseline to compute effectiveness
            const { data: assignRow } = await supabase
              .from('coaching_plan_assignments')
              .select('baseline_kpi_snapshot')
              .eq('plan_id', plan.id)
              .eq('assigned_to', user.id)
              .single();
            const baseline = assignRow?.baseline_kpi_snapshot || {};
            const deltas = plan.focus_kpis
              .filter(k => finalSnapshot[k] && baseline[k])
              .map(k => (finalSnapshot[k].pct || 0) - (baseline[k].pct || 0));
            const effScore = deltas.length > 0 ? Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length) : null;
            updateData.final_kpi_snapshot = finalSnapshot;
            if (effScore != null) updateData.effectiveness_score = effScore;
          }
        } catch (effErr) {
          console.warn('Effectiveness snapshot failed:', effErr);
        }
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
      if (newStatus === 'completed' && updateData.effectiveness_score != null) {
        setAssignmentEffectiveness(prev => ({
          ...prev,
          [plan.id]: {
            ...prev[plan.id],
            [user.id]: {
              baseline: updateData.baseline_kpi_snapshot || null,
              final: updateData.final_kpi_snapshot,
              score: updateData.effectiveness_score,
            }
          }
        }));
      }

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

  // Time-based notifications: check once when plans + team members are loaded.
  // Deliberately exclude assignmentStatuses to avoid circular refetch loops.
  const notifCheckDone = useRef(false);
  useEffect(() => {
    if (notifCheckDone.current) return;
    if (coachingPlans.length > 0 && Object.keys(assignmentStatuses).length > 0 && teamMembers.length > 0) {
      notifCheckDone.current = true;
      checkTimeBasedNotifications(coachingPlans);
    }
  }, [coachingPlans, teamMembers, assignmentStatuses]);

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
        await loadAssignmentStatuses(data);
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

      // Load all profiles so assignment names resolve correctly

      const { data, error } = await query;
      if (!error && data) {
        setTeamMembers(data);
      }
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  };

  const loadManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, team_id')
        .eq('role', 'manager')
        .order('first_name');
      if (!error && data) {
        setManagers(data);
      }
    } catch (e) {
      console.error('Error loading managers:', e);
    }
  };

  const loadPlanRequests = async () => {
    setPlanRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('coaching_plan_requests')
        .select('id, requested_by, manager_id, message, current_score, lagging_kpis, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!error && data) setPlanRequests(data);
    } catch (e) {
      console.error('Error loading plan requests:', e);
    } finally {
      setPlanRequestsLoading(false);
    }
  };

  const handleFulfillRequest = (request) => {
    // Pre-fill the builder with the requesting rep
    setPlanFor({ type: 'individual', memberId: request.requested_by });
    setFulfillingRequestId(request.id);
    setShowBuilder(true);
    setActiveTab('rep-plans');
    // Auto-generate for this rep
    handleAutoGenerate(request.requested_by, false);
  };

  const handleDismissRequest = async (requestId) => {
    const { error } = await supabase
      .from('coaching_plan_requests')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (!error) {
      setPlanRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Request dismissed');
    } else {
      toast.error('Failed to dismiss request');
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
    // Default planFor based on which tab is active
    setPlanFor(activeTab === 'playbooks' ? { type: 'team', memberId: null } : { type: 'individual', memberId: null });
    setSkillsetPreview(null);
  };

  // Build the save payload using structured columns (no text blob duplication).
  // The contentKey fallback is only used by the base-schema path below.
  const buildPlanPayload = () => {
    const plainContent = generatePlanContent();
    // If coaching context is available (from AI generation), enrich the content
    const content = savedCoachingContext
      ? buildEnrichedContent(plainContent, savedCoachingContext)
      : plainContent;

    const isPlaybook = activeTab === 'playbooks';
    // For Manager Playbooks: store the manager's team_id and their profile ID in assigned_to
    let teamIdVal = profile?.team_id || null;
    let assignedTo = [];
    if (isPlaybook && planFor.memberId) {
      const mgr = managers.find(m => m.id === planFor.memberId);
      teamIdVal = mgr?.team_id || teamIdVal;
      assignedTo = [planFor.memberId]; // manager can see via RLS: auth.uid() = ANY(assigned_to)
    } else if (!isPlaybook && planFor.memberId) {
      assignedTo = [planFor.memberId];
    }

    return {
      name: planForm.name,
      plan_type: planForm.plan_type,
      template_id: planForm.template_id || null,
      created_by: user?.id,
      content,
      goals: planForm.goals.filter(g => g.trim()),
      focus_kpis: planForm.focus_kpis.filter(k => k.trim()),
      action_items: planForm.action_items.filter(a => a.trim()),
      success_metrics: planForm.success_metrics.filter(s => s.trim()),
      notes: planForm.notes,
      date_range_start: planForm.date_range_start || null,
      date_range_end: planForm.date_range_end || null,
      team_id: teamIdVal,
      visibility: isPlaybook ? 'team' : 'individual',
      assigned_to: assignedTo,
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
        // Create assignment record if a specific rep was selected
        if (planFor.type === 'individual' && planFor.memberId && result.data?.id) {
          try {
            await supabase.from('coaching_plan_assignments').insert([{
              plan_id: result.data.id,
              assigned_to: planFor.memberId,
              assigned_by: user.id,
              status: 'active',
            }]);
            const member = teamMembers.find(m => m.id === planFor.memberId);
            const memberName = member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() : '';
            toast.success(`Plan saved and assigned to ${memberName || 'rep'}!`);
          } catch (assignErr) {
            console.warn('Assignment record creation failed:', assignErr);
            toast.success('Plan saved! Assignment will need to be done manually.');
          }
        } else {
          toast.success('Plan saved successfully! View it in Saved Plans below.');
        }
      }
      setTimeout(() => {
        document.getElementById('saved-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

      // Auto-dismiss the coaching plan request that was fulfilled
      if (fulfillingRequestId) {
        try {
          await supabase
            .from('coaching_plan_requests')
            .update({ status: 'dismissed', updated_at: new Date().toISOString() })
            .eq('id', fulfillingRequestId);
          setPlanRequests(prev => prev.filter(r => r.id !== fulfillingRequestId));
        } catch (dismissErr) {
          console.warn('Failed to auto-dismiss request:', dismissErr);
        }
        setFulfillingRequestId(null);
      }

      resetPlanForm();
      setSavedCoachingContext(null);
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
    // Pre-fill planFor from existing plan data
    if (plan.visibility === 'team') {
      // For playbooks, the manager's ID is in assigned_to
      setPlanFor({ type: 'team', memberId: plan.assigned_to?.[0] || null });
    } else if (plan.assigned_to?.length === 1) {
      setPlanFor({ type: 'individual', memberId: plan.assigned_to[0] });
    } else {
      setPlanFor({ type: 'individual', memberId: null });
    }
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

  const handleSharePlan = (plan) => {
    setPlanToShare(plan);
    setShareEmail('');
    setShareNotes('');
  };

  const handleSendShareEmail = async () => {
    if (!shareEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setSharingPlan(true);
    try {
      const plan = planToShare;
      // Extract enriched context if available (saved with version 2 schema)
      const enriched = parseEnrichedContent(plan.content);
      const includeEnrichedData = enriched && plan.visibility !== 'team';
      const emailOpts = {
        additionalNotes: shareNotes.trim() || undefined,
        suppressTeamData: plan.visibility === 'team',
        ...(includeEnrichedData ? {
          currentScore: enriched.context.currentScore,
          laggingKpis: enriched.context.laggingKpis,
          prioritySkillsets: enriched.context.prioritySkillsets,
          xpEstimate: enriched.context.xpEstimate,
        } : {}),
      };

      const html = buildCoachingPlanEmailHtml(plan, emailOpts);
      const text = buildCoachingPlanEmailText(plan, emailOpts);
      const recipients = shareEmail.split(',').map(e => e.trim()).filter(e => e);
      await backendFetch('/api/send-coaching-plan', {
        recipients,
        subject: `Coaching Plan: ${plan.name}`,
        html,
        text,
      });

      toast.success('Coaching plan shared successfully!');
      setPlanToShare(null);
    } catch (err) {
      console.error('Failed to share coaching plan:', err);
      toast.error(err?.message || 'Failed to share coaching plan.');
    } finally {
      setSharingPlan(false);
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
          const enriched = parseEnrichedContent(planToAssign.content);
          const includeEnrichedData = enriched && planToAssign.visibility !== 'team';
          const emailOpts = {
            introMessage: `You have been assigned a new coaching plan by <strong>${managerName}</strong>. Log in to Apptivia to view and track your progress.`,
            suppressTeamData: planToAssign.visibility === 'team',
            ...(includeEnrichedData ? {
              currentScore: enriched.context.currentScore,
              laggingKpis: enriched.context.laggingKpis,
              prioritySkillsets: enriched.context.prioritySkillsets,
              xpEstimate: enriched.context.xpEstimate,
            } : {}),
          };

          const html = buildCoachingPlanEmailHtml(planToAssign, emailOpts);
          const text = buildCoachingPlanEmailText(planToAssign, emailOpts);
          await backendFetch('/api/send-coaching-plan', {
            recipients: recipientEmails,
            subject: `Coaching Plan Assigned: ${planToAssign.name}`,
            html,
            text,
          });
        } catch (emailErr) {
          console.warn('Email notification failed (plan still assigned):', emailErr);
        }
      }

      // Snapshot baseline KPIs for effectiveness tracking
      if (planToAssign.focus_kpis?.length > 0) {
        try {
          const { data: metrics } = await supabase
            .from('kpi_metrics')
            .select('id, key, goal')
            .in('key', planToAssign.focus_kpis)
            .eq('is_active', true);
          if (metrics?.length > 0) {
            const metricIds = metrics.map(m => m.id);
            const now = new Date();
            const weekEnd = now.toISOString().split('T')[0];
            const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
            await Promise.all(selectedMembers.map(async (memberId) => {
              const { data: vals } = await supabase
                .from('kpi_values')
                .select('kpi_id, value')
                .eq('profile_id', memberId)
                .in('kpi_id', metricIds)
                .lte('period_start', weekEnd)
                .gte('period_end', weekStart);
              const snapshot = {};
              for (const m of metrics) {
                const val = (vals || []).filter(v => v.kpi_id === m.id).reduce((s, v) => s + (v.value || 0), 0);
                snapshot[m.key] = { value: val, pct: m.goal ? Math.round((val / m.goal) * 100) : 0 };
              }
              await supabase
                .from('coaching_plan_assignments')
                .update({ baseline_kpi_snapshot: snapshot })
                .eq('plan_id', planToAssign.id)
                .eq('assigned_to', memberId);
            }));
          }
        } catch (snapErr) {
          console.warn('Baseline KPI snapshot failed (plan still assigned):', snapErr);
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
        message={`Are you sure you want to delete "${deleteConfirm.plan?.name || 'this plan'}"? This action cannot be undone.`}
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

      {/* Main Tabs: Rep Plans / Playbooks / IDPs / Reviews */}
      <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100 mb-4">
        <div className="flex flex-wrap gap-2">
          {[
            ...(canManagePlans ? [
              { id: 'rep-plans', label: 'Rep Plans' },
              { id: 'playbooks', label: 'Manager Playbooks' },
            ] : []),
            { id: 'idps', label: 'Development Plans' },
            { id: 'reviews', label: 'Performance Reviews' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setStatusTab('all');
                setShowBuilder(false);
                setEditingPlan(null);
                setSkillsetPreview(null);
                setSearchQuery('');
                setPlanFor(tab.id === 'playbooks' ? { type: 'team', memberId: null } : { type: 'individual', memberId: null });
              }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* IDP Tab */}
      {activeTab === 'idps' && (
        <IdpTab teamMembers={teamMembers} />
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <ReviewTab teamMembers={teamMembers} startForRepId={searchParams.get('startReviewFor')} />
      )}

      {/* Coaching Plans content (rep-plans + playbooks) */}
      {(activeTab === 'rep-plans' || activeTab === 'playbooks') && (<>
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
            {activeTab === 'playbooks' ? 'Create Manager Playbook' : 'Create Coaching Plan'}
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
            availableKPIs={availableKPIs}
            handleFocusKpiChange={handleFocusKpiChange}
            addArrayField={addArrayField}
            updateArrayField={updateArrayField}
            removeArrayField={removeArrayField}
            onCancel={() => { setShowBuilder(false); resetPlanForm(); }}
            teamMembers={filteredRepMembers}
            managers={managers}
            planFor={planFor}
            setPlanFor={setPlanFor}
            activeTab={activeTab}
            autoGenerating={autoGenerating}
            fieldsDisabled={!editingPlan && !planFor.memberId}
            onPersonSelected={(personId) => handleAutoGenerate(personId, activeTab === 'playbooks')}
            skillsetPreview={skillsetPreview}
          />
        )}


        {/* Plan Requests Section — shown to managers/admins when pending requests exist */}
        {canManagePlans && planRequests.length > 0 && activeTab === 'rep-plans' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-3">
              Plan Requests ({planRequests.length})
            </h4>
            <div className="space-y-2">
              {planRequests.map(req => {
                const reqMember = teamMembers.find(m => m.id === req.requested_by);
                const reqName = reqMember ? `${reqMember.first_name} ${reqMember.last_name}` : 'Unknown';
                return (
                  <div key={req.id} className="flex items-center justify-between bg-white rounded-md border border-amber-100 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{reqName}</span>
                        {req.current_score !== null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${req.current_score >= 80 ? 'bg-emerald-100 text-emerald-700' : req.current_score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {req.current_score}%
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      {req.message && <p className="text-xs text-gray-600 mt-0.5 truncate">{req.message}</p>}
                      {req.lagging_kpis?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {req.lagging_kpis.slice(0, 3).map((k, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">{k.label || k.key}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button
                        onClick={() => handleFulfillRequest(req)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Create Plan
                      </button>
                      <button
                        onClick={() => handleDismissRequest(req.id)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status Filter Tabs */}
        {!loading && coachingPlans.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'all', label: 'All' },
              { key: 'draft', label: `Draft (${planStats.draft})` },
              { key: 'active', label: `Active (${planStats.active})` },
              { key: 'in_progress', label: `In Progress (${planStats.inProgress})` },
              { key: 'completed', label: `Completed (${planStats.completed})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  statusTab === tab.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Saved Coaching Plans */}
        <div id="saved-plans" className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isPowerUser ? 'My Plans' : activeTab === 'playbooks' ? 'Saved Manager Playbooks' : 'Saved Rep Plans'}
              </h3>
              <p className="text-xs text-gray-500">
                {isPowerUser ? 'Coaching plans assigned to you' : activeTab === 'playbooks' ? 'Manager playbooks — team-wide coaching strategies' : 'Individual rep coaching plans'}
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
                  {isPowerUser ? 'No coaching plans have been assigned to you yet' : activeTab === 'playbooks' ? 'No manager playbooks yet' : 'No rep plans yet'}
                </p>
                {canCreatePlans && (
                  <button
                    onClick={() => { resetPlanForm(); setShowBuilder(true); }}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {activeTab === 'playbooks' ? 'Create Your First Manager Playbook' : 'Create Your First Plan'}
                  </button>
                )}
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-12">
                <Search className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 mb-2">No plans match the current filters</p>
                <button
                  onClick={() => { setStatusTab('all'); setSearchQuery(''); }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    canCreatePlans={canCreatePlans}
                    canManagePlans={canManagePlans}
                    assignmentStatuses={assignmentStatuses}
                    assignmentEffectiveness={assignmentEffectiveness}
                    user={user}
                    isPowerUser={isPowerUser}
                    getPlanStatus={getPlanStatus}
                    onView={setSelectedPlan}
                    onEdit={handleEditPlan}
                    onAssign={handleAssignPlan}
                    onDelete={handleDeletePlan}
                    onShare={handleSharePlan}
                    onSnapshot={setSnapshotPlan}
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
            assignmentEffectiveness={assignmentEffectiveness}
            teamMembers={teamMembers}
            user={user}
            isPowerUser={isPowerUser}
            getMyAssignmentStatus={getMyAssignmentStatus}
            handleStatusChange={handleStatusChange}
            onEdit={handleEditPlan}
            onAssign={handleAssignPlan}
            onShare={handleSharePlan}
            onSnapshot={setSnapshotPlan}
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

        {/* Share via Email Modal */}
        {planToShare && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPlanToShare(null)} />
            <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg p-6 m-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Share Coaching Plan</h2>
                  <p className="text-sm text-gray-500">Send "{planToShare.name}" via email</p>
                </div>
                <button onClick={() => setPlanToShare(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
                  <input
                    type="text"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (Optional)</label>
                  <textarea
                    value={shareNotes}
                    onChange={(e) => setShareNotes(e.target.value)}
                    placeholder="Add any additional context or instructions..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                  />
                </div>
                <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                  This will share the complete coaching plan including goals, KPIs, action items, and success metrics.
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setPlanToShare(null)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendShareEmail}
                  disabled={sharingPlan || !shareEmail.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sharingPlan ? 'Sending...' : 'Share Plan'}
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
      </>)}
      </div>
      {snapshotPlan && (
        <ShareCoachingPlanSnapshotModal
          isOpen={!!snapshotPlan}
          onClose={() => setSnapshotPlan(null)}
          plan={snapshotPlan}
          assigneeName={
            snapshotPlan.assigned_to?.length > 0
              ? teamMembers.find(m => m.id === snapshotPlan.assigned_to[0])
                ? `${teamMembers.find(m => m.id === snapshotPlan.assigned_to[0]).first_name} ${teamMembers.find(m => m.id === snapshotPlan.assigned_to[0]).last_name}`
                : null
              : null
          }
        />
      )}
    </DashboardLayout>
  );
}
