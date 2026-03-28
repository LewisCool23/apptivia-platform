import React, { useMemo, useState } from 'react';
import { X, Printer, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { KPI_GUIDANCE, buildLabel, LAGGING_THRESHOLD } from '../constants/kpiGuidance';
import { getKpiTier, TIER_LABELS, TIER_COLORS } from '../constants/skillsets';
import FeedbackThumb from './shared/FeedbackThumb';

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

  // Auto-assessment
  const trendDelta = repAnalysis?.trendDelta || 0;
  const assessment = trendDelta > 5
    ? { text: 'Trending upward — acknowledge momentum and reinforce habits.', color: 'text-green-700 bg-green-50', Icon: TrendingUp }
    : trendDelta < -5
      ? { text: 'Declining trend — explore blockers and adjust approach.', color: 'text-red-700 bg-red-50', Icon: TrendingDown }
      : { text: 'Stable performance — maintain focus and set stretch goals.', color: 'text-blue-700 bg-blue-50', Icon: Minus };

  if (!isOpen) return null;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.meeting-prep-overlay) { display: none !important; }
          .meeting-prep-overlay { position: static !important; background: none !important; }
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
              <p className="text-xs text-blue-200 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2 no-print">
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                Opening Context
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase">Current Score</div>
                  <div className="text-lg font-bold text-gray-900">{repAnalysis?.recent || 0}%</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase">5-Week Avg</div>
                  <div className="text-lg font-bold text-gray-900">{repAnalysis?.avg5w || 0}%</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase">5-Week Trend</div>
                  <div className={`text-lg font-bold ${trendDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trendDelta >= 0 ? '+' : ''}{trendDelta}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-[10px] text-gray-500 uppercase">vs Last Week</div>
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
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
                      <div key={kpi.key} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{kpi.label}</span>
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
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                          <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(kpi.percentage, 100)}%` }} />
                        </div>
                        {kpi.guidance && (
                          <>
                            <div className="text-[11px] text-blue-800 bg-blue-50 border border-blue-100 rounded px-3 py-2 mb-1.5">
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
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">3</span>
                  Strengths to Acknowledge
                </h3>
                <div className="space-y-2">
                  {strengths.map(kpi => (
                    <div key={kpi.key} className="flex items-center justify-between text-xs bg-emerald-50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="font-medium text-gray-900">{kpi.label}</span>
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
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">4</span>
                  Suggested Action Items ({actionItems.length})
                </h3>
                <ol className="space-y-2">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-purple-500 font-bold mt-0.5 min-w-[16px]">{i + 1}.</span>
                      <div>
                        <span className="font-medium text-gray-900">{item.tip}</span>
                        <span className="text-gray-400 ml-1">({item.kpiLabel})</span>
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">5</span>
                Manager Notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes before or during the 1:1..."
                className="w-full border rounded-lg p-3 text-xs text-gray-700 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
