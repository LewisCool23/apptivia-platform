-- =============================================================================
-- MIGRATION 016: Criteria-Based Achievement System
-- =============================================================================
-- Purpose: Replace random achievement awarding with specific criteria checking
-- Awards achievements based on actual KPI accomplishments (retroactive, cumulative)
-- =============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS check_and_award_achievements();

-- New function that checks specific achievement criteria
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

    -- Check each achievement that hasn't been earned yet
    FOR achievement_record IN
      SELECT a.id, a.name, a.criteria, a.skillset_id, a.points
      FROM achievements a
      WHERE a.criteria IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM profile_achievements pa
          WHERE pa.profile_id = profile_record.id
            AND pa.achievement_id = a.id
        )
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

COMMENT ON FUNCTION check_and_award_achievements IS 'Scans all profiles and awards achievements based on specific KPI criteria (cumulative, retroactive). Returns table of (email, count) for each user.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Criteria-based achievement system installed!';
  RAISE NOTICE '  → Achievements now awarded based on specific KPI requirements';
  RAISE NOTICE '  → Retroactive: checks all-time cumulative KPI values';
  RAISE NOTICE '  → Each achievement can only be earned once';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage: SELECT * FROM check_and_award_achievements();';
  RAISE NOTICE 'Returns: Table showing each user and how many achievements they earned';
END $$;
