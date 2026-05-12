import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Building2, Target, Users, TrendingUp, Shield, Sparkles, RefreshCw,
  ChevronDown, ChevronUp, Plus, Edit3, Trash2, Eye, AlertTriangle,
  Globe, Mail, Linkedin, DollarSign, BarChart3, Filter,
  User, Star, X, ArrowRight, Briefcase, MapPin, Zap, Crown,
  Phone, Loader, CheckCircle, Search, UserPlus
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
  tier_1: { bg: 'bg-apptivia-carbon-100', text: 'text-apptivia-ink', label: 'Tier 1', icon: Crown },
  tier_2: { bg: 'bg-apptivia-coral-tone-50', text: 'text-apptivia-coral', label: 'Tier 2', icon: Star },
  tier_3: { bg: 'bg-apptivia-carbon-100', text: 'text-apptivia-carbon-600', label: 'Tier 3', icon: Target },
  untiered: { bg: 'bg-apptivia-paper', text: 'text-apptivia-carbon-400', label: 'Untiered', icon: Target },
};

const STATUS_STYLES = {
  active: { bg: 'bg-apptivia-coral-tone-50', text: 'text-apptivia-coral', label: 'Active' },
  nurture: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Nurture' },
  engaged: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Engaged' },
  opportunity: { bg: 'bg-apptivia-carbon-100', text: 'text-apptivia-ink', label: 'Opportunity' },
  customer: { bg: 'bg-green-50', text: 'text-green-700', label: 'Customer' },
  churned: { bg: 'bg-red-50', text: 'text-red-600', label: 'Churned' },
};

