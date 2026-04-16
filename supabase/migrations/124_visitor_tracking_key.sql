-- ============================================================
-- Migration 124: organizations — add visitor_tracking_key
-- ============================================================
-- Adds a public-facing UUID for website visitor tracking so the
-- real organization_id is never exposed in the embed snippet.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS visitor_tracking_key UUID DEFAULT gen_random_uuid();

-- Backfill any existing rows that got NULL
UPDATE organizations
  SET visitor_tracking_key = gen_random_uuid()
  WHERE visitor_tracking_key IS NULL;

-- Unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_visitor_tracking_key
  ON organizations (visitor_tracking_key);
