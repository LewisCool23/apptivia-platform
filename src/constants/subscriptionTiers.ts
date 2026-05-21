/**
 * Subscription tier definitions — single source of truth.
 *
 * DB enum values: 'Basic', 'Pro', 'Enterprise'
 * Display names:  'Starter', 'Pro', 'Enterprise' (marketing alignment)
 */

export const TIER_DISPLAY_NAMES: Record<string, string> = {
  Basic: 'Starter',
  Pro: 'Pro',
  Enterprise: 'Enterprise',
};

export interface TierLimits {
  maxUsers: number;
  maxTeams: number;
  features: string[];
  integrations: string[];
  support: string;
  pricePerSeat: number | null; // null = custom pricing
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  Basic: {
    maxUsers: Infinity,
    maxTeams: 5,
    features: [
      'scorecard',
      'wallboard',
      'csv_upload',
      'basic_analytics',
      'aaron_chatbot',
    ],
    integrations: ['apollo', 'csv', 'salesforce', 'hubspot', 'outreach', 'gong', 'salesloft', 'csv_upload'],
    support: 'email',
    pricePerSeat: 19,
  },
  Pro: {
    maxUsers: Infinity,
    maxTeams: Infinity,
    features: [
      'scorecard',
      'wallboard',
      'csv_upload',
      'basic_analytics',
      'aaron_chatbot',
      'coach',
      'coaching_plans',
      'idps',
      'performance_reviews',
      'contests',
      'engage_discover',
      'engage_prospecting',
      'advanced_analytics',
      'export_reports',
      'custom_contests',
      'signal_library',
      'account_intelligence',
      'engage_calendar',
    ],
    integrations: ['apollo', 'csv', 'salesforce', 'hubspot', 'outreach', 'gong', 'salesloft', 'marketo', 'google_calendar', 'microsoft_outlook', 'sendoso', 'csv_upload'],
    support: 'priority',
    pricePerSeat: 49,
  },
  Enterprise: {
    maxUsers: Infinity,
    maxTeams: Infinity,
    features: [
      'scorecard',
      'wallboard',
      'csv_upload',
      'basic_analytics',
      'aaron_chatbot',
      'coach',
      'coaching_plans',
      'idps',
      'performance_reviews',
      'contests',
      'engage_discover',
      'engage_prospecting',
      'advanced_analytics',
      'export_reports',
      'custom_contests',
      'signal_library',
      'account_intelligence',
      'engage_calendar',
      'org_health_scorecard',
      'custom_integrations',
      'api_access',
      'sso',
      'audit_log',
    ],
    integrations: ['apollo', 'csv', 'salesforce', 'hubspot', 'outreach', 'gong', 'salesloft', 'marketo', 'google_calendar', 'microsoft_outlook', 'sendoso', 'csv_upload', 'custom'],
    support: 'dedicated',
    pricePerSeat: null,
  },
};

/** Check if a tier has access to a specific feature */
export function tierHasFeature(tier: string, feature: string): boolean {
  const limits = TIER_LIMITS[tier];
  if (!limits) return false;
  return limits.features.includes(feature);
}

/** Check if a tier supports a specific integration */
export function tierHasIntegration(tier: string, integration: string): boolean {
  const limits = TIER_LIMITS[tier];
  if (!limits) return false;
  return limits.integrations.includes(integration);
}

/** Get display name for a DB tier value */
export function tierDisplayName(dbTier: string): string {
  return TIER_DISPLAY_NAMES[dbTier] || dbTier;
}

/** Tier hierarchy for comparison */
export const TIER_LEVEL: Record<string, number> = {
  Basic: 1,
  Pro: 2,
  Enterprise: 3,
};

/** Check if current tier meets minimum required tier */
export function meetsMinTier(currentTier: string, requiredTier: string): boolean {
  return (TIER_LEVEL[currentTier] || 0) >= (TIER_LEVEL[requiredTier] || 0);
}
