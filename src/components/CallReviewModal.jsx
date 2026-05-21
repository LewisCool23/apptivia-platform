import React, { useState, useEffect, useRef } from 'react';
import {
  X, Phone, Clock, Users, MessageSquare, TrendingUp, AlertTriangle,
  CheckCircle, Play, Pause, Mic, Volume2, BarChart3, Loader2,
  ArrowUp, ArrowDown, Minus, ChevronRight, Target, Zap,
} from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import { supabase } from '../supabaseClient';
import { useModalBehavior } from '../hooks/useModalBehavior';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function formatTimestamp(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatDuration(minutes) {
  if (!minutes) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Sentiment Badge ─────────────────────────────────────────────────────── */

function SentimentBadge({ sentiment }) {
  const map = {
    positive: { bg: 'bg-emerald-100 text-emerald-700', label: 'Positive' },
    negative: { bg: 'bg-red-100 text-red-700', label: 'Negative' },
    neutral:  { bg: 'bg-apptivia-carbon-100 text-apptivia-carbon-600', label: 'Neutral' },
  };
  const s = map[sentiment] || map.neutral;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg}`}>
      {s.label}
    </span>
  );
}

/* ── Deal Stage Badge ────────────────────────────────────────────────────── */

function DealStageBadge({ stage }) {
  const map = {
    advancing: { bg: 'bg-emerald-100 text-emerald-700', icon: ArrowUp },
    stalled:   { bg: 'bg-amber-100 text-amber-700', icon: Minus },
    at_risk:   { bg: 'bg-red-100 text-red-700', icon: ArrowDown },
    unclear:   { bg: 'bg-apptivia-carbon-100 text-apptivia-carbon-600', icon: Minus },
  };
  const s = map[stage] || map.unclear;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg}`}>
      <Icon size={12} /> {stage?.replace('_', ' ') || 'Unknown'}
    </span>
  );
}

/* ── Key Moment Type Icon ────────────────────────────────────────────────── */

function MomentIcon({ type }) {
  const map = {
    objection:         { icon: AlertTriangle, cls: 'text-red-500' },
    buying_signal:     { icon: TrendingUp, cls: 'text-emerald-500' },
    competitor_mention: { icon: Target, cls: 'text-amber-500' },
    question:          { icon: MessageSquare, cls: 'text-blue-500' },
    commitment:        { icon: CheckCircle, cls: 'text-emerald-500' },
    action_item:       { icon: Zap, cls: 'text-apptivia-coral' },
  };
  const m = map[type] || { icon: ChevronRight, cls: 'text-apptivia-carbon-400' };
  const Icon = m.icon;
  return <Icon size={14} className={m.cls} />;
}

/* ── Donut Chart (pure CSS) ──────────────────────────────────────────────── */

function TalkRatioDonut({ repPct, prospectPct }) {
  const rep = Math.round(repPct || 0);
  const prospect = Math.round(prospectPct || 0);
  const repDeg = (rep / 100) * 360;

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-20 h-20 rounded-full relative"
        style={{
          background: `conic-gradient(
            #0A0A0B 0deg ${repDeg}deg,
            #FF4D2E ${repDeg}deg 360deg
          )`,
        }}
      >
        <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
          <span className="text-[10px] font-bold text-apptivia-ink">{rep}%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-apptivia-ink" />
          <span className="text-xs text-apptivia-carbon-600">Rep: {rep}%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-apptivia-coral" />
          <span className="text-xs text-apptivia-carbon-600">Prospect: {prospect}%</span>
        </div>
      </div>
    </div>
  );
}

/* ── Methodology Score Bar ───────────────────────────────────────────────── */

