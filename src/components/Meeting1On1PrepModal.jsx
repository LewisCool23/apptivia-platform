import React, { useMemo, useState } from 'react';
import { X, Printer, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, FileText, Send, Check } from 'lucide-react';
import { KPI_GUIDANCE, buildLabel, LAGGING_THRESHOLD } from '../constants/kpiGuidance';
import { getKpiTier, TIER_LABELS, TIER_COLORS } from '../constants/skillsets';
import FeedbackThumb from './shared/FeedbackThumb';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../AuthContext';

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
}) {
  const [notes, setNotes] = useState('');
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [synopsisText, setSynopsisText] = useState('');
  const [shared, setShared] = useState(false);
  const [copiedAgenda, setCopiedAgenda] = useState(false);

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

  const handleOpenSharePreview = () => {
    setSynopsisText(generateSynopsis);
    setShowSharePreview(true);
    setShared(false);
    setCopiedAgenda(false);
  };

  const handleShareAgenda = async () => {
    if (!repId || !profile) return;

    // Send in-app notification to the rep
    await addNotification({
      type: 'coaching',
      title: '1:1 Agenda Shared',
      message: synopsisText.length > 300 ? synopsisText.slice(0, 297) + '...' : synopsisText,
      link: '/coach',
      ownerId: repId,
      organizationId: profile.organization_id,
      dedupeKey: `agenda-${repId}-${new Date().toISOString().split('T')[0]}`,
      priority: 3,
    });

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(synopsisText);
      setCopiedAgenda(true);
      setTimeout(() => setCopiedAgenda(false), 2000);
    } catch { /* clipboard may fail in some environments */ }

    setShared(true);
    setTimeout(() => setShared(false), 3000);
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
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col meeting-prep-content">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
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
              {onBuildRepPlan && (
                <button
                  onClick={() => onBuildRepPlan(repId, repName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium"
                  title="Build a coaching plan for this rep"
                >
                  <FileText size={14} />
                  Build Rep Plan
                </button>
              )}
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
                            <div className="text-[11px] text-apptivia-coral-tone-700 bg-apptivia-coral-tone-50 border border-blue-100 rounded px-3 py-2 mb-1.5">
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
                className="w-full border rounded-lg p-3 text-xs text-apptivia-carbon-700 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {/* 6. Share Agenda Preview */}
            {showSharePreview && (
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-apptivia-coral-tone-50/50 no-print">
                <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-apptivia-coral text-white flex items-center justify-center text-xs font-bold">
                    <Send size={12} />
                  </span>
                  Preview Agenda for {repName}
                </h3>
                <textarea
                  value={synopsisText}
                  onChange={(e) => setSynopsisText(e.target.value)}
                  className="w-full border rounded-lg p-3 text-xs text-apptivia-carbon-700 resize-none h-48 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white font-mono"
                />
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setShowSharePreview(false)}
                    className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center gap-2">
                    {shared && (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <Check size={12} /> Sent & Copied!
                      </span>
                    )}
                    <button
                      onClick={handleShareAgenda}
                      disabled={shared}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${
                        shared ? 'bg-green-500' : 'bg-apptivia-coral hover:bg-apptivia-coral'
                      }`}
                    >
                      {shared ? (
                        <><Check size={14} /> Shared</>
                      ) : (
                        <><Send size={14} /> Send to {repName?.split(' ')[0] || 'Rep'} & Copy</>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-apptivia-carbon-400 mt-2">
                  This will send an in-app notification to {repName?.split(' ')[0] || 'the rep'} and copy the full agenda to your clipboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
