-- Migration 194: Backfill kpi_org_config_history for point-in-time scoring
--
-- The trigger (migration 105) records new history rows on every INSERT/UPDATE
-- to kpi_org_configs, but any configs that existed before migration 105 was
-- applied — or that were inserted but never updated — may have no history rows.
-- Without a history row, historical scorecard views fall back to CURRENT config,
-- defeating point-in-time scoring.
--
-- This backfill inserts a baseline row for every org+kpi combo missing from
-- kpi_org_config_history, using the current kpi_org_configs values and
-- valid_from = '2026-01-12' (earliest kpi_values date, matching migration 064).

INSERT INTO kpi_org_config_history
  (org_config_id, organization_id, kpi_id, goal, weight, show_on_scorecard, is_active, valid_from, valid_to)
SELECT
  c.id,
  c.organization_id,
  c.kpi_id,
  c.goal,
  c.weight,
  c.show_on_scorecard,
  c.is_active,
  '2026-01-12 00:00:00+00'::timestamptz,
  NULL  -- still active
FROM kpi_org_configs c
LEFT JOIN kpi_org_config_history h
  ON h.org_config_id = c.id
WHERE h.id IS NULL;
