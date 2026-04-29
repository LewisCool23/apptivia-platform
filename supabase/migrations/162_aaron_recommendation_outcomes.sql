-- Migration 162: track KPI lift attributable to Aaron coaching recommendations
-- Cron-populated daily. Closes the Aaron feedback loop (Tunguz Economic Engine).

CREATE TABLE IF NOT EXISTS aaron_recommendation_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source of the recommendation
  coaching_action_id uuid REFERENCES aaron_coaching_actions(id) ON DELETE CASCADE,
  rep_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manager_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- What KPI was targeted
  kpi_key text NOT NULL,
  baseline_value numeric,
  baseline_period_start timestamptz,
  baseline_period_end timestamptz,

  -- Measurement windows (cron updates these as time passes)
  value_at_14d numeric,
  value_at_30d numeric,
  value_at_60d numeric,

  -- Attribution metadata
  was_acted_on boolean NOT NULL DEFAULT false,
  acted_on_evidence text,
  recommendation_text text,
  recommendation_framework text,

  -- Computed lift (cron sets these)
  lift_pct_14d numeric,
  lift_pct_30d numeric,
  lift_pct_60d numeric,

  recommendation_at timestamptz NOT NULL DEFAULT now(),
  last_measured_at timestamptz
);

CREATE INDEX idx_aaron_outcomes_org_rep
  ON aaron_recommendation_outcomes(organization_id, rep_profile_id, recommendation_at DESC);

CREATE INDEX idx_aaron_outcomes_unmeasured
  ON aaron_recommendation_outcomes(recommendation_at)
  WHERE value_at_60d IS NULL;

ALTER TABLE aaron_recommendation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members see their org outcomes" ON aaron_recommendation_outcomes
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "service_role bypass aaron_recommendation_outcomes"
  ON aaron_recommendation_outcomes FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

COMMENT ON TABLE aaron_recommendation_outcomes IS
  'Tracks KPI movement attributable to Aaron coaching recommendations. Powers the outcome stats in Aaron prompt context.';
