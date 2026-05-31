-- Migration 204: Add 'archived' status for signal auto-archival
-- Signals older than 14 days with status='new' will be auto-archived by cron

-- Expand status constraint to include 'archived'
ALTER TABLE engage_intent_signals DROP CONSTRAINT IF EXISTS engage_intent_signals_status_check;
ALTER TABLE engage_intent_signals ADD CONSTRAINT engage_intent_signals_status_check
  CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed', 'archived'));

-- Partial index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_intent_signals_cleanup
  ON engage_intent_signals(status, detected_at)
  WHERE status = 'new';
