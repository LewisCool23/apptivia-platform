-- Migration 081: Seed KPI data for last week (March 16–22, 2026)
-- Adds one week of data for all reps across all active KPI metrics.
-- Uses the same tiered multiplier approach as migrations 061/071.

INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
WITH profile_tiers AS (
  SELECT id, team_id,
    CASE (first_name || ' ' || last_name)
      -- Top 10%: 100%+ score
      WHEN 'Sarah Johnson'       THEN 1.20
      WHEN 'Elijah Hart'         THEN 1.12
      -- Bottom 10%: 60–79% score
      WHEN 'Testy McTester'      THEN 0.72
      WHEN 'Testington Passalot' THEN 0.65
      -- Middle 80%: 80–99% score
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
      -- Scorecard KPIs: goal * multiplier * weekly variation
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
  '2026-03-16'::date AS period_start,
  '2026-03-22'::date AS period_end
FROM kpi_metrics km
CROSS JOIN profile_tiers pt
WHERE km.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM kpi_values kv
    WHERE kv.kpi_id = km.id
      AND kv.profile_id = pt.id
      AND kv.period_start = '2026-03-16'::date
      AND kv.period_end = '2026-03-22'::date
  );