const COMMITTEE_ROLES = {
  decision_maker: { label: 'Decision Maker', color: 'bg-apptivia-carbon-100 text-apptivia-ink', icon: Crown },
  champion: { label: 'Champion', color: 'bg-emerald-100 text-emerald-700', icon: Star },
  influencer: { label: 'Influencer', color: 'bg-apptivia-coral-tone-50 text-apptivia-coral', icon: TrendingUp },
  blocker: { label: 'Blocker', color: 'bg-red-100 text-red-700', icon: Shield },
  user: { label: 'End User', color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600', icon: User },
};

function ScoreBadge({ score, size = 'sm' }) {
  if (score == null || score === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-apptivia-paper text-apptivia-carbon-400 ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
        —
      </span>
    );
  }
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' :
    score >= 60 ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' :
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
    { label: 'Total Accounts', value: summary.totalAccounts, icon: Building2, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
    { label: 'Tier 1', value: summary.tier1Count, icon: Crown, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
    { label: 'High Intent', value: summary.highIntentCount, icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { label: 'Avg Score', value: summary.avgAccountScore, icon: BarChart3, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-apptivia-carbon-500">{card.label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
              <card.icon size={16} />
            </div>
          </div>
          <div className="text-lg font-bold text-apptivia-ink">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Buying Committee Panel ───────────────────────────────

function BuyingCommitteePanel({ committee, onUpdate, onFindContacts }) {
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
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-apptivia-carbon-100 flex items-center justify-between bg-apptivia-paper/50">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-apptivia-carbon-500" />
          <span className="text-sm font-bold text-apptivia-ink">Buying Committee</span>
          <span className="text-[10px] text-apptivia-carbon-400">({committee.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {onFindContacts && (
            <button onClick={onFindContacts}
              className="flex items-center gap-1 px-2.5 py-1 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg text-[10px] font-medium hover:bg-apptivia-carbon-100 transition-colors">
              <Search size={10} /> Find Contacts
            </button>
          )}
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-apptivia-coral text-white rounded-lg text-[10px] font-medium hover:bg-apptivia-coral transition-colors">
            <Plus size={10} /> Add
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {committee.length === 0 && !adding && (
          <div className="p-6 text-center">
            <Users size={20} className="text-apptivia-carbon-300 mx-auto mb-2" />
            <p className="text-xs text-apptivia-carbon-400">No buying committee members mapped yet.</p>
          </div>
        )}

        {committee.map((member, i) => {
          const r = COMMITTEE_ROLES[member.role] || COMMITTEE_ROLES.user;
          return (
            <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-apptivia-paper transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${r.color}`}>
                  <r.icon size={14} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-apptivia-ink">{member.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${r.color}`}>{r.label}</span>
                    {member.title && <span className="text-[10px] text-apptivia-carbon-400">{member.title}</span>}
                    <span className={`text-[9px] font-medium ${
                      member.influence_level === 'high' ? 'text-red-500' :
                      member.influence_level === 'medium' ? 'text-amber-500' : 'text-apptivia-carbon-400'
                    }`}>
                      {member.influence_level} influence
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => handleRemove(i)} className="text-apptivia-carbon-400 hover:text-red-500 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {adding && (
          <div className="p-4 space-y-3 bg-apptivia-coral-tone-50/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-apptivia-carbon-500 block mb-1">NAME</label>
                <input value={newMember.name} onChange={(e) => setNewMember(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Jane Smith" className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-apptivia-carbon-500 block mb-1">TITLE</label>
                <input value={newMember.title} onChange={(e) => setNewMember(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., VP Sales" className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-apptivia-carbon-500 block mb-1">ROLE</label>
                <select value={newMember.role} onChange={(e) => setNewMember(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs bg-white">
                  {Object.entries(COMMITTEE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-apptivia-carbon-500 block mb-1">INFLUENCE</label>
                <select value={newMember.influence_level} onChange={(e) => setNewMember(p => ({ ...p, influence_level: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs bg-white">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700">Cancel</button>
              <button onClick={handleAdd} disabled={!newMember.name.trim()}
                className="px-3 py-1.5 bg-apptivia-coral text-white rounded-lg text-xs font-medium hover:bg-apptivia-coral disabled:opacity-50">
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

function AccountCard({ account, onSelect, icpConfig, onNavigateDiscover }) {
  const tier = TIER_STYLES[account.tier] || TIER_STYLES.untiered;
  const status = STATUS_STYLES[account.status] || STATUS_STYLES.active;
  const icpScore = useMemo(() => computeIcpScore(account, icpConfig), [account, icpConfig]);

  return (
    <div onClick={() => onSelect(account)}
      className="bg-white rounded-lg border border-apptivia-carbon-100 p-5 hover:shadow-md hover:border-apptivia-coral-tone-100 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-apptivia-ink rounded-lg flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-apptivia-ink">{account.account_name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {account.domain && <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-0.5"><Globe size={8} /> {account.domain}</span>}
              {account.industry && <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-0.5"><Briefcase size={8} /> {account.industry}</span>}
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
          <span className="text-[10px] text-apptivia-carbon-400 block">Account</span>
          <ScoreBadge score={account.account_score} />
        </div>
        <div>
          <span className="text-[10px] text-apptivia-carbon-400 block">Intent</span>
          <ScoreBadge score={account.intent_score} />
        </div>
        <div>
          <span className="text-[10px] text-apptivia-carbon-400 block">Engage</span>
          <ScoreBadge score={account.engagement_score} />
        </div>
        <div>
          <span className="text-[10px] text-apptivia-carbon-400 block">Signals</span>
          <span className="text-xs font-bold text-apptivia-carbon-700">{account.signals_count}</span>
        </div>
      </div>

      {account.buying_committee?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-apptivia-carbon-400">Committee:</span>
          {account.buying_committee.slice(0, 3).map((m, i) => {
            const r = COMMITTEE_ROLES[m.role] || COMMITTEE_ROLES.user;
            return <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${r.color}`}>{m.name}</span>;
          })}
          {account.buying_committee.length > 3 && (
            <span className="text-[9px] text-apptivia-carbon-400">+{account.buying_committee.length - 3} more</span>
          )}
        </div>
      )}

      {account.assigned_name && (
        <div className="mt-2 text-[10px] text-apptivia-carbon-400 flex items-center gap-1">
          <User size={8} /> {account.assigned_name}
          {account.territory && <><MapPin size={8} className="ml-2" /> {account.territory}</>}
        </div>
      )}

      {onNavigateDiscover && (
        <div className="mt-3 pt-3 border-t border-apptivia-carbon-50 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onNavigateDiscover({ mode: 'company', query: account.domain || account.account_name }); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg text-[10px] font-medium hover:bg-apptivia-carbon-100 transition-colors"
          >
            <Search size={10} /> Research
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNavigateDiscover({ mode: 'people_search', findPeopleMode: 'company', query: account.domain || account.account_name }); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg text-[10px] font-medium hover:bg-apptivia-carbon-100 transition-colors"
          >
            <UserPlus size={10} /> Find Contacts
          </button>
        </div>
      )}
    </div>
  );
}

// ── Account Detail View ──────────────────────────────────

function AccountDetail({ account, onBack, onUpdate, onAnalyze, analyzing, onUpdateCommittee, onDelete, icpConfig, organizationId, userId, onNavigateDiscover }) {
  const icpScore = useMemo(() => computeIcpScore(account, icpConfig), [account, icpConfig]);
  const tier = TIER_STYLES[account.tier] || TIER_STYLES.untiered;
  const status = STATUS_STYLES[account.status] || STATUS_STYLES.active;
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [analysisMsg, setAnalysisMsg] = useState(null); // { type: 'success'|'error', text }
  const signalContacts = account.metadata?.signal_contacts || [];

  const handleAnalyze = async () => {
    setAnalysisMsg({ type: 'info', text: 'Analyzing account with AI...' });
    try {
      await onAnalyze(account.id);
      setAnalysisMsg({ type: 'success', text: 'AI analysis complete — scores and insights updated.' });
      setTimeout(() => setAnalysisMsg(null), 5000);
    } catch (err) {
      setAnalysisMsg({ type: 'error', text: `Analysis failed: ${err.message || 'Unknown error'}` });
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Analysis Status Banner */}
      {analysisMsg && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium ${
          analysisMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
          analysisMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {analysisMsg.type === 'success' ? <CheckCircle size={14} /> :
           analysisMsg.type === 'error' ? <AlertTriangle size={14} /> :
           <Loader size={14} className="animate-spin" />}
          {analysisMsg.text}
          {analysisMsg.type !== 'info' && (
            <button onClick={() => setAnalysisMsg(null)} className="ml-auto"><X size={12} /></button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
        <button onClick={onBack} className="text-xs text-apptivia-coral hover:text-apptivia-coral font-medium flex items-center gap-1 mb-3">
          ← Back to accounts
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-apptivia-ink rounded-lg flex items-center justify-center">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-apptivia-ink">{account.account_name}</h2>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${tier.bg} ${tier.text}`}>
                  <tier.icon size={10} /> {tier.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
                {account.domain && <span className="text-xs text-apptivia-carbon-400 flex items-center gap-1"><Globe size={10} /> {account.domain}</span>}
                {account.industry && <span className="text-xs text-apptivia-carbon-400 flex items-center gap-1"><Briefcase size={10} /> {account.industry}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateDiscover && (
              <>
                <button onClick={() => onNavigateDiscover({ mode: 'company', query: account.domain || account.account_name })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg text-xs font-medium hover:bg-apptivia-carbon-100 transition-all">
                  <Search size={14} /> Research
                </button>
                <button onClick={() => onNavigateDiscover({ mode: 'people_search', findPeopleMode: 'company', query: account.domain || account.account_name })}
                  className="flex items-center gap-1.5 px-3 py-2 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg text-xs font-medium hover:bg-apptivia-carbon-100 transition-all">
                  <UserPlus size={14} /> Find Contacts
                </button>
              </>
            )}
            <button onClick={() => setShowCreateDeal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-all">
              <DollarSign size={14} /> Create Deal
            </button>
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
            <button onClick={handleAnalyze} disabled={analyzing}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-xs font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 transition-all shadow-sm">
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
          </div>
          <CreateDealModal
            isOpen={showCreateDeal}
            onClose={() => setShowCreateDeal(false)}
            account={account}
            organizationId={organizationId}
            userId={userId}
          />
        </div>
      </div>

      {/* Scores */}
      <div className={`grid gap-3 ${icpScore !== null ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {[
          { label: 'Account Score', value: account.account_score, textColor: 'text-apptivia-ink', barColor: 'bg-apptivia-ink' },
          { label: 'Intent Score', value: account.intent_score, textColor: 'text-amber-600', barColor: 'bg-amber-500' },
          { label: 'Engagement Score', value: account.engagement_score, textColor: 'text-emerald-600', barColor: 'bg-emerald-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
            <span className="text-[10px] text-apptivia-carbon-400 block mb-1">{s.label}</span>
            <div className={`text-2xl font-bold ${s.textColor}`}>{s.value}</div>
            <div className="w-full bg-apptivia-carbon-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${s.barColor}`} style={{ width: `${s.value}%` }} />
            </div>
          </div>
        ))}
        {icpScore !== null && (
          <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
            <span className="text-[10px] text-apptivia-carbon-400 block mb-1">ICP Fit Score</span>
            <div className={`text-2xl font-bold ${icpScore >= 75 ? 'text-emerald-600' : icpScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{icpScore}</div>
            <div className="w-full bg-apptivia-carbon-100 rounded-full h-1.5 mt-2">
              <div className={`h-1.5 rounded-full ${icpScore >= 75 ? 'bg-emerald-500' : icpScore >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${icpScore}%` }} />
            </div>
            <span className="text-[9px] text-apptivia-carbon-400">
              {icpScore >= 75 ? 'Strong fit' : icpScore >= 50 ? 'Partial fit' : 'Low fit'}
            </span>
          </div>
        )}
      </div>

      {/* ABM Insights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Readiness Score */}
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
          <span className="text-[10px] text-apptivia-carbon-400 block mb-1">Readiness Score</span>
          <div className={`text-2xl font-bold ${account.readiness_score >= 70 ? 'text-emerald-600' : account.readiness_score >= 40 ? 'text-amber-600' : 'text-apptivia-carbon-400'}`}>
            {account.readiness_score ?? '—'}
          </div>
          <div className="w-full bg-apptivia-carbon-100 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${account.readiness_score >= 70 ? 'bg-emerald-500' : account.readiness_score >= 40 ? 'bg-amber-500' : 'bg-apptivia-carbon-300'}`} style={{ width: `${account.readiness_score || 0}%` }} />
          </div>
        </div>

        {/* Buying Stage */}
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
          <span className="text-[10px] text-apptivia-carbon-400 block mb-1">Buying Stage</span>
          {account.buying_stage ? (
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
              account.buying_stage === 'decision' ? 'bg-emerald-100 text-emerald-700' :
              account.buying_stage === 'consideration' ? 'bg-amber-100 text-amber-700' :
              'bg-sky-100 text-sky-700'
            }`}>
              {account.buying_stage.charAt(0).toUpperCase() + account.buying_stage.slice(1)}
            </span>
          ) : (
            <span className="text-sm text-apptivia-carbon-400">Not Assessed</span>
          )}
        </div>

        {/* Signal Velocity */}
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
          <span className="text-[10px] text-apptivia-carbon-400 block mb-1">Signal Velocity</span>
          <div className="text-xl font-bold text-apptivia-ink">{account.signal_velocity ?? '—'}</div>
          <span className="text-[10px] text-apptivia-carbon-400">signals/week</span>
        </div>

        {/* Tech Fit Score */}
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 text-center">
          <span className="text-[10px] text-apptivia-carbon-400 block mb-1">Tech Fit Score</span>
          <div className={`text-xl font-bold ${account.tech_fit_score >= 70 ? 'text-emerald-600' : account.tech_fit_score >= 40 ? 'text-amber-600' : 'text-apptivia-carbon-400'}`}>
            {account.tech_fit_score ?? '—'}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {(account.ai_summary || account.ai_strategy) && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center gap-2">
            <Sparkles size={14} className="text-white" />
            <span className="text-sm font-semibold text-white">AI Account Intelligence</span>
          </div>
          <div className="p-5 space-y-4">
            {account.ai_summary && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Summary</span>
                <p className="text-xs text-apptivia-carbon-700 leading-relaxed">{account.ai_summary}</p>
              </div>
            )}
            {account.ai_strategy && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Recommended Strategy</span>
                <p className="text-xs text-apptivia-carbon-700 leading-relaxed">{account.ai_strategy}</p>
              </div>
            )}
            {account.ai_risk_factors?.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-apptivia-carbon-600 block mb-1.5">Risk Factors</span>
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
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
        <span className="text-xs font-semibold text-apptivia-carbon-700 block mb-2">Account Tier</span>
        <div className="flex gap-2">
          {Object.entries(TIER_STYLES).map(([key, style]) => (
            <button key={key} onClick={() => onUpdate(account.id, { tier: key })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                account.tier === key
                  ? `${style.bg} ${style.text} ring-2 ring-offset-1 ring-current`
                  : 'bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'
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
        onFindContacts={onNavigateDiscover ? () => onNavigateDiscover({ mode: 'people_search', findPeopleMode: 'company', query: account.domain || account.account_name }) : undefined}
      />

      {/* Signal Contacts — only shown if promoted from Signal Prospecting */}
      {signalContacts.length > 0 && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
          <button
            onClick={() => setShowContacts(!showContacts)}
            className="flex items-center justify-between w-full"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-apptivia-carbon-700">
              <Users size={13} className="text-teal-500" />
              Signal Contacts ({signalContacts.length})
            </span>
            {showContacts ? <ChevronUp size={13} className="text-apptivia-carbon-400" /> : <ChevronDown size={13} className="text-apptivia-carbon-400" />}
          </button>
          {showContacts && (
            <div className="mt-3 space-y-2 pt-3 border-t border-apptivia-carbon-100">
              {signalContacts.map((person, i) => (
                <div key={person.id || i} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {(person.first_name?.[0] || person.name?.[0] || '?').toUpperCase()}
                    {(person.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-apptivia-ink block truncate">{person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown'}</span>
                    {person.title && <span className="text-[10px] text-apptivia-carbon-500 block truncate">{person.title}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                    {person.email && (
                      <button onClick={() => navigator.clipboard.writeText(person.email)}
                        className="p-1 rounded text-apptivia-coral-tone-300 hover:text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
                        title={person.email}><Mail size={12} /></button>
                    )}
                    {person.phone && (
                      <button onClick={() => navigator.clipboard.writeText(person.phone)}
                        className="p-1 rounded text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title={person.phone}><Phone size={12} /></button>
                    )}
                    {person.linkedin_url && (
                      <a href={person.linkedin_url} target="_blank" rel="noreferrer"
                        className="p-1 rounded text-apptivia-coral-tone-300 hover:text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
                        title="LinkedIn"><Linkedin size={12} /></a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Deal Modal ────────────────────────────────────

function CreateDealModal({ isOpen, onClose, account, organizationId, userId }) {
  const defaultCloseDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [form, setForm] = useState({
    deal_name: '',
    deal_value: '',
    close_date: defaultCloseDate,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && account) {
      setForm(f => ({ ...f, deal_name: account.account_name }));
      setError('');
      setSuccess(false);
    }
  }, [isOpen, account]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deal_name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('engage_pipeline_deals')
        .insert({
          organization_id: organizationId,
          owner_id: userId || null,
          deal_name: form.deal_name.trim(),
          deal_value: parseFloat(form.deal_value) || 0,
          stage: 'discovery',
          probability: 20,
          close_date: form.close_date || null,
          forecast_category: 'pipeline',
          source: 'signal_prospecting',
          account_id: account.id,
        });
      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => { onClose(); setSuccess(false); }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-apptivia-ink">Create Deal</h2>
            <p className="text-xs text-apptivia-carbon-500 mt-0.5">{account.account_name} · Starts at Discovery stage</p>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
        </div>
        {success ? (
          <div className="flex items-center justify-center gap-2 py-6 text-emerald-600">
            <CheckCircle size={18} /> <span className="text-sm font-medium">Deal created!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Deal Name</label>
              <input
                value={form.deal_name}
                onChange={e => setForm(f => ({ ...f, deal_name: e.target.value }))}
                placeholder="e.g. CloudEagle.ai — Discovery"
                className="w-full text-sm border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Deal Value ($)</label>
                <input
                  type="number"
                  min="0"
                  value={form.deal_value}
                  onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))}
                  placeholder="0"
                  className="w-full text-sm border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-600 mb-1">Target Close Date</label>
                <input
                  type="date"
                  value={form.close_date}
                  onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))}
                  className="w-full text-sm border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-apptivia-coral-tone-50 rounded-lg">
              <DollarSign size={12} className="text-apptivia-coral flex-shrink-0" />
              <span className="text-[11px] text-apptivia-coral">Stage locked to <strong>Discovery</strong> until you validate the opportunity.</span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 text-sm text-apptivia-carbon-500 border border-apptivia-carbon-200 rounded-lg hover:bg-apptivia-paper">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 text-sm font-semibold text-white bg-apptivia-ink rounded-lg hover:bg-apptivia-coral-tone-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Loader size={13} className="animate-spin" /> Creating...</> : 'Create Deal'}
              </button>
            </div>
          </form>
        )}
      </div>
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
        <button onClick={onClose} className="absolute top-4 right-4 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-apptivia-ink mb-5">New Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Account Name *</label>
            <input
              value={form.account_name}
              onChange={(e) => setForm(p => ({ ...p, account_name: e.target.value }))}
              placeholder="e.g., Acme Corp"
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Domain</label>
              <input
                value={form.domain}
                onChange={(e) => setForm(p => ({ ...p, domain: e.target.value }))}
                placeholder="acme.com"
                className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setForm(p => ({ ...p, industry: e.target.value }))}
                placeholder="e.g., SaaS"
                className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Tier</label>
            <div className="flex gap-2">
              {Object.entries(TIER_STYLES).map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, tier: key }))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    form.tier === key ? `${style.bg} ${style.text} ring-1 ring-current` : 'bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'
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
              className="px-4 py-2 text-sm font-medium text-apptivia-carbon-700 bg-apptivia-carbon-100 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.account_name.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-apptivia-coral rounded-md hover:bg-apptivia-coral disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

export default function AccountIntelligence({ organizationId, userId, initialAccountId, onInitialAccountConsumed, onNavigateDiscover }) {
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

  // Auto-select account when navigated from Signal Prospecting
  useEffect(() => {
    if (!initialAccountId || accounts.length === 0) return;
    const found = accounts.find(a => a.id === initialAccountId);
    if (found) {
      setSelectedAccount(found);
      setView('detail');
      if (onInitialAccountConsumed) onInitialAccountConsumed();
    }
  }, [initialAccountId, accounts]);

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
        <RefreshCw size={20} className="text-apptivia-coral animate-spin" />
        <span className="text-sm text-apptivia-carbon-500 ml-3">Loading accounts...</span>
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
        organizationId={organizationId}
        userId={userId}
        onNavigateDiscover={onNavigateDiscover}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SummaryCards summary={summary} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
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
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${filterTier === 'all' ? 'bg-apptivia-coral text-white' : 'bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'}`}>
              All
            </button>
            {Object.entries(TIER_STYLES).filter(([k]) => k !== 'untiered').map(([key, style]) => (
              <button key={key} onClick={() => setFilterTier(key)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${filterTier === key ? `${style.bg} ${style.text}` : 'bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'}`}>
                {style.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={importFromCompanies}
            className="flex items-center gap-1.5 px-3 py-2 bg-apptivia-carbon-100 text-apptivia-carbon-600 rounded-lg text-xs font-medium hover:bg-apptivia-carbon-200 transition-colors">
            <ArrowRight size={12} /> Import Companies
          </button>
          <button onClick={scoreAllAccounts} disabled={analyzing}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors disabled:opacity-50">
            {analyzing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} Score All
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-apptivia-ink text-white rounded-lg text-xs font-semibold hover:bg-apptivia-coral-tone-600 transition-all shadow-sm">
            <Plus size={14} /> New Account
          </button>
        </div>
      </div>

      {/* Account List */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-12 text-center">
          <div className="w-16 h-16 bg-apptivia-coral-tone-50 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-apptivia-coral" />
          </div>
          <h3 className="text-base font-bold text-apptivia-ink mb-1">
            {accounts.length === 0 ? 'No accounts yet' : 'No matching accounts'}
          </h3>
          <p className="text-xs text-apptivia-carbon-500 mb-4 max-w-sm mx-auto">
            {accounts.length === 0
              ? 'Create target accounts or import from your company research to get started with account-based intelligence.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {accounts.length === 0 && (
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowNew(true)}
                className="px-5 py-2.5 bg-apptivia-coral text-white rounded-lg text-xs font-semibold hover:bg-apptivia-coral transition-colors">
                Create Account
              </button>
              <button onClick={importFromCompanies}
                className="px-5 py-2.5 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg text-xs font-semibold hover:bg-apptivia-carbon-200 transition-colors">
                Import from Companies
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredAccounts.map((account) => (
            <AccountCard key={account.id} account={account} onSelect={handleSelectAccount} icpConfig={icpConfig} onNavigateDiscover={onNavigateDiscover} />
          ))}
        </div>
      )}

      <NewAccountModal isOpen={showNew} onClose={() => setShowNew(false)} onCreate={createAccount} />
    </div>
  );
}
