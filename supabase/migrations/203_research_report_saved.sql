-- Migration 203: Add saved_by_user flag to research reports
-- Allows users to explicitly "save" a brief, preventing auto-regeneration

ALTER TABLE engage_research_reports ADD COLUMN IF NOT EXISTS saved_by_user BOOLEAN DEFAULT false;
ALTER TABLE engage_research_reports ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;
