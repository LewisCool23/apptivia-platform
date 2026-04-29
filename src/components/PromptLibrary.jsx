import React, { useState, useMemo } from 'react';
import {
  BookOpen, Filter, Sparkles, Copy, Check, Edit3, Trash2,
  Plus, ChevronDown, ChevronUp, Tag, Cpu, Mail, Linkedin,
  Eye, EyeOff, RefreshCw, X, Save, AlertTriangle, Zap,
  MessageSquare, Shield, Clock, Target, Brain, Search
} from 'lucide-react';
import { usePromptLibrary } from '../hooks/usePromptLibrary';
import ConfirmModal from './ConfirmModal';
import SearchWithHistory from './SearchWithHistory';

// ── Constants ────────────────────────────────────────────────

const CATEGORY_META = {
  research:       { label: 'Research',        icon: Search,         color: 'bg-apptivia-coral-tone-50 text-apptivia-coral',    border: 'border-apptivia-coral-tone-100' },
  outreach:       { label: 'Outreach',        icon: Mail,           color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
  analysis:       { label: 'Analysis',        icon: Brain,          color: 'bg-apptivia-carbon-100 text-apptivia-ink', border: 'border-apptivia-carbon-300' },
  follow_up:      { label: 'Follow-Up',       icon: MessageSquare,  color: 'bg-amber-100 text-amber-700',  border: 'border-amber-200' },
  deliverability: { label: 'Deliverability',  icon: Shield,         color: 'bg-red-100 text-red-700',      border: 'border-red-200' },
  general:        { label: 'General',         icon: BookOpen,       color: 'bg-apptivia-carbon-100 text-apptivia-carbon-700',    border: 'border-apptivia-carbon-200' },
};

const MODEL_META = {
  chatgpt: { label: 'ChatGPT', color: 'bg-green-50 text-green-700', icon: '🟢' },
  claude:  { label: 'Claude',  color: 'bg-orange-50 text-orange-700', icon: '🟠' },
  any:     { label: 'Any',     color: 'bg-apptivia-paper text-apptivia-carbon-600',    icon: '⚪' },
};

// ── Sub-Components ───────────────────────────────────────────

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.general;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
      <Icon size={10} /> {meta.label}
    </span>
  );
}

