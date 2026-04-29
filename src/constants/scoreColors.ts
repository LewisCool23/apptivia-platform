/**
 * Centralized KPI attainment color thresholds.
 *   90%+ = success (on track)
 *   80–89% = warning (acceptable, room to improve)
 *   60–79% = coral-light (needs attention)
 *   <60% = error (critical)
 */

export function scoreTextColor(pct: number): string {
  if (pct >= 90) return 'text-apptivia-success';
  if (pct >= 80) return 'text-apptivia-warning';
  if (pct >= 60) return 'text-apptivia-coral-tone-300';
  return 'text-apptivia-error';
}

export function scoreBgColor(pct: number): string {
  if (pct >= 90) return 'bg-apptivia-success';
  if (pct >= 80) return 'bg-apptivia-warning';
  if (pct >= 60) return 'bg-apptivia-coral-tone-300';
  return 'bg-apptivia-error';
}

/** Hex color for charts / inline styles */
export function scoreHex(pct: number): string {
  if (pct >= 90) return '#16A34A';
  if (pct >= 80) return '#F59E0B';
  if (pct >= 60) return '#FF8A6B';
  return '#C8341B';
}

/** Row highlight bg (subtle) — only success tint for 90%+, otherwise empty */
export function scoreRowBg(pct: number): string {
  return pct >= 90 ? 'bg-apptivia-success-bg' : '';
}
