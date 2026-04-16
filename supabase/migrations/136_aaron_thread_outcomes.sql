-- Migration 136: Add outcome tracking to Aaron conversation threads
-- Closes the coaching-to-outcome loop for measuring AI coaching impact

ALTER TABLE aaron_conversation_threads
  ADD COLUMN IF NOT EXISTS outcome_tag text,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS outcome_tagged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_act_outcome_tag
  ON aaron_conversation_threads(organization_id, outcome_tag)
  WHERE outcome_tag IS NOT NULL;
