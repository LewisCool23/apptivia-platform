import React, { useState, useMemo } from 'react';
import {
  DollarSign, AlertTriangle, TrendingUp, Calendar, ChevronDown,
  ChevronUp, Sparkles, Plus, ArrowRight, BarChart3, Clock,
  Target, Filter, RefreshCw, ExternalLink, User, X, Trash2
} from 'lucide-react';
import { usePipelineOperator } from '../hooks/usePipelineOperator';
import ConfirmModal from './ConfirmModal';

const STAGE_COLORS = {
  discovery: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  qualification: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  proposal: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  negotiation: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  closed_won: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed_lost: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

const FORECAST_BADGES = {
  commit: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  best_case: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pipeline: { bg: 'bg-gray-100', text: 'text-gray-600' },
  omitted: { bg: 'bg-red-100', text: 'text-red-600' },
};

function formatCurrency(value) {
  if (!value && value !== 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StageBadge({ stage }) {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.discovery;
  const label = stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

// ── Summary Cards ─────────────────────────────────────────

function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Pipeline',
      value: formatCurrency(summary.totalValue),
      sub: `${summary.dealCount} deals`,
      icon: DollarSign,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Weighted Value',
      value: formatCurrency(summary.weightedValue),
      sub: 'Probability-adjusted',
      icon: Target,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'At Risk',
      value: summary.atRiskCount,
      sub: formatCurrency(summary.atRiskValue),
      icon: AlertTriangle,
      color: summary.atRiskCount > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50',
    },
    {
      label: 'Closing This Month',
      value: summary.closingThisMonth,
      sub: formatCurrency(summary.closingThisMonthValue),
      icon: Calendar,
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
          <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Stage Funnel ──────────────────────────────────────────

function StageFunnel({ stageBreakdown }) {
  const stages = ['discovery', 'qualification', 'proposal', 'negotiation'];
  const maxValue = Math.max(...stages.map((s) => stageBreakdown[s]?.value || 0), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Pipeline Stages</h3>
      <div className="space-y-3">
        {stages.map((stage) => {
          const data = stageBreakdown[stage] || { count: 0, value: 0 };
          const pct = maxValue > 0 ? (data.value / maxValue) * 100 : 0;
          const colors = STAGE_COLORS[stage];
          return (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-gray-600 capitalize">
                {stage.replace(/_/g, ' ')}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${colors.dot} transition-all duration-500`}
                  style={{ width: `${Math.max(pct, 2)}%`, opacity: 0.7 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                  {data.count} deals · {formatCurrency(data.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Deal Table ────────────────────────────────────────────

function DealTable({ deals, onUpdateDeal, onDeleteDeal }) {
  const [sortField, setSortField] = useState('close_date');
  const [sortDir, setSortDir] = useState('asc');
  const [filterStage, setFilterStage] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, deal: null });

  const filteredDeals = useMemo(() => {
    let d = [...deals];
    if (filterStage !== 'all') d = d.filter((deal) => deal.stage === filterStage);
    d.sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    return d;
  }, [deals, filterStage, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, deal: null })}
        onConfirm={() => {
          if (deleteConfirm.deal) {
            onDeleteDeal(deleteConfirm.deal.id);
            setDeleteConfirm({ isOpen: false, deal: null });
          }
        }}
        title="Delete Deal?"
        message={`Are you sure you want to delete "${deleteConfirm.deal?.deal_name || 'this deal'}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Active Deals</h3>
        <div className="flex items-center gap-2">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">All Stages</option>
            <option value="discovery">Discovery</option>
            <option value="qualification">Qualification</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
          </select>
        </div>
      </div>

      {filteredDeals.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <DollarSign size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No deals found. Add deals or sync from your CRM.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-50 bg-gray-50/50">
                <th className="px-5 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('deal_name')}>
                  <div className="flex items-center gap-1">Deal <SortIcon field="deal_name" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('deal_value')}>
                  <div className="flex items-center gap-1">Value <SortIcon field="deal_value" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('close_date')}>
                  <div className="flex items-center gap-1">Close Date <SortIcon field="close_date" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('days_inactive')}>
                  <div className="flex items-center gap-1">Inactive <SortIcon field="days_inactive" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium">Forecast</th>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => {
                const fc = FORECAST_BADGES[deal.forecast_category] || FORECAST_BADGES.pipeline;
                return (
                  <tr key={deal.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{deal.deal_name}</span>
                        {deal.crm_url && (
                          <a href={deal.crm_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-900">{formatCurrency(deal.deal_value)}</td>
                    <td className="px-3 py-3"><StageBadge stage={deal.stage} /></td>
                    <td className="px-3 py-3 text-xs text-gray-600">{formatDate(deal.close_date)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-600 truncate max-w-[100px]">{deal.owner_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Clock size={12} className={deal.days_inactive >= 7 ? 'text-red-400' : 'text-gray-400'} />
                        <span className={`text-xs ${deal.days_inactive >= 7 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {deal.days_inactive}d
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fc.bg} ${fc.text}`}>
                        {deal.forecast_category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {deal.is_at_risk ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> At Risk
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, deal })}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete deal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── AI Forecast Panel ─────────────────────────────────────

function ForecastPanel({ forecast, onGenerate, loading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">AI Forecast</h3>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Analyzing...' : 'Generate Forecast'}
        </button>
      </div>

      {forecast ? (
        <div className="prose prose-sm max-w-none">
          <div className="bg-purple-50/50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {forecast}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <BarChart3 size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-xs text-gray-400">Click "Generate Forecast" to get an AI-powered pipeline analysis</p>
        </div>
      )}
    </div>
  );
}

// ── New Deal Modal ────────────────────────────────────────

function NewDealModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    deal_name: '',
    deal_value: '',
    stage: 'discovery',
    probability: 20,
    close_date: '',
    forecast_category: 'pipeline',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!form.deal_name || !form.deal_value) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        deal_name: form.deal_name,
        deal_value: parseFloat(form.deal_value),
        stage: form.stage,
        probability: form.probability,
        close_date: form.close_date || null,
        forecast_category: form.forecast_category,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to add deal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add New Deal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Name *</label>
            <input
              type="text"
              value={form.deal_name}
              onChange={(e) => setForm((f) => ({ ...f, deal_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Acme Corp — Enterprise License"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value ($) *</label>
              <input
                type="number"
                value={form.deal_value}
                onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="25000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Close Date</label>
              <input
                type="date"
                value={form.close_date}
                onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="discovery">Discovery</option>
                <option value="qualification">Qualification</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => setForm((f) => ({ ...f, probability: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Forecast Category</label>
            <select
              value={form.forecast_category}
              onChange={(e) => setForm((f) => ({ ...f, forecast_category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="commit">Commit</option>
              <option value="best_case">Best Case</option>
              <option value="pipeline">Pipeline</option>
              <option value="omitted">Omitted</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.deal_name || !form.deal_value || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function PipelineOperator({ organizationId, userId }) {
  const pipeline = usePipelineOperator(organizationId, userId);
  const [showNewDeal, setShowNewDeal] = useState(false);

  const handleRefresh = async () => {
    await pipeline.refreshAll();
  };

  return (
    <div className="space-y-4">
      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Pipeline Operator</h2>
          <p className="text-xs text-gray-500 mt-0.5">Monitor deals, flag risks, and generate AI-powered forecasts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={pipeline.refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={pipeline.refreshing ? 'animate-spin' : ''} />
            {pipeline.refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowNewDeal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            <Plus size={12} /> Add Deal
          </button>
        </div>
      </div>

      {/* Error */}
      {pipeline.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">
          {pipeline.error}
        </div>
      )}

      {/* Loading */}
      {pipeline.loading && !pipeline.deals.length ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-blue-400 mr-2" />
          <span className="text-sm text-gray-500">Loading pipeline...</span>
        </div>
      ) : (
        <>
          <SummaryCards summary={pipeline.summary} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <StageFunnel stageBreakdown={pipeline.summary.stageBreakdown} />
            </div>
            <div className="lg:col-span-2">
              <ForecastPanel
                forecast={pipeline.aiForecast}
                onGenerate={pipeline.generateForecast}
                loading={pipeline.loading}
              />
            </div>
          </div>

          <DealTable deals={pipeline.deals} onUpdateDeal={pipeline.updateDeal} onDeleteDeal={pipeline.deleteDeal} />
        </>
      )}

      {showNewDeal && (
        <NewDealModal onSave={pipeline.createDeal} onClose={() => setShowNewDeal(false)} />
      )}
    </div>
  );
}
