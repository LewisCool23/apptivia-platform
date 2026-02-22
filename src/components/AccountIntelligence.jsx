import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2, Target, Users, TrendingUp, Shield, Sparkles, RefreshCw,
  ChevronDown, ChevronUp, Plus, Edit3, Trash2, Eye, AlertTriangle,
  Globe, Mail, Linkedin, DollarSign, BarChart3, Filter,
  User, Star, X, ArrowRight, Briefcase, MapPin, Zap, Crown
} from 'lucide-react';
import { useAccountIntelligence } from '../hooks/useAccountIntelligence';
import { supabase } from '../supabaseClient';
import SearchWithHistory from './SearchWithHistory';

// ── ICP Fit Scoring ────────────────────────────────────────
// Computes a 0–100 ICP fit score for an account against the org's configured criteria.

function computeIcpScore(account, icpConfig) {
  if (!icpConfig?.enabled) return null;

  const w = icpConfig.weights || { industry: 30, headcount: 25, revenue: 25, technology: 20 };
  let score = 0;

  // Industry (30pts) — partial credit if no target list configured
  if (icpConfig.target_industries?.length) {
    const acctIndustry = (account.industry || '').toLowerCase();
    const match = icpConfig.target_industries.some(ind =>
      acctIndustry.includes(ind.toLowerCase()) || ind.toLowerCase().includes(acctIndustry)
    );
    if (match) score += w.industry;
  } else {
    score += w.industry * 0.5;
  }

  // Headcount (25pts)
  if ((icpConfig.headcount_min || icpConfig.headcount_max) && account.employee_count) {
    const emp = parseInt(account.employee_count) || 0;
    const min = icpConfig.headcount_min || 0;
    const max = icpConfig.headcount_max || Infinity;
    if (emp >= min && emp <= max) score += w.headcount;
    else if (emp >= min * 0.5 && emp <= max * 2) score += w.headcount * 0.5;
  } else {
    score += w.headcount * 0.5;
  }

  // Revenue (25pts) — annual_revenue is a string like "$5M" or raw number
  if ((icpConfig.revenue_min_m || icpConfig.revenue_max_m) && account.annual_revenue) {
    const raw = String(account.annual_revenue).replace(/[^0-9.]/g, '');
    const revM = parseFloat(raw) || 0;
    const normRevM = revM > 10000 ? revM / 1_000_000 : revM; // handle raw vs millions
    const min = icpConfig.revenue_min_m || 0;
    const max = icpConfig.revenue_max_m || Infinity;
    if (normRevM >= min && normRevM <= max) score += w.revenue;
    else if (normRevM >= min * 0.5 && normRevM <= max * 2) score += w.revenue * 0.5;
  } else {
    score += w.revenue * 0.5;
  }

  // Technology (20pts) — checks technographics array
  if (icpConfig.target_technologies?.length) {
    const techNames = (account.technographics || []).map(t => (t.tech_name || '').toLowerCase());
    const match = icpConfig.target_technologies.some(tech =>
      techNames.some(t => t.includes(tech.toLowerCase()))
    );
    if (match) score += w.technology;
  } else {
    score += w.technology * 0.5;
  }

  return Math.round(Math.min(100, score));
}

function IcpBadge({ score }) {
  if (score === null) return null;
  const color = score >= 75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : score >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-600 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
      ICP {score}
    </span>
  );
}

function useIcpConfig(organizationId) {
  const [icpConfig, setIcpConfig] = useState(null);
  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('organizations')
      .select('icp_config')
      .eq('id', organizationId)
      .single()
      .then(({ data }) => {
        if (data?.icp_config) {
          const c = typeof data.icp_config === 'string' ? JSON.parse(data.icp_config) : data.icp_config;
          setIcpConfig(c);
        }
      });
  }, [organizationId]);
  return icpConfig;
}

// ── Constants ─────────────────────────────────────────────

