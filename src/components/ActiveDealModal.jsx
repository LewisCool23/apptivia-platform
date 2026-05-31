import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  X, Search, Plus, Trash2, Check, Calendar, Phone, Users, Building2,
  FileText, ChevronDown, ChevronUp, Clock, Loader2, Pencil,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useActiveDeal } from '../hooks/useActiveDeal';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { useCepConfig } from '../hooks/useCepConfig';
import { useSalesDna } from '../hooks/useSalesDna';
import { QUALIFICATION_FRAMEWORKS } from '../constants/salesDna';

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

const FALLBACK_STAGES = [
  { key: 'lead',          label: 'Lead',         order: 1 },
  { key: 'opp_creation',  label: 'Opp Creation', order: 2 },
  { key: 'qualification', label: 'Qualification', order: 3 },
  { key: 'best_case',     label: 'Best Case',    order: 4 },
  { key: 'forecast',      label: 'Forecast',     order: 5 },
  { key: 'commit',        label: 'Commit',       order: 6 },
  { key: 'closed_won',    label: 'Closed Won',   order: 7, terminal: true },
  { key: 'closed_lost',   label: 'Closed Lost',  order: 8, terminal: true },
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

const CLOSED_LOST_REASONS = [
  'Price / Budget',
  'Chose Competitor',
  'No Decision / Stalled',
  'Timing Not Right',
  'Product Fit',
  'Lost to Status Quo',
  'Champion Left',
  'Internal Priorities Changed',
  'Went Dark / Unresponsive',
  'Other',
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
  contact_linked:   'bg-apptivia-coral',
  account_linked:   'bg-apptivia-coral',
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
  } = useActiveDeal(isOpen ? dealId : null, organizationId);

  // Load org's configured CEP stages — single source of truth
  const cepConfig = useCepConfig(organizationId || '');
  const dealStages = React.useMemo(() => {
    if (cepConfig.activeStages?.length > 0) {
      return cepConfig.activeStages.map(s => ({
        key: s.stage_key,
        label: s.stage_name,
        order: s.stage_order,
        terminal: s.is_terminal,
        color: s.color,
      }));
    }
    return FALLBACK_STAGES;
  }, [cepConfig.activeStages]);

  // Load org's qualification framework from Sales DNA
  const { salesDna } = useSalesDna(organizationId || '');
  const qualificationCriteria = React.useMemo(() => {
    if (!salesDna?.qualification_framework) return [];
    if (salesDna.qualification_framework === 'custom') {
      return (salesDna.custom_qualification_criteria || []).map(c => ({
        key: c.key, label: c.label, description: c.description || '',
      }));
    }
    const fw = QUALIFICATION_FRAMEWORKS.find(f => f.key === salesDna.qualification_framework);
    return fw?.criteria || [];
  }, [salesDna]);

  const [qualData, setQualData] = useState({});
  useEffect(() => {
    if (deal?.qualification_data && typeof deal.qualification_data === 'object') {
      setQualData(deal.qualification_data);
    } else {
      setQualData({});
    }
  }, [deal]);

  const qualMet = Object.values(qualData).filter(Boolean).length;
  const qualTotal = qualificationCriteria.length;

  const handleQualToggle = async (criterionKey) => {
    const updated = { ...qualData, [criterionKey]: !qualData[criterionKey] };
    setQualData(updated);
    try {
      await updateDeal({ qualification_data: updated });
    } catch (err) {
      console.error('Failed to update qualification:', err);
    }
  };

  /* ── Software in Use ──────────────────────────────────────────────────── */
  const [softwareOptions, setSoftwareOptions] = useState([]);
  const [softwareInUse, setSoftwareInUse] = useState([]);
  const [showSoftwareDropdown, setShowSoftwareDropdown] = useState(false);
  const [softwareSearch, setSoftwareSearch] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('icp_config, signal_config')
        .eq('id', organizationId)
        .single();
      if (data) {
        const techs = data.icp_config?.target_technologies || [];
        const competitors = data.signal_config?.competitors || [];
        const combined = [...new Set([...techs, ...competitors])].sort((a, b) => a.localeCompare(b));
        setSoftwareOptions(combined);
      }
    })();
  }, [organizationId]);

  useEffect(() => {
    if (deal?.software_in_use && Array.isArray(deal.software_in_use)) {
      setSoftwareInUse(deal.software_in_use);
    } else {
      setSoftwareInUse([]);
    }
  }, [deal]);

  const handleAddSoftware = async (item) => {
    if (softwareInUse.includes(item)) return;
    const updated = [...softwareInUse, item];
    setSoftwareInUse(updated);
    setShowSoftwareDropdown(false);
    setSoftwareSearch('');
    try { await updateDeal({ software_in_use: updated }); } catch (err) { console.error('Failed to update software:', err); }
  };

  const handleRemoveSoftware = async (item) => {
    const updated = softwareInUse.filter(s => s !== item);
    setSoftwareInUse(updated);
    try { await updateDeal({ software_in_use: updated }); } catch (err) { console.error('Failed to update software:', err); }
  };

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
  const [showReasonPrompt, setShowReasonPrompt] = useState(null); // 'closed_won' | 'closed_lost' | null
  const [reasonText, setReasonText] = useState('');
  const [closedLostReason, setClosedLostReason] = useState('');

  const currentStageKey = deal?.stage || '';
  const currentStageOrder = dealStages.find(s => s.key === currentStageKey)?.order ?? -1;

  const handleStageClick = async (stage) => {
    if (stage.terminal) {
      setShowReasonPrompt(stage.key);
      setReasonText('');
      return;
    }
    try {
      await updateDeal({ stage: stage.key });
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const handleConfirmTerminal = async () => {
    if (!showReasonPrompt) return;
    try {
      const fields = { stage: showReasonPrompt };
      if (showReasonPrompt === 'closed_won' && reasonText.trim()) {
        fields.win_loss_reason = reasonText.trim();
      }
      if (showReasonPrompt === 'closed_lost' && closedLostReason) {
        fields.win_loss_reason = closedLostReason;
      }
      await updateDeal(fields);
      setShowReasonPrompt(null);
      setReasonText('');
      setClosedLostReason('');
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

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState({ title: '', due_date: '', priority: 'medium' });

  const startEditTask = (t) => {
    setEditingTaskId(t.id);
    setEditingTask({ title: t.title, due_date: t.due_date || '', priority: t.priority || 'medium' });
  };

  const handleSaveEditTask = async () => {
    if (!editingTask.title.trim()) return;
    try {
      await updateTask(editingTaskId, {
        title: editingTask.title.trim(),
        due_date: editingTask.due_date || null,
        priority: editingTask.priority,
      });
      setEditingTaskId(null);
      if (onDealUpdated) onDealUpdated();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const cyclePriority = (current) => {
    const order = ['low', 'medium', 'high'];
    return order[(order.indexOf(current) + 1) % order.length];
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
  const isTerminal = currentStageKey === 'closed_won' || currentStageKey === 'closed_lost';

  const stageBadgeClass = (() => {
    switch (currentStageKey) {
      case 'closed_won':  return 'bg-emerald-100 text-emerald-700';
      case 'closed_lost': return 'bg-red-100 text-red-700';
      default:            return 'bg-apptivia-coral/10 text-apptivia-coral';
    }
  })();

  const currentStageLabel = dealStages.find(s => s.key === currentStageKey)?.label || currentStageKey || 'Unknown';

  const isTaskOverdue = (task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const sortedActivities = [...activities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  /* ── Render ───────────────────────────────────────────────────────────── */
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div
        className="max-w-5xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
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
          <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-apptivia-carbon-100 rounded-lg transition-colors flex-shrink-0">
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
                  {dealStages.map((stage) => {
                    const isCurrent = currentStageKey === stage.key;
                    const isPast = stage.order < currentStageOrder && !stage.terminal;
                    const isFuture = stage.order > currentStageOrder && !stage.terminal;

                    let pillClass = '';
                    if (isCurrent) {
                      pillClass = 'bg-apptivia-coral text-white';
                    } else if (isPast) {
                      pillClass = 'bg-apptivia-coral/15 text-apptivia-coral';
                    } else if (stage.key === 'closed_won' || stage.key === 'close_won') {
                      pillClass = 'bg-apptivia-carbon-100 text-apptivia-carbon-500 hover:bg-emerald-100 hover:text-emerald-700';
                    } else if (stage.key === 'closed_lost' || stage.key === 'close_lost') {
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

                {/* Closed Won Reason Prompt */}
                {showReasonPrompt === 'closed_won' && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-emerald-800">Why did we win this deal?</p>
                    <textarea
                      rows={2}
                      value={reasonText}
                      onChange={e => setReasonText(e.target.value)}
                      placeholder="e.g. Strong champion, competitive pricing, product fit..."
                      className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none resize-none"
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
                        className="text-[10px] font-medium px-3 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                      >
                        Mark Won
                      </button>
                    </div>
                  </div>
                )}

                {/* Closed Lost Reason Prompt */}
                {showReasonPrompt === 'closed_lost' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-red-800">Why did we lose this deal?</p>
                    <select
                      value={closedLostReason}
                      onChange={e => setClosedLostReason(e.target.value)}
                      className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-red-400 focus:border-red-400 outline-none bg-white"
                      autoFocus
                    >
                      <option value="">Select a reason...</option>
                      {CLOSED_LOST_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setShowReasonPrompt(null); setClosedLostReason(''); }}
                        className="text-[10px] font-medium px-3 py-1 rounded-lg text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmTerminal}
                        disabled={!closedLostReason}
                        className="text-[10px] font-medium px-3 py-1 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        Mark Lost
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Qualification Checklist */}
              {qualificationCriteria.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                      Qualification — {salesDna?.qualification_framework === 'custom'
                        ? (salesDna?.custom_qualification_name || 'Custom')
                        : (salesDna?.qualification_framework || '').toUpperCase()}
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      qualMet === qualTotal
                        ? 'bg-emerald-100 text-emerald-700'
                        : qualMet > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-apptivia-carbon-100 text-apptivia-carbon-500'
                    }`}>
                      {qualMet}/{qualTotal}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {qualificationCriteria.map((criterion) => {
                      const met = !!qualData[criterion.key];
                      return (
                        <button
                          key={criterion.key}
                          onClick={() => handleQualToggle(criterion.key)}
                          className={`flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                            met
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-apptivia-carbon-50 text-apptivia-carbon-500 hover:bg-apptivia-carbon-100'
                          }`}
                          title={criterion.description}
                        >
                          <span className={`w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center ${
                            met ? 'bg-emerald-500 border-emerald-500' : 'border-apptivia-carbon-300'
                          }`}>
                            {met && <Check size={8} className="text-white" />}
                          </span>
                          {criterion.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Deal Details Form */}
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

                  {/* Probability */}
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

                  {/* Software in Use */}
                  <div className="relative">
                    <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Software in Use</label>
                    {softwareInUse.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 mb-1">
                        {softwareInUse.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 text-[10px] bg-apptivia-paper border border-apptivia-carbon-200 rounded-full px-2 py-0.5">
                            {s}
                            <button onClick={() => handleRemoveSoftware(s)} className="hover:text-red-500 transition-colors"><X size={8} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowSoftwareDropdown(!showSoftwareDropdown)}
                      className="mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-left text-apptivia-carbon-400 hover:border-apptivia-carbon-300 transition-colors"
                    >
                      + Add software...
                    </button>
                    {showSoftwareDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        <input
                          type="text"
                          value={softwareSearch}
                          onChange={e => setSoftwareSearch(e.target.value)}
                          placeholder="Search..."
                          className="w-full border-b border-apptivia-carbon-100 px-3 py-1.5 text-xs focus:outline-none"
                          autoFocus
                        />
                        {softwareOptions
                          .filter(s => !softwareInUse.includes(s) && s.toLowerCase().includes(softwareSearch.toLowerCase()))
                          .map(s => (
                            <button
                              key={s}
                              onClick={() => handleAddSoftware(s)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-apptivia-paper transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        {softwareSearch.trim() && !softwareOptions.includes(softwareSearch.trim()) && (
                          <button
                            onClick={() => handleAddSoftware(softwareSearch.trim())}
                            className="w-full text-left px-3 py-1.5 text-xs text-apptivia-coral hover:bg-apptivia-paper transition-colors"
                          >
                            + Add "{softwareSearch.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Closed Won Reason (free-text) */}
                  {currentStageKey === 'closed_won' && (
                    <div>
                      <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Closed Won Reason</label>
                      <textarea
                        rows={2}
                        value={editForm.win_loss_reason || ''}
                        onChange={e => handleFormChange('win_loss_reason', e.target.value)}
                        placeholder="Why did we win this deal?"
                        className="mt-1 w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none resize-none"
                      />
                    </div>
                  )}

                  {/* Closed Lost Reason (preset dropdown) */}
                  {currentStageKey === 'closed_lost' && (
                    <div>
                      <label className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Closed Lost Reason</label>
                      <select
                        value={editForm.win_loss_reason || ''}
                        onChange={e => handleFormChange('win_loss_reason', e.target.value)}
                        className="mt-1 w-full border border-red-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-red-400 focus:border-red-400 outline-none bg-white"
                      >
                        <option value="">Select a reason...</option>
                        {CLOSED_LOST_REASONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
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
                      const isEditing = editingTaskId === t.id;

                      if (isEditing) {
                        return (
                          <div key={t.id} className="flex items-center gap-2 py-1 bg-apptivia-paper rounded-lg px-2">
                            <input
                              type="text"
                              value={editingTask.title}
                              onChange={e => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                              className="flex-1 min-w-0 border border-apptivia-carbon-200 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveEditTask(); if (e.key === 'Escape') setEditingTaskId(null); }}
                            />
                            <input
                              type="date"
                              value={editingTask.due_date || ''}
                              onChange={e => setEditingTask(prev => ({ ...prev, due_date: e.target.value }))}
                              className="border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-[10px] focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                            />
                            <button
                              onClick={() => setEditingTask(prev => ({ ...prev, priority: cyclePriority(prev.priority) }))}
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-pointer ${PRIORITY_COLORS[editingTask.priority] || PRIORITY_COLORS.medium}`}
                              title="Click to cycle priority"
                            >
                              {editingTask.priority}
                            </button>
                            <button onClick={handleSaveEditTask} className="p-1 hover:bg-emerald-50 rounded" title="Save">
                              <Check size={10} className="text-emerald-600" />
                            </button>
                            <button onClick={() => setEditingTaskId(null)} className="p-1 hover:bg-apptivia-carbon-100 rounded" title="Cancel">
                              <X size={10} className="text-apptivia-carbon-400" />
                            </button>
                          </div>
                        );
                      }

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
                            onClick={() => startEditTask(t)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-apptivia-paper rounded transition-all flex-shrink-0"
                            title="Edit task"
                          >
                            <Pencil size={10} className="text-apptivia-carbon-400" />
                          </button>
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
                          <p className="text-[10px] text-apptivia-carbon-400 mt-0.5">
                            {(a.profiles?.full_name || a.profiles?.first_name) && (
                              <span className="font-medium text-apptivia-carbon-500">{a.profiles.full_name || `${a.profiles.first_name} ${a.profiles.last_name || ''}`.trim()}</span>
                            )}
                            {(a.profiles?.full_name || a.profiles?.first_name) && ' · '}
                            {timeAgo(a.created_at)}
                          </p>
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
    </div>,
    document.body
  );
}
