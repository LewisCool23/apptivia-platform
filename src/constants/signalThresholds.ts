/**
 * Signal score thresholds — single source of truth for the frontend.
 * M8 fix: eliminates scattered magic numbers across hooks.
 *
 * Backend thresholds are env-configurable (SIGNAL_MIN_SCORE, etc.)
 * but should stay aligned with these values.
 *
 * Threshold tiers (based on Claude classification):
 *   90-100  Direct purchase intent / major executive change
 *   75-89   Strong signal (competitor complaint, funding, leadership)
 *   60-74   Moderate signal (pain point, product launch, hiring)
 *   40-59   Weak signal (press release, general news)
 *   < 40    Omitted from results
 */

/** Minimum score for a signal to be shown at all (matches backend post-filter) */
export const SIGNAL_DISPLAY_MIN = 40;

/** Score at or above which a signal is considered "high intent" */
export const SIGNAL_HIGH_INTENT_THRESHOLD = 70;

/** Score at or above which a signal qualifies for the outreach action queue */
export const SIGNAL_ACTION_QUEUE_MIN = 75;

/** Score tiers for UI badge display */
export const SIGNAL_TIER = {
  STRONG: 75,   // Green badge
  MODERATE: 60, // Yellow badge
  WEAK: 40,     // Gray badge
} as const;

/**
 * 4D: Category-specific actionable thresholds.
 * buyer_intent signals are highest-value → lowest bar to act on.
 * interest signals are lowest-value → highest bar to act on.
 */
export const CATEGORY_THRESHOLDS: Record<string, number> = {
  buyer_intent:   60,  // T1: act fast — any buyer intent ≥60 is actionable
  company_event:  70,  // T2: moderate bar — events need higher confidence
  interest:       80,  // T3: high bar — general interest needs strong signal
  universal:      70,  // default — same as company_event
};

/** Returns the actionable threshold for a signal category */
export function getCategoryThreshold(category: string): number {
  return CATEGORY_THRESHOLDS[category] ?? SIGNAL_HIGH_INTENT_THRESHOLD;
}

/** Returns tier label + color for a signal score within its category */
export function getSignalTier(score: number, category: string): { label: string; color: string; bg: string } {
  const threshold = getCategoryThreshold(category);
  if (score >= threshold + 15) return { label: 'T1', color: 'text-green-700', bg: 'bg-green-100' };
  if (score >= threshold)      return { label: 'T2', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  if (score >= SIGNAL_DISPLAY_MIN) return { label: 'T3', color: 'text-apptivia-carbon-600', bg: 'bg-apptivia-carbon-100' };
  return { label: '', color: '', bg: '' };
}

/** Signal type → category fallback map (when DB category isn't on the signal object) */
const SIGNAL_TYPE_CATEGORY: Record<string, string> = {
  solution_search: 'buyer_intent', pain_point: 'buyer_intent', icp_job_posting: 'buyer_intent',
  tech_stack_churn: 'buyer_intent', competitor_comparison: 'buyer_intent', competitor_complaint: 'buyer_intent',
  competitor_engagement: 'buyer_intent',
  funding: 'company_event', leadership_change: 'company_event', expansion: 'company_event',
  layoffs: 'company_event', contract_win: 'company_event', product_launch: 'company_event',
  product_hunt_launch: 'company_event', hiring_velocity: 'company_event', dept_expansion: 'company_event',
  hiring: 'interest', job_change: 'interest', content_engagement: 'interest',
  event_participation: 'interest', review_sentiment: 'interest', g2_review: 'interest',
  capterra_review: 'interest', press_release: 'interest', tech_adoption: 'interest',
  sec_filing: 'interest', glassdoor_sentiment: 'interest', glassdoor_leadership_concern: 'interest',
  glassdoor_culture_issue: 'interest', glassdoor_rating_decline: 'interest',
  reddit_signal: 'interest', reddit_buying_intent: 'buyer_intent', reddit_churn_risk: 'buyer_intent',
  reddit_competitor_mention: 'buyer_intent', website_visit: 'interest',
};

/** Get category from signal_type key */
export function getSignalCategory(signalType: string): string {
  return SIGNAL_TYPE_CATEGORY[signalType] ?? 'universal';
}