const TIER_STYLES = {
  tier_1: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Tier 1', icon: Crown },
  tier_2: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Tier 2', icon: Star },
  tier_3: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Tier 3', icon: Target },
  untiered: { bg: 'bg-gray-50', text: 'text-gray-400', label: 'Untiered', icon: Target },
};

const STATUS_STYLES = {
  active: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Active' },
  nurture: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Nurture' },
  engaged: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Engaged' },
  opportunity: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Opportunity' },
  customer: { bg: 'bg-green-50', text: 'text-green-700', label: 'Customer' },
  churned: { bg: 'bg-red-50', text: 'text-red-600', label: 'Churned' },
};

const COMMITTEE_ROLES = {
  decision_maker: { label: 'Decision Maker', color: 'bg-purple-100 text-purple-700', icon: Crown },
  champion: { label: 'Champion', color: 'bg-emerald-100 text-emerald-700', icon: Star },
  influencer: { label: 'Influencer', color: 'bg-blue-100 text-blue-700', icon: TrendingUp },
  blocker: { label: 'Blocker', color: 'bg-red-100 text-red-700', icon: Shield },
  user: { label: 'End User', color: 'bg-gray-100 text-gray-600', icon: User },
};

function ScoreBadge({ score, size = 'sm' }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' :
    score >= 60 ? 'bg-blue-100 text-blue-700' :
    score >= 40 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${color} ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
      {score}
    </span>
  );
}

