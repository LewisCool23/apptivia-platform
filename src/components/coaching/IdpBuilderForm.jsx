import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, Sparkles } from 'lucide-react';
import { buildLabel } from '../../constants/kpiGuidance';
import { idpPlanTypes } from './idpStatusConfig';

export default function IdpBuilderForm({
  editingIdp,
  form,
  setForm,
  onSave,
  saving,
  availableKPIs,
  teamMembers,
  onCancel,
  onAutoGenerate,
  autoGenerating,
}) {
  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addArrayItem = (field, item) => setForm(prev => ({ ...prev, [field]: [...(prev[field] || []), item] }));
  const updateArrayItem = (field, idx, item) => setForm(prev => ({
    ...prev, [field]: (prev[field] || []).map((v, i) => i === idx ? { ...v, ...item } : v)
  }));
  const removeArrayItem = (field, idx) => setForm(prev => ({
    ...prev, [field]: (prev[field] || []).filter((_, i) => i !== idx)
  }));

  const repMembers = (teamMembers || []).filter(m => !['admin', 'manager', 'coach'].includes(m.role));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 relative">
      {autoGenerating && (
        <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 text-purple-700 bg-purple-50 px-4 py-3 rounded-lg shadow-sm border border-purple-200">
            <Sparkles size={16} className="animate-spin" />
            <span className="text-sm font-semibold">Generating AI development plan...</span>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {editingIdp ? 'Edit Development Plan' : 'Create Development Plan'}
          </h3>
          <p className="text-xs text-gray-500">Define a long-term growth plan with milestones and success criteria</p>
        </div>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
      </div>

      <div className="space-y-5">
        {/* Rep selector */}
        {repMembers.length > 0 && !editingIdp && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Rep</label>
            <div className="flex gap-2">
              <select
                value={form.profile_id || ''}
                onChange={e => updateField('profile_id', e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select a rep...</option>
                {repMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                ))}
              </select>
              {onAutoGenerate && form.profile_id && (
                <button
                  type="button"
                  onClick={() => onAutoGenerate(form.profile_id)}
                  disabled={autoGenerating}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 disabled:opacity-50 whitespace-nowrap"
                >
                  <Sparkles size={14} className={autoGenerating ? 'animate-spin' : ''} />
                  {autoGenerating ? 'Generating...' : 'Generate with AI'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Name + Plan Type row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Name</label>
            <input
              type="text"
              value={form.name || ''}
              onChange={e => updateField('name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Q2 Pipeline Growth Plan"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Plan Type</label>
            <select
              value={form.plan_type || 'quarterly'}
              onChange={e => updateField('plan_type', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {Object.entries(idpPlanTypes).map(([key, val]) => (
                <option key={key} value={key}>{val.label} ({val.duration})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
          <textarea
            value={form.description || ''}
            onChange={e => updateField('description', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            rows={2}
            placeholder="Brief overview of this development plan..."
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
            <input type="date" value={form.period_start || ''} onChange={e => updateField('period_start', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
            <input type="date" value={form.period_end || ''} onChange={e => updateField('period_end', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Focus KPIs */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Focus KPIs</label>
          <div className="flex flex-wrap gap-2">
            {(availableKPIs || []).map(kpi => {
              const key = kpi.key || kpi;
              const selected = (form.focus_kpis || []).includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (selected) updateField('focus_kpis', (form.focus_kpis || []).filter(k => k !== key));
                    else updateField('focus_kpis', [...(form.focus_kpis || []), key]);
                  }}
                  className={`px-2 py-1 rounded text-xs border transition-all ${
                    selected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {buildLabel(key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Career Goals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Career Goals</label>
            <button type="button" onClick={() => addArrayItem('career_goals', { goal: '', timeframe: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.career_goals || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input value={item.goal || ''} onChange={e => updateArrayItem('career_goals', idx, { goal: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Goal description" />
              <input value={item.timeframe || ''} onChange={e => updateArrayItem('career_goals', idx, { timeframe: e.target.value })}
                className="w-32 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Timeframe" />
              <button type="button" onClick={() => removeArrayItem('career_goals', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Development Areas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Development Areas</label>
            <button type="button" onClick={() => addArrayItem('development_areas', { area: '', current_level: 'beginner', target_level: 'intermediate' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.development_areas || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input value={item.area || ''} onChange={e => updateArrayItem('development_areas', idx, { area: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Area name" />
              <select value={item.current_level || 'beginner'} onChange={e => updateArrayItem('development_areas', idx, { current_level: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="none">None</option><option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option><option value="proficient">Proficient</option><option value="advanced">Advanced</option>
              </select>
              <span className="text-gray-400 text-xs">→</span>
              <select value={item.target_level || 'intermediate'} onChange={e => updateArrayItem('development_areas', idx, { target_level: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option>
                <option value="proficient">Proficient</option><option value="advanced">Advanced</option>
              </select>
              <button type="button" onClick={() => removeArrayItem('development_areas', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Milestones */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Milestones</label>
            <button type="button" onClick={() => addArrayItem('milestones', { title: '', target_date: '', status: 'pending', notes: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.milestones || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input value={item.title || ''} onChange={e => updateArrayItem('milestones', idx, { title: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Milestone title" />
              <input type="date" value={item.target_date || ''} onChange={e => updateArrayItem('milestones', idx, { target_date: e.target.value })}
                className="w-36 border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
              <select value={item.status || 'pending'} onChange={e => updateArrayItem('milestones', idx, { status: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
              </select>
              <button type="button" onClick={() => removeArrayItem('milestones', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Action Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Action Items</label>
            <button type="button" onClick={() => addArrayItem('action_items', { action: '', category: 'practice' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.action_items || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input value={item.action || ''} onChange={e => updateArrayItem('action_items', idx, { action: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Action item" />
              <select value={item.category || 'practice'} onChange={e => updateArrayItem('action_items', idx, { category: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="training">Training</option><option value="on_the_job">On-the-Job</option>
                <option value="practice">Practice</option><option value="coaching">Coaching</option><option value="habit">Habit</option>
              </select>
              <button type="button" onClick={() => removeArrayItem('action_items', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Resources */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Resources</label>
            <button type="button" onClick={() => addArrayItem('resources', { title: '', type: 'guide', url: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.resources || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input value={item.title || ''} onChange={e => updateArrayItem('resources', idx, { title: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Resource title" />
              <select value={item.type || 'guide'} onChange={e => updateArrayItem('resources', idx, { type: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                <option value="course">Course</option><option value="book">Book</option>
                <option value="guide">Guide</option><option value="mentoring">Mentoring</option><option value="methodology">Methodology</option>
              </select>
              <button type="button" onClick={() => removeArrayItem('resources', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Success Criteria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">Success Criteria</label>
            <button type="button" onClick={() => addArrayItem('success_criteria', { criterion: '' })}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
          {(form.success_criteria || []).map((item, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-center">
              <input value={item.criterion || ''} onChange={e => updateArrayItem('success_criteria', idx, { criterion: e.target.value })}
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" placeholder="Success criterion" />
              <button type="button" onClick={() => removeArrayItem('success_criteria', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes || ''} onChange={e => updateField('notes', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" rows={2} placeholder="Additional notes..." />
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : (editingIdp ? 'Update Plan' : 'Create Plan')}
          </button>
        </div>
      </div>
    </div>
  );
}
