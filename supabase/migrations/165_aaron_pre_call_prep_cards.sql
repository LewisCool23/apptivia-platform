-- Migration 165: Pre-Call Prep Cards for Aaron Mode 2
CREATE TABLE IF NOT EXISTS aaron_pre_call_prep_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rep_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_event_id uuid REFERENCES integration_calendar_events(id) ON DELETE SET NULL,
  meeting_start_at timestamptz NOT NULL,
  meeting_title text NOT NULL DEFAULT '',
  account_id uuid REFERENCES engage_accounts(id) ON DELETE SET NULL,
  account_name text,
  card_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  viewed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One prep card per rep per calendar event
CREATE UNIQUE INDEX IF NOT EXISTS uq_prep_card_rep_event
  ON aaron_pre_call_prep_cards (rep_profile_id, calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

-- Rep fetching upcoming prep cards
CREATE INDEX IF NOT EXISTS idx_prep_cards_rep_meeting
  ON aaron_pre_call_prep_cards (rep_profile_id, meeting_start_at DESC);

-- Org-level admin queries
CREATE INDEX IF NOT EXISTS idx_prep_cards_org_generated
  ON aaron_pre_call_prep_cards (organization_id, generated_at DESC);

-- RLS
ALTER TABLE aaron_pre_call_prep_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps see own prep cards"
  ON aaron_pre_call_prep_cards FOR SELECT
  USING (rep_profile_id = auth.uid());

CREATE POLICY "Service role full access on prep cards"
  ON aaron_pre_call_prep_cards FOR ALL
  USING (auth.role() = 'service_role');
