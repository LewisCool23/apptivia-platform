/**
 * MeetingsModal — View all past, current, and future meetings with outcome logging.
 * Shows meeting stats, filters, and inline outcome logging for unlogged meetings.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  X, Calendar, Clock, Users, Building2, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, Filter, Video, MapPin, ExternalLink, FileText,
  Sparkles, Search
} from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';

const OUTCOME_CONFIG = {
  completed:   { icon: CheckCircle,    label: 'Completed',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cancelled:   { icon: XCircle,        label: 'Cancelled',   color: 'text-red-600 bg-red-50 border-red-200' },
  no_show:     { icon: AlertTriangle,  label: 'No Show',     color: 'text-amber-600 bg-amber-50 border-amber-200' },
  rescheduled: { icon: RefreshCw,      label: 'Rescheduled', color: 'text-blue-600 bg-blue-50 border-blue-200' },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTimeRange(start, end) {
  return `${formatTime(start)}${end ? ` — ${formatTime(end)}` : ''}`;
}

// Inline outcome log row
function InlineOutcomeLog({ event, onSubmit, submitting }) {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-[10px] font-medium text-apptivia-coral hover:underline"
      >
        Log Outcome
      </button>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-apptivia-paper rounded-lg space-y-2">
      <select
        value={outcome}
        onChange={e => setOutcome(e.target.value)}
        className="w-full border border-apptivia-carbon-200 rounded-lg px-2.5 py-1.5 text-[11px] text-apptivia-ink bg-white focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
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
        rows={4}
        className="w-full border border-apptivia-carbon-200 rounded-lg px-2.5 py-1.5 text-[11px] text-apptivia-ink resize-y bg-white focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (outcome) onSubmit(event.id, outcome, notes);
          }}
          disabled={!outcome || submitting}
          className="px-3 py-1 text-[10px] font-medium text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="px-3 py-1 text-[10px] font-medium text-apptivia-carbon-500 bg-white border border-apptivia-carbon-200 rounded-lg hover:bg-apptivia-paper transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function MeetingsModal({ onClose, events, domainAccountMap, onLogOutcome, onEventClick }) {
  useModalBehavior(true, onClose);
  const [filter, setFilter] = useState('all'); // all | upcoming | past | needs_outcome
  const [typeFilter, setTypeFilter] = useState('all'); // all | meeting | call | 1on1 | demo
  const [searchQuery, setSearchQuery] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  const now = new Date();

  // Stats
  const stats = useMemo(() => {
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekEnd = new Date(thisWeekStart.getTime() + 7 * 86400000);

    const weekMeetings = events.filter(e => {
      const s = new Date(e.start_time);
      return s >= thisWeekStart && s < thisWeekEnd && !e.is_all_day;
    });
    const completed = weekMeetings.filter(e => e.meeting_outcome === 'completed').length;
    const noShows = weekMeetings.filter(e => e.meeting_outcome === 'no_show').length;
    const needsOutcome = events.filter(e => new Date(e.end_time) < now && !e.meeting_outcome && !e.is_all_day).length;

    return {
      total: weekMeetings.length,
      completed,
      noShows,
      needsOutcome,
      completionRate: weekMeetings.length > 0 ? Math.round((completed / weekMeetings.length) * 100) : 0,
    };
  }, [events, now]);

  // Filtered + sorted events
  const filteredEvents = useMemo(() => {
    let list = [...events].filter(e => !e.is_all_day);

    // Time filter
    if (filter === 'upcoming') list = list.filter(e => new Date(e.start_time) > now);
    else if (filter === 'past') list = list.filter(e => new Date(e.end_time) < now);
    else if (filter === 'needs_outcome') list = list.filter(e => new Date(e.end_time) < now && !e.meeting_outcome);

    // Type filter
    if (typeFilter !== 'all') list = list.filter(e => e.event_type === typeFilter);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.attendees?.some(a => a.email?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q))
      );
    }

    // Sort: upcoming first (future asc), then past desc
    list.sort((a, b) => {
      const aStart = new Date(a.start_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const aFuture = aStart > now.getTime();
      const bFuture = bStart > now.getTime();
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      if (aFuture && bFuture) return aStart - bStart;
      return bStart - aStart;
    });

    return list;
  }, [events, filter, typeFilter, searchQuery, now]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups = {};
    for (const evt of filteredEvents) {
      const dateKey = new Date(evt.start_time).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(evt);
    }
    return groups;
  }, [filteredEvents]);

  const handleLogOutcome = useCallback(async (eventId, outcome, notes) => {
    setSubmittingId(eventId);
    try {
      await onLogOutcome(eventId, outcome, notes);
    } finally {
      setSubmittingId(null);
    }
  }, [onLogOutcome]);

  // Get attendee domains for account matching
  const getLinkedAccount = (evt) => {
    for (const att of (evt.attendees || [])) {
      if (att.email) {
        const domain = att.email.split('@')[1]?.toLowerCase();
        if (domain && domainAccountMap[domain]) return domainAccountMap[domain];
      }
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-apptivia-coral" />
            <h2 className="text-sm font-semibold text-apptivia-ink">All Meetings</h2>
            <span className="text-[10px] text-apptivia-carbon-400">{filteredEvents.length} meetings</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-apptivia-paper rounded-lg transition-colors">
            <X size={16} className="text-apptivia-carbon-400" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="px-5 py-3 border-b border-apptivia-carbon-50 flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-lg font-bold text-apptivia-ink">{stats.total}</p>
            <p className="text-[9px] text-apptivia-carbon-400 uppercase">This Week</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-[9px] text-apptivia-carbon-400 uppercase">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-600">{stats.noShows}</p>
            <p className="text-[9px] text-apptivia-carbon-400 uppercase">No Shows</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-apptivia-coral">{stats.needsOutcome}</p>
            <p className="text-[9px] text-apptivia-carbon-400 uppercase">Needs Logging</p>
          </div>
          <div className="text-center ml-auto">
            <p className="text-lg font-bold text-apptivia-ink">{stats.completionRate}%</p>
            <p className="text-[9px] text-apptivia-carbon-400 uppercase">Completion</p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-5 py-2.5 border-b border-apptivia-carbon-50 flex items-center gap-2 flex-wrap">
          {/* Time filter pills */}
          <div className="flex items-center gap-1 bg-apptivia-paper rounded-lg p-0.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past' },
              { id: 'needs_outcome', label: `Needs Logging${stats.needsOutcome ? ` (${stats.needsOutcome})` : ''}` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                  filter === f.id ? 'bg-apptivia-ink text-white' : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border border-apptivia-carbon-200 rounded-lg px-2 py-1 text-[10px] text-apptivia-ink bg-white focus:ring-1 focus:ring-apptivia-coral outline-none"
          >
            <option value="all">All Types</option>
            <option value="meeting">Meetings</option>
            <option value="call">Calls</option>
            <option value="1on1">1:1s</option>
            <option value="demo">Demos</option>
          </select>

          {/* Search */}
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search meetings..."
              className="pl-7 pr-3 py-1 border border-apptivia-carbon-200 rounded-lg text-[10px] text-apptivia-ink w-40 focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
            />
          </div>
        </div>

        {/* Meeting List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={24} className="text-apptivia-carbon-300 mx-auto mb-2" />
              <p className="text-xs text-apptivia-carbon-400">No meetings found</p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([dateStr, dayEvents]) => (
              <div key={dateStr} className="mb-4">
                {/* Date Header */}
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-1.5 mb-1.5 z-10">
                  <p className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                    {formatDate(dayEvents[0].start_time)}
                    {new Date(dateStr).toDateString() === now.toDateString() && (
                      <span className="ml-1.5 text-apptivia-coral">Today</span>
                    )}
                  </p>
                </div>

                {/* Events for this date */}
                <div className="space-y-1.5">
                  {dayEvents.map(evt => {
                    const isPast = new Date(evt.end_time) < now;
                    const isNow = new Date(evt.start_time) <= now && new Date(evt.end_time) > now;
                    const outcomeConfig = evt.meeting_outcome ? OUTCOME_CONFIG[evt.meeting_outcome] : null;
                    const OutcomeIcon = outcomeConfig?.icon;
                    const linkedAccount = getLinkedAccount(evt);

                    return (
                      <div
                        key={evt.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isNow ? 'border-apptivia-coral bg-apptivia-coral/5' :
                          isPast && !evt.meeting_outcome ? 'border-amber-200 bg-amber-50/30' :
                          'border-apptivia-carbon-100 bg-white hover:bg-apptivia-paper/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-center gap-2 mb-1">
                              <button
                                onClick={() => { onEventClick?.(evt); onClose(); }}
                                className="text-xs font-medium text-apptivia-ink hover:text-apptivia-coral truncate text-left transition-colors"
                              >
                                {evt.title}
                              </button>
                              {isNow && <span className="text-[9px] font-bold text-apptivia-coral uppercase flex-shrink-0">Now</span>}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-3 text-[10px] text-apptivia-carbon-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatTimeRange(evt.start_time, evt.end_time)}
                              </span>
                              {evt.attendees?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users size={10} />
                                  {evt.attendees.length}
                                </span>
                              )}
                              {linkedAccount && (
                                <span className="flex items-center gap-1 text-apptivia-coral">
                                  <Building2 size={10} />
                                  {linkedAccount.account_name}
                                </span>
                              )}
                              {evt.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  <span className="truncate max-w-[120px]">{evt.location}</span>
                                </span>
                              )}
                              {evt.external_link && (
                                <a href={evt.external_link} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-0.5 text-apptivia-coral hover:underline">
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>

                            {/* Meeting notes */}
                            {evt.meeting_notes && (
                              <p className="text-[10px] text-apptivia-carbon-500 mt-1.5 italic line-clamp-2">
                                <FileText size={9} className="inline mr-1" />
                                {evt.meeting_notes}
                              </p>
                            )}
                          </div>

                          {/* Outcome badge or log button */}
                          <div className="flex-shrink-0">
                            {outcomeConfig ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${outcomeConfig.color}`}>
                                <OutcomeIcon size={10} />
                                {outcomeConfig.label}
                              </span>
                            ) : isPast ? (
                              <InlineOutcomeLog
                                event={evt}
                                onSubmit={handleLogOutcome}
                                submitting={submittingId === evt.id}
                              />
                            ) : null}
                          </div>
                        </div>

                        {/* Inline outcome logging for "needs_outcome" filter */}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