function ModelBadge({ model }) {
  const meta = MODEL_META[model] || MODEL_META.any;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.color}`}>
      {meta.icon} {meta.label}
    </span>
  );
}

function VariablePill({ name }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-ink text-[10px] font-mono font-medium">
      {'{{' + name + '}}'}
    </span>
  );
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-apptivia-carbon-500 hover:text-apptivia-carbon-700 hover:bg-apptivia-carbon-100 transition-colors"
    >
      {copied ? <><Check size={10} className="text-emerald-500" /> Copied</> : <><Copy size={10} /> {label}</>}
    </button>
  );
}

// ── Prompt Card (expanded/collapsed) ─────────────────────────

function PromptCard({ template, onDuplicate, onToggleActive, onDelete, onTest }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-lg border ${template.is_active ? 'border-apptivia-carbon-100' : 'border-red-100 opacity-60'} overflow-hidden transition-all`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-apptivia-paper/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-apptivia-carbon-400 w-5 text-center">{template.sort_order}</span>
            <CategoryBadge category={template.category} />
            <ModelBadge model={template.ai_model} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-apptivia-ink truncate">{template.name}</h3>
            <p className="text-[11px] text-apptivia-carbon-400 truncate">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {template.channel && (
            <span className="text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded font-medium capitalize">
              {template.channel}
            </span>
          )}
          {template.is_system && (
            <span className="text-[10px] bg-apptivia-carbon-100 text-apptivia-ink px-1.5 py-0.5 rounded font-medium">System</span>
          )}
          {expanded ? <ChevronUp size={14} className="text-apptivia-carbon-400" /> : <ChevronDown size={14} className="text-apptivia-carbon-400" />}
        </div>
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="border-t border-apptivia-carbon-100 px-5 py-4 space-y-4">
          {/* Variables */}
          {template.variables?.length > 0 && (
            <div>
              <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1.5">Variables</span>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map(v => <VariablePill key={v} name={v} />)}
              </div>
            </div>
          )}

          {/* System Prompt */}
          {template.system_prompt && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">System Prompt</span>
                <CopyButton text={template.system_prompt} label="Copy System" />
              </div>
              <div className="bg-apptivia-paper rounded-lg p-3 text-xs text-apptivia-carbon-600 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {template.system_prompt}
              </div>
            </div>
          )}

          {/* User Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Prompt Template</span>
              <CopyButton text={template.user_prompt} label="Copy Prompt" />
            </div>
            <div className="bg-apptivia-paper rounded-lg p-3 text-xs text-apptivia-carbon-700 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto border border-apptivia-carbon-100">
              {template.user_prompt}
            </div>
          </div>

          {/* Tags */}
          {template.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Tag size={10} className="text-apptivia-carbon-300 mt-0.5" />
              {template.tags.map(tag => (
                <span key={tag} className="text-[10px] text-apptivia-carbon-400 bg-apptivia-paper px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-[10px] text-apptivia-carbon-400">
            <span>Max tokens: {template.max_tokens}</span>
            <span>Temperature: {template.temperature}</span>
            <span>Version {template.version}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-apptivia-carbon-100">
            <button
              onClick={(e) => { e.stopPropagation(); onTest?.(template); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white rounded-lg text-[11px] font-semibold hover:opacity-90 transition-opacity"
            >
              <Sparkles size={11} /> Test Prompt
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate?.(template); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-lg text-[11px] font-medium hover:bg-apptivia-carbon-200 transition-colors"
            >
              <Copy size={11} /> Duplicate & Edit
            </button>
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onToggleActive?.(template.id); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors"
            >
              {template.is_active ? <><EyeOff size={10} /> Disable</> : <><Eye size={10} /> Enable</>}
            </button>
            {!template.is_system && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(template); }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 size={10} /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Test Prompt Modal ────────────────────────────────────────

function TestPromptModal({ template, onClose }) {
  const [vars, setVars] = useState(() => {
    const init = {};
    (template.variables || []).forEach(v => { init[v] = ''; });
    return init;
  });
  const [resolved, setResolved] = useState(null);

  const handleResolve = () => {
    let prompt = template.user_prompt;
    let sys = template.system_prompt || '';
    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      prompt = prompt.replace(pattern, value || `[${key}]`);
      sys = sys.replace(pattern, value || `[${key}]`);
    }
    setResolved({ system: sys, user: prompt });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <div>
            <h3 className="text-sm font-bold text-apptivia-ink">{template.name}</h3>
            <p className="text-[11px] text-apptivia-carbon-400">Fill in variables to preview the resolved prompt</p>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Variable inputs */}
          {(template.variables || []).length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Variables</span>
              {template.variables.map(v => (
                <div key={v}>
                  <label className="text-xs font-medium text-apptivia-carbon-600 block mb-0.5">{`{{${v}}}`}</label>
                  <input
                    type="text"
                    value={vars[v] || ''}
                    onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Enter ${v.toLowerCase().replace(/_/g, ' ')}...`}
                    className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleResolve}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-apptivia-coral text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles size={12} /> Preview Resolved Prompt
          </button>

          {/* Resolved output */}
          {resolved && (
            <div className="space-y-3 animate-in fade-in">
              {resolved.system && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">System Message</span>
                    <CopyButton text={resolved.system} />
                  </div>
                  <div className="bg-apptivia-carbon-100 rounded-lg p-3 text-xs text-apptivia-ink font-mono whitespace-pre-wrap leading-relaxed border border-apptivia-carbon-300">
                    {resolved.system}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">User Message</span>
                  <CopyButton text={resolved.user} />
                </div>
                <div className="bg-apptivia-coral-tone-50 rounded-lg p-3 text-xs text-apptivia-coral-tone-700 font-mono whitespace-pre-wrap leading-relaxed border border-apptivia-coral-tone-100">
                  {resolved.user}
                </div>
              </div>
              <p className="text-[10px] text-apptivia-carbon-400 text-center">
                Copy the resolved prompt and paste it into {template.ai_model === 'chatgpt' ? 'ChatGPT' : template.ai_model === 'claude' ? 'Claude' : 'your preferred AI'} — or use it within Engage's AI generation flows.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Prompt Modal ──────────────────────────────────────

function CreatePromptModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', key: '', category: 'outreach', ai_model: 'claude',
    description: '', system_prompt: '', user_prompt: '',
    variables: '', channel: '', tags: '', max_tokens: 1000, temperature: 0.7,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.user_prompt) return;
    setSaving(true);
    try {
      const key = form.key || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      await onSave({
        ...form,
        key,
        variables: form.variables ? form.variables.split(',').map(v => v.trim().toUpperCase()) : [],
        tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
        channel: form.channel || null,
      });
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <div>
            <h3 className="text-sm font-bold text-apptivia-ink">Create New Prompt</h3>
            <p className="text-[11px] text-apptivia-carbon-400">Add a custom prompt template to your library</p>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
                placeholder="First Email — Pain Point" />
            </div>
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Key (auto-generated)</label>
              <input type="text" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
                placeholder="first_email_pain_point" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100">
                {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">AI Model</label>
              <select value={form.ai_model} onChange={e => setForm(f => ({ ...f, ai_model: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100">
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
                <option value="any">Any</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Channel</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100">
                <option value="">None</option>
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="call">Call</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
              placeholder="Brief description of what this prompt does..." />
          </div>

          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">System Prompt</label>
            <textarea value={form.system_prompt} onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              rows={3} className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
              placeholder="System-level instructions (sent as system message)..." />
          </div>

          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Prompt Template *</label>
            <textarea value={form.user_prompt} onChange={e => setForm(f => ({ ...f, user_prompt: e.target.value }))}
              rows={6} className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
              placeholder="Use {{VARIABLE}} placeholders for dynamic content..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Variables (comma-separated)</label>
              <input type="text" value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
                placeholder="COMPANY, PROSPECT, ANGLE" />
            </div>
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Tags (comma-separated)</label>
              <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
                placeholder="research, outreach, cold-email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Max Tokens</label>
              <input type="number" value={form.max_tokens} onChange={e => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 1000 }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100" />
            </div>
            <div>
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Temperature</label>
              <input type="number" step="0.1" min="0" max="1" value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.7 }))}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.user_prompt}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-apptivia-coral text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <><RefreshCw size={12} className="animate-spin" /> Saving...</> : <><Save size={12} /> Save Prompt</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function PromptLibrary({ organizationId }) {
  const { templates, loading, stats, refresh, duplicateTemplate, toggleActive, deleteTemplate, createTemplate } = usePromptLibrary({ organizationId });

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [testingTemplate, setTestingTemplate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filtered templates
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (modelFilter !== 'all' && t.ai_model !== modelFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.includes(q)) ||
          t.key.includes(q);
      }
      return true;
    });
  }, [templates, categoryFilter, modelFilter, searchQuery]);

  const handleDuplicate = async (template) => {
    try { await duplicateTemplate(template); } catch (err) { alert(err.message); }
  };

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, template: null, isLoading: false });

  const handleDelete = (template) => {
    setDeleteConfirm({ isOpen: true, template, isLoading: false });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.template?.id;
    if (!id) return;
    setDeleteConfirm(prev => ({ ...prev, isLoading: true }));
    try {
      await deleteTemplate(id);
      setDeleteConfirm({ isOpen: false, template: null, isLoading: false });
    } catch (err) {
      alert(err.message);
      setDeleteConfirm({ isOpen: false, template: null, isLoading: false });
    }
  };

  const handleCreate = async (formData) => {
    await createTemplate(formData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-apptivia-coral" />
        <span className="ml-2 text-sm text-apptivia-carbon-500">Loading prompt library...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, template: null, isLoading: false })}
        onConfirm={confirmDelete}
        title="Delete Prompt Template?"
        message={`Are you sure you want to delete "${deleteConfirm.template?.name || 'this template'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteConfirm.isLoading}
      />
      {/* Header Card */}
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
        <div className="bg-apptivia-ink px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Outbound AI Prompt Library</h2>
              <p className="text-xs text-white/70">Battle-tested prompts for research, outreach, analysis & deliverability</p>
            </div>
          </div>

          {/* Philosophy banner */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5 text-white/90 text-[11px] leading-relaxed">
            <strong>Core Rule:</strong> Never ask AI to "write an email" first. Always ask it to reduce uncertainty, identify pressure, expose risk, generate angles. Writing comes last.
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 divide-x divide-gray-100 px-1 py-3">
          {[
            { label: 'Total', value: stats.total, icon: BookOpen },
            { label: 'Research', value: stats.byCategory.research || 0, icon: Search },
            { label: 'Outreach', value: stats.byCategory.outreach || 0, icon: Mail },
            { label: 'ChatGPT', value: stats.byModel.chatgpt || 0, icon: Zap },
            { label: 'Claude', value: stats.byModel.claude || 0, icon: Brain },
          ].map(s => (
            <div key={s.label} className="text-center px-3">
              <div className="text-lg font-bold text-apptivia-ink">{s.value}</div>
              <div className="text-[10px] text-apptivia-carbon-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow guide */}
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
        <h3 className="text-xs font-bold text-apptivia-carbon-700 mb-2 flex items-center gap-1.5"><Target size={12} /> Recommended Workflow</h3>
        <div className="flex items-center gap-2 text-[11px] text-apptivia-carbon-500">
          <span className="flex items-center gap-1 px-2 py-1 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg font-medium">1. Research</span>
          <span className="text-apptivia-carbon-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium">2. Angles</span>
          <span className="text-apptivia-carbon-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg font-medium">3. Draft</span>
          <span className="text-apptivia-carbon-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg font-medium">4. Analyze</span>
          <span className="text-apptivia-carbon-300">→</span>
          <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-lg font-medium">5. Review</span>
        </div>
        <p className="text-[10px] text-apptivia-carbon-400 mt-2">
          ChatGPT handles structure, logic, and prioritization. Claude handles nuance, tone, and synthesis. Reps make final decisions.
        </p>
      </div>

      {/* Filters & Actions bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <SearchWithHistory
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search prompts by name, tag, or keyword..."
          context="prompts"
          className="flex-1"
          inputClassName="text-xs"
        />

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Model filter */}
        <select
          value={modelFilter}
          onChange={e => setModelFilter(e.target.value)}
          className="text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-100"
        >
          <option value="all">All Models</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="claude">Claude</option>
        </select>

        {/* Create button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-apptivia-ink text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={12} /> New Prompt
        </button>

        {/* Refresh */}
        <button onClick={refresh} className="p-2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Prompt Cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 bg-white rounded-lg border border-apptivia-carbon-100">
            <BookOpen size={24} className="mx-auto text-apptivia-carbon-300 mb-2" />
            <p className="text-sm text-apptivia-carbon-500">No prompts match your filters</p>
            <p className="text-[11px] text-apptivia-carbon-400">Try adjusting your search or category filter</p>
          </div>
        )}
        {filtered.map(t => (
          <PromptCard
            key={t.id}
            template={t}
            onDuplicate={handleDuplicate}
            onToggleActive={toggleActive}
            onDelete={handleDelete}
            onTest={setTestingTemplate}
          />
        ))}
      </div>

      {/* Modals */}
      {testingTemplate && <TestPromptModal template={testingTemplate} onClose={() => setTestingTemplate(null)} />}
      {showCreateModal && <CreatePromptModal onClose={() => setShowCreateModal(false)} onSave={handleCreate} />}
    </div>
  );
}
