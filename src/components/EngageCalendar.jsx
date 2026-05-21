/**
 * EngageCalendar — Calendar tab for Engage.
 * Shows synced Google Calendar / Microsoft Outlook events with meeting intelligence:
 * account linking, pre-meeting briefs, post-meeting outcome logging, and KPI tracking.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, CalendarDays, Clock, Users, Building2, Link2, X, ExternalLink,
  CheckCircle, XCircle, AlertTriangle, FileText, ChevronRight, MapPin,
  Loader, RefreshCw, Video, Sparkles, ChevronDown, ChevronUp, Mail,
  Plus, List, DollarSign
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useEngageCalendar } from '../hooks/useEngageCalendar';
import { useIntegrations } from '../hooks/useIntegrations';
import { useAuth } from '../AuthContext';
import { backendFetch } from '../utils/backendFetch';
import { tierHasFeature } from '../constants/subscriptionTiers';
import { useBilling } from '../hooks/useBilling';
import UpgradePrompt from './UpgradePrompt';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import MeetingsModal from './MeetingsModal';

// Event type → color mapping (brand colors)
const EVENT_COLORS = {
  meeting: { bg: '#FF4D2E', border: '#E0421F', text: '#FFFFFF' },
  call:    { bg: '#10B981', border: '#059669', text: '#FFFFFF' },
  '1on1':  { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF' },
  demo:    { bg: '#0A0A0B', border: '#0A0A0B', text: '#FFFFFF' },
  other:   { bg: '#9CA3AF', border: '#6B7280', text: '#FFFFFF' },
};

function getEventColor(eventType) {
  return EVENT_COLORS[eventType] || EVENT_COLORS.other;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDateRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const sStr = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const eStr = e ? e.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return eStr ? `${sStr} — ${eStr}` : sStr;
}

function getAttendeeDomains(attendees) {
  const skip = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','live.com']);
  const domains = new Set();
  for (const a of (attendees || [])) {
    if (a.email) {
      const d = a.email.split('@')[1]?.toLowerCase();
      if (d && !skip.has(d)) domains.add(d);
    }
  }
  return Array.from(domains);
}

// Outcome badge component
function OutcomeBadge({ outcome }) {
  if (!outcome) return null;
  const config = {
    completed:   { icon: CheckCircle, label: 'Completed', color: 'text-emerald-600 bg-emerald-50' },
    cancelled:   { icon: XCircle,     label: 'Cancelled', color: 'text-red-600 bg-red-50' },
    no_show:     { icon: AlertTriangle, label: 'No Show', color: 'text-amber-600 bg-amber-50' },
    rescheduled: { icon: RefreshCw,   label: 'Rescheduled', color: 'text-blue-600 bg-blue-50' },
  };
  const c = config[outcome] || config.completed;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${c.color}`}>
      <Icon size={10} />
      {c.label}
    </span>
  );
}

// ── Connect Calendar Banner ─────────────────────────────────────────────────

function ConnectCalendarBanner({ onConnect }) {
  return (
    <div className="bg-white rounded-xl border border-apptivia-carbon-200 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-apptivia-paper flex items-center justify-center mx-auto mb-4">
        <CalendarDays size={28} className="text-apptivia-coral" />
      </div>
      <h3 className="text-lg font-semibold text-apptivia-ink mb-2">Connect Your Calendar</h3>
      <p className="text-sm text-apptivia-carbon-500 mb-6 max-w-md mx-auto">
        Sync your Google Calendar or Microsoft Outlook to see meetings, get pre-meeting briefs,
        and track meeting outcomes on your scorecard.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onConnect('google_calendar')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-apptivia-carbon-200 rounded-lg text-sm font-medium text-apptivia-ink hover:bg-apptivia-paper transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google Calendar
        </button>
        <button
          onClick={() => onConnect('microsoft_outlook')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-apptivia-carbon-200 rounded-lg text-sm font-medium text-apptivia-ink hover:bg-apptivia-paper transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M0 0h11.5v11.5H0V0z" fill="#F25022"/><path d="M12.5 0H24v11.5H12.5V0z" fill="#7FBA00"/><path d="M0 12.5h11.5V24H0V12.5z" fill="#00A4EF"/><path d="M12.5 12.5H24V24H12.5V12.5z" fill="#FFB900"/></svg>
          Microsoft Outlook
        </button>
      </div>
    </div>
  );
}

// ── Today's Agenda Strip ────────────────────────────────────────────────────

function TodaysAgenda({ events, domainAccountMap, prepCards, onEventClick }) {
  if (!events.length) {
    return (
      <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-apptivia-coral" />
          <h3 className="text-xs font-semibold text-apptivia-ink uppercase tracking-wider">Today's Agenda</h3>
        </div>
        <p className="text-xs text-apptivia-carbon-400">No meetings scheduled for today.</p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-apptivia-coral" />
        <h3 className="text-xs font-semibold text-apptivia-ink uppercase tracking-wider">
          Today's Agenda
        </h3>
        <span className="text-[10px] text-apptivia-carbon-400 ml-1">{events.length} meeting{events.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {events.map(evt => {
          const color = getEventColor(evt.event_type);
          const isPast = new Date(evt.end_time) < now;
          const isNow = new Date(evt.start_time) <= now && new Date(evt.end_time) > now;
          const domains = getAttendeeDomains(evt.attendees);
          const linkedAccount = domains.find(d => domainAccountMap[d]);
          const hasPrepCard = prepCards.some(pc => pc.calendar_event_id === evt.id);

          return (
            <button
              key={evt.id}
              onClick={() => onEventClick(evt)}
              className={`flex-shrink-0 w-56 rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                isNow ? 'border-apptivia-coral ring-1 ring-apptivia-coral/30 bg-apptivia-coral/5' :
                isPast ? 'border-apptivia-carbon-100 bg-apptivia-paper/50 opacity-70' :
                'border-apptivia-carbon-100 bg-white hover:border-apptivia-carbon-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.bg }} />
                <span className="text-[10px] font-medium text-apptivia-carbon-500">{formatTime(evt.start_time)}</span>
                {isNow && <span className="text-[9px] font-bold text-apptivia-coral uppercase">Now</span>}
                {evt.meeting_outcome && <OutcomeBadge outcome={evt.meeting_outcome} />}
              </div>
              <p className="text-xs font-medium text-apptivia-ink truncate mb-1">{evt.title}</p>
              <div className="flex items-center gap-2">
                {evt.attendees?.length > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-apptivia-carbon-400">
                    <Users size={10} />
                    {evt.attendees.length}
                  </span>
                )}
                {linkedAccount && (
                  <span className="flex items-center gap-0.5 text-[10px] text-apptivia-coral">
                    <Building2 size={10} />
                    {domainAccountMap[linkedAccount].account_name}
                  </span>
                )}
                {hasPrepCard && (
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600" title="Pre-meeting brief available">
                    <Sparkles size={10} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Outcome Log Form ────────────────────────────────────────────────────────

function OutcomeLogForm({ event, onSubmit, submitting }) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!outcome) return;
    onSubmit(event.id, outcome, notes);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-apptivia-carbon-100 pt-3 mt-3">
      <h4 className="text-xs font-semibold text-apptivia-ink mb-2 flex items-center gap-1.5">
        <CheckCircle size={12} className="text-apptivia-coral" />
        Log Meeting Outcome
      </h4>
      <select
        value={outcome}
        onChange={e => setOutcome(e.target.value)}
        className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink bg-white mb-2 focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
      >
        <option value="">Select outcome...</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
        <option value="no_show">No Show</option>
        <option value="rescheduled">Rescheduled</option>
      </select>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)..."
        rows={2}
        className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink resize-none mb-2 focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
      />
      <button
        type="submit"
        disabled={!outcome || submitting}
        className="w-full py-2 rounded-lg text-xs font-medium text-white bg-apptivia-coral hover:bg-apptivia-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Saving...' : 'Log Outcome'}
      </button>
    </form>
  );
}

// ── Event Detail Drawer ─────────────────────────────────────────────────────

function EventDetailDrawer({ event, onClose, domainAccountMap, domainCompanyMap, prepCards, onLogOutcome, onLinkAccount, onLinkDeal, submitting }) {
  const [dealSearch, setDealSearch] = useState('');
  const [dealResults, setDealResults] = useState([]);
  const [searchingDeals, setSearchingDeals] = useState(false);
  if (!event) return null;

  const isPast = new Date(event.end_time) < new Date();
  const domains = getAttendeeDomains(event.attendees);
  const matchedAccounts = domains.map(d => domainAccountMap[d]).filter(Boolean);
  const matchedCompanies = domains.map(d => domainCompanyMap[d]).filter(Boolean);
  const prepCard = prepCards.find(pc => pc.calendar_event_id === event.id);
  const color = getEventColor(event.event_type);

  return (
    <div className="fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-50 border-l border-apptivia-carbon-100 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-apptivia-carbon-100">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color.bg }} />
            <span className="text-[10px] font-medium text-apptivia-carbon-500 uppercase">{event.event_type || 'meeting'}</span>
            {event.meeting_outcome && <OutcomeBadge outcome={event.meeting_outcome} />}
          </div>
          <h3 className="text-sm font-semibold text-apptivia-ink truncate">{event.title}</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-apptivia-paper rounded-lg transition-colors flex-shrink-0">
          <X size={16} className="text-apptivia-carbon-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Time & Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-apptivia-carbon-600">
            <Clock size={12} />
            <span>{formatDateRange(event.start_time, event.end_time)}</span>
            <span className="text-apptivia-carbon-300">|</span>
            <span>{new Date(event.start_time).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-apptivia-carbon-600">
              <MapPin size={12} />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.external_link && (
            <a
              href={event.external_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-apptivia-coral hover:underline"
            >
              <Video size={12} />
              Join Meeting
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">Description</h4>
            <p className="text-xs text-apptivia-carbon-600 whitespace-pre-wrap line-clamp-4">{event.description}</p>
          </div>
        )}

        {/* Attendees */}
        {event.attendees?.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-2">
              Attendees ({event.attendees.length})
            </h4>
            <div className="space-y-1.5">
              {event.attendees.map((att, i) => {
                const domain = att.email?.split('@')[1]?.toLowerCase();
                const matchedAcct = domain ? domainAccountMap[domain] : null;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-apptivia-paper flex items-center justify-center text-[10px] font-medium text-apptivia-ink flex-shrink-0">
                        {(att.name || att.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-apptivia-ink truncate">{att.name || att.email}</p>
                        {att.email && att.name && (
                          <p className="text-[10px] text-apptivia-carbon-400 truncate">{att.email}</p>
                        )}
                      </div>
                    </div>
                    {matchedAcct && (
                      <span className="flex items-center gap-1 text-[10px] text-apptivia-coral bg-apptivia-coral/10 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2">
                        <Building2 size={9} />
                        {matchedAcct.account_name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Matched Accounts */}
        {matchedAccounts.length > 0 && !event.linked_account_id && (
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-2">
              <Link2 size={10} className="inline mr-1" />
              Matched Accounts
            </h4>
            <div className="space-y-1.5">
              {matchedAccounts.map(acct => (
                <button
                  key={acct.id}
                  onClick={() => onLinkAccount(event.id, acct.id)}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-apptivia-carbon-100 hover:border-apptivia-coral hover:bg-apptivia-coral/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={12} className="text-apptivia-coral" />
                    <span className="text-xs font-medium text-apptivia-ink">{acct.account_name}</span>
                  </div>
                  <span className="text-[10px] text-apptivia-carbon-400">Link</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Linked Account Badge */}
        {event.linked_account_id && matchedAccounts.length > 0 && (
          <div className="flex items-center gap-2 bg-apptivia-coral/5 border border-apptivia-coral/20 rounded-lg p-2.5">
            <Building2 size={14} className="text-apptivia-coral" />
            <div>
              <p className="text-xs font-medium text-apptivia-ink">
                {matchedAccounts.find(a => a.id === event.linked_account_id)?.account_name || 'Linked Account'}
              </p>
              <p className="text-[10px] text-apptivia-carbon-400">Account linked</p>
            </div>
          </div>
        )}

        {/* Deal Linking */}
        {onLinkDeal && (
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <DollarSign size={10} /> Deal
            </h4>
            {event.linked_deal_id ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <DollarSign size={14} className="text-emerald-600" />
                <span className="text-xs font-medium text-apptivia-ink flex-1">Linked to deal</span>
                <button onClick={() => onLinkDeal(event.id, null)} className="text-[10px] text-apptivia-carbon-400 hover:text-red-500">Remove</button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={dealSearch}
                  onChange={(e) => {
                    setDealSearch(e.target.value);
                    if (e.target.value.length >= 2) {
                      setSearchingDeals(true);
                      backendFetch('/api/pipeline/deals/search', { query: e.target.value }, 'POST')
                        .then(r => { setDealResults(r.deals || []); setSearchingDeals(false); })
                        .catch(() => setSearchingDeals(false));
                    } else {
                      setDealResults([]);
                    }
                  }}
                  placeholder="Search deals to link..."
                  className="w-full px-2.5 py-1.5 border border-apptivia-carbon-200 rounded-lg text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral"
                />
                {searchingDeals && <p className="text-[10px] text-apptivia-carbon-400">Searching...</p>}
                {dealResults.length > 0 && (
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {dealResults.slice(0, 5).map(deal => (
                      <button key={deal.id}
                        onClick={() => { onLinkDeal(event.id, deal.id); setDealSearch(''); setDealResults([]); }}
                        className="w-full flex items-center justify-between p-2 rounded-lg border border-apptivia-carbon-100 hover:border-emerald-300 hover:bg-emerald-50/50 text-left transition-colors"
                      >
                        <span className="text-xs font-medium text-apptivia-ink truncate">{deal.deal_name}</span>
                        {deal.deal_value > 0 && <span className="text-[10px] text-emerald-600 ml-2">${deal.deal_value.toLocaleString()}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pre-Meeting Brief */}
        {prepCard && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1.5">
              <Sparkles size={12} />
              Pre-Meeting Brief
            </h4>
            {prepCard.card_json?.talking_points && (
              <ul className="text-[11px] text-emerald-700 space-y-0.5 list-disc list-inside">
                {prepCard.card_json.talking_points.slice(0, 4).map((tp, i) => (
                  <li key={i}>{tp}</li>
                ))}
              </ul>
            )}
            {prepCard.card_json?.key_insights && (
              <p className="text-[11px] text-emerald-700 mt-1.5">{prepCard.card_json.key_insights}</p>
            )}
          </div>
        )}

        {/* Meeting Notes (if outcome already logged) */}
        {event.meeting_outcome && event.meeting_notes && (
          <div>
            <h4 className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">Meeting Notes</h4>
            <p className="text-xs text-apptivia-carbon-600 whitespace-pre-wrap bg-apptivia-paper rounded-lg p-2.5">{event.meeting_notes}</p>
          </div>
        )}

        {/* Outcome Form (for past meetings without outcome) */}
        {isPast && !event.meeting_outcome && !event.is_all_day && (
          <OutcomeLogForm event={event} onSubmit={onLogOutcome} submitting={submitting} />
        )}
      </div>
    </div>
  );
}

// ── Needs Outcome Banner ────────────────────────────────────────────────────

function NeedsOutcomeBanner({ count, onReview }) {
  if (count === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-600" />
        <span className="text-xs font-medium text-amber-800">
          {count} past meeting{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} outcome logging
        </span>
      </div>
      <button
        onClick={onReview}
        className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
      >
        Review <ChevronRight size={12} />
      </button>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function EngageCalendar({ organizationId, userId }) {
  const { profile } = useAuth();
  const { plan: billingPlan } = useBilling();
  const hasAccess = tierHasFeature(billingPlan || 'Basic', 'engage_calendar');

  const {
    events, calIntegrations, domainAccountMap, domainCompanyMap,
    prepCards, todayEvents, needsOutcome,
    loading, error, isConnected,
    loadEvents, loadPrepCards, logOutcome, linkAccount, linkDeal,
  } = useEngageCalendar();

  const { connectOAuth } = useIntegrations({ personal: true });

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentView, setCurrentView] = useState('timeGridWeek');
  const [submitting, setSubmitting] = useState(false);
  const [calendarRef, setCalendarRef] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showMeetingsModal, setShowMeetingsModal] = useState(false);

  // Initial load: always attempt to fetch — the response determines isConnected
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    loadEvents(start.toISOString(), end.toISOString());
    loadPrepCards();
  }, [loadEvents, loadPrepCards]);

  // Convert events to FullCalendar format
  const fcEvents = useMemo(() => {
    return events.map(evt => {
      const color = getEventColor(evt.event_type);
      return {
        id: evt.id,
        title: evt.title,
        start: evt.start_time,
        end: evt.end_time,
        allDay: evt.is_all_day,
        backgroundColor: evt.meeting_outcome ? '#D1D5DB' : color.bg,
        borderColor: evt.meeting_outcome ? '#9CA3AF' : color.border,
        textColor: evt.meeting_outcome ? '#6B7280' : color.text,
        extendedProps: evt,
      };
    });
  }, [events]);

  const handleEventClick = useCallback((info) => {
    setSelectedEvent(info.event.extendedProps);
  }, []);

  const handleDateChange = useCallback((dateInfo) => {
    loadEvents(dateInfo.startStr, dateInfo.endStr);
  }, [loadEvents]);

  const handleLogOutcome = useCallback(async (eventId, outcome, notes) => {
    setSubmitting(true);
    try {
      await logOutcome(eventId, outcome, notes);
      // If they logged the selected event, update it
      setSelectedEvent(prev => prev?.id === eventId
        ? { ...prev, meeting_outcome: outcome, meeting_notes: notes, outcome_logged_at: new Date().toISOString() }
        : prev
      );
    } catch (err) {
      console.error('Failed to log outcome:', err);
    } finally {
      setSubmitting(false);
    }
  }, [logOutcome]);

  const handleLinkAccount = useCallback(async (eventId, accountId) => {
    try {
      await linkAccount(eventId, accountId);
      setSelectedEvent(prev => prev?.id === eventId ? { ...prev, linked_account_id: accountId } : prev);
    } catch (err) {
      console.error('Failed to link account:', err);
    }
  }, [linkAccount]);

  const handleConnectCalendar = useCallback((provider) => {
    connectOAuth(provider);
  }, [connectOAuth]);

  // Feature gate
  if (!hasAccess) {
    return (
      <div className="py-8">
        <UpgradePrompt variant="feature_gate" context="inline" feature="engage_calendar" />
      </div>
    );
  }

  // Not connected
  if (!loading && !isConnected) {
    return <ConnectCalendarBanner onConnect={handleConnectCalendar} />;
  }

  return (
    <div className="space-y-0">
      {/* Loading state */}
      {loading && events.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader size={20} className="animate-spin text-apptivia-coral mr-2" />
          <span className="text-sm text-apptivia-carbon-500">Loading calendar...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {!loading && isConnected && (
        <>
          {/* Today's Agenda */}
          <TodaysAgenda
            events={todayEvents}
            domainAccountMap={domainAccountMap}
            prepCards={prepCards}
            onEventClick={setSelectedEvent}
          />

          {/* Needs Outcome Banner */}
          <NeedsOutcomeBanner
            count={needsOutcome.length}
            onReview={() => {
              if (needsOutcome[0]) setSelectedEvent(needsOutcome[0]);
            }}
          />

          {/* Calendar View */}
          <div className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
            {/* View toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-apptivia-coral" />
                <span className="text-xs font-semibold text-apptivia-ink uppercase tracking-wider">Calendar</span>
                {calIntegrations.length > 0 && (
                  <span className="text-[10px] text-apptivia-carbon-400">
                    via {calIntegrations.map(i => i.integration_type === 'google_calendar' ? 'Google' : 'Outlook').join(' + ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 transition-colors"
                >
                  <Plus size={12} />
                  Schedule Meeting
                </button>
                <button
                  onClick={() => setShowMeetingsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-apptivia-ink bg-apptivia-paper rounded-lg hover:bg-apptivia-carbon-100 transition-colors"
                >
                  <List size={12} />
                  All Meetings
                </button>
              </div>
              <div className="flex items-center gap-1 bg-apptivia-paper rounded-lg p-0.5">
                {[
                  { view: 'dayGridMonth', label: 'Month' },
                  { view: 'timeGridWeek', label: 'Week' },
                  { view: 'timeGridDay', label: 'Day' },
                ].map(v => (
                  <button
                    key={v.view}
                    onClick={() => {
                      setCurrentView(v.view);
                      calendarRef?.getApi()?.changeView(v.view);
                    }}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                      currentView === v.view
                        ? 'bg-apptivia-ink text-white'
                        : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* FullCalendar */}
            <div className="fc-apptivia">
              <FullCalendar
                ref={el => setCalendarRef(el)}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={currentView}
                events={fcEvents}
                eventClick={handleEventClick}
                datesSet={handleDateChange}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: '',
                }}
                height="auto"
                contentHeight={520}
                nowIndicator={true}
                dayMaxEvents={3}
                eventDisplay="block"
                slotMinTime="07:00:00"
                slotMaxTime="21:00:00"
                allDaySlot={true}
                weekends={false}
                stickyHeaderDates={true}
              />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-apptivia-carbon-50">
              {Object.entries(EVENT_COLORS).map(([type, c]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.bg }} />
                  <span className="text-[10px] text-apptivia-carbon-500 capitalize">{type === '1on1' ? '1:1' : type}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Event Detail Drawer */}
      {selectedEvent && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={() => setSelectedEvent(null)}
          />
          <EventDetailDrawer
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            domainAccountMap={domainAccountMap}
            domainCompanyMap={domainCompanyMap}
            prepCards={prepCards}
            onLogOutcome={handleLogOutcome}
            onLinkAccount={handleLinkAccount}
            onLinkDeal={linkDeal}
            submitting={submitting}
          />
        </>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && (
        <ScheduleMeetingModal
          onClose={() => setShowScheduleModal(false)}
          onCreated={() => {
            // Refresh events after creating a meeting
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            loadEvents(start.toISOString(), end.toISOString());
          }}
          calIntegrations={calIntegrations}
        />
      )}

      {/* Meetings Modal */}
      {showMeetingsModal && (
        <MeetingsModal
          events={events}
          onClose={() => setShowMeetingsModal(false)}
          domainAccountMap={domainAccountMap}
          onLogOutcome={handleLogOutcome}
          submitting={submitting}
        />
      )}
    </div>
  );
}
