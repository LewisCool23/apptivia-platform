-- Migration 197: Add software_in_use to deals
-- Tracks which software/tools the prospect company uses (multi-select)

ALTER TABLE engage_pipeline_deals
  ADD COLUMN IF NOT EXISTS software_in_use TEXT[] DEFAULT '{}';

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('197', 'deal_software_in_use')
ON CONFLICT DO NOTHING;
