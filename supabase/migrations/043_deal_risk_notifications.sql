-- ========================================================================
-- Migration 043: Deal Risk Notifications
-- Adds 'deal_risk' to notification_type enum for pipeline risk alerts
-- ========================================================================

-- Add the new notification type (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'deal_risk'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'deal_risk';
  END IF;
END $$;

-- Optional: index on deal fields used by the risk scanner
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_risk_scan
  ON engage_pipeline_deals(organization_id, last_activity_at, deal_value, stage)
  WHERE stage NOT IN ('closed_won', 'closed_lost');
