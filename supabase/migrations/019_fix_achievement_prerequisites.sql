-- =============================================================================
-- MIGRATION 019: Fix Achievement Prerequisites
-- =============================================================================
-- Purpose: Fix issue where higher-tier achievements are awarded without
--          ensuring lower-tier prerequisites are met first
-- 
-- Problem: Users have "10 Call Connects" but not "1 Call Connect"
--          Users have "10 Call Connects" but not "10 Dials Made"
--          This is illogical - you can't achieve advanced goals without the basics
-- 
-- Solution: 
-- 1. Update check_and_award_achievements() to process in threshold order
-- 2. Backfill missing prerequisite achievements for existing users
-- =============================================================================

-- Drop and recreate the achievement checking function with proper ordering
DROP FUNCTION IF EXISTS check_and_award_achievements();

CREATE OR REPLACE FUNCTION check_and_award_achievements() RETURNS TABLE(
  profile_email TEXT,
  achievements_awarded INTEGER
) AS $$
DECLARE
  profile_record RECORD;
  achievement_record RECORD;
  total_awarded INTEGER := 0;
  user_kpi_values JSONB;
  criteria_obj JSONB;
  kpi_key TEXT;
  threshold NUMERIC;
  operator_type TEXT;
  is_cumulative BOOLEAN;
  kpi_metric_id UUID;
  cumulative_value NUMERIC;
  meets_criteria BOOLEAN;
BEGIN
  -- Create temp table for results
  CREATE TEMP TABLE IF NOT EXISTS award_results (
    profile_email TEXT,
    achievements_awarded INTEGER
  ) ON COMMIT DROP;

  -- Loop through all profiles
  FOR profile_record IN 
    SELECT p.id, p.email FROM profiles p
  LOOP
    total_awarded := 0;

    -- Get all cumulative KPI values for this profile (all-time)
    WITH kpi_totals AS (
      SELECT 
        km.key,
        COALESCE(SUM(kv.value), 0) as total_value
      FROM kpi_metrics km
      LEFT JOIN kpi_values kv ON kv.kpi_id = km.id AND kv.profile_id = profile_record.id
      WHERE km.is_active = true
      GROUP BY km.key
    )
    SELECT jsonb_object_agg(key, total_value)
    INTO user_kpi_values
    FROM kpi_totals;

    -- If no KPI data, skip this profile
    IF user_kpi_values IS NULL THEN
      CONTINUE;
    END IF;

    -- **CRITICAL FIX**: Check achievements in order by KPI and threshold
    -- This ensures "1 Call Connect" is checked before "10 Call Connects"
    FOR achievement_record IN
      SELECT 
        a.id, 
        a.name, 
        a.criteria, 
        a.skillset_id, 
        a.points,
        (a.criteria->>'kpi') as kpi_order,
        COALESCE((a.criteria->>'threshold')::NUMERIC, 0) as threshold_order
      FROM achievements a
      WHERE a.criteria IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM profile_achievements pa
          WHERE pa.profile_id = profile_record.id
            AND pa.achievement_id = a.id
        )
      -- **KEY CHANGE**: Order by KPI, then threshold (low to high)
      ORDER BY 
        kpi_order,
        threshold_order ASC,
        a.name
    LOOP
      criteria_obj := achievement_record.criteria;
      
      -- Extract criteria fields
      kpi_key := criteria_obj->>'kpi';
      threshold := (criteria_obj->>'threshold')::NUMERIC;
      operator_type := COALESCE(criteria_obj->>'operator', '>=');
      is_cumulative := COALESCE((criteria_obj->>'cumulative')::BOOLEAN, true);

      -- Special handling for skillset_points (mastery level achievements)
      IF kpi_key = 'skillset_points' THEN
        -- Get total points earned in this skillset
        SELECT COALESCE(ps.total_points_earned, 0)
        INTO cumulative_value
        FROM profile_skillsets ps
        WHERE ps.profile_id = profile_record.id
          AND ps.skillset_id = achievement_record.skillset_id;
          
        cumulative_value := COALESCE(cumulative_value, 0);
      ELSE
        -- Get the cumulative value for this KPI from user_kpi_values
        cumulative_value := COALESCE((user_kpi_values->>kpi_key)::NUMERIC, 0);
      END IF;

      -- Check if criteria is met
      meets_criteria := CASE operator_type
        WHEN '>=' THEN cumulative_value >= threshold
        WHEN '>' THEN cumulative_value > threshold
        WHEN '=' THEN cumulative_value = threshold
        WHEN '<=' THEN cumulative_value <= threshold
        WHEN '<' THEN cumulative_value < threshold
        ELSE false
      END;

      -- Award achievement if criteria met
      IF meets_criteria THEN
        -- Use the existing award_achievement function
        IF award_achievement(profile_record.id, achievement_record.id) THEN
          total_awarded := total_awarded + 1;
          
          RAISE NOTICE 'Awarded "%" to % (% % %)',
            achievement_record.name,
            profile_record.email,
            kpi_key,
            operator_type,
            threshold;
        END IF;
      END IF;
    END LOOP;

    -- Store result
    INSERT INTO award_results VALUES (profile_record.email, total_awarded);
  END LOOP;

  -- Return results
  RETURN QUERY SELECT * FROM award_results ORDER BY achievements_awarded DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_and_award_achievements IS 'Scans all profiles and awards achievements based on specific KPI criteria. NOW PROCESSES IN THRESHOLD ORDER to ensure prerequisites are met first.';

