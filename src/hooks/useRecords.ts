/**
 * useRecords — React hook for fetching activity records by type with filters.
 *
 * Queries Supabase directly for meetings, calls, emails, deals, and contacts.
 * Computes summary stats per record type and provides CSV export.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ── Types ──────────────────────────────────────────────────

export type RecordType = 'meetings' | 'calls' | 'emails' | 'deals' | 'contacts';

export interface RecordsFilters {
  recordType: RecordType;
  dateStart: string;
  dateEnd: string;
  repId?: string;
  search?: string;
  status?: string;
}

export interface RecordStats {
  [key: string]: string | number;
}

interface MeetingStats {
  total: number;
  completed: number;
  noShows: number;
  avgPerWeek: number;
}

interface CallStats {
  total: number;
  avgDuration: number;
  totalTalkTime: number;
  outbound: number;
}

interface EmailStats {
  total: number;
  avgPerWeek: number;
}

interface DealStats {
  totalValue: number;
  weightedValue: number;
  avgDealSize: number;
  count: number;
}

interface ContactStats {
  total: number;
  qualified: number;
  avgFitScore: number;
  newThisPeriod: number;
}

export type AllStats = MeetingStats | CallStats | EmailStats | DealStats | ContactStats;

// ── Hook ───────────────────────────────────────────────────

export function useRecords(organizationId: string | undefined) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AllStats | null>(null);
  const lastFiltersRef = useRef<RecordsFilters | null>(null);

  // ── Compute stats from loaded records ─────────────────

  function computeStats(type: RecordType, rows: any[], dateStart: string, dateEnd: string): AllStats {
    const start = new Date(dateStart).getTime();
    const end = new Date(dateEnd).getTime();
    const weeks = Math.max(1, (end - start) / (7 * 24 * 60 * 60 * 1000));

    switch (type) {
      case 'meetings': {
        const total = rows.length;
        const completed = rows.filter(r => r.meeting_outcome === 'completed').length;
        const noShows = rows.filter(r => r.meeting_outcome === 'no_show').length;
        const avgPerWeek = Math.round((total / weeks) * 10) / 10;
        return { total, completed, noShows, avgPerWeek } as MeetingStats;
      }
      case 'calls': {
        const total = rows.length;
        const durations = rows.map(r => r.duration_minutes || 0);
        const totalTalkTime = durations.reduce((s: number, d: number) => s + d, 0);
        const avgDuration = total > 0 ? Math.round((totalTalkTime / total) * 10) / 10 : 0;
        const outbound = rows.filter(r => r.call_direction === 'outbound').length;
        return { total, avgDuration, totalTalkTime, outbound } as CallStats;
      }
      case 'emails': {
        const total = rows.length;
        const avgPerWeek = Math.round((total / weeks) * 10) / 10;
        return { total, avgPerWeek } as EmailStats;
      }
      case 'deals': {
        const count = rows.length;
        const totalValue = rows.reduce((s: number, r: any) => s + (r.deal_value || 0), 0);
        const weightedValue = rows.reduce(
          (s: number, r: any) => s + ((r.deal_value || 0) * (r.probability || 0)) / 100,
          0
        );
        const avgDealSize = count > 0 ? Math.round(totalValue / count) : 0;
        return { totalValue, weightedValue, avgDealSize, count } as DealStats;
      }
      case 'contacts': {
        const total = rows.length;
        const qualified = rows.filter(r => r.status === 'qualified').length;
        const fitScores = rows.map(r => r.fit_score).filter((s: any) => s != null && s > 0);
        const avgFitScore =
          fitScores.length > 0
            ? Math.round(fitScores.reduce((s: number, v: number) => s + v, 0) / fitScores.length)
            : 0;
        // newThisPeriod: contacts created within the selected date range
        // (since the query already filters by dateStart/dateEnd, all rows are "this period")
        const periodStart = new Date(dateStart).getTime();
        const newThisPeriod = rows.filter(r => {
          const created = r.created_at ? new Date(r.created_at).getTime() : 0;
          return created >= periodStart;
        }).length;
        return { total, qualified, avgFitScore, newThisPeriod } as ContactStats;
      }
      default:
        return { total: 0 } as any;
    }
  }

  // ── Load records ──────────────────────────────────────

  const loadRecords = useCallback(
    async (filters: RecordsFilters) => {
      if (!organizationId) return;
      lastFiltersRef.current = filters;
      setLoading(true);
      setError(null);

      try {
        let data: any[] = [];

        switch (filters.recordType) {
          case 'meetings': {
            let q = supabase
              .from('integration_calendar_events')
              .select(
                'id, title, start_time, end_time, attendees, meeting_outcome, meeting_notes, linked_account_id, event_type, is_all_day, location'
              )
              .eq('organization_id', organizationId)
              .gte('start_time', filters.dateStart)
              .lte('start_time', filters.dateEnd)
              .order('start_time', { ascending: false });

            if (filters.repId) q = q.eq('profile_id', filters.repId);
            if (filters.status === '__null__') {
              q = q.is('meeting_outcome', null);
            } else if (filters.status) {
              q = q.eq('meeting_outcome', filters.status);
            }
            if (filters.search) q = q.ilike('title', `%${filters.search}%`);

            const { data: rows, error: err } = await q;
            if (err) throw err;
            data = rows || [];
            break;
          }

          case 'calls': {
            let q = supabase
              .from('crm_activity_records')
              .select('id, subject, contact_name, activity_date, duration_seconds, direction, status, source, recording_url, notes')
              .eq('organization_id', organizationId)
              .eq('activity_type', 'call')
              .gte('activity_date', filters.dateStart)
              .lte('activity_date', filters.dateEnd)
              .order('activity_date', { ascending: false });

            if (filters.repId) q = q.eq('profile_id', filters.repId);
            if (filters.search) q = q.or(`contact_name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);

            const { data: rows, error: err } = await q;
            if (err) throw err;
            // Map fields for display compatibility with existing columns/stats
            data = (rows || []).map((r: any) => ({
              ...r,
              call_date: r.activity_date,
              duration_minutes: r.duration_seconds ? Math.round(r.duration_seconds / 60 * 10) / 10 : null,
              call_direction: r.direction,
            }));
            break;
          }

          case 'emails': {
            let q = supabase
              .from('crm_activity_records')
              .select('id, subject, contact_name, contact_email, activity_date, direction, status, source, notes')
              .eq('organization_id', organizationId)
              .eq('activity_type', 'email')
              .gte('activity_date', filters.dateStart)
              .lte('activity_date', filters.dateEnd)
              .order('activity_date', { ascending: false });

            if (filters.search) {
              q = q.or(`subject.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%`);
            }

            const { data: rows, error: err } = await q;
            if (err) throw err;
            // Map fields for display compatibility
            data = (rows || []).map((r: any) => ({
              ...r,
              to_name: r.contact_name || '',
              to_email: r.contact_email || '',
              channel: r.source,
              created_at: r.activity_date,
            }));
            break;
          }

          case 'deals': {
            let q = supabase
              .from('engage_pipeline_deals')
              .select(
                'id, deal_name, deal_value, stage, probability, close_date, forecast_category, owner_id, source, created_at'
              )
              .eq('organization_id', organizationId)
              .gte('created_at', filters.dateStart)
              .lte('created_at', filters.dateEnd)
              .order('created_at', { ascending: false });

            if (filters.repId) q = q.eq('owner_id', filters.repId);
            if (filters.status) q = q.eq('stage', filters.status);
            if (filters.search) q = q.ilike('deal_name', `%${filters.search}%`);

            const { data: rows, error: err } = await q;
            if (err) throw err;
            data = rows || [];
            break;
          }

          case 'contacts': {
            let q = supabase
              .from('engage_prospects')
              .select(
                'id, full_name, first_name, last_name, email, phone, title, company_name, status, fit_score, intent_score, created_at'
              )
              .eq('organization_id', organizationId)
              .gte('created_at', filters.dateStart)
              .lte('created_at', filters.dateEnd)
              .order('created_at', { ascending: false });

            if (filters.status) q = q.eq('status', filters.status);
            if (filters.search) {
              q = q.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
            }

            const { data: rows, error: err } = await q;
            if (err) throw err;
            data = rows || [];
            break;
          }
        }

        setRecords(data);
        setStats(computeStats(filters.recordType, data, filters.dateStart, filters.dateEnd));
      } catch (err: any) {
        console.error('[useRecords] Error loading records:', err);
        setError(err.message || 'Failed to load records');
        setRecords([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  // ── Export CSV ────────────────────────────────────────

  const exportCsv = useCallback(() => {
    if (!records.length || !lastFiltersRef.current) return;

    const type = lastFiltersRef.current.recordType;

    // Define columns per record type
    const columnMap: Record<RecordType, { key: string; header: string }[]> = {
      meetings: [
        { key: 'title', header: 'Title' },
        { key: 'start_time', header: 'Start Time' },
        { key: 'end_time', header: 'End Time' },
        { key: 'attendees', header: 'Attendees' },
        { key: 'meeting_outcome', header: 'Outcome' },
        { key: 'event_type', header: 'Event Type' },
        { key: 'location', header: 'Location' },
        { key: 'meeting_notes', header: 'Notes' },
      ],
      calls: [
        { key: 'contact_name', header: 'Contact' },
        { key: 'subject', header: 'Subject' },
        { key: 'call_date', header: 'Date' },
        { key: 'duration_minutes', header: 'Duration (min)' },
        { key: 'call_direction', header: 'Direction' },
        { key: 'source', header: 'Source' },
        { key: 'recording_url', header: 'Recording URL' },
        { key: 'notes', header: 'Notes' },
      ],
      emails: [
        { key: 'subject', header: 'Subject' },
        { key: 'to_name', header: 'To Name' },
        { key: 'to_email', header: 'To Email' },
        { key: 'channel', header: 'Source' },
        { key: 'created_at', header: 'Date' },
      ],
      deals: [
        { key: 'deal_name', header: 'Deal Name' },
        { key: 'deal_value', header: 'Value' },
        { key: 'stage', header: 'Stage' },
        { key: 'probability', header: 'Probability (%)' },
        { key: 'close_date', header: 'Close Date' },
        { key: 'forecast_category', header: 'Forecast' },
        { key: 'source', header: 'Source' },
        { key: 'created_at', header: 'Created' },
      ],
      contacts: [
        { key: 'full_name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'title', header: 'Title' },
        { key: 'company_name', header: 'Company' },
        { key: 'status', header: 'Status' },
        { key: 'fit_score', header: 'Fit Score' },
        { key: 'intent_score', header: 'Intent Score' },
        { key: 'created_at', header: 'Created' },
      ],
    };

    const columns = columnMap[type];
    const headerRow = columns.map(c => c.header).join(',');

    const csvRows = records.map(record => {
      return columns
        .map(col => {
          let val = record[col.key];
          if (val == null) return '';
          if (typeof val === 'object') val = JSON.stringify(val);
          // Escape commas and quotes in CSV
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str}"`
            : str;
        })
        .join(',');
    });

    const csv = [headerRow, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}_records_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [records]);

  return { records, loading, error, stats, loadRecords, exportCsv };
}
