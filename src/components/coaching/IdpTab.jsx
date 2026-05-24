import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X, LayoutTemplate } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { backendFetch } from '../../utils/backendFetch';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { idpStatusConfig } from './idpStatusConfig';
import { buildLabel } from '../../constants/kpiGuidance';
import { fetchRepTrend } from '../../utils/scorecardFetch';
import { ROLES, LEADERSHIP_ROLES } from '../../constants/roles';
import IdpCard from './IdpCard';
import IdpBuilderForm from './IdpBuilderForm';
import IdpDetailModal from './IdpDetailModal';
import IdpTemplatesModal from './IdpTemplatesModal';
import ConfirmModal from '../ConfirmModal';

const emptyForm = () => ({
  name: '', description: '', plan_type: 'quarterly', profile_id: '',
  period_start: '', period_end: '', focus_kpis: [], career_goals: [],
  development_areas: [], milestones: [], action_items: [], resources: [],
  success_criteria: [], notes: '',
});

export default function IdpTab({ teamMembers }) {
  const { user, profile, role } = useAuth();
  const toast = useToast();
  const { addNotification } = useNotifications();
  const orgId = profile?.organization_id;

  const [idps, setIdps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingIdp, setEditingIdp] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedIdp, setSelectedIdp] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, idp: null });
  const [completionPrompt, setCompletionPrompt] = useState({ isOpen: false, idp: null });
  const [availableKPIs, setAvailableKPIs] = useState([]);

  const canManage = role === ROLES.ADMIN || role === ROLES.MANAGER || role === ROLES.COACH;
  const isPowerUser = role === ROLES.POWER_USER;
  const [autoGenerating, setAutoGenerating] = useState(false);

  // AI auto-generate IDP using 5-week trend analysis
  const handleAutoGenerate = useCallback(async (repId) => {
    if (!repId || autoGenerating) return;
    setAutoGenerating(true);
    try {
      // Fetch 5-week trend data and skillsets in parallel
      const [trendResult, skillsetResult] = await Promise.all([
        fetchRepTrend(repId, 5, orgId),
        supabase.from('profile_skillsets').select('skillset_key, current_xp, current_level').eq('profile_id', repId),
      ]);

      const skillsets = (skillsetResult.data || []).map(s => ({
        name: buildLabel(s.skillset_key),
        level: s.current_level || 0,
        xp: s.current_xp || 0,
        mastery: s.current_level >= 5 ? 'Expert' : s.current_level >= 4 ? 'Advanced' : s.current_level >= 3 ? 'Proficient' : s.current_level >= 2 ? 'Intermediate' : 'Beginner',
      }));

      const rep = (teamMembers || []).find(m => m.id === repId);
      const repName = rep ? (rep.full_name || rep.email) : 'Rep';

      // Build 5-week trend context for the AI
      const weeklyScores = trendResult.weeks.filter(w => w.hasData).map(w => ({ week: w.week, score: w.score }));

      const response = await backendFetch('/api/ai/idp-plan', {
        repName,
        repScore: trendResult.currentScore,
        laggingKpis: trendResult.laggingKpis,
        onTrackCount: trendResult.onTrackCount,
        exceedingCount: trendResult.exceedingCount,
        skillsets,
        planType: form.plan_type || 'quarterly',
        periodStart: form.period_start || '',
        periodEnd: form.period_end || '',
        // 5-week trend data
        trendData: {
          weeklyScores,
          avg5w: trendResult.avg5w,
          trendDelta: trendResult.trendDelta,
          currentScore: trendResult.currentScore,
          oldestScore: trendResult.oldestScore,
        },
      });

      const plan = response?.plan;
      if (!plan) throw new Error('AI did not return a valid plan');

      // Resolve milestone dates from offsets
      const today = new Date();
      const fmtD = d => d.toISOString().split('T')[0];
      const milestones = (plan.milestones || []).map(m => ({
        title: m.title || '',
        target_date: m.target_date_offset_days ? fmtD(new Date(today.getTime() + m.target_date_offset_days * 86400000)) : (m.target_date || ''),
        status: 'pending',
        notes: m.notes || '',
      }));

      setForm(prev => ({
        ...prev,
        name: plan.name || prev.name,
        description: plan.description || prev.description,
        career_goals: plan.career_goals?.length ? plan.career_goals : prev.career_goals,
        development_areas: plan.development_areas?.length ? plan.development_areas : prev.development_areas,
        milestones: milestones.length ? milestones : prev.milestones,
        action_items: plan.action_items?.length ? plan.action_items : prev.action_items,
        resources: plan.resources?.length ? plan.resources : prev.resources,
        success_criteria: plan.success_criteria?.length ? plan.success_criteria : prev.success_criteria,
        focus_kpis: plan.focus_kpis?.length ? plan.focus_kpis : prev.focus_kpis,
        notes: plan.notes || prev.notes,
      }));

      toast.success('AI development plan generated! Review and edit as needed.');
    } catch (err) {
      console.error('IDP auto-generate error:', err);
      toast.error(err.message || 'Failed to generate IDP. You can fill in the fields manually.');
    } finally {
      setAutoGenerating(false);
    }
  }, [autoGenerating, form.plan_type, form.period_start, form.period_end, teamMembers, toast]);

  // Fetch KPIs
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('kpi_metrics').select('key, name').eq('is_active', true);
      setAvailableKPIs(data || []);
    })();
  }, []);

  // Fetch IDPs
  const fetchIdps = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const query = supabase.from('individual_development_plans').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
    if (isPowerUser) query.eq('profile_id', profile?.id);
    const { data, error } = await query;
    if (error) console.error('IDP fetch error:', error.message);
    setIdps(data || []);
    setLoading(false);
  }, [orgId, isPowerUser, profile?.id]);

  useEffect(() => { fetchIdps(); }, [fetchIdps]);

  // Filter IDPs
  const filtered = useMemo(() => {
    let list = idps;
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        list = list.filter(i => i.period_end && new Date() > new Date(i.period_end) && i.status !== 'completed' && i.status !== 'cancelled');
      } else {
        list = list.filter(i => i.status === statusFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [idps, statusFilter, searchQuery]);

  // Apply template
  const handleTemplateSelect = (template) => {
    const today = new Date();
    const endDate = new Date(today.getTime() + (template.default_duration_days || 90) * 86400000);
    const fmtDate = d => d.toISOString().split('T')[0];

    // Resolve milestone dates from offset
    const milestones = (template.suggested_milestones || []).map(m => ({
      title: m.title,
      target_date: m.target_date_offset_days ? fmtDate(new Date(today.getTime() + m.target_date_offset_days * 86400000)) : '',
      status: 'pending',
      notes: '',
    }));

    setForm({
      ...emptyForm(),
      name: template.name,
      description: template.description || '',
      plan_type: template.plan_type || 'quarterly',
      period_start: fmtDate(today),
      period_end: fmtDate(endDate),
      focus_kpis: template.suggested_focus_kpis || [],
      career_goals: template.career_goals || [],
      development_areas: template.development_areas || [],
      milestones,
      action_items: template.suggested_actions || [],
      resources: template.suggested_resources || [],
      success_criteria: template.success_criteria || [],
      template_id: template.id,
    });
    setEditingIdp(null);
    setShowTemplates(false);
    setShowBuilder(true);
  };

  // Save IDP
  const handleSave = async () => {
    if (!form.name) return toast.error('Plan name is required');
    if (!form.profile_id && !editingIdp) return toast.error('Please select a rep');
    if (form.period_start && form.period_end && form.period_start > form.period_end) return toast.error('End date must be after start date');
    setSaving(true);
    try {
      const row = {
        organization_id: orgId,
        name: form.name,
        description: form.description || null,
        plan_type: form.plan_type,
        status: editingIdp ? editingIdp.status : 'draft',
        profile_id: form.profile_id || editingIdp?.profile_id,
        created_by: editingIdp ? editingIdp.created_by : profile?.id,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        career_goals: form.career_goals,
        development_areas: form.development_areas,
        focus_kpis: form.focus_kpis,
        milestones: form.milestones,
        action_items: form.action_items,
        resources: form.resources,
        success_criteria: form.success_criteria,
        notes: form.notes || null,
        template_id: form.template_id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingIdp) {
        const { error } = await supabase.from('individual_development_plans').update(row).eq('id', editingIdp.id);
        if (error) throw error;
        toast.success('Development plan updated');
      } else {
        // Capture baseline KPI snapshot at plan creation
        try {
          const trend = await fetchRepTrend(row.profile_id, 5, orgId);
          row.baseline_kpi_snapshot = {
            capturedAt: new Date().toISOString(),
            currentScore: trend.currentScore,
            avg5w: trend.avg5w,
            trendDelta: trend.trendDelta,
            laggingKpis: trend.laggingKpis,
            onTrackCount: trend.onTrackCount,
            exceedingCount: trend.exceedingCount,
            weeks: trend.weeks.filter(w => w.hasData).map(w => ({ week: w.week, score: w.score })),
          };
        } catch (snapshotErr) { console.warn('Baseline snapshot capture failed:', snapshotErr); }
        const { error } = await supabase.from('individual_development_plans').insert(row);
        if (error) throw error;
        toast.success('Development plan created');

        // Notify the rep
        if (row.profile_id !== profile?.id) {
          addNotification({
            type: 'coaching',
            title: 'New Development Plan',
            message: `A new IDP "${form.name}" has been created for you.`,
            ownerId: row.profile_id,
            link: '/coaching-plans#idps',
          });
        }
      }
      setShowBuilder(false);
      setEditingIdp(null);
      setForm(emptyForm());
      fetchIdps();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Edit
  const handleEdit = (idp) => {
    setEditingIdp(idp);
    setForm({
      name: idp.name || '',
      description: idp.description || '',
      plan_type: idp.plan_type || 'quarterly',
      profile_id: idp.profile_id || '',
      period_start: idp.period_start || '',
      period_end: idp.period_end || '',
      focus_kpis: idp.focus_kpis || [],
      career_goals: idp.career_goals || [],
      development_areas: idp.development_areas || [],
      milestones: idp.milestones || [],
      action_items: idp.action_items || [],
      resources: idp.resources || [],
      success_criteria: idp.success_criteria || [],
      notes: idp.notes || '',
      template_id: idp.template_id || null,
    });
    setShowBuilder(true);
  };

  // Delete
  const handleDelete = async () => {
    const idp = deleteConfirm.idp;
    if (!idp) return;
    const { error } = await supabase.from('individual_development_plans').delete().eq('id', idp.id);
    if (error) toast.error('Delete failed: ' + error.message);
    else toast.success('Development plan deleted');
    setDeleteConfirm({ isOpen: false, idp: null });
    fetchIdps();
  };

  // Milestone click-to-toggle (pending → in_progress → completed → pending)
  const handleMilestoneToggle = async (milestoneIdx, newStatus) => {
    if (!selectedIdp) return;
    const updatedMilestones = [...(selectedIdp.milestones || [])];
    updatedMilestones[milestoneIdx] = { ...updatedMilestones[milestoneIdx], status: newStatus };
    const { error } = await supabase.from('individual_development_plans')
      .update({ milestones: updatedMilestones, updated_at: new Date().toISOString() })
      .eq('id', selectedIdp.id);
    if (error) { toast.error('Milestone update failed'); return; }
    const updatedIdp = { ...selectedIdp, milestones: updatedMilestones };
    setSelectedIdp(updatedIdp);
    fetchIdps();
    // Prompt to complete IDP when all milestones are done
    const allCompleted = updatedMilestones.length > 0 && updatedMilestones.every(m => m.status === 'completed');
    if (allCompleted && selectedIdp.status !== 'completed' && selectedIdp.status !== 'cancelled') {
      setCompletionPrompt({ isOpen: true, idp: updatedIdp });
    }
  };

  // Status change
  const handleStatusChange = async (newStatus) => {
    if (!selectedIdp) return;
    const { error } = await supabase.from('individual_development_plans').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', selectedIdp.id);
    if (error) toast.error('Status update failed');
    else {
      toast.success(`Plan marked as ${newStatus.replace('_', ' ')}`);
      setSelectedIdp(prev => prev ? { ...prev, status: newStatus } : null);
      fetchIdps();
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search plans..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-apptivia-carbon-700 border border-apptivia-carbon-300 rounded-lg hover:bg-apptivia-paper">
              <LayoutTemplate size={14} /> Templates
            </button>
            <button onClick={() => { setEditingIdp(null); setForm(emptyForm()); setShowBuilder(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90">
              <Plus size={14} /> Create IDP
            </button>
          </div>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          { id: 'all', label: 'All' },
          { id: 'draft', label: 'Draft' },
          { id: 'active', label: 'Active' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'completed', label: 'Completed' },
          { id: 'overdue', label: 'Overdue' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              statusFilter === tab.id ? 'bg-apptivia-coral text-white' : 'bg-apptivia-carbon-100 text-apptivia-carbon-600 hover:bg-apptivia-carbon-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Builder form */}
      {showBuilder && (
        <IdpBuilderForm
          editingIdp={editingIdp}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          saving={saving}
          availableKPIs={availableKPIs}
          teamMembers={teamMembers}
          onCancel={() => { setShowBuilder(false); setEditingIdp(null); setForm(emptyForm()); }}
          onAutoGenerate={handleAutoGenerate}
          autoGenerating={autoGenerating}
        />
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-sm text-apptivia-carbon-500">Loading development plans...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-apptivia-carbon-500 mb-2">{isPowerUser ? 'No development plans assigned to you yet' : 'No development plans yet'}</p>
          {canManage && !showBuilder && (
            <button onClick={() => setShowTemplates(true)}
              className="px-4 py-2 text-sm font-semibold text-apptivia-coral border border-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50">
              Create Your First IDP
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(idp => (
            <IdpCard
              key={idp.id}
              idp={idp}
              canManage={canManage}
              onView={setSelectedIdp}
              onEdit={handleEdit}
              onDelete={idp => setDeleteConfirm({ isOpen: true, idp })}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedIdp && (
        <IdpDetailModal
          idp={selectedIdp}
          onClose={() => setSelectedIdp(null)}
          onStatusChange={handleStatusChange}
          onMilestoneToggle={handleMilestoneToggle}
          canManage={canManage}
          teamMembers={teamMembers}
        />
      )}

      {/* Templates modal */}
      {showTemplates && (
        <IdpTemplatesModal
          onClose={() => setShowTemplates(false)}
          onSelect={handleTemplateSelect}
          organizationId={orgId}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm.isOpen && (
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          title="Delete Development Plan"
          message={`Are you sure you want to delete "${deleteConfirm.idp?.name}"? This cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm({ isOpen: false, idp: null })}
        />
      )}

      {/* IDP completion prompt — shown when all milestones are completed */}
      <ConfirmModal
        isOpen={completionPrompt.isOpen}
        title="All Milestones Completed!"
        message={`All milestones for "${completionPrompt.idp?.name}" are complete. Would you like to mark this development plan as completed?`}
        confirmText="Mark Completed"
        variant="success"
        onConfirm={async () => {
          const idp = completionPrompt.idp;
          setCompletionPrompt({ isOpen: false, idp: null });
          if (!idp) return;
          const { error } = await supabase.from('individual_development_plans')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', idp.id);
          if (error) { toast.error('Status update failed'); return; }
          toast.success('Development plan marked as completed!');
          setSelectedIdp(prev => prev?.id === idp.id ? { ...prev, status: 'completed' } : prev);
          fetchIdps();
        }}
        onClose={() => setCompletionPrompt({ isOpen: false, idp: null })}
      />
    </div>
  );
}
