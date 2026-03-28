/**
 * useCalendarEvents — Hook for managing synced calendar events.
 */

import { useState, useCallback } from 'react';
import { backendFetch } from '../utils/backendFetch';

export interface CalendarEvent {
  id: string;
  integration_id: string;
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
}

interface CreateEventData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: Array<{ email: string; name?: string }>;
  organizerEmail?: string;
}

export function useCalendarEvents(integrationId: string | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (startDate: string, endDate: string) => {
    if (!integrationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await backendFetch<{ events: CalendarEvent[] }>(
        `/api/integrations/${integrationId}/calendar/events?start=${startDate}&end=${endDate}`,
        undefined,
        'GET'
      );
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [integrationId]);

  const createEvent = useCallback(async (eventData: CreateEventData) => {
    if (!integrationId) throw new Error('No integration selected');
    setError(null);
    try {
      const result = await backendFetch(
        `/api/integrations/${integrationId}/calendar/events`,
        eventData
      );
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [integrationId]);

  return { events, loading, error, loadEvents, createEvent };
}
