-- Migration 040: ICP (Ideal Customer Profile) configuration
-- Adds a jsonb config column to organizations for ICP fit scoring.
-- The ICP score is computed client-side in AccountIntelligence.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS icp_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organizations.icp_config IS
  'ICP scoring criteria: { enabled, target_industries[], headcount_min, headcount_max, revenue_min_m, revenue_max_m, target_technologies[], weights }';
