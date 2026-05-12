import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, Filter, Calendar, MessageCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient';

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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7'); // days
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-3">
            <Activity size={18} className="text-apptivia-ink" />
            <h2 className="text-lg font-bold text-apptivia-ink">Engage Activity</h2>
          </div>
          <div className="flex items-center gap-3">
            {onAskAaron && (
              <button
                onClick={() => onAskAaron('Review my recent Engage activity and suggest what to focus on next')}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-apptivia-ink text-white hover:bg-apptivia-ink/90 transition-colors"
              >
                <MessageCircle size={12} /> Ask Aaron
              </button>
            )}
            <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="px-6 py-3 border-b border-apptivia-carbon-100 flex items-center gap-4 overflow-x-auto">
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

                  return (
                    <tr key={event.id} className="hover:bg-apptivia-paper/50 transition-colors">
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-sm">{event.icon || '📌'}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-apptivia-ink">
                        {EVENT_TYPE_LABELS[event.event_type] || event.title}
                      </td>
                      <td className="px-4 py-2.5 text-apptivia-carbon-600 text-xs max-w-[300px] truncate">
                        {event.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-apptivia-carbon-500 text-xs">
                        {actorName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-apptivia-carbon-400 text-xs text-right whitespace-nowrap">
                        {formatDate(event.created_at)}
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
