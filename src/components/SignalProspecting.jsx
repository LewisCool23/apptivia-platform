import React, { useState, useMemo } from 'react';
import {
  Radar, Zap, AlertTriangle, TrendingUp, Search, RefreshCw,
  Eye, EyeOff, CheckCircle, XCircle, ExternalLink, Sparkles, Filter,
  ChevronDown, Target, Building2, Briefcase, DollarSign,
  Newspaper, Settings, Plus, X, Users, UserCheck, Rocket,
  Trophy, Mic, Star, Megaphone, TrendingDown, Layers, Trash2
} from 'lucide-react';
import { useSignalProspecting } from '../hooks/useSignalProspecting';
import ConfirmModal from './ConfirmModal';

const SIGNAL_ICONS = {
  // === BUYER INTENT (Highest Value) ===
  solution_search: { icon: Search, color: 'text-emerald-600 bg-emerald-50' },
  pain_point: { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
  icp_job_posting: { icon: Users, color: 'text-blue-600 bg-blue-50' },
  tech_stack_churn: { icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
  competitor_comparison: { icon: Target, color: 'text-amber-600 bg-amber-50' },
  competitor_complaint: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  
  // === COMPETITIVE INTELLIGENCE ===
  competitor_engagement: { icon: Target, color: 'text-red-600 bg-red-50' },
  
  // === COMPANY EVENTS ===
  funding: { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  leadership_change: { icon: UserCheck, color: 'text-indigo-600 bg-indigo-50' },
  expansion: { icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  layoffs: { icon: TrendingDown, color: 'text-rose-600 bg-rose-50' },
  contract_win: { icon: Trophy, color: 'text-yellow-600 bg-yellow-50' },
  product_launch: { icon: Rocket, color: 'text-pink-600 bg-pink-50' },
  
  // === ENGAGEMENT ===
  hiring: { icon: Building2, color: 'text-purple-600 bg-purple-50' },
  job_change: { icon: Briefcase, color: 'text-blue-600 bg-blue-50' },
  content_engagement: { icon: Newspaper, color: 'text-amber-600 bg-amber-50' },
  event_participation: { icon: Mic, color: 'text-violet-600 bg-violet-50' },
  review_sentiment: { icon: Star, color: 'text-orange-600 bg-orange-50' },
  press_release: { icon: Megaphone, color: 'text-sky-600 bg-sky-50' },
  tech_adoption: { icon: Settings, color: 'text-cyan-600 bg-cyan-50' },
};

const STRENGTH_COLORS = {
  very_high: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

const STATUS_STYLES = {
  new: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New' },
  reviewed: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Reviewed' },
  actioned: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Actioned' },
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

function SignalSummaryCards({ summary }) {
  const cards = [
    { label: 'Total Signals', value: summary.totalSignals, icon: Radar, color: 'text-blue-600 bg-blue-50' },
    { label: 'New (Unreviewed)', value: summary.newSignals, icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { label: 'High Intent', value: summary.highIntentCount, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Companies Tracked', value: summary.topCompanies.length, icon: Building2, color: 'text-purple-600 bg-purple-50' },
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

// ── Buying Stage Funnel ──────────────────────────────────

function BuyingStageFunnel({ byBuyingStage = {} }) {
  const total = (byBuyingStage.awareness || 0) + (byBuyingStage.consideration || 0) + (byBuyingStage.decision || 0);
  if (total === 0) return null;

  const stages = [
    { key: 'awareness', label: 'Awareness', color: 'bg-sky-500', bgColor: 'bg-sky-50', textColor: 'text-sky-700' },
    { key: 'consideration', label: 'Consideration', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
    { key: 'decision', label: 'Decision', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={16} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Buying Stage Distribution</span>
      </div>
      <div className="flex items-center gap-2 h-8 rounded-lg overflow-hidden">
        {stages.map(stage => {
          const count = byBuyingStage[stage.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          if (pct === 0) return null;
          return (
            <div
              key={stage.key}
              className={`${stage.color} h-full flex items-center justify-center text-white text-xs font-semibold transition-all`}
              style={{ width: `${pct}%`, minWidth: pct > 5 ? 'auto' : '20px' }}
              title={`${stage.label}: ${count} (${pct}%)`}
            >
              {pct > 10 && `${pct}%`}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3">
        {stages.map(stage => (
          <div key={stage.key} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
            <span className={`text-xs font-medium ${stage.textColor}`}>
              {stage.label}: {byBuyingStage[stage.key] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scan Config Panel ─────────────────────────────────────

function ScanConfigPanel({ config, onChange, onScan, isScanning, scanProgress }) {
  const [expanded, setExpanded] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newSolutionKeyword, setNewSolutionKeyword] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newChurnTech, setNewChurnTech] = useState('');

  const addItem = (field, value, setterFn) => {
    if (!value.trim()) return;
    const current = config[field] || [];
    onChange({ [field]: [...current, value.trim()] });
    setterFn('');
  };

  const removeItem = (field, index) => {
    const current = config[field] || [];
    onChange({ [field]: current.filter((_, i) => i !== index) });
  };

  // Check if any buyer intent config is set
  const hasConfig = (config.competitors?.length > 0) || 
                    (config.pain_points?.length > 0) || 
                    (config.solution_keywords?.length > 0) ||
                    (config.job_titles_to_track?.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Radar size={14} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Signal Scanner</h3>
            <p className="text-xs text-gray-400">Configure and run AI-powered intent signal detection</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <Settings size={12} />
            {expanded ? 'Hide Config' : 'Configure ICP'}
          </button>
          <button
            onClick={() => onScan()}
            disabled={isScanning || !hasConfig}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 transition-all shadow-sm"
          >
            {isScanning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            {isScanning ? 'Scanning...' : 'Find Buyer Signals'}
          </button>
        </div>
      </div>

      {/* Scan Progress */}
      {scanProgress.length > 0 && (
        <div className="mb-4 bg-blue-50/50 rounded-lg p-3 space-y-1">
          {scanProgress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-blue-700">
              <CheckCircle size={12} className="text-blue-500 flex-shrink-0" />
              <span className="font-medium">{p.step}:</span>
              <span>{p.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Configuration */}
      {expanded && (
        <div className="space-y-5 pt-4 border-t border-gray-100">
          {/* Section: Buyer Intent Signals (Most Important) */}
          <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl p-4 border border-emerald-100">
            <h4 className="text-xs font-bold text-emerald-800 mb-3 flex items-center gap-2">
              <Target size={14} /> Buyer Intent Configuration
              <span className="text-[10px] font-normal text-emerald-600">(What makes a company a good fit?)</span>
            </h4>
            
            {/* Pain Points */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 block mb-2">Pain Points You Solve</label>
              <p className="text-[10px] text-gray-500 mb-2">Problems your product addresses — we'll find companies expressing these</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.pain_points || []).map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {p}
                    <button onClick={() => removeItem('pain_points', i)} className="hover:text-emerald-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newPainPoint}
                  onChange={(e) => setNewPainPoint(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('pain_points', newPainPoint, setNewPainPoint)}
                  placeholder="e.g. disconnected sales tools, no rep visibility, manual tracking"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <button onClick={() => addItem('pain_points', newPainPoint, setNewPainPoint)} className="text-xs px-3 py-1.5 bg-emerald-100 rounded-lg hover:bg-emerald-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Solution Keywords */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 block mb-2">Solution Keywords</label>
              <p className="text-[10px] text-gray-500 mb-2">What do buyers search for when looking for your solution?</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.solution_keywords || []).map((k, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-cyan-100 text-cyan-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {k}
                    <button onClick={() => removeItem('solution_keywords', i)} className="hover:text-cyan-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newSolutionKeyword}
                  onChange={(e) => setNewSolutionKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('solution_keywords', newSolutionKeyword, setNewSolutionKeyword)}
                  placeholder="e.g. sales gamification, SDR coaching software, revenue platform"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
                <button onClick={() => addItem('solution_keywords', newSolutionKeyword, setNewSolutionKeyword)} className="text-xs px-3 py-1.5 bg-cyan-100 rounded-lg hover:bg-cyan-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Job Titles to Track */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Job Titles That Signal Need</label>
              <p className="text-[10px] text-gray-500 mb-2">Companies hiring these roles likely need your product</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.job_titles_to_track || []).map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {t}
                    <button onClick={() => removeItem('job_titles_to_track', i)} className="hover:text-blue-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('job_titles_to_track', newJobTitle, setNewJobTitle)}
                  placeholder="e.g. VP Sales, Sales Ops Director, SDR Manager, RevOps"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button onClick={() => addItem('job_titles_to_track', newJobTitle, setNewJobTitle)} className="text-xs px-3 py-1.5 bg-blue-100 rounded-lg hover:bg-blue-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Competitor Intelligence */}
          <div className="bg-red-50/50 rounded-xl p-4 border border-red-100">
            <h4 className="text-xs font-bold text-red-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} /> Competitor Intelligence
            </h4>
            
            {/* Competitors */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 block mb-2">Competitors to Track</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.competitors || []).map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {c}
                    <button onClick={() => removeItem('competitors', i)} className="hover:text-red-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('competitors', newCompetitor, setNewCompetitor)}
                  placeholder="e.g. Ambition, Gong, Outreach, Salesloft"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button onClick={() => addItem('competitors', newCompetitor, setNewCompetitor)} className="text-xs px-3 py-1.5 bg-red-100 rounded-lg hover:bg-red-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Tech Stack Churning */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">Detect Churn From (Tech/Competitors)</label>
              <p className="text-[10px] text-gray-500 mb-2">Find companies leaving these products — prime prospects</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.tech_stack_churning || []).map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {t}
                    <button onClick={() => removeItem('tech_stack_churning', i)} className="hover:text-orange-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newChurnTech}
                  onChange={(e) => setNewChurnTech(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('tech_stack_churning', newChurnTech, setNewChurnTech)}
                  placeholder="e.g. Ambition, Hoopla, LevelEleven"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <button onClick={() => addItem('tech_stack_churning', newChurnTech, setNewChurnTech)} className="text-xs px-3 py-1.5 bg-orange-100 rounded-lg hover:bg-orange-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Section: ICP Firmographics */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 size={14} /> ICP Firmographics
            </h4>
            
            {/* Keywords */}
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-600 block mb-2">Additional Keywords</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(config.keywords || []).map((k, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {k}
                    <button onClick={() => removeItem('keywords', i)} className="hover:text-purple-900"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addItem('keywords', newKeyword, setNewKeyword)}
                  placeholder="e.g. B2B SaaS, outbound sales, revenue operations"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button onClick={() => addItem('keywords', newKeyword, setNewKeyword)} className="text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* ICP Filters */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Employee Range</label>
                <select
                  value={config.icp_employee_range}
                  onChange={(e) => onChange({ icp_employee_range: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="10-100">10-100 (SMB)</option>
                  <option value="50-500">50-500 (Mid-Market)</option>
                  <option value="200-1000">200-1,000 (Upper Mid)</option>
                  <option value="1000+">1,000+ (Enterprise)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Region</label>
                <select
                  value={config.icp_regions?.[0] || 'North America'}
                  onChange={(e) => onChange({ icp_regions: [e.target.value] })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="North America">North America</option>
                  <option value="Europe">Europe</option>
                  <option value="APAC">APAC</option>
                  <option value="Global">Global</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Signal Card ───────────────────────────────────────────

function SignalCard({ signal, onAction, onDismiss, onResearchCompany, onFindCustomers }) {
  const [expanded, setExpanded] = useState(false);
  const iconConfig = SIGNAL_ICONS[signal.signal_type] || SIGNAL_ICONS.competitor_engagement;
  const IconComp = iconConfig.icon;
  const statusStyle = STATUS_STYLES[signal.status] || STATUS_STYLES.new;

  // Buying stage badge styles
  const buyingStageStyles = {
    awareness: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Awareness' },
    consideration: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Consideration' },
    decision: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Decision' },
  };
  const stageStyle = signal.buying_stage_indicator ? buyingStageStyles[signal.buying_stage_indicator] : null;

  return (
    <div className={`bg-white rounded-xl border ${signal.signal_score >= 70 ? 'border-amber-200' : 'border-gray-100'} p-4 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconConfig.color}`}>
          <IconComp size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{signal.title}</h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
            {stageStyle && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stageStyle.bg} ${stageStyle.text}`}>
                {stageStyle.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2">
            {signal.company_name && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 size={10} /> {signal.company_name}
              </span>
            )}
            <span className="text-xs text-gray-400">{timeAgo(signal.detected_at)}</span>
            <span className="text-xs text-gray-400 capitalize">{signal.source_platform}</span>
          </div>

          {signal.description && (
            <p className="text-xs text-gray-600 line-clamp-2 mb-2">{signal.description}</p>
          )}

          {/* Signal strength bar */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-500 font-medium w-20">Intent Score</span>
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full ${STRENGTH_COLORS[signal.signal_strength]} transition-all`}
                style={{ width: `${signal.signal_score}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700 w-8 text-right">{signal.signal_score}</span>
          </div>

          {/* AI Insights (expandable) */}
          {(signal.ai_summary || signal.ai_recommended_action) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-purple-600 font-medium flex items-center gap-1 mt-1 hover:text-purple-800"
            >
              <Sparkles size={10} />
              {expanded ? 'Hide AI Insights' : 'View AI Insights'}
              <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {expanded && (
            <div className="mt-2 bg-purple-50/50 rounded-lg p-3 space-y-2">
              {signal.ai_summary && (
                <div>
                  <span className="text-[10px] font-medium text-purple-600 uppercase">Summary</span>
                  <p className="text-xs text-gray-700">{signal.ai_summary}</p>
                </div>
              )}
              {signal.ai_recommended_action && (
                <div>
                  <span className="text-[10px] font-medium text-purple-600 uppercase">Recommended Action</span>
                  <p className="text-xs text-gray-700">{signal.ai_recommended_action}</p>
                </div>
              )}
              {signal.ai_outreach_angle && (
                <div>
                  <span className="text-[10px] font-medium text-purple-600 uppercase">Outreach Angle</span>
                  <p className="text-xs text-gray-700">{signal.ai_outreach_angle}</p>
                </div>
              )}
              {/* Quick-action buttons inside AI Insights */}
              <div className="flex items-center gap-2 pt-2 border-t border-purple-100/50 mt-2">
                {signal.company_name && onResearchCompany && (
                  <button
                    onClick={() => onResearchCompany(signal.company_name)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Search size={10} /> Research {signal.company_name}
                  </button>
                )}
                {signal.company_name && onFindCustomers && (
                  <button
                    onClick={() => onFindCustomers(signal.company_name)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"
                  >
                    <Users size={10} /> Find {signal.company_name}'s Customers
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {signal.status === 'new' && (
            <>
              <button
                onClick={() => onAction(signal.id)}
                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                title="Mark as actioned"
              >
                <CheckCircle size={14} />
              </button>
              <button
                onClick={() => onDismiss(signal.id)}
                className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Dismiss"
              >
                <XCircle size={14} />
              </button>
            </>
          )}
          {signal.company_name && onResearchCompany && (
            <button
              onClick={() => onResearchCompany(signal.company_name)}
              className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors"
              title={`Research ${signal.company_name}`}
            >
              <Search size={14} />
            </button>
          )}
          {signal.source_url && (
            <a
              href={signal.source_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors"
              title="View source"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scan Results Panel ────────────────────────────────────

function ScanResultsPanel({ signals, lastScanSignalIds, onAction, onDismiss, onClear, onResearchCompany, onFindCustomers }) {
  const newSignals = signals.filter((s) => lastScanSignalIds.includes(s.id));

  if (newSignals.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Scan Results</h3>
            <p className="text-xs text-gray-500">{newSignals.length} new signal{newSignals.length !== 1 ? 's' : ''} detected</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          <X size={12} /> Dismiss
        </button>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {newSignals.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            onAction={onAction}
            onDismiss={onDismiss}
            onResearchCompany={onResearchCompany}
            onFindCustomers={onFindCustomers}
          />
        ))}
      </div>
    </div>
  );
}

// ── Top Companies Table ───────────────────────────────────

function TopCompaniesPanel({ companies }) {
  if (!companies.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Signal Companies</h3>
      <div className="space-y-2">
        {companies.slice(0, 8).map((c, i) => (
          <div key={c.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-800 font-medium truncate">{c.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{c.count} signals</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                c.score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                c.score >= 50 ? 'bg-yellow-50 text-yellow-700' :
                'bg-gray-50 text-gray-600'
              }`}>
                {c.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function SignalProspecting({ organizationId, userId, onNavigateDiscover }) {
  const signals = useSignalProspecting(organizationId, userId);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredSignals = useMemo(() => {
    return signals.signals.filter((s) => {
      if (filterType !== 'all' && s.signal_type !== filterType) return false;
      // Hide dismissed signals unless explicitly filtering for them
      if (filterStatus === 'all' && s.status === 'dismissed') return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      return true;
    });
  }, [signals.signals, filterType, filterStatus]);

  // Count of non-dismissed signals for Dismiss All button
  const activeSignalCount = useMemo(() => {
    return signals.signals.filter((s) => s.status !== 'dismissed').length;
  }, [signals.signals]);

  const handleAction = (id) => signals.updateSignalStatus(id, 'actioned');
  const handleDismiss = (id) => signals.dismissSignal(id);

  // Cross-tab navigation: research a company or find its customers in Discover
  const handleResearchCompany = (companyName) => {
    if (onNavigateDiscover) {
      onNavigateDiscover({ mode: 'company', query: companyName });
    }
  };

  const handleFindCustomers = (competitorName) => {
    if (onNavigateDiscover) {
      onNavigateDiscover({
        mode: 'people_search',
        findPeopleMode: 'technology',
        query: competitorName,
        filters: {
          titles: [
            'VP Sales', 'VP of Sales', 'Director of Sales', 'Head of Sales',
            'Sales Manager', 'CRO', 'VP Revenue Operations', 'Head of Revenue Operations',
            'VP Business Development', 'Director of Business Development',
            'Business Development Manager', 'Account Executive', 'SDR Manager', 'BDR Manager',
          ],
          seniority: ['vp', 'director', 'manager', 'head', 'c_suite', 'senior'],
          technology: competitorName,
        }
      });
    }
  };

  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismissAllSignals = async () => {
    setIsDismissing(true);
    try {
      await signals.dismissAllSignals();
      setShowDismissConfirm(false);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dismiss All Confirmation Modal */}
      <ConfirmModal
        isOpen={showDismissConfirm}
        onClose={() => setShowDismissConfirm(false)}
        onConfirm={handleDismissAllSignals}
        title="Dismiss All Signals?"
        message={`This will mark all ${activeSignalCount} signals as dismissed. They will be hidden from the main view but remain in the database.`}
        confirmText="Dismiss All"
        variant="warning"
        isLoading={isDismissing}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Signal-Based Prospecting</h2>
          <p className="text-xs text-gray-500 mt-0.5">Detect high-intent signals from competitors, job changes, funding, and more</p>
        </div>
        {activeSignalCount > 0 && (
          <button
            onClick={() => setShowDismissConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Dismiss All ({activeSignalCount})
          </button>
        )}
      </div>

      {/* Error */}
      {signals.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">
          {signals.error}
        </div>
      )}

      {/* Scan Config */}
      <ScanConfigPanel
        config={signals.scanConfig}
        onChange={signals.setScanConfig}
        onScan={signals.runSignalScan}
        isScanning={signals.isScanning}
        scanProgress={signals.scanProgress}
      />

      {/* Scan Results — shown after a scan completes with new signals */}
      {signals.lastScanSignalIds.length > 0 && (
        <ScanResultsPanel
          signals={signals.signals}
          lastScanSignalIds={signals.lastScanSignalIds}
          onAction={handleAction}
          onDismiss={handleDismiss}
          onClear={signals.clearLastScan}
          onResearchCompany={handleResearchCompany}
          onFindCustomers={handleFindCustomers}
        />
      )}

      {/* Summary */}
      <SignalSummaryCards summary={signals.summary} />

      {/* Buying Stage Funnel */}
      <BuyingStageFunnel byBuyingStage={signals.summary.byBuyingStage} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Signal Feed */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Types</option>
              {signals.SIGNAL_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {/* Signal List */}
          {signals.loading && !signals.signals.length ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-blue-400 mr-2" />
              <span className="text-sm text-gray-500">Loading signals...</span>
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
              <Radar size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-1">No signals detected yet</p>
              <p className="text-xs text-gray-400">Configure your competitors above and run a signal scan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onAction={handleAction}
                  onDismiss={handleDismiss}
                  onResearchCompany={handleResearchCompany}
                  onFindCustomers={handleFindCustomers}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <TopCompaniesPanel companies={signals.summary.topCompanies} />

          {/* Signal Type Breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Signal Type</h3>
            <div className="space-y-2">
              {signals.SIGNAL_TYPES.map((t) => {
                const count = signals.summary.byType[t.key] || 0;
                return (
                  <div key={t.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span>{t.icon}</span> {t.label}
                    </span>
                    <span className="text-xs font-bold text-gray-800">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
