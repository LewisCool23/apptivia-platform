-- Log when users hit Pro feature gates (for upgrade trigger analysis)
CREATE TABLE IF NOT EXISTS feature_gate_hits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature         text NOT NULL,       -- e.g. 'coaching_plans', 'engage_prospecting'
  hit_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feature_gate_hits_org_time ON feature_gate_hits (organization_id, hit_at DESC);

ALTER TABLE feature_gate_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own org gate hits" ON feature_gate_hits FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "service_role bypass feature_gate_hits"
  ON feature_gate_hits FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');
