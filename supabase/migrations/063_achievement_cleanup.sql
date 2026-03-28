-- ========================================================================
-- Migration 063: Achievement Cleanup + Talk Time Conversion
-- 1. Remove trivial threshold=1 activity achievements
-- 2. Replace minute-based Talk Time achievements with hour-based milestones
-- ========================================================================

-- ── 1. Delete trivial threshold=1 activity achievements ──────────────────
-- These were identified as too easy/trivial to be meaningful milestones.
-- Removed by name to avoid accidentally deleting Scorecard Master achievements
-- which also have threshold=1 but represent meaningful first-time events.

DELETE FROM achievements WHERE name IN (
  '1 Call Connects',
  '1 Meetings Booked',
  '1 Dials Made',
  '1 Discovery Calls',
  '1 Quality Conversations',
  '1 Minutes Talk Time',
  '1 Emails Sent',
  '1 Social Touches',
  '1 Opportunities Created',
  '1 Deals Advanced',
  '1 Qualified Leads',
  '1 Deals Closed',
  '1 Deals Progressed',
  '1 Tasks Completed',
  '1 Product Demos',
  '1 Timely Follow-ups'
);

-- ── 2. Remove all cumulative minute-based Talk Time achievements ──────────
-- These are being replaced with hour-based milestones below.
-- The criteria->>'kpi' = 'talk_time_minutes' with cumulative: true covers
-- all minute milestones (10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200,
-- 250, 300, 400, 500 minutes). The threshold=1 one was already removed above.

DELETE FROM achievements
WHERE criteria->>'kpi' = 'talk_time_minutes'
  AND (criteria->>'cumulative')::boolean = true;

-- ── 3. Insert hour-based Talk Time achievements ───────────────────────────
-- KPI values remain stored in minutes (talk_time_minutes).
-- Thresholds are in minutes; names reflect hours for readability.
-- Starts with a 30-minute entry point, then progresses through hours.

INSERT INTO achievements (skillset_id, name, description, points, difficulty, criteria)
SELECT
  s.id,
  milestone.name,
  milestone.description,
  milestone.points,
  milestone.difficulty,
  milestone.criteria::jsonb
FROM skillsets s
CROSS JOIN (VALUES
  (
    '30 Minutes Talk Time',
    'Accumulate 30 minutes of total talk time',
    5, 'easy',
    '{"kpi": "talk_time_minutes", "threshold": 30, "operator": ">=", "cumulative": true}'
  ),
  (
    '1 Hour Talk Time',
    'Accumulate 1 hour of total talk time',
    10, 'easy',
    '{"kpi": "talk_time_minutes", "threshold": 60, "operator": ">=", "cumulative": true}'
  ),
  (
    '2 Hours Talk Time',
    'Accumulate 2 hours of total talk time',
    15, 'easy',
    '{"kpi": "talk_time_minutes", "threshold": 120, "operator": ">=", "cumulative": true}'
  ),
  (
    '5 Hours Talk Time',
    'Accumulate 5 hours of total talk time',
    25, 'medium',
    '{"kpi": "talk_time_minutes", "threshold": 300, "operator": ">=", "cumulative": true}'
  ),
  (
    '10 Hours Talk Time',
    'Accumulate 10 hours of total talk time',
    35, 'medium',
    '{"kpi": "talk_time_minutes", "threshold": 600, "operator": ">=", "cumulative": true}'
  ),
  (
    '20 Hours Talk Time',
    'Accumulate 20 hours of total talk time',
    50, 'hard',
    '{"kpi": "talk_time_minutes", "threshold": 1200, "operator": ">=", "cumulative": true}'
  ),
  (
    '40 Hours Talk Time',
    'Accumulate 40 hours of total talk time',
    65, 'hard',
    '{"kpi": "talk_time_minutes", "threshold": 2400, "operator": ">=", "cumulative": true}'
  ),
  (
    '60 Hours Talk Time',
    'Accumulate 60 hours of total talk time',
    75, 'hard',
    '{"kpi": "talk_time_minutes", "threshold": 3600, "operator": ">=", "cumulative": true}'
  ),
  (
    '100 Hours Talk Time',
    'Accumulate 100 hours of total talk time',
    100, 'expert',
    '{"kpi": "talk_time_minutes", "threshold": 6000, "operator": ">=", "cumulative": true}'
  ),
  (
    '200 Hours Talk Time',
    'Accumulate 200 hours of total talk time',
    125, 'expert',
    '{"kpi": "talk_time_minutes", "threshold": 12000, "operator": ">=", "cumulative": true}'
  ),
  (
    '500 Hours Talk Time',
    'Accumulate 500 hours of total talk time — elite-level phone execution',
    150, 'expert',
    '{"kpi": "talk_time_minutes", "threshold": 30000, "operator": ">=", "cumulative": true}'
  )
) AS milestone(name, description, points, difficulty, criteria)
WHERE s.name = 'Conversationalist';
