-- ========================================================================
-- Migration 041: Engage Conversation Intelligence — Call Logs
-- ========================================================================

CREATE TABLE IF NOT EXISTS engage_call_logs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID NOT NULL,
  user_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deal_id           UUID REFERENCES engage_pipeline_deals(id) ON DELETE SET NULL,

  -- Call metadata
  contact_name      TEXT,
  call_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes  INTEGER,
  call_direction    TEXT DEFAULT 'outbound' CHECK (call_direction IN ('inbound', 'outbound')),

  -- Raw content
  notes             TEXT NOT NULL,

  -- AI-extracted intelligence (null until analyzed)
  ai_analysis       JSONB,
  -- Expected shape:
  -- {
  --   sentiment: "positive"|"neutral"|"negative",
  --   deal_stage_signal: "advancing"|"stalled"|"at_risk"|"unclear",
  --   summary: "...",
  --   next_steps: ["..."],
  --   objections: ["..."],
  --   competitor_mentions: ["..."]
  -- }

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_org  ON engage_call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_user ON engage_call_logs(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_deal ON engage_call_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_date ON engage_call_logs(organization_id, call_date DESC);

ALTER TABLE engage_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org call logs" ON engage_call_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own call logs" ON engage_call_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own call logs" ON engage_call_logs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Managers can update any org call log" ON engage_call_logs
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('manager', 'admin')
    )
  );
