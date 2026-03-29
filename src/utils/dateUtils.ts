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

/** Get Monday and Sunday bounding a given date (ISO date strings) */
export function getWeekBounds(date: Date = new Date()): { monday: string; sunday: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
  };
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
