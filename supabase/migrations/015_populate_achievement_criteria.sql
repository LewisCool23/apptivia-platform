-- =============================================================================
-- MIGRATION 015: Populate Achievement Criteria
-- =============================================================================
-- Purpose: Add specific KPI requirements to each achievement
-- Extracts milestone numbers from achievement names and maps to KPI thresholds
-- =============================================================================

-- Conversationalist achievements - discovery_calls
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'discovery_calls',
  'threshold', (regexp_match(description, '(\d+) discovery conversations'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Conversationalist Milestone%'
  AND description LIKE '%discovery conversations%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'conversations',
  'threshold', (regexp_match(description, '(\d+) quality conversations'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Conversationalist Milestone%'
  AND description LIKE '%quality conversations%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'talk_time_minutes',
  'threshold', (regexp_match(description, 'Maintain (\d+) seconds'))[1]::int / 60.0,
  'operator', '>=',
  'cumulative', false
)
WHERE name LIKE 'Conversationalist Milestone%'
  AND description LIKE '%Maintain%seconds%talk time%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'talk_listen_ratio',
  'threshold', (regexp_match(description, 'balance to (\d+)%'))[1]::int,
  'operator', '>=',
  'cumulative', false
)
WHERE name LIKE 'Conversationalist Milestone%'
  AND description LIKE '%talk/listen balance%';

-- Call Conqueror achievements - extract from descriptions
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'meetings',
  'threshold', (regexp_match(description, '(\d+) meetings?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Call Conqueror Milestone%'
  AND description LIKE '%meeting%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'call_connects',
  'threshold', (regexp_match(description, '(\d+) (?:outbound )?calls?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Call Conqueror Milestone%'
  AND description LIKE '%call%'
  AND description NOT LIKE '%discovery%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'call_connects',
  'threshold', (regexp_match(description, 'Connect with (\d+) prospects'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Call Conqueror Milestone%'
  AND description LIKE '%Connect with%prospects%';

-- Email Warrior achievements
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'emails_sent',
  'threshold', (regexp_match(description, '(\d+) (?:personalized )?emails?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Email Warrior Milestone%'
  AND description LIKE '%email%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'social_touches',
  'threshold', (regexp_match(description, '(\d+) social touches'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Email Warrior Milestone%'
  AND description LIKE '%social touches%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'email_reply_rate',
  'threshold', (regexp_match(description, 'Maintain a (\d+)% reply rate'))[1]::int,
  'operator', '>=',
  'cumulative', false
)
WHERE name LIKE 'Email Warrior Milestone%'
  AND description LIKE '%reply rate%';

-- Pipeline Guru achievements
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'sourced_opps',
  'threshold', (regexp_match(description, '(?:Source|Create) (\d+) (?:new )?opportunities?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND (description LIKE '%source%opportunit%' OR description LIKE '%create%opportunit%');

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'stage2_opps',
  'threshold', (regexp_match(description, '(\d+) (?:opportunities|opps) to stage 2'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND description LIKE '%stage 2%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'qualified_leads',
  'threshold', (regexp_match(description, '(\d+) qualified leads?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND description LIKE '%qualified lead%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'pipeline_created',
  'threshold', (regexp_match(description, '\$?(\d+)k? in pipeline'))[1]::int * 1000,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND description LIKE '%pipeline%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'sourced_opps',
  'threshold', (regexp_match(description, 'Source (\d+) qualified opportunities'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND description LIKE '%Source%qualified opportunities%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'stage2_opps',
  'threshold', (regexp_match(description, 'Advance (\d+) deals to Stage 2'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Pipeline Guru Milestone%'
  AND description LIKE '%Advance%deals to Stage 2%';

-- Task Master achievements
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'demos_completed',
  'threshold', (regexp_match(description, '(\d+) (?:product )?demos?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Task Master Milestone%'
  AND description LIKE '%demo%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'follow_ups',
  'threshold', (regexp_match(description, '(\d+) (?:timely )?follow-ups?'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Task Master Milestone%'
  AND description LIKE '%follow%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'tasks_completed',
  'threshold', (regexp_match(description, 'Complete (\d+) tasks'))[1]::int,
  'operator', '>=',
  'cumulative', true
)
WHERE name LIKE 'Task Master Milestone%'
  AND description LIKE '%Complete%tasks%';

UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'response_time',
  'threshold', (regexp_match(description, 'under (\d+) (?:hours?|minutes?)'))[1]::int,
  'operator', '<=',
  'cumulative', false
)
WHERE name LIKE 'Task Master Milestone%'
  AND description LIKE '%response time%';

-- Mastery level achievements - based on total points earned in skillset
UPDATE achievements SET criteria = jsonb_build_object(
  'kpi', 'skillset_points',
  'threshold', (regexp_match(description, 'mastery level (\d+)'))[1]::int * 50,
  'operator', '>=',
  'cumulative', true
)
WHERE description LIKE '%mastery level%';

-- =============================================================================
-- First-Time Milestone Achievements
-- =============================================================================
-- Add special achievements for first instance of key metrics

-- Insert first-time achievements for each skillset
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Discovery Call',
  'Complete your first discovery conversation with a prospect',
  'easy',
  10,
  '{"kpi": "discovery_calls", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Conversationalist'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Meeting Booked',
  'Book your first meeting with a prospect',
  'easy',
  10,
  '{"kpi": "meetings", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Call Conqueror'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Call Connect',
  'Successfully connect with your first prospect by phone',
  'easy',
  10,
  '{"kpi": "call_connects", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Call Conqueror'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Email Sent',
  'Send your first personalized outbound email',
  'easy',
  10,
  '{"kpi": "emails_sent", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Email Warrior'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Opportunity Created',
  'Create your first new opportunity in the pipeline',
  'medium',
  15,
  '{"kpi": "sourced_opps", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Pipeline Guru'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Deal to Stage 2',
  'Advance your first deal to Stage 2 or beyond',
  'medium',
  15,
  '{"kpi": "stage2_opps", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Pipeline Guru'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Demo Completed',
  'Complete your first product demonstration',
  'medium',
  15,
  '{"kpi": "demos_completed", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Task Master'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Task Completed',
  'Complete your first task before the due date',
  'easy',
  10,
  '{"kpi": "tasks_completed", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Task Master'
ON CONFLICT DO NOTHING;

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  s.id,
  'First Qualified Lead',
  'Generate your first qualified lead',
  'medium',
  15,
  '{"kpi": "qualified_leads", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets s WHERE s.name = 'Pipeline Guru'
ON CONFLICT DO NOTHING;

-- Verify criteria populated
SELECT 
  s.name as skillset,
  COUNT(*) as total_achievements,
  COUNT(a.criteria) as with_criteria,
  COUNT(*) - COUNT(a.criteria) as missing_criteria
FROM achievements a
JOIN skillsets s ON s.id = a.skillset_id
GROUP BY s.id, s.name
ORDER BY s.name;

-- Show sample achievements with criteria
SELECT 
  s.name as skillset,
  a.name,
  a.description,
  a.difficulty,
  a.points,
  a.criteria
FROM achievements a
JOIN skillsets s ON s.id = a.skillset_id
WHERE a.criteria IS NOT NULL
ORDER BY s.name, (a.criteria->>'threshold')::int
LIMIT 30;

COMMENT ON COLUMN achievements.criteria IS 'JSON object defining KPI requirement: {kpi: string, threshold: number, operator: string, cumulative: boolean}';
