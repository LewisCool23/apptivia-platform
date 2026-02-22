import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function PlanBuilderForm({
  editingPlan,
  planForm,
  setPlanForm,
  handleSavePlan,
  savingPlan,
  draftingField,
  handleAiDraft,
  availableKPIs,
  handleFocusKpiChange,
  addArrayField,
  updateArrayField,
  removeArrayField,
  onCancel,
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {editingPlan ? 'Edit Coaching Plan' : 'Create Coaching Plan'}
          </h3>
          <p className="text-xs text-gray-500">Build a structured coaching plan</p>
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      <div className="space-y-6">
        {/* Plan Name */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Plan Name <span className="text-red-500">*</span>
            </label>
            <button
              onClick={() => handleAiDraft('name')}
              disabled={draftingField === 'name'}
              className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
            >
              {draftingField === 'name' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {draftingField === 'name' ? 'Drafting...' : 'Draft with AI'}
            </button>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={planForm.date_range_start}
              onChange={(e) => setPlanForm({ ...planForm, date_range_start: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
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
            <label className="block text-sm font-medium text-gray-700">Goals (1-3)</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAiDraft('goals')}
                disabled={draftingField === 'goals'}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {draftingField === 'goals' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {draftingField === 'goals' ? 'Drafting...' : 'Draft with AI'}
              </button>
              <button onClick={() => addArrayField('goals')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Add Goal
              </button>
            </div>
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
            <label className="block text-sm font-medium text-gray-700">Focus KPIs (2-5)</label>
            <button onClick={() => addArrayField('focus_kpis')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
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
                  <button onClick={() => removeArrayField('focus_kpis', index)} className="px-3 py-2 text-red-600 hover:text-red-700 text-xs font-medium">
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
            <label className="block text-sm font-medium text-gray-700">Action Items</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAiDraft('action_items')}
                disabled={draftingField === 'action_items'}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {draftingField === 'action_items' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {draftingField === 'action_items' ? 'Drafting...' : 'Draft with AI'}
              </button>
              <button onClick={() => addArrayField('action_items')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Add Action
              </button>
            </div>
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
            <label className="block text-sm font-medium text-gray-700">Success Metrics</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAiDraft('success_metrics')}
                disabled={draftingField === 'success_metrics'}
                className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
              >
                {draftingField === 'success_metrics' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {draftingField === 'success_metrics' ? 'Drafting...' : 'Draft with AI'}
              </button>
              <button onClick={() => addArrayField('success_metrics')} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                + Add Metric
              </button>
            </div>
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <button
              onClick={() => handleAiDraft('notes')}
              disabled={draftingField === 'notes'}
              className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50"
            >
              {draftingField === 'notes' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {draftingField === 'notes' ? 'Drafting...' : 'Draft with AI'}
            </button>
          </div>
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
            onClick={onCancel}
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
  );
}
