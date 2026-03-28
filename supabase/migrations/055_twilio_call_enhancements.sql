-- Migration 055: Twilio Click-to-Call — engage_call_logs + engage_prospects
-- Adds Twilio call correlation columns and last_called_at tracking.
--
-- Notes:
--   prospect_id is a plain UUID (no FK) so this migration runs safely
--   even if engage_prospects hasn't been created yet in this project.
--   last_called_at is added only if engage_prospects exists.

-- 1. Twilio correlation columns on engage_call_logs
ALTER TABLE engage_call_logs
  ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS prospect_id UUID;

CREATE INDEX IF NOT EXISTS idx_call_logs_twilio_sid
  ON engage_call_logs(twilio_call_sid)
  WHERE twilio_call_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_logs_prospect
  ON engage_call_logs(prospect_id)
  WHERE prospect_id IS NOT NULL;

-- 2. last_called_at on engage_prospects (only if the table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'engage_prospects'
  ) THEN
    ALTER TABLE engage_prospects
      ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_prospects_last_called
      ON engage_prospects(organization_id, last_called_at DESC NULLS LAST)
      WHERE last_called_at IS NOT NULL;
  END IF;
END $$;
