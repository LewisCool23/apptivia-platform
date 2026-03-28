/**
 * Centralized KPI attainment color thresholds.
 *   90%+ = green (on track)
 *   80–89% = yellow (acceptable, room to improve)
 *   60–79% = orange (needs attention)
 *   <60% = red (critical)
 */

export function scoreTextColor(pct: number): string {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-yellow-500';
  if (pct >= 60) return 'text-orange-500';
  return 'text-red-500';
}

export function scoreBgColor(pct: number): string {
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 80) return 'bg-yellow-400';
  if (pct >= 60) return 'bg-orange-400';
  return 'bg-red-500';
}

/** Hex color for charts / inline styles */
export function scoreHex(pct: number): string {
  if (pct >= 90) return '#16a34a';
  if (pct >= 80) return '#eab308';
  if (pct >= 60) return '#f97316';
  return '#ef4444';
}

/** Row highlight bg (subtle) — only green-50 for 90%+, otherwise empty */
export function scoreRowBg(pct: number): string {
  return pct >= 90 ? 'bg-green-50' : '';
}
