-- Migration 061: Re-seed kpi_values with realistic tiered performance
-- Distribution: 10% at 100%+, 80% at 80-99%, 10% at 60-79%
--
-- Score formula: SUM(value/goal * weight * 100) across 5 scorecard KPIs
-- Scorecard KPIs (show_on_scorecard=true):
--   call_connects     goal=100  weight=0.30
--   talk_time_minutes goal=100  weight=0.30
--   meetings          goal=3    weight=0.10
--   sourced_opps      goal=4    weight=0.10
--   stage2_opps       goal=3    weight=0.20
-- Since weights sum to 1.0, score = multiplier * 100
--
-- Weekly variation: (0.92 + random()*0.16) averages to exactly 1.0
-- so the weekly average equals goal * multiplier, hitting the target score.

DELETE FROM kpi_values;

INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
WITH profile_tiers AS (
  SELECT id, team_id,
    CASE (first_name || ' ' || last_name)
      -- Top 10%: 100%+ score (2 of 20 reps)
      WHEN 'Sarah Johnson'       THEN 1.20
      WHEN 'Elijah Hart'         THEN 1.12
      -- Bottom 10%: 60–79% score (2 of 20 reps)
      WHEN 'Testy McTester'      THEN 0.72
      WHEN 'Testington Passalot' THEN 0.65
      -- Middle 80%: 80–99% score (16 of 20 reps)
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
)
SELECT
  km.id AS kpi_id,
  pt.id AS profile_id,
  pt.team_id,
  GREATEST(0, ROUND(
    CASE km.key
      -- Scorecard KPIs: goal * multiplier * weekly variation (averages to goal * multiplier)
      WHEN 'call_connects'      THEN 100    * pt.m * (0.92 + random() * 0.16)
      WHEN 'talk_time_minutes'  THEN 100    * pt.m * (0.92 + random() * 0.16)
      WHEN 'meetings'           THEN 3      * pt.m * (0.92 + random() * 0.16)
      WHEN 'sourced_opps'       THEN 4      * pt.m * (0.92 + random() * 0.16)
      WHEN 'stage2_opps'        THEN 3      * pt.m * (0.92 + random() * 0.16)
      -- Non-scorecard KPIs: realistic weekly ranges, scaled by same multiplier
      WHEN 'dials'              THEN 200    * pt.m * (0.80 + random() * 0.40)
      WHEN 'emails_sent'        THEN 150    * pt.m * (0.80 + random() * 0.40)
      WHEN 'social_touches'     THEN 50     * pt.m * (0.80 + random() * 0.40)
      WHEN 'conversations'      THEN 80     * pt.m * (0.80 + random() * 0.40)
      WHEN 'demos_completed'    THEN 5      * pt.m * (0.80 + random() * 0.40)
      WHEN 'follow_ups'         THEN 30     * pt.m * (0.80 + random() * 0.40)
      WHEN 'discovery_calls'    THEN 8      * pt.m * (0.80 + random() * 0.40)
      WHEN 'qualified_leads'    THEN 10     * pt.m * (0.80 + random() * 0.40)
      WHEN 'pipeline_created'   THEN 50000  * pt.m * (0.80 + random() * 0.40)
      WHEN 'pipeline_advanced'  THEN 30000  * pt.m * (0.80 + random() * 0.40)
      WHEN 'closed_won'         THEN 2      * pt.m * (0.80 + random() * 0.40)
      WHEN 'revenue_generated'  THEN 100000 * pt.m * (0.80 + random() * 0.40)
      WHEN 'average_deal_size'  THEN 50000  * pt.m * (0.80 + random() * 0.40)
      WHEN 'response_time'      THEN 2      * pt.m * (0.80 + random() * 0.40)
      WHEN 'win_rate'           THEN 30     * pt.m * (0.80 + random() * 0.40)
      WHEN 'sales_cycle_days'   THEN 30     * pt.m * (0.80 + random() * 0.40)
      ELSE                           10     * pt.m * (0.80 + random() * 0.40)
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
  ('2026-03-02'::date, '2026-03-08'::date)
) AS w(period_start, period_end)
WHERE km.is_active = true;
