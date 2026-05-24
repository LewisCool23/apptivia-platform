/**
 * CepConfigSection — Org Settings section for configuring CEP stages and titles.
 * Rendered inside OrganizationSettings General tab between Signal Library and Feedback Insights.
 */

import React, { useState, useCallback } from 'react';
import { Plus, X, Trash2, GripVertical, ChevronDown, ChevronRight, Edit3, Check, AlertCircle, Layers } from 'lucide-react';
import { useCepConfig } from '../hooks/useCepConfig';
import ConfirmModal from './ConfirmModal';

// ── Color Picker (8 predefined) ──────────────────────────────

const PRESET_COLORS = [
  '#FF4D2E', '#FF8A6B', '#F59E0B', '#16A34A',
  '#06B6D4', '#3F3F46', '#71717A', '#C8341B',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-full border-2 transition-all ${value === c ? 'border-apptivia-carbon-800 scale-110' : 'border-transparent hover:border-apptivia-carbon-300'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// ── Checklist Items Editor ────────────────────────────────────

function ChecklistEditor({ items, onChange }) {
  const addItem = () => {
    const key = `item_${Date.now()}`;
    onChange([...items, { key, label: '', required: false }]);
  };
  const updateItem = (idx, field, val) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    onChange(updated);
  };
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-apptivia-carbon-600">Checklist Items</label>
      {items.map((item, idx) => (
        <div key={item.key} className="flex items-center gap-2">
          <input
            type="text"
            value={item.label}
            onChange={e => updateItem(idx, 'label', e.target.value)}
            placeholder="Checklist item label"
            className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-apptivia-coral"
          />
          <label className="flex items-center gap-1 text-xs text-apptivia-carbon-500 whitespace-nowrap">
            <input
              type="checkbox"
              checked={item.required}
              onChange={e => updateItem(idx, 'required', e.target.checked)}
              className="rounded border-apptivia-carbon-300"
            />
            Req
          </label>
          <button type="button" onClick={() => removeItem(idx)} className="text-apptivia-carbon-400 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 flex items-center gap-1">
        <Plus size={12} /> Add Item
      </button>
    </div>
  );
}

// ── Exit Criteria Editor ──────────────────────────────────────

function ExitCriteriaEditor({ items, onChange }) {
  const addItem = () => {
    const key = `ec_${Date.now()}`;
    onChange([...items, { key, label: '' }]);
  };
  const updateItem = (idx, val) => {
    const updated = items.map((item, i) => i === idx ? { ...item, label: val } : item);
    onChange(updated);
  };
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-apptivia-carbon-600">Exit Criteria</label>
      {items.map((item, idx) => (
        <div key={item.key} className="flex items-center gap-2">
          <input
            type="text"
            value={item.label}
            onChange={e => updateItem(idx, e.target.value)}
            placeholder="Exit criterion"
            className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-apptivia-coral"
          />
          <button type="button" onClick={() => removeItem(idx)} className="text-apptivia-carbon-400 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 flex items-center gap-1">
        <Plus size={12} /> Add Criterion
      </button>
    </div>
  );
}

// ── Role Responsibilities Editor ──────────────────────────────

function RoleResponsibilitiesEditor({ items, onChange, titles }) {
  const addItem = () => onChange([...items, { title: titles[0]?.title_name || '', responsibility: '' }]);
  const updateItem = (idx, field, val) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    onChange(updated);
  };
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-apptivia-carbon-600">Role Responsibilities</label>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={item.title}
            onChange={e => updateItem(idx, 'title', e.target.value)}
            className="border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm w-24"
          >
            {titles.map(t => (
              <option key={t.title_key || t.id} value={t.title_name}>{t.title_name}</option>
            ))}
            {!titles.find(t => t.title_name === item.title) && (
              <option value={item.title}>{item.title}</option>
            )}
          </select>
          <input
            type="text"
            value={item.responsibility}
            onChange={e => updateItem(idx, 'responsibility', e.target.value)}
            placeholder="Responsibility description"
            className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-apptivia-coral"
          />
          <button type="button" onClick={() => removeItem(idx)} className="text-apptivia-carbon-400 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addItem} className="text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 flex items-center gap-1">
        <Plus size={12} /> Add Responsibility
      </button>
    </div>
  );
}

// ── Stage Editor Modal ────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function CepStageEditorModal({ stage, titles, onSave, onClose }) {
  const isNew = !stage?.id;
  const [form, setForm] = useState({
    stage_name: stage?.stage_name || '',
    stage_key: stage?.stage_key || '',
    color: stage?.color || '#FF4D2E',
    win_probability: stage?.win_probability ?? 0,
    expected_days: stage?.expected_days ?? '',
    is_terminal: stage?.is_terminal ?? false,
    checklist_items: stage?.checklist_items || [],
    exit_criteria: stage?.exit_criteria || [],
    role_responsibilities: stage?.role_responsibilities || [],
  });
  const [autoKey, setAutoKey] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (name) => {
    setForm(f => ({
      ...f,
      stage_name: name,
      ...(autoKey ? { stage_key: slugify(name) } : {}),
    }));
  };

  const handleSave = async () => {
    if (!form.stage_name.trim()) { setError('Stage name is required'); return; }
    if (!form.stage_key.trim()) { setError('Stage key is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        expected_days: form.expected_days === '' ? null : Number(form.expected_days),
        win_probability: Number(form.win_probability),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save stage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold">{isNew ? 'Add Stage' : 'Edit Stage'}</h3>
          <button onClick={onClose} aria-label="Close" className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={20} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Name & Key */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Stage Name *</label>
              <input
                type="text"
                value={form.stage_name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Qualification"
                className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-apptivia-coral"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">
                Stage Key *
                {isNew && (
                  <button
                    type="button"
                    onClick={() => setAutoKey(!autoKey)}
                    className="ml-2 text-[10px] text-apptivia-coral hover:text-apptivia-coral"
                  >
                    {autoKey ? '(auto)' : '(manual)'}
                  </button>
                )}
              </label>
              <input
                type="text"
                value={form.stage_key}
                onChange={e => { setAutoKey(false); setForm(f => ({ ...f, stage_key: e.target.value })); }}
                placeholder="e.g. qualification"
                disabled={isNew && autoKey}
                className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-apptivia-coral disabled:bg-apptivia-paper"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Color</label>
            <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
          </div>

          {/* Win Probability & Expected Days */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Win Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.win_probability}
                onChange={e => setForm(f => ({ ...f, win_probability: e.target.value }))}
                className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Expected Days</label>
              <input
                type="number"
                min="0"
                value={form.expected_days}
                onChange={e => setForm(f => ({ ...f, expected_days: e.target.value }))}
                placeholder="No limit"
                className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Is Terminal */}
          <label className="flex items-center gap-2 text-sm text-apptivia-carbon-700">
            <input
              type="checkbox"
              checked={form.is_terminal}
              onChange={e => setForm(f => ({ ...f, is_terminal: e.target.checked }))}
              className="rounded border-apptivia-carbon-300"
            />
            Terminal stage (e.g. Closed Won, Closed Lost)
          </label>

          {/* Checklist Items */}
          <ChecklistEditor
            items={form.checklist_items}
            onChange={items => setForm(f => ({ ...f, checklist_items: items }))}
          />

          {/* Exit Criteria */}
          <ExitCriteriaEditor
            items={form.exit_criteria}
            onChange={items => setForm(f => ({ ...f, exit_criteria: items }))}
          />

          {/* Role Responsibilities */}
          <RoleResponsibilitiesEditor
            items={form.role_responsibilities}
            onChange={items => setForm(f => ({ ...f, role_responsibilities: items }))}
            titles={titles}
          />
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isNew ? 'Add Stage' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Title Editor Row ──────────────────────────────────────────

function TitleRow({ title, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title.title_name);
  const [desc, setDesc] = useState(title.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onUpdate(title.id, {
        title_name: name.trim(),
        title_key: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        description: desc.trim() || null,
      });
      setEditing(false);
    } catch (err) {
      console.error('Title save error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="border border-apptivia-carbon-300 rounded px-2 py-1 text-sm w-20 focus:ring-1 focus:ring-apptivia-coral"
          placeholder="Name"
        />
        <input
          type="text"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-apptivia-coral"
          placeholder="Description"
        />
        <button onClick={handleSave} disabled={saving} className="text-emerald-600 hover:text-emerald-800">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      <span className="inline-flex items-center justify-center w-10 h-6 bg-apptivia-carbon-100 rounded text-xs font-bold text-apptivia-carbon-700">
        {title.title_name}
      </span>
      <span className="flex-1 text-sm text-apptivia-carbon-600">{title.description || '—'}</span>
      <button onClick={() => setEditing(true)} className="text-apptivia-carbon-300 group-hover:text-apptivia-carbon-500 hover:text-apptivia-coral">
        <Edit3 size={13} />
      </button>
      <button onClick={() => onDelete(title.id)} className="text-apptivia-carbon-300 group-hover:text-apptivia-carbon-500 hover:text-red-500">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────

export default function CepConfigSection({ organizationId, compact = false }) {
  const {
    stages, activeStages, titles, hasCep, loading, error,
    createStage, updateStage, deleteStage, reorderStages,
    seedDefaultStages,
    createTitle, updateTitle, deleteTitle,
  } = useCepConfig(organizationId);

  const [expanded, setExpanded] = useState(true);
  const [editorStage, setEditorStage] = useState(null); // null = closed, {} = new, CepStage = edit
  const [seeding, setSeeding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // stageId
  const [newTitleName, setNewTitleName] = useState('');
  const [newTitleDesc, setNewTitleDesc] = useState('');
  const [addingTitle, setAddingTitle] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaultStages();
    } catch (err) {
      console.error('Seed error:', err);
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveStage = useCallback(async (formData) => {
    if (editorStage?.id) {
      await updateStage(editorStage.id, formData);
    } else {
      await createStage({
        ...formData,
        stage_order: stages.length + 1,
      });
    }
  }, [editorStage, updateStage, createStage, stages.length]);

  const handleDeleteStage = async (stageId) => {
    try {
      await deleteStage(stageId);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete stage error:', err);
    }
  };

  const handleAddTitle = async () => {
    if (!newTitleName.trim()) return;
    setAddingTitle(true);
    try {
      await createTitle({
        title_name: newTitleName.trim(),
        title_key: newTitleName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        description: newTitleDesc.trim() || null,
        sort_order: titles.length + 1,
      });
      setNewTitleName('');
      setNewTitleDesc('');
    } catch (err) {
      console.error('Add title error:', err);
    } finally {
      setAddingTitle(false);
    }
  };

  if (!organizationId) return null;

  const renderCepContent = () => {
    if (loading) return <p className="text-sm text-apptivia-carbon-400">Loading CEP configuration...</p>;
    if (error) return <div className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</div>;
    if (!hasCep) {
      return (
        <div className="bg-apptivia-paper border border-dashed border-apptivia-carbon-300 rounded-lg p-8 text-center">
          <div className="text-apptivia-carbon-400 mb-3">
            <Layers size={36} className="mx-auto" />
          </div>
          <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-1">No Sales Process Configured</h4>
          <p className="text-xs text-apptivia-carbon-500 mb-5 max-w-md mx-auto">
            Configure your Customer Engagement Process to add checklists, exit criteria, and role responsibilities for pipeline deals.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleSeed} disabled={seeding} className="px-4 py-2 bg-apptivia-coral text-white text-sm font-medium rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
              {seeding ? 'Setting up...' : 'Use Standard B2B Template'}
            </button>
            <button onClick={() => setEditorStage({})} className="px-4 py-2 bg-white border border-apptivia-carbon-300 text-apptivia-carbon-700 text-sm font-medium rounded-lg hover:bg-apptivia-paper">
              Build from Scratch
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-apptivia-carbon-700">Stages</h4>
            <button onClick={() => setEditorStage({})} className="flex items-center gap-1 text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 font-medium">
              <Plus size={13} /> Add Stage
            </button>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-apptivia-paper text-left text-xs text-apptivia-carbon-500 uppercase tracking-wide">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2 text-center">Win %</th>
                  <th className="px-3 py-2 text-center">Checklist</th>
                  <th className="px-3 py-2 text-center">Days</th>
                  <th className="px-3 py-2 text-center">Terminal</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {stages.sort((a, b) => a.stage_order - b.stage_order).map(stage => (
                  <tr key={stage.id} className="border-t hover:bg-apptivia-paper/50">
                    <td className="px-3 py-2 text-apptivia-carbon-300"><GripVertical size={14} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="font-medium text-apptivia-ink">{stage.stage_name}</span>
                        <span className="text-[10px] text-apptivia-carbon-400 font-mono">{stage.stage_key}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-apptivia-carbon-600">{stage.win_probability}%</td>
                    <td className="px-3 py-2 text-center text-apptivia-carbon-600">{(stage.checklist_items || []).length} items</td>
                    <td className="px-3 py-2 text-center text-apptivia-carbon-600">{stage.expected_days ?? '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {stage.is_terminal && <span className="text-[10px] font-medium bg-apptivia-carbon-200 text-apptivia-carbon-600 px-1.5 py-0.5 rounded">Terminal</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditorStage(stage)} className="text-apptivia-carbon-400 hover:text-apptivia-coral p-1" title="Edit stage"><Edit3 size={13} /></button>
                        <button onClick={() => setConfirmDelete(stage.id)} className="text-apptivia-carbon-400 hover:text-red-500 p-1" title="Delete stage"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Job Titles</h4>
          <p className="text-xs text-apptivia-carbon-500 mb-3">Titles define job functions (BDR, AE, PS, etc.) used in role responsibilities above.</p>
          <div className="space-y-1 mb-3">
            {titles.map(t => <TitleRow key={t.id} title={t} onUpdate={updateTitle} onDelete={deleteTitle} />)}
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={newTitleName} onChange={e => setNewTitleName(e.target.value)} placeholder="Title (e.g. SDR)" className="border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm w-24 focus:ring-1 focus:ring-apptivia-coral" onKeyDown={e => { if (e.key === 'Enter') handleAddTitle(); }} />
            <input type="text" value={newTitleDesc} onChange={e => setNewTitleDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-apptivia-coral" onKeyDown={e => { if (e.key === 'Enter') handleAddTitle(); }} />
            <button onClick={handleAddTitle} disabled={addingTitle || !newTitleName.trim()} className="px-3 py-1.5 bg-apptivia-carbon-100 rounded hover:bg-apptivia-carbon-200 text-apptivia-carbon-600 disabled:opacity-40"><Plus size={14} /></button>
          </div>
        </div>
      </div>
    );
  };

  const modals = (
    <>
      {editorStage !== null && (
        <CepStageEditorModal
          stage={editorStage?.id ? editorStage : null}
          titles={titles}
          onSave={handleSaveStage}
          onClose={() => setEditorStage(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Stage"
          message="Are you sure? Any deals in this stage will become unassigned."
          confirmText="Delete"
          variant="danger"
          onConfirm={() => handleDeleteStage(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );

  // Compact mode — no outer wrapper, used inside a parent collapsible panel
  if (compact) {
    return (
      <div>
        {renderCepContent()}
        {modals}
      </div>
    );
  }

  return (
    <div className="border-t pt-6">
      <div className="mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 group"
        >
          {expanded ? <ChevronDown size={16} className="text-apptivia-carbon-400" /> : <ChevronRight size={16} className="text-apptivia-carbon-400" />}
          <h3 className="text-lg font-semibold">Sales Process (CEP)</h3>
          {hasCep && (
            <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {activeStages.length} stages
            </span>
          )}
        </button>
        <p className="text-xs text-apptivia-carbon-500 mt-0.5 ml-6">
          Define your Customer Engagement Process — stages, checklists, exit criteria, and role responsibilities for pipeline deals.
        </p>
      </div>
      {expanded && renderCepContent()}
      {modals}
    </div>
  );
}
