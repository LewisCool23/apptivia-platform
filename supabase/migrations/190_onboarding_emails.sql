-- Migration 190: Onboarding email tracking for drip campaigns

CREATE TABLE IF NOT EXISTS onboarding_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  email_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_type)
);

ALTER TABLE onboarding_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on onboarding_email_log"
  ON onboarding_email_log FOR ALL
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_onboarding_email_log_user ON onboarding_email_log(user_id);
