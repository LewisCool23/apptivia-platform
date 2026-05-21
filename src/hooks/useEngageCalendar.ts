/**
 * useEngageCalendar — Hook for the Engage Calendar tab.
 * Aggregates calendar events across all connected calendar integrations,
 * handles domain-based account matching, outcome logging, and prep cards.
 */

import { useState, useCallback, useMemo } from 'react';
import { backendFetch } from '../utils/backendFetch';

export interface CalendarEvent {
  id: string;
  integration_id: string;
  organization_id: string;
  profile_id: string | null;
  external_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  attendees: Array<{ email?: string; name?: string; status?: string }>;
  is_all_day: boolean;
  organizer_email: string | null;
  event_type: string;
  external_link: string | null;
  synced_at: string;
  // outcome columns
  meeting_outcome: string | null;
  meeting_notes: string | null;
  outcome_logged_at: string | null;
  linked_account_id: string | null;
  linked_company_id: string | null;
  linked_deal_id: string | null;
}

export interface CalendarIntegration {
  id: string;
  integration_type: string;
  display_name: string;
}

export interface DomainMatchAccount {
  id: string;
  account_name: string;
  domain: string;
  tier: string;
  account_score: number;
}

export interface DomainMatchCompany {
  id: string;
  name: string;
  domain: string;
  logo_url: string | null;
  industry: string | null;
}

interface DomainMatches {
  accounts: DomainMatchAccount[];
  companies: DomainMatchCompany[];
}

export interface PrepCard {
  id: string;
  calendar_event_id: string;
  card_json: any;
  meeting_title: string;
  meeting_start_at: string;
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'live.com', 'msn.com', 'protonmail.com', 'mail.com',
  'zoho.com', 'yandex.com', 'gmx.com',
]);

function extractDomains(events: CalendarEvent[]): string[] {
  const domainSet = new Set<string>();
  for (const evt of events) {
    for (const att of (evt.attendees || [])) {
      if (att.email) {
        const domain = att.email.split('@')[1]?.toLowerCase();
        if (domain && !PERSONAL_DOMAINS.has(domain)) domainSet.add(domain);
      }
    }
  }
  return Array.from(domainSet);
}

export function useEngageCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calIntegrations, setCalIntegrations] = useState<CalendarIntegration[]>([]);
  const [domainMatches, setDomainMatches] = useState<DomainMatches>({ accounts: [], companies: [] });
  const [prepCards, setPrepCards] = useState<PrepCard[]>([]);
  const [loading, setLoading] = useState(true); // start true for initial load
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (startDate: string, endDate: string) => {
    if (!initialLoaded) setLoading(true); // only show spinner on first load
    setError(null);
    try {
      const data = await backendFetch<{ ok: boolean; events: CalendarEvent[]; integrations: CalendarIntegration[] }>(
        `/api/calendar/my-events?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
        undefined,
        'GET'
      );
      setEvents(data.events || []);
      setCalIntegrations(data.integrations || []);

      // Extract unique attendee domains for account matching
      const domains = extractDomains(data.events || []);
      if (domains.length > 0) {
        try {
          const matches = await backendFetch<{ ok: boolean; accounts: DomainMatchAccount[]; companies: DomainMatchCompany[] }>(
            '/api/calendar/domain-matches',
            { domains }
          );
          setDomainMatches({ accounts: matches.accounts || [], companies: matches.companies || [] });
        } catch {
          // Domain matching is optional — don't block calendar render
        }
      } else {
        setDomainMatches({ accounts: [], companies: [] });
      }
    } catch (err: any) {
      setError(err.message);
      setEvents([]);
      setCalIntegrations([]);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [initialLoaded]);

  const loadPrepCards = useCallback(async () => {
    try {
      const data = await backendFetch<{ cards: PrepCard[] }>('/api/aaron/prep-cards', undefined, 'GET');
      setPrepCards(data.cards || []);
    } catch {
      // Prep cards are an optional enhancement
    }
  }, []);

  const logOutcome = useCallback(async (eventId: string, outcome: string, notes?: string) => {
    await backendFetch(`/api/calendar/events/${eventId}/outcome`, {
      meeting_outcome: outcome,
      meeting_notes: notes || null,
    });
    // Optimistic update
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, meeting_outcome: outcome, meeting_notes: notes || null, outcome_logged_at: new Date().toISOString() }
        : e
    ));
  }, []);

  const linkAccount = useCallback(async (eventId: string, accountId: string, companyId?: string) => {
    await backendFetch(`/api/calendar/events/${eventId}/link-account`, {
      account_id: accountId,
      company_id: companyId || null,
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, linked_account_id: accountId, linked_company_id: companyId || null }
        : e
    ));
  }, []);

  const linkDeal = useCallback(async (eventId: string, dealId: string | null) => {
    await backendFetch(`/api/calendar/events/${eventId}/link-deal`, {
      deal_id: dealId,
    });
    setEvents(prev => prev.map(e =>
      e.id === eventId
        ? { ...e, linked_deal_id: dealId }
        : e
    ));
  }, []);

  // Today's events
  const todayEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    return events
      .filter(e => {
        const start = new Date(e.start_time);
        return start >= todayStart && start < todayEnd;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events]);

  // Past meetings without outcome logged
  const needsOutcome = useMemo(() => {
    const now = new Date();
    return events.filter(e =>
      new Date(e.end_time) < now && !e.meeting_outcome && !e.is_all_day
    );
  }, [events]);

  // Build domain→account lookup for quick access
  const domainAccountMap = useMemo(() => {
    const map: Record<string, DomainMatchAccount> = {};
    for (const acct of domainMatches.accounts) {
      if (acct.domain) map[acct.domain.toLowerCase()] = acct;
    }
    return map;
  }, [domainMatches.accounts]);

  const domainCompanyMap = useMemo(() => {
    const map: Record<string, DomainMatchCompany> = {};
    for (const co of domainMatches.companies) {
      if (co.domain) map[co.domain.toLowerCase()] = co;
    }
    return map;
  }, [domainMatches.companies]);

  const isConnected = calIntegrations.length > 0;

  return {
    events,
    calIntegrations,
    domainMatches,
    domainAccountMap,
    domainCompanyMap,
    prepCards,
    todayEvents,
    needsOutcome,
    loading,
    error,
    isConnected,
    loadEvents,
    loadPrepCards,
    logOutcome,
    linkAccount,
    linkDeal,
  };
}
