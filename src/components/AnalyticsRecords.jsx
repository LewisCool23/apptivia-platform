/**
 * AnalyticsRecords — Records tab for the Analytics page.
 *
 * Displays meetings, calls, emails, deals, and contacts in a filterable,
 * sortable table with summary stat cards and CSV export.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Phone, Mail, DollarSign, UserPlus,
  Search, Download, ChevronUp, ChevronDown, Loader2, FileX,
} from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { prettifyKpiKey } from '../constants/kpiGuidance';

// ── Constants ──────────────────────────────────────────────

const RECORD_TYPES = [
  { key: 'meetings',  label: 'Meetings',  icon: Calendar },
  { key: 'calls',     label: 'Calls',     icon: Phone },
  { key: 'emails',    label: 'Emails',    icon: Mail },
  { key: 'deals',     label: 'Deals',     icon: DollarSign },
  { key: 'contacts',  label: 'Contacts',  icon: UserPlus },
];

const STATUS_OPTIONS = {
  meetings: ['All', 'Completed', 'No Show', 'Cancelled', 'Pending'],
  calls:    [],
  emails:   [],
  deals:    ['All', 'Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
  contacts: ['All', 'New', 'Qualified', 'Nurture', 'Disqualified'],
};

/** Maps display status labels to DB values for the query filter */
const STATUS_VALUE_MAP = {
  meetings: {
    Completed: 'completed',
    'No Show': 'no_show',
    Cancelled: 'cancelled',
    Pending: '__null__',
  },
  deals: {
    Discovery: 'discovery',
    Qualification: 'qualification',
    Proposal: 'proposal',
    Negotiation: 'negotiation',
    'Closed Won': 'closed_won',
    'Closed Lost': 'closed_lost',
  },
  contacts: {
    New: 'new',
    Qualified: 'qualified',
    Nurture: 'nurture',
    Disqualified: 'disqualified',
  },
};

const COLUMNS = {
  meetings: [
    { key: 'title',           label: 'Title' },
    { key: 'start_time',      label: 'Start Time',  format: 'datetime' },
    { key: 'end_time',        label: 'End Time',     format: 'datetime' },
    { key: 'attendees',       label: 'Attendees',    format: 'attendees' },
    { key: 'meeting_outcome', label: 'Outcome',      format: 'badge' },
    { key: 'event_type',      label: 'Type',         format: 'badge' },
    { key: 'location',        label: 'Location' },
  ],
  calls: [
    { key: 'contact_name',     label: 'Contact' },
    { key: 'subject',          label: 'Subject' },
    { key: 'call_date',        label: 'Date',       format: 'date' },
    { key: 'duration_minutes', label: 'Duration',   format: 'duration' },
    { key: 'call_direction',   label: 'Direction',  format: 'badge' },
    { key: 'source',           label: 'Source',      format: 'source_badge' },
    { key: 'recording_url',    label: 'Recording',  format: 'recording_link' },
    { key: 'notes',            label: 'Notes',      format: 'truncate' },
  ],
  emails: [
    { key: 'subject',    label: 'Subject' },
    { key: 'to_name',    label: 'To Name' },
    { key: 'to_email',   label: 'To Email' },
    { key: 'channel',    label: 'Source',    format: 'source_badge' },
    { key: 'created_at', label: 'Date',      format: 'date' },
  ],
  deals: [
    { key: 'deal_name',         label: 'Deal Name' },
    { key: 'deal_value',        label: 'Value',       format: 'currency' },
    { key: 'stage',             label: 'Stage',       format: 'badge' },
    { key: 'probability',       label: 'Probability', format: 'percent' },
    { key: 'close_date',        label: 'Close Date',  format: 'date' },
    { key: 'forecast_category', label: 'Forecast',    format: 'badge' },
    { key: 'source',            label: 'Source' },
    { key: 'created_at',        label: 'Created',     format: 'date' },
  ],
  contacts: [
    { key: 'full_name',    label: 'Name' },
    { key: 'email',        label: 'Email' },
    { key: 'phone',        label: 'Phone' },
    { key: 'title',        label: 'Title' },
    { key: 'company_name', label: 'Company' },
    { key: 'status',       label: 'Status',       format: 'badge' },
    { key: 'fit_score',    label: 'Fit Score',     format: 'score' },
    { key: 'intent_score', label: 'Intent Score',  format: 'score' },
    { key: 'created_at',   label: 'Created',       format: 'date' },
  ],
};

