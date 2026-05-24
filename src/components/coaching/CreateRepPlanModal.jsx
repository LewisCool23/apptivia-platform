import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { backendFetch } from '../../utils/backendFetch';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { KPI_GUIDANCE, buildLabel } from '../../constants/kpiGuidance';
import { estimateSkillsetXp } from '../../constants/skillsets';
import { buildEnrichedContent } from '../../utils/emailTemplates';
import PlanBuilderForm from './PlanBuilderForm';
import CoachingPlanTemplatesModal from '../CoachingPlanTemplatesModal';
import { LEADERSHIP_ROLES } from '../../constants/roles';
import { useModalBehavior } from '../../hooks/useModalBehavior';

const DEFAULT_KPIS = [
  'pipeline_created', 'sourced_opps', 'call_connects', 'meetings',
  'talk_time_minutes', 'emails_sent', 'demos_completed', 'win_rate',
  'response_time', 'follow_ups', 'stage2_opps', 'qualified_leads', 'social_touches',
  'dials', 'conversations', 'discovery_calls', 'sales_cycle_days', 'average_deal_size',
  'talk_to_listen_ratio', 'longest_monologue_sec', 'questions_asked',
  'next_steps_mentioned', 'interactivity_score',
  'sequences_started', 'emails_opened', 'tasks_completed',
  'gifts_sent', 'gifts_accepted', 'gift_influenced_meetings',
];

const emptyForm = () => ({
  name: '',
  goals: [''],
  focus_kpis: [''],
  action_items: [''],
  success_metrics: [''],
  notes: '',
  date_range_start: '',
  date_range_end: '',
  plan_type: 'custom',
});

const kpiSuggestions = {
  pipeline_created: { goals: ['Increase qualified pipeline by 25% this period'], actions: ['Block 2 hours daily for prospecting', 'Target 20 high-intent accounts per week'] },
  call_connects: { goals: ['Reach 50+ call connects this week'], actions: ['Use peak call windows (8-10am, 4-6pm)', 'Pre-plan call lists the night before'] },
  meetings: { goals: ['Book 10+ meetings this week'], actions: ['End every call with a calendar ask', 'Send same-day follow-ups with availability'] },
  emails_sent: { goals: ['Send 100+ personalized emails this week'], actions: ['Personalize first lines', 'Batch email blocks twice daily'] },
  win_rate: { goals: ['Achieve 25%+ win rate on qualified opportunities'], actions: ['Create mutual action plans', 'Review objections and responses weekly'] },
};

