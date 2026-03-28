-- Migration 056: engage_research_reports
-- Stores AI-generated company and prospect research briefs from Engage → Discover.

CREATE TABLE IF NOT EXISTS engage_research_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id         UUID,
  report_type     TEXT NOT NULL CHECK (report_type IN ('company', 'prospect')),
  subject_name    TEXT NOT NULL,         -- company name or prospect name
  subject_domain  TEXT,                  -- company domain if applicable
  query           TEXT,                  -- original search query
  content         JSONB NOT NULL DEFAULT '{}',
  tokens_used     INTEGER DEFAULT 0,
  model_used      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_reports_org
  ON engage_research_reports(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_reports_subject
  ON engage_research_reports(organization_id, subject_domain)
  WHERE subject_domain IS NOT NULL;

-- RLS
ALTER TABLE engage_research_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read own reports" ON engage_research_reports;
DROP POLICY IF EXISTS "org members can insert reports" ON engage_research_reports;

CREATE POLICY "org members can read own reports"
  ON engage_research_reports FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "org members can insert reports"
  ON engage_research_reports FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
