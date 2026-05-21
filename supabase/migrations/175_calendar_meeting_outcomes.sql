-- Migration 175: Add meeting outcome tracking + account linking to calendar events
-- Supports post-meeting logging and domain-based account matching in Engage Calendar tab

ALTER TABLE integration_calendar_events
  ADD COLUMN IF NOT EXISTS meeting_outcome TEXT
    CHECK (meeting_outcome IN ('completed','cancelled','no_show','rescheduled')),
  ADD COLUMN IF NOT EXISTS meeting_notes TEXT,
  ADD COLUMN IF NOT EXISTS outcome_logged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_logged_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES engage_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_company_id UUID REFERENCES engage_companies(id) ON DELETE SET NULL;

-- Index for efficient "needs outcome" queries (past meetings without outcome)
CREATE INDEX IF NOT EXISTS idx_cal_events_outcome_pending
  ON integration_calendar_events(profile_id, end_time DESC)
  WHERE meeting_outcome IS NULL;

-- Index for account-linked meeting lookups
CREATE INDEX IF NOT EXISTS idx_cal_events_linked_account
  ON integration_calendar_events(linked_account_id)
  WHERE linked_account_id IS NOT NULL;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('175', 'calendar_meeting_outcomes')
ON CONFLICT DO NOTHING;
