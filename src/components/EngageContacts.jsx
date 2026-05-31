import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Filter, Download, Columns3, X, ChevronUp, ChevronDown,
  Mail, Phone, Eye, ExternalLink, GitBranch, Trash2, UserPlus, Tag,
  Users, Clock, Copy, Check, ChevronLeft, ChevronRight, MoreHorizontal,
  Zap, Building2, Briefcase, Globe, ClipboardList, CalendarDays, Pencil
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';
import AddToSequenceModal from './AddToSequenceModal';
import CreateTaskModal from './CreateTaskModal';
import toast from 'react-hot-toast';

// ── Constants ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['new', 'contacted', 'replied', 'qualified', 'disqualified'];

const STATUS_BADGES = {
  new: 'bg-sky-50 text-sky-700',
  contacted: 'bg-amber-50 text-amber-700',
  replied: 'bg-emerald-50 text-emerald-700',
  qualified: 'bg-orange-50 text-apptivia-coral',
  disqualified: 'bg-red-50 text-red-600',
};

const SENIORITY_BADGES = {
  'C-Suite': 'bg-purple-100 text-purple-700',
  'VP': 'bg-indigo-100 text-indigo-700',
  'Director': 'bg-sky-100 text-sky-700',
  'Manager': 'bg-teal-100 text-teal-700',
  'IC': 'bg-gray-100 text-gray-600',
};

const SOURCE_OPTIONS = ['apollo', 'pdl', 'manual', 'import'];
const SENIORITY_OPTIONS = ['C-Suite', 'VP', 'Director', 'Manager', 'IC'];
const PAGE_SIZES = [25, 50, 100];

const COLUMN_OPTIONS = [
  { key: 'name', label: 'Name', locked: true },
  { key: 'title', label: 'Title' },
  { key: 'company', label: 'Company' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'fitScore', label: 'Fit Score' },
  { key: 'influence', label: 'Influence' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'created', label: 'Created' },
  { key: 'department', label: 'Department' },
  { key: 'source', label: 'Source' },
  { key: 'tags', label: 'Tags' },
  { key: 'owner', label: 'Owner' },
  { key: 'tenure', label: 'Tenure' },
];

const DEFAULT_COLUMNS = { name: true, title: true, company: true, email: true, status: true, fitScore: true, influence: false, lastActivity: true, created: true, department: false, source: false, tags: false, owner: false, tenure: false };

