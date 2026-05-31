import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Play, Pause, Trash2, Users, Mail, Phone, CheckSquare, Clock,
  ChevronRight, ArrowRight, Edit2, Save, X, Linkedin, Sparkles,
  MoreHorizontal, Copy, Bold, Italic, Underline, Link2, List, ListOrdered,
  Braces, ChevronDown, Settings, UserPlus, Search, CheckCircle2, AlertCircle,
  ArrowUpDown, Eye, MousePointerClick, MessageSquare, ChevronUp, LayoutTemplate,
} from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────
const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail, color: 'text-apptivia-coral' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  { value: 'call', label: 'Call', icon: Phone, color: 'text-green-500' },
  { value: 'task', label: 'Task', icon: CheckSquare, color: 'text-apptivia-ink' },
];

const STATUS_BADGES = {
  draft:     { label: 'Draft',     color: 'bg-apptivia-carbon-100 text-apptivia-carbon-600' },
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',    color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-apptivia-coral-tone-50 text-apptivia-coral' },
  archived:  { label: 'Archived',  color: 'bg-apptivia-carbon-100 text-apptivia-carbon-400' },
};

const ENROLLMENT_BADGES = {
  active:       'bg-green-100 text-green-700',
  paused:       'bg-yellow-100 text-yellow-700',
  completed:    'bg-blue-100 text-blue-700',
  replied:      'bg-emerald-100 text-emerald-700',
  bounced:      'bg-red-100 text-red-700',
  removed:      'bg-apptivia-carbon-100 text-apptivia-carbon-500',
  unsubscribed: 'bg-apptivia-carbon-100 text-apptivia-carbon-500',
};

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'formal', label: 'Formal' },
];

const SEND_IF_OPTIONS = [
  { value: 'no_reply', label: 'No reply to previous' },
  { value: 'no_open', label: 'Did not open previous' },
  { value: 'always', label: 'Always send' },
];

const PERSONALIZATION_TOKENS = [
  { key: '{{prospect.first_name}}', label: 'First Name' },
  { key: '{{prospect.last_name}}', label: 'Last Name' },
  { key: '{{prospect.company_name}}', label: 'Company' },
  { key: '{{prospect.title}}', label: 'Title' },
  { key: '{{sender.first_name}}', label: 'Sender First Name' },
  { key: '{{sender.email}}', label: 'Sender Email' },
  { key: '{{sequence.name}}', label: 'Sequence Name' },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
];

const SEQUENCE_TEMPLATES = [
  {
    name: 'Cold Outreach',
    description: '5-step multi-channel cold outreach cadence',
    icon: '🎯',
    steps: [
      { channel: 'email', delay_days: 0, subject: 'Quick question about {{prospect.company_name}}', body: 'Hi {{prospect.first_name}},\n\nI came across {{prospect.company_name}} and noticed you might be dealing with some of the same challenges we help teams solve.\n\nWould it make sense to have a quick 15-minute conversation to see if there\'s a fit?\n\nBest,\n{{sender.first_name}}', tone: 'professional', send_if: 'always', skip_if_replied: true },
      { channel: 'call', delay_days: 2, subject: '', body: 'Follow up on initial email sent 2 days ago. Reference {{prospect.company_name}} and the challenge mentioned. Ask for 15 minutes.', tone: 'friendly', send_if: 'no_reply', skip_if_replied: true },
      { channel: 'email', delay_days: 3, subject: 'Following up — {{prospect.first_name}}', body: 'Hi {{prospect.first_name}},\n\nJust wanted to bump this to the top of your inbox. I know things get busy.\n\nWould next week work for a brief call?\n\n{{sender.first_name}}', tone: 'casual', send_if: 'no_reply', skip_if_replied: true },
      { channel: 'linkedin', delay_days: 2, subject: '', body: 'Hi {{prospect.first_name}} — I sent you a note about how we help teams like {{prospect.company_name}}. Would love to connect here as well.', tone: 'casual', send_if: 'no_reply', skip_if_replied: true },
      { channel: 'email', delay_days: 5, subject: 'Last check-in, {{prospect.first_name}}', body: 'Hi {{prospect.first_name}},\n\nI don\'t want to be a pest — just wanted to send one final note in case the timing is better now.\n\nIf this isn\'t relevant, no worries at all. But if you\'d like to chat, I\'m here.\n\nBest,\n{{sender.first_name}}', tone: 'professional', send_if: 'no_reply', skip_if_replied: true },
    ],
  },
  {
    name: 'Warm Follow-up',
    description: '3-step post-meeting follow-up sequence',
    icon: '🤝',
    steps: [
      { channel: 'email', delay_days: 0, subject: 'Great connecting, {{prospect.first_name}}', body: 'Hi {{prospect.first_name}},\n\nGreat speaking with you today. As discussed, I\'m sharing the resources we mentioned.\n\nLooking forward to our next conversation.\n\nBest,\n{{sender.first_name}}', tone: 'friendly', send_if: 'always', skip_if_replied: true },
      { channel: 'email', delay_days: 3, subject: 'Resources for {{prospect.company_name}}', body: 'Hi {{prospect.first_name}},\n\nWanted to follow up on our conversation and share a few additional resources that might be helpful for {{prospect.company_name}}.\n\nLet me know if you have any questions.\n\n{{sender.first_name}}', tone: 'professional', send_if: 'no_reply', skip_if_replied: true },
      { channel: 'call', delay_days: 5, subject: '', body: 'Check-in call with {{prospect.first_name}} at {{prospect.company_name}}. Reference previous meeting and resources sent. Aim to schedule next steps.', tone: 'friendly', send_if: 'no_reply', skip_if_replied: true },
    ],
  },
  {
    name: 'Re-engagement',
    description: '3-step sequence to re-engage cold prospects',
    icon: '🔄',
    steps: [
      { channel: 'email', delay_days: 0, subject: 'Still relevant, {{prospect.first_name}}?', body: 'Hi {{prospect.first_name}},\n\nIt\'s been a while since we last connected. I wanted to check in and see if the challenges we discussed are still top of mind for {{prospect.company_name}}.\n\nHappy to reconnect if the timing is better now.\n\n{{sender.first_name}}', tone: 'casual', send_if: 'always', skip_if_replied: true },
      { channel: 'linkedin', delay_days: 4, subject: '', body: 'Hi {{prospect.first_name}} — it\'s been a while. Wanted to reconnect and see what\'s new at {{prospect.company_name}}.', tone: 'casual', send_if: 'no_reply', skip_if_replied: true },
      { channel: 'email', delay_days: 7, subject: 'Final note — {{prospect.first_name}}', body: 'Hi {{prospect.first_name}},\n\nJust a final note — if the timing isn\'t right, I completely understand. Feel free to reach out whenever it makes sense.\n\nWishing you and the {{prospect.company_name}} team the best.\n\n{{sender.first_name}}', tone: 'professional', send_if: 'no_reply', skip_if_replied: true },
    ],
  },
];

