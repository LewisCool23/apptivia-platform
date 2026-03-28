-- ========================================================================
-- Migration 064: Scorecard Master Redesign
-- 1. Remove trivial/redundant/ambiguous achievements
-- 2. Add cumulative perfect week milestones (replaces "Weeks Scored")
-- 3. Add above-threshold consistency streaks (80% and 90%)
-- 4. Add entry-level first-80% milestone
-- 5. Add "Big Week" improvement achievement
-- ========================================================================

-- ── 1. Remove "X Weeks Scored" — rewards tenure, not performance ─────────
DELETE FROM achievements
WHERE criteria->>'kpi' = 'scorecards_completed';

-- ── 2. Remove "Key Metric Master" — fires trivially early ────────────────
DELETE FROM achievements
WHERE name = 'Key Metric Master';

-- ── 3. Remove "X Week Key Metric Streak" — ambiguous definition ──────────
DELETE FROM achievements
WHERE criteria->>'kpi' = 'key_metric_100_percent_streak';

-- ── 4. Remove too-granular perfect streak thresholds (2, 4, 8, 15 wks) ──
DELETE FROM achievements
WHERE name IN (
  '2 Week Perfect Streak',
  '4 Week Perfect Streak',
  '8 Week Perfect Streak',
  '15 Week Perfect Streak'
);

-- ── 5. Insert cumulative perfect week milestones ──────────────────────────
-- Uses the same scorecard_100_percent key as "Perfect Score" (threshold=1)
-- but at higher thresholds to reward sustained excellence over time.
INSERT INTO achievements (skillset_id, name, description, points, difficulty, criteria)
SELECT
  s.id,
  m.name,
  m.description,
  m.points,
  m.difficulty,
  m.criteria::jsonb
FROM skillsets s
CROSS JOIN (VALUES
  ('5 Perfect Weeks',  'Achieve a 100%+ scorecard on 5 total weeks',  60,  'medium', '{"kpi": "scorecard_100_percent", "threshold": 5,  "operator": ">=", "cumulative": true}'),
  ('10 Perfect Weeks', 'Achieve a 100%+ scorecard on 10 total weeks', 80,  'hard',   '{"kpi": "scorecard_100_percent", "threshold": 10, "operator": ">=", "cumulative": true}'),
  ('25 Perfect Weeks', 'Achieve a 100%+ scorecard on 25 total weeks', 100, 'hard',   '{"kpi": "scorecard_100_percent", "threshold": 25, "operator": ">=", "cumulative": true}'),
  ('50 Perfect Weeks', 'Achieve a 100%+ scorecard on 50 total weeks', 125, 'expert', '{"kpi": "scorecard_100_percent", "threshold": 50, "operator": ">=", "cumulative": true}')
) AS m(name, description, points, difficulty, criteria)
WHERE s.name = 'Scorecard Master'
ON CONFLICT (skillset_id, name) DO NOTHING;

-- ── 6. Insert above-threshold consistency streak achievements ─────────────
-- scorecard_above_80_streak: max consecutive weeks with Apptivia Score ≥ 80
-- scorecard_above_90_streak: max consecutive weeks with Apptivia Score ≥ 90
-- Gives mid-range reps a clear progression path between 80 → 90 → 100%.
INSERT INTO achievements (skillset_id, name, description, points, difficulty, criteria)
SELECT
  s.id,
  m.name,
  m.description,
  m.points,
  m.difficulty,
  m.criteria::jsonb
FROM skillsets s
CROSS JOIN (VALUES
  ('On My Game',          'Score 80%+ for 4 consecutive weeks', 30, 'easy',   '{"kpi": "scorecard_above_80_streak", "threshold": 4, "operator": ">=", "cumulative": false}'),
  ('Consistent Performer','Score 80%+ for 8 consecutive weeks', 50, 'medium', '{"kpi": "scorecard_above_80_streak", "threshold": 8, "operator": ">=", "cumulative": false}'),
  ('High Achiever',       'Score 90%+ for 4 consecutive weeks', 50, 'medium', '{"kpi": "scorecard_above_90_streak", "threshold": 4, "operator": ">=", "cumulative": false}'),
  ('Elite Performer',     'Score 90%+ for 8 consecutive weeks', 75, 'hard',   '{"kpi": "scorecard_above_90_streak", "threshold": 8, "operator": ">=", "cumulative": false}')
) AS m(name, description, points, difficulty, criteria)
WHERE s.name = 'Scorecard Master'
ON CONFLICT (skillset_id, name) DO NOTHING;

-- ── 7. Insert entry-level first-time milestone ────────────────────────────
-- scorecard_first_80: 1 when any historical week had score ≥ 80
INSERT INTO achievements (skillset_id, name, description, points, difficulty, criteria)
SELECT id,
  'First 80% Score',
  'Score 80%+ on your scorecard for the first time',
  20,
  'easy',
  '{"kpi": "scorecard_first_80", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets WHERE name = 'Scorecard Master'
ON CONFLICT (skillset_id, name) DO NOTHING;

-- ── 8. Insert improvement achievement ────────────────────────────────────
-- scorecard_week_improvement: max single-week score increase vs prior week
INSERT INTO achievements (skillset_id, name, description, points, difficulty, criteria)
SELECT id,
  'Big Week',
  'Improve your Apptivia Score by 20+ points in a single week',
  35,
  'medium',
  '{"kpi": "scorecard_week_improvement", "threshold": 20, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Scorecard Master'
ON CONFLICT (skillset_id, name) DO NOTHING;