const STAT_CARDS = {
  meetings: [
    { key: 'total',      label: 'Total Meetings' },
    { key: 'completed',  label: 'Completed' },
    { key: 'noShows',    label: 'No-Shows' },
    { key: 'avgPerWeek', label: 'Avg / Week' },
  ],
  calls: [
    { key: 'total',         label: 'Total Calls' },
    { key: 'avgDuration',   label: 'Avg Duration (min)' },
    { key: 'totalTalkTime', label: 'Total Talk Time (min)' },
    { key: 'outbound',      label: 'Outbound' },
  ],
  emails: [
    { key: 'total',      label: 'Total Sent' },
    { key: 'avgPerWeek', label: 'Avg / Week' },
  ],
  deals: [
    { key: 'count',         label: 'Count' },
    { key: 'totalValue',    label: 'Total Value',    format: 'currency' },
    { key: 'weightedValue', label: 'Weighted Value',  format: 'currency' },
    { key: 'avgDealSize',   label: 'Avg Deal Size',   format: 'currency' },
  ],
  contacts: [
    { key: 'total',         label: 'Total' },
    { key: 'qualified',     label: 'Qualified' },
    { key: 'avgFitScore',   label: 'Avg Fit Score' },
    { key: 'newThisPeriod', label: 'New This Period' },
  ],
};

// ── Format helpers ─────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatCurrency(num) {
  if (num == null || isNaN(num)) return '--';
  return '$' + Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDuration(min) {
  if (min == null || isNaN(min)) return '--';
  const m = Number(min);
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatAttendees(val) {
  if (!val) return '--';
  if (Array.isArray(val)) return val.length > 0 ? String(val.length) : '--';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  return '--';
}

function truncateStr(str, max = 60) {
  if (!str) return '--';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function humanizeSnake(str) {
  if (!str) return '--';
  return prettifyKpiKey(String(str));
}

// ── Badge colors (no purple/blue — brand compliant) ────────

function badgeClasses(value) {
  const v = (value || '').toLowerCase().replace(/\s+/g, '_');
  switch (v) {
    case 'completed':
    case 'closed_won':
    case 'qualified':
      return 'bg-emerald-100 text-emerald-700';
    case 'no_show':
    case 'closed_lost':
    case 'disqualified':
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    case 'negotiation':
    case 'nurture':
      return 'bg-amber-100 text-amber-700';
    case 'pending':
    case 'new':
    case 'discovery':
    case 'outbound':
    case 'proposal':
    case 'qualification':
      return 'bg-apptivia-coral-tone-50 text-apptivia-coral-tone-700';
    case 'inbound':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-apptivia-carbon-100 text-apptivia-carbon-600';
  }
}

// ── Source badge colors ─────────────────────────────────────

function sourceBadgeClasses(source) {
  switch ((source || '').toLowerCase()) {
    case 'salesforce': return 'bg-blue-100 text-blue-700';
    case 'hubspot':    return 'bg-orange-100 text-orange-700';
    case 'gong':       return 'bg-violet-100 text-violet-700';
    case 'apollo':     return 'bg-cyan-100 text-cyan-700';
    case 'outreach':   return 'bg-teal-100 text-teal-700';
    case 'salesloft':  return 'bg-indigo-100 text-indigo-700';
    case 'apptivia':   return 'bg-apptivia-coral-tone-50 text-apptivia-coral-tone-700';
    default:           return 'bg-apptivia-carbon-100 text-apptivia-carbon-600';
  }
}

function formatSourceLabel(source) {
  const labels = {
    salesforce: 'Salesforce', hubspot: 'HubSpot', gong: 'Gong',
    apollo: 'Apollo', outreach: 'Outreach', salesloft: 'SalesLoft', apptivia: 'Apptivia',
  };
  return labels[(source || '').toLowerCase()] || source || '--';
}

// ── Cell renderer ──────────────────────────────────────────

function renderCell(value, format) {
  switch (format) {
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    case 'currency':
      return formatCurrency(value);
    case 'duration':
      return formatDuration(value);
    case 'percent':
      return value != null ? `${value}%` : '--';
    case 'attendees':
      return formatAttendees(value);
    case 'truncate':
      return truncateStr(value);
    case 'score':
      if (value == null || value === 0) return '--';
      return <span className="font-semibold">{value}</span>;
    case 'badge':
      if (!value) return <span className="text-apptivia-carbon-400">--</span>;
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeClasses(value)}`}>
          {humanizeSnake(value)}
        </span>
      );
    case 'source_badge':
      if (!value) return <span className="text-apptivia-carbon-400">--</span>;
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceBadgeClasses(value)}`}>
          {formatSourceLabel(value)}
        </span>
      );
    case 'recording_link':
      if (!value) return <span className="text-apptivia-carbon-400">--</span>;
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-apptivia-coral hover:text-apptivia-coral-tone-700 underline text-[10px] font-semibold"
        >
          Play ▶
        </a>
      );
    default:
      if (value == null) return '--';
      if (typeof value === 'string' && value.length > 80) return truncateStr(value, 80);
      return String(value);
  }
}

