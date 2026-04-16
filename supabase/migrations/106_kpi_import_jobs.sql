-- Migration 106: KPI CSV Import audit table
-- Tracks historical data import jobs for auditing and history display

CREATE TABLE IF NOT EXISTS kpi_import_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES profiles(id),
  status          text        NOT NULL DEFAULT 'processing',  -- processing | completed | partial | failed
  filename        text,
  total_rows      int         NOT NULL DEFAULT 0,
  rows_imported   int         NOT NULL DEFAULT 0,
  rows_skipped    int         NOT NULL DEFAULT 0,
  rows_failed     int         NOT NULL DEFAULT 0,
  error_log       jsonb,
  week_range      text,       -- e.g. "2025-01-06 to 2026-03-30"
  rep_count       int         DEFAULT 0,
  kpi_count       int         DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kpi_import_jobs_org
  ON kpi_import_jobs(organization_id, created_at DESC);

-- RLS: org members can read their import history; service role handles inserts/updates
ALTER TABLE kpi_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view import jobs"
  ON kpi_import_jobs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