// ── Summary Cards ────────────────────────────────────────

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Accounts', value: summary.totalAccounts, icon: Building2, color: 'text-blue-600 bg-blue-50' },
    { label: 'Tier 1', value: summary.tier1Count, icon: Crown, color: 'text-purple-600 bg-purple-50' },
    { label: 'High Intent', value: summary.highIntentCount, icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { label: 'Avg Score', value: summary.avgAccountScore, icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
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

// ── Buying Committee Panel ───────────────────────────────

function BuyingCommitteePanel({ committee, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState({ role: 'influencer', name: '', title: '', influence_level: 'medium', email: '' });

  const handleAdd = () => {
    if (!newMember.name.trim()) return;
    onUpdate([...committee, newMember]);
    setNewMember({ role: 'influencer', name: '', title: '', influence_level: 'medium', email: '' });
    setAdding(false);
  };

  const handleRemove = (idx) => {
    onUpdate(committee.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-gray-500" />
          <span className="text-sm font-bold text-gray-900">Buying Committee</span>
          <span className="text-[10px] text-gray-400">({committee.length})</span>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-medium hover:bg-blue-600 transition-colors">
          <Plus size={10} /> Add
        </button>
      </div>

      <div className="divide-y divide-gray-50">
        {committee.length === 0 && !adding && (
          <div className="p-6 text-center">
            <Users size={20} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No buying committee members mapped yet.</p>
          </div>
        )}

        {committee.map((member, i) => {
          const r = COMMITTEE_ROLES[member.role] || COMMITTEE_ROLES.user;
          return (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${r.color}`}>
                  <r.icon size={14} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-800">{member.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${r.color}`}>{r.label}</span>
                    {member.title && <span className="text-[10px] text-gray-400">{member.title}</span>}
                    <span className={`text-[9px] font-medium ${
                      member.influence_level === 'high' ? 'text-red-500' :
                      member.influence_level === 'medium' ? 'text-amber-500' : 'text-gray-400'
                    }`}>
                      {member.influence_level} influence
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => handleRemove(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {adding && (
          <div className="p-4 space-y-3 bg-blue-50/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">NAME</label>
                <input value={newMember.name} onChange={(e) => setNewMember(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Jane Smith" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">TITLE</label>
                <input value={newMember.title} onChange={(e) => setNewMember(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., VP Sales" className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">ROLE</label>
                <select value={newMember.role} onChange={(e) => setNewMember(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                  {Object.entries(COMMITTEE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-500 block mb-1">INFLUENCE</label>
                <select value={newMember.influence_level} onChange={(e) => setNewMember(p => ({ ...p, influence_level: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAdd} disabled={!newMember.name.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                Add Member
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Account Card ─────────────────────────────────────────

function AccountCard({ account, onSelect, icpConfig }) {
  const tier = TIER_STYLES[account.tier] || TIER_STYLES.untiered;
  const status = STATUS_STYLES[account.status] || STATUS_STYLES.active;
  const icpScore = useMemo(() => computeIcpScore(account, icpConfig), [account, icpConfig]);

  return (
    <div onClick={() => onSelect(account)}
      className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{account.account_name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {account.domain && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Globe size={8} /> {account.domain}</span>}
              {account.industry && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Briefcase size={8} /> {account.industry}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {icpScore !== null && <IcpBadge score={icpScore} />}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tier.bg} ${tier.text}`}>{tier.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div>
          <span className="text-[10px] text-gray-400 block">Account</span>
          <ScoreBadge score={account.account_score} />
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Intent</span>
          <ScoreBadge score={account.intent_score} />
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Engage</span>
          <ScoreBadge score={account.engagement_score} />
        </div>
        <div>
          <span className="text-[10px] text-gray-400 block">Signals</span>
          <span className="text-xs font-bold text-gray-700">{account.signals_count}</span>
        </div>
      </div>

      {account.buying_committee?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-400">Committee:</span>
          {account.buying_committee.slice(0, 3).map((m, i) => {
            const r = COMMITTEE_ROLES[m.role] || COMMITTEE_ROLES.user;
            return <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${r.color}`}>{m.name}</span>;
          })}
          {account.buying_committee.length > 3 && (
            <span className="text-[9px] text-gray-400">+{account.buying_committee.length - 3} more</span>
          )}
        </div>
      )}

      {account.assigned_name && (
        <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
          <User size={8} /> {account.assigned_name}
          {account.territory && <><MapPin size={8} className="ml-2" /> {account.territory}</>}
        </div>
      )}
    </div>
  );
}

// ── Account Detail View ──────────────────────────────────

function AccountDetail({ account, onBack, onUpdate, onAnalyze, analyzing, onUpdateCommittee, onDelete, icpConfig }) {
  const icpScore = useMemo(() => computeIcpScore(account, icpConfig), [account, icpConfig]);
  const tier = TIER_STYLES[account.tier] || TIER_STYLES.untiered;
  const status = STATUS_STYLES[account.status] || STATUS_STYLES.active;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <button onClick={onBack} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mb-3">
          ← Back to accounts
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{account.account_name}</h2>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${tier.bg} ${tier.text}`}>
                  <tier.icon size={10} /> {tier.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                {account.domain && <span className="text-xs text-gray-400 flex items-center gap-1"><Globe size={10} /> {account.domain}</span>}
                {account.industry && <span className="text-xs text-gray-400 flex items-center gap-1"><Briefcase size={10} /> {account.industry}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm(`Delete account "${account.account_name}"? This cannot be undone.`)) {
                  onDelete(account.id);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 bg-red-50 rounded-lg text-xs font-medium hover:bg-red-100 transition-all"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={() => onAnalyze(account.id)} disabled={analyzing}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-xs font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-sm">
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Scores */}
      <div className={`grid gap-3 ${icpScore !== null ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {[
          { label: 'Account Score', value: account.account_score, color: 'from-blue-500 to-indigo-500' },
          { label: 'Intent Score', value: account.intent_score, color: 'from-amber-500 to-orange-500' },
          { label: 'Engagement Score', value: account.engagement_score, color: 'from-emerald-500 to-teal-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <span className="text-[10px] text-gray-400 block mb-1">{s.label}</span>
            <div className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full bg-gradient-to-r ${s.color}`} style={{ width: `${s.value}%` }} />
            </div>
          </div>
        ))}
        {icpScore !== null && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <span className="text-[10px] text-gray-400 block mb-1">ICP Fit Score</span>
            <div className={`text-2xl font-bold ${icpScore >= 75 ? 'text-emerald-600' : icpScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{icpScore}</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${icpScore >= 75 ? 'bg-emerald-500' : icpScore >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${icpScore}%` }} />
            </div>
            <span className="text-[9px] text-gray-400">
              {icpScore >= 75 ? 'Strong fit' : icpScore >= 50 ? 'Partial fit' : 'Low fit'}
            </span>
          </div>
        )}
      </div>

      {/* ABM Insights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Readiness Score */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <span className="text-[10px] text-gray-400 block mb-1">Readiness Score</span>
          <div className={`text-2xl font-bold ${account.readiness_score >= 70 ? 'text-emerald-600' : account.readiness_score >= 40 ? 'text-amber-600' : 'text-gray-400'}`}>
            {account.readiness_score ?? '—'}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${account.readiness_score >= 70 ? 'bg-emerald-500' : account.readiness_score >= 40 ? 'bg-amber-500' : 'bg-gray-300'}`} style={{ width: `${account.readiness_score || 0}%` }} />
          </div>
        </div>

        {/* Buying Stage */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <span className="text-[10px] text-gray-400 block mb-1">Buying Stage</span>
          {account.buying_stage ? (
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
              account.buying_stage === 'decision' ? 'bg-emerald-100 text-emerald-700' :
              account.buying_stage === 'consideration' ? 'bg-amber-100 text-amber-700' :
              'bg-sky-100 text-sky-700'
            }`}>
              {account.buying_stage.charAt(0).toUpperCase() + account.buying_stage.slice(1)}
            </span>
          ) : (
            <span className="text-sm text-gray-400">Not Assessed</span>
          )}
        </div>

        {/* Signal Velocity */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <span className="text-[10px] text-gray-400 block mb-1">Signal Velocity</span>
          <div className="text-xl font-bold text-purple-600">{account.signal_velocity ?? '—'}</div>
          <span className="text-[10px] text-gray-400">signals/week</span>
        </div>

        {/* Tech Fit Score */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <span className="text-[10px] text-gray-400 block mb-1">Tech Fit Score</span>
          <div className={`text-xl font-bold ${account.tech_fit_score >= 70 ? 'text-emerald-600' : account.tech_fit_score >= 40 ? 'text-amber-600' : 'text-gray-400'}`}>
            {account.tech_fit_score ?? '—'}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {(account.ai_summary || account.ai_strategy) && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center gap-2">
            <Sparkles size={14} className="text-white" />
            <span className="text-sm font-semibold text-white">AI Account Intelligence</span>
          </div>
          <div className="p-5 space-y-4">
            {account.ai_summary && (
              <div>
                <span className="text-xs font-semibold text-gray-600 block mb-1">Summary</span>
                <p className="text-xs text-gray-700 leading-relaxed">{account.ai_summary}</p>
              </div>
            )}
            {account.ai_strategy && (
              <div>
                <span className="text-xs font-semibold text-gray-600 block mb-1">Recommended Strategy</span>
                <p className="text-xs text-gray-700 leading-relaxed">{account.ai_strategy}</p>
              </div>
            )}
            {account.ai_risk_factors?.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-600 block mb-1.5">Risk Factors</span>
                <ul className="space-y-1">
                  {account.ai_risk_factors.map((r, i) => (
                    <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                      <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tier Selector */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <span className="text-xs font-semibold text-gray-700 block mb-2">Account Tier</span>
        <div className="flex gap-2">
          {Object.entries(TIER_STYLES).map(([key, style]) => (
            <button key={key} onClick={() => onUpdate(account.id, { tier: key })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                account.tier === key
                  ? `${style.bg} ${style.text} ring-2 ring-offset-1 ring-current`
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}>
              <style.icon size={12} /> {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* Buying Committee */}
      <BuyingCommitteePanel
        committee={account.buying_committee || []}
        onUpdate={(committee) => onUpdateCommittee(account.id, committee)}
      />
    </div>
  );
}

// ── New Account Modal ────────────────────────────────────

function NewAccountModal({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState({ account_name: '', domain: '', industry: '', tier: 'untiered' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.account_name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onCreate(form);
      setForm({ account_name: '', domain: '', industry: '', tier: 'untiered' });
      setError('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-5">New Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
            <input
              value={form.account_name}
              onChange={(e) => setForm(p => ({ ...p, account_name: e.target.value }))}
              placeholder="e.g., Acme Corp"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
              <input
                value={form.domain}
                onChange={(e) => setForm(p => ({ ...p, domain: e.target.value }))}
                placeholder="acme.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setForm(p => ({ ...p, industry: e.target.value }))}
                placeholder="e.g., SaaS"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
            <div className="flex gap-2">
              {Object.entries(TIER_STYLES).map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, tier: key }))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    form.tier === key ? `${style.bg} ${style.text} ring-1 ring-current` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <style.icon size={10} /> {style.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.account_name.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────

export default function AccountIntelligence({ organizationId, userId }) {
  const {
    accounts, summary, activeAccount, loading, analyzing, error,
    fetchAccounts, createAccount, updateAccount, deleteAccount,
    updateBuyingCommittee, setTier, assignAccount, analyzeAccount,
    scoreAllAccounts, importFromCompanies,
  } = useAccountIntelligence(organizationId, userId);

  const icpConfig = useIcpConfig(organizationId);

  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState('list');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [filterTier, setFilterTier] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    if (filterTier !== 'all') filtered = filtered.filter(a => a.tier === filterTier);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.account_name.toLowerCase().includes(q) ||
        a.domain?.toLowerCase().includes(q) ||
        a.industry?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [accounts, filterTier, searchQuery]);

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    setView('detail');
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw size={20} className="text-blue-500 animate-spin" />
        <span className="text-sm text-gray-500 ml-3">Loading accounts...</span>
      </div>
    );
  }

  if (view === 'detail' && selectedAccount) {
    return (
      <AccountDetail
        account={selectedAccount}
        onBack={() => { setView('list'); fetchAccounts(); }}
        onUpdate={async (id, updates) => { await updateAccount(id, updates); setSelectedAccount(prev => ({ ...prev, ...updates })); }}
        onAnalyze={analyzeAccount}
        analyzing={analyzing}
        onUpdateCommittee={async (id, committee) => { await updateBuyingCommittee(id, committee); setSelectedAccount(prev => ({ ...prev, buying_committee: committee })); }}
        onDelete={async (id) => { await deleteAccount(id); setView('list'); }}
        icpConfig={icpConfig}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SearchWithHistory
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search accounts..."
            context="accounts"
            className="flex-1 max-w-xs"
            inputClassName="text-xs"
          />
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterTier('all')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${filterTier === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              All
            </button>
            {Object.entries(TIER_STYLES).filter(([k]) => k !== 'untiered').map(([key, style]) => (
              <button key={key} onClick={() => setFilterTier(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${filterTier === key ? `${style.bg} ${style.text}` : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                {style.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={importFromCompanies}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
            <ArrowRight size={12} /> Import Companies
          </button>
          <button onClick={scoreAllAccounts} disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors disabled:opacity-50">
            {analyzing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Score All
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm">
            <Plus size={14} /> New Account
          </button>
        </div>
      </div>

      {/* Account List */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-blue-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">
            {accounts.length === 0 ? 'No accounts yet' : 'No matching accounts'}
          </h3>
          <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
            {accounts.length === 0
              ? 'Create target accounts or import from your company research to get started with account-based intelligence.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {accounts.length === 0 && (
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowNew(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors">
                Create Account
              </button>
              <button onClick={importFromCompanies}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors">
                Import from Companies
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredAccounts.map((account) => (
            <AccountCard key={account.id} account={account} onSelect={handleSelectAccount} icpConfig={icpConfig} />
          ))}
        </div>
      )}

      <NewAccountModal isOpen={showNew} onClose={() => setShowNew(false)} onCreate={createAccount} />
    </div>
  );
}
