import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radar, Zap, AlertTriangle, TrendingUp, Search, RefreshCw,
  Eye, EyeOff, CheckCircle, XCircle, ExternalLink, Sparkles, Filter,
  ChevronDown, ChevronRight, Target, Building2, Briefcase, DollarSign,
  Newspaper, Settings, X, Users, UserCheck, Rocket,
  Trophy, Mic, Star, Megaphone, TrendingDown, Layers, Trash2,
  Mail, Phone, Linkedin, UserPlus, Loader, MessageSquare, Clock,
  FileText, ThumbsDown, MessageCircle, Monitor,
  Flame, BarChart2, ArrowRight, CheckCheck, Copy, Plus
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSignalProspecting } from '../hooks/useSignalProspecting';
import { getSignalTier, getSignalCategory } from '../constants/signalThresholds';
import { useIcpProspector } from '../hooks/useIcpProspector';
import ConfirmModal from './ConfirmModal';
import Tooltip from './shared/Tooltip';
import SignalOutreachModal from './SignalOutreachModal';
import QuickAddSignalModal from './QuickAddSignalModal';

const SIGNAL_ICONS = {
  // === BUYER INTENT (Highest Value) ===
  solution_search: { icon: Search, color: 'text-emerald-600 bg-emerald-50' },
  pain_point: { icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
  icp_job_posting: { icon: Users, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
  tech_stack_churn: { icon: RefreshCw, color: 'text-orange-600 bg-orange-50' },
  competitor_comparison: { icon: Target, color: 'text-amber-600 bg-amber-50' },
  competitor_complaint: { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  
  // === COMPETITIVE INTELLIGENCE ===
  competitor_engagement: { icon: Target, color: 'text-red-600 bg-red-50' },
  
  // === COMPANY EVENTS ===
  funding: { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  leadership_change: { icon: UserCheck, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
  expansion: { icon: TrendingUp, color: 'text-green-600 bg-green-50' },
  layoffs: { icon: TrendingDown, color: 'text-rose-600 bg-rose-50' },
  contract_win: { icon: Trophy, color: 'text-yellow-600 bg-yellow-50' },
  product_launch: { icon: Rocket, color: 'text-pink-600 bg-pink-50' },
  product_hunt_launch: { icon: Rocket, color: 'text-orange-600 bg-orange-50' },
  hiring_velocity:     { icon: Flame,    color: 'text-red-600 bg-red-50' },
  dept_expansion:      { icon: BarChart2, color: 'text-teal-600 bg-teal-50' },

  // === ENGAGEMENT ===
  hiring: { icon: Building2, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
  job_change: { icon: Briefcase, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
  content_engagement: { icon: Newspaper, color: 'text-amber-600 bg-amber-50' },
  event_participation: { icon: Mic, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
  review_sentiment: { icon: Star, color: 'text-orange-600 bg-orange-50' },
  g2_review:        { icon: Star, color: 'text-green-600 bg-green-50' },
  capterra_review:  { icon: Star, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
  press_release: { icon: Megaphone, color: 'text-sky-600 bg-sky-50' },
  tech_adoption: { icon: Settings, color: 'text-cyan-600 bg-cyan-50' },

  // === DATA SOURCES ===
  sec_filing:               { icon: FileText,      color: 'text-apptivia-ink bg-apptivia-carbon-100' },
  glassdoor_sentiment:          { icon: ThumbsDown, color: 'text-orange-600 bg-orange-50' },
  glassdoor_leadership_concern: { icon: ThumbsDown, color: 'text-red-600 bg-red-50' },
  glassdoor_culture_issue:      { icon: ThumbsDown, color: 'text-rose-600 bg-rose-50' },
  glassdoor_rating_decline:     { icon: ThumbsDown, color: 'text-amber-600 bg-amber-50' },
  reddit_signal:            { icon: MessageCircle, color: 'text-red-600 bg-red-50' },
  reddit_buying_intent:     { icon: MessageCircle, color: 'text-emerald-600 bg-emerald-50' },
  reddit_churn_risk:        { icon: MessageCircle, color: 'text-rose-600 bg-rose-50' },
  reddit_competitor_mention:{ icon: MessageCircle, color: 'text-amber-600 bg-amber-50' },

  // === WEBSITE VISITOR ID ===
  website_visit:            { icon: Monitor,       color: 'text-teal-600 bg-teal-50' },
};

const STRENGTH_COLORS = {
  very_high: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-apptivia-carbon-400',
};

const STATUS_STYLES = {
  new: { bg: 'bg-apptivia-coral-tone-50', text: 'text-apptivia-coral', label: 'New' },
  reviewed: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Reviewed' },
  actioned: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Actioned' },
  dismissed: { bg: 'bg-apptivia-paper', text: 'text-apptivia-carbon-500', label: 'Dismissed' },
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

function signalAge(dateStr) {
  if (!dateStr) return null;
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) return { label: 'Fresh', color: 'text-emerald-600 bg-emerald-50', stale: false, days };
  if (days < 3) return { label: `${Math.floor(days)}d`, color: 'text-apptivia-coral bg-apptivia-coral-tone-50', stale: false, days };
  if (days < 7) return { label: 'Aging', color: 'text-amber-600 bg-amber-50', stale: false, days };
  return { label: 'Stale', color: 'text-apptivia-carbon-500 bg-apptivia-carbon-100', stale: true, days };
}

// ── Action Queue Panel ────────────────────────────────────

const DISMISSAL_CATEGORIES = [
  { key: 'wrong_target', label: 'Wrong Target', icon: UserPlus },
  { key: 'wrong_timing', label: 'Wrong Timing', icon: Clock },
  { key: 'wrong_message', label: 'Wrong Message', icon: MessageSquare },
  { key: 'already_handled', label: 'Already Handled', icon: CheckCheck },
  { key: 'low_priority', label: 'Low Priority', icon: TrendingDown },
  { key: 'other', label: 'Other', icon: FileText },
];

// [SPEC 09] Multi-step play types
const PLAY_TYPES = [
  { key: 'pre_call_nurture',    label: 'Pre-Call Nurture',     icon: Phone,     desc: 'Warm before discovery call' },
  { key: 'post_call_follow_up', label: 'Post-Call Follow-Up',  icon: Mail,      desc: 'Reinforce after a call' },
  { key: 'no_show_recovery',    label: 'No-Show Recovery',     icon: RefreshCw, desc: 'Re-engage after missed meeting' },
  { key: 'lead_reactivation',   label: 'Lead Reactivation',    icon: Zap,       desc: 'Re-warm a cold lead' },
  { key: 'social_to_pipeline',  label: 'Social to Pipeline',   icon: Linkedin,  desc: 'LinkedIn engagement to meeting' },
];

const STEP_CHANNEL_META = {
  email:                 { icon: Mail,          color: 'text-apptivia-coral',   label: 'Email' },
  linkedin_dm:           { icon: MessageCircle, color: 'text-apptivia-coral',   label: 'LinkedIn DM' },
  linkedin_connection:   { icon: UserPlus,      color: 'text-apptivia-coral',   label: 'LinkedIn Connect' },
  phone_call:            { icon: Phone,         color: 'text-green-500',  label: 'Phone Call' },
  task:                  { icon: FileText,      color: 'text-apptivia-ink', label: 'Task' },
};

const STEP_STATUS_BADGE = {
  pending:                 { label: 'Pending',  color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' },
  sent:                    { label: 'Sent',     color: 'bg-green-100 text-green-700' },
  replied:                 { label: 'Replied',  color: 'bg-emerald-100 text-emerald-700' },
  skipped_replied_earlier: { label: 'Skipped',  color: 'bg-yellow-100 text-yellow-600' },
  cancelled:               { label: 'Cancelled', color: 'bg-red-100 text-red-600' },
  failed:                  { label: 'Failed',   color: 'bg-red-100 text-red-700' },
};

function ActionQueuePanel({
  actionQueue, actionQueueLoading, lastScanAt, nextScanAt,
  onApprove, onDismiss, onSend,
  onExpandToPlay, onFetchSteps, onUpdateStep, actionSteps, expandingActionId,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('engage_action_queue_collapsed') !== 'false'; } catch { return true; }
  });
  const toggleCollapsed = () => {
    setCollapsed(prev => { const next = !prev; try { localStorage.setItem('engage_action_queue_collapsed', String(next)); } catch {} return next; });
  };
  const [expandedId, setExpandedId] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  // Dismissal state per item
  const [dismissingId, setDismissingId] = useState(null);
  const [dismissCategory, setDismissCategory] = useState(null);
  const [dismissReason, setDismissReason] = useState('');
  // Editable draft state per item
  const [editSubject, setEditSubject] = useState({});
  const [editBody, setEditBody] = useState({});
  const [editRecipient, setEditRecipient] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [sendError, setSendError] = useState({});
  // [SPEC 09] Play selector state
  const [showPlaySelector, setShowPlaySelector] = useState(null);

  // Auto-fetch steps for expanded plays
  useEffect(() => {
    for (const item of actionQueue) {
      if (item.play_type && item.play_type !== 'single_action' && !actionSteps?.[item.id] && onFetchSteps) {
        onFetchSteps(item.id);
      }
    }
  }, [actionQueue, actionSteps, onFetchSteps]);

  if (!actionQueueLoading && actionQueue.length === 0) return null;

  const handleBulkApprove = async () => {
    setBulkProcessing(true);
    try {
      for (const item of actionQueue) {
        await onApprove(item.id);
      }
    } catch (err) {
      console.error('Bulk approve error:', err);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDismiss = async () => {
    setBulkProcessing(true);
    try {
      for (const item of actionQueue) {
        await onDismiss(item.id);
      }
    } catch (err) {
      console.error('Bulk dismiss error:', err);
    } finally {
      setBulkProcessing(false);
    }
  };

  const openDismissFlow = (itemId) => {
    setDismissingId(itemId);
    setDismissCategory(null);
    setDismissReason('');
  };

  const confirmDismiss = async () => {
    if (!dismissingId || !dismissCategory) return;
    try {
      await onDismiss(dismissingId, dismissCategory, dismissReason || undefined);
    } catch (err) {
      console.error('Dismiss error:', err);
    } finally {
      setDismissingId(null);
      setDismissCategory(null);
      setDismissReason('');
    }
  };

  const handleExpand = (item) => {
    const id = item.id;
    const isExpanding = expandedId !== id;
    setExpandedId(isExpanding ? id : null);
    // Initialize editable fields when expanding
    if (isExpanding) {
      setEditSubject(prev => ({ ...prev, [id]: prev[id] ?? (item.draft_email_subject || '') }));
      setEditBody(prev => ({ ...prev, [id]: prev[id] ?? (item.draft_email_body || '') }));
    }
  };

  const handleSend = async (item) => {
    setSendingId(item.id);
    setSendError(prev => { const n = { ...prev }; delete n[item.id]; return n; });
    try {
      const subject = editSubject[item.id] ?? item.draft_email_subject ?? '';
      const body = editBody[item.id] ?? item.draft_email_body ?? '';
      const recipient = editRecipient[item.id] ?? '';
      await onSend(item.id, subject, body, recipient || undefined);
      // Clear edit state for this item
      setEditSubject(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      setEditBody(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      setEditRecipient(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      setExpandedId(null);
    } catch (err) {
      console.error('Send error:', err);
      let msg = 'Failed to send email';
      try {
        const parsed = JSON.parse(err?.message || '{}');
        msg = parsed.error || msg;
      } catch { msg = err?.message || msg; }
      setSendError(prev => ({ ...prev, [item.id]: msg }));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="bg-apptivia-coral-tone-50 rounded-lg border border-apptivia-carbon-300 p-4 space-y-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={toggleCollapsed}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-apptivia-ink rounded-lg flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {collapsed ? <ChevronRight size={14} className="text-apptivia-carbon-500" /> : <ChevronDown size={14} className="text-apptivia-carbon-500" />}
              <h3 className="text-sm font-semibold text-apptivia-ink">Action Queue</h3>
              {actionQueue.length > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-apptivia-ink text-white text-[10px] font-bold">
                  {actionQueue.length}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-ink font-medium">
                <Clock size={8} /> Auto-drafted
              </span>
            </div>
            <p className="text-[11px] text-apptivia-carbon-500">
              AI-drafted outreach ready for your review
              {lastScanAt && (
                <span className="ml-2 text-apptivia-carbon-400">· Last scan: {timeAgo(lastScanAt)}</span>
              )}
              {nextScanAt && (
                <span className="ml-1 text-apptivia-carbon-400">· Next: {new Date(nextScanAt).toLocaleDateString()}</span>
              )}
            </p>
          </div>
        </div>
        {/* Bulk actions */}
        {!collapsed && actionQueue.length > 1 && !bulkProcessing && (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleBulkApprove}
              className="text-[10px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
            >
              <CheckCircle size={10} /> Approve All
            </button>
            <button
              onClick={handleBulkDismiss}
              className="text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-paper text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors"
            >
              Dismiss All
            </button>
          </div>
        )}
        {bulkProcessing && (
          <span className="text-[10px] text-apptivia-ink flex items-center gap-1">
            <Loader size={10} className="animate-spin" /> Processing...
          </span>
        )}
      </div>

      {!collapsed && actionQueueLoading && (
        <div className="flex items-center gap-2 text-xs text-apptivia-ink py-1">
          <Loader size={12} className="animate-spin" /> Loading action queue...
        </div>
      )}

      {!collapsed && <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {actionQueue.map((item) => {
          const signal = item.signal;
          const isExpanded = expandedId === item.id;
          const isDismissing = dismissingId === item.id;
          const isSending = sendingId === item.id;
          const signalInfo = SIGNAL_ICONS[signal?.signal_type] || {};

          return (
            <div key={item.id} className="bg-white rounded-lg border border-apptivia-carbon-300 p-3 space-y-2">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${signalInfo.color || 'text-apptivia-carbon-500 bg-apptivia-paper'}`}>
                    {signalInfo.icon ? React.createElement(signalInfo.icon, { size: 12 }) : <Zap size={12} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-apptivia-ink truncate">{signal?.company_name || 'Unknown Company'}</p>
                    <p className="text-[11px] text-apptivia-carbon-500 truncate">{signal?.title || signal?.signal_type}</p>
                  </div>
                  {signal?.signal_score != null && (
                    <Tooltip text={`Intent Score: ${signal.signal_score}/100 — AI-assigned signal strength based on relevance and buying intent`}>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-ink flex-shrink-0 cursor-help">
                        {signal.signal_score}
                      </span>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleExpand(item)}
                    className="text-[11px] text-apptivia-ink hover:text-apptivia-ink font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 hover:bg-apptivia-carbon-100 transition-colors"
                  >
                    {isExpanded ? 'Hide' : 'View Draft'}
                  </button>
                  {item.status === 'pending' && (
                    <button
                      onClick={() => onApprove(item.id)}
                      className="text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle size={10} /> Approve
                    </button>
                  )}
                  {item.status === 'approved' && (!item.play_type || item.play_type === 'single_action') && (
                    <button
                      onClick={() => setShowPlaySelector(showPlaySelector === item.id ? null : item.id)}
                      className="text-[11px] font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 transition-colors flex items-center gap-1"
                    >
                      <Layers size={10} /> Expand to Play
                    </button>
                  )}
                  {item.status === 'approved' && item.play_type && item.play_type !== 'single_action' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-ink flex items-center gap-1">
                      <Layers size={9} /> {PLAY_TYPES.find(p => p.key === item.play_type)?.label || item.play_type}
                    </span>
                  )}
                  {item.status === 'pending' && (
                    <button
                      onClick={() => openDismissFlow(item.id)}
                      className="p-1 rounded-md bg-apptivia-paper text-apptivia-carbon-400 hover:bg-apptivia-carbon-100 hover:text-apptivia-carbon-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Outreach angle summary */}
              {item.outreach_angle && !isExpanded && !isDismissing && (
                <p className="text-[11px] text-apptivia-carbon-600 italic line-clamp-2 ml-8">{item.outreach_angle}</p>
              )}

              {/* ── Dismissal chip selector ── */}
              {isDismissing && (
                <div className="border-t border-apptivia-carbon-100 pt-2 space-y-2">
                  <p className="text-[11px] font-medium text-apptivia-carbon-700">Why are you dismissing this?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DISMISSAL_CATEGORIES.map((cat) => {
                      const isSelected = dismissCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setDismissCategory(cat.key)}
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                            isSelected
                              ? 'bg-apptivia-carbon-100 border-apptivia-carbon-300 text-apptivia-ink'
                              : 'bg-white border-apptivia-carbon-200 text-apptivia-carbon-600 hover:bg-apptivia-paper hover:border-apptivia-carbon-300'
                          }`}
                        >
                          {React.createElement(cat.icon, { size: 10 })} {cat.label}
                        </button>
                      );
                    })}
                  </div>
                  {dismissCategory && (
                    <input
                      type="text"
                      placeholder="Optional: tell us more..."
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                      className="w-full text-xs text-apptivia-carbon-700 border border-apptivia-carbon-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300 placeholder-gray-400"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-apptivia-ink italic">Aaron will learn from this</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setDismissingId(null)}
                        className="text-[11px] text-apptivia-carbon-500 hover:text-apptivia-carbon-700 px-2 py-1 rounded-md hover:bg-apptivia-paper transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDismiss}
                        disabled={!dismissCategory}
                        className={`text-[11px] font-medium px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                          dismissCategory
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-apptivia-paper text-apptivia-carbon-400 cursor-not-allowed'
                        }`}
                      >
                        <ThumbsDown size={10} /> Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Expanded editable draft ── */}
              {isExpanded && !isDismissing && (
                <div className="ml-0 space-y-2 border-t border-apptivia-carbon-300 pt-2">
                  <div>
                    <p className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-0.5">To</p>
                    <input
                      type="email"
                      placeholder="recipient@company.com"
                      value={editRecipient[item.id] ?? ''}
                      onChange={(e) => setEditRecipient(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full text-xs text-apptivia-ink font-medium border border-apptivia-carbon-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
                    />
                  </div>
                  {item.draft_email_subject && (
                    <div>
                      <p className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-0.5">Subject</p>
                      <input
                        type="text"
                        value={editSubject[item.id] ?? item.draft_email_subject}
                        onChange={(e) => setEditSubject(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-full text-xs text-apptivia-ink font-medium border border-apptivia-carbon-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
                      />
                    </div>
                  )}
                  {item.draft_email_body && (
                    <div>
                      <p className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-0.5">Body</p>
                      <textarea
                        value={editBody[item.id] ?? item.draft_email_body}
                        onChange={(e) => setEditBody(prev => ({ ...prev, [item.id]: e.target.value }))}
                        rows={6}
                        className="w-full text-xs text-apptivia-carbon-700 border border-apptivia-carbon-200 rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
                      />
                    </div>
                  )}
                  {item.draft_linkedin_message && (
                    <div>
                      <p className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-0.5">LinkedIn Message</p>
                      <textarea
                        readOnly
                        value={item.draft_linkedin_message}
                        rows={3}
                        className="w-full text-xs text-apptivia-carbon-700 bg-apptivia-paper border border-apptivia-carbon-200 rounded-md p-2 resize-none focus:outline-none"
                      />
                    </div>
                  )}
                  {sendError[item.id] && (
                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                      {sendError[item.id]}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-apptivia-ink italic">Aaron will learn from your edits</p>
                    <button
                      onClick={() => handleSend(item)}
                      disabled={isSending}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-md bg-apptivia-ink text-white hover:bg-apptivia-ink transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {isSending ? (
                        <><Loader size={10} className="animate-spin" /> Sending...</>
                      ) : (
                        <><Mail size={10} /> Send via Gmail</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* [SPEC 09] Play type selector */}
              {showPlaySelector === item.id && (
                <div className="border-t border-apptivia-carbon-300 pt-2 space-y-2">
                  <p className="text-[11px] font-medium text-apptivia-carbon-700">Select a play type:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAY_TYPES.map((pt) => (
                      <button
                        key={pt.key}
                        onClick={() => { onExpandToPlay(item.id, pt.key); setShowPlaySelector(null); }}
                        disabled={expandingActionId === item.id}
                        title={pt.desc}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white border-apptivia-carbon-200 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 hover:border-apptivia-carbon-300 hover:text-apptivia-ink transition-colors disabled:opacity-50"
                      >
                        {React.createElement(pt.icon, { size: 10 })} {pt.label}
                      </button>
                    ))}
                  </div>
                  {expandingActionId === item.id && (
                    <span className="text-[10px] text-apptivia-ink flex items-center gap-1">
                      <Loader size={10} className="animate-spin" /> Generating play steps...
                    </span>
                  )}
                </div>
              )}

              {/* [SPEC 09] Step timeline for expanded plays */}
              {item.play_type && item.play_type !== 'single_action' && (actionSteps?.[item.id] || []).length > 0 && (
                <div className="border-t border-apptivia-carbon-300 pt-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Layers size={10} className="text-apptivia-ink" />
                    <span className="text-[10px] font-semibold text-apptivia-ink uppercase tracking-wide">
                      {PLAY_TYPES.find(p => p.key === item.play_type)?.label || item.play_type}
                    </span>
                    <span className="text-[10px] text-apptivia-carbon-400">
                      {(actionSteps[item.id] || []).filter(s => s.status === 'sent' || s.status === 'replied').length}/{(actionSteps[item.id] || []).length} complete
                    </span>
                  </div>
                  {(actionSteps[item.id] || []).map((step) => {
                    const ch = STEP_CHANNEL_META[step.channel] || STEP_CHANNEL_META.task;
                    const badge = STEP_STATUS_BADGE[step.status] || STEP_STATUS_BADGE.pending;
                    return (
                      <div key={step.id} className="flex items-start gap-2 p-2 bg-apptivia-paper rounded-lg">
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${ch.color} bg-white border border-apptivia-carbon-100`}>
                          {React.createElement(ch.icon, { size: 10 })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-apptivia-carbon-700">Step {step.step_order}: {ch.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                          {step.draft_subject && (
                            <p className="text-[10px] text-apptivia-carbon-600 font-medium truncate">Subject: {step.draft_subject}</p>
                          )}
                          <p className="text-[10px] text-apptivia-carbon-500 line-clamp-2">{step.draft_body}</p>
                          <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">
                            {step.status === 'sent' && step.sent_at
                              ? `Sent ${new Date(step.sent_at).toLocaleDateString()}`
                              : `Scheduled: ${new Date(step.scheduled_for).toLocaleDateString()} ${new Date(step.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            }
                          </p>
                        </div>
                        {step.status === 'pending' && onUpdateStep && (
                          <button
                            onClick={() => onUpdateStep(step.id, item.id, { status: 'cancelled' })}
                            className="p-1 rounded text-apptivia-carbon-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Cancel step"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ── Summary Cards ─────────────────────────────────────────

function SignalSummaryCards({ summary }) {
  const cards = [
    { label: 'Total Signals', value: summary.totalSignals, icon: Radar, color: 'text-apptivia-coral bg-apptivia-coral-tone-50' },
    { label: 'New (Unreviewed)', value: summary.newSignals, icon: Zap, color: 'text-amber-600 bg-amber-50' },
    { label: 'High Intent', value: summary.highIntentCount, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Companies Tracked', value: summary.topCompanies.length, icon: Building2, color: 'text-apptivia-ink bg-apptivia-carbon-100' },
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

// ── Buying Stage Funnel ──────────────────────────────────

function BuyingStageFunnel({ byBuyingStage = {} }) {
  const total = (byBuyingStage.awareness || 0) + (byBuyingStage.consideration || 0) + (byBuyingStage.decision || 0);
  if (total === 0) return null;

  const stages = [
    { key: 'awareness', label: 'Awareness', color: 'bg-apptivia-coral', bgColor: 'bg-apptivia-coral-tone-50', textColor: 'text-apptivia-coral' },
    { key: 'consideration', label: 'Consideration', color: 'bg-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
    { key: 'decision', label: 'Decision', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  ];

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={16} className="text-apptivia-carbon-500" />
        <span className="text-sm font-semibold text-apptivia-carbon-700">Buying Stage Distribution</span>
      </div>
      <div className="flex items-center h-8 rounded-lg overflow-hidden">
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

// ── Signal Contacts Section ───────────────────────────────

function SignalContactsSection({ companyName, contacts, isEnriching, onEnrich, onCallContact, onEmailContact, onResearchContact }) {
  if (contacts && contacts.length > 0) {
    return (
      <div className="mt-2 pt-2 border-t border-apptivia-carbon-100">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Users size={10} className="text-teal-500" />
          <span className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase tracking-wide">Key Contacts</span>
        </div>
        <div className="space-y-1.5">
          {contacts.map((person, i) => (
            <div key={person.id || i} className="flex items-center gap-2 group/contact">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 select-none">
                {(person.first_name?.[0] || person.name?.[0] || '?').toUpperCase()}
                {(person.last_name?.[0] || '').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold text-apptivia-ink truncate block">{person.name || 'Unknown'}</span>
                <span className="text-[9px] text-apptivia-carbon-500 truncate block">{person.title}</span>
              </div>
              <div className="flex items-center gap-1 opacity-50 group-hover/contact:opacity-100 transition-opacity">
                {person.email && (
                  <button
                    onClick={() => onEmailContact ? onEmailContact(person) : navigator.clipboard.writeText(person.email)}
                    className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                    title={onEmailContact ? `Draft email to ${person.name || person.email}` : `Copy email: ${person.email}`}
                  >
                    <Mail size={10} />
                  </button>
                )}
                {person.phone && (
                  <button
                    onClick={() => onCallContact
                      ? onCallContact({ name: person.name || 'Unknown', phone: person.phone, company_name: companyName })
                      : navigator.clipboard.writeText(person.phone)
                    }
                    className="text-emerald-400 hover:text-emerald-600 transition-colors"
                    title={onCallContact ? `Call ${person.name || person.phone}` : `Copy phone: ${person.phone}`}
                  >
                    <Phone size={10} />
                  </button>
                )}
                {person.linkedin_url && (
                  <a
                    href={person.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                    title="LinkedIn profile"
                  >
                    <Linkedin size={10} />
                  </a>
                )}
                {onResearchContact && (
                  <button
                    onClick={() => onResearchContact(person)}
                    className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                    title={`Research ${person.name || 'prospect'}`}
                  >
                    <Eye size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (contacts && contacts.length === 0 && !isEnriching) {
    return (
      <div className="mt-2 pt-2 border-t border-apptivia-carbon-100">
        <span className="text-[10px] text-apptivia-carbon-400 italic">No contacts found for {companyName}</span>
      </div>
    );
  }

  if (isEnriching) {
    return (
      <div className="mt-2 pt-2 border-t border-apptivia-carbon-100 flex items-center gap-1.5">
        <Loader size={10} className="animate-spin text-teal-500" />
        <span className="text-[10px] text-apptivia-carbon-400">Finding contacts...</span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-apptivia-carbon-100">
      <button
        onClick={onEnrich}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-2 py-0.5 rounded transition-colors"
      >
        <UserPlus size={9} />
        Find contacts at {companyName}
      </button>
    </div>
  );
}

// ── Account Card (grouped by company) ────────────────────

const BUYING_STAGE_BADGE = {
  awareness:     { bg: 'bg-sky-50',     text: 'text-sky-700' },
  consideration: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  decision:      { bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

const AccountCard = React.memo(function AccountCard({ group, onAction, onDismiss, onResearchCompany, onFindCustomers, onFindContactsAtCompany, contacts, isEnriching, onEnrichCompany, onDraftMessage, companyContacts, enrichingCompanies, onPromoteToAccount, promotedAccountInfo, isPromoting, onCallContact, onClaimAccount, onResearchContact }) {
  const [expanded, setExpanded] = useState(false);
  const topSignal = group.signals[0];
  const hasHighIntent = group.signals.some((s) => getSignalTier(s.signal_score, getSignalCategory(s.signal_type)).label === 'T1');
  const domain = group.signals.find((s) => s.raw_data?.domain)?.raw_data?.domain || '';

  return (
    <div className={`bg-white rounded-lg border ${hasHighIntent ? 'border-amber-200' : 'border-apptivia-carbon-100'} p-4 hover:shadow-sm transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-apptivia-carbon-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {group.name[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-apptivia-ink">{group.name}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] text-apptivia-carbon-500">{group.signals.length} signal{group.signals.length !== 1 ? 's' : ''}</span>
              {group.stages.map((stage) => {
                const s = BUYING_STAGE_BADGE[stage];
                return s ? (
                  <span key={stage} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                    {stage}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>
        {/* Avg score */}
        <Tooltip text={`Avg Signal Score: ${group.avgScore}/100 — Average of all individual signal intent scores for this account`}>
          <div className={`flex-shrink-0 text-center px-2.5 py-1 rounded-lg cursor-help ${group.avgScore >= 70 ? 'bg-amber-50' : group.avgScore >= 50 ? 'bg-apptivia-coral-tone-50' : 'bg-apptivia-paper'}`}>
            <div className={`text-sm font-bold ${group.avgScore >= 70 ? 'text-amber-700' : group.avgScore >= 50 ? 'text-apptivia-coral' : 'text-apptivia-carbon-600'}`}>{group.avgScore}</div>
            <div className="text-[9px] text-apptivia-carbon-400">Avg Signal</div>
          </div>
        </Tooltip>
      </div>

      {/* Signal type chips */}
      <div className="flex flex-wrap gap-1 mb-3">
        {group.types.slice(0, 4).map((type) => {
          const iconCfg = SIGNAL_ICONS[type];
          const IconC = iconCfg?.icon;
          return (
            <span key={type} className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${iconCfg?.color || 'text-apptivia-carbon-500 bg-apptivia-paper'}`}>
              {IconC && <IconC size={8} />}
              {type.replace(/_/g, ' ')}
            </span>
          );
        })}
        {group.types.length > 4 && (
          <span className="text-[9px] text-apptivia-carbon-400 px-1.5 py-0.5">+{group.types.length - 4} more</span>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mb-2">
        {onResearchCompany && (
          <button
            onClick={() => onResearchCompany(group.name)}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
          >
            <Search size={9} /> Research
          </button>
        )}
        {onFindCustomers && (
          <button
            onClick={() => onFindCustomers(group.name)}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors"
          >
            <Users size={9} /> Find Customers
          </button>
        )}
        {onFindContactsAtCompany && (
          <button
            onClick={() => onFindContactsAtCompany(group.name, domain)}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
          >
            <UserPlus size={9} /> Find Contacts
          </button>
        )}
        {topSignal && onDraftMessage && (
          <button
            onClick={() => onDraftMessage(topSignal, companyContacts?.[group.name]?.[0])}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 transition-colors"
          >
            <MessageSquare size={9} /> Draft Message
          </button>
        )}
        {promotedAccountInfo ? (
          <>
            <button
              onClick={() => onPromoteToAccount?.(group, true)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
              title="View in Accounts tab"
            >
              <CheckCircle size={9} /> In Accounts <ArrowRight size={9} />
            </button>
            {!promotedAccountInfo.assigned_to && onClaimAccount && (
              <button
                onClick={() => onClaimAccount(promotedAccountInfo.id, group.name)}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                title="Claim this account"
              >
                <UserPlus size={9} /> Claim
              </button>
            )}
          </>
        ) : onPromoteToAccount && (
          <button
            onClick={() => onPromoteToAccount(group, false)}
            disabled={isPromoting}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 disabled:opacity-50 transition-colors"
            title="Promote to Accounts tab"
          >
            {isPromoting ? <Loader size={9} className="animate-spin" /> : <Building2 size={9} />} Promote
          </button>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto inline-flex items-center gap-1 text-[10px] text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors"
        >
          {expanded ? 'Hide' : `${group.signals.length} signals`}
          <ChevronDown size={9} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Contacts */}
      <SignalContactsSection
        companyName={group.name}
        contacts={companyContacts?.[group.name]}
        isEnriching={enrichingCompanies?.includes(group.name)}
        onEnrich={onEnrichCompany}
        onCallContact={onCallContact}
        onEmailContact={(person) => onDraftMessage?.(topSignal || { company_name: group.name, signal_type: 'icp_prospector', title: group.name }, person)}
        onResearchContact={onResearchContact}
      />

      {/* Expanded signals */}
      {expanded && (
        <div className="mt-3 space-y-2 pt-3 border-t border-apptivia-carbon-100">
          {group.signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAction={onAction}
              onDismiss={onDismiss}
              onResearchCompany={onResearchCompany}
              onFindCustomers={onFindCustomers}
              contacts={companyContacts?.[signal.company_name]}
              isEnriching={enrichingCompanies?.includes(signal.company_name)}
              onEnrichCompany={() => onEnrichCompany?.(signal.company_name)}
              onDraftMessage={onDraftMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Signal Card ───────────────────────────────────────────

const SignalCard = React.memo(function SignalCard({ signal, onAction, onDismiss, onResearchCompany, onFindCustomers, onFindContactsAtCompany, contacts, isEnriching, onEnrichCompany, onDraftMessage, onCallContact, onMarkOutcome, onResearchContact }) {
  const [expanded, setExpanded] = useState(false);
  const iconConfig = SIGNAL_ICONS[signal.signal_type] || SIGNAL_ICONS.competitor_engagement;
  const IconComp = iconConfig.icon;
  const statusStyle = STATUS_STYLES[signal.status] || STATUS_STYLES.new;
  const age = signalAge(signal.detected_at);

  // Buying stage badge styles
  const buyingStageStyles = {
    awareness: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Awareness' },
    consideration: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Consideration' },
    decision: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Decision' },
  };
  const stageStyle = signal.buying_stage_indicator ? buyingStageStyles[signal.buying_stage_indicator] : null;

  return (
    <div className={`bg-white rounded-lg border ${getSignalTier(signal.signal_score, getSignalCategory(signal.signal_type)).label === 'T1' ? 'border-amber-200' : 'border-apptivia-carbon-100'} p-4 hover:shadow-sm transition-shadow ${age?.stale ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconConfig.color}`}>
          <IconComp size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-apptivia-ink truncate">{signal.title}</h4>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
            {stageStyle && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stageStyle.bg} ${stageStyle.text}`}>
                {stageStyle.label}
              </span>
            )}
            {age?.label && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${age.color}`}>
                <Clock size={8} /> {age.label}
              </span>
            )}
            {signal.raw_data?.signal_subtype && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-carbon-600">
                {signal.raw_data.signal_subtype.replace(/_/g, ' ')}
              </span>
            )}
            {/* 4D: Tier badge based on category-specific thresholds */}
            {(() => {
              const tier = getSignalTier(signal.signal_score, getSignalCategory(signal.signal_type));
              return tier.label ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>
                  {tier.label}
                </span>
              ) : null;
            })()}
          </div>

          <div className="flex items-center gap-3 mb-2">
            {signal.company_name && (
              <span className="text-xs text-apptivia-carbon-500 flex items-center gap-1">
                <Building2 size={10} /> {signal.company_name}
              </span>
            )}
            <span className="text-xs text-apptivia-carbon-400">{timeAgo(signal.detected_at)}</span>
            <span className="text-xs text-apptivia-carbon-400 capitalize">{signal.source_platform}</span>
          </div>

          {signal.description && (
            <p className="text-xs text-apptivia-carbon-600 line-clamp-2 mb-2">{signal.description}</p>
          )}

          {/* Signal strength bar */}
          <div className="flex items-center gap-2 mb-2">
            <Tooltip text="AI-assigned signal strength (1-100). Higher scores indicate stronger buying intent or relevance to your ICP." position="right">
              <span className="text-[10px] text-apptivia-carbon-500 font-medium w-20 cursor-help">Intent Score</span>
            </Tooltip>
            <div className="flex-1 bg-apptivia-carbon-100 rounded-full h-1.5">
              <div
                className={`h-full rounded-full ${STRENGTH_COLORS[signal.signal_strength]} transition-all`}
                style={{ width: `${signal.signal_score}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-apptivia-carbon-700 w-8 text-right">{signal.signal_score}</span>
          </div>

          {/* AI Insights (expandable) */}
          {(signal.ai_summary || signal.ai_recommended_action) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-apptivia-ink font-medium flex items-center gap-1 mt-1 hover:text-apptivia-ink"
            >
              <Sparkles size={10} />
              {expanded ? 'Hide AI Insights' : 'View AI Insights'}
              <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {expanded && (
            <div className="mt-2 bg-apptivia-carbon-100/50 rounded-lg p-3 space-y-2">
              {signal.ai_summary && (
                <div>
                  <span className="text-[10px] font-medium text-apptivia-ink uppercase">Summary</span>
                  <p className="text-xs text-apptivia-carbon-700">{signal.ai_summary}</p>
                </div>
              )}
              {signal.ai_recommended_action && (
                <div>
                  <span className="text-[10px] font-medium text-apptivia-ink uppercase">Recommended Action</span>
                  <p className="text-xs text-apptivia-carbon-700">{signal.ai_recommended_action}</p>
                </div>
              )}
              {signal.ai_outreach_angle && (
                <div>
                  <span className="text-[10px] font-medium text-apptivia-ink uppercase">Outreach Angle</span>
                  <p className="text-xs text-apptivia-carbon-700">{signal.ai_outreach_angle}</p>
                </div>
              )}
              {/* Quick-action buttons inside AI Insights */}
              <div className="flex items-center gap-2 pt-2 border-t border-apptivia-carbon-300/50 mt-2">
                {signal.company_name && onResearchCompany && (
                  <button
                    onClick={() => onResearchCompany(signal.company_name)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
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
                {signal.company_name && onFindContactsAtCompany && (
                  <button
                    onClick={() => onFindContactsAtCompany(signal.company_name, signal.raw_data?.domain)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    <UserPlus size={10} /> Find Contacts at {signal.company_name}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Contacts — always visible on card face */}
          {signal.company_name && (
            <SignalContactsSection
              companyName={signal.company_name}
              contacts={contacts}
              isEnriching={isEnriching}
              onEnrich={onEnrichCompany}
              onCallContact={onCallContact}
              onEmailContact={(person) => onDraftMessage?.(signal, person)}
              onResearchContact={onResearchContact}
            />
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
                className="p-1.5 rounded-lg bg-apptivia-paper text-apptivia-carbon-400 hover:bg-apptivia-carbon-100 hover:text-apptivia-carbon-600 transition-colors"
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
              className="p-1.5 rounded-lg bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
              title="View source"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {onDraftMessage && (
            <button
              onClick={() => onDraftMessage(signal)}
              className="p-1.5 rounded-lg bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 transition-colors"
              title="Draft outreach message"
            >
              <MessageSquare size={14} />
            </button>
          )}
          {/* Outcome tracking — shown on actioned signals */}
          {signal.status === 'actioned' && onMarkOutcome && (
            signal.outcome ? (
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  signal.outcome === 'won'     ? 'bg-emerald-100 text-emerald-700' :
                  signal.outcome === 'lost'    ? 'bg-rose-100 text-rose-700' :
                                                 'bg-apptivia-carbon-100 text-apptivia-carbon-500'
                }`}>
                  {signal.outcome === 'won' ? '✓ Won' : signal.outcome === 'lost' ? '✗ Lost' : '⏳ Pending'}
                </span>
                {signal.contributed_to_deal_id && (
                  <a
                    href={`/engage?tab=pipeline&deal=${signal.contributed_to_deal_id}`}
                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors"
                    title="View linked deal"
                  >
                    View Deal →
                  </a>
                )}
              </div>
            ) : (
              <div className="relative group">
                <button
                  className="p-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                  title="Mark outcome"
                >
                  <CheckCheck size={14} />
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-10 overflow-hidden w-28">
                  <button onClick={() => onMarkOutcome(signal.id, 'won')}   className="px-3 py-1.5 text-[11px] text-left text-emerald-700 hover:bg-emerald-50 font-medium">✓ Won</button>
                  <button onClick={() => onMarkOutcome(signal.id, 'lost')}  className="px-3 py-1.5 text-[11px] text-left text-rose-600 hover:bg-rose-50 font-medium">✗ Lost</button>
                  <button onClick={() => onMarkOutcome(signal.id, 'pending')} className="px-3 py-1.5 text-[11px] text-left text-apptivia-carbon-600 hover:bg-apptivia-paper">⏳ Pursuing</button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
});

// ── Scan Results Panel ────────────────────────────────────

function ScanResultsPanel({ signals, lastScanSignalIds, onAction, onDismiss, onClear, onResearchCompany, onFindCustomers, onFindContactsAtCompany, companyContacts, enrichingCompanies, onEnrichCompany, onDraftMessage }) {
  const newSignals = signals.filter((s) => lastScanSignalIds.includes(s.id));

  if (newSignals.length === 0) return null;

  return (
    <div className="bg-apptivia-coral-tone-50 rounded-lg border border-cyan-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-apptivia-ink">Scan Results</h3>
            <p className="text-xs text-apptivia-carbon-500">{newSignals.length} new signal{newSignals.length !== 1 ? 's' : ''} detected</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors flex items-center gap-1"
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
            onFindContactsAtCompany={onFindContactsAtCompany}
            contacts={companyContacts?.[signal.company_name]}
            isEnriching={enrichingCompanies?.includes(signal.company_name)}
            onEnrichCompany={() => signal.company_name && onEnrichCompany(signal.company_name)}
            onDraftMessage={onDraftMessage}
          />
        ))}
      </div>
    </div>
  );
}

// ── Website Visitor Panel ─────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function TrackingScriptModal({ isOpen, onClose, organizationId }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<!-- Apptivia Visitor ID — paste before </body> -->
<script>(function(k){
  var s=sessionStorage.getItem('_apt')||(Math.random().toString(36).slice(2)+Date.now());
  sessionStorage.setItem('_apt',s);
  fetch('${BACKEND_URL}/track/visit',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({tracking_key:k,url:location.href,referrer:document.referrer,title:document.title,session_id:s})
  }).catch(function(){});
})('${organizationId}');</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-apptivia-ink">Website Visitor Tracking</h2>
            <p className="text-xs text-apptivia-carbon-500 mt-0.5">Paste this snippet on every page of your marketing site</p>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
        </div>
        <pre className="bg-apptivia-paper rounded-lg p-3 text-[10px] text-apptivia-carbon-700 overflow-x-auto whitespace-pre-wrap break-all border border-apptivia-carbon-200 font-mono leading-relaxed">
          {snippet}
        </pre>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            {copied ? <><CheckCheck size={14} /> Copied!</> : <><Copy size={14} /> Copy Snippet</>}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-apptivia-carbon-500 hover:text-apptivia-carbon-700">Close</button>
        </div>
        <p className="text-[10px] text-apptivia-carbon-400 mt-3">
          Identifies company visitors via IP lookup. Residential IPs and VPNs are filtered out automatically.
          Requires IPInfo token for best results — set <code className="bg-apptivia-carbon-100 px-1 rounded">IPINFO_TOKEN</code> in backend env.
        </p>
      </div>
    </div>
  );
}

function WebsiteVisitorPanel({ organizationId, onDraftMessage, onEnrichCompany, companyContacts }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const token = (await import('../supabaseClient')).supabase.auth.getSession
        ? (await (await import('../supabaseClient')).supabase.auth.getSession()).data?.session?.access_token
        : null;
      const resp = await fetch(
        `${BACKEND_URL}/api/track/visitors?organization_id=${organizationId}&days=7`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      if (resp.ok) {
        const data = await resp.json();
        setVisitors(data.visitors || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Monitor size={13} className="text-teal-500" />
          <h3 className="text-sm font-semibold text-apptivia-ink">Website Visitors</h3>
          {visitors.length > 0 && (
            <span className="text-[9px] font-bold bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">{visitors.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowScript(true)}
          className="text-[10px] text-apptivia-carbon-400 hover:text-teal-600 transition-colors flex items-center gap-1"
          title="Get tracking snippet"
        >
          <Settings size={10} /> Setup
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 py-3">
          <Loader size={10} className="animate-spin text-teal-500" />
          <span className="text-[10px] text-apptivia-carbon-400">Loading visitors...</span>
        </div>
      )}

      {!loading && visitors.length === 0 && (
        <p className="text-[10px] text-apptivia-carbon-400 py-2 text-center">
          No visitors tracked yet · <button onClick={() => setShowScript(true)} className="text-teal-500 hover:text-teal-700 font-medium">Setup →</button>
        </p>
      )}

      {!loading && visitors.length > 0 && (
        <div className="space-y-2.5">
          {visitors.slice(0, 6).map((v) => (
            <div key={v.company_name} className="group/visitor flex items-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Monitor size={11} className="text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold text-apptivia-ink truncate">{v.company_name}</span>
                  <span className="text-[9px] text-apptivia-carbon-400 flex-shrink-0">{timeAgo(v.last_seen_at)}</span>
                </div>
                {v.page_title && (
                  <p className="text-[9px] text-apptivia-carbon-500 truncate">{v.page_title}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover/visitor:opacity-100 transition-opacity">
                  {companyContacts?.[v.company_name]?.length > 0 ? (
                    <>
                      {companyContacts[v.company_name][0].email && (
                        <button
                          onClick={() => navigator.clipboard.writeText(companyContacts[v.company_name][0].email)}
                          className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                          title={`Copy: ${companyContacts[v.company_name][0].email}`}
                        ><Mail size={10} /></button>
                      )}
                      {onDraftMessage && (
                        <button
                          onClick={() => onDraftMessage(
                            { company_name: v.company_name, signal_type: 'website_visit', title: `${v.company_name} visited your website`, ai_outreach_angle: "They were on your site today — reach out while the problem is top of mind." },
                            companyContacts[v.company_name][0]
                          )}
                          className="text-apptivia-ink hover:text-apptivia-ink transition-colors"
                          title="Draft message"
                        ><MessageSquare size={10} /></button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => onEnrichCompany?.(v.company_name)}
                      className="text-[9px] text-teal-500 hover:text-teal-700"
                    >+ Find contact</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TrackingScriptModal
        isOpen={showScript}
        onClose={() => setShowScript(false)}
        organizationId={organizationId}
      />
    </div>
  );
}

// ── Daily Priority Panel ──────────────────────────────────

function DailyPriorityPanel({ allSignals, companyContacts, onDraftMessage, onEnrichCompany }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const priorityList = useMemo(() => {
    const map = {};
    allSignals.forEach((s) => {
      if (!s.company_name || s.status === 'dismissed') return;
      const key = s.company_name;
      if (!map[key]) map[key] = { name: key, signals: [], totalScore: 0, stages: new Set() };
      map[key].signals.push(s);
      map[key].totalScore += s.signal_score;
      if (s.buying_stage_indicator) map[key].stages.add(s.buying_stage_indicator);
    });

    return Object.values(map).map((group) => {
      const avgScore = group.totalScore / group.signals.length;
      const sorted = [...group.signals].sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
      const newest = sorted[0];
      const ageDays = (Date.now() - new Date(newest.detected_at).getTime()) / (1000 * 60 * 60 * 24);

      const recency = ageDays < 1 ? 1.5 : ageDays < 3 ? 1.2 : ageDays < 7 ? 1.0 : ageDays < 14 ? 0.7 : 0.5;
      const stageScore = group.stages.has('decision') ? 1.5 : group.stages.has('consideration') ? 1.2 : group.stages.has('awareness') ? 0.8 : 1.0;
      const countBoost = group.signals.length >= 4 ? 1.3 : group.signals.length === 3 ? 1.2 : group.signals.length === 2 ? 1.1 : 1.0;
      const hasContact = (companyContacts[group.name]?.length || 0) > 0;
      const priorityScore = Math.min(100, Math.round(avgScore * recency * stageScore * countBoost * (hasContact ? 1.1 : 1.0)));

      return {
        name: group.name,
        signals: group.signals,
        stages: Array.from(group.stages),
        avgScore: Math.round(avgScore),
        priorityScore,
        topSignal: newest,
        contact: companyContacts[group.name]?.[0] || null,
      };
    })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 7);
  }, [allSignals, companyContacts]);

  if (priorityList.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-apptivia-ink">Today's Priority List</h3>
          <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">{today}</p>
        </div>
        <span className="text-[9px] font-semibold text-apptivia-ink bg-apptivia-carbon-100 px-2 py-0.5 rounded-full uppercase tracking-wide">AI Ranked</span>
      </div>
      <div className="space-y-3">
        {priorityList.map((item, i) => (
          <div key={item.name} className="group/priority">
            <div className="flex items-start gap-2.5">
              {/* Rank badge */}
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5 ${
                i === 0 ? 'bg-amber-100 text-amber-700' :
                i === 1 ? 'bg-apptivia-carbon-100 text-apptivia-carbon-600' :
                i === 2 ? 'bg-orange-50 text-orange-600' :
                'bg-apptivia-paper text-apptivia-carbon-500'
              }`}>{i + 1}</span>

              <div className="flex-1 min-w-0">
                {/* Company + priority score */}
                <div className="flex items-center gap-1.5 justify-between">
                  <span className="text-xs font-semibold text-apptivia-ink truncate">{item.name}</span>
                  <Tooltip text={`Priority Score: ${item.priorityScore}/100 — Composite of signal strength, recency, buying stage, signal count, and contact availability`} position="left">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 cursor-help ${
                      item.priorityScore >= 80 ? 'bg-emerald-50 text-emerald-700' :
                      item.priorityScore >= 60 ? 'bg-yellow-50 text-yellow-700' :
                      'bg-apptivia-paper text-apptivia-carbon-600'
                    }`}>{item.priorityScore}</span>
                  </Tooltip>
                </div>

                {/* Top signal context */}
                <p className="text-[10px] text-apptivia-carbon-500 truncate mt-0.5">{item.topSignal?.title}</p>

                {/* Meta chips */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] text-apptivia-carbon-400">{item.signals.length} signal{item.signals.length !== 1 ? 's' : ''}</span>
                  {item.stages.length > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-medium ${
                      item.stages.includes('decision') ? 'bg-emerald-50 text-emerald-600' :
                      item.stages.includes('consideration') ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' :
                      'bg-apptivia-paper text-apptivia-carbon-500'
                    }`}>
                      {item.stages.includes('decision') ? 'Decision' : item.stages.includes('consideration') ? 'Consideration' : 'Awareness'}
                    </span>
                  )}
                </div>

                {/* Contact row */}
                {item.contact ? (
                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-apptivia-carbon-100">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px] font-bold flex-shrink-0">
                      {(item.contact.first_name?.[0] || item.contact.name?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-[10px] text-apptivia-carbon-700 font-medium truncate flex-1">
                      {item.contact.name}
                      {item.contact.title && <span className="text-apptivia-carbon-400 font-normal"> · {item.contact.title}</span>}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover/priority:opacity-100 transition-opacity">
                      {item.contact.email && (
                        <button
                          onClick={() => navigator.clipboard.writeText(item.contact.email)}
                          className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                          title={`Copy: ${item.contact.email}`}
                        ><Mail size={10} /></button>
                      )}
                      {item.contact.linkedin_url && (
                        <a href={item.contact.linkedin_url} target="_blank" rel="noreferrer"
                          className="text-apptivia-coral-tone-300 hover:text-apptivia-coral transition-colors"
                          title="LinkedIn"
                        ><Linkedin size={10} /></a>
                      )}
                      {onDraftMessage && (
                        <button
                          onClick={() => onDraftMessage(item.topSignal, item.contact)}
                          className="text-apptivia-ink hover:text-apptivia-ink transition-colors"
                          title="Draft message"
                        ><MessageSquare size={10} /></button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onEnrichCompany?.(item.name)}
                    className="mt-1 text-[10px] text-teal-500 hover:text-teal-700 transition-colors"
                  >
                    + Find contact
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Companies Table ───────────────────────────────────

function TopCompaniesPanel({ companies, companyContacts }) {
  if (!companies.length) return null;

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
      <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Top Signal Companies</h3>
      <div className="space-y-2">
        {companies.slice(0, 8).map((c, i) => (
          <div key={c.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-apptivia-carbon-400 w-5">{i + 1}</span>
            <span className="flex-1 text-sm text-apptivia-ink font-medium truncate">{c.name}</span>
            <div className="flex items-center gap-2">
              {companyContacts?.[c.name]?.length > 0 && (
                <span className="text-[9px] text-teal-600 flex items-center gap-0.5">
                  <Users size={8} /> {companyContacts[c.name].length}
                </span>
              )}
              <span className="text-xs text-apptivia-carbon-500">{c.count} signals</span>
              <Tooltip text={`Avg Signal Score: ${c.score}/100 — Average intent score across ${c.count} signal${c.count !== 1 ? 's' : ''}`} position="left">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full cursor-help ${
                  c.score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                  c.score >= 50 ? 'bg-yellow-50 text-yellow-700' :
                  'bg-apptivia-paper text-apptivia-carbon-600'
                }`}>
                  {c.score}
                </span>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ICP Prospector Sub-components ─────────────────────────

function IcpProspectorHeader({ icpConfig, onEditIcp }) {
  const industries = icpConfig?.target_industries?.slice(0, 3).join(', ') || 'All industries';
  const hasMore = (icpConfig?.target_industries?.length || 0) > 3;
  const headcount = icpConfig?.headcount_min && icpConfig?.headcount_max
    ? `${icpConfig.headcount_min}–${icpConfig.headcount_max} employees`
    : 'Any headcount';
  return (
    <div className="bg-apptivia-coral-tone-50 border border-apptivia-carbon-300 rounded-lg p-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-apptivia-ink rounded-lg flex items-center justify-center flex-shrink-0">
          <Target size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-apptivia-ink">ICP Prospector</h3>
          <p className="text-[10px] text-apptivia-carbon-500 mt-0.5">
            {industries}{hasMore ? ' + more' : ''} · {headcount}
          </p>
        </div>
      </div>
      <button
        onClick={onEditIcp}
        className="text-[10px] text-apptivia-ink hover:text-apptivia-ink underline whitespace-nowrap flex-shrink-0"
      >
        Edit ICP
      </button>
    </div>
  );
}

function IcpProspectorFilters({ filters, onChange, onSearch, isLoading }) {
  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 pointer-events-none" />
          <input
            value={filters.keywords}
            onChange={e => onChange({ keywords: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="Keyword or industry..."
            className="w-full text-xs border border-apptivia-carbon-200 rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-apptivia-carbon-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.useIndustryKeywords}
            onChange={e => onChange({ useIndustryKeywords: e.target.checked })}
            className="rounded"
          />
          Filter by ICP industries
        </label>
        <button
          onClick={onSearch}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-lg bg-apptivia-ink text-white hover:bg-apptivia-coral-tone-600 disabled:opacity-40 transition-all shadow-sm"
        >
          {isLoading
            ? <><RefreshCw size={11} className="animate-spin" /> Searching...</>
            : <><Search size={11} /> Search ICP Companies</>}
        </button>
      </div>
      {filters.locations.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-apptivia-carbon-400 uppercase font-medium tracking-wide">Regions:</span>
          {filters.locations.map(loc => (
            <span key={loc} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-apptivia-carbon-100 text-apptivia-ink">
              {loc}
              <button
                onClick={() => onChange({ locations: filters.locations.filter(l => l !== loc) })}
                className="ml-0.5 hover:text-apptivia-ink"
              >
                <X size={8} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IcpCompanyCard({ company, icpScore, isAlreadyAdded, existingAccountId, contacts, isEnriching, isAdding, onResearch, onFindContacts, onEnrichContacts, onAddToAccounts, onDraftMessage, onViewInAccounts, onCallContact, onResearchContact }) {
  const key = company.primary_domain || company.name;
  const location = [company.city, company.state, company.country].filter(Boolean).join(', ');
  const scoreColor = icpScore >= 75
    ? 'bg-emerald-50 text-emerald-700'
    : icpScore >= 50
      ? 'bg-amber-50 text-amber-700'
      : 'bg-apptivia-paper text-apptivia-carbon-500';
  const techList = (company.technologies || []).map(t => typeof t === 'string' ? t : t?.name).filter(Boolean);

  return (
    <div className={`bg-white rounded-lg border ${isAlreadyAdded ? 'border-emerald-200' : 'border-apptivia-carbon-100'} p-4 hover:shadow-sm transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="w-9 h-9 rounded-lg object-contain border border-apptivia-carbon-100 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-apptivia-ink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {company.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-sm font-semibold text-apptivia-ink truncate">{company.name}</h4>
              {company.website_url && (
                <a href={company.website_url} target="_blank" rel="noreferrer" className="text-apptivia-carbon-400 hover:text-apptivia-coral transition-colors flex-shrink-0">
                  <ExternalLink size={10} />
                </a>
              )}
              {isAlreadyAdded && (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">
                  <CheckCircle size={8} /> In Accounts
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {company.industry && <span className="text-[10px] text-apptivia-carbon-500">{company.industry}</span>}
              {company.estimated_num_employees > 0 && (
                <span className="text-[10px] text-apptivia-carbon-400">{company.estimated_num_employees.toLocaleString()} employees</span>
              )}
              {location && <span className="text-[10px] text-apptivia-carbon-400">{location}</span>}
            </div>
          </div>
        </div>
        {icpScore !== null && icpScore !== undefined && (
          <Tooltip text={`ICP Fit Score: ${icpScore}/100 — Weighted match across industry, headcount, revenue, tech stack, geography, company age, and keywords`} wide>
            <div className={`flex-shrink-0 text-center px-2.5 py-1 rounded-lg cursor-help ${scoreColor}`}>
              <div className="text-sm font-bold">{icpScore}</div>
              <div className="text-[9px] text-apptivia-carbon-400">ICP Fit</div>
            </div>
          </Tooltip>
        )}
      </div>

      {/* Description */}
      {company.short_description && (
        <p className="text-[11px] text-apptivia-carbon-500 line-clamp-2 mb-3">{company.short_description}</p>
      )}

      {/* Tech chips */}
      {techList.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {techList.slice(0, 5).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-medium">{t}</span>
          ))}
          {techList.length > 5 && <span className="text-[9px] text-apptivia-carbon-400">+{techList.length - 5}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <button onClick={onResearch} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50 transition-colors">
          <Search size={9} /> Research
        </button>
        <button onClick={onFindContacts} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
          <UserPlus size={9} /> Find Contacts
        </button>
        {isAlreadyAdded ? (
          <button onClick={onViewInAccounts} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
            <CheckCircle size={9} /> In Accounts <ArrowRight size={9} />
          </button>
        ) : (
          <button onClick={onAddToAccounts} disabled={isAdding} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 disabled:opacity-50 transition-colors">
            {isAdding ? <Loader size={9} className="animate-spin" /> : <Building2 size={9} />}
            Add to Accounts
          </button>
        )}
        <button onClick={onDraftMessage} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-apptivia-carbon-100 text-apptivia-ink hover:bg-apptivia-carbon-100 transition-colors">
          <MessageSquare size={9} /> Draft Message
        </button>
      </div>

      {/* Contacts — always visible, matching Signal Accounts layout */}
      <SignalContactsSection
        companyName={company.name}
        contacts={contacts}
        isEnriching={isEnriching}
        onEnrich={onEnrichContacts}
        onCallContact={onCallContact}
        onEmailContact={(person) => onDraftMessage?.(person)}
        onResearchContact={onResearchContact}
      />
    </div>
  );
}

function IcpProspectorView({ icp, icpConfig, onDraftMessage, onNavigateDiscover, onNavigateAccounts, onCallContact, onResearchContact }) {
  const navigate = useNavigate();
  const [addingCompany, setAddingCompany] = useState(null);

  // Auto-search on first mount when ICP config is valid
  useEffect(() => {
    if (icpConfig?.enabled && icp.icpStatus === 'ready' && icp.results.length === 0 && !icp.loading && !icp.error) {
      icp.search();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icpConfig, icp.icpStatus]);

  const handleResearch = (company) => {
    onNavigateDiscover?.({ mode: 'company', query: company.primary_domain || company.name });
  };

  const handleAddToAccounts = async (company) => {
    const key = company.primary_domain || company.name;
    setAddingCompany(key);
    await icp.addToAccounts(company);
    setAddingCompany(null);
  };

  const handleDraftMessage = (company, contactOverride) => {
    const key = company.primary_domain || company.name;
    const contact = contactOverride || icp.companyContacts[key]?.[0] || null;
    const adaptedSignal = {
      company_name: company.name,
      signal_type: 'icp_prospector',
      title: `ICP Prospector: ${company.name}`,
      description: company.short_description || '',
      ai_outreach_angle: `Direct ICP match — ${company.industry || 'target industry'}, ${company.estimated_num_employees?.toLocaleString() || '?'} employees.`,
    };
    onDraftMessage(adaptedSignal, contact);
  };

  const handleViewInAccounts = (company) => {
    const key = (company.primary_domain || company.name).toLowerCase();
    const accountId = icp.existingAccountMap[key];
    if (accountId && onNavigateAccounts) {
      onNavigateAccounts({ accountId });
    }
  };

  return (
    <div className="space-y-4">
      <IcpProspectorHeader
        icpConfig={icpConfig}
        onEditIcp={() => navigate('/organization-settings')}
      />

      <IcpProspectorFilters
        filters={icp.filters}
        onChange={icp.setFilters}
        onSearch={() => icp.search()}
        isLoading={icp.loading}
      />

      {icp.loading ? (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 py-16 text-center">
          <RefreshCw size={28} className="mx-auto text-apptivia-ink mb-3 animate-spin" />
          <p className="text-sm text-apptivia-carbon-500">Searching Apollo for ICP-matching companies...</p>
        </div>
      ) : icp.error ? (
        <div className="bg-white rounded-lg border border-red-100 py-12 text-center px-4">
          <p className="text-sm text-red-500 mb-2">Search failed: {icp.error}</p>
          <button onClick={() => icp.search()} className="text-xs text-apptivia-ink underline">Retry</button>
        </div>
      ) : icp.results.length === 0 ? (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 py-16 text-center px-6">
          <Target size={32} className="mx-auto text-apptivia-carbon-300 mb-3" />
          <p className="text-sm text-apptivia-carbon-500 mb-1">
            {icp.icpStatus === 'no_config' ? 'ICP profile not configured'
              : icp.icpStatus === 'not_enabled' ? 'ICP profile is disabled'
              : icp.icpStatus === 'no_dimensions' ? 'No targeting criteria set'
              : 'No results yet'}
          </p>
          <p className="text-xs text-apptivia-carbon-400">
            {icp.icpStatus === 'ready'
              ? 'Click "Search ICP Companies" to find matching prospects'
              : 'Configure your Ideal Customer Profile in Org Settings → ICP, then search'}
          </p>
          {icp.icpStatus !== 'ready' && (
            <button onClick={() => navigate('/organization-settings')} className="mt-3 text-xs text-apptivia-coral hover:underline">
              Go to Org Settings
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-[10px] text-apptivia-carbon-400 px-1">
            Showing {icp.results.length} of ~{icp.totalResults.toLocaleString()} ICP-matching companies
          </p>
          <div className="space-y-2">
            {icp.results.map((company) => {
              const key = company.primary_domain || company.name;
              const accountKey = key.toLowerCase();
              return (
                <IcpCompanyCard
                  key={company.id || key}
                  company={company}
                  icpScore={icp.icpScores[key]}
                  isAlreadyAdded={icp.existingAccountKeys.has(accountKey)}
                  existingAccountId={icp.existingAccountMap[accountKey]}
                  contacts={icp.companyContacts[key]}
                  isEnriching={icp.enrichingCompanies.includes(key)}
                  isAdding={addingCompany === key}
                  onResearch={() => handleResearch(company)}
                  onFindContacts={() => handleFindContactsAtCompany(company.name, company.primary_domain)}
                  onEnrichContacts={() => icp.enrichCompanyContacts(company)}
                  onAddToAccounts={() => handleAddToAccounts(company)}
                  onDraftMessage={(contactOverride) => handleDraftMessage(company, contactOverride)}
                  onViewInAccounts={() => handleViewInAccounts(company)}
                  onCallContact={onCallContact}
                  onResearchContact={onResearchContact}
                />
              );
            })}
          </div>

          {icp.hasMore && (
            <button
              onClick={icp.loadMore}
              disabled={icp.loadingMore}
              className="w-full py-2.5 text-xs font-medium text-apptivia-ink hover:text-apptivia-ink border border-dashed border-apptivia-carbon-300 hover:border-apptivia-carbon-300 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {icp.loadingMore
                ? <><RefreshCw size={12} className="animate-spin" /> Loading more...</>
                : <>Load More Companies <ChevronDown size={12} /></>}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function SignalProspecting({ organizationId, userId, onCallContact, onNavigateDiscover, onNavigateAccounts }) {
  const navigate = useNavigate();
  const signals = useSignalProspecting(organizationId, userId);
  const icp = useIcpProspector(organizationId, signals.orgIcpConfig, signals.orgSignalConfig);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [viewMode, setViewMode] = useState('accounts'); // 'signals' | 'accounts' | 'icp'
  const [hideStale, setHideStale] = useState(false);
  const [hidePromoted, setHidePromoted] = useState(false);
  const [outreachModal, setOutreachModal] = useState(null); // { signal, contact } | null
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  // promotedAccounts: Record<companyName, { id, name }> — populated from DB + local promotes
  const [promotedAccounts, setPromotedAccounts] = useState({});
  const [promotingCompany, setPromotingCompany] = useState(null); // name of company being promoted

  const [ownershipFilter, setOwnershipFilter] = useState('all'); // 'all' | 'mine' | 'unclaimed'

  // Load promoted accounts from DB on mount (includes assigned_to for ownership filter)
  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('engage_accounts')
      .select('id, account_name, domain, assigned_to')
      .eq('organization_id', organizationId)
      .eq('source', 'signal_prospecting')
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach((a) => {
          map[a.account_name] = { id: a.id, name: a.account_name, assigned_to: a.assigned_to };
          if (a.domain) map[a.domain] = { id: a.id, name: a.account_name, assigned_to: a.assigned_to };
        });
        setPromotedAccounts(map);
      });
  }, [organizationId]);

  const filteredSignals = useMemo(() => {
    return signals.signals.filter((s) => {
      if (filterType !== 'all' && s.signal_type !== filterType) return false;
      // Hide dismissed signals unless explicitly filtering for them
      if (filterStatus === 'all' && s.status === 'dismissed') return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCompany = s.company_name?.toLowerCase().includes(q);
        const matchesTitle = s.title?.toLowerCase().includes(q);
        if (!matchesCompany && !matchesTitle) return false;
      }
      if (hideStale) {
        const days = (Date.now() - new Date(s.detected_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days > 7) return false;
      }
      if (hidePromoted && s.company_name && promotedAccounts[s.company_name]) return false;
      return true;
    });
  }, [signals.signals, filterType, filterStatus, searchQuery, hideStale, hidePromoted, promotedAccounts]);

  const accountGroups = useMemo(() => {
    const map = {};
    filteredSignals.forEach((s) => {
      const key = s.company_name || 'Unknown';
      if (!map[key]) map[key] = { name: key, signals: [], totalScore: 0, stages: new Set(), types: new Set() };
      map[key].signals.push(s);
      map[key].totalScore += s.signal_score;
      if (s.buying_stage_indicator) map[key].stages.add(s.buying_stage_indicator);
      map[key].types.add(s.signal_type);
    });
    let groups = Object.values(map)
      .map((g) => ({ ...g, avgScore: Math.round(g.totalScore / g.signals.length), stages: Array.from(g.stages), types: Array.from(g.types) }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Ownership filter (only applies when accounts view is active)
    if (ownershipFilter !== 'all') {
      groups = groups.filter((g) => {
        const promo = promotedAccounts[g.name];
        if (ownershipFilter === 'mine') return promo?.assigned_to === userId;
        if (ownershipFilter === 'unclaimed') return !promo?.assigned_to;
        return true;
      });
    }
    return groups;
  }, [filteredSignals, ownershipFilter, promotedAccounts, userId]);

  // Company names for autocomplete — built from all signals in memory
  const autocompleteOptions = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const names = [...new Set(signals.signals.map((s) => s.company_name).filter(Boolean))];
    return names.filter((name) => name.toLowerCase().includes(q) && name.toLowerCase() !== q).slice(0, 6);
  }, [signals.signals, searchQuery]);

  // Count of non-dismissed signals for Dismiss All button
  const activeSignalCount = useMemo(() => {
    return signals.signals.filter((s) => s.status !== 'dismissed').length;
  }, [signals.signals]);

  const handleAction = (id) => signals.updateSignalStatus(id, 'actioned');
  const handleDismiss = (id) => signals.dismissSignal(id);
  const handleMarkOutcome = (signalId, outcome) => signals.markSignalOutcome(signalId, outcome);

  const handleDraftMessage = (signal, contact) => {
    const resolvedContact = contact || signals.companyContacts?.[signal.company_name]?.[0] || null;
    setOutreachModal({ signal, contact: resolvedContact });
  };

  // Cross-tab navigation: research a company or find its customers in Discover
  const handleResearchCompany = (companyName) => {
    if (onNavigateDiscover) {
      onNavigateDiscover({ mode: 'company', query: companyName });
    }
  };

  const handleResearchProspect = (person) => {
    if (onNavigateDiscover) {
      onNavigateDiscover({ mode: 'prospect', query: person.name || person.first_name || '' });
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

  const handleFindContactsAtCompany = (companyName, domain) => {
    if (onNavigateDiscover) {
      onNavigateDiscover({
        mode: 'people_search',
        findPeopleMode: 'company',
        query: domain || companyName,
        filters: {
          titles: signals.scanConfig.job_titles_to_track?.length
            ? signals.scanConfig.job_titles_to_track
            : undefined,
          seniority: ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior'],
        },
      });
    }
  };

  const handlePromoteToAccount = useCallback(async (group, alreadyPromoted) => {
    const companyName = group.name;
    // If already promoted, navigate to Accounts tab
    if (alreadyPromoted) {
      const info = promotedAccounts[companyName];
      if (onNavigateAccounts) onNavigateAccounts({ accountId: info?.id });
      return;
    }
    const domain = group.signals.find(s => s.raw_data?.domain)?.raw_data?.domain || null;
    setPromotingCompany(companyName);
    try {
      // Dedup check by domain
      if (domain) {
        const { data: existing } = await supabase
          .from('engage_accounts')
          .select('id, account_name')
          .eq('organization_id', organizationId)
          .eq('domain', domain)
          .maybeSingle();
        if (existing) {
          setPromotedAccounts(prev => ({ ...prev, [companyName]: { id: existing.id, name: existing.account_name } }));
          if (onNavigateAccounts) onNavigateAccounts({ accountId: existing.id });
          return;
        }
      }
      const industry = group.signals.find(s => s.raw_data?.industry)?.raw_data?.industry || null;
      const contacts = signals.companyContacts?.[companyName] || [];
      const avgScore = group.avgScore;
      const buyingStage = group.stages.includes('decision') ? 'decision'
        : group.stages.includes('consideration') ? 'consideration' : 'awareness';
      const { data: account, error } = await supabase
        .from('engage_accounts')
        .insert({
          organization_id: organizationId,
          account_name: companyName,
          domain: domain || null,
          industry: industry || null,
          tier: avgScore >= 70 ? 'tier_1' : avgScore >= 50 ? 'tier_2' : 'tier_3',
          status: 'active',
          account_score: avgScore,
          intent_score: avgScore,
          engagement_score: 0,
          signals_count: group.signals.length,
          buying_committee: [],
          tags: [],
          metadata: {
            signal_contacts: contacts,
            promoted_signal_types: group.types,
            promoted_avg_score: avgScore,
          },
          buying_stage: buyingStage,
          readiness_score: avgScore,
          signal_velocity: group.signals.length,
          source: 'signal_prospecting',
          promoted_from_signal_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setPromotedAccounts(prev => ({ ...prev, [companyName]: { id: account.id, name: companyName } }));
    } catch (err) {
      console.error('Promote to account failed:', err);
    } finally {
      setPromotingCompany(null);
    }
  }, [organizationId, promotedAccounts, signals.companyContacts, onNavigateAccounts]);

  const handleClaimAccount = useCallback(async (accountId, companyName) => {
    if (!userId || !accountId) return;
    try {
      const { error } = await supabase
        .from('engage_accounts')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (error) throw error;
      // Update local state so UI reflects immediately
      setPromotedAccounts(prev => ({
        ...prev,
        [companyName]: { ...prev[companyName], assigned_to: userId },
      }));
    } catch (err) {
      console.error('Claim account failed:', err);
    }
  }, [userId]);

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
      {/* Signal Outreach Modal */}
      <SignalOutreachModal
        isOpen={!!outreachModal}
        onClose={() => setOutreachModal(null)}
        signal={outreachModal?.signal}
        contact={outreachModal?.contact}
      />

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

      {/* Quick Add Signal Modal */}
      <QuickAddSignalModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSubmit={(data) => signals.addManualSignal(data)}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-apptivia-ink">Signal-Based Prospecting</h2>
          <p className="text-xs text-apptivia-carbon-500 mt-0.5">Detect high-intent signals from competitors, job changes, funding, and more</p>
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

      {/* ICP Status Banner */}
      {signals.icpEnabled ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700">
          <Target size={12} className="flex-shrink-0" />
          <span>ICP scoring active — scans are automatically filtered against your organization's Ideal Customer Profile.</span>
          <button
            onClick={() => navigate('/organization-settings')}
            className="ml-auto whitespace-nowrap text-emerald-600 hover:text-emerald-800 underline font-medium"
          >
            Edit ICP
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span>ICP scoring is not enabled. Admins can configure it in Organization Settings to improve signal relevance.</span>
          <button
            onClick={() => navigate('/organization-settings')}
            className="ml-auto whitespace-nowrap text-amber-600 hover:text-amber-800 underline font-medium"
          >
            Configure ICP
          </button>
        </div>
      )}

      {/* Signal Scanner */}
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
              <Radar size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-apptivia-carbon-700">Signal Scanner</h3>
              {signals.hasOrgSignalConfig ? (
                <p className="text-xs text-apptivia-carbon-400">Ready to scan — org signal config loaded</p>
              ) : (
                <p className="text-xs text-apptivia-carbon-400">
                  No signal config yet.{' '}
                  <button
                    onClick={() => navigate('/organization-settings')}
                    className="text-cyan-600 hover:text-cyan-800 underline"
                  >
                    Configure in Organization Settings
                  </button>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQuickAdd(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-apptivia-coral text-apptivia-coral hover:bg-apptivia-coral hover:text-white transition-all"
              >
                <Plus size={12} />
                Quick Add
              </button>
              <button
                onClick={() => signals.runSignalScan()}
                disabled={signals.isScanning || !signals.hasOrgSignalConfig}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-apptivia-coral text-white hover:bg-apptivia-coral-tone-600 disabled:opacity-40 transition-all shadow-sm"
              >
                {signals.isScanning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                {signals.isScanning ? 'Scanning...' : 'Scan Now'}
              </button>
            </div>
            {signals.lastScanAt && (
              <p className="text-[10px] text-apptivia-carbon-400">
                Last: {timeAgo(signals.lastScanAt)}
                {signals.nextScanAt && ` · Next: ${new Date(signals.nextScanAt).toLocaleDateString()}`}
              </p>
            )}
            {!signals.lastScanAt && (
              <p className="text-[10px] text-apptivia-carbon-400">Scans run automatically weekly</p>
            )}
          </div>
        </div>

        {/* Scan Progress */}
        {signals.scanProgress.length > 0 && (
          <div className="mt-4 bg-apptivia-coral-tone-50/50 rounded-lg p-3 space-y-1">
            {signals.scanProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-apptivia-coral">
                <CheckCircle size={12} className="text-apptivia-coral flex-shrink-0" />
                <span className="font-medium">{p.step}:</span>
                <span>{p.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan Results panel removed — signals appear directly in the list */}

      {/* Action Queue — AI-drafted outreach awaiting approval */}
      <ActionQueuePanel
        actionQueue={signals.actionQueue}
        actionQueueLoading={signals.actionQueueLoading}
        lastScanAt={signals.lastScanAt}
        nextScanAt={signals.nextScanAt}
        onApprove={signals.approveAction}
        onDismiss={signals.dismissAction}
        onSend={signals.sendAction}
        onExpandToPlay={signals.expandToPlay}
        onFetchSteps={signals.fetchActionSteps}
        onUpdateStep={signals.updateActionStep}
        actionSteps={signals.actionSteps}
        expandingActionId={signals.expandingActionId}
      />

      {/* Summary */}
      <SignalSummaryCards summary={signals.summary} />

      {/* Buying Stage Funnel */}
      <BuyingStageFunnel byBuyingStage={signals.summary.byBuyingStage} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Signal Feed */}
        <div className="lg:col-span-2 space-y-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-apptivia-carbon-100 rounded-lg p-0.5 self-start">
            <button
              onClick={() => setViewMode('signals')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'signals' ? 'bg-white shadow-sm text-apptivia-ink' : 'text-apptivia-carbon-500 hover:text-apptivia-carbon-700'}`}
            >
              Signals ({filteredSignals.length})
            </button>
            <button
              onClick={() => setViewMode('accounts')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'accounts' ? 'bg-white shadow-sm text-apptivia-ink' : 'text-apptivia-carbon-500 hover:text-apptivia-carbon-700'}`}
            >
              Signal Accounts ({accountGroups.length})
            </button>
            <button
              onClick={() => setViewMode('icp')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'icp' ? 'bg-white shadow-sm text-apptivia-ink' : 'text-apptivia-carbon-500 hover:text-apptivia-carbon-700'}`}
            >
              ICP Prospector{icp.results.length > 0 ? ` (${icp.results.length})` : ''}
            </button>
          </div>

          {/* Ownership filter (accounts view only) */}
          {viewMode === 'accounts' && (
            <div className="flex items-center gap-1 bg-apptivia-carbon-100 rounded-lg p-0.5 self-start">
              {[
                { key: 'all', label: 'All' },
                { key: 'mine', label: 'My Accounts' },
                { key: 'unclaimed', label: 'Unclaimed' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setOwnershipFilter(opt.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    ownershipFilter === opt.key
                      ? 'bg-white shadow-sm text-apptivia-ink'
                      : 'text-apptivia-carbon-500 hover:text-apptivia-carbon-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Company search with autocomplete */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowAutocomplete(true)}
                onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
                placeholder="Search company or signal..."
                className="text-xs border border-apptivia-carbon-200 rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300 w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                >
                  <X size={10} />
                </button>
              )}
              {showAutocomplete && autocompleteOptions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-20 w-56 max-h-40 overflow-y-auto">
                  {autocompleteOptions.map((name) => (
                    <button
                      key={name}
                      onMouseDown={() => setSearchQuery(name)}
                      className="w-full text-left px-3 py-1.5 text-xs text-apptivia-carbon-700 hover:bg-apptivia-paper flex items-center gap-1.5"
                    >
                      <Building2 size={10} className="text-apptivia-carbon-400 flex-shrink-0" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Filter size={12} className="text-apptivia-carbon-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs border border-apptivia-carbon-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
            >
              <option value="all">All Types</option>
              {signals.SIGNAL_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-apptivia-carbon-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral-tone-300"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-apptivia-carbon-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideStale}
                onChange={(e) => setHideStale(e.target.checked)}
                className="rounded"
              />
              Hide stale (&gt;7d)
            </label>
            {Object.keys(promotedAccounts).length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-apptivia-carbon-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hidePromoted}
                  onChange={(e) => setHidePromoted(e.target.checked)}
                  className="rounded"
                />
                Hide promoted
              </label>
            )}
          </div>

          {/* Signal / Account List */}
          {viewMode === 'icp' ? (
            <IcpProspectorView
              icp={icp}
              icpConfig={signals.orgIcpConfig}
              onDraftMessage={handleDraftMessage}
              onNavigateDiscover={onNavigateDiscover}
              onNavigateAccounts={onNavigateAccounts}
              onCallContact={onCallContact}
              onResearchContact={handleResearchProspect}
            />
          ) : signals.loading && !signals.signals.length ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-apptivia-coral-tone-300 mr-2" />
              <span className="text-sm text-apptivia-carbon-500">Loading signals...</span>
            </div>
          ) : viewMode === 'accounts' ? (
            accountGroups.length === 0 ? (
              <div className="bg-white rounded-lg border border-apptivia-carbon-100 py-16 text-center">
                <Radar size={32} className="mx-auto text-apptivia-carbon-300 mb-3" />
                <p className="text-sm text-apptivia-carbon-500 mb-1">No signal accounts yet</p>
                <p className="text-xs text-apptivia-carbon-400">Run a scan to discover companies</p>
              </div>
            ) : <div className="space-y-2">
              {accountGroups.map((group) => (
                <AccountCard
                  key={group.name}
                  group={group}
                  onAction={handleAction}
                  onDismiss={handleDismiss}
                  onResearchCompany={handleResearchCompany}
                  onFindCustomers={handleFindCustomers}
                  onFindContactsAtCompany={handleFindContactsAtCompany}
                  companyContacts={signals.companyContacts}
                  enrichingCompanies={signals.enrichingCompanies}
                  onEnrichCompany={signals.enrichCompanyContacts}
                  onDraftMessage={handleDraftMessage}
                  onPromoteToAccount={handlePromoteToAccount}
                  promotedAccountInfo={promotedAccounts[group.name] || null}
                  isPromoting={promotingCompany === group.name}
                  onCallContact={onCallContact}
                  onClaimAccount={handleClaimAccount}
                  onResearchContact={handleResearchProspect}
                />
              ))}
            </div>
          ) : filteredSignals.length === 0 ? (
            <div className="bg-white rounded-lg border border-apptivia-carbon-100 py-16 text-center">
              <Radar size={32} className="mx-auto text-apptivia-carbon-300 mb-3" />
              <p className="text-sm text-apptivia-carbon-500 mb-1">No signals match your filters</p>
              <p className="text-xs text-apptivia-carbon-400">Try adjusting filters or run a new scan</p>
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
                  onFindContactsAtCompany={handleFindContactsAtCompany}
                  contacts={signals.companyContacts[signal.company_name]}
                  isEnriching={signals.enrichingCompanies.includes(signal.company_name)}
                  onEnrichCompany={() => signal.company_name && signals.enrichCompanyContacts(signal.company_name)}
                  onDraftMessage={handleDraftMessage}
                  onCallContact={onCallContact}
                  onMarkOutcome={handleMarkOutcome}
                  onResearchContact={handleResearchProspect}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <WebsiteVisitorPanel
            organizationId={organizationId}
            onDraftMessage={handleDraftMessage}
            onEnrichCompany={signals.enrichCompanyContacts}
            companyContacts={signals.companyContacts}
          />
          <DailyPriorityPanel
            allSignals={signals.signals}
            companyContacts={signals.companyContacts}
            onDraftMessage={handleDraftMessage}
            onEnrichCompany={signals.enrichCompanyContacts}
          />
          <TopCompaniesPanel companies={signals.summary.topCompanies} companyContacts={signals.companyContacts} />

          {/* Signal Type Breakdown — only show types with signals */}
          {(() => {
            const activeTypes = signals.SIGNAL_TYPES.filter((t) => (signals.summary.byType[t.key] || 0) > 0);
            if (activeTypes.length === 0) return null;
            return (
              <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-5">
                <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">By Signal Type</h3>
                <div className="space-y-2">
                  {activeTypes.map((t) => (
                    <div key={t.key} className="flex items-center justify-between">
                      <span className="text-xs text-apptivia-carbon-600 flex items-center gap-1.5">
                        <span>{t.icon}</span> {t.label}
                      </span>
                      <span className="text-xs font-bold text-apptivia-ink">{signals.summary.byType[t.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
