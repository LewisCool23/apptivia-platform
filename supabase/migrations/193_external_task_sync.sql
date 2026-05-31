-- Migration 193: Add external source tracking to engage_tasks for CRM task sync

ALTER TABLE engage_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'apptivia';
ALTER TABLE engage_tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE engage_tasks ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE engage_tasks ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL;
ALTER TABLE engage_tasks ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Prevent duplicate syncs of the same external task
CREATE UNIQUE INDEX IF NOT EXISTS idx_engage_tasks_external
  ON engage_tasks(organization_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_engage_tasks_source
  ON engage_tasks(organization_id, source)
  WHERE source != 'apptivia';
