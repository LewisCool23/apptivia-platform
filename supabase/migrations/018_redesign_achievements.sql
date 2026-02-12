-- =============================================================================
-- MIGRATION 018: Redesign Achievement System
-- =============================================================================
-- Purpose: Replace generic achievements with balanced, strategic milestones
-- Includes volume milestones, weekly streaks, scorecard success, and comprehensive KPI coverage
-- Total: ~180 achievements across 6 skillsets (strategic thresholds, not sequential 1-100)
-- =============================================================================

-- Delete old generic milestone achievements (keep mastery level achievements if any exist)
DELETE FROM achievements 
WHERE name LIKE '%Milestone%' 
  AND name NOT LIKE '%mastery level%';

-- Delete any profile_achievements records for deleted achievements
DELETE FROM profile_achievements 
WHERE achievement_id NOT IN (SELECT id FROM achievements);

-- Delete any profile_achievements records for deleted achievements
DELETE FROM profile_achievements 
WHERE achievement_id NOT IN (SELECT id FROM achievements);

-- =============================================================================
-- CALL CONQUEROR - Call Connects (High Volume: 1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500)
-- =============================================================================

-- Volume milestones
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Call Conqueror';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    -- Determine difficulty and points
    IF threshold <= 10 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 100 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 250 THEN
      difficulty_val := 'hard';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Call Connects',
      'Connect with ' || threshold || ' prospects by phone',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'call_connects', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Meetings (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Call Conqueror';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 10;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Meetings Booked',
      'Schedule ' || threshold || ' meetings with prospects',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'meetings', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Call Champion',
  'Connect with 20 prospects in a single week',
  'medium',
  30,
  '{"kpi": "call_connects_weekly", "threshold": 20, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Call Conqueror';

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Meeting Setter',
  'Book 5 meetings in a single week',
  'medium',
  35,
  '{"kpi": "meetings_weekly", "threshold": 5, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Call Conqueror';

-- Dials (High Volume: 1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Call Conqueror';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 10 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 100 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 250 THEN
      difficulty_val := 'hard';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Dials Made',
      'Make ' || threshold || ' outbound calls',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'dials', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements for dials
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Dialing Machine',
  'Make 100 dials in a single week',
  'medium',
  30,
  '{"kpi": "dials_weekly", "threshold": 100, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Call Conqueror';

-- =============================================================================
-- CONVERSATIONALIST - Talk Time, Discovery Calls, Conversations
-- =============================================================================

DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Conversationalist';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 10 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 100 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 250 THEN
      difficulty_val := 'hard';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Minutes Talk Time',
      'Accumulate ' || threshold || ' minutes of conversation time',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'talk_time_minutes', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Discovery Calls (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Conversationalist';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 10;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Discovery Calls',
      'Complete ' || threshold || ' discovery conversations',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'discovery_calls', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Conversations (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Conversationalist';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 10;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Quality Conversations',
      'Have ' || threshold || ' meaningful conversations',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'conversations', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Conversation Pro',
  'Log 60 minutes of talk time in a single week',
  'medium',
  30,
  '{"kpi": "talk_time_minutes_weekly", "threshold": 60, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Conversationalist';

-- =============================================================================
-- EMAIL WARRIOR - Emails Sent (High Volume: 1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500)
-- =============================================================================

DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 10, 20, 25, 40, 50, 60, 75, 90, 100, 150, 200, 250, 300, 400, 500];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Email Warrior';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 10 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 100 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 250 THEN
      difficulty_val := 'hard';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Emails Sent',
      'Send ' || threshold || ' personalized outbound emails',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'emails_sent', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Social touches (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Email Warrior';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSE
      difficulty_val := 'hard';
      points_val := 20;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Social Touches',
      'Make ' || threshold || ' social media outreach touches',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'social_touches', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Email Blitz',
  'Send 50 emails in a single week',
  'medium',
  30,
  '{"kpi": "emails_sent_weekly", "threshold": 50, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Email Warrior';

-- =============================================================================
-- PIPELINE GURU - Opportunities & Pipeline Value
-- =============================================================================

-- Opportunities sourced (Sales targets: 1, 5, 10, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 15;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 25;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 35;
    ELSE
      difficulty_val := 'hard';
      points_val := 50;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Opportunities Created',
      'Source ' || threshold || ' new opportunities for the pipeline',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'sourced_opps', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Stage 2+ advancement (Sales targets: 1, 5, 10, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 15;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 25;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 35;
    ELSE
      difficulty_val := 'hard';
      points_val := 50;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Deals Advanced',
      'Advance ' || threshold || ' deals to Stage 2 or beyond',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'stage2_opps', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Qualified leads (Sales targets: 1, 5, 10, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 15;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 25;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 35;
    ELSE
      difficulty_val := 'hard';
      points_val := 50;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Qualified Leads',
      'Generate ' || threshold || ' qualified leads',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'qualified_leads', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Pipeline value created ($10k, $25k, $50k, $100k, $250k, $500k, $1M, $2M)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000];
  threshold INT;
  threshold_display TEXT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 50000 THEN
      difficulty_val := 'easy';
      points_val := 20;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSIF threshold <= 100000 THEN
      difficulty_val := 'medium';
      points_val := 35;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSIF threshold <= 500000 THEN
      difficulty_val := 'medium';
      points_val := 45;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSE
      difficulty_val := 'hard';
      points_val := 60;
      threshold_display := '$' || (threshold / 1000000)::TEXT || 'M';
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold_display || ' Pipeline Created',
      'Create ' || threshold_display || ' in pipeline value',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'pipeline_created', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Revenue Generated (Sales targets: $1k, $5k, $10k, $25k, $50k, $100k, $250k, $500k, $1M, $2M)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000];
  threshold INT;
  threshold_display TEXT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 10000 THEN
      difficulty_val := 'easy';
      points_val := 20;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSIF threshold <= 50000 THEN
      difficulty_val := 'medium';
      points_val := 35;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSIF threshold <= 250000 THEN
      difficulty_val := 'medium';
      points_val := 50;
      threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
    ELSIF threshold <= 1000000 THEN
      difficulty_val := 'hard';
      points_val := 75;
      IF threshold >= 1000000 THEN
        threshold_display := '$' || (threshold / 1000000)::TEXT || 'M';
      ELSE
        threshold_display := '$' || (threshold / 1000)::TEXT || 'k';
      END IF;
    ELSE
      difficulty_val := 'hard';
      points_val := 100;
      threshold_display := '$' || (threshold / 1000000)::TEXT || 'M';
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold_display || ' Revenue Generated',
      'Generate ' || threshold_display || ' in closed revenue',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'revenue_generated', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Closed Won Deals (Sales targets: 1, 5, 10, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 20;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 40;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 60;
    ELSE
      difficulty_val := 'hard';
      points_val := 80;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Deals Closed',
      'Close ' || threshold || ' won deals',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'closed_won_deals', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Pipeline Advanced (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Pipeline Guru';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 10;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 20;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 30;
    ELSE
      difficulty_val := 'hard';
      points_val := 40;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Deals Progressed',
      'Move ' || threshold || ' deals forward in the pipeline',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'pipeline_advanced', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Pipeline Builder',
  'Create 3 new opportunities in a single week',
  'medium',
  35,
  '{"kpi": "sourced_opps_weekly", "threshold": 3, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Pipeline Guru';

INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Closer',
  'Close 2 deals in a single week',
  'hard',
  50,
  '{"kpi": "closed_won_deals_weekly", "threshold": 2, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Pipeline Guru';

-- =============================================================================
-- TASK MASTER - Tasks, Demos, Follow-ups
-- =============================================================================

-- Tasks completed (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Task Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSE
      difficulty_val := 'hard';
      points_val := 25;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Tasks Completed',
      'Complete ' || threshold || ' tasks before their due date',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'tasks_completed', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Demos completed (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Task Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 10;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 20;
    ELSE
      difficulty_val := 'hard';
      points_val := 30;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Product Demos',
      'Complete ' || threshold || ' product demonstrations',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'demos_completed', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Follow-ups (Moderate: 1, 5, 10, 15, 20, 30, 50, 75, 100)
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[1, 5, 10, 15, 20, 30, 50, 75, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Task Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 5 THEN
      difficulty_val := 'easy';
      points_val := 5;
    ELSIF threshold <= 20 THEN
      difficulty_val := 'medium';
      points_val := 10;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 15;
    ELSE
      difficulty_val := 'hard';
      points_val := 20;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Timely Follow-ups',
      'Complete ' || threshold || ' follow-up activities on time',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'follow_ups', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- Weekly achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Weekly Task Crusher',
  'Complete 10 tasks in a single week',
  'medium',
  25,
  '{"kpi": "tasks_completed_weekly", "threshold": 10, "operator": ">=", "cumulative": false}'::jsonb
FROM skillsets WHERE name = 'Task Master';

-- =============================================================================
-- SCORECARD MASTER - Scorecard Performance & Consistency
-- =============================================================================
-- Note: Create new skillset if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM skillsets WHERE name = 'Scorecard Master') THEN
    INSERT INTO skillsets (name, description, icon)
    VALUES (
      'Scorecard Master',
      'Achieve excellence through consistent scorecard performance and key metric success',
      '📊'
    );
  END IF;
END $$;

-- Initialize profile_skillsets for ALL existing profiles with new skillset
DO $$
DECLARE
  skillset_id_var UUID;
  profile_count INT := 0;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Scorecard Master';
  
  -- Create profile_skillsets records for any profile that doesn't have one yet
  -- Only insert profile_id and skillset_id, let table defaults handle the rest
  INSERT INTO profile_skillsets (profile_id, skillset_id)
  SELECT 
    p.id,
    skillset_id_var
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM profile_skillsets ps 
    WHERE ps.profile_id = p.id 
    AND ps.skillset_id = skillset_id_var
  );
  
  GET DIAGNOSTICS profile_count = ROW_COUNT;
  RAISE NOTICE 'Initialized Scorecard Master skillset for % profiles', profile_count;
END $$;

-- First 100% scorecard achievements
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Perfect Score',
  'Achieve your first 100% scorecard',
  'medium',
  50,
  '{"kpi": "scorecard_100_percent", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets WHERE name = 'Scorecard Master';

-- Consecutive weeks with 100% scorecard
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[2, 3, 4, 5, 8, 10, 15, 20];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Scorecard Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 3 THEN
      difficulty_val := 'medium';
      points_val := 40;
    ELSIF threshold <= 5 THEN
      difficulty_val := 'medium';
      points_val := 60;
    ELSIF threshold <= 10 THEN
      difficulty_val := 'hard';
      points_val := 80;
    ELSE
      difficulty_val := 'hard';
      points_val := 100;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Week Perfect Streak',
      'Achieve ' || threshold || ' consecutive weeks with 100% scorecard',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'scorecard_100_percent_streak', 'threshold', threshold, 'operator', '>=', 'cumulative', false)
    );
  END LOOP;
END $$;

-- First 100% key metric achievements (for individual important metrics)
INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
SELECT 
  id,
  'Key Metric Master',
  'Achieve 100% on a key scorecard metric for the first time',
  'easy',
  25,
  '{"kpi": "key_metric_100_percent", "threshold": 1, "operator": ">=", "cumulative": true}'::jsonb
FROM skillsets WHERE name = 'Scorecard Master';

-- Consecutive weeks with 100% on key metrics
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[2, 3, 4, 5, 8, 10];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Scorecard Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 3 THEN
      difficulty_val := 'easy';
      points_val := 30;
    ELSIF threshold <= 5 THEN
      difficulty_val := 'medium';
      points_val := 45;
    ELSE
      difficulty_val := 'hard';
      points_val := 60;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Week Key Metric Streak',
      'Maintain 100% on key metrics for ' || threshold || ' consecutive weeks',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'key_metric_100_percent_streak', 'threshold', threshold, 'operator', '>=', 'cumulative', false)
    );
  END LOOP;
END $$;

-- Scorecard completion milestones
DO $$
DECLARE
  skillset_id_var UUID;
  thresholds INT[] := ARRAY[5, 10, 25, 50, 100];
  threshold INT;
  difficulty_val TEXT;
  points_val INT;
BEGIN
  SELECT id INTO skillset_id_var FROM skillsets WHERE name = 'Scorecard Master';
  
  FOREACH threshold IN ARRAY thresholds LOOP
    IF threshold <= 10 THEN
      difficulty_val := 'easy';
      points_val := 20;
    ELSIF threshold <= 50 THEN
      difficulty_val := 'medium';
      points_val := 40;
    ELSE
      difficulty_val := 'hard';
      points_val := 75;
    END IF;
    
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      skillset_id_var,
      threshold || ' Scorecards Completed',
      'Complete ' || threshold || ' total scorecards',
      difficulty_val,
      points_val,
      jsonb_build_object('kpi', 'scorecards_completed', 'threshold', threshold, 'operator', '>=', 'cumulative', true)
    );
  END LOOP;
END $$;

-- =============================================================================
-- BADGES FOR SCORECARD MASTER
-- =============================================================================

-- Scorecard Excellence badges
INSERT INTO badge_definitions (badge_name, badge_description, icon, color, badge_type, points, is_rare)
VALUES 
  ('Perfect Score', 'Achieved first 100% scorecard', '🎯', '#10b981', 'achievement', 50, false),
  ('Consistency King', 'Maintained 5+ week perfect scorecard streak', '👑', '#f59e0b', 'achievement', 100, true),
  ('Scorecard Legend', 'Achieved 20 consecutive weeks with 100% scorecard', '🏆', '#8b5cf6', 'achievement', 150, true),
  ('Key Metric Master', 'Hit 100% on key metrics 10+ consecutive weeks', '⭐', '#3b82f6', 'achievement', 75, true),
  ('Performance Pro', 'Completed 100 total scorecards', '📈', '#06b6d4', 'achievement', 100, false),
  ('Scorecard Sensei', 'Ultimate scorecard mastery - all milestones achieved', '🥋', '#ec4899', 'mastery', 200, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT 
  s.name as skillset,
  COUNT(*) as achievement_count,
  SUM(a.points) as total_points_available,
  COUNT(CASE WHEN a.difficulty = 'easy' THEN 1 END) as easy_count,
  COUNT(CASE WHEN a.difficulty = 'medium' THEN 1 END) as medium_count,
  COUNT(CASE WHEN a.difficulty = 'hard' THEN 1 END) as hard_count
FROM achievements a
JOIN skillsets s ON s.id = a.skillset_id
GROUP BY s.id, s.name
ORDER BY s.name;

-- Total achievements
SELECT COUNT(*) as total_achievements, SUM(points) as total_points FROM achievements;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Achievement system redesigned successfully!';
  RAISE NOTICE '  → Replaced 500 generic achievements with ~180 strategic ones across 6 skillsets';
  RAISE NOTICE '  → NEW: Scorecard Master skillset with 22 performance & consistency achievements';
  RAISE NOTICE '  → Added: Dials, Discovery Calls, Conversations, Closed Won Deals, Revenue Generated, Pipeline Advanced';
  RAISE NOTICE '  → Volume milestones: High-volume KPIs (1,10,20,25,40,50,60,75,90,100,150,200,250,300,400,500)';
  RAISE NOTICE '  → Moderate-volume KPIs (1,5,10,15,20,30,50,75,100)';
  RAISE NOTICE '  → Sales targets: Opps/Deals (1,5,10,20,30,50,75,100) + Money ($1k-$2M)';
  RAISE NOTICE '  → Weekly achievements: Realistic goals with repeatable rewards';
  RAISE NOTICE '  → Scorecard achievements: 100%% scores, consecutive week streaks, key metrics';
  RAISE NOTICE '  → All KPIs are integration-friendly (simple counts/sums, no complex calculations)';
  RAISE NOTICE '  → Ready to award retroactively with: SELECT * FROM check_and_award_achievements();';
END $$;
