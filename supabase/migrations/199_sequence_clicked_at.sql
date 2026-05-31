-- Migration 199: Add clicked_at tracking to sequence executions
-- Enables per-step click rate analytics in the enhanced sequence builder

ALTER TABLE engage_sequence_executions
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('199', 'sequence_clicked_at')
ON CONFLICT DO NOTHING;
