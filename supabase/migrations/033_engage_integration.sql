-- ========================================================================
-- Migration 033: Engage Integration — Skillset, Achievements, Badges, KPIs
-- Wires Apptivia Engage into Coach, Scorecard, Badges & Achievements
-- ========================================================================

-- ── 1. Engage Pro Skillset ───────────────────────────────────────────
-- Insert only if the skillset doesn't already exist

INSERT INTO skillsets (id, name, description, color)
VALUES (
  gen_random_uuid(),
  'Engage Pro',
  'Mastery of Apptivia Engage — sequences, account intelligence, playbooks, prospecting, and pipeline operations.',
  '#06b6d4'  -- cyan-500
)
ON CONFLICT (name) DO NOTHING;


-- ── 2. Engage KPI Metrics ────────────────────────────────────────────
-- These are optional KPIs orgs can add to their scorecard

INSERT INTO kpi_metrics (id, key, name, description, category, goal, weight, is_active, show_on_scorecard)
VALUES
  (gen_random_uuid(), 'sequences_created',       'Sequences Created',      'Number of outreach sequences created',           'engage', 5,   0, true, false),
  (gen_random_uuid(), 'prospects_enrolled',       'Prospects Enrolled',     'Number of prospects enrolled in sequences',      'engage', 50,  0, true, false),
  (gen_random_uuid(), 'sequence_replies',         'Sequence Replies',       'Number of replies received from sequences',      'engage', 10,  0, true, false),
  (gen_random_uuid(), 'accounts_researched',      'Accounts Researched',    'Number of accounts researched via AI',           'engage', 20,  0, true, false),
  (gen_random_uuid(), 'playbooks_executed',       'Playbooks Executed',     'Number of AI playbooks executed',                'engage', 10,  0, true, false),
  (gen_random_uuid(), 'outreach_drafts_sent',     'Outreach Drafts Sent',   'Number of AI-generated outreach drafts sent',    'engage', 25,  0, true, false),
  (gen_random_uuid(), 'ai_content_generated',     'AI Content Generated',   'Number of AI content pieces generated',          'engage', 15,  0, true, false),
  (gen_random_uuid(), 'engage_signals_actioned',  'Signals Actioned',       'Number of intent signals acted upon',            'engage', 20,  0, true, false),
  (gen_random_uuid(), 'engage_deals_influenced',  'Deals Influenced',       'Number of deals influenced by Engage activities','engage', 5,   0, true, false)
ON CONFLICT (key) DO NOTHING;


-- ── 3. Engage Pro Achievements (30+) ─────────────────────────────────
-- Uses the same criteria JSONB pattern: { kpi, threshold, operator, cumulative }

DO $$
DECLARE
  _skillset_id UUID;
