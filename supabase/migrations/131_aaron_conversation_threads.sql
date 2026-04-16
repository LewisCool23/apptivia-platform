-- Aaron persistent conversation threads
CREATE TABLE IF NOT EXISTS aaron_conversation_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_name     text,                          -- auto-generated or user-named
  messages        jsonb NOT NULL DEFAULT '[]',   -- array of {role, content, ts}
  message_count   int  NOT NULL DEFAULT 0,
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_thread_user_org UNIQUE (user_id, organization_id, id)
);

CREATE INDEX idx_aaron_threads_user_org ON aaron_conversation_threads (user_id, organization_id, last_active_at DESC);

ALTER TABLE aaron_conversation_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own threads"
  ON aaron_conversation_threads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role bypass aaron_conversation_threads"
  ON aaron_conversation_threads FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
