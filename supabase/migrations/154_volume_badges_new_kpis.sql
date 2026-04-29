-- Migration 154: Add volume badge definitions for 6 new KPIs (F10)
-- Pattern: 4-tier badges per KPI (Starter, Pro, Champion, Legend)

INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, category, rarity, points, is_rare)
VALUES
  -- Dials
  ('volume', 'Dial Starter',         'Made 100 outbound dials',         '📞', '#3F51B5', 'activity', 'common',    30,  false),
  ('volume', 'Dial Pro',             'Made 500 outbound dials',         '☎️', '#3F51B5', 'activity', 'common',    75,  false),
  ('volume', 'Dial Champion',        'Made 1,000 outbound dials',       '📱', '#3F51B5', 'activity', 'rare',     150,  false),
  ('volume', 'Dial Legend',          'Made 5,000 outbound dials',       '🎙️', '#3F51B5', 'activity', 'epic',     300,  true),
  -- Conversations
  ('volume', 'Conversation Starter', 'Had 50 meaningful conversations', '💬', '#009688', 'activity', 'common',    30,  false),
  ('volume', 'Conversation Pro',     'Had 150 meaningful conversations','🗣️', '#009688', 'activity', 'common',    75,  false),
  ('volume', 'Conversation Champion','Had 500 meaningful conversations','🎤', '#009688', 'activity', 'rare',     150,  false),
  ('volume', 'Conversation Legend',  'Had 1,000 meaningful conversations','👥','#009688', 'activity', 'epic',     300,  true),
  -- Demos Completed
  ('volume', 'Demo Starter',        'Completed 10 demos',              '🖥️', '#FF5722', 'activity', 'common',    30,  false),
  ('volume', 'Demo Pro',            'Completed 25 demos',              '📊', '#FF5722', 'activity', 'common',    75,  false),
  ('volume', 'Demo Champion',       'Completed 50 demos',              '🎯', '#FF5722', 'activity', 'rare',     150,  false),
  ('volume', 'Demo Legend',         'Completed 100 demos',             '🏆', '#FF5722', 'activity', 'epic',     300,  true),
  -- Follow-Ups
  ('volume', 'Follow-Up Starter',   'Completed 50 follow-ups',        '📩', '#795548', 'activity', 'common',    30,  false),
  ('volume', 'Follow-Up Pro',       'Completed 150 follow-ups',       '📬', '#795548', 'activity', 'common',    75,  false),
  ('volume', 'Follow-Up Champion',  'Completed 500 follow-ups',       '📮', '#795548', 'activity', 'rare',     150,  false),
  ('volume', 'Follow-Up Legend',    'Completed 1,000 follow-ups',     '💌', '#795548', 'activity', 'epic',     300,  true),
  -- Tasks Completed
  ('volume', 'Task Starter',        'Completed 50 tasks',             '✅', '#4CAF50', 'activity', 'common',    30,  false),
  ('volume', 'Task Pro',            'Completed 150 tasks',            '📋', '#4CAF50', 'activity', 'common',    75,  false),
  ('volume', 'Task Champion',       'Completed 500 tasks',            '📝', '#4CAF50', 'activity', 'rare',     150,  false),
  ('volume', 'Task Legend',         'Completed 1,000 tasks',          '🗂️', '#4CAF50', 'activity', 'epic',     300,  true),
  -- Discovery Calls
  ('volume', 'Discovery Starter',   'Completed 10 discovery calls',   '🔍', '#E91E63', 'activity', 'common',    30,  false),
  ('volume', 'Discovery Pro',       'Completed 25 discovery calls',   '🔎', '#E91E63', 'activity', 'common',    75,  false),
  ('volume', 'Discovery Champion',  'Completed 50 discovery calls',   '🧭', '#E91E63', 'activity', 'rare',     150,  false),
  ('volume', 'Discovery Legend',    'Completed 100 discovery calls',  '🏅', '#E91E63', 'activity', 'epic',     300,  true)
ON CONFLICT DO NOTHING;
