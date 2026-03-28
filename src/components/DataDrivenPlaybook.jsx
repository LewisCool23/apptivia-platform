import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Users, Target, ClipboardList, FileText } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import Meeting1On1PrepModal from './Meeting1On1PrepModal';
import { KPI_GUIDANCE, buildLabel, LAGGING_THRESHOLD, DECLINING_TREND_THRESHOLD } from '../constants/kpiGuidance';
import { getKpiTier, TIER_LABELS, TIER_COLORS } from '../constants/skillsets';
import FeedbackThumb from './shared/FeedbackThumb';

/**
 * Data-driven coaching playbook powered by 5-week trend analysis.
 * Uses historicalScores (per-rep weekly scores) + scorecardData (current KPI detail)
 * to surface persistent weaknesses, declining reps, and recent changes.
 * KPIs are prioritized by tier: Scorecard Priority > Core Skill > Engage Adoption > Other.
 */
export default function DataDrivenPlaybook({ scorecardData, lastWeekScorecardData, coachData, historicalScores, repNames, scorecardKpiKeys, onStartReview, onBuildPlan }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [prepRepId, setPrepRepId] = useState(null);

  const currentRows = scorecardData?.rows || [];
  const lastWeekRows = lastWeekScorecardData?.rows || [];
  const trendWeeks = historicalScores || [];
  const names = repNames || {};
  const scKpiSet = useMemo(() => new Set(scorecardKpiKeys || []), [scorecardKpiKeys]);

  // Detect if current week data is empty (all scores near 0) and fall back to last week
  const currentAvgScore = currentRows.length > 0
    ? Math.round(currentRows.reduce((s, r) => s + (r.apptivityScore || 0), 0) / currentRows.length)
    : 0;
  const isCurrentWeekEmpty = currentAvgScore < 5;
  const rows = isCurrentWeekEmpty && lastWeekRows.length > 0 ? lastWeekRows : currentRows;
  const dataSourceLabel = isCurrentWeekEmpty && lastWeekRows.length > 0 ? 'Last Week' : 'Current';

  // ── Core trend analysis ──────────────────────────────────────────────
  const analysis = useMemo(() => {
    // --- 1. Team weakness: KPIs consistently below threshold across current data ---
    const kpiKeys = rows[0]?.kpis ? Object.keys(rows[0].kpis) : [];
    const kpiStats = kpiKeys.map(key => {
      const percentages = rows.map(r => Number(r?.kpis?.[key]?.percentage || 0));
      const avg = percentages.length > 0
        ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
        : 0;
      const belowCount = rows.filter(r => Number(r?.kpis?.[key]?.percentage || 0) < LAGGING_THRESHOLD).length;
      const label = KPI_GUIDANCE[key]?.title || buildLabel(key);
      const tier = getKpiTier(key, scKpiSet);
      return { key, label, avgPercentage: avg, belowTargetCount: belowCount, tier };
    });

    // Sort by tier first (lower = higher priority), then by worst percentage within tier
    const lagging = kpiStats
      .filter(k => k.avgPercentage < LAGGING_THRESHOLD)
      .sort((a, b) => a.tier - b.tier || a.avgPercentage - b.avgPercentage);

    // --- 2. Rep-specific coaching: reps declining over 5-week trend ---
    // Filter out weeks with no KPI data (avoids false 0% scores in trends)
    const dataWeeks = trendWeeks.filter(w => w.hasData !== false);

    const repTrends = [];
    if (dataWeeks.length >= 2) {
      const repIds = new Set();
      dataWeeks.forEach(wp => {
        Object.keys(wp).forEach(k => {
          if (k !== 'week' && k !== 'score' && k !== 'hasData' && typeof wp[k] === 'number') repIds.add(k);
        });
      });

      repIds.forEach(repId => {
        const scores = dataWeeks.map(wp => wp[repId]).filter(v => typeof v === 'number');
        if (scores.length < 2) return;

        const recent = scores[scores.length - 1];
        const prior = scores[scores.length - 2];
        const oldest = scores[0];
        const delta = recent - prior;
        const trendDelta = recent - oldest; // full 5-week delta
        const avg5w = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        const name = names[repId] || repId.slice(0, 8);

        // Find this rep's weakest KPI, prioritized by tier
        const repRow = rows.find(r => r.profile_id === repId);
        let weakestKpi = null;
        let secondWeakestEntry = null;
        let strongestKpi = null;
        let teamAvgForWeakest = null;
        let deltaVsTeam = null;
        let topPerformerForWeakest = null;

        if (repRow?.kpis) {
          const entries = Object.entries(repRow.kpis)
            .map(([k, v]) => ({ key: k, percentage: Number(v?.percentage || 0), tier: getKpiTier(k, scKpiSet) }))
            .filter(k => k.percentage < LAGGING_THRESHOLD)
            .sort((a, b) => a.tier - b.tier || a.percentage - b.percentage);
          if (entries.length > 0) weakestKpi = entries[0];
          if (entries.length > 1) secondWeakestEntry = entries[1];

          // Strongest KPI for balanced view
          const allEntries = Object.entries(repRow.kpis)
            .map(([k, v]) => ({ key: k, percentage: Number(v?.percentage || 0) }));
          const best = allEntries.sort((a, b) => b.percentage - a.percentage)[0];
          if (best && best.percentage > 0) {
            const bestTeamAvg = kpiStats.find(s => s.key === best.key)?.avgPercentage || 0;
            strongestKpi = {
              key: best.key,
              percentage: Math.round(best.percentage),
              label: KPI_GUIDANCE[best.key]?.title || buildLabel(best.key),
              teamAvg: bestTeamAvg,
            };
          }

          // Peer comparison for weakest KPI
          if (weakestKpi) {
            const kpiStat = kpiStats.find(s => s.key === weakestKpi.key);
            teamAvgForWeakest = kpiStat?.avgPercentage || 0;
            deltaVsTeam = Math.round(weakestKpi.percentage) - teamAvgForWeakest;

            const topPerf = rows
              .filter(r => r.profile_id !== repId)
              .map(r => ({
                name: names[r.profile_id] || r.profile_id?.slice(0, 8),
                pct: Number(r?.kpis?.[weakestKpi.key]?.percentage || 0)
              }))
              .sort((a, b) => b.pct - a.pct)[0];
            if (topPerf) topPerformerForWeakest = { name: topPerf.name, percentage: Math.round(topPerf.pct) };
          }
        }

        const secondWeakestKpi = secondWeakestEntry ? {
          key: secondWeakestEntry.key,
          percentage: Math.round(secondWeakestEntry.percentage),
          label: KPI_GUIDANCE[secondWeakestEntry.key]?.title || buildLabel(secondWeakestEntry.key),
          tier: secondWeakestEntry.tier,
        } : null;

        repTrends.push({ repId, name, recent, prior, delta, trendDelta, avg5w, weakestKpi, secondWeakestKpi, strongestKpi, teamAvgForWeakest, deltaVsTeam, topPerformerForWeakest });
      });
    }

    // Reps needing coaching: declining trend OR consistently below threshold
    const repsNeedingCoaching = repTrends
      .filter(r => r.trendDelta < DECLINING_TREND_THRESHOLD || r.avg5w < LAGGING_THRESHOLD || r.recent < LAGGING_THRESHOLD)
      .sort((a, b) => a.trendDelta - b.trendDelta)
      .slice(0, 5);

    // --- 3. What changed recently: team avg trend + individual movers ---
    const recentChanges = [];
    if (dataWeeks.length >= 2) {
      const latest = dataWeeks[dataWeeks.length - 1];
      const prevWeek = dataWeeks[dataWeeks.length - 2];
      const oldest = dataWeeks[0];

      recentChanges.push({
        label: 'Team Average Score',
        current: latest.score,
        prior: prevWeek.score,
        delta: latest.score - prevWeek.score,
        trend5w: latest.score - oldest.score,
        type: 'team',
      });

      const movers = repTrends
        .map(r => ({ ...r, absDelta: Math.abs(r.delta) }))
        .sort((a, b) => b.absDelta - a.absDelta)
        .slice(0, 4);

      movers.forEach(m => {
        recentChanges.push({
          label: m.name,
          current: m.recent,
          prior: m.prior,
          delta: m.delta,
          trend5w: m.trendDelta,
          type: m.delta >= 0 ? 'improved' : 'declined',
        });
      });
    }

    // --- 4. Priority actions: derived from persistent weaknesses + declining reps ---
    // Already tier-sorted from lagging array
    const priorities = [];
    lagging.slice(0, 3).forEach(kpi => {
      const tierLabel = TIER_LABELS[kpi.tier];
      priorities.push({
        type: 'kpi',
        text: `Improve ${kpi.label}`,
        detail: `${tierLabel} — Team avg ${kpi.avgPercentage}%, ${kpi.belowTargetCount} rep${kpi.belowTargetCount !== 1 ? 's' : ''} below target`,
        tier: kpi.tier,
      });
    });
    const decliningReps = repsNeedingCoaching.filter(r => r.trendDelta < DECLINING_TREND_THRESHOLD);
    if (decliningReps.length > 0) {
      priorities.push({
        type: 'reps',
        text: 'Schedule 1:1s with declining reps',
        detail: decliningReps.map(r => `${r.name.split(' ')[0]} (${r.trendDelta > 0 ? '+' : ''}${r.trendDelta}%)`).join(', '),
      });
    }
    const lowAvgReps = repsNeedingCoaching.filter(r => r.avg5w < LAGGING_THRESHOLD && r.trendDelta >= DECLINING_TREND_THRESHOLD);
    if (lowAvgReps.length > 0) {
      priorities.push({
        type: 'reps',
        text: 'Coach reps with low 5-week averages',
        detail: lowAvgReps.map(r => `${r.name.split(' ')[0]} (${r.avg5w}% avg)`).join(', '),
      });
    }

    return { lagging, kpiStats, repsNeedingCoaching, recentChanges, priorities, repTrends };
  }, [rows, trendWeeks, names, scKpiSet]);

  const { lagging, repsNeedingCoaching, recentChanges, priorities } = analysis;

  const prepRep = useMemo(() => {
    if (!prepRepId) return null;
    return analysis.repTrends.find(r => r.repId === prepRepId) || null;
  }, [prepRepId, analysis.repTrends]);

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const hasTrendData = trendWeeks.length >= 2;
  const hasAnyData = rows.length > 0 || hasTrendData;

  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-base font-semibold">Manager Coaching Playbook</h2>
          <InfoTooltip text="Data-driven coaching actions based on 5-week performance trends." />
        </div>
        <div className="text-xs text-gray-500 p-4 text-center">Loading team data...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold">Manager Coaching Playbook</h2>
        <InfoTooltip text="Data-driven coaching actions based on your team's 5-week performance trends and KPI analysis. KPIs are prioritized: Scorecard Priority > Core Skills > Engage Adoption." />
        <span className="ml-auto flex items-center gap-1.5">
          {isCurrentWeekEmpty && lastWeekRows.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              Using Last Week
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            {hasTrendData ? `${trendWeeks.length}-Week Trend` : 'Live Data'}
          </span>
        </span>
      </div>

      {/* Section 1: Team Weakness Analysis */}
      <div className="border rounded-lg mb-3 overflow-hidden">
        <button
          onClick={() => toggleSection('weaknesses')}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-red-50 hover:bg-red-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-gray-900">
              Team Weakness Analysis
              {lagging.length > 0 && <span className="ml-1 text-xs text-red-600">({lagging.length} lagging KPI{lagging.length !== 1 ? 's' : ''})</span>}
            </span>
          </div>
          {expandedSection === 'weaknesses' ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {expandedSection === 'weaknesses' && (
          <div className="px-3 py-2 space-y-2">
            {lagging.length === 0 ? (
              <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-2">
                {`All team KPIs are at or above ${LAGGING_THRESHOLD}% target. Focus on maintaining momentum.`}
              </div>
            ) : (
              lagging.map(kpi => {
                const guidance = KPI_GUIDANCE[kpi.key];
                const tierColor = TIER_COLORS[kpi.tier] || TIER_COLORS[4];
                return (
                  <div key={kpi.key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{kpi.label}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tierColor}`}>
                          {TIER_LABELS[kpi.tier]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-bold">{kpi.avgPercentage}%</span>
                        <span className="text-[10px] text-gray-400">{kpi.belowTargetCount}/{rows.length} reps below</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className="h-1.5 rounded-full bg-red-400 transition-all"
                        style={{ width: `${Math.min(kpi.avgPercentage, 100)}%` }}
                      />
                    </div>
                    {guidance && (
                      <>
                        <div className="text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 mb-1.5">
                          {guidance.diagnosis}
                        </div>
                        <div className="text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1 mb-1.5">
                          Ask in 1:1: "{guidance.coachingQuestion}"
                        </div>
                        <ul className="text-[11px] text-gray-600 space-y-0.5 list-disc list-inside">
                          {guidance.tips.slice(0, 3).map((tip, i) => <li key={i}>{tip}</li>)}
                        </ul>
                        <div className="mt-1.5 flex justify-end">
                          <FeedbackThumb featureArea="playbook_insight" contentKey={`weakness_${kpi.key}`} context={{ kpi: kpi.key, type: 'team_weakness' }} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Section 2: Rep-Specific Coaching (trend-driven) */}
      <div className="border rounded-lg mb-3 overflow-hidden">
        <button
          onClick={() => toggleSection('reps')}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            <span className="text-sm font-semibold text-gray-900">
              Rep-Specific Coaching
              {repsNeedingCoaching.length > 0 && <span className="ml-1 text-xs text-orange-600">({repsNeedingCoaching.length} rep{repsNeedingCoaching.length !== 1 ? 's' : ''} need attention)</span>}
            </span>
          </div>
          {expandedSection === 'reps' ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {expandedSection === 'reps' && (
          <div className="px-3 py-2 space-y-2">
            {repsNeedingCoaching.length === 0 ? (
              <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-2">
                {hasTrendData
                  ? 'All reps are trending stable or improving. Great team performance!'
                  : `All reps are scoring above ${LAGGING_THRESHOLD}%. Great team performance!`}
              </div>
            ) : (() => {
              // Group reps by their weakest KPI to avoid redundant action tips
              const grouped = [];
              const groupMap = new Map();
              repsNeedingCoaching.forEach(rep => {
                const groupKey = rep.weakestKpi?.key || '_none';
                if (!groupMap.has(groupKey)) {
                  groupMap.set(groupKey, []);
                  grouped.push(groupKey);
                }
                groupMap.get(groupKey).push(rep);
              });

              return grouped.map(groupKey => {
                const reps = groupMap.get(groupKey);
                const firstRep = reps[0];
                const kpiKey = firstRep.weakestKpi?.key;
                const groupLabel = kpiKey ? (KPI_GUIDANCE[kpiKey]?.title || buildLabel(kpiKey)) : null;
                const guidance = kpiKey ? KPI_GUIDANCE[kpiKey] : null;
                const tierColor = firstRep.weakestKpi ? (TIER_COLORS[firstRep.weakestKpi.tier] || TIER_COLORS[4]) : '';
                const tierLabel = firstRep.weakestKpi ? TIER_LABELS[firstRep.weakestKpi.tier] : '';
                const teamAvg = firstRep.teamAvgForWeakest;

                return (
                  <div key={groupKey} className="border rounded-lg overflow-hidden">
                    {/* Group header — shared KPI + action */}
                    {groupLabel && (
                      <div className="px-3 py-2 bg-orange-50 border-b">
                        <div className="flex items-center gap-2 mb-1">
                          <Target size={13} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-900">{groupLabel}</span>
                          {teamAvg != null && <span className="text-[10px] text-gray-500">({teamAvg}% team avg)</span>}
                          <span className={`text-[8px] px-1 py-0.5 rounded-full font-medium ${tierColor}`}>{tierLabel}</span>
                          <span className="text-[10px] text-orange-600 font-medium ml-auto">{reps.length} rep{reps.length !== 1 ? 's' : ''}</span>
                        </div>
                        {guidance && (
                          <div className="text-[11px] text-gray-600 bg-white rounded px-2 py-1.5 border border-gray-100">
                            <span className="font-medium text-gray-700">Action:</span> {guidance.tips[0]}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Individual rep rows */}
                    <div className="divide-y divide-gray-100">
                      {reps.map(rep => (
                        <div key={rep.repId} className="px-3 py-2.5 flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-bold flex-shrink-0 mt-0.5">
                            {(rep.name || '?')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-900 truncate">{rep.name}</span>
                              <span className="text-xs font-bold text-red-600">{rep.recent}%</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-[10px]">
                              <span className="text-gray-500">5-wk avg: <span className="font-medium text-gray-700">{rep.avg5w}%</span></span>
                              <span className={`font-medium ${rep.trendDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {rep.trendDelta >= 0 ? '↑' : '↓'} {rep.trendDelta > 0 ? '+' : ''}{rep.trendDelta}% trend
                              </span>
                              <span className={`font-medium ${rep.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {rep.delta >= 0 ? '+' : ''}{rep.delta}% vs last wk
                              </span>
                            </div>
                            {/* Peer comparison */}
                            {rep.deltaVsTeam != null && (
                              <div className="mt-0.5 text-[10px] text-gray-500">
                                <span className={`font-medium ${rep.deltaVsTeam < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {Math.abs(rep.deltaVsTeam)}% {rep.deltaVsTeam < 0 ? 'below' : 'above'} team avg
                                </span>
                                {rep.topPerformerForWeakest && (
                                  <span className="text-gray-400 ml-2">
                                    Top: {rep.topPerformerForWeakest.name.split(' ')[0]} ({rep.topPerformerForWeakest.percentage}%)
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Secondary weakness — differentiates reps within the group */}
                            {rep.secondWeakestKpi && (
                              <div className="mt-0.5 text-[10px] text-amber-600">
                                Also lagging: {rep.secondWeakestKpi.label} ({rep.secondWeakestKpi.percentage}%)
                              </div>
                            )}
                            {rep.strongestKpi && (
                              <div className="mt-0.5 text-[10px] text-emerald-600">
                                Strength: {rep.strongestKpi.label} ({rep.strongestKpi.percentage}%)
                                {rep.strongestKpi.teamAvg > 0 && rep.strongestKpi.percentage > rep.strongestKpi.teamAvg && (
                                  <span className="text-gray-400 ml-1">
                                    ({rep.strongestKpi.percentage - rep.strongestKpi.teamAvg}% above team avg)
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="mt-1.5 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setPrepRepId(rep.repId)}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                                >
                                  <CalendarCheck size={12} />
                                  Prep 1:1
                                </button>
                                {onBuildPlan && (
                                  <button
                                    onClick={() => onBuildPlan(rep.repId, repNames?.[rep.repId] || 'Rep')}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-50 transition-colors"
                                  >
                                    <FileText size={12} />
                                    Build Plan
                                  </button>
                                )}
                                {onStartReview && (
                                  <button
                                    onClick={() => onStartReview(rep.repId, repNames?.[rep.repId] || 'Rep')}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 border border-purple-200 rounded hover:bg-purple-50 transition-colors"
                                  >
                                    <ClipboardList size={12} />
                                    Start Review
                                  </button>
                                )}
                              </div>
                              <FeedbackThumb featureArea="playbook_insight" contentKey={`rep_${rep.repId}_${rep.weakestKpi?.key}`} context={{ type: 'rep_action' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Section 3: What Changed Recently (5-week trend) */}
      <div className="border rounded-lg mb-3 overflow-hidden">
        <button
          onClick={() => toggleSection('changes')}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            {recentChanges.length > 0 && recentChanges[0].delta >= 0
              ? <TrendingUp size={16} className="text-blue-500" />
              : <TrendingDown size={16} className="text-blue-500" />
            }
            <span className="text-sm font-semibold text-gray-900">What Changed Recently</span>
          </div>
          {expandedSection === 'changes' ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {expandedSection === 'changes' && (
          <div className="px-3 py-2">
            {recentChanges.length === 0 ? (
              <div className="text-xs text-gray-500 p-2">Need at least 2 weeks of data for trend comparison.</div>
            ) : (
              <div className="space-y-2">
                {recentChanges.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between text-xs border rounded p-2 ${item.type === 'team' ? 'bg-blue-50 border-blue-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${item.type === 'team' ? 'text-blue-900' : 'text-gray-900'}`}>{item.label}</span>
                      {item.type === 'team' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">Team</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{item.prior}%</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-gray-900">{item.current}%</span>
                      <span className={`font-bold ${item.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.delta >= 0 ? '+' : ''}{item.delta}%
                      </span>
                      {item.trend5w != null && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${item.trend5w >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          5wk: {item.trend5w >= 0 ? '+' : ''}{item.trend5w}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Priority Actions */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('priorities')}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-900">Priority Actions</span>
          </div>
          {expandedSection === 'priorities' ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {expandedSection === 'priorities' && (
          <div className="px-3 py-2">
            {priorities.length === 0 ? (
              <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded p-2">
                Team is performing well across the 5-week trend. Focus on consistency and celebrate wins.
              </div>
            ) : (
              <div className="space-y-1.5">
                {priorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-purple-500 font-bold mt-0.5">{i + 1}.</span>
                    <div>
                      <span className="font-medium text-gray-900">{p.text}</span>
                      <span className="text-gray-500"> — {p.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1:1 Meeting Prep Modal */}
      <Meeting1On1PrepModal
        isOpen={!!prepRepId}
        onClose={() => setPrepRepId(null)}
        repName={prepRep?.name || ''}
        repId={prepRepId}
        repAnalysis={prepRep}
        scorecardData={{ rows }}
        historicalScores={trendWeeks}
        repNames={names}
        scorecardKpiKeys={[...scKpiSet]}
        onBuildRepPlan={(repId, repName) => {
          setPrepRepId(null);
          onBuildPlan?.(repId, repName);
        }}
      />
    </div>
  );
}

/**
 * Exported helper: builds a structured summary of the playbook analysis
 * for use by AI coaching plan generation. Returns a plain object.
 * Now includes tier information for each weakness.
 */
export function buildPlaybookSummary(scorecardData, historicalScores, repNames, lastWeekScorecardData) {
  const currentRows = scorecardData?.rows || [];
  const lastWeekRows = lastWeekScorecardData?.rows || [];
  const trendWeeks = historicalScores || [];
  const names = repNames || {};
  const scKpiKeys = scorecardData?.scorecardKpiKeys || [];
  const scKpiSet = new Set(scKpiKeys);

  // Fall back to last week if current data is empty
  const currentAvg = currentRows.length > 0
    ? Math.round(currentRows.reduce((s, r) => s + (r.apptivityScore || 0), 0) / currentRows.length)
    : 0;
  const rows = (currentAvg < 5 && lastWeekRows.length > 0) ? lastWeekRows : currentRows;

  // Team weakness — now with tier
  const kpiKeys = rows[0]?.kpis ? Object.keys(rows[0].kpis) : [];
  const kpiStats = kpiKeys.map(key => {
    const percentages = rows.map(r => Number(r?.kpis?.[key]?.percentage || 0));
    const avg = percentages.length > 0
      ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
      : 0;
    const belowCount = rows.filter(r => Number(r?.kpis?.[key]?.percentage || 0) < LAGGING_THRESHOLD).length;
    const label = KPI_GUIDANCE[key]?.title || buildLabel(key);
    const tier = getKpiTier(key, scKpiSet);
    return { key, label, avgPercentage: avg, belowTargetCount: belowCount, tier };
  });
  const lagging = kpiStats.filter(k => k.avgPercentage < LAGGING_THRESHOLD).sort((a, b) => a.tier - b.tier || a.avgPercentage - b.avgPercentage);

  // Rep trends
  const repSummaries = [];
  if (trendWeeks.length >= 2) {
    const repIds = new Set();
    trendWeeks.forEach(wp => {
      Object.keys(wp).forEach(k => {
        if (k !== 'week' && k !== 'score' && typeof wp[k] === 'number') repIds.add(k);
      });
    });

    repIds.forEach(repId => {
      const scores = trendWeeks.map(wp => wp[repId]).filter(v => typeof v === 'number');
      if (scores.length < 2) return;
      const recent = scores[scores.length - 1];
      const oldest = scores[0];
      const avg5w = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      const trendDelta = recent - oldest;
      const name = names[repId] || repId.slice(0, 8);

      const repRow = rows.find(r => r.profile_id === repId);
      let weakestKpi = null;
      let peerComparison = null;
      if (repRow?.kpis) {
        const entries = Object.entries(repRow.kpis)
          .map(([k, v]) => ({ key: k, pct: Number(v?.percentage || 0), tier: getKpiTier(k, scKpiSet) }))
          .filter(k => k.pct < LAGGING_THRESHOLD)
          .sort((a, b) => a.tier - b.tier || a.pct - b.pct);
        if (entries.length > 0) weakestKpi = { key: entries[0].key, label: KPI_GUIDANCE[entries[0].key]?.title || buildLabel(entries[0].key), pct: Math.round(entries[0].pct) };

        // Peer comparison for weakest KPI
        if (weakestKpi) {
          const kpiStat = kpiStats.find(s => s.key === weakestKpi.key);
          const teamAvg = kpiStat?.avgPercentage || 0;
          const topPct = Math.max(...rows.map(r => Number(r?.kpis?.[weakestKpi.key]?.percentage || 0)));
          peerComparison = {
            teamAvg,
            deltaVsTeam: weakestKpi.pct - teamAvg,
            topPerformerPct: Math.round(topPct),
          };
        }
      }

      if (trendDelta < DECLINING_TREND_THRESHOLD || avg5w < LAGGING_THRESHOLD || recent < LAGGING_THRESHOLD) {
        repSummaries.push({ name, recent, avg5w, trendDelta, weakestKpi, peerComparison });
      }
    });
  }

  // Team trend
  let teamTrend = null;
  if (trendWeeks.length >= 2) {
    const latest = trendWeeks[trendWeeks.length - 1];
    const oldest = trendWeeks[0];
    teamTrend = { current: latest.score, oldest: oldest.score, delta: latest.score - oldest.score, weeks: trendWeeks.length };
  }

  return {
    teamWeaknesses: lagging.slice(0, 7).map(k => ({
      key: k.key,
      label: k.label,
      avgPct: k.avgPercentage,
      belowCount: k.belowTargetCount,
      totalReps: rows.length,
      tier: k.tier,
      tierLabel: TIER_LABELS[k.tier],
      diagnosis: KPI_GUIDANCE[k.key]?.diagnosis || null,
    })),
    repsNeedingCoaching: repSummaries.sort((a, b) => a.trendDelta - b.trendDelta).slice(0, 5),
    teamTrend,
    teamSize: rows.length,
  };
}
