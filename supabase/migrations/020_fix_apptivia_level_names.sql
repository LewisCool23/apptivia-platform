-- =============================================================================
-- Migration 020: Fix Apptivia Level Names
-- Standardize level names from Bronze/Silver/Gold/Platinum/Diamond 
-- to Developing/Intermediate/Proficient/Elite/Master
-- =============================================================================

-- Update existing profile level values to new naming convention
UPDATE profiles SET apptivia_level = 'Developing' WHERE apptivia_level = 'Bronze';
UPDATE profiles SET apptivia_level = 'Intermediate' WHERE apptivia_level = 'Silver';
UPDATE profiles SET apptivia_level = 'Proficient' WHERE apptivia_level = 'Gold';
UPDATE profiles SET apptivia_level = 'Elite' WHERE apptivia_level = 'Platinum';
UPDATE profiles SET apptivia_level = 'Master' WHERE apptivia_level = 'Diamond';

-- Recreate the update_apptivia_level function with new level names
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
    WHEN current_points >= 10000 THEN 'Master'
    WHEN current_points >= 5000 THEN 'Elite'
    WHEN current_points >= 2500 THEN 'Proficient'
    WHEN current_points >= 1000 THEN 'Intermediate'
    ELSE 'Developing'
  END;
  
  -- Update the profile's level
  UPDATE profiles
  SET apptivia_level = new_level
  WHERE id = p_profile_id;
  
  RETURN new_level;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_apptivia_level IS 'Updates profile Apptivia Level based on total_points: Developing (0-999), Intermediate (1000-2499), Proficient (2500-4999), Elite (5000-9999), Master (10000+)';
