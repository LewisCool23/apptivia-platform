-- Migration 088: Seed KPI data for Gong, Outreach, and Sendoso integration KPIs
-- Backfills the 11 new KPIs from migration 084 across all 29 weeks (Sep 1 2025 – Mar 22 2026).
-- Uses the same tiered multiplier approach as migrations 061/071/081.
--
-- For "lower is better" KPIs (talk_to_listen_ratio, longest_monologue_sec),
-- the multiplier is inverted: top performers get LOWER values (2 - m).

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
      -- ── Gong Call Intelligence ───────────────────────────────────────────
      -- "Lower is better" KPIs: invert multiplier so top reps get lower values
      WHEN 'talk_to_listen_ratio' THEN 45   * (2 - pt.m) * (0.85 + random() * 0.30)
      WHEN 'longest_monologue_sec' THEN 130 * (2 - pt.m) * (0.85 + random() * 0.30)
      -- "Higher is better" Gong KPIs
      WHEN 'questions_asked'       THEN 8   * pt.m * (0.80 + random() * 0.40)
      WHEN 'next_steps_mentioned'  THEN 5   * pt.m * (0.80 + random() * 0.40)
      WHEN 'interactivity_score'   THEN 70  * pt.m * (0.80 + random() * 0.40)

      -- ── Outreach ────────────────────────────────────────────────────────
      WHEN 'sequences_started'     THEN 10  * pt.m * (0.80 + random() * 0.40)
      WHEN 'emails_opened'         THEN 100 * pt.m * (0.80 + random() * 0.40)
      WHEN 'tasks_completed'       THEN 30  * pt.m * (0.80 + random() * 0.40)

      -- ── Sendoso ─────────────────────────────────────────────────────────
      WHEN 'gifts_sent'               THEN 10 * pt.m * (0.80 + random() * 0.40)
      WHEN 'gifts_accepted'           THEN 5  * pt.m * (0.80 + random() * 0.40)
      WHEN 'gift_influenced_meetings' THEN 3  * pt.m * (0.80 + random() * 0.40)

      ELSE 0
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
    'talk_to_listen_ratio', 'longest_monologue_sec', 'questions_asked',
    'next_steps_mentioned', 'interactivity_score',
    'sequences_started', 'emails_opened', 'tasks_completed',
    'gifts_sent', 'gifts_accepted', 'gift_influenced_meetings'
  )
  AND NOT EXISTS (
    SELECT 1 FROM kpi_values kv
    WHERE kv.kpi_id = km.id
      AND kv.profile_id = pt.id
      AND kv.period_start = w.period_start
      AND kv.period_end = w.period_end
  );
