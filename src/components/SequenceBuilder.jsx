import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Pause, Trash2, Users, Mail, Phone, CheckSquare, Clock, ChevronRight, ArrowRight, Edit2, Save, X, RefreshCw } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import toast from 'react-hot-toast';

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail, color: 'text-apptivia-coral' },
  { value: 'call', label: 'Call', icon: Phone, color: 'text-green-500' },
  { value: 'task', label: 'Task', icon: CheckSquare, color: 'text-apptivia-ink' },
];

const STATUS_BADGES = {
  draft:     { label: 'Draft',     color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' },
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',    color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
  archived:  { label: 'Archived',  color: 'bg-apptivia-carbon-100 text-apptivia-carbon-400' },
};

function SequenceList({ sequences, onSelect, onNew, loading }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-apptivia-ink">Sequences</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-apptivia-coral text-white text-xs font-medium rounded-lg hover:bg-apptivia-coral transition-colors"
        >
          <Plus size={14} />
          New Sequence
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-apptivia-carbon-400 text-sm">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12">
          <Mail size={32} className="mx-auto text-apptivia-carbon-300 mb-3" />
          <p className="text-sm text-apptivia-carbon-500 mb-1">No sequences yet</p>
          <p className="text-xs text-apptivia-carbon-400">Create multi-step outreach cadences to engage prospects automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => {
            const badge = STATUS_BADGES[seq.status] || STATUS_BADGES.draft;
            return (
              <button
                key={seq.id}
                onClick={() => onSelect(seq.id)}
                className="w-full text-left p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-apptivia-ink group-hover:text-apptivia-coral">{seq.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-apptivia-carbon-400">
                  <span>{seq.total_steps || 0} steps</span>
                  <span>{seq.total_enrolled || 0} enrolled</span>
                  <span>{seq.total_completed || 0} completed</span>
                  {(seq.total_replied || 0) > 0 && <span className="text-green-500">{seq.total_replied} replied</span>}
                  <ChevronRight size={12} className="ml-auto text-apptivia-carbon-300 group-hover:text-apptivia-coral-tone-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepEditor({ step, index, onChange, onRemove }) {
  const channelInfo = CHANNEL_OPTIONS.find(c => c.value === step.channel) || CHANNEL_OPTIONS[0];
  return (
    <div className="relative pl-8 pb-4">
      {/* Connector line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-apptivia-carbon-200" />
      <div className="absolute left-1.5 top-2 w-3 h-3 rounded-full bg-apptivia-coral border-2 border-white shadow-sm z-10" />

      <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-apptivia-carbon-400 uppercase">Step {index + 1}</span>
            <select
              value={step.channel}
              onChange={(e) => onChange({ ...step, channel: e.target.value })}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-300"
            >
              {CHANNEL_OPTIONS.map(ch => (
                <option key={ch.value} value={ch.value}>{ch.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-xs text-apptivia-carbon-400">
              <Clock size={11} />
              <input
                type="number"
                min="0"
                max="90"
                value={step.delay_days ?? 1}
                onChange={(e) => onChange({ ...step, delay_days: parseInt(e.target.value) || 0 })}
                className="w-10 text-center border border-gray-200 rounded px-1 py-0.5 text-xs"
              />
              <span>day{(step.delay_days ?? 1) !== 1 ? 's' : ''} delay</span>
            </div>
          </div>
          <button onClick={onRemove} className="text-apptivia-carbon-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>

        {(step.channel === 'email') && (
          <input
            type="text"
            placeholder="Email subject..."
            value={step.subject || ''}
            onChange={(e) => onChange({ ...step, subject: e.target.value })}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 mb-2 focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
          />
        )}

        <textarea
          placeholder={step.channel === 'email' ? 'Email body...' : step.channel === 'call' ? 'Call script / talking points...' : 'Task description...'}
          value={step.body || ''}
          onChange={(e) => onChange({ ...step, body: e.target.value })}
          rows={3}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 resize-none"
        />

        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-1.5 text-[11px] text-apptivia-carbon-500 cursor-pointer">
            <input
              type="checkbox"
              checked={step.skip_if_replied !== false}
              onChange={(e) => onChange({ ...step, skip_if_replied: e.target.checked })}
              className="rounded text-apptivia-coral w-3 h-3"
            />
            Skip if replied
          </label>
        </div>
      </div>
    </div>
  );
}

function SequenceDetail({ sequenceId, onBack, organizationId }) {
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch(`/api/engage/sequences/${sequenceId}`);
      const data = await res.json();
      if (data.data) {
        setSequence(data.data);
        setSteps(data.data.steps || []);
        setEditName(data.data.name);
        setEditDescription(data.data.description || '');
      }
    } catch (err) {
      toast.error('Failed to load sequence');
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await backendFetch('/api/engage/sequences', {
        method: 'POST',
        body: JSON.stringify({
          id: sequenceId,
          name: editName,
          description: editDescription,
          status: sequence.status,
          default_channel: sequence.default_channel,
          send_window_start: sequence.send_window_start,
          send_window_end: sequence.send_window_end,
          send_timezone: sequence.send_timezone,
          skip_weekends: sequence.skip_weekends,
          steps,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Sequence saved');
        setEditing(false);
        load();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch (err) {
      toast.error('Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = sequence.status === 'active' ? 'paused' : 'active';
    try {
      await backendFetch('/api/engage/sequences', {
        method: 'POST',
        body: JSON.stringify({ id: sequenceId, name: sequence.name, status: newStatus, steps }),
      });
      toast.success(`Sequence ${newStatus === 'active' ? 'activated' : 'paused'}`);
      load();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleEnroll = async () => {
    if (!enrollEmail) return;
    setEnrolling(true);
    try {
      const res = await backendFetch(`/api/engage/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ prospect_email: enrollEmail }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Enrolled ${enrollEmail}`);
        setEnrollEmail('');
        load();
      } else {
        toast.error(data.error || 'Failed to enroll');
      }
    } catch (err) {
      toast.error('Failed to enroll prospect');
    } finally {
      setEnrolling(false);
    }
  };

  const addStep = () => {
    setSteps(prev => [...prev, { channel: 'email', delay_days: 1, subject: '', body: '', skip_if_replied: true }]);
    setEditing(true);
  };

  const updateStep = (index, updated) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) return <div className="text-center py-12 text-apptivia-carbon-400 text-sm">Loading...</div>;
  if (!sequence) return <div className="text-center py-12 text-apptivia-carbon-400 text-sm">Sequence not found</div>;

  const badge = STATUS_BADGES[sequence.status] || STATUS_BADGES.draft;
  const stats = sequence.enrollment_stats || {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-xs">&larr; Back</button>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          {editing ? (
            <div className="space-y-1">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-base font-semibold border border-gray-200 rounded-lg px-2 py-1 w-64"
              />
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description..."
                className="text-xs text-apptivia-carbon-500 border border-gray-200 rounded-lg px-2 py-1 w-64 block"
              />
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-apptivia-ink">{sequence.name}</h2>
              {sequence.description && <p className="text-xs text-apptivia-carbon-500 mt-0.5">{sequence.description}</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); load(); }} className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 px-2 py-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral disabled:opacity-50">
                <Save size={12} />{saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-apptivia-carbon-600 border border-gray-200 rounded-lg hover:bg-apptivia-paper">
                <Edit2 size={12} />Edit
              </button>
              <button onClick={handleStatusToggle} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                sequence.status === 'active'
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}>
                {sequence.status === 'active' ? <><Pause size={12} />Pause</> : <><Play size={12} />Activate</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-6 px-3 py-2 bg-apptivia-paper rounded-lg text-[11px] text-apptivia-carbon-500">
        <span><Users size={11} className="inline mr-1" />{stats.total || 0} enrolled</span>
        <span className="text-green-600">{stats.active || 0} active</span>
        <span className="text-apptivia-coral">{stats.completed || 0} completed</span>
        <span className="text-emerald-600">{stats.replied || 0} replied</span>
        <span className="text-yellow-600">{stats.paused || 0} paused</span>
      </div>

      {/* Steps */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-apptivia-carbon-600 uppercase tracking-wider">Steps</h3>
          <button onClick={addStep} className="flex items-center gap-1 text-xs text-apptivia-coral hover:text-apptivia-coral">
            <Plus size={12} />Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <div className="text-center py-8 text-apptivia-carbon-400 text-xs border border-dashed border-gray-200 rounded-xl">
            No steps yet. Add your first step to build the sequence.
          </div>
        ) : (
          <div className="ml-2">
            {steps.map((step, i) => (
              <StepEditor
                key={i}
                step={step}
                index={i}
                onChange={(updated) => updateStep(i, updated)}
                onRemove={() => removeStep(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Enroll prospect */}
      {sequence.status === 'active' && (
        <div className="border border-gray-100 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-apptivia-carbon-600 uppercase tracking-wider mb-2">Enroll Prospect</h3>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="prospect@company.com"
              value={enrollEmail}
              onChange={(e) => setEnrollEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnroll()}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-300"
            />
            <button
              onClick={handleEnroll}
              disabled={enrolling || !enrollEmail}
              className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral disabled:opacity-50"
            >
              <ArrowRight size={12} />{enrolling ? 'Enrolling...' : 'Enroll'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SequenceBuilder({ organizationId, userId }) {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const loadSequences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backendFetch('/api/engage/sequences');
      const data = await res.json();
      setSequences(data.data || []);
    } catch (err) {
      console.error('Failed to load sequences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await backendFetch('/api/engage/sequences', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), status: 'draft', steps: [] }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Sequence created');
        setNewName('');
        setCreating(false);
        setSelectedId(data.id);
        loadSequences();
      } else {
        toast.error(data.error || 'Failed to create');
      }
    } catch (err) {
      toast.error('Failed to create sequence');
    }
  };

  if (selectedId) {
    return (
      <SequenceDetail
        sequenceId={selectedId}
        onBack={() => { setSelectedId(null); loadSequences(); }}
        organizationId={organizationId}
      />
    );
  }

  return (
    <div>
      {creating ? (
        <div className="mb-4 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Sequence name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-blue-300"
          />
          <button onClick={handleCreate} className="px-3 py-2 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral">Create</button>
          <button onClick={() => setCreating(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
        </div>
      ) : null}

      <SequenceList
        sequences={sequences}
        onSelect={setSelectedId}
        onNew={() => setCreating(true)}
        loading={loading}
      />
    </div>
  );
}
