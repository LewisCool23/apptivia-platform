/**
 * Shared date formatting utilities used across the platform.
 */

/** Human-readable relative time (e.g. "3m ago", "2h ago", "5d ago") */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) { const absDiff = Math.abs(diff); const mins = Math.floor(absDiff / 60000); if (mins < 60) return 'in ' + mins + 'm'; const hrs = Math.floor(mins / 60); if (hrs < 24) return 'in ' + hrs + 'h'; return 'in ' + Math.floor(hrs / 24) + 'd'; }
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Format ISO date to "Mar 16, 2026" style */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format date range: "Mar 1 – Mar 16, 2026" (same year) or "Dec 28, 2025 – Jan 4, 2026" */
export function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return '-';
  const start = new Date(startStr);
  const end = new Date(endStr);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const endFmt = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endFmt}`;
  }
  const startFmt = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

/**
 * Get Monday at midnight for a given date.
 * This is the SINGLE canonical implementation — all hooks/components should import this.
 * (X1 fix: replaces 5 duplicate getMonday implementations)
 */
export function getMonday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);          // normalize time FIRST to avoid DST edge cases
  const day = d.getDay();            // 0=Sun, 1=Mon … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Get Monday and Sunday bounding a given date (ISO date strings) */
export function getWeekBounds(date: Date = new Date()): { monday: string; sunday: string } {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Get the week range [monday, nextMonday) for a given date.
 * Uses exclusive end (nextMonday) for consistent >= / < queries.
 * (X4 fix: shared week range computation)
 */
export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = getMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

/**
 * Get the month range [firstMonday, firstMondayAfterMonth) for scorecard queries.
 * Aligns to Monday boundaries for consistency with weekly KPI data.
 * (H1 fix: uses Monday-aligned boundaries, no off-by-one)
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  // First day of the month → snap to its Monday (may be in previous month)
  const firstDay = new Date(year, month, 1);
  const start = getMonday(firstDay);
  // First day of NEXT month → snap to its Monday (exclusive end)
  const firstDayNext = new Date(year, month + 1, 1);
  const end = getMonday(firstDayNext);
  return { start, end };
}

/**
 * Get the quarter range [firstMonday, firstMondayAfterQuarter) for scorecard queries.
 * Aligns to Monday boundaries for consistency with weekly KPI data.
 * (H1 fix: uses Monday-aligned boundaries, no off-by-one)
 */
export function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;    // Q1→0, Q2→3, Q3→6, Q4→9
  const firstDay = new Date(year, startMonth, 1);
  const start = getMonday(firstDay);
  const firstDayNext = new Date(year, startMonth + 3, 1);
  const end = getMonday(firstDayNext);
  return { start, end };
}

/**
 * Given a date preset label (e.g. "This Week", "Last Month"), return
 * a human-readable date range string like "Mar 30 – Apr 5, 2026".
 * Used by Analytics and Scorecard to display the actual filtered dates.
 */
export function formatPresetDateRange(label: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mon = (d: Date) => { const m = getMonday(d); return m; };
  const sun = (m: Date) => { const s = new Date(m); s.setDate(m.getDate() + 6); return s; };
  const fmt = (s: Date, e: Date) => formatDateRange(s.toISOString(), e.toISOString());

  if (label === 'Today') return formatDate(today.toISOString());
  if (label === 'All Time') return 'All Time';

  if (label === 'This Week') { const m = mon(today); return fmt(m, sun(m)); }
  if (label === 'Last Week') {
    const m = new Date(mon(today)); m.setDate(m.getDate() - 7);
    return fmt(m, sun(m));
  }
  if (label.startsWith('Custom Week|')) {
    const m = new Date(label.split('|')[1] + 'T00:00:00');
    return fmt(getMonday(m), sun(getMonday(m)));
  }
  if (label === 'Custom Week') return '';

  if (label === 'This Month') {
    return fmt(new Date(today.getFullYear(), today.getMonth(), 1),
               new Date(today.getFullYear(), today.getMonth() + 1, 0));
  }
  if (label === 'Last Month') {
    return fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1),
               new Date(today.getFullYear(), today.getMonth(), 0));
  }
  if (label === 'This Quarter') {
    const q = Math.floor(today.getMonth() / 3);
    return fmt(new Date(today.getFullYear(), q * 3, 1),
               new Date(today.getFullYear(), q * 3 + 3, 0));
  }
  if (label === 'Last Quarter') {
    let q = Math.floor(today.getMonth() / 3);
    let yr = today.getFullYear();
    if (q === 0) { q = 4; yr--; }
    return fmt(new Date(yr, (q - 1) * 3, 1),
               new Date(yr, (q - 1) * 3 + 3, 0));
  }
  return '';
}

/** Snap any date string to its Monday (used by scorecard week filters) */
export function snapToMonday(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
