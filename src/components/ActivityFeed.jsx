import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, RefreshCw, Filter, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs  / 60);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}

const EVENT_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'deal',    label: 'Deals' },
  { id: 'call',    label: 'Calls' },
  { id: 'badge',   label: 'Badges' },
  { id: 'signal',  label: 'Signals' },
  { id: 'outreach',label: 'Outreach' },
];

// ── Activity Event Card ───────────────────────────────────────────────────────

function EventItem({ event, isNew }) {
  const dotColor = event.color || '#6366f1';
  const actorName = event.profiles
    ? (event.profiles.full_name || `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim())
    : null;

  return (
    <div className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${isNew ? 'bg-apptivia-carbon-100/60 animate-pulse-once' : 'hover:bg-apptivia-paper'}`}>
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 shadow-sm"
          style={{ background: `${dotColor}18`, border: `2px solid ${dotColor}40` }}
        >
          <span>{event.icon || '📌'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-semibold text-apptivia-ink">{event.title}</span>
            {actorName && (
              <span className="text-xs text-apptivia-carbon-500 ml-1.5">by {actorName}</span>
            )}
          </div>
          <span className="text-xs text-apptivia-carbon-400 flex-shrink-0 mt-0.5">{timeAgo(event.created_at)}</span>
        </div>
        {event.description && (
          <p className="text-xs text-apptivia-carbon-600 mt-0.5 leading-relaxed">{event.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ActivityFeed({ organizationId, maxHeight = 480, compact = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [newEventIds, setNewEventIds] = useState(new Set());
  const channelRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('engage_activity_events')
        .select('*, profiles(full_name, first_name, last_name, avatar_url)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(compact ? 25 : 60);

      if (filter !== 'all') {
        query = query.like('event_type', `${filter}.%`);
      }

      const { data } = await query;
      setEvents(data || []);
    } finally {
      setLoading(false);
    }
  }, [organizationId, filter, compact]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`activity-feed-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'engage_activity_events',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          const newEvent = payload.new;

          // Apply client-side filter
          if (filter !== 'all' && !newEvent.event_type?.startsWith(`${filter}.`)) return;

          // Fetch the actor's name
          let withActor = newEvent;
          if (newEvent.actor_id) {
            const { data: actor } = await supabase
              .from('profiles')
              .select('full_name, first_name, last_name, avatar_url')
              .eq('id', newEvent.actor_id)
              .single();
            if (actor) withActor = { ...newEvent, profiles: actor };
          }

          setEvents(prev => [withActor, ...prev].slice(0, compact ? 25 : 60));
          setNewEventIds(prev => new Set([...prev, newEvent.id]));

          // Remove the "new" highlight after 3s (per-event timeout so multiple rapid events each clear independently)
          setTimeout(() => {
            setNewEventIds(prev => { const s = new Set(prev); s.delete(newEvent.id); return s; });
          }, 3000);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, filter, compact]);

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-apptivia-carbon-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-apptivia-ink" />
            <span className="text-sm font-semibold text-apptivia-ink">Activity Feed</span>
          </div>
          <button onClick={fetchEvents} className="p-1 hover:bg-apptivia-carbon-100 rounded transition-colors">
            <RefreshCw size={13} className="text-apptivia-carbon-400" />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-gray-50" style={{ maxHeight }}>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-apptivia-carbon-400">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-apptivia-carbon-400 text-xs">No activity yet.</div>
          ) : (
            events.map(e => <EventItem key={e.id} event={e} isNew={newEventIds.has(e.id)} />)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-apptivia-carbon-400 flex-shrink-0" />
        {EVENT_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-apptivia-ink text-white'
                : 'bg-white border border-apptivia-carbon-200 text-apptivia-carbon-600 hover:border-apptivia-carbon-300 hover:text-apptivia-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchEvents}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-apptivia-carbon-200 text-apptivia-carbon-600 hover:border-apptivia-carbon-300 hover:text-apptivia-ink transition-colors"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Feed */}
      <div className="bg-white rounded-xl border border-apptivia-carbon-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-apptivia-carbon-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            <span className="text-sm">Loading activity…</span>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Activity size={36} className="mx-auto mb-3 text-apptivia-carbon-300" />
            <p className="text-sm text-apptivia-carbon-500 font-medium">No activity yet</p>
            <p className="text-xs text-apptivia-carbon-400 mt-1">Events appear here as your team works deals, logs calls, and earns badges.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 600 }}>
            {events.map(e => <EventItem key={e.id} event={e} isNew={newEventIds.has(e.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
