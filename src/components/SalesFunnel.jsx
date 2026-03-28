import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Info } from 'lucide-react';

const FUNNEL_STAGES = [
  { key: 'call_connects', label: 'Calls',         color: '#6366f1', shortLabel: 'Calls' },
  { key: 'meetings',      label: 'Meetings',       color: '#8b5cf6', shortLabel: 'Meetings' },
  { key: 'sourced_opps',  label: 'Sourced Opps',   color: '#a855f7', shortLabel: 'S. Opps' },
  { key: 'stage2_opps',   label: 'SQLs (Stage 2)', color: '#d946ef', shortLabel: 'SQLs' },
  { key: 'stage3_opps',   label: 'Stage 3 Opps',  color: '#ec4899', shortLabel: 'Stage 3' },
  { key: 'closed_won',    label: 'Closed Won',     color: '#f43f5e', shortLabel: 'Won' },
];

function conversionRate(from, to) {
  if (!from || from === 0) return null;
  return ((to / from) * 100).toFixed(1);
}

function BenchmarkDot({ actual, benchmark, label }) {
  if (benchmark == null) return null;
  const pct = actual != null && benchmark > 0 ? (actual / benchmark) * 100 : null;
  const color = pct == null ? '#6b7280' : pct >= 100 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
  const icon = pct == null ? null : pct >= 100 ? <TrendingUp size={10} /> : pct < 75 ? <TrendingDown size={10} /> : <Minus size={10} />;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded" style={{ background: color + '22', color }}>
      {icon}
      <span>{label}: {benchmark}</span>
    </span>
  );
}

function ConversionArrow({ fromValue, toValue, industryFrom, industryTo }) {
  const actual = conversionRate(fromValue, toValue);
  const industry = conversionRate(industryFrom, industryTo);
  if (actual == null) return (
    <div className="flex items-center justify-center py-1">
      <div className="w-px h-4 bg-gray-200" />
    </div>
  );
  const pct = industry ? parseFloat(actual) / parseFloat(industry) : null;
  const color = pct == null ? '#6b7280' : pct >= 1.0 ? '#10b981' : pct >= 0.75 ? '#f59e0b' : '#ef4444';
  const Icon = pct == null ? Minus : pct >= 1.0 ? TrendingUp : pct < 0.75 ? TrendingDown : Minus;
  return (
    <div className="flex flex-col items-center py-0.5 gap-0.5">
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color }} />
        <span className="text-sm font-semibold" style={{ color }}>{actual}%</span>
        {industry && (
          <span className="text-xs text-gray-400">vs {industry}% industry</span>
        )}
      </div>
      <svg width="2" height="12"><line x1="1" y1="0" x2="1" y2="12" stroke="#e5e7eb" strokeWidth="2" /></svg>
    </div>
  );
}

export default function SalesFunnel({ kpiValues = {}, benchmarks = {}, goals = {}, viewMode = 'team' }) {
  const [showBenchmarks, setShowBenchmarks] = useState(true);
  const [benchmarkType, setBenchmarkType] = useState('industry');

  // Max value for bar width scaling
  const maxValue = Math.max(...FUNNEL_STAGES.map(s => kpiValues[s.key] || 0), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Sales Funnel</h3>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
            {viewMode === 'team' ? 'Team Total' : 'Per Rep Avg'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Benchmark type selector */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
            {['industry', 'top_quartile', 'goal'].map(type => (
              <button
                key={type}
                onClick={() => setBenchmarkType(type)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  benchmarkType === type
                    ? 'bg-white text-gray-800 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {type === 'industry' ? 'Industry' : type === 'top_quartile' ? 'Top 25%' : 'Goal'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBenchmarks(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            Benchmarks {showBenchmarks ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Funnel stages */}
      <div className="space-y-0">
        {FUNNEL_STAGES.map((stage, i) => {
          const value = kpiValues[stage.key] ?? null;
          const goal = goals[stage.key];
          const benchmark = benchmarkType === 'goal' ? goal : benchmarks[stage.key]?.[benchmarkType];
          const barPct = value != null ? Math.min((value / maxValue) * 100, 100) : 0;
          // Width tapers: top stage is full width, each subsequent is slightly narrower
          const taperPct = 100 - (i * 8);
          const prevStage = i > 0 ? FUNNEL_STAGES[i - 1] : null;
          const prevValue = prevStage ? (kpiValues[prevStage.key] ?? null) : null;
          const prevBenchmark = prevStage
            ? (benchmarkType === 'goal' ? goals[prevStage.key] : benchmarks[prevStage.key]?.[benchmarkType])
            : null;

          return (
            <div key={stage.key}>
              {/* Conversion arrow between stages */}
              {i > 0 && (
                <div style={{ paddingLeft: `${(100 - taperPct) / 2}%`, paddingRight: `${(100 - taperPct) / 2}%` }}>
                  <ConversionArrow
                    fromValue={prevValue}
                    toValue={value}
                    industryFrom={benchmarkType === 'industry' ? benchmarks[prevStage.key]?.industry : undefined}
                    industryTo={benchmarkType === 'industry' ? benchmarks[stage.key]?.industry : undefined}
                  />
                </div>
              )}

              {/* Stage bar */}
              <div
                className="relative rounded-lg overflow-hidden"
                style={{
                  marginLeft: `${(100 - taperPct) / 2}%`,
                  marginRight: `${(100 - taperPct) / 2}%`,
                }}
              >
                {/* Background track */}
                <div className="relative h-14 bg-gray-50 rounded-lg flex items-center px-4 overflow-hidden">
                  {/* Fill bar */}
                  <div
                    className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700"
                    style={{
                      width: `${barPct}%`,
                      background: `linear-gradient(90deg, ${stage.color}33, ${stage.color}55)`,
                    }}
                  />
                  {/* Goal marker line */}
                  {goal != null && maxValue > 0 && (
                    <div
                      className="absolute top-1 bottom-1 w-0.5 rounded-full bg-gray-400 opacity-50"
                      style={{ left: `${Math.min((goal / maxValue) * 100, 100)}%` }}
                      title={`Goal: ${goal}`}
                    />
                  )}
                  {/* Content */}
                  <div className="relative flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: stage.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {showBenchmarks && benchmark != null && (
                        <BenchmarkDot
                          actual={value}
                          benchmark={benchmark}
                          label={benchmarkType === 'industry' ? 'Ind.' : benchmarkType === 'top_quartile' ? 'Top 25%' : 'Goal'}
                        />
                      )}
                      <span className="text-base font-bold text-gray-900" style={{ minWidth: '2.5rem', textAlign: 'right' }}>
                        {value != null ? value.toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-gray-50 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-gray-400 opacity-50" />
          <span>Goal marker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={11} className="text-emerald-500" />
          <span className="text-emerald-600">At/above benchmark</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus size={11} className="text-amber-500" />
          <span className="text-amber-600">75–99% of benchmark</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown size={11} className="text-red-500" />
          <span className="text-red-600">Below 75% of benchmark</span>
        </div>
      </div>
    </div>
  );
}