function loadColumnPrefs() {
  try { const s = localStorage.getItem('apptivia_contact_columns'); return s ? JSON.parse(s) : DEFAULT_COLUMNS; } catch { return DEFAULT_COLUMNS; }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function relativeTime(date) {
  if (!date) return '—';
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const mos = Math.floor(days / 30);
  return `${mos}mo ago`;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getLastActivity(c) {
  const dates = [c.last_called_at, c.last_researched_at].filter(Boolean).map(d => new Date(d).getTime());
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

function fitColor(score) {
  if (score >= 70) return 'bg-emerald-50 text-emerald-700';
  if (score >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
}

function initials(c) {
  return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() || '?';
}

// ── ColumnPicker ─────────────────────────────────────────────────────────

function ColumnPicker({ visible, onToggle, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 bg-white border border-apptivia-carbon-100 rounded-lg shadow-lg z-50 w-48 py-1 max-h-72 overflow-y-auto">
      {COLUMN_OPTIONS.map(col => (
        <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-apptivia-paper text-xs cursor-pointer">
          <input type="checkbox" checked={!!visible[col.key]} disabled={col.locked} onChange={() => onToggle(col.key)}
            className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral" />
          <span className={col.locked ? 'text-apptivia-carbon-400' : 'text-apptivia-carbon-700'}>{col.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── FilterPanel ──────────────────────────────────────────────────────────

function FilterPanel({ filters, onChange, onClear }) {
  const update = (key, val) => onChange({ ...filters, [key]: val });

  const toggleMulti = (key, val) => {
    const arr = filters[key] || [];
    update(key, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  return (
    <div className="bg-white border border-apptivia-carbon-100 rounded-lg p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Company */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Company</label>
        <input type="text" placeholder="Filter by company..." value={filters.company || ''} onChange={e => update('company', e.target.value)}
          className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-apptivia-coral" />
      </div>
      {/* Status */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Status</label>
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => toggleMulti('status', s)}
              className={`px-2 py-0.5 rounded-full text-[10px] capitalize transition-colors ${(filters.status || []).includes(s) ? 'bg-apptivia-coral text-white' : 'bg-apptivia-carbon-50 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {/* Fit Score Range */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Fit Score</label>
        <div className="flex items-center gap-1">
          <input type="number" placeholder="Min" value={filters.fitScoreMin || ''} onChange={e => update('fitScoreMin', e.target.value)}
            className="w-16 border border-apptivia-carbon-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-apptivia-coral" />
          <span className="text-apptivia-carbon-400 text-xs">–</span>
          <input type="number" placeholder="Max" value={filters.fitScoreMax || ''} onChange={e => update('fitScoreMax', e.target.value)}
            className="w-16 border border-apptivia-carbon-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-apptivia-coral" />
        </div>
      </div>
      {/* Seniority */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Seniority</label>
        <div className="flex flex-wrap gap-1">
          {SENIORITY_OPTIONS.map(s => (
            <button key={s} onClick={() => toggleMulti('seniority', s)}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${(filters.seniority || []).includes(s) ? 'bg-apptivia-coral text-white' : 'bg-apptivia-carbon-50 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {/* Source */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Source</label>
        <div className="flex flex-wrap gap-1">
          {SOURCE_OPTIONS.map(s => (
            <button key={s} onClick={() => toggleMulti('source', s)}
              className={`px-2 py-0.5 rounded-full text-[10px] capitalize transition-colors ${(filters.source || []).includes(s) ? 'bg-apptivia-coral text-white' : 'bg-apptivia-carbon-50 text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {/* Owner */}
      <div>
        <label className="text-[10px] font-medium text-apptivia-carbon-500 uppercase mb-1 block">Owner</label>
        <select value={filters.owner || ''} onChange={e => update('owner', e.target.value)}
          className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-apptivia-coral bg-white">
          <option value="">All</option>
          <option value="me">My Contacts</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>
      {/* Clear */}
      <div className="flex items-end">
        <button onClick={onClear} className="text-xs text-apptivia-coral hover:underline">Clear All Filters</button>
      </div>
    </div>
  );
}

// ── BulkActionBar ────────────────────────────────────────────────────────

function BulkActionBar({ count, onAction, onClear }) {
  const [statusDropdown, setStatusDropdown] = useState(false);

  return (
    <div className="bg-apptivia-ink text-white rounded-lg p-2 px-4 mb-3 flex items-center gap-3 text-xs">
      <span className="font-medium">{count} selected</span>
      <div className="w-px h-4 bg-white/20" />
      <button onClick={() => onAction('sequence')} className="flex items-center gap-1 hover:text-apptivia-coral transition-colors"><GitBranch size={12} /> Add to Sequence</button>
      <div className="relative">
        <button onClick={() => setStatusDropdown(!statusDropdown)} className="flex items-center gap-1 hover:text-apptivia-coral transition-colors"><Tag size={12} /> Change Status</button>
        {statusDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-apptivia-carbon-100 rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => { onAction('status', s); setStatusDropdown(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-apptivia-carbon-700 hover:bg-apptivia-paper capitalize">{s}</button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => onAction('delete')} className="flex items-center gap-1 hover:text-red-400 transition-colors"><Trash2 size={12} /> Delete</button>
      <div className="flex-1" />
      <button onClick={onClear} className="text-white/60 hover:text-white transition-colors">Clear Selection</button>
    </div>
  );
}

// ── ContactDetailPanel ──────────────────────────────────────────────────

function ContactDetailPanel({ contact, onClose, onCallContact, onEmailContact, onViewBrief, onNavigateDiscover, onRefresh, userId, organizationId, onNavigateTab, onContactUpdate }) {
  // statusEditing removed — all statuses always visible
  const [tagInput, setTagInput] = useState('');
  const [copied, setCopied] = useState(null);
  const [activities, setActivities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);

  // Editable fields
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editingSecEmail, setEditingSecEmail] = useState(false);
  const [editSecEmail, setEditSecEmail] = useState('');
  const [editingSecPhone, setEditingSecPhone] = useState(false);
  const [editSecPhone, setEditSecPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState(null);
  const [editingOwner, setEditingOwner] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const notesInitRef = useRef(false);
  const c = contact;

  // Sync editable fields when contact changes
  useEffect(() => {
    if (!c) return;
    setEditEmail(c.email || '');
    setEditPhone(c.phone || '');
    setEditSecEmail(c.secondary_email || '');
    setEditSecPhone(c.secondary_phone || '');
    setNotes(c.notes || '');
    notesInitRef.current = false;
    setEditingEmail(false);
    setEditingPhone(false);
    setEditingSecEmail(false);
    setEditingSecPhone(false);
    setEditingOwner(false);
  }, [c?.id]);

  // Notes auto-save (debounced 1s)
  useEffect(() => {
    if (!c) return;
    if (!notesInitRef.current) { notesInitRef.current = true; return; }
    const t = setTimeout(async () => {
      setNotesSaving(true);
      const { error } = await supabase.from('engage_prospects').update({ notes }).eq('id', c.id);
      if (!error && onContactUpdate) onContactUpdate(c.id, { notes });
      setNotesSavedAt(new Date());
      setNotesSaving(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [notes]);

  // Load engagement data
  useEffect(() => {
    if (!c) return;
    const loads = [];
    const orgId = organizationId;

    // CRM activity records
    if (c.email) {
      loads.push(
        supabase.from('crm_activity_records')
          .select('id, activity_type, activity_date, subject, contact_name, duration_seconds, source')
          .eq('contact_email', c.email)
          .order('activity_date', { ascending: false })
          .limit(10)
          .then(({ data }) => setActivities(data || []))
      );
    }

    // Account contacts
    loads.push(
      supabase.from('engage_account_contacts')
        .select('id, account_id, committee_role, influence_level, engage_accounts:account_id(account_name, domain)')
        .eq('prospect_id', c.id)
        .limit(5)
        .then(({ data }) => setAccounts(data || []))
    );

    // Deal contacts
    loads.push(
      supabase.from('engage_deal_contacts')
        .select('id, deal_id, role, engage_pipeline_deals:deal_id(deal_name, stage, deal_value)')
        .eq('prospect_id', c.id)
        .limit(5)
        .then(({ data }) => setDeals(data || []))
    );

    // Sequence enrollments
    loads.push(
      supabase.from('engage_sequence_enrollments')
        .select('id, status, current_step, enrolled_at, engage_sequences:sequence_id(name)')
        .eq('prospect_id', c.id)
        .order('enrolled_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setEnrollments(data || []))
    );

    // Meetings (calendar events where contact is attendee)
    if (c.email && orgId) {
      loads.push(
        supabase.from('integration_calendar_events')
          .select('id, title, start_time, end_time, meeting_outcome, event_type, attendees')
          .eq('organization_id', orgId)
          .order('start_time', { ascending: false })
          .limit(20)
          .then(({ data }) => {
            const matching = (data || []).filter(evt => {
              const att = evt.attendees || [];
              return att.some(a => (a.email || '').toLowerCase() === c.email.toLowerCase());
            });
            setMeetings(matching.slice(0, 10));
          })
      );
    }

    // Tasks linked to this contact
    loads.push(
      supabase.from('engage_tasks')
        .select('id, title, status, priority, due_date, created_at, completed_at')
        .eq('prospect_id', c.id)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => setTasks(data || []))
    );

    // Org members for owner assignment
    if (orgId) {
      loads.push(
        supabase.from('profiles')
          .select('id, full_name, first_name, last_name')
          .eq('organization_id', orgId)
          .order('full_name')
          .then(({ data }) => setOrgMembers(data || []))
      );
    }

    Promise.all(loads).catch(() => {});
  }, [c, organizationId]);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleStatusChange = async (newStatus) => {
    await supabase.from('engage_prospects').update({ status: newStatus }).eq('id', c.id);
    onRefresh();
  };

  const handleAddTag = async () => {
    const t = tagInput.trim();
    if (!t) return;
    const newTags = [...new Set([...(c.tags || []), t])];
    await supabase.from('engage_prospects').update({ tags: newTags }).eq('id', c.id);
    setTagInput('');
    onRefresh();
  };

  const handleRemoveTag = async (tag) => {
    const newTags = (c.tags || []).filter(t => t !== tag);
    await supabase.from('engage_prospects').update({ tags: newTags }).eq('id', c.id);
    onRefresh();
  };

  // Inline field save handlers
  const handleSaveEmail = async () => {
    await supabase.from('engage_prospects').update({ email: editEmail.trim() || null }).eq('id', c.id);
    setEditingEmail(false);
    onRefresh();
  };
  const handleSavePhone = async () => {
    await supabase.from('engage_prospects').update({ phone: editPhone.trim() || null }).eq('id', c.id);
    setEditingPhone(false);
    onRefresh();
  };
  const handleSaveSecEmail = async () => {
    await supabase.from('engage_prospects').update({ secondary_email: editSecEmail.trim() || null }).eq('id', c.id);
    setEditingSecEmail(false);
    onRefresh();
  };
  const handleSaveSecPhone = async () => {
    await supabase.from('engage_prospects').update({ secondary_phone: editSecPhone.trim() || null }).eq('id', c.id);
    setEditingSecPhone(false);
    onRefresh();
  };

  const handleClaimOwner = async () => {
    await supabase.from('engage_prospects').update({ assigned_to: userId }).eq('id', c.id);
    setEditingOwner(false);
    onRefresh();
  };
  const handleAssignOwner = async (profileId) => {
    await supabase.from('engage_prospects').update({ assigned_to: profileId || null }).eq('id', c.id);
    setEditingOwner(false);
    onRefresh();
  };

  if (!c) return null;

  // Build unified timeline
  const timeline = [];
  if (c.last_researched_at) timeline.push({ type: 'brief', date: c.last_researched_at });
  enrollments.forEach(e => timeline.push({ type: 'enrollment', date: e.enrolled_at, data: e }));
  activities.forEach(a => timeline.push({ type: 'activity', date: a.activity_date, data: a }));
  meetings.forEach(m => timeline.push({ type: 'meeting', date: m.start_time, data: m }));
  tasks.forEach(t => timeline.push({ type: 'task', date: t.created_at, data: t }));
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-50 border-l border-apptivia-carbon-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-apptivia-carbon-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-apptivia-coral text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(c)}
              </div>
              <div>
                <h3 className="font-bold text-apptivia-ink text-sm">{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown'}</h3>
                <p className="text-xs text-apptivia-carbon-500">{c.title}{c.company_name ? ` at ${c.company_name}` : ''}</p>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={`px-2 py-0.5 rounded-full text-[10px] capitalize transition-all ${(c.status || 'new') === s
                        ? `${STATUS_BADGES[s] || 'bg-gray-100 text-gray-600'} ring-1 ring-offset-1 ring-apptivia-carbon-300 font-semibold`
                        : 'bg-apptivia-carbon-50 text-apptivia-carbon-400 hover:bg-apptivia-carbon-100'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-2 border-b border-apptivia-carbon-100 flex items-center gap-2 flex-shrink-0">
          {c.email && <button onClick={() => onEmailContact?.(c)} title="Email" className="p-2 rounded-lg hover:bg-apptivia-paper text-apptivia-coral"><Mail size={14} /></button>}
          <button onClick={() => c.phone ? onCallContact?.({ name: c.full_name, phone: c.phone, company_name: c.company_name }) : null}
            title={c.phone || 'No phone number'} disabled={!c.phone}
            className={`p-2 rounded-lg hover:bg-apptivia-paper ${c.phone ? 'text-emerald-600' : 'text-apptivia-carbon-300 cursor-not-allowed'}`}><Phone size={14} /></button>
          {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="p-2 rounded-lg hover:bg-apptivia-paper text-apptivia-ink"><ExternalLink size={14} /></a>}
          <button onClick={() => onViewBrief?.(c)} title="View Brief" className="p-2 rounded-lg hover:bg-apptivia-paper text-apptivia-ink"><Eye size={14} /></button>
          <button onClick={() => onNavigateDiscover?.({ mode: 'prospect', query: c.full_name || c.first_name || '' })} title="Research" className="p-2 rounded-lg hover:bg-apptivia-paper text-apptivia-ink"><Search size={14} /></button>
          <button onClick={() => setShowCreateTask(true)} title="Create Task" className="p-2 rounded-lg hover:bg-apptivia-paper text-apptivia-ink"><ClipboardList size={14} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Contact Info — Editable */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide">Contact Info</h4>

            {/* Primary Email */}
            <div className="flex items-center justify-between text-xs group">
              {editingEmail ? (
                <div className="flex items-center gap-1 flex-1">
                  <Mail size={12} className="text-apptivia-carbon-400 flex-shrink-0" />
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEmail(); if (e.key === 'Escape') setEditingEmail(false); }}
                    className="flex-1 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-apptivia-coral" />
                  <button onClick={handleSaveEmail} className="text-emerald-500 hover:text-emerald-700"><Check size={12} /></button>
                  <button onClick={() => { setEditingEmail(false); setEditEmail(c.email || ''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-apptivia-carbon-700"><Mail size={12} className="text-apptivia-carbon-400" />{c.email || <span className="italic text-apptivia-carbon-400">No email</span>}</div>
                  <div className="flex items-center gap-1">
                    {c.email && <button onClick={() => handleCopy(c.email, 'email')} className="text-apptivia-carbon-400 hover:text-apptivia-ink">{copied === 'email' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>}
                    <button onClick={() => setEditingEmail(true)} className="text-apptivia-carbon-300 hover:text-apptivia-ink transition-opacity"><Pencil size={10} /></button>
                  </div>
                </>
              )}
            </div>

            {/* Secondary Email */}
            {(c.secondary_email || editingSecEmail) ? (
              <div className="flex items-center justify-between text-xs group pl-5">
                {editingSecEmail ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input type="email" value={editSecEmail} onChange={e => setEditSecEmail(e.target.value)} autoFocus placeholder="Secondary email"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSecEmail(); if (e.key === 'Escape') setEditingSecEmail(false); }}
                      className="flex-1 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-apptivia-coral" />
                    <button onClick={handleSaveSecEmail} className="text-emerald-500 hover:text-emerald-700"><Check size={12} /></button>
                    <button onClick={() => { setEditingSecEmail(false); setEditSecEmail(c.secondary_email || ''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-apptivia-carbon-500">{c.secondary_email}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleCopy(c.secondary_email, 'secEmail')} className="text-apptivia-carbon-400 hover:text-apptivia-ink">{copied === 'secEmail' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>
                      <button onClick={() => setEditingSecEmail(true)} className="text-apptivia-carbon-300 hover:text-apptivia-ink transition-opacity"><Pencil size={10} /></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => setEditingSecEmail(true)} className="text-[10px] text-apptivia-coral hover:underline pl-5">+ Add secondary email</button>
            )}

            {/* Primary Phone */}
            <div className="flex items-center justify-between text-xs group">
              {editingPhone ? (
                <div className="flex items-center gap-1 flex-1">
                  <Phone size={12} className="text-apptivia-carbon-400 flex-shrink-0" />
                  <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePhone(); if (e.key === 'Escape') setEditingPhone(false); }}
                    className="flex-1 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-apptivia-coral" />
                  <button onClick={handleSavePhone} className="text-emerald-500 hover:text-emerald-700"><Check size={12} /></button>
                  <button onClick={() => { setEditingPhone(false); setEditPhone(c.phone || ''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-apptivia-carbon-700"><Phone size={12} className="text-apptivia-carbon-400" />{c.phone || <span className="italic text-apptivia-carbon-400">No phone</span>}</div>
                  <div className="flex items-center gap-1">
                    {c.phone && <button onClick={() => handleCopy(c.phone, 'phone')} className="text-apptivia-carbon-400 hover:text-apptivia-ink">{copied === 'phone' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>}
                    <button onClick={() => setEditingPhone(true)} className="text-apptivia-carbon-300 hover:text-apptivia-ink transition-opacity"><Pencil size={10} /></button>
                  </div>
                </>
              )}
            </div>

            {/* Secondary Phone */}
            {(c.secondary_phone || editingSecPhone) ? (
              <div className="flex items-center justify-between text-xs group pl-5">
                {editingSecPhone ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input type="tel" value={editSecPhone} onChange={e => setEditSecPhone(e.target.value)} autoFocus placeholder="Secondary phone"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSecPhone(); if (e.key === 'Escape') setEditingSecPhone(false); }}
                      className="flex-1 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-apptivia-coral" />
                    <button onClick={handleSaveSecPhone} className="text-emerald-500 hover:text-emerald-700"><Check size={12} /></button>
                    <button onClick={() => { setEditingSecPhone(false); setEditSecPhone(c.secondary_phone || ''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-apptivia-carbon-500">{c.secondary_phone}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleCopy(c.secondary_phone, 'secPhone')} className="text-apptivia-carbon-400 hover:text-apptivia-ink">{copied === 'secPhone' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button>
                      <button onClick={() => setEditingSecPhone(true)} className="text-apptivia-carbon-300 hover:text-apptivia-ink transition-opacity"><Pencil size={10} /></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => setEditingSecPhone(true)} className="text-[10px] text-apptivia-coral hover:underline pl-5">+ Add secondary phone</button>
            )}

            {c.seniority_level && <div className="flex items-center gap-2 text-xs text-apptivia-carbon-700"><Briefcase size={12} className="text-apptivia-carbon-400" />{c.seniority_level}{c.department ? ` · ${c.department}` : ''}</div>}
            {accounts.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-apptivia-carbon-700">
                <Building2 size={12} className="text-apptivia-carbon-400" />
                <button onClick={() => onNavigateTab?.('accounts', { accountId: accounts[0].account_id })}
                  className="text-apptivia-coral hover:underline">{accounts[0].engage_accounts?.account_name || 'Account'}</button>
                {accounts[0].committee_role && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] capitalize">{accounts[0].committee_role.replace('_', ' ')}</span>}
              </div>
            )}
            {c.source && <div className="flex items-center gap-2 text-xs text-apptivia-carbon-700"><Globe size={12} className="text-apptivia-carbon-400" /><span className="text-[10px] text-apptivia-carbon-500">Source:</span><span className="px-2 py-0.5 bg-apptivia-carbon-50 rounded text-[10px] capitalize">{c.source}</span></div>}
            {c.created_at && <div className="flex items-center gap-2 text-xs text-apptivia-carbon-500"><Clock size={12} className="text-apptivia-carbon-400" />Added {formatDate(c.created_at)}</div>}

            {/* Scores */}
            <div className="flex gap-2 mt-1">
              {c.fit_score != null && <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${fitColor(c.fit_score)}`}>Fit: {c.fit_score}</span>}
              {c.intent_score != null && c.intent_score > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">Intent: {c.intent_score}</span>}
              {c.influence_score != null && c.influence_score > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-700">Influence: {c.influence_score}</span>}
            </div>

            {/* Owner */}
            <div className="flex items-center gap-2 text-xs text-apptivia-carbon-700">
              <Users size={12} className="text-apptivia-carbon-400" />
              {editingOwner ? (
                <div className="flex items-center gap-1 flex-1">
                  <select onChange={e => handleAssignOwner(e.target.value)} defaultValue={c.assigned_to || ''}
                    className="flex-1 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-apptivia-coral bg-white">
                    <option value="">Unassigned</option>
                    {orgMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim()}</option>
                    ))}
                  </select>
                  <button onClick={() => setEditingOwner(false)} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <span>{c.owner ? (c.owner.full_name || `${c.owner.first_name || ''} ${c.owner.last_name || ''}`.trim()) : <span className="italic text-apptivia-carbon-400">Unassigned</span>}</span>
                  {!c.owner && <button onClick={handleClaimOwner} className="text-[10px] text-apptivia-coral hover:underline">Claim</button>}
                  <button onClick={() => setEditingOwner(true)} className="text-apptivia-carbon-300 hover:text-apptivia-ink"><Pencil size={10} /></button>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide">Notes</h4>
              {notesSaving && <span className="text-[9px] text-apptivia-carbon-400">Saving...</span>}
              {!notesSaving && notesSavedAt && <span className="text-[9px] text-apptivia-carbon-400">Saved {notesSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this contact..."
              rows={3} className="w-full border border-apptivia-carbon-200 rounded-lg px-2.5 py-2 text-xs text-apptivia-carbon-700 focus:outline-none focus:border-apptivia-coral resize-none bg-apptivia-paper/30" />
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide mb-1">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {(c.tags || []).map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-apptivia-carbon-50 rounded-full text-[10px] text-apptivia-carbon-700">
                  {t}
                  <button onClick={() => handleRemoveTag(t)} className="text-apptivia-carbon-400 hover:text-red-500"><X size={8} /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  className="w-20 border border-apptivia-carbon-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-apptivia-coral" />
              </div>
            </div>
          </div>

          {/* Engagement History — unified timeline */}
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide mb-2">Engagement History</h4>
            {timeline.length === 0 ? (
              <p className="text-xs text-apptivia-carbon-400 italic">No engagement yet</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((item, idx) => {
                  if (item.type === 'brief') return (
                    <div key={`brief-${idx}`} className="flex items-start gap-2 text-xs">
                      <Eye size={12} className="text-apptivia-carbon-400 mt-0.5 flex-shrink-0" />
                      <div><span className="text-apptivia-carbon-700">AI Brief generated</span><span className="text-apptivia-carbon-400 ml-2">{relativeTime(item.date)}</span></div>
                    </div>
                  );
                  if (item.type === 'enrollment') {
                    const e = item.data;
                    return (
                      <div key={e.id} className="flex items-start gap-2 text-xs">
                        <GitBranch size={12} className="text-apptivia-carbon-400 mt-0.5 flex-shrink-0" />
                        <div><span className="text-apptivia-carbon-700">Enrolled in {e.engage_sequences?.name || 'sequence'}</span> <span className={`px-1.5 py-0.5 rounded text-[9px] ${e.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{e.status}</span><span className="text-apptivia-carbon-400 ml-2">{relativeTime(e.enrolled_at)}</span></div>
                      </div>
                    );
                  }
                  if (item.type === 'activity') {
                    const a = item.data;
                    return (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        {a.activity_type === 'call' ? <Phone size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <Mail size={12} className="text-apptivia-coral mt-0.5 flex-shrink-0" />}
                        <div>
                          <span className="text-apptivia-carbon-700">{a.activity_type === 'call' ? `Call${a.duration_seconds ? ` (${Math.ceil(a.duration_seconds / 60)}m)` : ''}` : (a.subject || 'Email sent')}</span>
                          <span className="text-apptivia-carbon-400 ml-2">{relativeTime(a.activity_date)}</span>
                          {a.source && <span className="ml-1 text-[9px] text-apptivia-carbon-400">via {a.source}</span>}
                        </div>
                      </div>
                    );
                  }
                  if (item.type === 'meeting') {
                    const m = item.data;
                    return (
                      <button key={m.id} onClick={() => onNavigateTab?.('calendar', { meetingId: m.id })} className="flex items-start gap-2 text-xs w-full text-left hover:bg-apptivia-paper/50 rounded px-1 py-0.5 -mx-1 transition-colors group/item">
                        <CalendarDays size={12} className="text-sky-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-apptivia-carbon-700 group-hover/item:text-apptivia-coral">{m.title || 'Meeting'}</span>
                          {m.meeting_outcome && <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${m.meeting_outcome === 'completed' ? 'bg-emerald-50 text-emerald-700' : m.meeting_outcome === 'no_show' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{m.meeting_outcome.replace('_', ' ')}</span>}
                          <span className="text-apptivia-carbon-400 ml-2">{relativeTime(m.start_time)}</span>
                        </div>
                      </button>
                    );
                  }
                  if (item.type === 'task') {
                    const t = item.data;
                    return (
                      <button key={t.id} onClick={() => window.dispatchEvent(new CustomEvent('open-tasks'))} className="flex items-start gap-2 text-xs w-full text-left hover:bg-apptivia-paper/50 rounded px-1 py-0.5 -mx-1 transition-colors group/item">
                        <ClipboardList size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-apptivia-carbon-700 group-hover/item:text-apptivia-coral">{t.title}</span>
                          <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : t.status === 'in_progress' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{t.status?.replace('_', ' ') || 'open'}</span>
                          {t.due_date && <span className="text-apptivia-carbon-400 ml-1 text-[9px]">due {formatDate(t.due_date)}</span>}
                          <span className="text-apptivia-carbon-400 ml-2">{relativeTime(t.created_at)}</span>
                        </div>
                      </button>
                    );
                  }
                  return null;
                })}
              </div>
            )}
          </div>

          {/* Related Accounts */}
          {accounts.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide mb-1">Accounts</h4>
              {accounts.map(a => (
                <button key={a.id} onClick={() => onNavigateTab?.('accounts', { accountId: a.account_id })}
                  className="flex items-center gap-2 text-xs text-apptivia-carbon-700 py-1 w-full text-left hover:bg-apptivia-paper/50 rounded px-1 -mx-1 transition-colors group/acct">
                  <Building2 size={12} className="text-apptivia-carbon-400" />
                  <span className="group-hover/acct:text-apptivia-coral">{a.engage_accounts?.account_name || '—'}</span>
                  {a.committee_role && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] capitalize">{a.committee_role.replace('_', ' ')}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Related Deals */}
          {deals.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wide mb-1">Deals</h4>
              {deals.map(d => (
                <button key={d.id} onClick={() => onNavigateTab?.('pipeline', { dealId: d.deal_id })}
                  className="flex items-center gap-2 text-xs text-apptivia-carbon-700 py-1 w-full text-left hover:bg-apptivia-paper/50 rounded px-1 -mx-1 transition-colors group/deal">
                  <Briefcase size={12} className="text-apptivia-carbon-400" />
                  <span className="group-hover/deal:text-apptivia-coral">{d.engage_pipeline_deals?.deal_name || '—'}</span>
                  {d.engage_pipeline_deals?.stage && <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded text-[9px] capitalize">{d.engage_pipeline_deals.stage}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          isOpen={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          contact={c}
          accountId={accounts[0]?.account_id}
          onTaskCreated={() => {
            setShowCreateTask(false);
            // Reload tasks
            supabase.from('engage_tasks')
              .select('id, title, status, priority, due_date, created_at, completed_at')
              .eq('prospect_id', c.id)
              .order('created_at', { ascending: false })
              .limit(10)
              .then(({ data }) => setTasks(data || []));
          }}
        />
      )}
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function EngageContacts({ organizationId, userId, onCallContact, onEmailContact, onViewBrief, onNavigateDiscover, onNavigateTab }) {
  // Data
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeView, setActiveView] = useState('all');
  const [filters, setFilters] = useState({ status: [], fitScoreMin: '', fitScoreMax: '', source: [], seniority: [], company: '', owner: '', tags: [] });
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Detail panel
  const [detailContact, setDetailContact] = useState(null);

  // Column customization
  const [visibleColumns, setVisibleColumns] = useState(loadColumnPrefs);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Sequence modal
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceContact, setSequenceContact] = useState(null);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Persist column prefs
  useEffect(() => {
    localStorage.setItem('apptivia_contact_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Reset page on filter/search/view change
  useEffect(() => { setPage(1); }, [debouncedSearch, activeView, filters]);

  const hasActiveFilters = useMemo(() => {
    return filters.status.length > 0 || filters.source.length > 0 || filters.seniority.length > 0 || filters.company || filters.owner || filters.fitScoreMin || filters.fitScoreMax;
  }, [filters]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortField', sortField);
      params.set('sortDir', sortDir);
      params.set('view', activeView);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status.length) params.set('status', filters.status.join(','));
      if (filters.fitScoreMin) params.set('fitScoreMin', filters.fitScoreMin);
      if (filters.fitScoreMax) params.set('fitScoreMax', filters.fitScoreMax);
      if (filters.source.length) params.set('source', filters.source.join(','));
      if (filters.seniority.length) params.set('seniority', filters.seniority.join(','));
      if (filters.company) params.set('company', filters.company);
      if (filters.owner) params.set('owner', filters.owner);

      const data = await backendFetch(`/api/engage/contacts?${params.toString()}`, undefined, 'GET');
      setContacts(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, page, pageSize, sortField, sortDir, activeView, debouncedSearch, filters]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(contacts.map(c => c.id)));
  };

  // Bulk actions
  const handleBulkAction = async (action, value) => {
    const ids = Array.from(selectedIds);
    if (action === 'sequence') {
      setSequenceContact(contacts.find(c => selectedIds.has(c.id)) || null);
      setShowSequenceModal(true);
      return;
    }
    if (action === 'status') {
      await backendFetch('/api/engage/contacts/bulk', { contactIds: ids, updates: { status: value } }, 'PATCH');
      fetchContacts();
      return;
    }
    if (action === 'delete') {
      setConfirmDelete(true);
      return;
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      await backendFetch('/api/engage/contacts/bulk', { contactIds: ids }, 'DELETE');
    } catch {}
    setConfirmDelete(false);
    fetchContacts();
  };

  // Export
  const handleExport = async () => {
    try {
      const body = { view: activeView };
      if (debouncedSearch) body.search = debouncedSearch;
      if (filters.status.length) body.status = filters.status.join(',');
      if (filters.fitScoreMin) body.fitScoreMin = filters.fitScoreMin;
      if (filters.fitScoreMax) body.fitScoreMax = filters.fitScoreMax;
      if (filters.source.length) body.source = filters.source.join(',');
      if (filters.seniority.length) body.seniority = filters.seniority.join(',');
      if (filters.company) body.company = filters.company;
      if (filters.owner) body.owner = filters.owner;

      const csv = await backendFetch('/api/engage/contacts/export', body);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Column toggle
  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Pagination helpers
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 7;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={10} className="text-apptivia-carbon-300" />;
    return sortDir === 'asc' ? <ChevronUp size={10} className="text-apptivia-coral" /> : <ChevronDown size={10} className="text-apptivia-coral" />;
  };

  const clearFilters = () => setFilters({ status: [], fitScoreMin: '', fitScoreMax: '', source: [], seniority: [], company: '', owner: '', tags: [] });

  return (
    <div className="space-y-3">
      {/* View Tabs */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: `All Contacts${total && activeView === 'all' ? ` (${total.toLocaleString()})` : ''}` },
          { id: 'mine', label: 'My Contacts' },
          { id: 'recent', label: 'Recently Added' },
          { id: 'high_fit', label: 'High Fit (70+)' },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeView === v.id ? 'bg-apptivia-coral text-white shadow-sm' : 'bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-paper'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
          <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-apptivia-carbon-200 rounded-lg text-xs focus:outline-none focus:border-apptivia-coral bg-white" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={12} /></button>}
        </div>

        {/* Quick filters */}
        <div className="flex gap-1">
          {[
            { label: 'High Fit', action: () => setFilters(f => ({ ...f, fitScoreMin: f.fitScoreMin === '70' ? '' : '70' })), active: filters.fitScoreMin === '70' },
            { label: 'Unassigned', action: () => setFilters(f => ({ ...f, owner: f.owner === 'unassigned' ? '' : 'unassigned' })), active: filters.owner === 'unassigned' },
          ].map(qf => (
            <button key={qf.label} onClick={qf.action}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${qf.active ? 'bg-apptivia-coral text-white' : 'bg-white border border-apptivia-carbon-200 text-apptivia-carbon-600 hover:bg-apptivia-paper'}`}>
              {qf.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showFilters ? 'bg-apptivia-coral text-white border-apptivia-coral' : 'bg-white text-apptivia-carbon-600 border-apptivia-carbon-200 hover:bg-apptivia-paper'}`}>
          <Filter size={12} /> Filters
          {hasActiveFilters && !showFilters && <span className="w-1.5 h-1.5 rounded-full bg-apptivia-coral" />}
        </button>

        {/* Columns */}
        <div className="relative">
          <button onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-paper transition-colors">
            <Columns3 size={12} /> Columns
          </button>
          {showColumnPicker && <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} onClose={() => setShowColumnPicker(false)} />}
        </div>

        {/* Export */}
        <button onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-paper transition-colors">
          <Download size={12} /> Export
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && <FilterPanel filters={filters} onChange={setFilters} onClear={clearFilters} />}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} onAction={handleBulkAction} onClear={() => setSelectedIds(new Set())} />}

      {/* Table */}
      <div className="bg-white border border-apptivia-carbon-100 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-apptivia-paper border-b border-apptivia-carbon-100">
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={contacts.length > 0 && selectedIds.size === contacts.length} onChange={toggleSelectAll}
                    className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral" />
                </th>
                {visibleColumns.name && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('full_name')}><span className="flex items-center gap-1">Name <SortIcon field="full_name" /></span></th>}
                {visibleColumns.title && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('title')}><span className="flex items-center gap-1">Title <SortIcon field="title" /></span></th>}
                {visibleColumns.company && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('company_name')}><span className="flex items-center gap-1">Company <SortIcon field="company_name" /></span></th>}
                {visibleColumns.email && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('email')}><span className="flex items-center gap-1">Email <SortIcon field="email" /></span></th>}
                {visibleColumns.status && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('status')}><span className="flex items-center gap-1">Status <SortIcon field="status" /></span></th>}
                {visibleColumns.fitScore && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('fit_score')}><span className="flex items-center gap-1">Fit <SortIcon field="fit_score" /></span></th>}
                {visibleColumns.influence && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('influence_score')}><span className="flex items-center gap-1">Influence <SortIcon field="influence_score" /></span></th>}
                {visibleColumns.department && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Department</th>}
                {visibleColumns.source && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Source</th>}
                {visibleColumns.tags && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Tags</th>}
                {visibleColumns.owner && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Owner</th>}
                {visibleColumns.tenure && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Tenure</th>}
                {visibleColumns.lastActivity && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Last Activity</th>}
                {visibleColumns.created && <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500 cursor-pointer select-none" onClick={() => handleSort('created_at')}><span className="flex items-center gap-1">Created <SortIcon field="created_at" /></span></th>}
                <th className="text-left px-3 py-2.5 font-medium text-apptivia-carbon-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apptivia-carbon-100/50">
              {loading ? (
                <tr><td colSpan={20} className="text-center py-12 text-apptivia-carbon-400">Loading contacts...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={20} className="text-center py-12 text-apptivia-carbon-400">{debouncedSearch || hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}</td></tr>
              ) : contacts.map(c => (
                <tr key={c.id}
                  className={`hover:bg-apptivia-paper/50 transition-colors cursor-pointer ${selectedIds.has(c.id) ? 'bg-sky-50/30' : ''}`}
                  onClick={(e) => { if (e.target.type !== 'checkbox' && !e.target.closest('button') && !e.target.closest('a')) setDetailContact(c); }}>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)}
                      className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral" />
                  </td>
                  {visibleColumns.name && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-apptivia-coral/10 text-apptivia-coral flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initials(c)}</div>
                        <div>
                          <div className="font-medium text-apptivia-ink">{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'}</div>
                          {c.seniority_level && <span className={`px-1.5 py-0.5 rounded text-[9px] ${SENIORITY_BADGES[c.seniority_level] || 'bg-gray-100 text-gray-600'}`}>{c.seniority_level}</span>}
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.title && <td className="px-3 py-2.5 text-apptivia-carbon-700 max-w-[150px] truncate">{c.title || '—'}</td>}
                  {visibleColumns.company && <td className="px-3 py-2.5 text-apptivia-carbon-700 max-w-[150px] truncate">{c.company_name || '—'}</td>}
                  {visibleColumns.email && <td className="px-3 py-2.5 text-apptivia-carbon-600 max-w-[180px] truncate">{c.email || '—'}</td>}
                  {visibleColumns.status && (
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] capitalize ${STATUS_BADGES[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status || 'new'}</span>
                    </td>
                  )}
                  {visibleColumns.fitScore && (
                    <td className="px-3 py-2.5">
                      {c.fit_score != null ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${fitColor(c.fit_score)}`}>{c.fit_score}</span> : <span className="text-apptivia-carbon-400">—</span>}
                    </td>
                  )}
                  {visibleColumns.influence && (
                    <td className="px-3 py-2.5">
                      {c.influence_score ? (
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.influence_score >= 70 ? 'bg-emerald-100 text-emerald-700' :
                          c.influence_score >= 40 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>{c.influence_score}</span>
                      ) : <span className="text-apptivia-carbon-400">—</span>}
                    </td>
                  )}
                  {visibleColumns.department && <td className="px-3 py-2.5 text-apptivia-carbon-600 text-[10px]">{c.department || '—'}</td>}
                  {visibleColumns.source && <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 bg-apptivia-carbon-50 rounded text-[9px] capitalize">{c.source || '—'}</span></td>}
                  {visibleColumns.tags && <td className="px-3 py-2.5"><div className="flex gap-1 flex-wrap max-w-[120px]">{(c.tags || []).slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 bg-apptivia-carbon-50 rounded text-[9px]">{t}</span>)}{(c.tags || []).length > 2 && <span className="text-[9px] text-apptivia-carbon-400">+{c.tags.length - 2}</span>}</div></td>}
                  {visibleColumns.owner && <td className="px-3 py-2.5 text-apptivia-carbon-600 text-[10px]">{c.owner?.full_name || '—'}</td>}
                  {visibleColumns.tenure && <td className="px-3 py-2.5 text-apptivia-carbon-600 text-[10px]">{c.tenure_months ? `${Math.floor(c.tenure_months / 12)}y ${c.tenure_months % 12}m` : '—'}</td>}
                  {visibleColumns.lastActivity && <td className="px-3 py-2.5 text-apptivia-carbon-500 text-[10px]">{relativeTime(getLastActivity(c))}</td>}
                  {visibleColumns.created && <td className="px-3 py-2.5 text-apptivia-carbon-500 text-[10px]">{formatDate(c.created_at)}</td>}
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {c.email && <button onClick={() => onEmailContact?.(c)} title="Email" className="p-1 rounded hover:bg-apptivia-paper text-apptivia-coral"><Mail size={12} /></button>}
                      <button onClick={() => onViewBrief?.(c)} title="View Brief" className="p-1 rounded hover:bg-apptivia-paper text-apptivia-ink"><Eye size={12} /></button>
                      <button onClick={() => c.phone && onCallContact?.({ name: c.full_name, phone: c.phone, company_name: c.company_name })}
                        title={c.phone || 'No phone number'} disabled={!c.phone}
                        className={`p-1 rounded hover:bg-apptivia-paper ${c.phone ? 'text-emerald-600' : 'text-apptivia-carbon-300 cursor-not-allowed'}`}><Phone size={12} /></button>
                      {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="p-1 rounded hover:bg-apptivia-paper text-apptivia-ink"><ExternalLink size={12} /></a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-apptivia-carbon-500">
          <span>Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} contacts</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2 py-1 rounded border border-apptivia-carbon-200 hover:bg-apptivia-paper disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={12} /></button>
            {pageNumbers.map((p, i) => p === '...'
              ? <span key={`dots-${i}`} className="px-1">...</span>
              : <button key={p} onClick={() => setPage(p)}
                  className={`px-2.5 py-1 rounded border transition-colors ${page === p ? 'bg-apptivia-coral text-white border-apptivia-coral' : 'border-apptivia-carbon-200 hover:bg-apptivia-paper'}`}>{p}</button>
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2 py-1 rounded border border-apptivia-carbon-200 hover:bg-apptivia-paper disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight size={12} /></button>
            <span className="ml-2 text-apptivia-carbon-400">Per page:</span>
            {PAGE_SIZES.map(s => (
              <button key={s} onClick={() => setPageSize(s)}
                className={`px-2 py-1 rounded transition-colors ${pageSize === s ? 'bg-apptivia-carbon-100 font-medium' : 'hover:bg-apptivia-paper'}`}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {detailContact && (
        <ContactDetailPanel
          contact={detailContact}
          onClose={() => setDetailContact(null)}
          onCallContact={onCallContact}
          onEmailContact={onEmailContact}
          onViewBrief={onViewBrief}
          onNavigateDiscover={onNavigateDiscover}
          onRefresh={() => { fetchContacts(); setDetailContact(prev => contacts.find(c => c.id === prev?.id) || null); }}
          onContactUpdate={(id, updates) => {
            setContacts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
            setDetailContact(prev => prev?.id === id ? { ...prev, ...updates } : prev);
          }}
          userId={userId}
          organizationId={organizationId}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setConfirmDelete(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-sm font-bold text-apptivia-ink mb-2">Delete {selectedIds.size} Contact{selectedIds.size > 1 ? 's' : ''}?</h3>
            <p className="text-xs text-apptivia-carbon-500 mb-4">This action cannot be undone. These contacts will be permanently removed.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs rounded-lg border border-apptivia-carbon-200 hover:bg-apptivia-paper">Cancel</button>
              <button onClick={confirmBulkDelete} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </>
      )}

      {/* Add to Sequence Modal */}
      {showSequenceModal && (
        <AddToSequenceModal
          isOpen={showSequenceModal}
          onClose={() => setShowSequenceModal(false)}
          organizationId={organizationId}
          contact={sequenceContact}
        />
      )}
    </div>
  );
}
