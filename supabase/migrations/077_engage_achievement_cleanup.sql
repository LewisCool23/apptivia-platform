-- Migration 077: Clean up Engage Pro achievements for removed features
-- Removes achievements tied to features that have no UI in the app:
--   sequences_created, prospects_enrolled, sequence_replies, playbooks_executed
-- Also fixes the "Outreach Machine" naming collision, adds missing achievements,
-- fixes discovery_calls skillset ownership, and adds <= operator support.

BEGIN;

-- ============================================================
-- 1. Delete profile_achievements referencing the 20 achievements
--    being removed (so we don't leave orphaned earned records).
-- ============================================================
DELETE FROM profile_achievements
WHERE achievement_id IN (
  SELECT id FROM achievements
  WHERE criteria->>'kpi' IN ('sequences_created', 'prospects_enrolled', 'sequence_replies', 'playbooks_executed')
);

-- ============================================================
-- 2. Delete the 20 achievements for removed features
-- ============================================================
DELETE FROM achievements
WHERE criteria->>'kpi' IN ('sequences_created', 'prospects_enrolled', 'sequence_replies', 'playbooks_executed');

-- ============================================================
-- 3. Deactivate the KPI metrics for removed features
--    (soft-disable so backend doesn't track them)
-- ============================================================
UPDATE kpi_metrics
SET is_active = false
WHERE key IN ('sequences_created', 'prospects_enrolled', 'sequence_replies', 'playbooks_executed');

-- ============================================================
-- 4. Fix "Outreach Machine" naming collision
--    The outreach_drafts_sent version is renamed to
--    "Outreach Powerhouse" to avoid confusion.
-- ============================================================
UPDATE achievements
SET name = 'Outreach Powerhouse',
    description = 'Send 250 AI-generated outreach drafts'
WHERE name = 'Outreach Machine'
  AND criteria->>'kpi' = 'outreach_drafts_sent';

-- ============================================================
-- 5. Add missing achievements for engage_deals_influenced
-- ============================================================
DO $$
DECLARE
  _sid UUID;
BEGIN
  SELECT id INTO _sid FROM skillsets WHERE LOWER(name) = 'engage pro' LIMIT 1;
  IF _sid IS NULL THEN RETURN; END IF;

  INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
  VALUES
    (_sid, 'Deal Influencer',  'Influence your first deal through Engage signals',  'easy',   25,  '{"kpi":"engage_deals_influenced","threshold":1,"operator":">=","cumulative":true}'),
    (_sid, 'Deal Catalyst',    'Influence 5 deals through Engage signals',          'easy',   50,  '{"kpi":"engage_deals_influenced","threshold":5,"operator":">=","cumulative":true}'),
    (_sid, 'Deal Strategist',  'Influence 15 deals through Engage signals',         'medium', 100, '{"kpi":"engage_deals_influenced","threshold":15,"operator":">=","cumulative":true}'),
    (_sid, 'Deal Commander',   'Influence 40 deals through Engage signals',         'hard',   200, '{"kpi":"engage_deals_influenced","threshold":40,"operator":">=","cumulative":true}'),
    (_sid, 'Deal Legend',      'Influence 100 deals through Engage signals',        'expert', 400, '{"kpi":"engage_deals_influenced","threshold":100,"operator":">=","cumulative":true}')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 6. Add weekly achievement for Engage Pro
-- ============================================================
DO $$
DECLARE
  _sid UUID;
BEGIN
  SELECT id INTO _sid FROM skillsets WHERE LOWER(name) = 'engage pro' LIMIT 1;
  IF _sid IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (SELECT 1 FROM achievements WHERE name = 'Weekly Signal Hunter' AND skillset_id = _sid) THEN
    INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
    VALUES (
      _sid,
      'Weekly Signal Hunter',
      'Act on 5 intent signals in a single week',
      'medium',
      35,
      '{"kpi":"engage_signals_actioned_weekly","threshold":5,"operator":">=","cumulative":false}'
    );
  END IF;
END $$;

-- ============================================================
-- 7. Add missing achievements for Task Master KPIs
--    response_time (inverse: lower is better, uses <= operator)
--    win_rate (percentage, higher is better, uses >=)
-- ============================================================
DO $$
DECLARE
  _sid UUID;
BEGIN
  SELECT id INTO _sid FROM skillsets WHERE LOWER(name) = 'task master' LIMIT 1;
  IF _sid IS NULL THEN RETURN; END IF;

  -- response_time achievements (inverse: <= operator, lower is better)
  INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
  VALUES
    (_sid, 'Quick Responder',     'Achieve an average response time under 60 minutes', 'easy',   15, '{"kpi":"response_time","threshold":60,"operator":"<=","cumulative":false}'),
    (_sid, 'Rapid Responder',     'Achieve an average response time under 30 minutes', 'medium', 25, '{"kpi":"response_time","threshold":30,"operator":"<=","cumulative":false}'),
    (_sid, 'Lightning Responder', 'Achieve an average response time under 15 minutes', 'hard',   40, '{"kpi":"response_time","threshold":15,"operator":"<=","cumulative":false}')
  ON CONFLICT DO NOTHING;

  -- win_rate achievements (percentage, higher is better)
  INSERT INTO achievements (skillset_id, name, description, difficulty, points, criteria)
  VALUES
    (_sid, 'First Win',        'Close your first deal',                         'easy',   20, '{"kpi":"closed_won_deals","threshold":1,"operator":">=","cumulative":true}'),
    (_sid, 'Consistent Closer', 'Maintain a 20% or higher win rate',            'medium', 35, '{"kpi":"win_rate","threshold":20,"operator":">=","cumulative":false}'),
    (_sid, 'Elite Closer',      'Maintain a 40% or higher win rate',            'hard',   60, '{"kpi":"win_rate","threshold":40,"operator":">=","cumulative":false}')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- 8. Fix discovery_calls ownership: move achievements from
--    Conversationalist to Call Conqueror (where the KPI map
--    has discovery_calls).
-- ============================================================
UPDATE achievements
SET skillset_id = (SELECT id FROM skillsets WHERE LOWER(name) = 'call conqueror' LIMIT 1)
WHERE criteria->>'kpi' = 'discovery_calls'
  AND skillset_id = (SELECT id FROM skillsets WHERE LOWER(name) = 'conversationalist' LIMIT 1);

COMMIT;
