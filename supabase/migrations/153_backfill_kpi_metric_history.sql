-- Migration 153: Backfill kpi_metric_history for all KPIs missing entries (F9)
-- Without a history row, fetchHistoricalConfig() falls back to goal=1, inflating attainment %.

INSERT INTO kpi_metric_history
  (kpi_id, goal, weight, show_on_scorecard, is_active, direction, valid_from, valid_to)
SELECT
  m.id,
  m.goal,
  m.weight,
  m.show_on_scorecard,
  m.is_active,
  COALESCE(m.direction, 'higher'),
  '2026-01-12'::timestamptz,  -- earliest kpi_values date (matches migration 064 baseline)
  NULL                         -- still active
FROM kpi_metrics m
LEFT JOIN kpi_metric_history h ON h.kpi_id = m.id
WHERE h.id IS NULL;