-- =============================================================================
-- BACKFILL FUNCTION: Award missing prerequisite achievements
-- =============================================================================
-- This function finds users who have higher-tier achievements but are missing
-- lower-tier prerequisites, and awards those missing achievements

CREATE OR REPLACE FUNCTION backfill_missing_prerequisites() RETURNS TABLE(
  profile_email TEXT,
  missing_achievements_awarded INTEGER
) AS $$
DECLARE
  profile_record RECORD;
  achievement_record RECORD;
  missing_achievement RECORD;
  total_awarded INTEGER := 0;
  user_kpi_values JSONB;
  kpi_key TEXT;
  threshold NUMERIC;
  cumulative_value NUMERIC;
BEGIN
  -- Create temp table for results
  CREATE TEMP TABLE IF NOT EXISTS backfill_results (
    profile_email TEXT,
    missing_achievements_awarded INTEGER
  ) ON COMMIT DROP;

  -- Loop through all profiles
  FOR profile_record IN 
    SELECT p.id, p.email FROM profiles p
  LOOP
    total_awarded := 0;

    -- Get all cumulative KPI values for this profile
    WITH kpi_totals AS (
      SELECT 
        km.key,
        COALESCE(SUM(kv.value), 0) as total_value
      FROM kpi_metrics km
      LEFT JOIN kpi_values kv ON kv.kpi_id = km.id AND kv.profile_id = profile_record.id
      WHERE km.is_active = true
      GROUP BY km.key
    )
    SELECT jsonb_object_agg(key, total_value)
    INTO user_kpi_values
    FROM kpi_totals;

    IF user_kpi_values IS NULL THEN
      CONTINUE;
    END IF;

    -- Find all achievements this user has earned
    -- For each earned achievement, check if all lower-tier achievements are also earned
    FOR achievement_record IN
      SELECT 
        pa.achievement_id,
        a.criteria,
        a.name as earned_achievement_name,
        (a.criteria->>'kpi') as earned_kpi,
        (a.criteria->>'threshold')::NUMERIC as earned_threshold
      FROM profile_achievements pa
      JOIN achievements a ON a.id = pa.achievement_id
      WHERE pa.profile_id = profile_record.id
        AND a.criteria IS NOT NULL
        AND (a.criteria->>'threshold') IS NOT NULL
    LOOP
      kpi_key := achievement_record.earned_kpi;
      threshold := achievement_record.earned_threshold;
      cumulative_value := COALESCE((user_kpi_values->>kpi_key)::NUMERIC, 0);

      -- Find all achievements with the same KPI but lower threshold that are NOT earned
      -- Award them if the user's cumulative value qualifies
      FOR missing_achievement IN
        SELECT 
          a.id as missing_id,
          a.name as missing_name,
          (a.criteria->>'threshold')::NUMERIC as missing_threshold
        FROM achievements a
        WHERE (a.criteria->>'kpi') = kpi_key
          AND (a.criteria->>'threshold')::NUMERIC < threshold
          AND (a.criteria->>'threshold')::NUMERIC <= cumulative_value
          AND NOT EXISTS (
            SELECT 1 FROM profile_achievements pa2
            WHERE pa2.profile_id = profile_record.id
              AND pa2.achievement_id = a.id
          )
      LOOP
        -- Award the missing prerequisite achievement
        IF award_achievement(profile_record.id, missing_achievement.missing_id) THEN
          total_awarded := total_awarded + 1;
          
          RAISE NOTICE 'Backfilled "%" for % (prerequisite for "%")',
            missing_achievement.missing_name,
            profile_record.email,
            achievement_record.earned_achievement_name;
        END IF;
      END LOOP;
    END LOOP;

    INSERT INTO backfill_results VALUES (profile_record.email, total_awarded);
  END LOOP;

  RETURN QUERY SELECT br.profile_email, br.missing_achievements_awarded 
               FROM backfill_results br 
               WHERE br.missing_achievements_awarded > 0 
               ORDER BY br.missing_achievements_awarded DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION backfill_missing_prerequisites IS 'Awards missing lower-tier achievements to users who have higher-tier achievements but are missing prerequisites';

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Achievement prerequisite system fixed!';
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CHANGES MADE:';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '1. Updated check_and_award_achievements() to process achievements in order:';
  RAISE NOTICE '   - Sorted by KPI name, then threshold (low to high)';
  RAISE NOTICE '   - Ensures "1 Call Connect" is awarded before "10 Call Connects"';
  RAISE NOTICE '';
  RAISE NOTICE '2. Created backfill_missing_prerequisites() function to fix existing data:';
  RAISE NOTICE '   - Finds users with higher-tier achievements missing prerequisites';
  RAISE NOTICE '   - Automatically awards missing lower-tier achievements';
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '1. Run the backfill to fix existing data:';
  RAISE NOTICE '   SELECT * FROM backfill_missing_prerequisites();';
  RAISE NOTICE '';
  RAISE NOTICE '2. Test with a fresh award check:';
  RAISE NOTICE '   SELECT * FROM check_and_award_achievements();';
  RAISE NOTICE '';
  RAISE NOTICE '3. Verify in the UI that achievements now appear in logical order';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
END $$;
