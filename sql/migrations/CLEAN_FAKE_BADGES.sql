-- =============================================================================
-- SUPABASE: Clean Up Fake Badge Data
-- =============================================================================
-- Run this in Supabase SQL Editor to remove incorrectly awarded badges
-- =============================================================================

-- Delete all streak badges (awarded based on fake test data)
DELETE FROM profile_badges
WHERE badge_type = 'kpi_streak' 
  AND (badge_name LIKE '%Streak%' OR badge_name LIKE '%streak%');

-- Reset day_streak to 0 for all users
UPDATE profiles
SET day_streak = 0
WHERE day_streak > 0;

-- Verify the cleanup
SELECT 
  'Verification Results' as status,
  (SELECT COUNT(*) FROM profile_badges WHERE badge_type = 'kpi_streak') as remaining_streak_badges,
  (SELECT COUNT(*) FROM profiles WHERE day_streak > 0) as users_with_streak,
  CASE 
    WHEN (SELECT COUNT(*) FROM profile_badges WHERE badge_type = 'kpi_streak') = 0 
     AND (SELECT COUNT(*) FROM profiles WHERE day_streak > 0) = 0
    THEN '✅ Cleanup successful'
    ELSE '⚠️ Some data remains'
  END as result;

-- Show remaining badges for jenkins
SELECT 
  p.email,
  pb.badge_name,
  pb.badge_type,
  p.day_streak as current_streak
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
WHERE p.email = 'jenkins@apptivia.app'
ORDER BY pb.earned_at DESC;
