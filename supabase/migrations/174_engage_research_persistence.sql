-- Migration 174: Engage research persistence + activity metadata
-- Supports cached AI briefs for saved contacts and account-level activity tracking

-- 1. Add last_researched_at to engage_prospects for freshness tracking
ALTER TABLE engage_prospects ADD COLUMN IF NOT EXISTS last_researched_at TIMESTAMPTZ;

-- 2. Add metadata JSONB to engage_activity_events for account/prospect linking
ALTER TABLE engage_activity_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Add subject_name column (dropped in migration 099 table recreation)
ALTER TABLE engage_research_reports ADD COLUMN IF NOT EXISTS subject_name TEXT;

-- 4. Backfill subject_name from title for existing reports
UPDATE engage_research_reports SET subject_name = title WHERE subject_name IS NULL AND title IS NOT NULL;

-- 5. Index for prospect research report lookups by name
CREATE INDEX IF NOT EXISTS idx_engage_reports_subject_lookup
  ON engage_research_reports(organization_id, report_type, subject_name)
  WHERE subject_name IS NOT NULL;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('174', 'engage_research_persistence')
ON CONFLICT DO NOTHING;
