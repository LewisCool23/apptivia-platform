-- Migration 166: Skill Practice Logs for Aaron Mode 4
CREATE TABLE IF NOT EXISTS aaron_skill_practice_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rep_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_dimension text NOT NULL CHECK (skill_dimension IN (
    'discovery', 'qualification', 'objection_handling', 'closing',
    'negotiation', 'expansion', 'prospecting', 'demo_delivery'
  )),
  scenario_prompt text NOT NULL,
  rep_response text,
  rubric_scores jsonb,
  total_score int CHECK (total_score >= 0 AND total_score <= 100),
  strengths text[],
  improvements text[],
  example_better_response text,
  triggered_by text,
  related_kpi text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rep practice history
CREATE INDEX IF NOT EXISTS idx_skill_practice_rep_created
  ON aaron_skill_practice_logs (rep_profile_id, created_at DESC);

-- Org analytics by skill dimension
CREATE INDEX IF NOT EXISTS idx_skill_practice_org_skill
  ON aaron_skill_practice_logs (organization_id, skill_dimension);

-- RLS
ALTER TABLE aaron_skill_practice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps see own practice logs"
  ON aaron_skill_practice_logs FOR SELECT
  USING (rep_profile_id = auth.uid());

CREATE POLICY "Service role full access on practice logs"
  ON aaron_skill_practice_logs FOR ALL
  USING (auth.role() = 'service_role');