export default function CreateRepPlanModal({ isOpen, onClose, repId, repName, teamMembers, onPlanCreated }) {
  useModalBehavior(isOpen, onClose);
  const { user, profile } = useAuth();
  const toast = useToast();

  const [planForm, setPlanForm] = useState(emptyForm());
  const [savingPlan, setSavingPlan] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [skillsetPreview, setSkillsetPreview] = useState(null);
  const [savedCoachingContext, setSavedCoachingContext] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableKPIs, setAvailableKPIs] = useState(DEFAULT_KPIS);
  const [planFor, setPlanFor] = useState({ type: 'individual', memberId: repId || null });

  // Load available KPIs on mount
  useEffect(() => {
    supabase.from('kpi_metrics').select('key').order('name').then(({ data, error }) => {
      if (!error && data?.length > 0) setAvailableKPIs(data.map(k => k.key).filter(Boolean));
    });
  }, []);

  // Pre-set rep when modal opens
  useEffect(() => {
    if (isOpen && repId) {
      setPlanFor({ type: 'individual', memberId: repId });
    }
  }, [isOpen, repId]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setPlanForm(emptyForm());
      setSavingPlan(false);
      setAutoGenerating(false);
      setSkillsetPreview(null);
      setSavedCoachingContext(null);
      setPlanFor({ type: 'individual', memberId: repId || null });
    }
  }, [isOpen, repId]);

  if (!isOpen) return null;

  const addArrayField = (field) => setPlanForm(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  const updateArrayField = (field, index, value) => {
    setPlanForm(prev => {
      const arr = [...prev[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };
  const removeArrayField = (field, index) => {
    setPlanForm(prev => {
      const arr = prev[field].filter((_, i) => i !== index);
      return { ...prev, [field]: arr.length > 0 ? arr : [''] };
    });
  };
  const handleFocusKpiChange = (index, value) => {
    updateArrayField('focus_kpis', index, value);
    const suggestions = kpiSuggestions[value];
    if (!suggestions || planForm.plan_type !== 'auto') return;
    const hasGoals = planForm.goals.some(g => g.trim());
    const hasActions = planForm.action_items.some(a => a.trim());
    setPlanForm(prev => ({
      ...prev,
      goals: hasGoals ? prev.goals : suggestions.goals,
      action_items: hasActions ? prev.action_items : suggestions.actions,
    }));
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
      template_id: templateData.template_id,
    });
    setShowTemplates(false);
  };

  const handleAutoGenerate = async (personId) => {
    if (!personId || autoGenerating) return;
    setAutoGenerating(true);
    setSkillsetPreview(null);
    try {
      const { data: kpiDefs } = await supabase
        .from('kpi_metrics')
        .select('id, key, name, goal, weight, direction, show_on_scorecard')
        .eq('is_active', true);
      if (!kpiDefs?.length) throw new Error('No KPI metrics found');

      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      const lastMonday = new Date(monday.getTime() - 7 * 86400000);
      const fmtDate = d => d.toISOString().split('T')[0];

      const rep = (teamMembers || []).find(m => m.id === personId);
      const audienceLabel = rep ? `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'Rep' : 'Rep';

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

      let totalWeightedPct = 0, totalWeight = 0;
      const laggingKpis = [];
      let onTrackCount = 0, exceedingCount = 0;

      scorecardKpis.forEach(metric => {
        const rawSum = kpiSums[metric.id] || 0;
        const weeklyAvg = rawSum / 2;
        const dir = metric.direction || 'higher';
        const pct = metric.goal > 0
          ? Math.round(dir === 'lower' ? (weeklyAvg > 0 ? (metric.goal / weeklyAvg) * 100 : 200) : (weeklyAvg / metric.goal) * 100)
          : 0;
        const weight = metric.weight || 0;
        totalWeightedPct += pct * weight;
        totalWeight += weight;
        const guidance = KPI_GUIDANCE[metric.key];
        const tier = guidance?.tier || 4;
        const tierLabel = tier === 1 ? 'Scorecard Priority' : tier === 2 ? 'Core Skill' : tier === 3 ? 'Engage Adoption' : 'Other';
        if (pct < 80) laggingKpis.push({ key: metric.key, label: buildLabel(metric.key), percentage: pct, tier, tierLabel });
        else if (pct >= 100) exceedingCount++;
        else onTrackCount++;
      });

      laggingKpis.sort((a, b) => a.tier - b.tier || a.percentage - b.percentage);
      const currentScore = totalWeight > 0 ? Math.round(totalWeightedPct / totalWeight) : 0;

      const response = await backendFetch('/api/ai/coaching-plan', {
        audienceLabel,
        currentScore,
        laggingKpis,
        onTrackCount,
        exceedingCount,
        playbookInsights: {
          teamSize: 1,
          teamTrend: null,
          teamWeaknesses: laggingKpis.map(k => ({
            key: k.key, label: k.label, avgPct: k.percentage,
            belowCount: 1, totalReps: 1, tier: k.tier, tierLabel: k.tierLabel,
            diagnosis: KPI_GUIDANCE[k.key]?.diagnosis || null,
          })),
          repsNeedingCoaching: [],
        },
        mode: 'rep_self_coaching',
      });

      const plan = response?.plan;
      if (!plan) throw new Error('AI did not return a valid plan');

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

      let skillsetImpactData = null;
      if (plan.focus_kpis?.length) {
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

      const prioritySkillsets = (skillsetImpactData?.current || []).map(s => ({
        name: buildLabel(s.skillset_key), progress: s.current_xp || 0,
      }));
      const xpEstimate = (skillsetImpactData?.projected || []).map(p => ({
        skillset: p.skillset, estimatedXp: p.estimatedXp,
      }));
      setSavedCoachingContext({ currentScore, laggingKpis, onTrackCount, exceedingCount, prioritySkillsets, xpEstimate, skillsetImpact: skillsetImpactData });

      toast.success('AI coaching plan generated! Review and edit as needed.');
    } catch (err) {
      console.error('Auto-generate error:', err);
      toast.error(err.message || 'Failed to generate coaching plan.');
    } finally {
      setAutoGenerating(false);
    }
  };

  const generatePlanContent = () => {
    let content = `${planForm.name}\n\n`;
    if (planForm.date_range_start && planForm.date_range_end) content += `Date Range: ${planForm.date_range_start} to ${planForm.date_range_end}\n\n`;
    if (planForm.goals.filter(g => g.trim()).length > 0) content += `Goals:\n${planForm.goals.filter(g => g.trim()).map(g => `- ${g}`).join('\n')}\n\n`;
    if (planForm.focus_kpis.filter(k => k.trim()).length > 0) content += `Focus KPIs:\n${planForm.focus_kpis.filter(k => k.trim()).map(k => `- ${k}`).join('\n')}\n\n`;
    if (planForm.action_items.filter(a => a.trim()).length > 0) content += `Action Items:\n${planForm.action_items.filter(a => a.trim()).map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n`;
    if (planForm.success_metrics.filter(s => s.trim()).length > 0) content += `Success Metrics:\n${planForm.success_metrics.filter(s => s.trim()).map(s => `- ${s}`).join('\n')}\n\n`;
    if (planForm.notes.trim()) content += `Notes:\n${planForm.notes}\n`;
    return content;
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) return toast.error('Please enter a plan name');
    if (!user?.id) return toast.error('You must be signed in');
    if (savingPlan) return;

    try {
      setSavingPlan(true);
      const plainContent = generatePlanContent();
      const content = savedCoachingContext ? buildEnrichedContent(plainContent, savedCoachingContext) : plainContent;

      const payload = {
        name: planForm.name,
        plan_type: planForm.plan_type,
        template_id: planForm.template_id || null,
        created_by: user.id,
        organization_id: profile?.organization_id || null,
        content,
        goals: planForm.goals.filter(g => g.trim()),
        focus_kpis: planForm.focus_kpis.filter(k => k.trim()),
        action_items: planForm.action_items.filter(a => a.trim()),
        success_metrics: planForm.success_metrics.filter(s => s.trim()),
        notes: planForm.notes,
        date_range_start: planForm.date_range_start || null,
        date_range_end: planForm.date_range_end || null,
        team_id: profile?.team_id || null,
        visibility: 'individual',
        assigned_to: planFor.memberId ? [planFor.memberId] : [],
      };

      const { data: savedPlan, error } = await supabase.from('coaching_plans').insert([payload]).select().single();
      if (error) throw error;

      // Create assignment record
      if (planFor.memberId && savedPlan?.id) {
        const { error: assignError } = await supabase.from('coaching_plan_assignments').insert([{
          plan_id: savedPlan.id,
          assigned_to: planFor.memberId,
          assigned_by: user.id,
          organization_id: profile?.organization_id || null,
          status: 'active',
        }]);
        if (assignError) console.warn('Plan created but assignment failed:', assignError.message);
      }

      toast.success(`Plan created and assigned to ${repName || 'rep'}!`);
      onPlanCreated?.();
      onClose();
    } catch (err) {
      console.error('Save plan error:', err);
      toast.error(err?.message || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 mb-10">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-apptivia-ink">Build Rep Plan</h2>
            {repName && <p className="text-sm text-apptivia-carbon-500">Creating plan for {repName}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <PlanBuilderForm
            editingPlan={null}
            planForm={planForm}
            setPlanForm={setPlanForm}
            handleSavePlan={handleSavePlan}
            savingPlan={savingPlan}
            availableKPIs={availableKPIs}
            handleFocusKpiChange={handleFocusKpiChange}
            addArrayField={addArrayField}
            updateArrayField={updateArrayField}
            removeArrayField={removeArrayField}
            onCancel={onClose}
            teamMembers={(teamMembers || []).filter(m => !LEADERSHIP_ROLES.includes(m.role))}
            managers={[]}
            planFor={planFor}
            setPlanFor={setPlanFor}
            activeTab="rep-plans"
            autoGenerating={autoGenerating}
            fieldsDisabled={!planFor.memberId}
            onPersonSelected={(personId) => handleAutoGenerate(personId)}
            skillsetPreview={skillsetPreview}
          />
        </div>
      </div>

      <CoachingPlanTemplatesModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onTemplateSelect={handleTemplateSelect}
      />
    </div>
  );
}
