-- Migration 102: Stripe billing infrastructure
-- Adds Stripe customer/subscription IDs to organizations
-- Adds subscription status tracking

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_stripe_customer
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_stripe_subscription
  ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID for active plan';
COMMENT ON COLUMN organizations.subscription_status IS 'active, trialing, past_due, canceled, unpaid';
COMMENT ON COLUMN organizations.subscription_period_end IS 'Current billing period end date';
COMMENT ON COLUMN organizations.trial_ends_at IS 'Trial expiration date (null if not trialing)';
