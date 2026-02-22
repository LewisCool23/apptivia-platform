-- =============================================================================
-- Migration 030: Update Scorecard Master achievement names
-- =============================================================================
-- The "X Scorecards Completed" / "Complete X total scorecards" achievements
-- don't make sense because scorecards are not "completed" by users.
-- The scorecard calculates productivity each week automatically.
-- Renaming to "X Weeks Scored" / "Have your scorecard calculated for X total weeks"
-- =============================================================================

UPDATE achievements
SET 
  name = REPLACE(name, 'Scorecards Completed', 'Weeks Scored'),
  description = 'Have your scorecard calculated for ' || 
    REGEXP_REPLACE(name, '[^0-9]', '', 'g') || 
    ' total weeks'
WHERE name LIKE '% Scorecards Completed'
  AND skillset_id = (SELECT id FROM skillsets WHERE name = 'Scorecard Master');

-- Verify the update
SELECT name, description, difficulty, points
FROM achievements
WHERE skillset_id = (SELECT id FROM skillsets WHERE name = 'Scorecard Master')
  AND name LIKE '% Weeks Scored'
ORDER BY points;
