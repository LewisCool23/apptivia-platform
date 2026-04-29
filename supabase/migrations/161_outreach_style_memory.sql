-- Migration 161: per-rep outreach style memory derived from edit history
-- Cron-populated weekly. Read by Engage drafting code as constraint injection.

CREATE TABLE IF NOT EXISTS outreach_style_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Aggregated style signals (cron-computed weekly)
  preferred_tone text,
  preferred_length text,
  preferred_opener_style text,
  avoided_phrases text[],
  preferred_phrases text[],
  preferred_signoff text,

  -- Performance tracking
  total_drafts_sent integer NOT NULL DEFAULT 0,
  total_drafts_dismissed integer NOT NULL DEFAULT 0,
  total_drafts_edited integer NOT NULL DEFAULT 0,
  last_recomputed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(organization_id, profile_id)
);

CREATE INDEX idx_outreach_style_memory_org_profile
  ON outreach_style_memory(organization_id, profile_id);

ALTER TABLE outreach_style_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own style memory in their org" ON outreach_style_memory
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

COMMENT ON TABLE outreach_style_memory IS
  'Per-rep style preferences derived from edit_diff aggregation. Read by Engage drafting code as constraint injection.';
