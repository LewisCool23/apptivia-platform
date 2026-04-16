-- Migration 100: Add prospect ownership for rep-scoped filtering
-- engage_accounts.assigned_to already exists (migration 032)
-- This adds assigned_to to engage_prospects

ALTER TABLE engage_prospects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_engage_prospects_assigned
  ON engage_prospects(assigned_to)
  WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN engage_prospects.assigned_to IS 'Rep who owns this prospect (for My Prospects filtering)';
