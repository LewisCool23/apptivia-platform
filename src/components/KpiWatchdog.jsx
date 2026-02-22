import React, { useState, useMemo } from 'react';
import {
  Shield, AlertTriangle, TrendingDown, TrendingUp, Zap, RefreshCw,
  ChevronDown, Eye, CheckCircle, XCircle, ArrowDown, ArrowUp,
  Sparkles, BarChart3, Activity, Users, Filter, Clock
} from 'lucide-react';
import { useKpiWatchdog } from '../hooks/useKpiWatchdog';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: AlertTriangle, iconColor: 'text-red-500' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle, iconColor: 'text-amber-500' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: Activity, iconColor: 'text-blue-500' },
};

const ANOMALY_TYPE_LABELS = {
  drop: { label: 'Performance Drop', icon: TrendingDown, color: 'text-red-600' },
  spike: { label: 'Performance Spike', icon: TrendingUp, color: 'text-emerald-600' },
  stagnation: { label: 'Stagnation', icon: Activity, color: 'text-amber-600' },
  streak_break: { label: 'Streak Break', icon: Zap, color: 'text-purple-600' },
};

const STATUS_STYLES = {
  active: { bg: 'bg-red-50', text: 'text-red-700', label: 'Active' },
  acknowledged: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Acknowledged' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Resolved' },
  dismissed: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Dismissed' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Summary Cards ─────────────────────────────────────────

