-- Migration 060: Wipe all kpi_values and re-seed 6 months of sample data
-- Covers 27 weeks: 2025-09-01 through 2026-03-08 (Mon–Sun)
-- All active profiles × all 21 active kpi_metrics

DELETE FROM kpi_values;

INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT
  m.id AS kpi_id,
  p.id AS profile_id,
  p.team_id,
  GREATEST(0, ROUND(
    CASE m.key
      -- Activity
      WHEN 'call_connects'      THEN 15  + random() * 85    -- 15–100  (goal 100)
      WHEN 'talk_time_minutes'  THEN 40  + random() * 120   -- 40–160  (goal 100)
      WHEN 'dials'              THEN 80  + random() * 170   -- 80–250  (goal 200)
      WHEN 'emails_sent'        THEN 50  + random() * 150   -- 50–200  (goal 150)
      WHEN 'social_touches'     THEN 10  + random() * 60    -- 10–70   (goal 50)
      -- Engagement
      WHEN 'conversations'      THEN 20  + random() * 100   -- 20–120  (goal 80)
      WHEN 'meetings'           THEN 1   + random() * 5     -- 1–6     (goal 3)
      WHEN 'demos_completed'    THEN 1   + random() * 7     -- 1–8     (goal 5)
      WHEN 'follow_ups'         THEN 5   + random() * 45    -- 5–50    (goal 30)
      -- Pipeline
      WHEN 'discovery_calls'    THEN 1   + random() * 11    -- 1–12    (goal 8)
      WHEN 'qualified_leads'    THEN 2   + random() * 13    -- 2–15    (goal 10)
      WHEN 'sourced_opps'       THEN 0   + random() * 6     -- 0–6     (goal 4)
      WHEN 'stage2_opps'        THEN 0   + random() * 5     -- 0–5     (goal 3)
      WHEN 'pipeline_created'   THEN 5000  + random() * 95000  -- $5k–$100k  (goal $50k)
      WHEN 'pipeline_advanced'  THEN 2000  + random() * 58000  -- $2k–$60k   (goal $30k)
      -- Revenue
      WHEN 'closed_won'         THEN ROUND(random() * 4)    -- 0–4     (goal 2)
      WHEN 'revenue_generated'  THEN 10000 + random() * 140000 -- $10k–$150k (goal $100k)
      WHEN 'average_deal_size'  THEN 15000 + random() * 65000  -- $15k–$80k  (goal $50k)
      -- Efficiency
      WHEN 'response_time'      THEN 0.5 + random() * 5     -- 0.5–5.5 hrs (goal 2)
      WHEN 'win_rate'           THEN 10  + random() * 50    -- 10–60 %  (goal 30)
      WHEN 'sales_cycle_days'   THEN 10  + random() * 50    -- 10–60 days (goal 30)
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
WHERE m.is_active = true;
