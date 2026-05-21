import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Printer, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, FileText, Send, Check, Mail, Edit3, Eye, Copy } from 'lucide-react';
import { KPI_GUIDANCE, buildLabel, LAGGING_THRESHOLD } from '../constants/kpiGuidance';
import { getKpiTier, TIER_LABELS, TIER_COLORS } from '../constants/skillsets';
import FeedbackThumb from './shared/FeedbackThumb';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';
import { backendFetch } from '../utils/backendFetch';
import { useModalBehavior } from '../hooks/useModalBehavior';

export default function Meeting1On1PrepModal({
  isOpen,
  onClose,
  repName,
  repId,
  repAnalysis,
  scorecardData,
  historicalScores,
  repNames,
  scorecardKpiKeys,
  onBuildRepPlan,
  repActivePlans,
  onViewRepPlan,
  onViewDevPlan,
}) {
  useModalBehavior(isOpen, onClose);
  const [notes, setNotes] = useState('');
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [synopsisText, setSynopsisText] = useState('');
  const [shared, setShared] = useState(false);
  const [copiedAgenda, setCopiedAgenda] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailNotes, setEmailNotes] = useState('');
  const [emailError, setEmailError] = useState('');

  const shareRef = useRef(null);
  const { addNotification } = useNotifications();
  const { profile } = useAuth();

  const scKpiSet = useMemo(() => new Set(scorecardKpiKeys || []), [scorecardKpiKeys]);

  // Find this rep's full KPI breakdown from scorecardData rows
  const repRow = useMemo(() => {
    const rows = scorecardData?.rows || [];
    return rows.find(r => r.profile_id === repId) || null;
  }, [scorecardData, repId]);

  // Compute team averages per KPI for peer comparison
  const teamAvgs = useMemo(() => {
    const rows = scorecardData?.rows || [];
    if (rows.length === 0 || !rows[0]?.kpis) return {};
    const avgs = {};
    const kpiKeys = Object.keys(rows[0].kpis);
    kpiKeys.forEach(key => {
      const vals = rows.map(r => Number(r?.kpis?.[key]?.percentage || 0));
      avgs[key] = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
    });
    return avgs;
  }, [scorecardData]);

  // Tier-sorted lagging KPIs for this rep
  const laggingKpis = useMemo(() => {
    if (!repRow?.kpis) return [];
    return Object.entries(repRow.kpis)
      .map(([key, val]) => ({
        key,
        percentage: Math.round(Number(val?.percentage || 0)),
        tier: getKpiTier(key, scKpiSet),
        label: KPI_GUIDANCE[key]?.title || buildLabel(key),
        guidance: KPI_GUIDANCE[key] || null,
        teamAvg: teamAvgs[key] || 0,
      }))
      .filter(k => k.percentage < LAGGING_THRESHOLD)
      .sort((a, b) => a.tier - b.tier || a.percentage - b.percentage);
  }, [repRow, scKpiSet, teamAvgs]);

  // Strengths — top performing KPIs
  const strengths = useMemo(() => {
    if (!repRow?.kpis) return [];
    return Object.entries(repRow.kpis)
      .map(([key, val]) => ({
        key,
        percentage: Math.round(Number(val?.percentage || 0)),
        label: KPI_GUIDANCE[key]?.title || buildLabel(key),
        teamAvg: teamAvgs[key] || 0,
      }))
      .filter(k => k.percentage >= LAGGING_THRESHOLD)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [repRow, teamAvgs]);

  // Action items from top 3 lagging KPIs
  const actionItems = useMemo(() => {
    return laggingKpis
      .slice(0, 3)
      .flatMap(kpi => {
        if (!kpi.guidance?.tips?.length) return [];
        return kpi.guidance.tips.slice(0, 2).map(tip => ({ kpiLabel: kpi.label, tip }));
      });
  }, [laggingKpis]);

  const handlePrint = () => window.print();

  const generateSynopsis = useMemo(() => {
    const lines = [];
    lines.push(`1:1 Agenda — ${repName}`);
    lines.push(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    lines.push('');

    // Discussion Topics
    lines.push('Discussion Topics:');
    let topicNum = 1;
    if (laggingKpis.length > 0) {
      laggingKpis.slice(0, 2).forEach(kpi => {
        const question = kpi.guidance?.coachingQuestion ? ` — "${kpi.guidance.coachingQuestion}"` : '';
        lines.push(`  ${topicNum}. ${kpi.label} — needs attention${question}`);
        topicNum++;
      });
    }
    if (strengths.length > 0) {
      lines.push(`  ${topicNum}. Acknowledge strengths: ${strengths.map(s => s.label).join(', ')}`);
      topicNum++;
    }
    if (laggingKpis.length === 0 && strengths.length === 0) {
      lines.push('  1. General performance check-in');
    }
    lines.push('');

    // Action Items
    if (actionItems.length > 0) {
      lines.push('Action Items to Follow Up:');
      actionItems.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item.tip}`);
      });
      lines.push('');
    }

    // Manager notes
    if (notes.trim()) {
      lines.push('Manager Notes:');
      lines.push(`  ${notes.trim()}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('Is there anything you would like to discuss?');
    return lines.join('\n');
  }, [repName, laggingKpis, strengths, actionItems, notes]);

  // Parse synopsis into structured sections for styled preview
  const parseSynopsis = (text) => {
    const sections = { header: '', date: '', topics: [], actions: [], managerNotes: '', closing: '' };
    const lines = text.split('\n');
    let current = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '---') {
        if (trimmed === '---') current = 'closing';
        return;
      }
      if (lines.indexOf(line) === 0) { sections.header = trimmed; return; }
      if (lines.indexOf(line) === 1 && !trimmed.startsWith('Discussion')) { sections.date = trimmed; return; }
      if (trimmed === 'Discussion Topics:') { current = 'topics'; return; }
      if (trimmed.startsWith('Action Items')) { current = 'actions'; return; }
      if (trimmed === 'Manager Notes:') { current = 'notes'; return; }
      if (trimmed.startsWith('Is there anything')) { sections.closing = trimmed; return; }
      if (current === 'topics') sections.topics.push(trimmed.replace(/^\d+\.\s*/, ''));
      else if (current === 'actions') sections.actions.push(trimmed.replace(/^\d+\.\s*/, ''));
      else if (current === 'notes') sections.managerNotes += (sections.managerNotes ? '\n' : '') + trimmed;
    });
    return sections;
  };

  const handleOpenSharePreview = () => {
    setSynopsisText(generateSynopsis);
    setShowSharePreview(true);
    setEditMode(false);
    setShared(false);
    setCopiedAgenda(false);
    setEmailError('');
    // Pre-fill email fields
    setEmailSubject(`1:1 Prep — ${repName} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
    setEmailNotes('');
    // Auto-scroll to the share section after render
    setTimeout(() => shareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const [sending, setSending] = useState(false);

  const handleShareAgenda = async () => {
    if (!repId || !profile || sending) return;
    setEmailError('');

    // Validate recipients if provided (optional — rep email is always included server-side)
    const extraRecipients = emailRecipients.trim()
      ? emailRecipients.split(',').map(e => e.trim()).filter(Boolean)
      : [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = extraRecipients.filter(e => !emailRegex.test(e));
    if (invalid.length > 0) {
      setEmailError(`Invalid email${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`);
      return;
    }

    setSending(true);

    try {
      // 1. Send branded email to the rep (+ any additional recipients)
      const managerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your Manager';
      await backendFetch('/api/coaching/share-agenda', {
        repId,
        agendaText: synopsisText,
        managerName,
        additionalRecipients: extraRecipients,
        subject: emailSubject || undefined,
        notes: emailNotes || undefined,
      });

      // 2. Send simplified in-app notification (full text stored for modal view)
      await addNotification({
        type: 'coaching',
        title: '1:1 Prep Shared',
        message: synopsisText,
        link: '/coach',
        ownerId: repId,
        organizationId: profile.organization_id,
        dedupeKey: `agenda-${repId}-${new Date().toISOString().split('T')[0]}`,
        priority: 3,
      });

      setShared(true);
      setTimeout(() => {
        setShared(false);
        setShowSharePreview(false);
      }, 3000);
    } catch (err) {
      console.error('Share agenda failed:', err);
      setEmailError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyAgenda = async () => {
    try {
      await navigator.clipboard.writeText(synopsisText);
      setCopiedAgenda(true);
      setTimeout(() => setCopiedAgenda(false), 2000);
    } catch { /* clipboard may fail */ }
  };

  // Auto-assessment
  const trendDelta = repAnalysis?.trendDelta || 0;
  const assessment = trendDelta > 5
    ? { text: 'Trending upward — acknowledge momentum and reinforce habits.', color: 'text-green-700 bg-green-50', Icon: TrendingUp }
    : trendDelta < -5
      ? { text: 'Declining trend — explore blockers and adjust approach.', color: 'text-red-700 bg-red-50', Icon: TrendingDown }
      : { text: 'Stable performance — maintain focus and set stretch goals.', color: 'text-apptivia-coral bg-apptivia-coral-tone-50', Icon: Minus };

  if (!isOpen) return null;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .meeting-prep-overlay, .meeting-prep-overlay * { visibility: visible; }
          .meeting-prep-overlay { position: absolute !important; left: 0; top: 0; width: 100%; background: none !important; }
          .meeting-prep-overlay > .meeting-prep-backdrop { display: none !important; }
          .meeting-prep-content { position: static !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 meeting-prep-overlay">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm meeting-prep-backdrop" onClick={onClose} />
        <div className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col meeting-prep-content">

          {/* Header */}
          <div className="bg-apptivia-ink px-6 py-4 flex items-center justify-between text-white">
            <div>
              <h2 className="text-lg font-bold">1:1 Prep: {repName}</h2>
              <p className="text-xs text-apptivia-coral-tone-300 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={handleOpenSharePreview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
                title="Share agenda with rep"
              >
                <Send size={14} />
                Share Agenda
              </button>
              {(() => {
                const hasCoaching = repActivePlans?.coaching?.length > 0;
                const hasDevPlan = repActivePlans?.devPlans?.length > 0;
                if (hasCoaching && onViewRepPlan) {
                  return (
                    <button
                      onClick={() => onViewRepPlan(repId, repActivePlans.coaching[0])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
                      title="View active coaching plan"
                    >
                      <FileText size={14} />
                      View Active Plan
                    </button>
                  );
                }
                if (hasDevPlan && onViewDevPlan) {
                  return (
                    <button
                      onClick={() => onViewDevPlan(repId, repActivePlans.devPlans[0])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
                      title="View development plan"
                    >
                      <FileText size={14} />
                      View Dev Plan
                    </button>
                  );
                }
                return onBuildRepPlan ? (
                  <button
                    onClick={() => onBuildRepPlan(repId, repName)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
                    title="Build a coaching plan for this rep"
                  >
                    <FileText size={14} />
                    Build Rep Plan
                  </button>
                ) : null;
              })()}
              <button onClick={handlePrint} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors" title="Print agenda">
                <Printer size={18} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* 1. Opening Context */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-apptivia-coral-tone-50 text-apptivia-coral flex items-center justify-center text-xs font-bold">1</span>
                Opening Context
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="bg-apptivia-paper rounded p-2 text-center">
                  <div className="text-[10px] text-apptivia-carbon-500 uppercase">Current Score</div>
                  <div className="text-lg font-bold text-apptivia-ink">{repAnalysis?.recent || 0}%</div>
                </div>
                <div className="bg-apptivia-paper rounded p-2 text-center">
                  <div className="text-[10px] text-apptivia-carbon-500 uppercase">5-Week Avg</div>
                  <div className="text-lg font-bold text-apptivia-ink">{repAnalysis?.avg5w || 0}%</div>
                </div>
                <div className="bg-apptivia-paper rounded p-2 text-center">
                  <div className="text-[10px] text-apptivia-carbon-500 uppercase">5-Week Trend</div>
                  <div className={`text-lg font-bold ${trendDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trendDelta >= 0 ? '+' : ''}{trendDelta}%
                  </div>
                </div>
                <div className="bg-apptivia-paper rounded p-2 text-center">
                  <div className="text-[10px] text-apptivia-carbon-500 uppercase">vs Last Week</div>
                  <div className={`text-lg font-bold ${(repAnalysis?.delta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(repAnalysis?.delta || 0) >= 0 ? '+' : ''}{repAnalysis?.delta || 0}%
                  </div>
                </div>
              </div>
              <div className={`text-xs rounded px-3 py-2 flex items-center gap-2 ${assessment.color}`}>
                <assessment.Icon size={14} />
                {assessment.text}
              </div>
            </div>

            {/* 2. Priority KPIs to Discuss */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">2</span>
                Priority KPIs to Discuss
                {laggingKpis.length > 0 && <span className="text-xs text-red-500 font-normal">({laggingKpis.length} lagging)</span>}
              </h3>
              {laggingKpis.length === 0 ? (
                <div className="text-xs text-emerald-600 bg-emerald-50 rounded p-3">
                  All KPIs are at or above {LAGGING_THRESHOLD}% — focus on stretch goals and consistency.
                </div>
              ) : (
                <div className="space-y-3">
                  {laggingKpis.slice(0, 5).map(kpi => {
                    const tierColor = TIER_COLORS[kpi.tier] || TIER_COLORS[4];
                    const delta = kpi.percentage - kpi.teamAvg;
                    return (
                      <div key={kpi.key} className="border rounded-lg p-3 bg-apptivia-paper">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-apptivia-ink">{kpi.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tierColor}`}>
                              {TIER_LABELS[kpi.tier]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-red-600">{kpi.percentage}%</span>
                            <span className={`text-[10px] font-medium ${delta < 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {delta < 0 ? '' : '+'}{delta}% vs team
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-apptivia-carbon-200 rounded-full h-1.5 mb-2">
                          <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(kpi.percentage, 100)}%` }} />
                        </div>
                        {kpi.guidance && (
                          <>
                            <div className="text-[11px] text-apptivia-coral-tone-700 bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded px-3 py-2 mb-1.5">
                              <span className="font-semibold">Ask:</span> "{kpi.guidance.coachingQuestion}"
                            </div>
                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-1.5">
                              {kpi.guidance.diagnosis}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Strengths to Acknowledge */}
            {strengths.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">3</span>
                  Strengths to Acknowledge
                </h3>
                <div className="space-y-2">
                  {strengths.map(kpi => (
                    <div key={kpi.key} className="flex items-center justify-between text-xs bg-emerald-50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="font-medium text-apptivia-ink">{kpi.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600">{kpi.percentage}%</span>
                        {kpi.percentage > kpi.teamAvg && kpi.teamAvg > 0 && (
                          <span className="text-emerald-500 text-[10px]">+{kpi.percentage - kpi.teamAvg}% above team</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Suggested Action Items */}
            {actionItems.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-apptivia-carbon-100 text-apptivia-ink flex items-center justify-center text-xs font-bold">4</span>
                  Suggested Action Items ({actionItems.length})
                </h3>
                <ol className="space-y-2">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-apptivia-ink font-bold mt-0.5 min-w-[16px]">{i + 1}.</span>
                      <div>
                        <span className="font-medium text-apptivia-ink">{item.tip}</span>
                        <span className="text-apptivia-carbon-400 ml-1">({item.kpiLabel})</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="mt-2 flex justify-end">
                  <FeedbackThumb featureArea="1on1_prep" contentKey={repId} context={{ repId, type: 'action_items' }} />
                </div>
              </div>
            )}

            {/* 5. Manager Notes */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-apptivia-carbon-200 text-apptivia-carbon-600 flex items-center justify-center text-xs font-bold">5</span>
                Manager Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes before or during the 1:1..."
                className="w-full border rounded-lg p-3 text-xs text-apptivia-carbon-700 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
              />
            </div>

            {/* 6. Share Agenda */}
            {showSharePreview && (() => {
              const parsed = parseSynopsis(synopsisText);
              return (
                <div ref={shareRef} className="border-2 border-apptivia-coral-tone-100 rounded-lg overflow-hidden bg-white no-print">
                  {/* Preview Header */}
                  <div className="bg-apptivia-ink px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send size={14} className="text-apptivia-coral" />
                      <span className="text-sm font-semibold text-white">Share Agenda</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditMode(false)}
                        className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${!editMode ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                      >
                        <Eye size={10} /> Preview
                      </button>
                      <button
                        onClick={() => setEditMode(true)}
                        className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${editMode ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                      >
                        <Edit3 size={10} /> Edit
                      </button>
                    </div>
                  </div>

                  {/* Agenda Content — Preview or Edit */}
                  <div className="p-4 max-h-[280px] overflow-y-auto border-b border-apptivia-carbon-100">
                    {editMode ? (
                      <textarea
                        value={synopsisText}
                        onChange={(e) => setSynopsisText(e.target.value)}
                        className="w-full border rounded-lg p-3 text-xs text-apptivia-carbon-700 resize-none h-48 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300 bg-white"
                      />
                    ) : (
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="border-b border-apptivia-carbon-100 pb-2">
                          <h4 className="text-sm font-bold text-apptivia-ink">{parsed.header}</h4>
                          {parsed.date && <p className="text-[11px] text-apptivia-carbon-500 mt-0.5">{parsed.date}</p>}
                        </div>
                        {/* Discussion Topics */}
                        {parsed.topics.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-apptivia-coral uppercase tracking-wide mb-1.5">Discussion Topics</p>
                            <ol className="space-y-1.5 list-decimal list-inside">
                              {parsed.topics.map((t, i) => (
                                <li key={i} className="text-xs text-apptivia-carbon-700 leading-relaxed">{t}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {/* Action Items */}
                        {parsed.actions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-apptivia-ink uppercase tracking-wide mb-1.5">Action Items</p>
                            <ol className="space-y-1 list-decimal list-inside">
                              {parsed.actions.map((a, i) => (
                                <li key={i} className="text-xs text-apptivia-carbon-700">{a}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        {/* Manager Notes */}
                        {parsed.managerNotes && (
                          <div className="bg-apptivia-carbon-50 rounded p-2">
                            <p className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-1">Manager Notes</p>
                            <p className="text-xs text-apptivia-carbon-700">{parsed.managerNotes}</p>
                          </div>
                        )}
                        {/* Closing */}
                        {parsed.closing && (
                          <p className="text-xs text-apptivia-carbon-500 italic pt-1 border-t border-apptivia-carbon-100">{parsed.closing}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Email Form */}
                  <div className="p-4 space-y-3 bg-apptivia-carbon-50/50">
                    <div>
                      <label className="block text-[11px] font-medium text-apptivia-carbon-600 mb-1">
                        Additional Recipients (optional, comma-separated)
                      </label>
                      <input
                        type="text"
                        value={emailRecipients}
                        onChange={(e) => setEmailRecipients(e.target.value)}
                        placeholder="vp@company.com, teamlead@company.com"
                        className="w-full px-3 py-1.5 text-xs border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                      />
                      <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">{repName}'s email is included automatically</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-apptivia-carbon-600 mb-1">Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-apptivia-carbon-600 mb-1">Additional notes (optional)</label>
                      <textarea
                        value={emailNotes}
                        onChange={(e) => setEmailNotes(e.target.value)}
                        placeholder="Add context or highlights for this prep"
                        rows={2}
                        className="w-full px-3 py-1.5 text-xs border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                      />
                    </div>

                    {emailError && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{emailError}</div>
                    )}

                    {shared && (
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-xs flex items-center gap-2">
                        <CheckCircle size={14} /> Email sent successfully!
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowSharePreview(false)}
                        className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700"
                      >
                        Cancel
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyAgenda}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-apptivia-carbon-200 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 transition-colors"
                        >
                          {copiedAgenda ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                        </button>
                        <button
                          onClick={handleShareAgenda}
                          disabled={shared || sending}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
                            shared ? 'bg-green-500' : 'bg-apptivia-coral hover:bg-apptivia-coral/90'
                          } ${sending ? 'opacity-70 cursor-wait' : ''}`}
                        >
                          <Mail size={12} />
                          {sending ? 'Sending...' : 'Send Email'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-apptivia-carbon-400 text-center">
                      A branded HTML email with the agenda will be sent to {repName} and any additional recipients
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
