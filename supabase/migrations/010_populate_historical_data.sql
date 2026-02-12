-- Migration: Populate historical data for active profiles
-- Adds historical KPI values, achievements, and badges for all active users

-- Generate historical KPI values for the past 12 weeks for all active profiles
DO $$
DECLARE
  profile_record RECORD;
  kpi_record RECORD;
  week_offset INTEGER;
  period_start_date DATE;
  period_end_date DATE;
  random_value NUMERIC;
  current_date_val DATE := CURRENT_DATE;
BEGIN
  -- Loop through all active profiles
  FOR profile_record IN 
    SELECT id FROM profiles WHERE id IS NOT NULL
  LOOP
    -- Loop through all active KPI metrics
    FOR kpi_record IN 
      SELECT id, key, goal, unit FROM kpi_metrics WHERE is_active = true
    LOOP
      -- Generate data for past 12 weeks
      FOR week_offset IN 0..11 LOOP
        period_start_date := current_date_val - (week_offset * 7 + 6);
        period_end_date := current_date_val - (week_offset * 7);
        
        -- Generate realistic random values based on KPI type and goal
        CASE 
          WHEN kpi_record.unit = 'count' THEN
            random_value := FLOOR(kpi_record.goal * (0.6 + random() * 0.8))::NUMERIC;
          WHEN kpi_record.unit = 'minutes' OR kpi_record.unit = 'hours' THEN
            random_value := FLOOR(kpi_record.goal * (0.5 + random() * 0.9))::NUMERIC;
          WHEN kpi_record.unit = 'currency' THEN
            random_value := FLOOR(kpi_record.goal * (0.4 + random() * 1.0))::NUMERIC;
          WHEN kpi_record.unit = 'percentage' THEN
            random_value := FLOOR(kpi_record.goal * (0.7 + random() * 0.6))::NUMERIC;
          WHEN kpi_record.unit = 'days' THEN
            random_value := FLOOR(kpi_record.goal * (0.8 + random() * 0.5))::NUMERIC;
          ELSE
            random_value := FLOOR(kpi_record.goal * (0.6 + random() * 0.8))::NUMERIC;
        END CASE;
        
        -- Insert or update the KPI value
        INSERT INTO kpi_values (profile_id, kpi_id, value, period_start, period_end)
        VALUES (
          profile_record.id,
          kpi_record.id,
          random_value,
          period_start_date,
          period_end_date
        )
        ON CONFLICT (profile_id, kpi_id, period_start, period_end) 
        DO UPDATE SET value = EXCLUDED.value;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Populate achievements for all active profiles (at least 10 each)
DO $$
DECLARE
  profile_record RECORD;
  achievement_record RECORD;
  achievement_count INTEGER;
  completed_date TIMESTAMP;
BEGIN
  FOR profile_record IN 
    SELECT id FROM profiles WHERE id IS NOT NULL
  LOOP
    achievement_count := 0;
    
    FOR achievement_record IN 
      SELECT id FROM achievements ORDER BY random() LIMIT 15
    LOOP
      -- Randomly decide if achievement is completed (80% chance)
      IF random() > 0.2 AND achievement_count < 12 THEN
        -- Generate random completion date in past 90 days
        completed_date := NOW() - (random() * 90 || ' days')::INTERVAL;
        
        INSERT INTO profile_achievements (profile_id, achievement_id, completed_at)
        VALUES (profile_record.id, achievement_record.id, completed_date)
        ON CONFLICT (profile_id, achievement_id) DO NOTHING;
        
        achievement_count := achievement_count + 1;
      END IF;
      
      EXIT WHEN achievement_count >= 10;
    END LOOP;
  END LOOP;
END $$;

-- Populate badges for all active profiles (at least 5 each)
DO $$
DECLARE
  profile_record RECORD;
  badge_record RECORD;
  badge_count INTEGER;
  earned_date TIMESTAMP;
BEGIN
  FOR profile_record IN 
    SELECT id FROM profiles WHERE id IS NOT NULL
  LOOP
    badge_count := 0;
    
    FOR badge_record IN 
      SELECT id FROM badges ORDER BY random() LIMIT 8
    LOOP
      -- Randomly decide if badge is earned (70% chance)
      IF random() > 0.3 AND badge_count < 7 THEN
        -- Generate random earned date in past 120 days
        earned_date := NOW() - (random() * 120 || ' days')::INTERVAL;
        
        INSERT INTO profile_badges (profile_id, badge_id, earned_at)
        VALUES (profile_record.id, badge_record.id, earned_date)
        ON CONFLICT (profile_id, badge_id) DO NOTHING;
        
        badge_count := badge_count + 1;
      END IF;
      
      EXIT WHEN badge_count >= 5;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON TABLE kpi_values IS 'Includes historical data for past 12 weeks for all active profiles';
COMMENT ON TABLE profile_achievements IS 'All active profiles have at least 10 completed achievements';
COMMENT ON TABLE profile_badges IS 'All active profiles have at least 5 earned badges';
