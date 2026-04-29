import React, { useState, useEffect, useCallback } from 'react';
import { Phone, Plus, X, Loader2, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap, Target, Users, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SentimentBadge({ sentiment }) {
  const map = {
    positive: { label: 'Positive', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
    neutral:  { label: 'Neutral',  color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600',       icon: Minus },
    negative: { label: 'Negative', color: 'bg-red-100 text-red-600',         icon: TrendingDown },
  };
  const cfg = map[sentiment] || map.neutral;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function SignalBadge({ signal }) {
  const map = {
    advancing: { label: 'Advancing', color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
    stalled:   { label: 'Stalled',   color: 'bg-amber-100 text-amber-700' },
    at_risk:   { label: 'At Risk',   color: 'bg-red-100 text-red-700' },
    unclear:   { label: 'Unclear',   color: 'bg-apptivia-carbon-100 text-apptivia-carbon-500' },
  };
  const cfg = map[signal] || map.unclear;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── Log Call Modal ────────────────────────────────────────────────────────────

function LogCallModal({ organizationId, userId, deals, onClose, onSaved }) {
  const [form, setForm] = useState({
    contact_name: '',
    deal_id: '',
    call_date: new Date().toISOString().slice(0, 16),
    duration_minutes: '',
    call_direction: 'outbound',
    notes: '',
  });
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const selectedDeal = deals.find(d => d.id === form.deal_id);

  const handleAnalyze = async () => {
    if (form.notes.trim().length < 20) {
      setAnalysisError('Please enter at least 20 characters of call notes.');
      return;
    }
    setAnalysisError(null);
    setAnalyzing(true);
    try {
      const data = await backendFetch('/api/engage/calls/analyze', {
        notes: form.notes,
        contact_name: form.contact_name || undefined,
        deal_name: selectedDeal?.deal_name || undefined,
      });
      setAnalysis(data.analysis);
    } catch (err) {
      setAnalysisError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!form.notes.trim()) {
      setError('Call notes are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const record = {
        organization_id: organizationId,
        user_id: userId,
        deal_id: form.deal_id || null,
        contact_name: form.contact_name || null,
        call_date: form.call_date ? new Date(form.call_date).toISOString() : new Date().toISOString(),
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
        call_direction: form.call_direction,
        notes: form.notes.trim(),
        ai_analysis: analysis || null,
      };
      const { error: dbErr } = await supabase.from('engage_call_logs').insert(record);
      if (dbErr) throw new Error(dbErr.message);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Phone size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-apptivia-ink">Log a Call</h2>
              <p className="text-xs text-apptivia-carbon-500">AI will extract next steps, objections & insights</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-apptivia-carbon-100 rounded-lg transition-colors">
            <X size={18} className="text-apptivia-carbon-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Row 1: Contact + Deal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Contact Name</label>
              <input
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="Jane Smith"
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Linked Deal (optional)</label>
              <select
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                value={form.deal_id}
                onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}
              >
                <option value="">— No deal —</option>
                {deals.map(d => (
                  <option key={d.id} value={d.id}>{d.deal_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date + Duration + Direction */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Call Date & Time</label>
              <input
                type="datetime-local"
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                value={form.call_date}
                onChange={e => setForm(f => ({ ...f, call_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Duration (mins)</label>
              <input
                type="number"
                min="1"
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="30"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Direction</label>
              <select
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                value={form.call_direction}
                onChange={e => setForm(f => ({ ...f, call_direction: e.target.value }))}
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">
              Call Notes / Transcript <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              rows={6}
              placeholder="Paste call notes, key talking points, or a transcript excerpt…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
            {analysisError && <p className="text-xs text-red-500 mt-1">{analysisError}</p>}
          </div>

          {/* Analyze button */}
          {!analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || form.notes.trim().length < 20}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {analyzing ? 'Analyzing…' : 'Analyze with AI'}
            </button>
          )}

          {/* AI Analysis Results */}
          {analysis && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-apptivia-carbon-300 rounded-lg p-4 space-y-4">
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-apptivia-ink mr-1">AI Analysis</span>
                <SentimentBadge sentiment={analysis.sentiment} />
                <SignalBadge signal={analysis.deal_stage_signal} />
                <button
                  onClick={() => setAnalysis(null)}
                  className="ml-auto text-xs text-apptivia-carbon-400 hover:text-apptivia-carbon-600 flex items-center gap-1"
                >
                  <X size={12} /> Re-analyze
                </button>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <p className="text-sm text-apptivia-carbon-700 leading-relaxed">{analysis.summary}</p>
              )}

              {/* Next Steps */}
              {analysis.next_steps?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target size={13} className="text-apptivia-coral" />
                    <span className="text-xs font-semibold text-apptivia-carbon-700">Next Steps</span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.next_steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-apptivia-carbon-700">
                        <span className="w-4 h-4 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Objections */}
              {analysis.objections?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-apptivia-carbon-700">Objections</span>
                  </div>
                  <ul className="space-y-1">
                    {analysis.objections.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-apptivia-carbon-700">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Competitor mentions */}
              {analysis.competitor_mentions?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users size={13} className="text-red-500" />
                    <span className="text-xs font-semibold text-apptivia-carbon-700">Competitors Mentioned</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.competitor_mentions.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-apptivia-carbon-100 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-apptivia-carbon-600 hover:text-apptivia-ink transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.notes.trim()}
            className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Call Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Call Log Card ─────────────────────────────────────────────────────────────

function CallLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const a = log.ai_analysis;

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-apptivia-carbon-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone size={15} className="text-apptivia-ink" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-apptivia-ink truncate">
                  {log.contact_name || 'Unknown Contact'}
                </span>
                {a?.sentiment && <SentimentBadge sentiment={a.sentiment} />}
                {a?.deal_stage_signal && <SignalBadge signal={a.deal_stage_signal} />}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-apptivia-carbon-500">
                <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(log.call_date)}</span>
                {log.duration_minutes && <span>{log.duration_minutes} min</span>}
                <span className="capitalize">{log.call_direction}</span>
                {log.engage_pipeline_deals?.deal_name && (
                  <span className="text-apptivia-coral">{log.engage_pipeline_deals.deal_name}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 hover:bg-apptivia-carbon-100 rounded-lg transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp size={16} className="text-apptivia-carbon-400" /> : <ChevronDown size={16} className="text-apptivia-carbon-400" />}
          </button>
        </div>

        {/* Summary preview */}
        {!expanded && a?.summary && (
          <p className="mt-2 text-xs text-apptivia-carbon-600 line-clamp-2 pl-12">{a.summary}</p>
        )}
      </div>

      {expanded && (
        <div className="border-t border-apptivia-carbon-100 px-5 pb-4 pt-3 space-y-3">
          {/* Summary */}
          {a?.summary && (
            <p className="text-sm text-apptivia-carbon-700 leading-relaxed">{a.summary}</p>
          )}

          {/* Next steps */}
          {a?.next_steps?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target size={12} className="text-apptivia-coral" />
                <span className="text-xs font-semibold text-apptivia-carbon-700">Next Steps</span>
              </div>
              <ul className="space-y-1">
                {a.next_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-apptivia-carbon-700">
                    <span className="w-4 h-4 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Objections */}
          {a?.objections?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-xs font-semibold text-apptivia-carbon-700">Objections</span>
              </div>
              <ul className="space-y-1">
                {a.objections.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-apptivia-carbon-600">
                    <span className="text-amber-400 mt-0.5">•</span>{o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Competitor mentions */}
          {a?.competitor_mentions?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users size={12} className="text-red-500" />
                <span className="text-xs font-semibold text-apptivia-carbon-700">Competitors</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.competitor_mentions.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Raw notes (collapsed further) */}
          <details className="group">
            <summary className="text-xs text-apptivia-carbon-400 cursor-pointer hover:text-apptivia-carbon-600 list-none flex items-center gap-1">
              <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
              View raw notes
            </summary>
            <pre className="mt-2 text-xs text-apptivia-carbon-600 bg-apptivia-paper rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed">{log.notes}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CallIntelligence({ organizationId, userId }) {
  const [logs, setLogs] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [logsRes, dealsRes] = await Promise.all([
        supabase
          .from('engage_call_logs')
          .select('*, engage_pipeline_deals(deal_name)')
          .eq('organization_id', organizationId)
          .order('call_date', { ascending: false })
          .limit(50),
        supabase
          .from('engage_pipeline_deals')
          .select('id, deal_name, stage')
          .eq('organization_id', organizationId)
          .neq('stage', 'closed_lost')
          .order('deal_name'),
      ]);
      setLogs(logsRes.data || []);
      setDeals(dealsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Stats
  const totalCalls = logs.length;
  const positiveCalls = logs.filter(l => l.ai_analysis?.sentiment === 'positive').length;
  const competitorCalls = logs.filter(l => l.ai_analysis?.competitor_mentions?.length > 0).length;
  const atRiskCalls = logs.filter(l => l.ai_analysis?.deal_stage_signal === 'at_risk').length;

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: totalCalls, color: 'text-apptivia-ink' },
          { label: 'Positive Sentiment', value: positiveCalls, color: 'text-emerald-600' },
          { label: 'Competitor Mentions', value: competitorCalls, color: 'text-amber-600' },
          { label: 'At Risk Deals', value: atRiskCalls, color: 'text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border border-apptivia-carbon-100 px-4 py-3 text-center shadow-sm">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-apptivia-carbon-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Header + Log Call button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-apptivia-carbon-700">
          {totalCalls > 0 ? `${totalCalls} call${totalCalls !== 1 ? 's' : ''} logged` : 'No calls logged yet'}
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={14} />
          Log a Call
        </button>
      </div>

      {/* Call list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-apptivia-carbon-400">
          <Loader2 size={24} className="animate-spin mr-2" />
          <span className="text-sm">Loading calls…</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-apptivia-carbon-400">
          <Phone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No calls logged yet</p>
          <p className="text-xs mt-1">Log your first call to unlock AI-powered conversation intelligence.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Log Your First Call
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => <CallLogCard key={log.id} log={log} />)}
        </div>
      )}

      {showModal && (
        <LogCallModal
          organizationId={organizationId}
          userId={userId}
          deals={deals}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
