-- 069: Plan Effectiveness Tracking
-- Adds KPI snapshot columns to coaching_plan_assignments for measuring plan impact.

ALTER TABLE coaching_plan_assignments
  ADD COLUMN IF NOT EXISTS baseline_kpi_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS final_kpi_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS effectiveness_score integer;

COMMENT ON COLUMN coaching_plan_assignments.baseline_kpi_snapshot IS 'KPI values at time of assignment: { "kpi_key": { "value": N, "pct": N } }';
COMMENT ON COLUMN coaching_plan_assignments.final_kpi_snapshot IS 'KPI values at time of completion';
COMMENT ON COLUMN coaching_plan_assignments.effectiveness_score IS 'Average improvement % across focus KPIs (final_pct - baseline_pct)';
