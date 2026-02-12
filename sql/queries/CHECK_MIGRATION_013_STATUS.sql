-- =============================================================================
-- CHECK MIGRATION 013 STATUS
-- =============================================================================
-- Run this to see if migration 013 has been applied to your database
-- =============================================================================

-- 1. Check if cumulative progression functions exist
SELECT 
  'Functions Check' as check_name,
  COUNT(*) as found,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ Migration 013 applied'
    ELSE '❌ Migration 013 NOT applied - missing functions'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_and_award_achievements',
    'award_achievement',
    'calculate_skillset_progress',
    'award_skillset_milestone_points',
    'update_apptivia_level'
  );

-- 2. Check if profile_achievements table exists
SELECT 
  'profile_achievements Table' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'profile_achievements'
    ) THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status;

-- 3. Check if profile_skillsets has required columns
SELECT 
  'profile_skillsets Columns' as check_name,
  COUNT(*) as found_columns,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ All columns exist'
    ELSE '❌ Missing columns: ' || (5 - COUNT(*))::text
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profile_skillsets'
  AND column_name IN (
    'total_points_earned',
    'milestone_25_reached',
    'milestone_50_reached',
    'milestone_75_reached',
    'milestone_100_reached'
  );

-- 4. List missing columns (if any)
SELECT 
  'Missing Columns' as info,
  column_name as missing_column
FROM (
  SELECT unnest(ARRAY[
    'total_points_earned',
    'milestone_25_reached',
    'milestone_50_reached',
    'milestone_75_reached',
    'milestone_100_reached'
  ]) as column_name
) required
WHERE column_name NOT IN (
  SELECT column_name 
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profile_skillsets'
);

-- 5. Check profiles table for cumulative fields
SELECT 
  'profiles Table' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles'
      AND column_name = 'total_points'
    ) THEN '✅ total_points column exists'
    ELSE '❌ total_points column missing'
  END as status;

-- =============================================================================
-- INTERPRETATION
-- =============================================================================

/*
✅ ALL CHECKS PASS = Migration 013 fully applied
   → Just run: SELECT check_and_award_achievements();
   → Then refresh browser

❌ FUNCTIONS MISSING = Migration 013 not applied
   → Run: supabase/migrations/013_cumulative_progression_system.sql
   → This creates all 5 functions

❌ COLUMNS MISSING = Partial migration or old schema
   → Option 1: Run migration 013 (complete fix)
   → Option 2: Run migration 014 (adds columns + initializes)
   → Option 3: Run ALTER TABLE commands from QUICK_FIX_ACHIEVEMENT_DATA.md

❌ TABLE MISSING = Migration 013 definitely not applied
   → Run: supabase/migrations/013_cumulative_progression_system.sql
   → This creates profile_achievements table

RECOMMENDATION:
- If 0-2 checks pass → Run migration 013 (complete system)
- If 3-4 checks pass → Run migration 014 (quick fix)
- If all checks pass → Just award achievements
*/