// ── Component ──────────────────────────────────────────────

export default function AnalyticsRecords({
  organizationId,
  dateRange,
  isManager,
  reps,
  // Backwards-compatible aliases from Analytics.jsx usage
  isAdmin,
  teamMembers,
}) {
  const { records, loading, error, stats, loadRecords, exportCsv } = useRecords(organizationId);

  // Normalize props — accept both old and new prop names
  const showRepFilter = isManager || isAdmin;
  const repList = reps || teamMembers || [];

  // ── Local state ──────────────────────────────────────────
  const [activeType, setActiveType] = useState('meetings');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRep, setSelectedRep] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  const debounceRef = useRef(null);
  const debouncedSearchRef = useRef('');

  // ── Debounced search (300ms) ─────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debouncedSearchRef.current = searchQuery;
      triggerLoad(activeType, searchQuery, selectedRep, selectedStatus);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Load on filter change (non-search) ───────────────────
  useEffect(() => {
    triggerLoad(activeType, debouncedSearchRef.current, selectedRep, selectedStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, dateRange?.start, dateRange?.end, selectedRep, selectedStatus, organizationId]);

  function triggerLoad(type, search, repId, status) {
    if (!organizationId || !dateRange?.start || !dateRange?.end) return;

    const statusMap = STATUS_VALUE_MAP[type] || {};
    const dbStatus = status && status !== 'All' ? (statusMap[status] || status) : undefined;

    loadRecords({
      recordType: type,
      dateStart: dateRange.start,
      dateEnd: dateRange.end,
      repId: repId || undefined,
      search: search || undefined,
      status: dbStatus,
    });
  }

  // ── Reset secondary filters on type change ───────────────
  function handleTypeChange(type) {
    setActiveType(type);
    setSelectedStatus('');
    setSearchQuery('');
    debouncedSearchRef.current = '';
    setSortColumn('');
    setSortDirection('asc');
  }

  // ── Sort toggle ──────────────────────────────────────────
  function handleSort(colKey) {
    if (sortColumn === colKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  }

  // ── Client-side sort ─────────────────────────────────────
  const sortedRecords = useMemo(() => {
    if (!sortColumn || !records.length) return records;

    return [...records].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Null handling — push nulls to bottom
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Date detection for string columns
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (
          !isNaN(aDate.getTime()) && !isNaN(bDate.getTime()) &&
          (aVal.includes('-') || aVal.includes('T'))
        ) {
          return sortDirection === 'asc'
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [records, sortColumn, sortDirection]);

  // ── Derived ──────────────────────────────────────────────
  const columns = COLUMNS[activeType] || [];
  const statCards = STAT_CARDS[activeType] || [];
  const statusOpts = STATUS_OPTIONS[activeType] || [];

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── 1. Record Type Pills ──────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {RECORD_TYPES.map(({ key, label, icon: Icon }) => {
          const active = activeType === key;
          return (
            <button
              key={key}
              onClick={() => handleTypeChange(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-apptivia-coral text-white shadow-sm'
                  : 'bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-paper'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── 2. Filters Bar ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-apptivia-carbon-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-apptivia-carbon-200 rounded-lg text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none transition-colors placeholder:text-apptivia-carbon-400"
          />
        </div>

        {/* Rep selector (manager/admin only) */}
        {showRepFilter && repList.length > 0 && (
          <select
            value={selectedRep}
            onChange={e => setSelectedRep(e.target.value)}
            className="border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none bg-white min-w-[140px]"
          >
            <option value="">All Reps</option>
            {repList.map(r => (
              <option key={r.id} value={r.id}>
                {r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.id}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        {statusOpts.length > 0 && (
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none bg-white min-w-[130px]"
          >
            {statusOpts.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        {/* Export CSV */}
        <button
          onClick={exportCsv}
          disabled={!records.length || loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-apptivia-ink text-white hover:bg-apptivia-carbon-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div className="bg-apptivia-error-bg border border-red-200 text-apptivia-error rounded-lg px-4 py-3 text-xs">
          {error}
        </div>
      )}

      {/* ── 3. Stats Row ──────────────────────────────────── */}
      {stats && statCards.length > 0 && (
        <div className={`grid gap-3 ${
          statCards.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
        }`}>
          {statCards.map(({ key, label, format }) => {
            const value = stats[key];
            let displayValue = value != null ? value : '--';
            if (format === 'currency' && value != null) {
              displayValue = formatCurrency(value);
            } else if (typeof displayValue === 'number') {
              displayValue = displayValue.toLocaleString('en-US');
            }

            return (
              <div key={key} className="bg-white rounded-lg border border-apptivia-carbon-100 p-4">
                <p className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p className="text-lg font-bold text-apptivia-ink apptivia-tabular">
                  {displayValue}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-apptivia-coral animate-spin" />
          <span className="ml-2 text-xs text-apptivia-carbon-500">Loading records...</span>
        </div>
      )}

      {/* ── 4. Sortable Table ─────────────────────────────── */}
      {!loading && (
        <div className="bg-white rounded-lg border border-apptivia-carbon-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-apptivia-paper border-b border-apptivia-carbon-100">
                  {columns.map(col => {
                    const isActive = sortColumn === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-3 py-2.5 text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider cursor-pointer select-none hover:text-apptivia-carbon-600 transition-colors whitespace-nowrap"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {isActive && (
                            sortDirection === 'asc'
                              ? <ChevronUp className="w-3 h-3 text-apptivia-coral" />
                              : <ChevronDown className="w-3 h-3 text-apptivia-coral" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-apptivia-carbon-100">
                {sortedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center">
                      <FileX className="w-8 h-8 text-apptivia-carbon-300 mx-auto mb-2" />
                      <p className="text-xs text-apptivia-carbon-400 font-medium">No records found</p>
                      <p className="text-[10px] text-apptivia-carbon-300 mt-0.5">
                        Try adjusting filters or date range
                      </p>
                    </td>
                  </tr>
                ) : (
                  sortedRecords.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-apptivia-paper transition-colors"
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className="px-3 py-2.5 text-xs text-apptivia-carbon-700 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis"
                        >
                          {renderCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Row count footer */}
          {sortedRecords.length > 0 && (
            <div className="px-3 py-2 border-t border-apptivia-carbon-100 bg-apptivia-paper">
              <p className="text-[10px] text-apptivia-carbon-400">
                {sortedRecords.length.toLocaleString()} record{sortedRecords.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
