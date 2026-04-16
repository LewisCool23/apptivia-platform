-- Track when reps take action on Aaron coaching recommendations
CREATE TABLE IF NOT EXISTS aaron_coaching_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_thread_id uuid REFERENCES aaron_conversation_threads(id) ON DELETE SET NULL,
  action_type       text NOT NULL, -- 'task_created', 'call_logged', 'meeting_scheduled', 'note_added', 'follow_up_set'
  action_label      text NOT NULL, -- Human-readable: "Scheduled follow-up call with Acme"
  source_framework  text,          -- Which Aaron framework triggered this (e.g. 'challenger')
  crm_push_status   text DEFAULT 'pending', -- 'pending' | 'pushed' | 'skipped' | 'failed'
  crm_push_at       timestamptz,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coaching_actions_user ON aaron_coaching_actions (user_id, organization_id, created_at DESC);

ALTER TABLE aaron_coaching_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own coaching actions" ON aaron_coaching_actions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own coaching actions" ON aaron_coaching_actions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role bypass aaron_coaching_actions"
  ON aaron_coaching_actions FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
