-- Migration 196: Deal qualification tracking
-- Adds qualification_data JSONB to engage_pipeline_deals for per-deal
-- qualification criteria tracking (BANT, MEDDIC, MEDDPICC, Custom).
-- Structure: { "budget": true, "authority": false, ... } per org's framework.

ALTER TABLE engage_pipeline_deals
  ADD COLUMN IF NOT EXISTS qualification_data JSONB DEFAULT '{}';

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('196', 'deal_qualification_data')
ON CONFLICT DO NOTHING;
