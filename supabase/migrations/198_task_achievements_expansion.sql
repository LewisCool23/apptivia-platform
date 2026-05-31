-- Migration 198: Expand Task Master achievements with higher-tier milestones
-- Existing cumulative: 5, 10, 15, 20, 30, 50, 75, 100 (from migration 018)
-- Existing weekly: 10/week "Weekly Task Crusher" (from migration 018)
-- Adding: 5 higher cumulative tiers + 3 weekly tiers

-- ── 1. Higher-tier cumulative task achievements ─────────────────────────
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT
  s.id,
  milestone.name,
  milestone.description,
  milestone.difficulty,
  milestone.points,
  milestone.criteria::jsonb
FROM skillsets s
CROSS JOIN (VALUES
  (
    '150 Tasks Completed',
    'Complete 150 tasks before their due date',
    'hard', 30,
    '{"kpi": "tasks_completed", "threshold": 150, "operator": ">=", "cumulative": true}'
  ),
  (
    '250 Tasks Completed',
    'Complete 250 tasks before their due date',
    'hard', 40,
    '{"kpi": "tasks_completed", "threshold": 250, "operator": ">=", "cumulative": true}'
  ),
  (
    '500 Tasks Completed',
    'Complete 500 tasks — consistent execution at scale',
    'expert', 60,
    '{"kpi": "tasks_completed", "threshold": 500, "operator": ">=", "cumulative": true}'
  ),
  (
    '750 Tasks Completed',
    'Complete 750 tasks — elite-level task execution',
    'expert', 80,
    '{"kpi": "tasks_completed", "threshold": 750, "operator": ">=", "cumulative": true}'
  ),
  (
    '1000 Tasks Completed',
    'Complete 1000 tasks — legendary task master',
    'expert', 100,
    '{"kpi": "tasks_completed", "threshold": 1000, "operator": ">=", "cumulative": true}'
  )
) AS milestone(name, description, difficulty, points, criteria)
WHERE s.name = 'Task Master'
ON CONFLICT DO NOTHING;

-- ── 2. Additional weekly task achievements ──────────────────────────────
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT
  s.id,
  milestone.name,
  milestone.description,
  milestone.difficulty,
  milestone.points,
  milestone.criteria::jsonb
FROM skillsets s
CROSS JOIN (VALUES
  (
    'Weekly Task Machine',
    'Complete 15 tasks in a single week',
    'medium', 30,
    '{"kpi": "tasks_completed_weekly", "threshold": 15, "operator": ">=", "cumulative": false}'
  ),
  (
    'Weekly Task Dominator',
    'Complete 20 tasks in a single week',
    'hard', 40,
    '{"kpi": "tasks_completed_weekly", "threshold": 20, "operator": ">=", "cumulative": false}'
  ),
  (
    'Weekly Task Legend',
    'Complete 25 tasks in a single week',
    'expert', 50,
    '{"kpi": "tasks_completed_weekly", "threshold": 25, "operator": ">=", "cumulative": false}'
  )
) AS milestone(name, description, difficulty, points, criteria)
WHERE s.name = 'Task Master'
ON CONFLICT DO NOTHING;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('198', 'task_achievements_expansion')
ON CONFLICT DO NOTHING;
