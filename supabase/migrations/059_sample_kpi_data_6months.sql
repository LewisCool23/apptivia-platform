-- Migration 059: Insert 6 months of sample KPI data for all active profiles
-- Covers 27 weeks: 2025-09-01 through 2026-03-08 (Mon–Sun)
-- Only inserts where no row already exists (avoids duplicates)
-- Values are randomized within realistic weekly ranges per KPI key

INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT
  m.id AS kpi_id,
  p.id AS profile_id,
  p.team_id,
  GREATEST(0, ROUND(
    CASE m.key
      WHEN 'call_connects'                 THEN 15  + random() * 45    -- 15–60
      WHEN 'talk_time_minutes'             THEN 60  + random() * 180   -- 60–240
      WHEN 'conversations'                 THEN 5   + random() * 20    -- 5–25
      WHEN 'emails_sent'                   THEN 20  + random() * 60    -- 20–80
      WHEN 'social_touches'               THEN 10  + random() * 30    -- 10–40
      WHEN 'meetings'                      THEN 1   + random() * 5     -- 1–6
      WHEN 'discovery_calls'               THEN 1   + random() * 4     -- 1–5
      WHEN 'demos_completed'               THEN 0   + random() * 3     -- 0–3
      WHEN 'follow_ups'                    THEN 5   + random() * 20    -- 5–25
      WHEN 'sourced_opps'                  THEN 0   + random() * 4     -- 0–4
      WHEN 'stage2_opps'                   THEN 0   + random() * 3     -- 0–3
      WHEN 'qualified_leads'               THEN 0   + random() * 5     -- 0–5
      WHEN 'pipeline_created'              THEN 0   + random() * 50000 -- $0–50k
      WHEN 'pipeline_advanced'             THEN 0   + random() * 30000 -- $0–30k
      WHEN 'response_time'                 THEN 1   + random() * 23    -- 1–24 hrs
      WHEN 'sales_cycle_days'              THEN 14  + random() * 60    -- 14–74 days
      WHEN 'win_rate'                      THEN 10  + random() * 40    -- 10–50 %
      WHEN 'scorecard_100_percent'         THEN ROUND(random())        -- 0 or 1
      WHEN 'scorecard_100_percent_streak'  THEN ROUND(random() * 4)    -- 0–4
      WHEN 'key_metric_100_percent'        THEN ROUND(random())        -- 0 or 1
      WHEN 'key_metric_100_percent_streak' THEN ROUND(random() * 4)    -- 0–4
      WHEN 'scorecards_completed'          THEN ROUND(random())        -- 0 or 1
      ELSE 5 + random() * 20
    END
  ::numeric, 1)) AS value,
  w.period_start,
  w.period_end
FROM kpi_metrics m
CROSS JOIN profiles p
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
WHERE m.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM kpi_values kv
    WHERE kv.profile_id = p.id
      AND kv.kpi_id = m.id
      AND kv.period_start = w.period_start
  );
