import React, { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Play, Pause, Trash2, Edit3, Copy, Sparkles, RefreshCw,
  CheckCircle, XCircle, Clock, Target, Users, BarChart3, Settings,
  X, ChevronRight, ChevronDown, ChevronUp, ArrowRight, AlertTriangle,
  Zap, FileText, LayoutTemplate, Layers, Tag, TrendingUp
} from 'lucide-react';
import { usePlaybooks } from '../hooks/usePlaybooks';

// ── Constants ────────────────────────────────────────────────

const TRIGGER_STYLES = {
  new_lead: { label: 'New Lead', icon: Users, color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
  signal_detected: { label: 'Signal Detected', icon: Zap, color: 'bg-amber-50 text-amber-600' },
  deal_stage_change: { label: 'Deal Stage Change', icon: ArrowRight, color: 'bg-apptivia-carbon-100 text-apptivia-ink' },
  score_threshold: { label: 'Score Threshold', icon: BarChart3, color: 'bg-emerald-50 text-emerald-600' },
  manual: { label: 'Manual', icon: Play, color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' },
  time_based: { label: 'Time-Based', icon: Clock, color: 'bg-cyan-50 text-cyan-600' },
  account_tier_change: { label: 'Tier Change', icon: Target, color: 'bg-orange-50 text-orange-600' },
};

const STATUS_STYLES = {
  draft: { bg: 'bg-apptivia-carbon-100', text: 'text-apptivia-carbon-600', label: 'Draft' },
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
  paused: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Paused' },
  archived: { bg: 'bg-apptivia-carbon-100', text: 'text-apptivia-carbon-400', label: 'Archived' },
};

const EXEC_STATUS = {
  running: { bg: 'bg-apptivia-coral-tone-50', text: 'text-apptivia-coral', label: 'Running' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
  failed: { bg: 'bg-red-50', text: 'text-red-600', label: 'Failed' },
  abandoned: { bg: 'bg-apptivia-paper', text: 'text-apptivia-carbon-500', label: 'Abandoned' },
};

// ── Playbook Templates ───────────────────────────────────────

const PLAYBOOK_TEMPLATES = [
  {
    id: 'inbound-lead',
    name: 'Inbound Lead Response',
    description: 'Speed-to-lead playbook for inbound MQL/SQL',
    trigger_type: 'new_lead',
    playbook_type: 'signal',
    icon: Zap,
    color: 'from-blue-500 to-cyan-500',
    steps: [
      { step_number: 1, action_type: 'research', description: 'Research the lead (company, role, firmographics)' },
      { step_number: 2, action_type: 'email', description: 'Send personalized intro email within 5 minutes' },
      { step_number: 3, action_type: 'call', description: 'Follow-up call within 30 minutes of form fill' },
      { step_number: 4, action_type: 'linkedin', description: 'Connect on LinkedIn with custom note' },
      { step_number: 5, action_type: 'meeting', description: 'Book discovery call or demo' },
    ],
  },
  {
    id: 'deal-at-risk',
    name: 'Deal At-Risk Recovery',
    description: 'Multi-touch rescue plan for stalling deals',
    trigger_type: 'deal_stage_change',
    playbook_type: 'pipeline',
    icon: AlertTriangle,
    color: 'from-red-500 to-rose-500',
    steps: [
      { step_number: 1, action_type: 'research', description: 'Audit deal health: objections, timeline, champion status' },
      { step_number: 2, action_type: 'call', description: 'Direct call to champion — pulse check' },
      { step_number: 3, action_type: 'email', description: 'Send ROI/business case recap' },
      { step_number: 4, action_type: 'meeting', description: 'Schedule executive alignment call' },
      { step_number: 5, action_type: 'task', description: 'Create custom proposal with concessions/timeline' },
    ],
  },
  {
    id: 'expansion',
    name: 'Customer Expansion',
    description: 'Upsell / cross-sell playbook for existing accounts',
    trigger_type: 'score_threshold',
    playbook_type: 'account',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    steps: [
      { step_number: 1, action_type: 'research', description: 'Analyze account usage patterns and growth indicators' },
      { step_number: 2, action_type: 'email', description: 'Share relevant case study or new feature announcement' },
      { step_number: 3, action_type: 'call', description: 'Schedule account review / QBR' },
      { step_number: 4, action_type: 'meeting', description: 'Present expansion proposal with ROI projections' },
      { step_number: 5, action_type: 'task', description: 'Generate custom pricing and send contract' },
    ],
  },
  {
    id: 'competitive-displacement',
    name: 'Competitive Displacement',
    description: 'Win prospects away from a competitor',
    trigger_type: 'signal_detected',
    playbook_type: 'signal',
    icon: Target,
    color: 'from-purple-500 to-indigo-500',
    steps: [
      { step_number: 1, action_type: 'research', description: 'Identify competitor weaknesses and contract timing' },
      { step_number: 2, action_type: 'email', description: 'Send value differentiation email (no badmouthing)' },
      { step_number: 3, action_type: 'call', description: 'Discovery call focused on pain points' },
      { step_number: 4, action_type: 'meeting', description: 'Competitive demo / proof-of-concept' },
      { step_number: 5, action_type: 'task', description: 'Build migration plan + TCO comparison' },
    ],
  },
  {
    id: 'enterprise-abm',
    name: 'Enterprise ABM Campaign',
    description: 'Multi-stakeholder approach for strategic accounts',
    trigger_type: 'account_tier_change',
    playbook_type: 'account',
    icon: Users,
    color: 'from-amber-500 to-orange-500',
    steps: [
      { step_number: 1, action_type: 'research', description: 'Map buying committee and organizational priorities' },
      { step_number: 2, action_type: 'linkedin', description: 'Engage 3+ stakeholders via LinkedIn' },
      { step_number: 3, action_type: 'email', description: 'Send personalized content to each persona' },
      { step_number: 4, action_type: 'meeting', description: 'Host executive workshop or value assessment' },
      { step_number: 5, action_type: 'task', description: 'Create mutual success plan with champion' },
      { step_number: 6, action_type: 'email', description: 'Send business case to economic buyer' },
    ],
  },
];

// ── Summary Cards ────────────────────────────────────────────

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Playbooks', value: summary.totalPlaybooks, icon: BookOpen, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
    { label: 'Active', value: summary.activePlaybooks, icon: Play, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total Runs', value: summary.totalExecutions, icon: Layers, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
    { label: 'Success Rate', value: `${summary.avgSuccessRate || 0}%`, icon: CheckCircle, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-apptivia-carbon-100 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-apptivia-carbon-500">{c.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color}`}>
              <c.icon size={16} />
            </div>
          </div>
          <div className="text-lg font-bold text-apptivia-ink">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Playbook Card ────────────────────────────────────────────

function PlaybookCard({ playbook, onSelect, onToggleStatus, onDelete }) {
  const status = STATUS_STYLES[playbook.status] || STATUS_STYLES.draft;
  const trigger = TRIGGER_STYLES[playbook.trigger_type] || TRIGGER_STYLES.manual;

  return (
    <div
      className="bg-white rounded-xl border border-apptivia-carbon-100 p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onSelect(playbook)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-apptivia-ink truncate group-hover:text-apptivia-ink transition-colors">{playbook.name}</h3>
            {playbook.description && <p className="text-xs text-apptivia-carbon-500 mt-0.5 line-clamp-1">{playbook.description}</p>}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text} shrink-0 ml-2`}>{status.label}</span>
      </div>

      {/* Trigger */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium">Trigger:</span>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${trigger.color}`}>
          <trigger.icon size={10} /> {trigger.label}
        </span>
      </div>

      {/* Steps preview */}
      {playbook.steps?.length > 0 && (
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {playbook.steps.slice(0, 4).map((step, i) => (
            <span key={i} className="px-2 py-0.5 bg-apptivia-paper rounded text-[10px] text-apptivia-carbon-600 font-medium">
              {i + 1}. {step.action?.substring(0, 20) || 'Step'}
            </span>
          ))}
          {playbook.steps.length > 4 && (
            <span className="text-[10px] text-apptivia-carbon-400">+{playbook.steps.length - 4} more</span>
          )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-apptivia-carbon-100">
        <span className="text-[10px] text-apptivia-carbon-400">
          <strong className="text-apptivia-carbon-600">{playbook.steps?.length || 0}</strong> steps
        </span>
        {playbook.ai_generated && (
          <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
            <Sparkles size={8} /> AI Generated
          </span>
        )}
        {playbook.tags?.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag size={8} className="text-apptivia-carbon-300" />
            {playbook.tags.slice(0, 2).map((t) => (
              <span key={t} className="text-[10px] text-apptivia-carbon-400">{t}</span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {playbook.status !== 'archived' && (
            <button
              onClick={() => onToggleStatus(playbook)}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-colors ${
                playbook.status === 'active'
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {playbook.status === 'active' ? 'Pause' : 'Activate'}
            </button>
          )}
          <button onClick={() => onDelete(playbook.id)} className="text-apptivia-carbon-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Playbook Detail ──────────────────────────────────────────

function PlaybookDetail({ playbook, executions, onBack, onUpdate, onStartExecution, onCompleteExecution, onAbandonExecution }) {
  const status = STATUS_STYLES[playbook.status] || STATUS_STYLES.draft;
  const trigger = TRIGGER_STYLES[playbook.trigger_type] || TRIGGER_STYLES.manual;
  const [expandedStep, setExpandedStep] = useState(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-apptivia-carbon-100 p-5">
        <button onClick={onBack} className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 flex items-center gap-1 mb-3">
          <ChevronRight size={12} className="rotate-180" /> Back to Playbooks
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-apptivia-ink">{playbook.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text}`}>{status.label}</span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${trigger.color}`}>
                  <trigger.icon size={10} /> {trigger.label}
                </span>
                {playbook.ai_generated && (
                  <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                    <Sparkles size={8} /> AI Generated
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdate(playbook.id, { status: playbook.status === 'active' ? 'paused' : 'active' })}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                playbook.status === 'active'
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}>
              {playbook.status === 'active' ? 'Pause' : 'Activate'}
            </button>
            <button onClick={() => onStartExecution(playbook.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-pink-600 shadow-sm">
              <Play size={12} /> Run Playbook
            </button>
          </div>
        </div>
        {playbook.description && <p className="text-xs text-apptivia-carbon-500 mt-3">{playbook.description}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Steps */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-apptivia-ink">Playbook Steps ({playbook.steps?.length || 0})</h3>
          {(!playbook.steps || playbook.steps.length === 0) ? (
            <div className="bg-apptivia-paper rounded-xl p-8 text-center">
              <Layers size={24} className="mx-auto mb-2 text-apptivia-carbon-300" />
              <p className="text-xs text-apptivia-carbon-400">No steps defined in this playbook.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {playbook.steps.map((step, i) => (
                <div key={i} className="bg-white rounded-xl border border-apptivia-carbon-100 overflow-hidden hover:shadow-sm transition-shadow">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer"
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-apptivia-ink">{step.action || `Step ${i + 1}`}</span>
                      {step.condition && <span className="text-[10px] text-apptivia-carbon-400 block">If: {step.condition}</span>}
                    </div>
                    {step.tool && (
                      <span className="px-2 py-0.5 bg-apptivia-coral-tone-50 text-apptivia-coral text-[10px] font-medium rounded-full">{step.tool}</span>
                    )}
                    {expandedStep === i ? <ChevronUp size={14} className="text-apptivia-carbon-400" /> : <ChevronDown size={14} className="text-apptivia-carbon-400" />}
                  </div>
                  {expandedStep === i && (
                    <div className="px-4 pb-4 pt-0 space-y-2 border-t border-apptivia-carbon-100">
                      {step.description && (
                        <div className="mt-3">
                          <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-0.5">Description</span>
                          <p className="text-xs text-apptivia-carbon-700">{step.description}</p>
                        </div>
                      )}
                      {step.expected_output && (
                        <div>
                          <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-0.5">Expected Output</span>
                          <p className="text-xs text-apptivia-carbon-600">{step.expected_output}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-apptivia-carbon-400">
                        {step.tool && <span>Tool: <strong className="text-apptivia-carbon-600">{step.tool}</strong></span>}
                        {step.timeout_minutes && <span>Timeout: <strong className="text-apptivia-carbon-600">{step.timeout_minutes}m</strong></span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Executions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-apptivia-ink">Execution History ({executions.length})</h3>
          <div className="space-y-2">
            {executions.length === 0 ? (
              <div className="bg-white rounded-xl border border-apptivia-carbon-100 p-6 text-center">
                <Clock size={20} className="mx-auto mb-2 text-apptivia-carbon-300" />
                <p className="text-xs text-apptivia-carbon-400">No executions yet</p>
              </div>
            ) : (
              executions.slice(0, 10).map((exec) => {
                const st = EXEC_STATUS[exec.status] || EXEC_STATUS.running;
                return (
                  <div key={exec.id} className="bg-white rounded-xl border border-apptivia-carbon-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.bg} ${st.text}`}>{st.label}</span>
                      <span className="text-[10px] text-apptivia-carbon-400">
                        {new Date(exec.started_at).toLocaleDateString()}
                      </span>
                    </div>
                    {exec.context?.target && <span className="text-xs text-apptivia-carbon-600 block mb-1">Target: {exec.context.target}</span>}
                    <div className="flex items-center gap-2 text-[10px] text-apptivia-carbon-400">
                      <span>Step {exec.current_step}/{playbook.steps?.length || '?'}</span>
                      {exec.completed_at && (
                        <span>Completed: {new Date(exec.completed_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                    {exec.status === 'running' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => onCompleteExecution(exec.id, { success: true })}
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded-lg hover:bg-emerald-100">
                          <CheckCircle size={10} /> Complete
                        </button>
                        <button onClick={() => onAbandonExecution(exec.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 text-[10px] font-medium rounded-lg hover:bg-red-100">
                          <XCircle size={10} /> Abandon
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Generate Playbook Modal ──────────────────────────────────

function GeneratePlaybookModal({ isOpen, onClose, onGenerate, generating }) {
  const [scenario, setScenario] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scenario.trim()) return;
    setError('');
    try {
      await onGenerate({ scenario, target_role: targetRole, industry });
      setScenario('');
      setTargetRole('');
      setIndustry('');
    } catch (err) {
      setError(err.message || 'Failed to generate playbook');
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-apptivia-ink mb-1">AI Playbook Generator</h2>
        <p className="text-xs text-apptivia-carbon-500 mb-5">Describe your scenario and AI will generate a complete sales playbook</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Scenario / Goal *</label>
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="e.g., Re-engage churned enterprise customers from last quarter who were using our premium tier..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Target Role</label>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., VP Sales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Industry</label>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., SaaS"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-apptivia-carbon-700 bg-apptivia-carbon-100 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!scenario.trim() || generating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-apptivia-coral rounded-md hover:bg-apptivia-coral disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? 'Generating...' : 'Generate Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New Playbook Modal ───────────────────────────────────────

function NewPlaybookModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), description: description.trim(), trigger_type: triggerType, steps: [] });
      setName('');
      setDescription('');
      setTriggerType('manual');
      setError('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create playbook');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-apptivia-ink mb-5">New Playbook</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Playbook Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Enterprise Win-Back Playbook"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="When and how to use this playbook..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Trigger Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TRIGGER_STYLES).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTriggerType(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    triggerType === key
                      ? `${cfg.color} ring-1 ring-current`
                      : 'bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'
                  }`}
                >
                  <cfg.icon size={12} /> {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-apptivia-carbon-700 bg-apptivia-carbon-100 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-apptivia-coral rounded-md hover:bg-apptivia-coral disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating...' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Playbook Template Card ───────────────────────────────────

function PlaybookTemplateCard({ template, onUse, loading }) {
  return (
    <div className="bg-white rounded-xl border border-apptivia-carbon-100 p-4 hover:shadow-md transition-all group">
      <div className={`w-9 h-9 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center mb-3 shadow-sm`}>
        <template.icon size={16} className="text-white" />
      </div>
      <h4 className="text-xs font-semibold text-apptivia-ink mb-0.5">{template.name}</h4>
      <p className="text-[10px] text-apptivia-carbon-500 mb-3 line-clamp-2">{template.description}</p>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-apptivia-carbon-400">{template.steps.length} steps</span>
        <span className="text-[10px] text-apptivia-carbon-300">•</span>
        <span className="text-[10px] text-apptivia-carbon-400 capitalize">{template.trigger_type.replace(/_/g, ' ')}</span>
      </div>
      <button
        onClick={onUse}
        disabled={loading}
        className="w-full text-[11px] font-medium px-3 py-1.5 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg hover:bg-apptivia-carbon-100 hover:text-apptivia-ink transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Use Template'}
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function PlaybookBuilder({ organizationId, userId }) {
  const {
    playbooks, executions: allExecutions, summary, loading, generating, error,
    fetchPlaybooks, fetchExecutions, createPlaybook, updatePlaybook,
    deletePlaybook, generatePlaybook, startExecution, completeExecution,
    abandonExecution,
  } = usePlaybooks(organizationId, userId);

  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [selectedPlaybook, setSelectedPlaybook] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);

  const playbookExecutions = useMemo(() => {
    if (!selectedPlaybook) return [];
    return allExecutions.filter((e) => e.playbook_id === selectedPlaybook.id);
  }, [allExecutions, selectedPlaybook]);

  const handleSelectPlaybook = (playbook) => {
    setSelectedPlaybook(playbook);
    fetchExecutions(playbook.id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedPlaybook(null);
    fetchPlaybooks();
  };

  const handleGenerate = async (params) => {
    const result = await generatePlaybook(params);
    if (result) {
      setShowGenerateModal(false);
      handleSelectPlaybook(result);
    }
  };

  const handleCreateFromTemplate = async (template) => {
    setCreatingFromTemplate(template.id);
    try {
      const pb = await createPlaybook({
        name: template.name,
        description: template.description,
        playbook_type: template.playbook_type,
        trigger_type: template.trigger_type,
        trigger_config: { type: template.trigger_type },
        steps: template.steps,
        tags: ['template'],
      });
      if (pb) handleSelectPlaybook(pb);
    } catch {
      // Error handled by hook
    }
    setCreatingFromTemplate(null);
  };

  if (loading && playbooks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="animate-spin text-apptivia-ink mr-2" />
        <span className="text-sm text-apptivia-carbon-500">Loading playbooks...</span>
      </div>
    );
  }

  // ── Detail View ──────────────────────────────────

  if (view === 'detail' && selectedPlaybook) {
    return (
      <PlaybookDetail
        playbook={selectedPlaybook}
        executions={playbookExecutions}
        onBack={handleBack}
        onUpdate={updatePlaybook}
        onStartExecution={startExecution}
        onCompleteExecution={completeExecution}
        onAbandonExecution={abandonExecution}
      />
    );
  }

  // ── List View ────────────────────────────────────

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-center gap-2">
          <XCircle size={14} /> {error}
        </div>
      )}

      {/* Playbook Templates */}
      <div>
        <h3 className="text-sm font-semibold text-apptivia-ink mb-2">Playbook Templates</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PLAYBOOK_TEMPLATES.map((tmpl) => (
            <PlaybookTemplateCard
              key={tmpl.id}
              template={tmpl}
              onUse={() => handleCreateFromTemplate(tmpl)}
              loading={creatingFromTemplate === tmpl.id}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-apptivia-ink">Playbooks</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-medium rounded-lg hover:shadow-md transition-all">
            <Sparkles size={14} /> AI Generate
          </button>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-lg hover:shadow-md transition-all">
            <Plus size={14} /> New Playbook
          </button>
        </div>
      </div>

      {/* Grid */}
      {playbooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-apptivia-carbon-100 p-12 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={24} className="text-apptivia-ink" />
          </div>
          <h3 className="text-base font-semibold text-apptivia-ink mb-1">No Playbooks Yet</h3>
          <p className="text-xs text-apptivia-carbon-500 max-w-sm mx-auto mb-4">
            Create structured sales playbooks for repeatable processes, or let AI generate them from a scenario description.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowNewModal(true)}
              className="px-5 py-2.5 bg-apptivia-ink text-white text-sm font-medium rounded-lg hover:bg-apptivia-ink">
              Create Manually
            </button>
            <button onClick={() => setShowGenerateModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium rounded-lg hover:from-orange-600 hover:to-amber-600 flex items-center gap-2">
              <Sparkles size={14} /> Generate with AI
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {playbooks.map((pb) => (
            <PlaybookCard
              key={pb.id}
              playbook={pb}
              onSelect={handleSelectPlaybook}
              onToggleStatus={(p) => updatePlaybook(p.id, { status: p.status === 'active' ? 'paused' : 'active' })}
              onDelete={deletePlaybook}
            />
          ))}
        </div>
      )}

      <NewPlaybookModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} onCreate={createPlaybook} />
      <GeneratePlaybookModal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} onGenerate={handleGenerate} generating={generating} />
    </div>
  );
}
