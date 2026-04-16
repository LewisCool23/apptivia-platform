-- ============================================================
-- Migration 123: notifications — add metadata (jsonb) column
-- ============================================================
-- Adds structured metadata to notifications for rich payloads
-- used by the competitive intelligence agent and IDP auto-draft
-- notification types.
--
-- Consumed by:
--   - Competitive Intel agent: stores competitor brief, sources[], summary
--   - IDP auto-draft: stores idp_draft_id, rep name, trigger_reason
--   - Follow-up nudge: stores signal_id, original_action, days_stale
--   - KPI anomaly: stores kpi_key, deviation_pct, direction
--   - (future) Any notification type needing structured data beyond title/message
--
-- Example metadata shapes by notification type:
--   competitive_brief:  { brief: "...", sources: [...], competitors: [...] }
--   idp_auto_drafted:   { idp_draft_id: "uuid", rep_name: "...", trigger_reason: "..." }
--   follow_up_ready:    { signal_id: "uuid", company: "...", days_stale: 9 }
--   kpi_anomaly:        { kpi_key: "calls", deviation_pct: -32, direction: "drop" }
-- ============================================================

-- Step 1: Add metadata column (jsonb, nullable — existing rows default to null)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Step 2: GIN index for metadata queries
--   Enables future queries like: .contains({ idp_draft_id: "..." })
--   or filtering notifications by metadata fields in the frontend
CREATE INDEX IF NOT EXISTS idx_notifications_metadata
  ON notifications USING GIN (metadata)
  WHERE metadata IS NOT NULL;

-- Step 3: Add notification_type enum values for new agent types
--   Only add if they don't already exist (idempotent via DO block)
DO $$
BEGIN
  -- competitive_brief (competitive intelligence agent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'competitive_brief'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'competitive_brief';
  END IF;

  -- idp_auto_drafted (IDP auto-draft cron)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'idp_auto_drafted'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'idp_auto_drafted';
  END IF;

  -- follow_up_ready (follow-up nudge agent)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'follow_up_ready'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'follow_up_ready';
  END IF;
END
$$;
