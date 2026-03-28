-- ========================================================================
-- Migration 062: Autopilot Infrastructure
-- Adds tables and schema changes to support the autopilot feature set:
--   - engage_signal_actions (action queue for AI-drafted outreach)
--   - last_signal_scan_at on organizations (dedup scheduled scans)
--   - New notification_type values: kpi_anomaly, signal_action_queued
-- ========================================================================

-- ── New notification types ────────────────────────────────────────────────
-- Must use DO block because ALTER TYPE ADD VALUE cannot run inside a transaction.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'kpi_anomaly'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'kpi_anomaly';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'signal_action_queued'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'signal_action_queued';
  END IF;
END $$;

-- ── engage_signal_actions ─────────────────────────────────────────────────
-- Stores AI-drafted outreach items awaiting manager/rep approval.
-- Populated by the backend runActionQueueBuilder() cron job.

CREATE TABLE IF NOT EXISTS engage_signal_actions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id               UUID        NOT NULL REFERENCES engage_intent_signals(id) ON DELETE CASCADE,
  org_id                  UUID        NOT NULL,
  profile_id              UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  draft_email_subject     TEXT,
  draft_email_body        TEXT,
  draft_linkedin_message  TEXT,
  outreach_angle          TEXT,
  recommended_action      TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'sent', 'dismissed')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actioned_at             TIMESTAMPTZ,
  actioned_by             UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_signal_actions_org_status
  ON engage_signal_actions(org_id, status);

CREATE INDEX IF NOT EXISTS idx_signal_actions_signal_id
  ON engage_signal_actions(signal_id);

-- Row Level Security
ALTER TABLE engage_signal_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view action queue"
  ON engage_signal_actions FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert action queue"
  ON engage_signal_actions FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Org members can update action queue"
  ON engage_signal_actions FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role bypass (used by backend cron jobs)
CREATE POLICY "Service role has full access to action queue"
  ON engage_signal_actions
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── organizations: last_signal_scan_at ────────────────────────────────────
-- Tracks when the weekly signal scan last ran for each org.
-- Used by runSignalScan() to skip orgs scanned within the last 6 days.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS last_signal_scan_at TIMESTAMPTZ;

-- ── Indexes to support new cron query patterns ────────────────────────────

-- Supports runScorecardAlerts: scan rep profiles per org, exclude admins/managers
CREATE INDEX IF NOT EXISTS idx_profiles_org_role
  ON profiles(organization_id, role);

-- Supports runContestAutoComplete: find expired active contests
CREATE INDEX IF NOT EXISTS idx_active_contests_end_status
  ON active_contests(end_date, status)
  WHERE status = 'active';

-- Supports runKpiAnomalyAlerts: rolling average computation per rep
CREATE INDEX IF NOT EXISTS idx_kpi_values_profile_period
  ON kpi_values(profile_id, period_start DESC);
