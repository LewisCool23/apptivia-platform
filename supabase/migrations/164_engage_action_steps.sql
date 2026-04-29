-- Migration 164: multi-step play support for signal-triggered outreach
-- Adds engage_action_steps child table and play_type column to engage_signal_actions.
-- Each signal action can be expanded from a single draft into a 3-5 step play
-- across email, LinkedIn, phone, and task channels.

-- 1. Add play_type column to engage_signal_actions
ALTER TABLE engage_signal_actions
  ADD COLUMN IF NOT EXISTS play_type text DEFAULT 'single_action'
    CHECK (play_type IN (
      'single_action',
      'pre_call_nurture',
      'post_call_follow_up',
      'no_show_recovery',
      'lead_reactivation',
      'social_to_pipeline'
    ));

-- 2. Create engage_action_steps child table
CREATE TABLE IF NOT EXISTS engage_action_steps (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_id              uuid        NOT NULL REFERENCES engage_signal_actions(id) ON DELETE CASCADE,
  step_order             integer     NOT NULL CHECK (step_order >= 1),
  channel                text        NOT NULL CHECK (channel IN (
    'email', 'linkedin_dm', 'linkedin_connection', 'phone_call', 'task'
  )),
  step_type              text        NOT NULL CHECK (step_type IN (
    'lead_evaluator', 'connection_requester', 'comment_engine',
    'dm_sequencer', 'follow_up_sequencer'
  )),
  draft_subject          text,
  draft_body             text        NOT NULL,
  scheduled_for          timestamptz NOT NULL,
  status                 text        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'replied', 'skipped_replied_earlier', 'cancelled', 'failed'
  )),
  sent_at                timestamptz,
  reply_at               timestamptz,
  reply_content          text,
  skip_if_replied        boolean     NOT NULL DEFAULT true,
  skip_if_meeting_booked boolean     NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX idx_action_steps_action ON engage_action_steps(action_id, step_order);
CREATE INDEX idx_action_steps_due ON engage_action_steps(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_action_steps_org ON engage_action_steps(organization_id, status);

-- 4. RLS
ALTER TABLE engage_action_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY engage_action_steps_org_read ON engage_action_steps
  FOR SELECT USING (organization_id = auth_user_org_id());

CREATE POLICY engage_action_steps_org_write ON engage_action_steps
  FOR ALL USING (organization_id = auth_user_org_id());

CREATE POLICY engage_action_steps_service ON engage_action_steps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE engage_action_steps IS
  'Child steps of an engage_signal_actions play. Each row is one outbound touch in a multi-step sequence (email, LinkedIn, call, task).';
COMMENT ON COLUMN engage_signal_actions.play_type IS
  'Type of multi-step play. Defaults to single_action for legacy single-draft rows.';