BEGIN
  SELECT id INTO _skillset_id FROM skillsets WHERE name = 'Engage Pro' LIMIT 1;

  IF _skillset_id IS NULL THEN
    RAISE NOTICE 'Engage Pro skillset not found — skipping achievements';
    RETURN;
  END IF;

  -- Sequence achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'First Sequence',          'Create your first outreach sequence',                     'easy',   25,  '{"kpi":"sequences_created","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Sequence Builder',        'Create 5 outreach sequences',                             'easy',   50,  '{"kpi":"sequences_created","threshold":5,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Sequence Architect',      'Create 15 outreach sequences',                            'medium', 100, '{"kpi":"sequences_created","threshold":15,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Sequence Master',         'Create 50 outreach sequences',                            'hard',   200, '{"kpi":"sequences_created","threshold":50,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Sequence Legend',         'Create 100 outreach sequences',                           'expert', 400, '{"kpi":"sequences_created","threshold":100,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Enrollment achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'First Enrollment',        'Enroll your first prospect in a sequence',                'easy',   25,  '{"kpi":"prospects_enrolled","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Pipeline Feeder',         'Enroll 25 prospects in sequences',                        'easy',   50,  '{"kpi":"prospects_enrolled","threshold":25,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Outreach Machine',        'Enroll 100 prospects in sequences',                       'medium', 100, '{"kpi":"prospects_enrolled","threshold":100,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Enrollment Expert',       'Enroll 500 prospects in sequences',                       'hard',   200, '{"kpi":"prospects_enrolled","threshold":500,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Enrollment Legend',       'Enroll 1,000 prospects in sequences',                     'expert', 400, '{"kpi":"prospects_enrolled","threshold":1000,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Reply achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'First Reply',             'Get your first reply from a sequence',                    'easy',   30,  '{"kpi":"sequence_replies","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Conversation Starter',    'Get 10 replies from sequences',                           'easy',   60,  '{"kpi":"sequence_replies","threshold":10,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Reply Magnet',            'Get 50 replies from sequences',                           'medium', 120, '{"kpi":"sequence_replies","threshold":50,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Reply Champion',          'Get 200 replies from sequences',                          'hard',   250, '{"kpi":"sequence_replies","threshold":200,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Reply Legend',            'Get 500 replies from sequences',                          'expert', 500, '{"kpi":"sequence_replies","threshold":500,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Account intelligence achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'Account Explorer',        'Research your first account with AI',                     'easy',   25,  '{"kpi":"accounts_researched","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Account Analyst',         'Research 10 accounts with AI',                            'easy',   50,  '{"kpi":"accounts_researched","threshold":10,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Account Strategist',      'Research 50 accounts with AI',                            'medium', 100, '{"kpi":"accounts_researched","threshold":50,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Account Intelligence Pro','Research 150 accounts with AI',                           'hard',   200, '{"kpi":"accounts_researched","threshold":150,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Account Mastermind',      'Research 300 accounts with AI',                           'expert', 400, '{"kpi":"accounts_researched","threshold":300,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Playbook achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'First Play',              'Execute your first AI playbook',                          'easy',   25,  '{"kpi":"playbooks_executed","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Playbook Runner',         'Execute 10 AI playbooks',                                'easy',   50,  '{"kpi":"playbooks_executed","threshold":10,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Playbook Strategist',     'Execute 30 AI playbooks',                                'medium', 100, '{"kpi":"playbooks_executed","threshold":30,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Playbook Commander',      'Execute 75 AI playbooks',                                'hard',   200, '{"kpi":"playbooks_executed","threshold":75,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Playbook Legend',         'Execute 200 AI playbooks',                                'expert', 400, '{"kpi":"playbooks_executed","threshold":200,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Outreach / AI content achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'AI Writer',               'Generate your first AI outreach draft',                   'easy',   25,  '{"kpi":"outreach_drafts_sent","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Outreach Composer',       'Send 25 AI-generated outreach drafts',                   'easy',   50,  '{"kpi":"outreach_drafts_sent","threshold":25,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Outreach Pro',            'Send 100 AI-generated outreach drafts',                  'medium', 100, '{"kpi":"outreach_drafts_sent","threshold":100,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Outreach Machine',        'Send 250 AI-generated outreach drafts',                  'hard',   200, '{"kpi":"outreach_drafts_sent","threshold":250,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Outreach Legend',         'Send 500 AI-generated outreach drafts',                  'expert', 400, '{"kpi":"outreach_drafts_sent","threshold":500,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

  -- Signal achievements
  INSERT INTO achievements (id, skillset_id, name, description, difficulty, points, criteria) VALUES
    (gen_random_uuid(), _skillset_id, 'Signal Spotter',          'Act on your first intent signal',                         'easy',   25,  '{"kpi":"engage_signals_actioned","threshold":1,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Signal Hunter',           'Act on 15 intent signals',                                'easy',   50,  '{"kpi":"engage_signals_actioned","threshold":15,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Signal Analyst',          'Act on 50 intent signals',                                'medium', 100, '{"kpi":"engage_signals_actioned","threshold":50,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Signal Commander',        'Act on 150 intent signals',                               'hard',   200, '{"kpi":"engage_signals_actioned","threshold":150,"operator":">=","cumulative":true}'),
    (gen_random_uuid(), _skillset_id, 'Signal Legend',           'Act on 300 intent signals',                               'expert', 400, '{"kpi":"engage_signals_actioned","threshold":300,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;

END $$;


-- ── 4. Engage Badges (15) ────────────────────────────────────────────

INSERT INTO badge_definitions (id, badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
  -- Core Engage badges
  (gen_random_uuid(), 'engage', 'Prospecting Pioneer',       'Created your first sequence and enrolled prospects',       '🚀', '#06b6d4', 'sequences_created',      1,    50,  false),
  (gen_random_uuid(), 'engage', 'Sequence Specialist',       'Created 10+ sequences with a 15%+ reply rate',            '📬', '#0ea5e9', 'sequences_created',      10,   100, false),
  (gen_random_uuid(), 'engage', 'Reply Rate Champion',       'Achieved 25%+ reply rate across all sequences',           '💬', '#10b981', 'sequence_reply_rate',    25,   150, true),
  (gen_random_uuid(), 'engage', 'Account Strategist',        'Researched 25+ accounts and built buying committees',     '🏢', '#8b5cf6', 'accounts_researched',    25,   100, false),
  (gen_random_uuid(), 'engage', 'Account Intelligence Pro',  'Scored 50+ accounts and identified decision-makers',      '🎯', '#6366f1', 'accounts_researched',    50,   200, true),
  
  -- Playbook badges
  (gen_random_uuid(), 'engage', 'Playbook Apprentice',       'Executed your first AI playbook successfully',            '📖', '#f59e0b', 'playbooks_executed',     1,    50,  false),
  (gen_random_uuid(), 'engage', 'Playbook Master',           'Executed 25+ AI playbooks with positive outcomes',        '🎭', '#ef4444', 'playbooks_executed',     25,   150, true),
  (gen_random_uuid(), 'engage', 'AI Strategist',             'Generated 50+ AI outreach drafts',                        '🤖', '#3b82f6', 'outreach_drafts_sent',   50,   100, false),
  
  -- Signal badges
  (gen_random_uuid(), 'engage', 'Signal Hunter',             'Acted on 20+ buying intent signals',                      '📡', '#14b8a6', 'signals_actioned',       20,   100, false),
  (gen_random_uuid(), 'engage', 'Signal Master',             'Acted on 100+ signals and converted 10%+ to meetings',    '🔮', '#a855f7', 'signals_actioned',       100,  250, true),
  
  -- Pipeline influence badges
  (gen_random_uuid(), 'engage', 'Pipeline Influencer',       'Influenced 5+ deals through Engage activities',           '💰', '#22c55e', 'deals_influenced',       5,    150, false),
  (gen_random_uuid(), 'engage', 'Revenue Catalyst',          'Influenced 25+ deals through Engage activities',          '🏆', '#eab308', 'deals_influenced',       25,   300, true),
  
  -- Combo / mastery badges
  (gen_random_uuid(), 'engage', 'Engage All-Star',           'Used all 7 Engage tabs in a single week',                 '⭐', '#f43f5e', 'engage_tabs_used',       7,    200, true),
  (gen_random_uuid(), 'engage', 'Full Stack Seller',         'Created sequences, researched accounts, and ran playbooks','🔥', '#dc2626', 'engage_combo',           3,    250, true),
  (gen_random_uuid(), 'engage', 'Engage Legend',             '1,000+ Engage activities across all features',            '👑', '#f97316', 'engage_total_activities', 1000, 500, true)
ON CONFLICT (badge_name) DO NOTHING;
