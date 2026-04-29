-- Migration 160: capture dismissal reason and edit diff on engage_signal_actions
-- Closes the Engage learning loop by capturing WHY actions are dismissed
-- and HOW reps edit drafts before sending.

ALTER TABLE engage_signal_actions
  ADD COLUMN IF NOT EXISTS dismissal_reason text,
  ADD COLUMN IF NOT EXISTS dismissal_category text CHECK (dismissal_category IS NULL OR dismissal_category IN (
    'wrong_target', 'wrong_timing', 'wrong_message', 'already_handled', 'low_priority', 'other'
  )),
  ADD COLUMN IF NOT EXISTS edit_diff jsonb,
  ADD COLUMN IF NOT EXISTS sent_subject text,
  ADD COLUMN IF NOT EXISTS sent_body text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_engage_actions_dismissal_category
  ON engage_signal_actions(organization_id, dismissal_category)
  WHERE dismissal_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_engage_actions_sent_at
  ON engage_signal_actions(organization_id, sent_at)
  WHERE sent_at IS NOT NULL;

COMMENT ON COLUMN engage_signal_actions.dismissal_reason IS
  'Free-text reason rep gave when dismissing this AI-drafted action.';
COMMENT ON COLUMN engage_signal_actions.dismissal_category IS
  'Categorical version of dismissal_reason for aggregation. UI uses chip selector.';
COMMENT ON COLUMN engage_signal_actions.edit_diff IS
  'Structured diff between draft_email_body and sent_body. Format: {added: [...], removed: [...], length_delta, edit_ratio}';
