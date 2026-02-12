-- =============================================================================
-- MIGRATION 021: Fix Badge System and Clean Fake Test Data
-- =============================================================================
-- Purpose: Remove fake test data from day_streak and clean up incorrectly awarded badges
-- Issue: day_streak was set to fake values (12, 7, 35, 5) for testing
--        Badges were awarded based on this fake data
-- Solution: Reset day_streak, remove bad badges, only award based on real data
-- =============================================================================

-- STEP 1: Delete all incorrectly awarded streak badges
-- (Badges awarded based on fake day_streak values)
DO $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM profile_badges
  WHERE badge_type = 'kpi_streak' 
    AND (badge_name LIKE '%Streak%' OR badge_name LIKE '%streak%');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ STEP 1: Deleted % incorrectly awarded streak badges', deleted_count;
  RAISE NOTICE '';
END $$;

-- STEP 2: Reset day_streak to actual values based on scorecard data
-- For now, set to 0 since we need to implement proper streak tracking
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE profiles
  SET day_streak = 0
  WHERE day_streak > 0;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RAISE NOTICE '✓ STEP 2: Reset day_streak for % users to 0', updated_count;
  RAISE NOTICE '  (Will be calculated properly when scorecard streak tracking is implemented)';
  RAISE NOTICE '';
END $$;

-- STEP 3: Create a proper streak badge awarding function that checks real data
CREATE OR REPLACE FUNCTION award_streak_badges_validated()
RETURNS void AS $$
BEGIN
  -- This function will only award badges when proper streak tracking is implemented
  -- For now, it's a placeholder that does nothing to prevent fake badges
  
  -- Future implementation should:
  -- 1. Calculate actual consecutive days meeting all KPIs
  -- 2. Update profiles.day_streak with the calculated value
  -- 3. Award badges based on the validated streak
  
  RAISE NOTICE '⚠️  Streak badge awarding disabled until proper streak tracking is implemented';
  RAISE NOTICE '  When ready, implement streak calculation logic in this function';
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Update award_all_badges to skip streak badges for now
CREATE OR REPLACE FUNCTION award_all_badges()
RETURNS void AS $$
BEGIN
  -- Award all badge types EXCEPT streaks (which are disabled until proper tracking)
  PERFORM award_achievement_badges();
  PERFORM award_contest_badges();
  PERFORM award_scorecard_badges();
  -- PERFORM award_streak_badges(); -- Disabled until proper implementation
  
  RAISE NOTICE '✓ Awarded badges (achievement, contest, scorecard)';
  RAISE NOTICE '⚠️  Streak badges disabled - awaiting proper streak tracking implementation';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ BADGE SYSTEM CLEANED UP!';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CHANGES MADE:';
  RAISE NOTICE '  1. Deleted all incorrectly awarded streak badges';
  RAISE NOTICE '  2. Reset day_streak to 0 for all users';
  RAISE NOTICE '  3. Disabled streak badge awarding until proper tracking exists';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Implement proper scorecard streak tracking logic';
  RAISE NOTICE '  2. Calculate consecutive days meeting KPI thresholds';
  RAISE NOTICE '  3. Re-enable award_streak_badges() when ready';
  RAISE NOTICE '';
  RAISE NOTICE 'VERIFICATION:';
  RAISE NOTICE '  Run: SELECT email, day_streak FROM profiles WHERE day_streak > 0;';
  RAISE NOTICE '  Expected: No rows (all day_streak should be 0)';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
