import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { buildLabel } from '../../constants/kpiGuidance';
import { LEADERSHIP_ROLES } from '../../constants/roles';

export default function PlanBuilderForm({
  editingPlan,
  planForm,
  setPlanForm,
  handleSavePlan,
  savingPlan,
  availableKPIs,
  handleFocusKpiChange,
  addArrayField,
  updateArrayField,
  removeArrayField,
  onCancel,
  teamMembers,
  managers,
  planFor,
  setPlanFor,
  activeTab,
  autoGenerating,
  fieldsDisabled,
  onPersonSelected,
  skillsetPreview,
}) {
  const isPlaybook = activeTab === 'playbooks';
  const repMembers = (teamMembers || []).filter(m =>
    !LEADERSHIP_ROLES.includes(m.role)
  );

  const inputDisabled = fieldsDisabled || autoGenerating;

  const handlePersonChange = (personId) => {
    if (isPlaybook) {
      setPlanFor({ type: 'team', memberId: personId || null });
    } else {
      setPlanFor({ type: 'individual', memberId: personId || null });
    }
    // Trigger auto-generation for new plans (not editing)
    if (personId && !editingPlan) {
      onPersonSelected(personId);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-apptivia-carbon-200 p-6 mb-6 relative">
      {/* Loading overlay during auto-generation */}
      {autoGenerating && (
        <div className="absolute inset-0 bg-white/70 rounded-lg flex flex-col items-center justify-center z-10">
          <Loader2 size={32} className="animate-spin text-apptivia-coral mb-3" />
          <p className="text-sm font-semibold text-apptivia-coral">Generating AI coaching plan...</p>
          <p className="text-xs text-apptivia-carbon-500 mt-1">Analyzing performance data and building recommendations</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">
            {editingPlan
              ? (isPlaybook ? 'Edit Manager Playbook' : 'Edit Coaching Plan')
              : (isPlaybook ? 'Create Manager Playbook' : 'Create Coaching Plan')}
          </h3>
          <p className="text-xs text-apptivia-carbon-500">
            {isPlaybook
              ? 'Select a manager to auto-generate a data-driven playbook for their team'
              : 'Select a rep to auto-generate a personalized coaching plan from their performance data'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-apptivia-carbon-600 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-paper"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-6">
        {/* Person selector — Manager dropdown on Playbooks, Rep dropdown on Rep Plans */}
        {setPlanFor && (
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
              {isPlaybook ? 'Playbook For' : 'Plan For'} <span className="text-red-500">*</span>
            </label>
            {isPlaybook ? (
              <>
                <select
                  value={planFor?.memberId || ''}
                  onChange={(e) => handlePersonChange(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a manager...</option>
                  {(managers || []).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} — {m.email}
                    </option>
                  ))}
                </select>
                {!planFor?.memberId && !editingPlan && (
                  <p className="text-xs text-apptivia-coral mt-1.5">
                    Choose a manager to auto-generate a playbook based on their team's performance data.
                  </p>
                )}
              </>
            ) : (
              <>
                <select
                  value={planFor?.memberId || ''}
                  onChange={(e) => handlePersonChange(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a team member...</option>
                  {repMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} — {m.email}
                    </option>
                  ))}
                </select>
                {!planFor?.memberId && !editingPlan && (
                  <p className="text-xs text-apptivia-coral mt-1.5">
                    Choose a rep to auto-generate a coaching plan from their KPI data.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Regenerate button — shown after initial generation or when editing */}
        {planFor?.memberId && !autoGenerating && !editingPlan && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPersonSelected(planFor.memberId)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-apptivia-ink border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-carbon-100 transition-colors"
            >
              <Sparkles size={14} />
              Regenerate Plan
            </button>
            <span className="text-xs text-apptivia-carbon-400">Re-runs AI generation with latest data</span>
          </div>
        )}

        {/* Plan Name */}
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
            Plan Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            disabled={inputDisabled}
            className={`w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
            placeholder="e.g., Q1 Pipeline Acceleration Plan"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">Start Date</label>
            <input
              type="date"
              value={planForm.date_range_start}
              onChange={(e) => setPlanForm({ ...planForm, date_range_start: e.target.value })}
              disabled={inputDisabled}
              className={`w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">End Date</label>
            <input
              type="date"
              value={planForm.date_range_end}
              onChange={(e) => setPlanForm({ ...planForm, date_range_end: e.target.value })}
              disabled={inputDisabled}
              className={`w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
            />
          </div>
        </div>

        {/* Goals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-apptivia-carbon-700">Goals (1-3)</label>
            {!inputDisabled && (
              <button onClick={() => addArrayField('goals')} className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium">
                + Add Goal
              </button>
            )}
          </div>
          <div className="space-y-2">
            {planForm.goals.map((goal, index) => (
              <div key={`goal-${index}-${planForm.goals.length}`} className="flex gap-2">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => updateArrayField('goals', index, e.target.value)}
                  disabled={inputDisabled}
                  className={`flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
                  placeholder="e.g., Increase pipeline by 25% this quarter"
                />
                {planForm.goals.length > 1 && !inputDisabled && (
                  <button onClick={() => removeArrayField('goals', index)} className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Focus KPIs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-apptivia-carbon-700">Focus KPIs (2-5)</label>
            {!inputDisabled && (
              <button onClick={() => addArrayField('focus_kpis')} className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium">
                + Add KPI
              </button>
            )}
          </div>
          <div className="space-y-2">
            {planForm.focus_kpis.map((kpi, index) => (
              <div key={`kpi-${index}-${planForm.focus_kpis.length}`} className="flex gap-2">
                <select
                  value={kpi}
                  onChange={(e) => handleFocusKpiChange(index, e.target.value)}
                  disabled={inputDisabled}
                  className={`flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
                >
                  <option value="">Select a KPI...</option>
                  {availableKPIs.map(k => (
                    <option key={k} value={k}>
                      {buildLabel(k)}
                    </option>
                  ))}
                </select>
                {planForm.focus_kpis.length > 1 && !inputDisabled && (
                  <button onClick={() => removeArrayField('focus_kpis', index)} className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Skillset Impact Preview — shown for rep plans after AI generation */}
        {skillsetPreview && !isPlaybook && skillsetPreview.projected?.length > 0 && (
          <div className="bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-apptivia-ink mb-3">Skillset Impact Preview</h4>
            <div className="grid grid-cols-2 gap-2">
              {skillsetPreview.projected.map(s => {
                const current = (skillsetPreview.current || []).find(c => c.skillset_key === s.skillset.toLowerCase().replace(/\s+/g, '_'));
                const currentXp = current?.current_xp || 0;
                return (
                  <div key={s.skillset} className="flex items-center gap-2 text-xs bg-white rounded-md px-3 py-2 border border-apptivia-carbon-300">
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="font-medium text-apptivia-ink">{s.skillset}</span>
                    <span className="text-apptivia-carbon-400 ml-auto">{currentXp} XP</span>
                    <span className="text-apptivia-ink font-semibold">+{s.estimatedXp}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-apptivia-ink mt-2">Estimated XP gain from completing this plan's focus KPIs</p>
          </div>
        )}

        {/* Action Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-apptivia-carbon-700">Action Items</label>
            {!inputDisabled && (
              <button onClick={() => addArrayField('action_items')} className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium">
                + Add Action
              </button>
            )}
          </div>
          <div className="space-y-2">
            {planForm.action_items.map((action, index) => (
              <div key={`action-${index}-${planForm.action_items.length}`} className="flex gap-2">
                <input
                  type="text"
                  value={action}
                  onChange={(e) => updateArrayField('action_items', index, e.target.value)}
                  disabled={inputDisabled}
                  className={`flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
                  placeholder={`Action item ${index + 1}`}
                />
                {planForm.action_items.length > 1 && !inputDisabled && (
                  <button onClick={() => removeArrayField('action_items', index)} className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium">
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
            <label className="block text-sm font-medium text-apptivia-carbon-700">Success Metrics</label>
            {!inputDisabled && (
              <button onClick={() => addArrayField('success_metrics')} className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium">
                + Add Metric
              </button>
            )}
          </div>
          <div className="space-y-2">
            {planForm.success_metrics.map((metric, index) => (
              <div key={`metric-${index}-${planForm.success_metrics.length}`} className="flex gap-2">
                <input
                  type="text"
                  value={metric}
                  onChange={(e) => updateArrayField('success_metrics', index, e.target.value)}
                  disabled={inputDisabled}
                  className={`flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
                  placeholder="e.g., Achieve 20% conversion rate"
                />
                {planForm.success_metrics.length > 1 && !inputDisabled && (
                  <button onClick={() => removeArrayField('success_metrics', index)} className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">Notes</label>
          <textarea
            value={planForm.notes}
            onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
            disabled={inputDisabled}
            rows={4}
            className={`w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputDisabled ? 'bg-apptivia-paper text-apptivia-carbon-400' : ''}`}
            placeholder="Additional notes or context..."
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2 pt-4 border-t border-apptivia-carbon-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold border border-apptivia-carbon-300 text-apptivia-carbon-700 rounded-md hover:bg-apptivia-paper"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePlan}
            disabled={savingPlan || inputDisabled}
            className="px-4 py-2 text-sm font-semibold bg-apptivia-coral text-white rounded-md hover:bg-apptivia-coral disabled:opacity-60"
          >
            {savingPlan ? 'Saving...' : (editingPlan ? (isPlaybook ? 'Update Playbook' : 'Update Plan') : (isPlaybook ? 'Save Playbook' : 'Save Plan'))}
          </button>
        </div>
      </div>
    </div>
  );
}
