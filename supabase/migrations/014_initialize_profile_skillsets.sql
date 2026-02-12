-- =============================================================================
-- MIGRATION 014: Initialize Profile Skillsets (Quick Fix)
-- =============================================================================
-- Purpose: Add missing columns and initialize profile_skillsets records
-- This is a standalone fix that doesn't require migration 013
-- =============================================================================

-- STEP 1: Add missing columns if they don't exist
DO $$
BEGIN
  -- Add total_points_earned column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profile_skillsets' 
    AND column_name = 'total_points_earned'
  ) THEN
    ALTER TABLE public.profile_skillsets
      ADD COLUMN total_points_earned integer DEFAULT 0;
    RAISE NOTICE 'Added column: total_points_earned';
  END IF;

  -- Add milestone columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profile_skillsets' 
    AND column_name = 'milestone_25_reached'
  ) THEN
    ALTER TABLE public.profile_skillsets
      ADD COLUMN milestone_25_reached boolean DEFAULT FALSE,
      ADD COLUMN milestone_50_reached boolean DEFAULT FALSE,
      ADD COLUMN milestone_75_reached boolean DEFAULT FALSE,
      ADD COLUMN milestone_100_reached boolean DEFAULT FALSE;
    RAISE NOTICE 'Added milestone columns';
  END IF;
END $$;

-- STEP 2: Initialize profile_skillsets for ALL profiles (if not already done)
DO $$
DECLARE
  profile_record RECORD;
  skillset_record RECORD;
BEGIN
  -- Loop through all profiles and skillsets to create initial records
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
  
  RAISE NOTICE 'Profile skillsets initialized successfully';
END $$;

-- Verify initialization
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT profile_id) as unique_profiles,
  COUNT(DISTINCT skillset_id) as unique_skillsets
FROM profile_skillsets;

-- Show sample data
SELECT 
  p.email,
  s.name as skillset_name,
  ps.progress,
  ps.achievements_completed,
  ps.total_points_earned
FROM profile_skillsets ps
JOIN profiles p ON p.id = ps.profile_id
JOIN skillsets s ON s.id = ps.skillset_id
ORDER BY p.email, s.name
LIMIT 10;
