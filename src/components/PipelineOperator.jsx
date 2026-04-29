import React, { useState, useMemo } from 'react';
import {
  DollarSign, AlertTriangle, TrendingUp, Calendar, ChevronDown,
  ChevronUp, Sparkles, Plus, ArrowRight, BarChart3, Clock,
  Target, Filter, RefreshCw, ExternalLink, User, X, Trash2,
  CheckSquare, Square, AlertCircle, Layers
} from 'lucide-react';
import { usePipelineOperator } from '../hooks/usePipelineOperator';
import { useCepConfig } from '../hooks/useCepConfig';
import ConfirmModal from './ConfirmModal';

// ── Legacy stage colors (fallback when no CEP) ──────────────

const STAGE_COLORS = {
  discovery: { bg: 'bg-apptivia-coral-tone-50', text: 'text-blue-700', dot: 'bg-apptivia-coral' },
  qualification: { bg: 'bg-apptivia-carbon-100', text: 'text-indigo-700', dot: 'bg-apptivia-ink' },
  proposal: { bg: 'bg-apptivia-carbon-100', text: 'text-purple-700', dot: 'bg-apptivia-ink' },
  negotiation: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  closed_won: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed_lost: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

const FORECAST_BADGES = {
  commit: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  best_case: { bg: 'bg-apptivia-coral-tone-50', text: 'text-blue-700' },
  pipeline: { bg: 'bg-apptivia-carbon-100', text: 'text-gray-600' },
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

// ── Stage Badge (dynamic CEP or legacy) ─────────────────────

function StageBadge({ stage, cepStages }) {
  const cepStage = cepStages?.find(s => s.stage_key === stage);
  if (cepStage) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ backgroundColor: cepStage.color + '1a', color: cepStage.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cepStage.color }} />
        {cepStage.stage_name}
      </span>
    );
  }
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
      sub: `${summary.dealCount} ${summary.dealCount === 1 ? 'deal' : 'deals'}`,
      icon: DollarSign,
      color: 'text-blue-600 bg-apptivia-coral-tone-50',
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
      color: summary.atRiskCount > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-apptivia-paper',
    },
    {
      label: 'Closing This Month',
      value: summary.closingThisMonth,
      sub: formatCurrency(summary.closingThisMonthValue),
      icon: Calendar,
      color: 'text-purple-600 bg-apptivia-carbon-100',
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

// ── Stage Funnel (dynamic CEP or legacy) ─────────────────────

function StageFunnel({ stageBreakdown, cepStages }) {
  const stages = cepStages && cepStages.length > 0
    ? cepStages.filter(s => !s.is_terminal)
    : [
        { stage_key: 'discovery', stage_name: 'Discovery', color: '#3b82f6', win_probability: null },
        { stage_key: 'qualification', stage_name: 'Qualification', color: '#6366f1', win_probability: null },
        { stage_key: 'proposal', stage_name: 'Proposal', color: '#8b5cf6', win_probability: null },
        { stage_key: 'negotiation', stage_name: 'Negotiation', color: '#f59e0b', win_probability: null },
      ];

  const maxValue = Math.max(...stages.map((s) => stageBreakdown[s.stage_key]?.value || 0), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {cepStages?.length > 0 ? 'CEP Stages' : 'Pipeline Stages'}
      </h3>
      <div className="space-y-3">
        {stages.map((stageObj) => {
          const key = stageObj.stage_key;
          const data = stageBreakdown[key] || { count: 0, value: 0 };
          const pct = maxValue > 0 ? (data.value / maxValue) * 100 : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-24 text-xs font-medium text-gray-600 truncate">
                {stageObj.stage_name}
              </div>
              <div className="flex-1 bg-apptivia-carbon-100 rounded-full h-6 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stageObj.color, opacity: 0.7 }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                  {data.count} deals · {formatCurrency(data.value)}
                </span>
              </div>
              {stageObj.win_probability != null && (
                <span className="text-[10px] text-gray-400 w-8 text-right">{stageObj.win_probability}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CEP Progress Badge ───────────────────────────────────────

function CepProgressBadge({ deal, cepStages }) {
  const dealStage = deal.currentCepDealStage;
  if (!dealStage) return <span className="text-xs text-gray-400">-</span>;

  const stage = cepStages.find(s => s.id === dealStage.cep_stage_id);
  if (!stage) return <span className="text-xs text-gray-400">-</span>;

  const checklistItems = stage.checklist_items || [];
  const completed = checklistItems.filter(item => dealStage.checklist_completed?.[item.key]).length;
  const total = checklistItems.length;

  if (total === 0) return <span className="text-[10px] text-gray-400">No items</span>;

  const pct = Math.round((completed / total) * 100);
  const allRequiredMet = checklistItems
    .filter(item => item.required)
    .every(item => dealStage.checklist_completed?.[item.key]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 bg-apptivia-carbon-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: allRequiredMet ? '#10b981' : '#f59e0b' }}
        />
      </div>
      <span className="text-[10px] text-gray-500">{completed}/{total}</span>
      {allRequiredMet && checklistItems.some(i => i.required) && (
        <CheckSquare size={10} className="text-emerald-500" />
      )}
    </div>
  );
}

// ── CEP Deal Detail Panel ────────────────────────────────────

function DealCepPanel({ deal, cepStages, onClose, onAdvance, onUpdateChecklist, onAssignStage }) {
  const currentStage = cepStages.find(s => s.id === deal.cep_stage_id);
  const dealStageData = deal.currentCepDealStage;

  // All hooks must be called unconditionally (React rules of hooks)
  const [checklist, setChecklist] = useState(dealStageData?.checklist_completed || {});

  // If deal has no CEP stage, show assign prompt
  if (!currentStage || !dealStageData) {
    const nonTerminal = cepStages.filter(s => !s.is_terminal);
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Assign CEP Stage</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">This deal hasn't been assigned to a CEP stage yet.</p>
        <div className="space-y-1.5">
          {nonTerminal.map(s => (
            <button
              key={s.id}
              onClick={() => onAssignStage(deal.id, s.id, s.stage_key, s.win_probability)}
              className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-apptivia-paper transition-colors border border-gray-100"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs font-medium text-gray-700">{s.stage_name}</span>
              <span className="text-[10px] text-gray-400 ml-auto">{s.win_probability}%</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const nextStage = cepStages.find(s => s.stage_order === currentStage.stage_order + 1 && !s.is_terminal);
  const terminalWon = cepStages.find(s => s.stage_key === 'closed_won');
  const terminalLost = cepStages.find(s => s.stage_key === 'closed_lost');

  const toggleCheck = (key) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    onUpdateChecklist(dealStageData.id, updated);
  };

  const requiredItems = (currentStage.checklist_items || []).filter(i => i.required);
  const allRequiredMet = requiredItems.every(i => checklist[i.key]);

  const daysInStage = dealStageData.entered_at
    ? Math.floor((Date.now() - new Date(dealStageData.entered_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const overExpected = currentStage.expected_days && daysInStage > currentStage.expected_days;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">{deal.deal_name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>

      {/* Stage stepper — clickable to move deal to any stage */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {cepStages.filter(s => !s.is_terminal).map((s, i) => {
          const isCurrent = s.id === currentStage.id;
          const isPast = s.stage_order < currentStage.stage_order;
          const canClick = !isCurrent && !currentStage.is_terminal;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />}
              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onAdvance(deal.id, currentStage.id, s.id, s.stage_key, s.win_probability)}
                className={`text-[10px] px-2 py-1 rounded-full flex-shrink-0 font-medium whitespace-nowrap transition-all ${
                  isCurrent ? 'ring-2 ring-offset-1' : ''
                } ${canClick ? 'cursor-pointer hover:brightness-90' : ''}`}
                style={{
                  backgroundColor: s.color + (isPast ? '30' : isCurrent ? '25' : '10'),
                  color: isPast || isCurrent ? s.color : s.color + '80',
                  ...(isCurrent ? { '--tw-ring-color': s.color } : {}),
                }}
                title={canClick ? `Move to ${s.stage_name}` : s.stage_name}
              >
                {s.stage_name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Days in stage */}
      <div className="flex items-center gap-2">
        <Clock size={12} className={overExpected ? 'text-red-500' : 'text-gray-400'} />
        <span className={`text-xs ${overExpected ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {daysInStage}d in stage
          {currentStage.expected_days ? ` (expected: ${currentStage.expected_days}d)` : ''}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto">Win prob: {currentStage.win_probability}%</span>
      </div>

      {/* Checklist */}
      {currentStage.checklist_items?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Stage Checklist</h4>
          <div className="space-y-1">
            {currentStage.checklist_items.map(item => (
              <button
                key={item.key}
                onClick={() => toggleCheck(item.key)}
                className="flex items-center gap-2 w-full text-left p-1.5 rounded hover:bg-apptivia-paper transition-colors"
              >
                {checklist[item.key]
                  ? <CheckSquare size={14} className="text-emerald-500 flex-shrink-0" />
                  : <Square size={14} className="text-gray-300 flex-shrink-0" />
                }
                <span className={`text-xs ${checklist[item.key] ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                  {item.label}
                  {item.required && <span className="text-red-400 ml-1">*</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exit Criteria */}
      {currentStage.exit_criteria?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Exit Criteria</h4>
          <div className="space-y-1 text-xs text-gray-600">
            {currentStage.exit_criteria.map(ec => (
              <div key={ec.key} className="flex items-center gap-1.5">
                <Target size={10} className="text-gray-400" />
                {ec.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Responsibilities */}
      {currentStage.role_responsibilities?.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Role Responsibilities</h4>
          <div className="space-y-1">
            {currentStage.role_responsibilities.map((rr, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="font-semibold text-blue-600 bg-apptivia-coral-tone-50 px-1.5 py-0.5 rounded">{rr.title}</span>
                <span className="text-gray-600">{rr.responsibility}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advance / Terminal actions */}
      {!currentStage.is_terminal && (
        <div className="space-y-2 pt-1">
          {!allRequiredMet && requiredItems.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <AlertCircle size={12} />
              <span className="text-xs">Required items incomplete. You can still advance.</span>
            </div>
          )}
          {nextStage && (
            <button
              onClick={() => onAdvance(deal.id, currentStage.id, nextStage.id, nextStage.stage_key, nextStage.win_probability)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-apptivia-coral text-white hover:bg-apptivia-coral transition-colors"
            >
              Advance to {nextStage.stage_name} <ArrowRight size={12} />
            </button>
          )}
          <div className="flex gap-2">
            {terminalWon && (
              <button
                onClick={() => onAdvance(deal.id, currentStage.id, terminalWon.id, terminalWon.stage_key, terminalWon.win_probability)}
                className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                Mark Won
              </button>
            )}
            {terminalLost && (
              <button
                onClick={() => onAdvance(deal.id, currentStage.id, terminalLost.id, terminalLost.stage_key, terminalLost.win_probability)}
                className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Mark Lost
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deal Table ────────────────────────────────────────────

function DealTable({ deals, onUpdateDeal, onDeleteDeal, cepStages, hasCep, selectedDealId, onSelectDeal }) {
  const [sortField, setSortField] = useState('close_date');
  const [sortDir, setSortDir] = useState('asc');
  const [filterStage, setFilterStage] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, deal: null });

  const stageOptions = useMemo(() => {
    if (cepStages && cepStages.length > 0) {
      return cepStages.filter(s => !s.is_terminal).map(s => ({ key: s.stage_key, label: s.stage_name }));
    }
    return [
      { key: 'discovery', label: 'Discovery' },
      { key: 'qualification', label: 'Qualification' },
      { key: 'proposal', label: 'Proposal' },
      { key: 'negotiation', label: 'Negotiation' },
    ];
  }, [cepStages]);

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
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Active Deals</h3>
        <div className="flex items-center gap-2">
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">All Stages</option>
            {stageOptions.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
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
              <tr className="text-xs text-gray-500 border-b border-gray-50 bg-apptivia-paper/50">
                <th className="px-5 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('deal_name')}>
                  <div className="flex items-center gap-1">Deal <SortIcon field="deal_name" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium cursor-pointer" onClick={() => toggleSort('deal_value')}>
                  <div className="flex items-center gap-1">Value <SortIcon field="deal_value" /></div>
                </th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                {hasCep && <th className="px-3 py-2.5 font-medium">Progress</th>}
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
                  <tr
                    key={deal.id}
                    className={`border-b border-gray-50 hover:bg-apptivia-coral-tone-50/30 transition-colors ${
                      hasCep ? 'cursor-pointer' : ''
                    } ${selectedDealId === deal.id ? 'bg-apptivia-coral-tone-50/50' : ''}`}
                    onClick={() => hasCep && onSelectDeal(deal)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{deal.deal_name}</span>
                        {deal.crm_url && (
                          <a href={deal.crm_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500" onClick={e => e.stopPropagation()}>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-900">{formatCurrency(deal.deal_value)}</td>
                    <td className="px-3 py-3"><StageBadge stage={deal.stage} cepStages={cepStages} /></td>
                    {hasCep && (
                      <td className="px-3 py-3">
                        {deal.cep_stage_id
                          ? <CepProgressBadge deal={deal} cepStages={cepStages} />
                          : <span className="text-[10px] text-amber-500 font-medium">Assign</span>
                        }
                      </td>
                    )}
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
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, deal }); }}
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
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-apptivia-carbon-100 text-purple-600 hover:bg-apptivia-carbon-100 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Analyzing...' : 'Generate Forecast'}
        </button>
      </div>

      {forecast ? (
        <div className="prose prose-sm max-w-none">
          <div className="bg-apptivia-carbon-100/50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
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

function NewDealModal({ onSave, onClose, cepStages }) {
  const stageOptions = useMemo(() => {
    if (cepStages && cepStages.length > 0) {
      return cepStages.filter(s => !s.is_terminal);
    }
    return [
      { stage_key: 'discovery', stage_name: 'Discovery', win_probability: 20 },
      { stage_key: 'qualification', stage_name: 'Qualification', win_probability: 40 },
      { stage_key: 'proposal', stage_name: 'Proposal', win_probability: 60 },
      { stage_key: 'negotiation', stage_name: 'Negotiation', win_probability: 80 },
    ];
  }, [cepStages]);

  const defaultStage = stageOptions[0]?.stage_key || 'discovery';
  const defaultProb = stageOptions[0]?.win_probability ?? 20;

  const [form, setForm] = useState({
    deal_name: '',
    deal_value: '',
    stage: defaultStage,
    probability: defaultProb,
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add New Deal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

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
                onChange={(e) => {
                  const sel = stageOptions.find(s => s.stage_key === e.target.value);
                  setForm(f => ({
                    ...f,
                    stage: e.target.value,
                    probability: sel?.win_probability ?? f.probability,
                  }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {stageOptions.map(s => (
                  <option key={s.stage_key} value={s.stage_key}>{s.stage_name}</option>
                ))}
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
              className="px-4 py-2 text-gray-700 bg-apptivia-carbon-100 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.deal_name || !form.deal_value || saving}
              className="px-4 py-2 bg-apptivia-coral text-white rounded-md hover:bg-apptivia-coral transition-colors disabled:opacity-50"
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
  const cepConfig = useCepConfig(organizationId);
  const pipeline = usePipelineOperator(organizationId, userId, cepConfig.activeStages);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);

  const hasCep = cepConfig.hasCep;

  // Keep selectedDeal in sync with refreshed deal data
  const resolvedSelectedDeal = useMemo(() => {
    if (!selectedDeal) return null;
    return pipeline.deals.find(d => d.id === selectedDeal.id) || null;
  }, [selectedDeal, pipeline.deals]);

  const handleRefresh = async () => {
    await pipeline.refreshAll();
  };

  return (
    <div className="space-y-4">
      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            Pipeline Operator
            {hasCep && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-apptivia-carbon-100 px-2 py-0.5 rounded-full">
                <Layers size={10} /> CEP Active
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Monitor deals, flag risks, and generate AI-powered forecasts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={pipeline.refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-apptivia-paper transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={pipeline.refreshing ? 'animate-spin' : ''} />
            {pipeline.refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowNewDeal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-apptivia-coral text-white hover:bg-apptivia-coral transition-colors"
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
              <StageFunnel stageBreakdown={pipeline.summary.stageBreakdown} cepStages={cepConfig.activeStages} />
            </div>
            <div className="lg:col-span-2">
              {resolvedSelectedDeal && hasCep ? (
                <DealCepPanel
                  deal={resolvedSelectedDeal}
                  cepStages={cepConfig.activeStages}
                  onClose={() => setSelectedDeal(null)}
                  onAdvance={pipeline.advanceDealStage}
                  onUpdateChecklist={pipeline.updateDealChecklist}
                  onAssignStage={pipeline.assignCepStage}
                />
              ) : (
                <ForecastPanel
                  forecast={pipeline.aiForecast}
                  onGenerate={pipeline.generateForecast}
                  loading={pipeline.loading}
                />
              )}
            </div>
          </div>

          <DealTable
            deals={pipeline.deals}
            onUpdateDeal={pipeline.updateDeal}
            onDeleteDeal={pipeline.deleteDeal}
            cepStages={cepConfig.activeStages}
            hasCep={hasCep}
            selectedDealId={selectedDeal?.id}
            onSelectDeal={setSelectedDeal}
          />
        </>
      )}

      {showNewDeal && (
        <NewDealModal
          onSave={pipeline.createDeal}
          onClose={() => setShowNewDeal(false)}
          cepStages={cepConfig.activeStages}
        />
      )}
    </div>
  );
}
