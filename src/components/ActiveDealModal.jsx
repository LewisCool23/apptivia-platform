import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, Plus, Trash2, Check, Calendar, Phone, Users, Building2,
  FileText, ChevronDown, ChevronUp, Clock, Loader2,
} from 'lucide-react';
import { useActiveDeal } from '../hooks/useActiveDeal';
import { useModalBehavior } from '../hooks/useModalBehavior';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

const formatCurrency = (v) => {
  const n = parseFloat(v);
  if (isNaN(n)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const CEP_STAGES = [
  { key: 'connect',    label: 'Connect',    order: 0 },
  { key: 'explore',    label: 'Explore',    order: 1 },
  { key: 'present',    label: 'Present',    order: 2 },
  { key: 'negotiate',  label: 'Negotiate',  order: 3 },
  { key: 'close_won',  label: 'Closed Won', order: 4, terminal: true },
  { key: 'close_lost', label: 'Closed Lost', order: 5, terminal: true },
];

const FORECAST_CATEGORIES = [
  { value: 'pipeline',    label: 'Pipeline' },
  { value: 'best_case',   label: 'Best Case' },
  { value: 'commit',      label: 'Commit' },
  { value: 'closed_won',  label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
  { value: 'omitted',     label: 'Omitted' },
];

const CONTACT_ROLES = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion',       label: 'Champion' },
  { value: 'influencer',     label: 'Influencer' },
  { value: 'end_user',       label: 'End User' },
  { value: 'other',          label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

const ROLE_COLORS = {
  decision_maker: 'bg-red-100 text-red-700',
  champion:       'bg-emerald-100 text-emerald-700',
  influencer:     'bg-blue-100 text-blue-700',
  end_user:       'bg-amber-100 text-amber-700',
  other:          'bg-apptivia-carbon-100 text-apptivia-carbon-600',
};

const PRIORITY_COLORS = {
  low:    'bg-apptivia-carbon-100 text-apptivia-carbon-600',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-red-100 text-red-700',
};

const ACTIVITY_COLORS = {
  stage_changed:    'bg-apptivia-coral',
  field_updated:    'bg-apptivia-ink',
  call_logged:      'bg-emerald-500',
  task_created:     'bg-amber-500',
  task_completed:   'bg-amber-500',
  meeting_attached: 'bg-blue-500',
  contact_linked:   'bg-purple-500',
  account_linked:   'bg-purple-500',
  note_added:       'bg-apptivia-carbon-400',
  created:          'bg-apptivia-coral',
};

/* ── Collapsible Section ─────────────────────────────────────────────────── */

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border border-apptivia-carbon-100 rounded-lg ${open ? 'overflow-visible' : 'overflow-hidden'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-apptivia-paper hover:bg-apptivia-carbon-50 transition-colors text-left"
      >
        <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider flex-1">{title}</span>
        {count != null && (
          <span className="text-[10px] font-medium text-apptivia-carbon-400 bg-apptivia-carbon-100 px-1.5 py-0.5 rounded-full">{count}</span>
        )}
        {open ? <ChevronUp size={12} className="text-apptivia-carbon-400" /> : <ChevronDown size={12} className="text-apptivia-carbon-400" />}
      </button>
      {open && <div className="px-4 py-3 border-t border-apptivia-carbon-100 bg-white">{children}</div>}
    </div>
  );
}

/* ── Search Dropdown ─────────────────────────────────────────────────────── */

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export default function ActiveDealModal({ isOpen, onClose, dealId, organizationId, userId, onDealUpdated }) {
  useModalBehavior(isOpen, onClose);
  const {
    deal, activities, tasks, contacts, meetings, calls, loading, error,
    loadAll, updateDeal, addNote, linkContact, unlinkContact, linkMeeting,
    createTask, updateTask, deleteTask, logCall,
    searchAccounts, searchContacts, searchMeetings,
  } = useActiveDeal(isOpen ? dealId : null);

  /* ── Edit form state ──────────────────────────────────────────────────── */
  const [editForm, setEditForm] = useState({});
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deal) {
      setEditForm({
        deal_name: deal.deal_name || '',
        deal_value: deal.deal_value || '',
        close_date: deal.close_date ? deal.close_date.slice(0, 10) : '',
        probability: deal.probability ?? '',
        forecast_category: deal.forecast_category || 'pipeline',
        description: deal.description || '',
        next_steps: deal.next_steps || '',
        competitor: deal.competitor || '',
        win_loss_reason: deal.win_loss_reason || '',
      });
      setFormDirty(false);
    }
  }, [deal]);

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    setFormDirty(true);
  };

  const handleSaveDetails = async () => {
    if (!deal) return;
    setSaving(true);
    try {
      const fields = {};
      if (editForm.deal_name !== (deal.deal_name || '')) fields.deal_name = editForm.deal_name;
      if (String(editForm.deal_value) !== String(deal.deal_value || '')) fields.deal_value = parseFloat(editForm.deal_value) || 0;
      if (editForm.close_date !== (deal.close_date ? deal.close_date.slice(0, 10) : '')) fields.close_date = editForm.close_date || null;
      if (String(editForm.probability) !== String(deal.probability ?? '')) fields.probability = parseInt(editForm.probability) || 0;
      if (editForm.forecast_category !== (deal.forecast_category || 'pipeline')) fields.forecast_category = editForm.forecast_category;
      if (editForm.description !== (deal.description || '')) fields.description = editForm.description;
      if (editForm.next_steps !== (deal.next_steps || '')) fields.next_steps = editForm.next_steps;
      if (editForm.competitor !== (deal.competitor || '')) fields.competitor = editForm.competitor;
      if (editForm.win_loss_reason !== (deal.win_loss_reason || '')) fields.win_loss_reason = editForm.win_loss_reason;

      if (Object.keys(fields).length > 0) {
        await updateDeal(fields);
        if (onDealUpdated) onDealUpdated();
      }
      setFormDirty(false);
    } catch (err) {
      console.error('Failed to save deal:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ── CEP Stage ────────────────────────────────────────────────────────── */
  const [showReasonPrompt, setShowReasonPrompt] = useState(null); // 'close_won' | 'close_lost' | null
  const [reasonText, setReasonText] = useState('');

  const currentStageKey = deal?.cep_stage || deal?.stage || '';
  const currentStageOrder = CEP_STAGES.find(s => s.key === currentStageKey)?.order ?? -1;

  const handleStageClick = async (stage) => {
    if (stage.terminal) {
      setShowReasonPrompt(stage.key);
      setReasonText('');
      return;
    }
    try {
      await updateDeal({ cep_stage: stage.key });
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const handleConfirmTerminal = async () => {
    if (!showReasonPrompt) return;
    try {
      const fields = { cep_stage: showReasonPrompt };
      if (reasonText.trim()) fields.win_loss_reason = reasonText.trim();
      await updateDeal(fields);
      setShowReasonPrompt(null);
      setReasonText('');
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to mark terminal:', err);
    }
  };

  /* ── Linked Account ───────────────────────────────────────────────────── */
  const [accountQuery, setAccountQuery] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [searchingAccounts, setSearchingAccounts] = useState(false);
  const accountDropdownRef = useRef(null);
  const accountDebounceRef = useRef(null);

  useOutsideClick(accountDropdownRef, () => setAccountResults([]));

  const handleAccountSearch = useCallback((q) => {
    setAccountQuery(q);
    if (accountDebounceRef.current) clearTimeout(accountDebounceRef.current);
    if (q.length < 2) { setAccountResults([]); return; }
    accountDebounceRef.current = setTimeout(async () => {
      setSearchingAccounts(true);
      try {
        const results = await searchAccounts(q);
        setAccountResults(results);
      } catch { setAccountResults([]); }
      finally { setSearchingAccounts(false); }
    }, 300);
  }, [searchAccounts]);

  const handleLinkAccount = async (account) => {
    try {
      await updateDeal({ linked_account_id: account.id });
      setAccountQuery('');
      setAccountResults([]);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to link account:', err);
    }
  };

  const handleUnlinkAccount = async () => {
    try {
      await updateDeal({ linked_account_id: null });
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to unlink account:', err);
    }
  };

  /* ── Linked Contacts ──────────────────────────────────────────────────── */
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [contactRole, setContactRole] = useState('other');
  const [searchingContactsState, setSearchingContactsState] = useState(false);
  const contactDropdownRef = useRef(null);
  const contactDebounceRef = useRef(null);

  useOutsideClick(contactDropdownRef, () => setContactResults([]));

  const handleContactSearch = useCallback((q) => {
    setContactQuery(q);
    if (contactDebounceRef.current) clearTimeout(contactDebounceRef.current);
    if (q.length < 2) { setContactResults([]); return; }
    contactDebounceRef.current = setTimeout(async () => {
      setSearchingContactsState(true);
      try {
        const results = await searchContacts(q);
        setContactResults(results);
      } catch { setContactResults([]); }
      finally { setSearchingContactsState(false); }
    }, 300);
  }, [searchContacts]);

  const handleLinkContact = async (prospect) => {
    try {
      await linkContact(prospect.id, contactRole);
      setContactQuery('');
      setContactResults([]);
      setContactRole('other');
      setShowContactSearch(false);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to link contact:', err);
    }
  };

  const handleUnlinkContact = async (prospectId) => {
    try {
      await unlinkContact(prospectId);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to unlink contact:', err);
    }
  };

  /* ── Meetings ─────────────────────────────────────────────────────────── */
  const [showMeetingSearch, setShowMeetingSearch] = useState(false);
  const [meetingQuery, setMeetingQuery] = useState('');
  const [meetingResults, setMeetingResults] = useState([]);
  const [searchingMeetingsState, setSearchingMeetingsState] = useState(false);
  const meetingDropdownRef = useRef(null);
  const meetingDebounceRef = useRef(null);

  useOutsideClick(meetingDropdownRef, () => setMeetingResults([]));

  const handleMeetingSearch = useCallback((q) => {
    setMeetingQuery(q);
    if (meetingDebounceRef.current) clearTimeout(meetingDebounceRef.current);
    if (q.length < 2) { setMeetingResults([]); return; }
    meetingDebounceRef.current = setTimeout(async () => {
      setSearchingMeetingsState(true);
      try {
        const results = await searchMeetings(q);
        setMeetingResults(results);
      } catch { setMeetingResults([]); }
      finally { setSearchingMeetingsState(false); }
    }, 300);
  }, [searchMeetings]);

  const handleLinkMeeting = async (meeting) => {
    try {
      await linkMeeting(meeting.id);
      setMeetingQuery('');
      setMeetingResults([]);
      setShowMeetingSearch(false);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to link meeting:', err);
    }
  };

  /* ── Tasks ────────────────────────────────────────────────────────────── */
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'medium' });

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await createTask({
        title: newTask.title.trim(),
        due_date: newTask.due_date || undefined,
        priority: newTask.priority,
      });
      setNewTask({ title: '', due_date: '', priority: 'medium' });
      setShowNewTask(false);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      if (task.status === 'completed') {
        await updateTask(task.id, { status: 'pending', completed_at: null });
      } else {
        await updateTask(task.id, { status: 'completed', completed_at: new Date().toISOString() });
      }
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  /* ── Calls ────────────────────────────────────────────────────────────── */
  const [showLogCall, setShowLogCall] = useState(false);
  const [newCall, setNewCall] = useState({ contact_name: '', duration_minutes: '', notes: '', call_direction: 'outbound' });

  const handleLogCall = async () => {
    if (!newCall.contact_name.trim()) return;
    try {
      await logCall({
        contact_name: newCall.contact_name.trim(),
        duration_minutes: parseInt(newCall.duration_minutes) || 0,
        notes: newCall.notes || undefined,
        call_direction: newCall.call_direction,
      });
      setNewCall({ contact_name: '', duration_minutes: '', notes: '', call_direction: 'outbound' });
      setShowLogCall(false);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to log call:', err);
    }
  };

  /* ── Notes ────────────────────────────────────────────────────────────── */
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await addNote(noteText.trim());
      setNoteText('');
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setAddingNote(false);
    }
  };

  /* ── Guard ────────────────────────────────────────────────────────────── */
  if (!isOpen || !dealId) return null;

  /* ── Derived values ───────────────────────────────────────────────────── */
  const isTerminal = currentStageKey === 'close_won' || currentStageKey === 'close_lost';

  const stageBadgeClass = (() => {
    switch (currentStageKey) {
      case 'close_won':  return 'bg-emerald-100 text-emerald-700';
      case 'close_lost': return 'bg-red-100 text-red-700';
      default:           return 'bg-apptivia-coral/10 text-apptivia-coral';
    }
  })();

  const currentStageLabel = CEP_STAGES.find(s => s.key === currentStageKey)?.label || currentStageKey || 'Unknown';

  const isTaskOverdue = (task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const sortedActivities = [...activities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div
        className="max-w-5xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-apptivia-ink truncate">{deal?.deal_name || 'Loading...'}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {deal && (
                  <>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageBadgeClass}`}>
                      {currentStageLabel}
                    </span>
                    <span className="text-xs font-semibold text-apptivia-ink">{formatCurrency(deal.deal_value)}</span>
                    {deal.close_date && (
                      <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(deal.close_date)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-apptivia-carbon-100 rounded-lg transition-colors flex-shrink-0">
            <X size={16} className="text-apptivia-carbon-500" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        {loading && !activities.length ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={18} className="animate-spin text-apptivia-coral mr-2" />
            <span className="text-sm text-apptivia-carbon-500">Loading deal details...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 px-6">
            <span className="text-sm text-red-600">{error}</span>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ── Left Column (60%) ──────────────────────────────────────── */}
            <div className="w-3/5 overflow-y-auto p-5 space-y-5 border-r border-apptivia-carbon-100">

              {/* 1. CEP Stage Stepper */}
              <div>
                <p className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-2">Deal Stage</p>
                <div className="flex flex-wrap gap-1.5">
                  {CEP_STAGES.map((stage) => {
                    const isCurrent = currentStageKey === stage.key;
                    const isPast = stage.order < currentStageOrder && !stage.terminal;
                    const isFuture = stage.order > currentStageOrder && !stage.terminal;

                    let pillClass = '';
                    if (isCurrent) {
                      pillClass = 'bg-apptivia-coral text-white';
                    } else if (isPast) {
                      pillClass = 'bg-apptivia-coral/15 text-apptivia-coral';
                    } else if (stage.key === 'close_won') {
                      pillClass = 'bg-apptivia-carbon-100 text-apptivia-carbon-500 hover:bg-emerald-100 hover:text-emerald-700';
                    } else if (stage.key === 'close_lost') {
                      pillClass = 'bg-apptivia-carbon-100 text-apptivia-carbon-500 hover:bg-red-100 hover:text-red-700';
                    } else {
                      pillClass = 'bg-apptivia-carbon-100 text-apptivia-carbon-500 hover:bg-apptivia-carbon-200';
                    }

                    return (
                      <button
                        key={stage.key}
                        onClick={() => handleStageClick(stage)}
                        className={`text-[10px] px-3 py-1 rounded-full font-medium transition-all ${pillClass} ${isCurrent ? 'ring-2 ring-apptivia-coral ring-offset-1' : ''}`}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>

                {/* Win/Loss Reason Prompt */}
                {showReasonPrompt && (
                  <div className="mt-3 bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-apptivia-ink">
                      {showReasonPrompt === 'close_won' ? 'Why did we win this deal?' : 'Why did we lose this deal?'}
                    </p>
                    <textarea
                      rows={2}
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      placeholder="Enter reason (optional)..."
                      className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setShowReasonPrompt(null); setReasonText(''); }}
                        className="text-[10px] font-medium px-3 py-1 rounded-lg text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmTerminal}
                        className={`text-[10px] font-medium px-3 py-1 rounded-lg text-white transition-colors ${
                          showReasonPrompt === 'close_won'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {showReasonPrompt === 'close_won' ? 'Mark Won' : 'Mark Lost'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Deal Details Form */}
              <Section title="Deal Details" defaultOpen={true}>
                <div className="space-y-3">
                  {/* Deal Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Deal Name</label>
                    <input
                      type="text"
                      value={editForm.deal_name || ''}
                      onChange={e => handleFormChange('deal_name', e.target.value)}
                      className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                    />
                  </div>

                  {/* Value + Close Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Value ($)</label>
                      <input
                        type="number"
                        value={editForm.deal_value || ''}
                        onChange={e => handleFormChange('deal_value', e.target.value)}
                        className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Close Date</label>
                      <input
                        type="date"
                        value={editForm.close_date || ''}
                        onChange={e => handleFormChange('close_date', e.target.value)}
                        className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      />
                    </div>
                  </div>

                  {/* Probability + Forecast */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Probability (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editForm.probability ?? ''}
                        onChange={e => handleFormChange('probability', e.target.value)}
                        className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Forecast Category</label>
                      <select
                        value={editForm.forecast_category || 'pipeline'}
                        onChange={e => handleFormChange('forecast_category', e.target.value)}
                        className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      >
                        {FORECAST_CATEGORIES.map(fc => (
                          <option key={fc.value} value={fc.value}>{fc.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Source (read-only if CRM-synced) */}
                  {deal?.external_id && (
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Source</label>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-apptivia-carbon-600">CRM Synced</span>
                        {deal.crm_url && (
                          <a href={deal.crm_url} target="_blank" rel="noreferrer" className="text-[10px] font-medium text-apptivia-coral hover:underline">
                            View in CRM
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={2}
                      value={editForm.description || ''}
                      onChange={e => handleFormChange('description', e.target.value)}
                      className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none"
                    />
                  </div>

                  {/* Next Steps */}
                  <div>
                    <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Next Steps</label>
                    <textarea
                      rows={2}
                      value={editForm.next_steps || ''}
                      onChange={e => handleFormChange('next_steps', e.target.value)}
                      className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none"
                    />
                  </div>

                  {/* Competitor */}
                  <div>
                    <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Competitor</label>
                    <input
                      type="text"
                      value={editForm.competitor || ''}
                      onChange={e => handleFormChange('competitor', e.target.value)}
                      placeholder="e.g. Competitor Inc."
                      className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                    />
                  </div>

                  {/* Win/Loss Reason (conditional) */}
                  {isTerminal && (
                    <div>
                      <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                        {currentStageKey === 'close_won' ? 'Win Reason' : 'Loss Reason'}
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.win_loss_reason || ''}
                        onChange={e => handleFormChange('win_loss_reason', e.target.value)}
                        placeholder={currentStageKey === 'close_won' ? 'Why did we win?' : 'Why did we lose?'}
                        className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none"
                      />
                    </div>
                  )}

                  {/* Save button */}
                  {formDirty && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSaveDetails}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-1.5 rounded-lg bg-apptivia-coral text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              </Section>

              {/* 3. Linked Account */}
              <Section title="Account" defaultOpen={true}>
                {deal?.linked_account_id ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-apptivia-paper border border-apptivia-carbon-100 rounded-lg px-3 py-1.5 flex-1">
                      <Building2 size={12} className="text-apptivia-carbon-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-apptivia-ink truncate">
                        {deal.linked_account_name || deal.linked_account_id}
                      </span>
                    </div>
                    <button
                      onClick={handleUnlinkAccount}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="Unlink account"
                    >
                      <X size={12} className="text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={accountDropdownRef}>
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                      <input
                        type="text"
                        value={accountQuery}
                        onChange={e => handleAccountSearch(e.target.value)}
                        placeholder="Search accounts to link..."
                        className="w-full border border-apptivia-carbon-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      />
                      {searchingAccounts && (
                        <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-apptivia-carbon-400" />
                      )}
                    </div>
                    {accountResults.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {accountResults.map(a => (
                          <button
                            key={a.id}
                            onClick={() => handleLinkAccount(a)}
                            className="w-full text-left px-3 py-2 hover:bg-apptivia-paper transition-colors border-b border-apptivia-carbon-50 last:border-b-0"
                          >
                            <p className="text-xs font-medium text-apptivia-ink">{a.account_name}</p>
                            {a.domain && <p className="text-[10px] text-apptivia-carbon-400">{a.domain}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* 4. Linked Contacts */}
              <Section title="Contacts" count={contacts.length} defaultOpen={true}>
                {contacts.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {contacts.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-apptivia-paper rounded-lg px-3 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-apptivia-ink truncate">
                            {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown'}
                          </p>
                          {c.email && <p className="text-[10px] text-apptivia-carbon-400 truncate">{c.email}</p>}
                        </div>
                        {c.role && (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${ROLE_COLORS[c.role] || ROLE_COLORS.other}`}>
                            {CONTACT_ROLES.find(r => r.value === c.role)?.label || c.role.replace(/_/g, ' ')}
                          </span>
                        )}
                        <button
                          onClick={() => handleUnlinkContact(c.prospect_id || c.id)}
                          className="p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                          title="Remove contact"
                        >
                          <X size={10} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-apptivia-carbon-400 mb-3">No contacts linked yet.</p>
                )}

                {!showContactSearch ? (
                  <button
                    onClick={() => setShowContactSearch(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-apptivia-coral hover:underline"
                  >
                    <Plus size={10} /> Add Contact
                  </button>
                ) : (
                  <div className="relative" ref={contactDropdownRef}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                        <input
                          type="text"
                          value={contactQuery}
                          onChange={e => handleContactSearch(e.target.value)}
                          placeholder="Search contacts..."
                          className="w-full border border-apptivia-carbon-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                          autoFocus
                        />
                        {searchingContactsState && (
                          <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-apptivia-carbon-400" />
                        )}
                      </div>
                      <select
                        value={contactRole}
                        onChange={e => setContactRole(e.target.value)}
                        className="border border-apptivia-carbon-200 rounded-lg px-2 py-1.5 text-[10px] focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      >
                        {CONTACT_ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    {contactResults.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {contactResults.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleLinkContact(c)}
                            className="w-full text-left px-3 py-2 hover:bg-apptivia-paper transition-colors border-b border-apptivia-carbon-50 last:border-b-0"
                          >
                            <p className="text-xs font-medium text-apptivia-ink">
                              {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                            </p>
                            <p className="text-[10px] text-apptivia-carbon-400">
                              {[c.email, c.title, c.company_name].filter(Boolean).join(' \u00B7 ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* 5. Meetings */}
              <Section title="Meetings" count={meetings.length} defaultOpen={false}>
                {meetings.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {meetings.map(m => (
                      <div key={m.id} className="flex items-center gap-2 bg-apptivia-paper rounded-lg px-3 py-1.5">
                        <Calendar size={12} className="text-apptivia-coral flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-apptivia-ink truncate">{m.title || 'Untitled Meeting'}</p>
                          {m.start_time && (
                            <p className="text-[10px] text-apptivia-carbon-400">{formatDateTime(m.start_time)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-apptivia-carbon-400 mb-3">No meetings linked yet.</p>
                )}

                {!showMeetingSearch ? (
                  <button
                    onClick={() => setShowMeetingSearch(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-apptivia-coral hover:underline"
                  >
                    <Plus size={10} /> Link Meeting
                  </button>
                ) : (
                  <div className="relative" ref={meetingDropdownRef}>
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                      <input
                        type="text"
                        value={meetingQuery}
                        onChange={e => handleMeetingSearch(e.target.value)}
                        placeholder="Search calendar events..."
                        className="w-full border border-apptivia-carbon-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                        autoFocus
                      />
                      {searchingMeetingsState && (
                        <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-apptivia-carbon-400" />
                      )}
                    </div>
                    {meetingResults.length > 0 && (
                      <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {meetingResults.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleLinkMeeting(m)}
                            className="w-full text-left px-3 py-2 hover:bg-apptivia-paper transition-colors border-b border-apptivia-carbon-50 last:border-b-0"
                          >
                            <p className="text-xs font-medium text-apptivia-ink">{m.title || 'Untitled'}</p>
                            {m.start_time && (
                              <p className="text-[10px] text-apptivia-carbon-400">{formatDateTime(m.start_time)}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* 6. Tasks */}
              <Section title="Tasks" count={tasks.length} defaultOpen={true}>
                {tasks.length > 0 ? (
                  <div className="space-y-1 mb-3">
                    {tasks.map(t => {
                      const overdue = isTaskOverdue(t);
                      return (
                        <div key={t.id} className="flex items-center gap-2 group py-1">
                          <button onClick={() => handleToggleTask(t)} className="flex-shrink-0">
                            {t.status === 'completed' ? (
                              <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center">
                                <Check size={10} className="text-white" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded border border-apptivia-carbon-300 group-hover:border-apptivia-carbon-500 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs ${t.status === 'completed' ? 'line-through text-apptivia-carbon-400' : 'text-apptivia-ink'}`}>
                              {t.title}
                            </p>
                          </div>
                          {t.due_date && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5 ${
                              overdue ? 'bg-red-100 text-red-700' : 'bg-apptivia-carbon-100 text-apptivia-carbon-500'
                            }`}>
                              <Clock size={8} /> {formatDate(t.due_date)}
                            </span>
                          )}
                          {t.priority && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium}`}>
                              {t.priority}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all flex-shrink-0"
                            title="Delete task"
                          >
                            <Trash2 size={10} className="text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-apptivia-carbon-400 mb-3">No tasks yet.</p>
                )}

                {!showNewTask ? (
                  <button
                    onClick={() => setShowNewTask(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-apptivia-coral hover:underline"
                  >
                    <Plus size={10} /> Add Task
                  </button>
                ) : (
                  <div className="space-y-2 bg-apptivia-paper rounded-lg p-3 border border-apptivia-carbon-100">
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Task title..."
                      className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter' && newTask.title.trim()) handleCreateTask(); }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={newTask.due_date}
                        onChange={e => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                        className="flex-1 border border-apptivia-carbon-200 rounded-lg px-2 py-1 text-[10px] focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      />
                      <select
                        value={newTask.priority}
                        onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                        className="border border-apptivia-carbon-200 rounded-lg px-2 py-1 text-[10px] focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                      >
                        {PRIORITY_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleCreateTask}
                        disabled={!newTask.title.trim()}
                        className="text-[10px] font-medium px-3 py-1 rounded-lg bg-apptivia-coral text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setShowNewTask(false); setNewTask({ title: '', due_date: '', priority: 'medium' }); }}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              {/* 7. Call Log */}
              <Section title="Call Log" count={calls.length} defaultOpen={false}>
                {calls.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {calls.map(c => (
                      <div key={c.id} className="flex items-center gap-2 bg-apptivia-paper rounded-lg px-3 py-1.5">
                        <Phone size={12} className="text-emerald-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-apptivia-ink truncate">{c.contact_name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.duration_minutes != null && (
                              <span className="text-[10px] text-apptivia-carbon-400">
                                {c.duration_minutes >= 60
                                  ? `${Math.floor(c.duration_minutes / 60)}h ${c.duration_minutes % 60}m`
                                  : `${c.duration_minutes}m`
                                }
                              </span>
                            )}
                            {c.created_at && (
                              <span className="text-[10px] text-apptivia-carbon-400">{formatDate(c.created_at)}</span>
                            )}
                          </div>
                          {c.notes && (
                            <p className="text-[10px] text-apptivia-carbon-500 mt-0.5 truncate">{c.notes}</p>
                          )}
                        </div>
                        {c.call_direction && (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            c.call_direction === 'inbound'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {c.call_direction}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-apptivia-carbon-400 mb-3">No calls logged yet.</p>
                )}

                {!showLogCall ? (
                  <button
                    onClick={() => setShowLogCall(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-apptivia-coral hover:underline"
                  >
                    <Plus size={10} /> Log Call
                  </button>
                ) : (
                  <div className="space-y-2 bg-apptivia-paper rounded-lg p-3 border border-apptivia-carbon-100">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newCall.contact_name}
                        onChange={e => setNewCall(prev => ({ ...prev, contact_name: e.target.value }))}
                        placeholder="Contact name..."
                        className="border border-apptivia-carbon-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={newCall.duration_minutes}
                          onChange={e => setNewCall(prev => ({ ...prev, duration_minutes: e.target.value }))}
                          placeholder="Min"
                          className="flex-1 border border-apptivia-carbon-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                        />
                        <span className="text-[10px] text-apptivia-carbon-400">min</span>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={newCall.notes}
                      onChange={e => setNewCall(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Call notes..."
                      className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setNewCall(prev => ({ ...prev, call_direction: 'outbound' }))}
                          className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${
                            newCall.call_direction === 'outbound'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-apptivia-carbon-100 text-apptivia-carbon-500'
                          }`}
                        >
                          Outbound
                        </button>
                        <button
                          onClick={() => setNewCall(prev => ({ ...prev, call_direction: 'inbound' }))}
                          className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${
                            newCall.call_direction === 'inbound'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-apptivia-carbon-100 text-apptivia-carbon-500'
                          }`}
                        >
                          Inbound
                        </button>
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={handleLogCall}
                        disabled={!newCall.contact_name.trim()}
                        className="text-[10px] font-medium px-3 py-1 rounded-lg bg-apptivia-coral text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Log
                      </button>
                      <button
                        onClick={() => { setShowLogCall(false); setNewCall({ contact_name: '', duration_minutes: '', notes: '', call_direction: 'outbound' }); }}
                        className="text-[10px] font-medium px-2 py-1 rounded-lg text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* ── Right Column (40%) -- Activity Timeline ─────────────────── */}
            <div className="w-2/5 overflow-y-auto p-5 bg-apptivia-paper flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={13} className="text-apptivia-carbon-400" />
                <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Deal Activity</span>
                <span className="text-[10px] font-medium text-apptivia-carbon-400 bg-apptivia-carbon-100 px-1.5 py-0.5 rounded-full ml-auto">
                  {activities.length}
                </span>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto space-y-0 mb-4">
                {sortedActivities.length > 0 ? (
                  sortedActivities.map(a => {
                    const colorClass = ACTIVITY_COLORS[a.activity_type] || 'bg-apptivia-carbon-400';
                    return (
                      <div key={a.id} className="flex gap-3 py-2.5 border-b border-apptivia-carbon-100/50 last:border-b-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <span className="text-white text-[8px] font-bold">
                            {(a.activity_type || '').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-apptivia-ink">{a.title}</p>
                          {a.description && (
                            <p className="text-[10px] text-apptivia-carbon-500 mt-0.5 line-clamp-2">{a.description}</p>
                          )}
                          <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">{timeAgo(a.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-xs text-apptivia-carbon-400">No activity recorded yet.</p>
                  </div>
                )}
              </div>

              {/* Add Note */}
              <div className="border-t border-apptivia-carbon-100 pt-3 mt-auto">
                <p className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1.5">Add Note</p>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note to this deal..."
                  className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none resize-none bg-white"
                />
                {noteText.trim() && (
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-3 py-1 rounded-lg bg-apptivia-ink text-white hover:bg-apptivia-ink/90 transition-colors disabled:opacity-50"
                    >
                      {addingNote ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
