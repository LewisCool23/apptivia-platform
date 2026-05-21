import { useState, useEffect, useCallback, useRef } from 'react';
import { backendFetch } from '../utils/backendFetch';
import { supabase } from '../supabaseClient';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Deal {
  id: string;
  [key: string]: any;
}

interface Contact {
  id: string;
  prospect_id?: string;
  full_name?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

interface Meeting {
  id: string;
  title?: string;
  start_time?: string;
  [key: string]: any;
}

interface Call {
  id: string;
  contact_name?: string;
  duration_minutes?: number;
  notes?: string;
  call_direction?: string;
  [key: string]: any;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  priority?: string;
  [key: string]: any;
}

interface Activity {
  id: string;
  title?: string;
  description?: string;
  [key: string]: any;
}

interface AccountResult {
  id: string;
  account_name: string;
  domain?: string;
  tier?: string;
}

interface ContactResult {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  company_name?: string;
}

interface MeetingResult {
  id: string;
  title?: string;
  [key: string]: any;
}

interface CreateTaskData {
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  priority?: string;
}

interface LogCallData {
  contact_name: string;
  duration_minutes: number;
  notes?: string;
  call_direction?: string;
}

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useActiveDeal(dealId: string | null) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current dealId so stale responses don't overwrite state
  const activeDealRef = useRef(dealId);
  activeDealRef.current = dealId;

  /* ── Load everything at once ──────────────────────────────────────────── */

  const loadAll = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await backendFetch<{
        deal: Deal;
        contacts: Contact[];
        meetings: Meeting[];
        calls: Call[];
        tasks: Task[];
        activities: Activity[];
      }>(`/api/deals/${dealId}/full`, undefined, 'GET');

      // Only apply if this deal is still the active one
      if (activeDealRef.current !== dealId) return;

      setDeal(res.deal ?? null);
      setContacts(res.contacts ?? []);
      setMeetings(res.meetings ?? []);
      setCalls(res.calls ?? []);
      setTasks(res.tasks ?? []);
      setActivities(res.activities ?? []);
    } catch (err: any) {
      if (activeDealRef.current === dealId) {
        setError(err.message || 'Failed to load deal');
      }
    } finally {
      if (activeDealRef.current === dealId) {
        setLoading(false);
      }
    }
  }, [dealId]);

  /* ── Reload when dealId changes ───────────────────────────────────────── */

  useEffect(() => {
    if (dealId) {
      loadAll();
    } else {
      // Clear state when no deal is selected
      setDeal(null);
      setActivities([]);
      setTasks([]);
      setContacts([]);
      setMeetings([]);
      setCalls([]);
      setError(null);
    }
  }, [dealId, loadAll]);

  /* ── Mutation helpers ─────────────────────────────────────────────────── */

  const updateDeal = useCallback(
    async (fields: object) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}`, fields as Record<string, any>, 'PUT');
      await loadAll();
    },
    [dealId, loadAll],
  );

  const addNote = useCallback(
    async (title: string, description?: string) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/activities`, { title, description });
      await loadAll();
    },
    [dealId, loadAll],
  );

  const linkContact = useCallback(
    async (prospectId: string, role?: string) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/contacts`, { prospect_id: prospectId, role });
      await loadAll();
    },
    [dealId, loadAll],
  );

  const unlinkContact = useCallback(
    async (prospectId: string) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/contacts/${prospectId}`, undefined, 'DELETE');
      await loadAll();
    },
    [dealId, loadAll],
  );

  const linkMeeting = useCallback(
    async (calendarEventId: string) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/meetings`, { calendar_event_id: calendarEventId });
      await loadAll();
    },
    [dealId, loadAll],
  );

  const createTask = useCallback(
    async (data: CreateTaskData) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/tasks`, data as Record<string, any>);
      await loadAll();
    },
    [dealId, loadAll],
  );

  const updateTask = useCallback(
    async (taskId: string, data: object) => {
      if (!dealId) return;
      await backendFetch(
        `/api/deals/${dealId}/tasks/${taskId}`,
        data as Record<string, any>,
        'PUT',
      );
      await loadAll();
    },
    [dealId, loadAll],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/tasks/${taskId}`, undefined, 'DELETE');
      await loadAll();
    },
    [dealId, loadAll],
  );

  const logCall = useCallback(
    async (data: LogCallData) => {
      if (!dealId) return;
      await backendFetch(`/api/deals/${dealId}/calls`, data as Record<string, any>);
      await loadAll();
    },
    [dealId, loadAll],
  );

  /* ── Search helpers (direct Supabase queries) ─────────────────────────── */

  const searchAccounts = useCallback(async (query: string): Promise<AccountResult[]> => {
    const { data, error: err } = await supabase
      .from('engage_accounts')
      .select('id, account_name, domain, tier')
      .ilike('account_name', `%${query}%`)
      .limit(5);
    if (err) throw new Error(err.message);
    return (data ?? []) as AccountResult[];
  }, []);

  const searchContacts = useCallback(async (query: string): Promise<ContactResult[]> => {
    const { data, error: err } = await supabase
      .from('engage_prospects')
      .select('id, full_name, first_name, last_name, email, phone, title, company_name')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    if (err) throw new Error(err.message);
    return (data ?? []) as ContactResult[];
  }, []);

  const searchMeetings = useCallback(async (query: string): Promise<MeetingResult[]> => {
    const { data, error: err } = await supabase
      .from('integration_calendar_events')
      .select('*')
      .ilike('title', `%${query}%`)
      .limit(10);
    if (err) throw new Error(err.message);
    return (data ?? []) as MeetingResult[];
  }, []);

  /* ── Return ───────────────────────────────────────────────────────────── */

  return {
    // State
    deal,
    activities,
    tasks,
    contacts,
    meetings,
    calls,
    loading,
    error,

    // Actions
    loadAll,
    updateDeal,
    addNote,
    linkContact,
    unlinkContact,
    linkMeeting,
    createTask,
    updateTask,
    deleteTask,
    logCall,

    // Search
    searchAccounts,
    searchContacts,
    searchMeetings,
  };
}
