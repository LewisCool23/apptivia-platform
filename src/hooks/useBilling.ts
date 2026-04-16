import { useState, useEffect, useCallback } from 'react';
import { backendFetch } from '../utils/backendFetch';
import { TIER_LIMITS, TIER_DISPLAY_NAMES, tierHasFeature, meetsMinTier } from '../constants/subscriptionTiers';

interface BillingState {
  plan: string;
  displayName: string;
  status: string;
  periodEnd: string | null;
  trialEndsAt: string | null;
  hasStripe: boolean;
  limits: typeof TIER_LIMITS.Basic;
  usage: { users: number };
  seats: number;
  pricePerSeat: number | null;
  loading: boolean;
}

export function useBilling() {
  const [billing, setBilling] = useState<BillingState>({
    plan: 'Pro',
    displayName: 'Pro',
    status: 'active',
    periodEnd: null,
    trialEndsAt: null,
    hasStripe: false,
    limits: TIER_LIMITS.Pro,
    usage: { users: 0 },
    seats: 0,
    pricePerSeat: 49,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await backendFetch('/api/billing/subscription');
        if (data && !data.error) {
          if (!cancelled) {
            setBilling({
              plan: data.plan,
              displayName: TIER_DISPLAY_NAMES[data.plan] || data.plan,
              status: data.status,
              periodEnd: data.periodEnd,
              trialEndsAt: data.trialEndsAt,
              hasStripe: data.hasStripe,
              limits: data.limits || TIER_LIMITS[data.plan] || TIER_LIMITS.Basic,
              usage: data.usage || { users: 0 },
              seats: data.seats || data.usage?.users || 0,
              pricePerSeat: data.pricePerSeat ?? null,
              loading: false,
            });
          }
        } else {
          if (!cancelled) setBilling(prev => ({ ...prev, loading: false }));
        }
      } catch {
        if (!cancelled) setBilling(prev => ({ ...prev, loading: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const hasFeature = useCallback((feature: string) => {
    return tierHasFeature(billing.plan, feature);
  }, [billing.plan]);

  const canAddUser = useCallback(() => {
    return billing.status === 'active' || billing.status === 'trialing';
  }, [billing.status]);

  const isActive = billing.status === 'active' || billing.status === 'trialing';

  const monthlyTotal = billing.pricePerSeat && billing.seats
    ? billing.pricePerSeat * billing.seats
    : null;

  const updateSeats = useCallback(async () => {
    try {
      const data = await backendFetch('/api/billing/update-seats');
      return data;
    } catch (err) {
      console.error('Update seats error:', err);
      return { error: 'Failed to update seats' };
    }
  }, []);

  const startCheckout = useCallback(async (plan: string) => {
    try {
      const data = await backendFetch('/api/billing/checkout', { plan });
      if (data.url) window.location.href = data.url;
      return data;
    } catch (err) {
      console.error('Checkout error:', err);
      return { error: 'Failed to start checkout' };
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      const data = await backendFetch('/api/billing/portal');
      if (data.url) window.location.href = data.url;
      return data;
    } catch (err) {
      console.error('Portal error:', err);
      return { error: 'Failed to open billing portal' };
    }
  }, []);

  return {
    ...billing,
    hasFeature,
    canAddUser,
    isActive,
    monthlyTotal,
    updateSeats,
    startCheckout,
    openPortal,
    meetsMinTier: (required: string) => meetsMinTier(billing.plan, required),
  };
}