// ── Personalization Dropdown ───────────────────────────────────────────────
function PersonalizationDropdown({ onInsert }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-apptivia-carbon-50 text-apptivia-carbon-400 hover:text-apptivia-ink" title="Insert personalization token">
        <Braces size={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-30 py-1 min-w-[220px]">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-apptivia-carbon-400 uppercase">Personalization Tokens</div>
          {PERSONALIZATION_TOKENS.map(t => (
            <button key={t.key} onClick={() => { onInsert(t.key); setOpen(false); }} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-apptivia-paper transition-colors">
              <span className="font-mono text-apptivia-coral text-[10px]">{t.key}</span>
              <span className="text-apptivia-carbon-400 ml-2">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step Editor ────────────────────────────────────────────────────────────
function StepEditor({ step, index, onChange, onRemove, onGenerateAI, isEditing }) {
  const bodyRef = useRef(null);
  const [bodyHtml, setBodyHtml] = useState(step.body || '');

  // Sync external changes (AI generation, template load)
  useEffect(() => {
    if (bodyRef.current && step.body !== undefined) {
      const currentContent = bodyRef.current.innerHTML;
      if (currentContent !== step.body) {
        setBodyHtml(step.body || '');
      }
    }
  }, [step.body]);

  const format = (command, value) => {
    document.execCommand(command, false, value || null);
    bodyRef.current?.focus();
  };

  const insertToken = (token) => {
    bodyRef.current?.focus();
    document.execCommand('insertText', false, token);
  };

  const handleBodyInput = () => {
    if (bodyRef.current) {
      onChange({ ...step, body: bodyRef.current.innerHTML });
    }
  };

  const placeholder = step.channel === 'email' ? 'Email body...'
    : step.channel === 'linkedin' ? 'LinkedIn message...'
    : step.channel === 'call' ? 'Call script / talking points...'
    : 'Task description...';

  return (
    <div className="relative pl-8 pb-2">
      {/* Connector line + dot */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-apptivia-carbon-200" />
      <div className="absolute left-1.5 top-2 w-3 h-3 rounded-full bg-apptivia-coral border-2 border-white shadow-sm z-10" />

      <div className="bg-white border border-apptivia-carbon-100 rounded-lg p-3 shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-apptivia-carbon-400 uppercase">Step {index + 1}</span>
            {isEditing ? (
              <select value={step.channel} onChange={(e) => onChange({ ...step, channel: e.target.value })}
                className="text-xs border border-apptivia-carbon-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-apptivia-coral-tone-300">
                {CHANNEL_OPTIONS.map(ch => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
              </select>
            ) : (
              <span className="text-xs text-apptivia-carbon-600 font-medium">{CHANNEL_OPTIONS.find(c => c.value === step.channel)?.label || step.channel}</span>
            )}
            {isEditing ? (
              <div className="flex items-center gap-1 text-xs text-apptivia-carbon-400">
                <Clock size={11} />
                <input type="number" min="0" max="90" value={step.delay_days ?? 1}
                  onChange={(e) => onChange({ ...step, delay_days: parseInt(e.target.value) || 0 })}
                  className="w-10 text-center border border-apptivia-carbon-200 rounded px-1 py-0.5 text-xs" />
                <span>day{(step.delay_days ?? 1) !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <span className="text-[10px] text-apptivia-carbon-400"><Clock size={10} className="inline mr-0.5" />{step.delay_days ?? 1}d delay</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing && onGenerateAI && (
              <button onClick={() => onGenerateAI(index)} title="Generate with AI" className="p-1 rounded hover:bg-apptivia-coral-tone-50 text-apptivia-carbon-400 hover:text-apptivia-coral transition-colors">
                <Sparkles size={13} />
              </button>
            )}
            {isEditing && (
              <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-apptivia-carbon-300 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Subject (email only) */}
        {step.channel === 'email' && (
          isEditing ? (
            <input type="text" placeholder="Email subject..." value={step.subject || ''}
              onChange={(e) => onChange({ ...step, subject: e.target.value })}
              className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5 mb-2 focus:ring-1 focus:ring-apptivia-coral-tone-300" />
          ) : (
            step.subject && <div className="text-xs font-medium text-apptivia-ink mb-1.5">{step.subject}</div>
          )
        )}

        {/* Formatting toolbar (edit mode only) */}
        {isEditing && (
          <div className="flex items-center gap-0.5 border border-apptivia-carbon-200 border-b-0 rounded-t-lg bg-apptivia-paper px-2 py-1">
            <button onClick={() => format('bold')} title="Bold" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><Bold size={12} /></button>
            <button onClick={() => format('italic')} title="Italic" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><Italic size={12} /></button>
            <button onClick={() => format('underline')} title="Underline" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><Underline size={12} /></button>
            <div className="w-px h-3 bg-apptivia-carbon-200 mx-1" />
            <button onClick={() => format('insertUnorderedList')} title="Bullet list" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><List size={12} /></button>
            <button onClick={() => format('insertOrderedList')} title="Numbered list" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><ListOrdered size={12} /></button>
            <div className="w-px h-3 bg-apptivia-carbon-200 mx-1" />
            <button onClick={() => { const url = prompt('Enter URL:'); if (url) format('createLink', url); }} title="Insert link" className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-500"><Link2 size={12} /></button>
            <div className="w-px h-3 bg-apptivia-carbon-200 mx-1" />
            <PersonalizationDropdown onInsert={insertToken} />
          </div>
        )}

        {/* Body */}
        {isEditing ? (
          <div ref={bodyRef} contentEditable suppressContentEditableWarning
            className="w-full text-xs min-h-[80px] px-3 py-2 border border-apptivia-carbon-200 rounded-b-lg focus:ring-1 focus:ring-apptivia-coral-tone-300 outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-apptivia-carbon-300"
            data-placeholder={placeholder}
            onInput={handleBodyInput}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <div className="text-xs text-apptivia-carbon-600 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: step.body || '<span class="text-apptivia-carbon-300 italic">No content</span>' }} />
        )}

        {/* Bottom controls (edit mode) */}
        {isEditing && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <select value={step.tone || 'professional'} onChange={(e) => onChange({ ...step, tone: e.target.value })}
              className="text-[11px] border border-apptivia-carbon-200 rounded px-2 py-1 text-apptivia-carbon-600">
              {TONE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={step.send_if || 'no_reply'} onChange={(e) => onChange({ ...step, send_if: e.target.value })}
              className="text-[11px] border border-apptivia-carbon-200 rounded px-2 py-1 text-apptivia-carbon-600">
              {SEND_IF_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-apptivia-carbon-500 cursor-pointer">
              <input type="checkbox" checked={step.skip_if_replied !== false}
                onChange={(e) => onChange({ ...step, skip_if_replied: e.target.checked })}
                className="rounded text-apptivia-coral w-3 h-3" />
              Skip if replied
            </label>
          </div>
        )}

        {/* Step analytics (read mode) */}
        {!isEditing && step.exec_stats?.sent > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-apptivia-carbon-50 text-[10px] text-apptivia-carbon-400">
            <span>{step.exec_stats.sent} sent</span>
            <span className="text-blue-500"><Eye size={9} className="inline mr-0.5" />{step.exec_stats.opened} ({Math.round(step.exec_stats.opened / step.exec_stats.sent * 100)}%)</span>
            {step.exec_stats.clicked > 0 && <span className="text-apptivia-coral"><MousePointerClick size={9} className="inline mr-0.5" />{step.exec_stats.clicked}</span>}
            <span className="text-green-500"><MessageSquare size={9} className="inline mr-0.5" />{step.exec_stats.replied} replied</span>
            {step.exec_stats.bounced > 0 && <span className="text-red-400">{step.exec_stats.bounced} bounced</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Enrollment List ────────────────────────────────────────────────────────
function EnrollmentList({ sequenceId, totalSteps }) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await backendFetch(`/api/engage/sequences/${sequenceId}/enrollments`, undefined, 'GET');
      setEnrollments(data.data || []);
    } catch { setEnrollments([]); }
    finally { setLoading(false); }
  }, [sequenceId]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (enrollmentId, action) => {
    try {
      await backendFetch(`/api/engage/enrollments/${enrollmentId}/${action}`, {}, 'PATCH');
      toast.success(`Enrollment ${action === 'remove' ? 'removed' : action + 'd'}`);
      load();
    } catch { toast.error(`Failed to ${action} enrollment`); }
  };

  if (loading) return <div className="text-center py-8 text-apptivia-carbon-400 text-xs">Loading enrollments...</div>;
  if (enrollments.length === 0) return <div className="text-center py-8 text-apptivia-carbon-400 text-xs">No prospects enrolled yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] text-apptivia-carbon-400 uppercase border-b border-apptivia-carbon-100">
            <th className="pb-2 pr-3">Prospect</th>
            <th className="pb-2 pr-3">Company</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 pr-3">Step</th>
            <th className="pb-2 pr-3">Enrolled</th>
            <th className="pb-2 pr-3">Next Step</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map(e => {
            const badgeClass = ENROLLMENT_BADGES[e.status] || ENROLLMENT_BADGES.active;
            return (
              <tr key={e.id} className="border-b border-apptivia-carbon-50 hover:bg-apptivia-paper/50">
                <td className="py-2 pr-3">
                  <div className="font-medium text-apptivia-ink">{e.prospect_name || '—'}</div>
                  <div className="text-apptivia-carbon-400">{e.prospect_email}</div>
                </td>
                <td className="py-2 pr-3 text-apptivia-carbon-500">{e.prospect_company || '—'}</td>
                <td className="py-2 pr-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{e.status}</span>
                </td>
                <td className="py-2 pr-3 text-apptivia-carbon-500">{e.current_step}/{totalSteps}</td>
                <td className="py-2 pr-3 text-apptivia-carbon-400">{e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}</td>
                <td className="py-2 pr-3 text-apptivia-carbon-400">
                  {e.next_step_at ? new Date(e.next_step_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="py-2">
                  {e.status === 'active' && (
                    <button onClick={() => handleAction(e.id, 'pause')} className="text-[10px] text-yellow-600 hover:text-yellow-800 mr-2">Pause</button>
                  )}
                  {e.status === 'paused' && (
                    <button onClick={() => handleAction(e.id, 'resume')} className="text-[10px] text-green-600 hover:text-green-800 mr-2">Resume</button>
                  )}
                  {['active', 'paused'].includes(e.status) && (
                    <button onClick={() => handleAction(e.id, 'remove')} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Bulk Enroll Panel ──────────────────────────────────────────────────────
function BulkEnrollPanel({ sequenceId, organizationId, onComplete }) {
  const [prospects, setProspects] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      const query = supabase
        .from('engage_prospects')
        .select('id, first_name, last_name, email, company_name')
        .eq('organization_id', organizationId)
        .not('email', 'is', null)
        .limit(50);
      if (search) query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const { data } = await query.order('created_at', { ascending: false });
      setProspects(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, organizationId]);

  const toggleAll = () => {
    if (selected.size === prospects.length) setSelected(new Set());
    else setSelected(new Set(prospects.map(p => p.id)));
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleBulkEnroll = async () => {
    if (selected.size === 0) return;
    setEnrolling(true);
    try {
      const data = await backendFetch(`/api/engage/sequences/${sequenceId}/enroll-bulk`, {
        prospect_ids: Array.from(selected),
      });
      if (data.ok) {
        toast.success(`Enrolled ${data.enrolled} prospect${data.enrolled !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} skipped)` : ''}`);
        onComplete();
      }
    } catch (err) {
      toast.error('Failed to enroll prospects');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="border border-apptivia-carbon-100 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
          <input type="text" placeholder="Search prospects..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-7 pr-3 py-1.5 border border-apptivia-carbon-200 rounded-lg focus:ring-1 focus:ring-apptivia-coral-tone-300" />
        </div>
        <button onClick={handleBulkEnroll} disabled={selected.size === 0 || enrolling}
          className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
          <UserPlus size={12} />{enrolling ? 'Enrolling...' : `Enroll ${selected.size}`}
        </button>
      </div>
      {loading ? (
        <div className="text-center py-4 text-apptivia-carbon-400 text-xs">Searching...</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-4 text-apptivia-carbon-400 text-xs">No prospects found</div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto border border-apptivia-carbon-100 rounded-lg">
          <div className="sticky top-0 bg-apptivia-paper px-3 py-1.5 border-b border-apptivia-carbon-100 flex items-center gap-2">
            <input type="checkbox" checked={selected.size === prospects.length && prospects.length > 0} onChange={toggleAll} className="rounded w-3 h-3 text-apptivia-coral" />
            <span className="text-[10px] text-apptivia-carbon-400">Select all ({prospects.length})</span>
          </div>
          {prospects.map(p => (
            <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-apptivia-paper cursor-pointer text-xs border-b border-apptivia-carbon-50 last:border-0">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="rounded w-3 h-3 text-apptivia-coral" />
              <span className="font-medium text-apptivia-ink">{p.first_name} {p.last_name}</span>
              <span className="text-apptivia-carbon-400">{p.email}</span>
              {p.company_name && <span className="text-apptivia-carbon-300 ml-auto">{p.company_name}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sequence Settings ──────────────────────────────────────────────────────
function SequenceSettings({ sequence, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase mb-1 block">Send Window Start</label>
        <input type="time" value={sequence.send_window_start || '09:00'} onChange={(e) => onChange({ ...sequence, send_window_start: e.target.value })}
          className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5" />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase mb-1 block">Send Window End</label>
        <input type="time" value={sequence.send_window_end || '17:00'} onChange={(e) => onChange({ ...sequence, send_window_end: e.target.value })}
          className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5" />
      </div>
      <div>
        <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase mb-1 block">Timezone</label>
        <select value={sequence.send_timezone || 'America/New_York'} onChange={(e) => onChange({ ...sequence, send_timezone: e.target.value })}
          className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5">
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase mb-1 block">Default Channel</label>
        <select value={sequence.default_channel || 'email'} onChange={(e) => onChange({ ...sequence, default_channel: e.target.value })}
          className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5">
          {CHANNEL_OPTIONS.map(ch => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={sequence.skip_weekends !== false} onChange={(e) => onChange({ ...sequence, skip_weekends: e.target.checked })}
            className="rounded text-apptivia-coral w-3.5 h-3.5" />
          <span className="text-xs text-apptivia-carbon-600">Skip weekends</span>
        </label>
      </div>
    </div>
  );
}

// ── Sequence Detail ────────────────────────────────────────────────────────
function SequenceDetail({ sequenceId, onBack, organizationId }) {
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [activeTab, setActiveTab] = useState('steps'); // steps | enrollments | settings
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await backendFetch(`/api/engage/sequences/${sequenceId}`, undefined, 'GET');
      if (data.data) {
        setSequence(data.data);
        setSteps(data.data.steps || []);
        setEditName(data.data.name);
        setEditDescription(data.data.description || '');
      }
    } catch {
      toast.error('Failed to load sequence');
    } finally {
      setLoading(false);
    }
  }, [sequenceId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await backendFetch('/api/engage/sequences', {
        id: sequenceId,
        name: editName,
        description: editDescription,
        status: sequence.status,
        default_channel: sequence.default_channel,
        send_window_start: sequence.send_window_start,
        send_window_end: sequence.send_window_end,
        send_timezone: sequence.send_timezone,
        skip_weekends: sequence.skip_weekends,
        steps,
      });
      if (data.ok) {
        toast.success('Sequence saved');
        setEditing(false);
        load();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = sequence.status === 'active' ? 'paused' : 'active';
    try {
      await backendFetch('/api/engage/sequences', {
        id: sequenceId, name: sequence.name, status: newStatus, steps,
      });
      toast.success(`Sequence ${newStatus === 'active' ? 'activated' : 'paused'}`);
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleEnroll = async () => {
    if (!enrollEmail) return;
    setEnrolling(true);
    try {
      const data = await backendFetch(`/api/engage/sequences/${sequenceId}/enroll`, { prospect_email: enrollEmail });
      if (data.ok) {
        toast.success(`Enrolled ${enrollEmail}`);
        setEnrollEmail('');
        load();
      } else {
        toast.error(data.error || 'Failed to enroll');
      }
    } catch {
      toast.error('Failed to enroll prospect');
    } finally {
      setEnrolling(false);
    }
  };

  const handleGenerateAI = async (stepIndex) => {
    const step = steps[stepIndex];
    const previousSteps = steps.slice(0, stepIndex).map(s =>
      `${s.channel}: ${s.subject || ''} ${(s.body || '').replace(/<[^>]*>/g, '').substring(0, 100)}`.trim()
    );
    const toastId = toast.loading('Generating with AI...');
    try {
      const result = await backendFetch('/api/engage/sequences/generate-step', {
        sequence_name: editName || sequence?.name,
        sequence_description: editDescription || sequence?.description,
        step_number: stepIndex + 1,
        channel: step.channel,
        tone: step.tone || 'professional',
        previous_steps: previousSteps,
      });
      if (result.ok) {
        updateStep(stepIndex, {
          ...step,
          subject: result.subject || step.subject,
          body: result.body || step.body,
          ai_generated: true,
          tone: result.tone || step.tone,
        });
        toast.dismiss(toastId);
        toast.success('Step generated');
      } else {
        toast.dismiss(toastId);
        toast.error(result.error || 'AI generation failed');
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('AI generation failed');
    }
  };

  const addStep = () => {
    setSteps(prev => [...prev, { channel: 'email', delay_days: 1, subject: '', body: '', tone: 'professional', send_if: 'no_reply', skip_if_replied: true }]);
    setEditing(true);
  };

  const updateStep = (index, updated) => {
    setSteps(prev => prev.map((s, i) => i === index ? updated : s));
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) return <div className="text-center py-12 text-apptivia-carbon-400 text-sm">Loading...</div>;
  if (!sequence) return <div className="text-center py-12 text-apptivia-carbon-400 text-sm">Sequence not found</div>;

  const badge = STATUS_BADGES[sequence.status] || STATUS_BADGES.draft;
  const stats = sequence.enrollment_stats || {};

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-xs">&larr; Back</button>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          {editing ? (
            <div className="space-y-1">
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="text-base font-semibold border border-apptivia-carbon-200 rounded-lg px-2 py-1 w-72" />
              <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description..."
                className="text-xs text-apptivia-carbon-500 border border-apptivia-carbon-200 rounded-lg px-2 py-1 w-72 block" />
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-apptivia-ink">{sequence.name}</h2>
              {sequence.description && <p className="text-xs text-apptivia-carbon-500 mt-0.5">{sequence.description}</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); load(); }} className="text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 px-2 py-1">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
                <Save size={12} />{saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-apptivia-carbon-600 border border-apptivia-carbon-200 rounded-lg hover:bg-apptivia-paper">
                <Edit2 size={12} />Edit
              </button>
              <button onClick={handleStatusToggle} className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                sequence.status === 'active' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}>
                {sequence.status === 'active' ? <><Pause size={12} />Pause</> : <><Play size={12} />Activate</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-apptivia-paper rounded-lg text-[11px] text-apptivia-carbon-500">
        <span><Users size={11} className="inline mr-1" />{stats.total || 0} enrolled</span>
        <span className="text-green-600">{stats.active || 0} active</span>
        <span className="text-apptivia-coral">{stats.completed || 0} completed</span>
        <span className="text-emerald-600">{stats.replied || 0} replied</span>
        <span className="text-yellow-600">{stats.paused || 0} paused</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-apptivia-carbon-100">
        {[
          { key: 'steps', label: 'Steps', icon: ArrowRight },
          { key: 'enrollments', label: 'Enrollments', icon: Users },
          { key: 'settings', label: 'Settings', icon: Settings },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-apptivia-coral text-apptivia-coral'
                : 'border-transparent text-apptivia-carbon-400 hover:text-apptivia-carbon-600'
            }`}>
            <tab.icon size={12} />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'steps' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-apptivia-carbon-600 uppercase tracking-wider">Steps ({steps.length})</h3>
            {editing && (
              <button onClick={addStep} className="flex items-center gap-1 text-xs text-apptivia-coral hover:text-apptivia-coral/80">
                <Plus size={12} />Add Step
              </button>
            )}
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-8 text-apptivia-carbon-400 text-xs border border-dashed border-apptivia-carbon-200 rounded-lg">
              No steps yet. Click Edit then Add Step to build the sequence.
            </div>
          ) : (
            <div className="ml-2">
              {steps.map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 ml-3 py-1">
                      <div className="w-0.5 h-3 bg-apptivia-carbon-200" />
                      <span className="text-[10px] text-apptivia-carbon-400 bg-apptivia-carbon-50 px-2 py-0.5 rounded-full">
                        Wait {step.delay_days ?? 1} day{(step.delay_days ?? 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <StepEditor
                    step={step}
                    index={i}
                    onChange={(updated) => updateStep(i, updated)}
                    onRemove={() => removeStep(i)}
                    onGenerateAI={handleGenerateAI}
                    isEditing={editing}
                  />
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Enroll section */}
          {sequence.status === 'active' && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-apptivia-carbon-600 uppercase tracking-wider">Enroll Prospects</h3>
                <button onClick={() => setShowBulkEnroll(!showBulkEnroll)}
                  className="text-[10px] text-apptivia-coral hover:text-apptivia-coral/80">
                  {showBulkEnroll ? 'Quick enroll' : 'Bulk enroll'}
                </button>
              </div>

              {showBulkEnroll ? (
                <BulkEnrollPanel sequenceId={sequenceId} organizationId={organizationId} onComplete={() => { setShowBulkEnroll(false); load(); }} />
              ) : (
                <div className="flex gap-2">
                  <input type="email" placeholder="prospect@company.com" value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEnroll()}
                    className="flex-1 text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-apptivia-coral-tone-300" />
                  <button onClick={handleEnroll} disabled={enrolling || !enrollEmail}
                    className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
                    <ArrowRight size={12} />{enrolling ? 'Enrolling...' : 'Enroll'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'enrollments' && (
        <EnrollmentList sequenceId={sequenceId} totalSteps={steps.length || sequence.total_steps || 0} />
      )}

      {activeTab === 'settings' && (
        <div className="max-w-md">
          <h3 className="text-xs font-semibold text-apptivia-carbon-600 uppercase tracking-wider mb-3">Schedule & Delivery</h3>
          <SequenceSettings sequence={sequence} onChange={(updated) => {
            setSequence(updated);
            setEditing(true); // Mark as editing so save captures changes
          }} />
        </div>
      )}
    </div>
  );
}

// ── Sequence List ──────────────────────────────────────────────────────────
function SequenceList({ sequences, onSelect, onNew, onDelete, onDuplicate, loading, creatingSlot }) {
  const [sortField, setSortField] = useState('updated_at');
  const [sortDir, setSortDir] = useState('desc');
  const [actionsOpen, setActionsOpen] = useState(null);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!actionsOpen) return;
    const close = (e) => { if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [actionsOpen]);

  const sorted = useMemo(() => {
    return [...sequences].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sequences, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortHeader = ({ field, children }) => (
    <th className="pb-2 pr-3 cursor-pointer select-none group" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        <ArrowUpDown size={9} className={`text-apptivia-carbon-300 group-hover:text-apptivia-carbon-500 ${sortField === field ? 'text-apptivia-coral' : ''}`} />
      </span>
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-apptivia-ink">Sequences</h2>
        <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-apptivia-coral text-white text-xs font-medium rounded-lg hover:bg-apptivia-coral/90 transition-colors">
          <Plus size={14} />New Sequence
        </button>
      </div>

      {creatingSlot}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-apptivia-carbon-400 text-sm">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12">
          <Mail size={32} className="mx-auto text-apptivia-carbon-300 mb-3" />
          <p className="text-sm text-apptivia-carbon-500 mb-1">No sequences yet</p>
          <p className="text-xs text-apptivia-carbon-400">Create multi-step outreach cadences to engage prospects automatically.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-apptivia-carbon-400 uppercase border-b border-apptivia-carbon-100">
                <SortHeader field="name">Name</SortHeader>
                <th className="pb-2 pr-3">Created By</th>
                <SortHeader field="created_at">Created</SortHeader>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Steps</th>
                <SortHeader field="total_enrolled">Enrolled</SortHeader>
                <th className="pb-2 pr-3">Open %</th>
                <th className="pb-2 pr-3">Reply %</th>
                <th className="pb-2 pr-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(seq => {
                const badge = STATUS_BADGES[seq.status] || STATUS_BADGES.draft;
                const creator = seq.creator || seq.profiles;
                return (
                  <tr key={seq.id} className="border-b border-apptivia-carbon-50 hover:bg-apptivia-paper/50 cursor-pointer group" onClick={() => onSelect(seq.id)}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-apptivia-ink group-hover:text-apptivia-coral transition-colors">{seq.name}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-500">
                      {creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-400">
                      {seq.created_at ? new Date(seq.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-500">{seq.total_steps || 0}</td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-500">{seq.total_enrolled || 0}</td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-500">{seq.open_rate != null ? `${seq.open_rate}%` : '—'}</td>
                    <td className="py-2.5 pr-3 text-apptivia-carbon-500">{seq.reply_rate != null ? `${seq.reply_rate}%` : '—'}</td>
                    <td className="py-2.5 pr-1 relative" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setActionsOpen(actionsOpen === seq.id ? null : seq.id)}
                        className="p-1 rounded hover:bg-apptivia-carbon-100 text-apptivia-carbon-400 hover:text-apptivia-carbon-600">
                        <MoreHorizontal size={14} />
                      </button>
                      {actionsOpen === seq.id && (
                        <div ref={actionsRef} className="absolute right-0 top-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                          <button onClick={() => { onSelect(seq.id); setActionsOpen(null); }}
                            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-apptivia-paper"><Edit2 size={11} className="inline mr-1.5" />Edit</button>
                          <button onClick={() => { onDuplicate(seq.id); setActionsOpen(null); }}
                            className="block w-full text-left px-3 py-1.5 text-xs hover:bg-apptivia-paper"><Copy size={11} className="inline mr-1.5" />Duplicate</button>
                          <button onClick={() => { onDelete(seq.id); setActionsOpen(null); }}
                            className="block w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"><Trash2 size={11} className="inline mr-1.5" />Delete</button>
                        </div>
                      )}
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

// ── Template Picker ────────────────────────────────────────────────────────
function TemplatePicker({ onSelect, onBlank, onCancel }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-apptivia-ink">Start a new sequence</h3>
        <button onClick={onCancel} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={onBlank} className="text-left p-3 border-2 border-dashed border-apptivia-carbon-200 rounded-lg hover:border-apptivia-coral-tone-200 hover:bg-apptivia-paper transition-all">
          <div className="text-lg mb-1">📝</div>
          <div className="text-xs font-medium text-apptivia-ink">Blank Sequence</div>
          <div className="text-[10px] text-apptivia-carbon-400">Start from scratch</div>
        </button>
        {SEQUENCE_TEMPLATES.map((tpl, i) => (
          <button key={i} onClick={() => onSelect(tpl)} className="text-left p-3 border border-apptivia-carbon-200 rounded-lg hover:border-apptivia-coral-tone-200 hover:shadow-sm transition-all">
            <div className="text-lg mb-1">{tpl.icon}</div>
            <div className="text-xs font-medium text-apptivia-ink">{tpl.name}</div>
            <div className="text-[10px] text-apptivia-carbon-400">{tpl.description}</div>
            <div className="text-[10px] text-apptivia-carbon-300 mt-1">{tpl.steps.length} steps</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SequenceBuilder({ organizationId, userId }) {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newName, setNewName] = useState('');

  const loadSequences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await backendFetch('/api/engage/sequences', undefined, 'GET');
      setSequences(data.data || []);
    } catch (err) {
      console.error('Failed to load sequences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const handleCreate = async (templateSteps) => {
    if (!newName.trim()) return;
    try {
      const data = await backendFetch('/api/engage/sequences', {
        name: newName.trim(), status: 'draft', steps: templateSteps || [],
      });
      if (data.ok) {
        toast.success('Sequence created');
        setNewName('');
        setCreating(false);
        setShowTemplates(false);
        setSelectedId(data.id);
        loadSequences();
      } else {
        toast.error(data.error || 'Failed to create');
      }
    } catch (err) {
      let msg = 'Failed to create sequence';
      try { const parsed = JSON.parse(err?.message); msg = parsed.error || msg; } catch { msg = err?.message || msg; }
      toast.error(msg);
    }
  };

  const handleDelete = async (seqId) => {
    if (!confirm('Delete this sequence and all its enrollments? This cannot be undone.')) return;
    try {
      await backendFetch(`/api/engage/sequences/${seqId}`, undefined, 'DELETE');
      toast.success('Sequence deleted');
      loadSequences();
    } catch {
      toast.error('Failed to delete sequence');
    }
  };

  const handleDuplicate = async (seqId) => {
    try {
      const data = await backendFetch(`/api/engage/sequences/${seqId}/duplicate`, {});
      if (data.ok) {
        toast.success('Sequence duplicated');
        loadSequences();
      }
    } catch {
      toast.error('Failed to duplicate sequence');
    }
  };

  const handleTemplateSelect = (tpl) => {
    if (!newName.trim()) {
      setNewName(tpl.name);
    }
    handleCreate(tpl.steps);
  };

  if (selectedId) {
    return (
      <SequenceDetail
        sequenceId={selectedId}
        onBack={() => { setSelectedId(null); loadSequences(); }}
        organizationId={organizationId}
      />
    );
  }

  const creatingSlot = showTemplates ? (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input autoFocus type="text" placeholder="Sequence name..." value={newName} onChange={(e) => setNewName(e.target.value)}
          className="flex-1 text-sm border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-apptivia-coral-tone-300" />
      </div>
      <TemplatePicker onSelect={handleTemplateSelect} onBlank={() => handleCreate([])} onCancel={() => { setShowTemplates(false); setNewName(''); }} />
    </div>
  ) : creating ? (
    <div className="mb-4 flex items-center gap-2">
      <input autoFocus type="text" placeholder="Sequence name..." value={newName} onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate([])}
        className="flex-1 text-sm border border-apptivia-carbon-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-apptivia-coral-tone-300" />
      <button onClick={() => handleCreate([])} className="px-3 py-2 bg-apptivia-coral text-white text-xs rounded-lg hover:bg-apptivia-coral/90">Create</button>
      <button onClick={() => { setCreating(false); setNewName(''); }} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={16} /></button>
    </div>
  ) : null;

  return (
    <div>
      <SequenceList
        sequences={sequences}
        onSelect={setSelectedId}
        onNew={() => setShowTemplates(true)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        loading={loading}
        creatingSlot={creatingSlot}
      />
    </div>
  );
}
