-- Migration 091: Fix KPI seed data for realistic attainment percentages
--
-- Problems fixed:
--   1. 10 Engage/pipeline KPIs fell through to ELSE branch in migrations 061/071/081,
--      producing value ~8.2 regardless of goal — causing attainments from 16% to 410%.
--   2. response_time and sales_cycle_days (lower-is-better) used non-inverted multiplier,
--      so top performers got the worst values and bottom performers the best.
--   3. closed_won may have duplicate rows inflating to 172%.
--
-- Strategy: DELETE and re-insert for all 13 affected KPI keys across all 29 seeded weeks.
-- Uses goal-aligned formulas: higher-is-better = goal * m * variation,
-- lower-is-better = center * (2 - m) * variation (same pattern as migration 088).

-- ── Step 1: Delete existing bad data for affected KPIs ─────────────────────
DELETE FROM kpi_values
WHERE kpi_id IN (
  SELECT id FROM kpi_metrics WHERE key IN (
    'stage3_opps', 'closed_won',
    'sequences_created', 'prospects_enrolled', 'sequence_replies',
    'accounts_researched', 'playbooks_executed', 'outreach_drafts_sent',
    'ai_content_generated', 'engage_signals_actioned', 'engage_deals_influenced',
    'response_time', 'sales_cycle_days'
  )
);

-- ── Step 2: Re-insert with correct formulas ────────────────────────────────
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
WITH profile_tiers AS (
  SELECT id, team_id,
    CASE (first_name || ' ' || last_name)
      WHEN 'Sarah Johnson'       THEN 1.20
      WHEN 'Elijah Hart'         THEN 1.12
      WHEN 'Testy McTester'      THEN 0.72
      WHEN 'Testington Passalot' THEN 0.65
      WHEN 'Jordan Smith'        THEN 0.99
      WHEN 'Sophia Porter'       THEN 0.96
      WHEN 'Mike Chen'           THEN 0.93
      WHEN 'James Knight'        THEN 0.90
      WHEN 'Noah Reed'           THEN 0.88
      WHEN 'William Jackson'     THEN 0.86
      WHEN 'Isabella Cruz'       THEN 0.85
      WHEN 'Emma Foster'         THEN 0.84
      WHEN 'Liam Brooks'         THEN 0.83
      WHEN 'Alex Rivera'         THEN 0.82
      WHEN 'Ava Carter'          THEN 0.82
      WHEN 'Charlotte Lane'      THEN 0.81
      WHEN 'Benjamin Webb'       THEN 0.81
      WHEN 'Olivia Grant'        THEN 0.80
      WHEN 'Jenkins Jenkins'     THEN 0.80
      WHEN 'Mia Rhodes'          THEN 0.80
      ELSE 0.82
    END AS m
  FROM profiles
  WHERE role NOT IN ('admin', 'manager', 'coach')
)
SELECT
  km.id AS kpi_id,
  pt.id AS profile_id,
  pt.team_id,
  GREATEST(0, ROUND(
    CASE km.key
      -- ── Pipeline KPIs (higher is better) ──────────────────────────────────
      WHEN 'stage3_opps'            THEN 2     * pt.m * (0.80 + random() * 0.40)
      WHEN 'closed_won'             THEN 2     * pt.m * (0.80 + random() * 0.40)

      -- ── Engage KPIs (higher is better) ────────────────────────────────────
      WHEN 'sequences_created'      THEN 5     * pt.m * (0.80 + random() * 0.40)
      WHEN 'prospects_enrolled'     THEN 50    * pt.m * (0.80 + random() * 0.40)
      WHEN 'sequence_replies'       THEN 10    * pt.m * (0.80 + random() * 0.40)
      WHEN 'accounts_researched'    THEN 20    * pt.m * (0.80 + random() * 0.40)
      WHEN 'playbooks_executed'     THEN 10    * pt.m * (0.80 + random() * 0.40)
      WHEN 'outreach_drafts_sent'   THEN 25    * pt.m * (0.80 + random() * 0.40)
      WHEN 'ai_content_generated'   THEN 15    * pt.m * (0.80 + random() * 0.40)
      WHEN 'engage_signals_actioned' THEN 20   * pt.m * (0.80 + random() * 0.40)
      WHEN 'engage_deals_influenced' THEN 5    * pt.m * (0.80 + random() * 0.40)

      -- ── Lower-is-better KPIs (inverted multiplier) ───────────────────────
      -- Center slightly above goal so average reps land ~80% attainment.
      -- Top performers (m=1.20) → (2-1.20)=0.80 → lower values = better.
      -- Bottom performers (m=0.65) → (2-0.65)=1.35 → higher values = worse.
      --   response_time: center=2.1, goal=2 → avg rep: 2.1*1.18=2.48, att=2/2.48=81%
      --   sales_cycle:   center=32,  goal=30 → avg rep: 32*1.18=37.8, att=30/37.8=79%
      WHEN 'response_time'          THEN 2.1   * (2 - pt.m) * (0.85 + random() * 0.30)
      WHEN 'sales_cycle_days'       THEN 32    * (2 - pt.m) * (0.85 + random() * 0.30)

      ELSE 0  -- Safety: should never hit since we filter by key
    END
  ::numeric, 1)) AS value,
  w.period_start,
  w.period_end
FROM kpi_metrics km
CROSS JOIN profile_tiers pt
CROSS JOIN (VALUES
  ('2025-09-01'::date, '2025-09-07'::date),
  ('2025-09-08'::date, '2025-09-14'::date),
  ('2025-09-15'::date, '2025-09-21'::date),
  ('2025-09-22'::date, '2025-09-28'::date),
  ('2025-09-29'::date, '2025-10-05'::date),
  ('2025-10-06'::date, '2025-10-12'::date),
  ('2025-10-13'::date, '2025-10-19'::date),
  ('2025-10-20'::date, '2025-10-26'::date),
  ('2025-10-27'::date, '2025-11-02'::date),
  ('2025-11-03'::date, '2025-11-09'::date),
  ('2025-11-10'::date, '2025-11-16'::date),
  ('2025-11-17'::date, '2025-11-23'::date),
  ('2025-11-24'::date, '2025-11-30'::date),
  ('2025-12-01'::date, '2025-12-07'::date),
  ('2025-12-08'::date, '2025-12-14'::date),
  ('2025-12-15'::date, '2025-12-21'::date),
  ('2025-12-22'::date, '2025-12-28'::date),
  ('2025-12-29'::date, '2026-01-04'::date),
  ('2026-01-05'::date, '2026-01-11'::date),
  ('2026-01-12'::date, '2026-01-18'::date),
  ('2026-01-19'::date, '2026-01-25'::date),
  ('2026-01-26'::date, '2026-02-01'::date),
  ('2026-02-02'::date, '2026-02-08'::date),
  ('2026-02-09'::date, '2026-02-15'::date),
  ('2026-02-16'::date, '2026-02-22'::date),
  ('2026-02-23'::date, '2026-03-01'::date),
  ('2026-03-02'::date, '2026-03-08'::date),
  ('2026-03-09'::date, '2026-03-15'::date),
  ('2026-03-16'::date, '2026-03-22'::date)
) AS w(period_start, period_end)
WHERE km.is_active = true
  AND km.key IN (
    'stage3_opps', 'closed_won',
    'sequences_created', 'prospects_enrolled', 'sequence_replies',
    'accounts_researched', 'playbooks_executed', 'outreach_drafts_sent',
    'ai_content_generated', 'engage_signals_actioned', 'engage_deals_influenced',
    'response_time', 'sales_cycle_days'
  );