function MethodologyBar({ score, framework }) {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-apptivia-ink">{framework || 'Framework'}</span>
        <span className="text-xs font-bold text-apptivia-ink">{pct}/100</span>
      </div>
      <div className="w-full h-2 bg-apptivia-carbon-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="flex-1 min-w-[90px] bg-apptivia-paper border border-apptivia-carbon-100 rounded-lg px-3 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {Icon && <Icon size={12} className="text-apptivia-carbon-400" />}
        <span className="text-[10px] text-apptivia-carbon-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-base font-bold text-apptivia-ink">{value ?? '--'}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CallReviewModal — Main Component
   ══════════════════════════════════════════════════════════════════════════ */

export default function CallReviewModal({ isOpen, onClose, callId, organizationId }) {
  useModalBehavior(isOpen, onClose);
  const [recording, setRecording] = useState(null);
  const [callLog, setCallLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  /* ── Data fetching ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!isOpen || !callId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecording(null);
    setCallLog(null);

    async function fetchData() {
      try {
        // Fetch recording + intelligence from backend
        const recPromise = backendFetch(`/api/engage/calls/${callId}/recording`, undefined, 'GET');

        // Fetch call log basics from Supabase
        const logPromise = supabase
          .from('engage_call_logs')
          .select('contact_name, call_date, duration_minutes, call_direction, notes')
          .eq('id', callId)
          .maybeSingle();

        const [recResult, logResult] = await Promise.all([recPromise, logPromise]);

        if (cancelled) return;

        setRecording(recResult || null);
        if (logResult?.data) {
          setCallLog(logResult.data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('CallReviewModal fetch error:', err);
          setError(err?.message || 'Failed to load call recording data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [isOpen, callId]);

  /* ── Keyboard shortcut: Escape ─────────────────────────────────────────── */

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  /* ── Early returns ─────────────────────────────────────────────────────── */

  if (!isOpen) return null;

  /* ── Derived data ──────────────────────────────────────────────────────── */

  const segments = recording?.transcript_segments || [];
  const intelligence = recording?.intelligence || {};
  const {
    talk_ratio,
    questions_asked,
    filler_words,
    longest_monologue,
    methodology_adherence,
    deal_stage_signal,
    key_moments,
    coaching_suggestions,
    summary,
    next_steps,
    objections,
    sentiment,
  } = intelligence;

  const contactName = callLog?.contact_name || recording?.contact_name || 'Unknown Contact';
  const callDate = callLog?.call_date || recording?.call_date;
  const duration = callLog?.duration_minutes || recording?.duration_minutes;
  const direction = callLog?.call_direction || recording?.call_direction || 'outbound';

  /* ── Highlight class for key moments in transcript ─────────────────────── */

  function segmentHighlightClass(segment) {
    if (segment.moment_type === 'objection') return 'border-l-2 border-red-400 bg-red-50';
    if (segment.moment_type === 'buying_signal') return 'border-l-2 border-emerald-400 bg-emerald-50';
    if (segment.moment_type === 'competitor_mention') return 'border-l-2 border-amber-400 bg-amber-50';
    return '';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════════ */

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="max-w-6xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-apptivia-coral/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-apptivia-coral" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-apptivia-ink truncate">Call Review</h2>
              <p className="text-xs text-apptivia-carbon-400">
                {contactName} {callDate ? `\u00b7 ${formatDate(callDate)}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-apptivia-carbon-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={16} className="text-apptivia-carbon-500" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={18} className="animate-spin text-apptivia-coral mr-2" />
            <span className="text-sm text-apptivia-carbon-500">Loading call recording...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 px-6">
            <span className="text-sm text-red-600">{error}</span>
          </div>
        ) : !recording ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <Volume2 size={32} className="text-apptivia-carbon-300 mb-3" />
            <span className="text-sm text-apptivia-carbon-500">Call recording data not available</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col lg:flex-row">

              {/* ════════════════════════════════════════════════════════════
                 LEFT COLUMN — Audio + Transcript (60%)
                 ════════════════════════════════════════════════════════════ */}
              <div className="lg:w-[60%] border-r border-apptivia-carbon-100 flex flex-col">

                {/* Audio Player */}
                {recording.recording_url && (
                  <div className="px-6 py-4 border-b border-apptivia-carbon-100 bg-apptivia-paper">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Recording
                      </span>
                    </div>
                    <audio
                      ref={audioRef}
                      src={recording.recording_url}
                      controls
                      className="w-full h-10"
                      preload="metadata"
                    />
                  </div>
                )}

                {/* Transcript */}
                <div className="px-6 py-4 flex-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={14} className="text-apptivia-carbon-400" />
                    <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                      Transcript
                    </span>
                  </div>

                  {segments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Loader2 size={20} className="animate-spin text-apptivia-coral mb-3" />
                      <p className="text-sm text-apptivia-carbon-500">
                        No transcript available. Transcription is processing...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {segments.map((seg, i) => {
                        const isRep = (seg.speaker || '').toLowerCase() === 'rep';
                        const highlight = segmentHighlightClass(seg);
                        return (
                          <div
                            key={i}
                            className={`flex gap-3 px-3 py-2 rounded-lg ${
                              isRep
                                ? 'bg-apptivia-carbon-50'
                                : 'bg-white border border-apptivia-carbon-100'
                            } ${highlight}`}
                          >
                            {/* Timestamp */}
                            <span className="text-[10px] font-mono text-apptivia-carbon-400 pt-0.5 flex-shrink-0 min-w-[32px]">
                              {formatTimestamp(seg.start_time)}
                            </span>

                            <div className="flex-1 min-w-0">
                              {/* Speaker label */}
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wider ${
                                  isRep ? 'text-apptivia-ink' : 'text-apptivia-coral'
                                }`}
                              >
                                {isRep ? 'Rep' : 'Prospect'}
                              </span>

                              {/* Text */}
                              <p className={`text-xs leading-relaxed mt-0.5 ${
                                isRep ? 'text-apptivia-ink' : 'text-apptivia-carbon-700'
                              }`}>
                                {seg.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                 RIGHT COLUMN — Intelligence Summary (40%)
                 ════════════════════════════════════════════════════════════ */}
              <div className="lg:w-[40%] overflow-y-auto px-6 py-4 space-y-5 bg-apptivia-paper" style={{ maxHeight: '80vh' }}>

                {/* ── Call Header ─────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-bold text-apptivia-ink mb-2">{contactName}</h3>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-apptivia-carbon-500">
                    {callDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatDate(callDate)}
                      </span>
                    )}
                    {duration != null && (
                      <span className="flex items-center gap-1">
                        <Mic size={11} /> {formatDuration(duration)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      direction === 'inbound'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-apptivia-carbon-100 text-apptivia-carbon-600'
                    }`}>
                      <Phone size={10} /> {direction === 'inbound' ? 'Inbound' : 'Outbound'}
                    </span>
                    {sentiment && <SentimentBadge sentiment={sentiment} />}
                  </div>
                </div>

                {/* ── Talk Ratio ──────────────────────────────────────────── */}
                {talk_ratio && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Talk Ratio
                      </span>
                    </div>
                    <TalkRatioDonut
                      repPct={talk_ratio.rep_pct}
                      prospectPct={talk_ratio.prospect_pct}
                    />
                  </div>
                )}

                {/* ── Key Metrics ─────────────────────────────────────────── */}
                <div className="flex gap-2">
                  <StatCard label="Questions" value={questions_asked} icon={MessageSquare} />
                  <StatCard label="Fillers" value={filler_words} icon={Mic} />
                  <StatCard
                    label="Longest Mono"
                    value={longest_monologue != null ? formatTimestamp(longest_monologue) : '--'}
                    icon={Clock}
                  />
                </div>

                {/* ── Methodology Adherence ───────────────────────────────── */}
                {methodology_adherence && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Methodology Adherence
                      </span>
                    </div>
                    <MethodologyBar
                      score={methodology_adherence.score}
                      framework={methodology_adherence.framework}
                    />
                    {methodology_adherence.missed_items?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {methodology_adherence.missed_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-apptivia-carbon-600">
                            <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── Deal Stage Signal ───────────────────────────────────── */}
                {deal_stage_signal && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Deal Stage Signal
                      </span>
                    </div>
                    <DealStageBadge stage={deal_stage_signal.stage} />
                    {deal_stage_signal.description && (
                      <p className="text-xs text-apptivia-carbon-600 mt-1.5 leading-relaxed">
                        {deal_stage_signal.description}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Key Moments ─────────────────────────────────────────── */}
                {key_moments?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Key Moments
                      </span>
                    </div>
                    <div className="space-y-2">
                      {key_moments.map((moment, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 bg-white border border-apptivia-carbon-100 rounded-lg px-3 py-2"
                        >
                          <MomentIcon type={moment.type} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-mono text-apptivia-carbon-400">
                                {formatTimestamp(moment.timestamp)}
                              </span>
                              <span className="text-[10px] font-medium text-apptivia-carbon-500 capitalize">
                                {moment.type?.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-apptivia-ink leading-relaxed">{moment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Coaching Suggestions ─────────────────────────────────── */}
                {coaching_suggestions?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Coaching Suggestions
                      </span>
                    </div>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {coaching_suggestions.map((suggestion, i) => (
                        <li key={i} className="text-xs text-apptivia-carbon-700 leading-relaxed">
                          {suggestion}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* ── Executive Summary ───────────────────────────────────── */}
                {summary && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Executive Summary
                      </span>
                    </div>
                    <p className="text-xs text-apptivia-carbon-700 leading-relaxed bg-white border border-apptivia-carbon-100 rounded-lg px-3 py-2.5">
                      {summary}
                    </p>
                  </div>
                )}

                {/* ── Next Steps ──────────────────────────────────────────── */}
                {next_steps?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ChevronRight size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Next Steps
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {next_steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-apptivia-carbon-700">
                          <CheckCircle size={11} className="text-apptivia-coral mt-0.5 flex-shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── Objections ──────────────────────────────────────────── */}
                {objections?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-apptivia-carbon-400" />
                      <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        Objections
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {objections.map((obj, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                          <AlertTriangle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bottom spacer for scroll */}
                <div className="h-4" />
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
