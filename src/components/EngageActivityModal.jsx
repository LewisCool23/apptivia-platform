import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, Filter, Calendar, MessageCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useModalBehavior } from '../hooks/useModalBehavior';

const EVENT_TYPE_LABELS = {
  'account.researched': 'Account Researched',
  'prospect.researched': 'Prospect Researched',
  'forecast.generated': 'AI Forecast Generated',
  'account.analyzed': 'Account Analyzed',
  'account.scored': 'Accounts Scored',
  'outreach.generated': 'Outreach Draft Generated',
  'outreach.sent': 'Outreach Sent',
  'playbook.generated': 'Playbook Generated',
  'deal.created': 'Deal Created',
  'deal.stage_changed': 'Deal Stage Changed',
  'deal.closed_won': 'Deal Closed Won',
  'deal.closed_lost': 'Deal Closed Lost',
  'call.logged': 'Call Logged',
  'call.analyzed': 'Call Analyzed',
  'badge.earned': 'Badge Earned',
  'signal.detected': 'Signal Detected',
  'contacts.searched': 'Contacts Searched',
  'contacts.enriched': 'Contacts Enriched',
};

const EVENT_TYPE_COLORS = {
  'account': 'bg-apptivia-coral text-white',
  'prospect': 'bg-apptivia-coral text-white',
  'outreach': 'bg-amber-500 text-white',
  'deal': 'bg-emerald-500 text-white',
  'call': 'bg-purple-500 text-white',
  'forecast': 'bg-sky-500 text-white',
  'playbook': 'bg-sky-500 text-white',
  'signal': 'bg-apptivia-ink text-white',
  'badge': 'bg-amber-500 text-white',
  'contacts': 'bg-blue-500 text-white',
};

const TYPE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'account', label: 'Accounts' },
  { id: 'prospect', label: 'Prospects' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'deal', label: 'Deals' },
  { id: 'call', label: 'Calls' },
  { id: 'forecast', label: 'Forecasts' },
  { id: 'playbook', label: 'Playbooks' },
  { id: 'signal', label: 'Signals' },
  { id: 'contacts', label: 'Contacts' },
];

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EngageActivityModal({ isOpen, onClose, organizationId, onAskAaron }) {
  useModalBehavior(isOpen, onClose);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30'); // days — match Activity Feed side panel
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!isOpen || !organizationId) return;
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - parseInt(dateRange));

    supabase
      .from('engage_activity_events')
      .select('*, profiles(full_name, first_name, last_name)')
      .eq('organization_id', organizationId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, [isOpen, organizationId, dateRange]);

  // Stats for this week
  const weekStats = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekEvents = events.filter(e => new Date(e.created_at) >= weekAgo);
    const counts = {};
    weekEvents.forEach(e => {
      const cat = e.event_type?.split('.')[0] || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return { total: weekEvents.length, ...counts };
  }, [events]);

  const displayed = useMemo(() => {
    let result = events;
    if (typeFilter !== 'all') {
      result = result.filter(e => e.event_type?.startsWith(`${typeFilter}.`));
    }
    if (sortAsc) {
      return [...result].reverse();
    }
    return result;
  }, [events, typeFilter, sortAsc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div
        className="bg-apptivia-paper rounded-xl shadow-2xl w-full max-w-7xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-apptivia-coral to-apptivia-coral/80 px-8 py-5 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Engage Activity</h2>
              <p className="text-white/70 text-xs">{displayed.length} events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onAskAaron && (
              <button
                onClick={() => onAskAaron('Review my recent Engage activity and suggest what to focus on next')}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <MessageCircle size={12} /> Ask Aaron
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-8 py-4 border-b border-apptivia-carbon-100 flex items-center gap-4 flex-wrap">
          <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[80px]">
            <p className="text-lg font-bold text-apptivia-ink">{weekStats.total}</p>
            <p className="text-[10px] text-apptivia-carbon-500">This Week</p>
          </div>
          {weekStats.account > 0 && (
            <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[70px]">
              <p className="text-base font-bold text-apptivia-ink">{weekStats.account}</p>
              <p className="text-[10px] text-apptivia-carbon-500">Accounts</p>
            </div>
          )}
          {weekStats.outreach > 0 && (
            <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[70px]">
              <p className="text-base font-bold text-apptivia-ink">{weekStats.outreach}</p>
              <p className="text-[10px] text-apptivia-carbon-500">Outreach</p>
            </div>
          )}
          {weekStats.deal > 0 && (
            <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[70px]">
              <p className="text-base font-bold text-apptivia-ink">{weekStats.deal}</p>
              <p className="text-[10px] text-apptivia-carbon-500">Deals</p>
            </div>
          )}
          {weekStats.call > 0 && (
            <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[70px]">
              <p className="text-base font-bold text-apptivia-ink">{weekStats.call}</p>
              <p className="text-[10px] text-apptivia-carbon-500">Calls</p>
            </div>
          )}
          {weekStats.prospect > 0 && (
            <div className="text-center px-3 py-1.5 bg-apptivia-paper rounded-lg min-w-[70px]">
              <p className="text-base font-bold text-apptivia-ink">{weekStats.prospect}</p>
              <p className="text-[10px] text-apptivia-carbon-500">Prospects</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-apptivia-carbon-100 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-apptivia-carbon-400" />
            {TYPE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setTypeFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === cat.id
                    ? 'bg-apptivia-ink text-white'
                    : 'bg-white border border-apptivia-carbon-200 text-apptivia-carbon-600 hover:border-apptivia-carbon-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={12} className="text-apptivia-carbon-400" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="text-xs border border-apptivia-carbon-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="inline-flex items-center gap-1 text-xs text-apptivia-carbon-500 hover:text-apptivia-ink transition-colors"
              title={sortAsc ? 'Oldest first' : 'Newest first'}
            >
              {sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {sortAsc ? 'Oldest' : 'Newest'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-apptivia-carbon-400">Loading activity...</div>
          ) : displayed.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-apptivia-carbon-400">
              No activity in this period
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-apptivia-paper sticky top-0 z-10">
                <tr className="text-left text-xs text-apptivia-carbon-500 font-medium">
                  <th className="px-4 py-2.5 w-8"></th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Details</th>
                  <th className="px-4 py-2.5">By</th>
                  <th className="px-4 py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apptivia-carbon-100/50">
                {displayed.map(event => {
                  const actorName = event.profiles
                    ? (event.profiles.full_name || `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim())
                    : null;
                  const actorInitials = actorName
                    ? actorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : null;
                  const eventCategory = event.event_type?.split('.')[0] || 'other';
                  const typeColor = EVENT_TYPE_COLORS[eventCategory] || 'bg-apptivia-carbon-200 text-apptivia-carbon-600';

                  return (
                    <tr key={event.id} className="hover:bg-apptivia-paper/50 transition-colors">
                      <td className="px-4 py-2.5 text-center">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] ${typeColor}`}>
                          {event.icon || '📌'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-apptivia-ink text-xs">
                          {EVENT_TYPE_LABELS[event.event_type] || event.title}
                        </span>
                        <span className={`ml-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${typeColor}`}>
                          {eventCategory}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-apptivia-carbon-600 text-xs max-w-[300px] truncate">
                        {event.description || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {actorName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-apptivia-ink flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
                              {actorInitials}
                            </div>
                            <span className="text-xs text-apptivia-carbon-500 truncate">{actorName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-apptivia-carbon-400">System</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-apptivia-carbon-400 text-xs text-right whitespace-nowrap">
                        {timeAgo(event.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
