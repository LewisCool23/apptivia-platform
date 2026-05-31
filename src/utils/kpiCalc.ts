/**
 * Shared KPI calculation utilities — SINGLE source of truth.
 * (X3 fix: replaces 13+ scattered calcPct implementations with inconsistent capping)
 *
 * ALL percentage calculations across the platform should use this function.
 * Cap: 200% for both higher and lower direction KPIs.
 */

/**
 * Calculate KPI attainment percentage.
 *
 * @param value  - The actual KPI value achieved
 * @param goal   - The target goal for this KPI
 * @param direction - 'higher' (more is better) or 'lower' (less is better)
 * @returns Percentage attainment, capped at 200%. Returns 0 if goal <= 0.
 *          Returns null for lower-is-better when value=0 (no data, not perfection).
 */
export function calcPct(value: number, goal: number, direction: string = 'higher'): number | null {
  if (goal <= 0) return 0;

  if (direction === 'lower') {
    if (value <= 0) return null; // no data — do not treat as perfect
    return Math.min((goal / value) * 100, 200);
  }

  // Higher-is-better: standard ratio with 200% cap
  return Math.min((value / goal) * 100, 200);
}

/**
 * Compute a weighted score from metric attainment percentages.
 *
 * The formula used in 6+ places across the platform is:
 *   score = sum(percentage * weight) / sum(weight)
 *
 * Null percentages (no data) are excluded from both numerator and denominator.
 *
 * @param items - Array of { percentage, weight } objects
 * @returns Rounded integer score (0-200). Returns 0 if total weight is 0.
 */
export function computeWeightedScore(
  items: Array<{ percentage: number | null; weight: number }>,
): number {
  let totalScore = 0;
  let totalWeight = 0;
  for (const item of items) {
    if (item.percentage !== null && item.percentage !== undefined) {
      totalScore += item.percentage * item.weight;
      totalWeight += item.weight;
    }
  }
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
}
