-- =============================================================================
-- DIAGNOSTIC SCRIPT: Check Achievement Data Status
-- =============================================================================
-- Run this script to diagnose why Coach page and Profile page show 0 data
-- =============================================================================

-- 1. Check if profile_skillsets table exists and has records
SELECT 
  'profile_skillsets' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT profile_id) as unique_profiles,
  COUNT(DISTINCT skillset_id) as unique_skillsets,
  SUM(achievements_completed) as total_achievements,
  SUM(total_points_earned) as total_points
FROM profile_skillsets;

-- 2. Check if profiles have skillset records
SELECT 
  p.email,
  COUNT(ps.id) as skillset_records,
  SUM(ps.achievements_completed) as achievements,
  SUM(ps.total_points_earned) as skillset_points,
  p.total_points as profile_total_points,
  p.apptivia_level
FROM profiles p
LEFT JOIN profile_skillsets ps ON ps.profile_id = p.id
GROUP BY p.id, p.email, p.total_points, p.apptivia_level
ORDER BY p.email;

-- 3. Check if profile_achievements table has records
SELECT 
  'profile_achievements' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT profile_id) as unique_profiles,
  COUNT(DISTINCT achievement_id) as unique_achievements
FROM profile_achievements;

-- 4. Check if achievements table exists and is populated
SELECT 
  'achievements' as table_name,
  COUNT(*) as total_achievements,
  COUNT(DISTINCT skillset_id) as skillsets,
  MIN(points) as min_points,
  MAX(points) as max_points
FROM achievements;

-- 5. Check if skillsets table is populated
SELECT id, name, description, color
FROM skillsets
ORDER BY name;

-- 6. Check if cumulative progression functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%achievement%' 
    OR routine_name LIKE '%skillset%'
    OR routine_name LIKE '%apptivia%'
  )
ORDER BY routine_name;

-- 7. Sample profile_skillsets data (if exists)
SELECT 
  p.email,
  s.name as skillset_name,
  ps.progress,
  ps.achievements_completed,
  ps.total_points_earned,
  ps.milestone_25_reached,
  ps.milestone_50_reached,
  ps.milestone_75_reached,
  ps.milestone_100_reached
FROM profile_skillsets ps
JOIN profiles p ON p.id = ps.profile_id
JOIN skillsets s ON s.id = ps.skillset_id
ORDER BY p.email, s.name
LIMIT 20;

-- 8. Check if users have KPI data that could earn achievements
SELECT 
  p.email,
  km.kpi_name,
  kv.value,
  kv.week_start_date,
  CASE 
    WHEN km.target_value > 0 THEN (kv.value / km.target_value * 100)::numeric(10,2)
    ELSE 0
  END as percent_of_target
FROM kpi_values kv
JOIN profiles p ON p.id = kv.profile_id
JOIN kpi_metrics km ON km.id = kv.kpi_metric_id
WHERE kv.week_start_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY p.email, kv.week_start_date DESC, km.kpi_name
LIMIT 30;

-- =============================================================================
-- INTERPRETATION GUIDE
-- =============================================================================

/*
QUERY 1 - profile_skillsets check:
- If total_records = 0: Run migration 013 or 014 to initialize
- Expected: (# of profiles) × 5 skillsets (e.g., 10 users = 50 records)

QUERY 2 - profiles with skillsets:
- If skillset_records = 0 for all users: Need to initialize profile_skillsets
- If achievements = 0 but records exist: Run check_and_award_achievements()
- If skillset_points = 0: No achievements earned yet

QUERY 3 - profile_achievements check:
- If total_records = 0: No achievements awarded yet
- Need to run check_and_award_achievements() function

QUERY 4 - achievements table:
- Should have 500 achievements (5 skillsets × 100 each)
- Points: 5 (easy), 10 (medium), 20 (hard)

QUERY 5 - skillsets table:
- Should have 5 skillsets:
  1. Communication Excellence
  2. Sales Performance
  3. Pipeline Management
  4. Customer Success
  5. Strategic Leadership

QUERY 6 - functions check:
- Should see 5 functions:
  1. check_and_award_achievements
  2. award_achievement
  3. calculate_skillset_progress
  4. award_skillset_milestone_points
  5. update_apptivia_level
- If missing: Run migration 013

QUERY 7 - sample data:
- Should show progress, achievements, points for each user/skillset combo
- If all zeros: Run check_and_award_achievements()

QUERY 8 - KPI data check:
- Shows recent KPI performance data
- If percent_of_target >= 60%: User should earn achievements
- If this query returns data but no achievements: Run award function

=============================================================================
NEXT STEPS BASED ON RESULTS:
=============================================================================

SCENARIO A: profile_skillsets table is empty (0 records)
→ Run migration 013 or 014 to initialize
→ Then run: SELECT check_and_award_achievements();

SCENARIO B: profile_skillsets exists but all zeros
→ Run: SELECT check_and_award_achievements();
→ This will scan KPI data and award achievements

SCENARIO C: Functions don't exist
→ Run migration 013 (creates all functions)
→ Then run: SELECT check_and_award_achievements();

SCENARIO D: No KPI data in query 8
→ Users need to complete activities that generate KPI values
→ Or check kpi_values table for historical data

SCENARIO E: Everything looks good in queries but UI shows 0
→ Clear browser cache and reload
→ Check browser console for errors
→ Verify RLS policies allow SELECT on tables
→ Check user permissions (isPowerUser, isManager, isAdmin)
*/