function WatchdogSummary({ summary }) {
  const cards = [
    {
      label: 'Active Anomalies',
      value: summary.activeAnomalies,
      icon: Shield,
      color: summary.activeAnomalies > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Critical',
      value: summary.criticalCount,
      icon: AlertTriangle,
      color: summary.criticalCount > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Warnings',
      value: summary.warningCount,
      icon: AlertTriangle,
      color: summary.warningCount > 0 ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Affected Reps',
      value: summary.affectedReps,
      icon: Users,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">{card.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
              <card.icon size={16} />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Analysis Progress ─────────────────────────────────────

function AnalysisProgress({ steps, isAnalyzing }) {
  if (steps.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        {isAnalyzing ? (
          <RefreshCw size={14} className="text-blue-500 animate-spin" />
        ) : (
          <CheckCircle size={14} className="text-emerald-500" />
        )}
        <h3 className="text-sm font-semibold text-gray-700">
          {isAnalyzing ? 'Analysis in Progress...' : 'Analysis Complete'}
        </h3>
      </div>
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
              i < steps.length - 1 || !isAnalyzing
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-blue-100 text-blue-600'
            }`}>
              {i < steps.length - 1 || !isAnalyzing ? (
                <CheckCircle size={10} />
              ) : (
                <RefreshCw size={10} className="animate-spin" />
              )}
            </div>
            <span className="text-xs text-gray-600">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Anomaly Card ──────────────────────────────────────────

function AnomalyCard({ anomaly, onAcknowledge, onDismiss, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const severity = SEVERITY_STYLES[anomaly.severity] || SEVERITY_STYLES.info;
  const anomalyType = ANOMALY_TYPE_LABELS[anomaly.anomaly_type] || ANOMALY_TYPE_LABELS.drop;
  const statusStyle = STATUS_STYLES[anomaly.status] || STATUS_STYLES.active;
  const TypeIcon = anomalyType.icon;
  const SevIcon = severity.icon;

  return (
    <div className={`rounded-xl border p-4 ${severity.bg} ${severity.border} hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-3">
        {/* Severity icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60`}>
          <SevIcon size={18} className={severity.iconColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900">{anomaly.kpi_name}</h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${severity.badge}`}>
              {anomaly.severity.toUpperCase()}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-xs text-gray-600 flex items-center gap-1">
              <Users size={10} /> {anomaly.profile_name}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} /> Detected {timeAgo(anomaly.detected_at)}
            </span>
          </div>

          {/* Deviation indicator */}
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Current:</span>
              <span className="text-sm font-bold text-gray-900">{anomaly.current_value}</span>
            </div>
            <div className="flex items-center gap-1">
              {anomaly.deviation_pct < 0 ? (
                <ArrowDown size={14} className="text-red-500" />
              ) : (
                <ArrowUp size={14} className="text-emerald-500" />
              )}
              <span className={`text-sm font-bold ${anomaly.deviation_pct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {Math.abs(anomaly.deviation_pct).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Rolling Avg:</span>
              <span className="text-sm text-gray-700">{anomaly.rolling_avg}</span>
            </div>
          </div>

          {/* AI Insights */}
          {(anomaly.ai_analysis || anomaly.ai_recommendation) && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-purple-600 font-medium flex items-center gap-1 hover:text-purple-800"
              >
                <Sparkles size={10} />
                {expanded ? 'Hide AI Analysis' : 'View AI Analysis'}
                <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="mt-2 bg-white/60 rounded-lg p-3 space-y-2">
                  {anomaly.ai_analysis && (
                    <div>
                      <span className="text-[10px] font-medium text-purple-600 uppercase">Analysis</span>
                      <p className="text-xs text-gray-700">{anomaly.ai_analysis}</p>
                    </div>
                  )}
                  {anomaly.ai_recommendation && (
                    <div>
                      <span className="text-[10px] font-medium text-purple-600 uppercase">Coaching Recommendation</span>
                      <p className="text-xs text-gray-700">{anomaly.ai_recommendation}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {anomaly.status === 'active' && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button
              onClick={() => onAcknowledge(anomaly.id)}
              className="p-1.5 rounded-lg bg-white/80 text-yellow-600 hover:bg-yellow-100 transition-colors"
              title="Acknowledge"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={() => onResolve(anomaly.id)}
              className="p-1.5 rounded-lg bg-white/80 text-emerald-600 hover:bg-emerald-100 transition-colors"
              title="Mark resolved"
            >
              <CheckCircle size={14} />
            </button>
            <button
              onClick={() => onDismiss(anomaly.id)}
              className="p-1.5 rounded-lg bg-white/80 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Dismiss"
            >
              <XCircle size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Breakdown ─────────────────────────────────────────

function KpiBreakdown({ byKpi }) {
  const entries = Object.entries(byKpi).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Anomalies by KPI</h3>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              count >= 5 ? 'bg-red-100 text-red-700' :
              count >= 2 ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function KpiWatchdog({ organizationId, userId }) {
  const watchdog = useKpiWatchdog(organizationId, userId);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');

  const filteredAnomalies = useMemo(() => {
    return watchdog.anomalies.filter((a) => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterStatus !== 'all' && a.status !== filterStatus) return false;
      return true;
    });
  }, [watchdog.anomalies, filterSeverity, filterStatus]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">KPI Anomaly Watchdog</h2>
          <p className="text-xs text-gray-500 mt-0.5">Automatically detect KPI drops, trigger coaching recommendations, and track resolution</p>
        </div>
        <button
          onClick={watchdog.runAnalysis}
          disabled={watchdog.isAnalyzing}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-amber-500 text-white hover:from-red-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-sm"
        >
          {watchdog.isAnalyzing ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
          {watchdog.isAnalyzing ? 'Analyzing...' : 'Run KPI Analysis'}
        </button>
      </div>

      {/* Error */}
      {watchdog.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">
          {watchdog.error}
        </div>
      )}

      {/* Analysis Progress */}
      <AnalysisProgress steps={watchdog.analysisProgress} isAnalyzing={watchdog.isAnalyzing} />

      {/* Summary */}
      <WatchdogSummary summary={watchdog.summary} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Anomaly Feed */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-gray-400" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {/* Anomaly List */}
          {watchdog.loading && !watchdog.anomalies.length ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-blue-400 mr-2" />
              <span className="text-sm text-gray-500">Loading anomalies...</span>
            </div>
          ) : filteredAnomalies.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
              <Shield size={32} className="mx-auto text-emerald-300 mb-3" />
              <p className="text-sm text-gray-500 mb-1">
                {watchdog.anomalies.length === 0 ? 'No anomalies detected' : 'No anomalies match current filters'}
              </p>
              <p className="text-xs text-gray-400">
                {watchdog.anomalies.length === 0
                  ? 'Click "Run KPI Analysis" to scan for performance drops and anomalies'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAnomalies.map((anomaly) => (
                <AnomalyCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  onAcknowledge={(id) => watchdog.updateAnomalyStatus(id, 'acknowledged')}
                  onResolve={(id) => watchdog.updateAnomalyStatus(id, 'resolved')}
                  onDismiss={(id) => watchdog.dismissAnomaly(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <KpiBreakdown byKpi={watchdog.summary.byKpi} />

          {/* Quick Info */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">How It Works</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">1</span>
                </div>
                <p className="text-xs text-gray-600">Compares current week KPI values against 4-week rolling average</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">2</span>
                </div>
                <p className="text-xs text-gray-600">Flags drops &gt;20% as warnings, &gt;50% as critical anomalies</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">3</span>
                </div>
                <p className="text-xs text-gray-600">AI generates analysis and coaching recommendations for each anomaly</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">4</span>
                </div>
                <p className="text-xs text-gray-600">Track, acknowledge, and resolve anomalies to maintain team performance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
