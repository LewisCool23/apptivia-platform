-- Migration 101: Aaron per-rep memory for persistent coaching context

CREATE TABLE IF NOT EXISTS aaron_rep_memory (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  summary         TEXT,
  goals           TEXT[] DEFAULT '{}',
  challenges      TEXT[] DEFAULT '{}',
  strengths       TEXT[] DEFAULT '{}',
  preferences     JSONB DEFAULT '{}',
  last_topics     TEXT[] DEFAULT '{}',

  message_count   INTEGER DEFAULT 0,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_aaron_memory_user
  ON aaron_rep_memory(user_id, organization_id);

ALTER TABLE aaron_rep_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory" ON aaron_rep_memory
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memory" ON aaron_rep_memory
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE aaron_rep_memory IS 'Aaron AI: per-rep persistent memory for coaching context across sessions';
