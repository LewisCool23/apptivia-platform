-- Migration 013: Cumulative Progression System
-- Implements true cumulative progression: Activities → KPIs → Achievements → Skillsets → Apptivia Levels
-- This creates the complete gamification flow where progression never resets

-- =============================================================================
-- STEP 1: Ensure profile_achievements table exists with proper structure
-- =============================================================================
CREATE TABLE IF NOT EXISTS profile_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  points_awarded INTEGER DEFAULT 0,
  UNIQUE(profile_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_achievements_profile_id ON profile_achievements(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_achievements_achievement_id ON profile_achievements(achievement_id);

-- =============================================================================
-- STEP 2: Add milestone tracking to profile_skillsets
-- =============================================================================
ALTER TABLE profile_skillsets 
  ADD COLUMN IF NOT EXISTS milestone_25_reached BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_50_reached BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_75_reached BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_100_reached BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_points_earned INTEGER DEFAULT 0;

-- =============================================================================
-- STEP 3: Function to calculate skillset progress from earned achievements
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_skillset_progress(
  p_profile_id UUID,
  p_skillset_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_total_points_earned INTEGER;
  max_possible_points INTEGER;
  progress_percentage NUMERIC;
BEGIN
  -- Calculate total points earned from achievements in this skillset
  SELECT COALESCE(SUM(a.points), 0)
  INTO v_total_points_earned
  FROM profile_achievements pa
  JOIN achievements a ON pa.achievement_id = a.id
  WHERE pa.profile_id = p_profile_id
    AND a.skillset_id = p_skillset_id;
  
  -- Each skillset has 100 achievements with varying points
  -- Easy (33): 5pts each = 165pts
  -- Medium (33): 10pts each = 330pts
  -- Hard (34): 20pts each = 680pts
  -- Total max: 1175 points per skillset
  max_possible_points := 1175;
  
  -- Calculate percentage (0-100)
  progress_percentage := (v_total_points_earned::NUMERIC / max_possible_points) * 100;
  
  -- Update the profile_skillsets record
  UPDATE profile_skillsets
  SET 
    progress = LEAST(progress_percentage, 100),
    total_points_earned = v_total_points_earned,
    achievements_completed = (
      SELECT COUNT(*)
      FROM profile_achievements pa
      JOIN achievements a ON pa.achievement_id = a.id
      WHERE pa.profile_id = p_profile_id
        AND a.skillset_id = p_skillset_id
    ),
    updated_at = NOW()
  WHERE profile_id = p_profile_id
    AND skillset_id = p_skillset_id;
  
  RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Function to award milestone bonus points to total_points
-- =============================================================================
CREATE OR REPLACE FUNCTION award_skillset_milestone_points(
  p_profile_id UUID,
  p_skillset_id UUID,
  p_new_progress NUMERIC
) RETURNS VOID AS $$
DECLARE
  milestone_reached TEXT;
  bonus_points INTEGER := 0;
  skillset_record RECORD;
BEGIN
  -- Get current milestone status
  SELECT * INTO skillset_record
  FROM profile_skillsets
  WHERE profile_id = p_profile_id
    AND skillset_id = p_skillset_id;
  
  -- Check and award points for each milestone (only once)
  IF p_new_progress >= 25 AND NOT skillset_record.milestone_25_reached THEN
    bonus_points := 250;
    milestone_reached := '25% Milestone';
    UPDATE profile_skillsets
    SET milestone_25_reached = TRUE
    WHERE profile_id = p_profile_id AND skillset_id = p_skillset_id;
  ELSIF p_new_progress >= 50 AND NOT skillset_record.milestone_50_reached THEN
    bonus_points := 500;
    milestone_reached := '50% Milestone';
    UPDATE profile_skillsets
    SET milestone_50_reached = TRUE
    WHERE profile_id = p_profile_id AND skillset_id = p_skillset_id;
  ELSIF p_new_progress >= 75 AND NOT skillset_record.milestone_75_reached THEN
    bonus_points := 750;
    milestone_reached := '75% Milestone';
    UPDATE profile_skillsets
    SET milestone_75_reached = TRUE
    WHERE profile_id = p_profile_id AND skillset_id = p_skillset_id;
  ELSIF p_new_progress >= 100 AND NOT skillset_record.milestone_100_reached THEN
    bonus_points := 1000;
    milestone_reached := '100% Mastery';
    UPDATE profile_skillsets
    SET milestone_100_reached = TRUE
    WHERE profile_id = p_profile_id AND skillset_id = p_skillset_id;
  END IF;
  
  -- Award bonus points to total_points for Apptivia Level progression
  IF bonus_points > 0 THEN
    UPDATE profiles
    SET total_points = total_points + bonus_points
    WHERE id = p_profile_id;
    
    RAISE NOTICE 'Awarded % points to profile % for % of skillset %',
      bonus_points, p_profile_id, milestone_reached, p_skillset_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 5: Function to update Apptivia Level based on total_points
-- =============================================================================
CREATE OR REPLACE FUNCTION update_apptivia_level(p_profile_id UUID) RETURNS TEXT AS $$
DECLARE
  current_points INTEGER;
  new_level TEXT;
BEGIN
  SELECT total_points INTO current_points
  FROM profiles
  WHERE id = p_profile_id;
  
  -- Determine level based on total points
  new_level := CASE
    WHEN current_points >= 10000 THEN 'Diamond'
    WHEN current_points >= 5000 THEN 'Platinum'
    WHEN current_points >= 2500 THEN 'Gold'
    WHEN current_points >= 1000 THEN 'Silver'
    ELSE 'Bronze'
  END;
  
  -- Update the profile's level
  UPDATE profiles
  SET apptivia_level = new_level
  WHERE id = p_profile_id;
  
  RETURN new_level;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 6: Function to award achievement to a profile
-- =============================================================================
CREATE OR REPLACE FUNCTION award_achievement(
  p_profile_id UUID,
  p_achievement_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  achievement_points INTEGER;
  achievement_skillset UUID;
  new_progress NUMERIC;
  already_earned BOOLEAN;
BEGIN
  -- Check if achievement already earned
  SELECT EXISTS(
    SELECT 1 FROM profile_achievements
    WHERE profile_id = p_profile_id
      AND achievement_id = p_achievement_id
  ) INTO already_earned;
  
  IF already_earned THEN
    RETURN FALSE;
  END IF;
  
  -- Get achievement details
  SELECT points, skillset_id INTO achievement_points, achievement_skillset
  FROM achievements
  WHERE id = p_achievement_id;
  
  -- Award the achievement
  INSERT INTO profile_achievements (profile_id, achievement_id, points_awarded)
  VALUES (p_profile_id, p_achievement_id, achievement_points);
  
  -- Add achievement points directly to total_points
  UPDATE profiles
  SET total_points = total_points + achievement_points
  WHERE id = p_profile_id;
  
  -- Recalculate skillset progress
  new_progress := calculate_skillset_progress(p_profile_id, achievement_skillset);
  
  -- Check and award milestone bonuses
  PERFORM award_skillset_milestone_points(p_profile_id, achievement_skillset, new_progress);
  
  -- Update Apptivia Level
  PERFORM update_apptivia_level(p_profile_id);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 7: Function to check KPI performance and award achievements
-- =============================================================================
CREATE OR REPLACE FUNCTION check_and_award_achievements() RETURNS INTEGER AS $$
DECLARE
  profile_record RECORD;
  kpi_record RECORD;
  achievement_record RECORD;
  achievements_awarded INTEGER := 0;
  kpi_value NUMERIC;
  kpi_percentage NUMERIC;
BEGIN
  -- Loop through all active profiles
  FOR profile_record IN 
    SELECT id FROM profiles WHERE id IS NOT NULL
  LOOP
    -- Get latest KPI values for this profile
    FOR kpi_record IN
      SELECT 
        kv.kpi_id,
        kv.value,
        km.key,
        km.goal,
        (CASE 
          WHEN km.goal > 0 THEN (kv.value / km.goal * 100)
          ELSE 0
        END) as percentage
      FROM kpi_values kv
      JOIN kpi_metrics km ON kv.kpi_id = km.id
      WHERE kv.profile_id = profile_record.id
        AND kv.period_end >= CURRENT_DATE - INTERVAL '7 days'
        AND km.is_active = true
      ORDER BY kv.period_end DESC
    LOOP
      -- Check for achievements that should be earned based on this KPI
      -- For now, we'll use a simple threshold system
      -- Achievements are earned when KPI performance exceeds thresholds
      
      -- Easy achievements: 60% of goal
      IF kpi_record.percentage >= 60 THEN
        FOR achievement_record IN
          SELECT a.id, a.skillset_id, a.difficulty
          FROM achievements a
          WHERE a.difficulty = 'easy'
            AND NOT EXISTS (
              SELECT 1 FROM profile_achievements pa
              WHERE pa.profile_id = profile_record.id
                AND pa.achievement_id = a.id
            )
          LIMIT 1  -- Award one at a time
        LOOP
          IF award_achievement(profile_record.id, achievement_record.id) THEN
            achievements_awarded := achievements_awarded + 1;
          END IF;
        END LOOP;
      END IF;
      
      -- Medium achievements: 80% of goal
      IF kpi_record.percentage >= 80 THEN
        FOR achievement_record IN
          SELECT a.id, a.skillset_id, a.difficulty
          FROM achievements a
          WHERE a.difficulty = 'medium'
            AND NOT EXISTS (
              SELECT 1 FROM profile_achievements pa
              WHERE pa.profile_id = profile_record.id
                AND pa.achievement_id = a.id
            )
          LIMIT 1
        LOOP
          IF award_achievement(profile_record.id, achievement_record.id) THEN
            achievements_awarded := achievements_awarded + 1;
          END IF;
        END LOOP;
      END IF;
      
      -- Hard achievements: 100% of goal or higher
      IF kpi_record.percentage >= 100 THEN
        FOR achievement_record IN
          SELECT a.id, a.skillset_id, a.difficulty
          FROM achievements a
          WHERE a.difficulty = 'hard'
            AND NOT EXISTS (
              SELECT 1 FROM profile_achievements pa
              WHERE pa.profile_id = profile_record.id
                AND pa.achievement_id = a.id
            )
          LIMIT 1
        LOOP
          IF award_achievement(profile_record.id, achievement_record.id) THEN
            achievements_awarded := achievements_awarded + 1;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN achievements_awarded;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 8: Initialize profile_skillsets for all profiles
-- =============================================================================
DO $$
DECLARE
  profile_record RECORD;
  skillset_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM profiles LOOP
    FOR skillset_record IN SELECT id FROM skillsets LOOP
      INSERT INTO profile_skillsets (
        profile_id,
        skillset_id,
        progress,
        achievements_completed,
        total_points_earned,
        milestone_25_reached,
        milestone_50_reached,
        milestone_75_reached,
        milestone_100_reached
      )
      VALUES (
        profile_record.id,
        skillset_record.id,
        0,
        0,
        0,
        FALSE,
        FALSE,
        FALSE,
        FALSE
      )
      ON CONFLICT (profile_id, skillset_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- STEP 9: Recalculate all existing skillset progress from profile_achievements
-- =============================================================================
DO $$
DECLARE
  profile_skillset_record RECORD;
  new_progress NUMERIC;
BEGIN
  FOR profile_skillset_record IN 
    SELECT profile_id, skillset_id
    FROM profile_skillsets
  LOOP
    new_progress := calculate_skillset_progress(
      profile_skillset_record.profile_id,
      profile_skillset_record.skillset_id
    );
  END LOOP;
END $$;

-- =============================================================================
-- STEP 10: Update all Apptivia Levels based on current total_points
-- =============================================================================
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM profiles LOOP
    PERFORM update_apptivia_level(profile_record.id);
  END LOOP;
END $$;

-- =============================================================================
-- Comments and Documentation
-- =============================================================================
COMMENT ON FUNCTION calculate_skillset_progress IS 'Calculates skillset mastery percentage based on cumulative achievement points earned (never decreases)';
COMMENT ON FUNCTION award_skillset_milestone_points IS 'Awards bonus points to total_points when skillset reaches 25%, 50%, 75%, or 100% (one-time awards)';
COMMENT ON FUNCTION update_apptivia_level IS 'Updates profile Apptivia Level based on total_points: Bronze (0-999), Silver (1000-2499), Gold (2500-4999), Platinum (5000-9999), Diamond (10000+)';
COMMENT ON FUNCTION award_achievement IS 'Awards an achievement to a profile, updates skillset progress, checks milestones, and updates Apptivia Level';
COMMENT ON FUNCTION check_and_award_achievements IS 'Scans all profiles and awards new achievements based on recent KPI performance thresholds';

COMMENT ON TABLE profile_achievements IS 'Permanent record of earned achievements - achievements are never removed once earned';
COMMENT ON COLUMN profile_skillsets.milestone_25_reached IS 'TRUE if 25% milestone bonus (250 pts) has been awarded';
COMMENT ON COLUMN profile_skillsets.milestone_50_reached IS 'TRUE if 50% milestone bonus (500 pts) has been awarded';
COMMENT ON COLUMN profile_skillsets.milestone_75_reached IS 'TRUE if 75% milestone bonus (750 pts) has been awarded';
COMMENT ON COLUMN profile_skillsets.milestone_100_reached IS 'TRUE if 100% mastery bonus (1000 pts) has been awarded';
COMMENT ON COLUMN profile_skillsets.total_points_earned IS 'Cumulative achievement points earned for this skillset (used to calculate progress)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Cumulative Progression System installed successfully!';
  RAISE NOTICE '  → Activities drive KPI performance';
  RAISE NOTICE '  → KPI thresholds award achievements (permanent)';
  RAISE NOTICE '  → Achievements drive skillset mastery (cumulative)';
  RAISE NOTICE '  → Skillset milestones award bonus points';
  RAISE NOTICE '  → Total points determine Apptivia Level';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage: Call check_and_award_achievements() to scan performance and award new achievements';
END $$;
