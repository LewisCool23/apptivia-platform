-- =============================================================================
-- DIAGNOSTIC: Check Badge System Issues
-- =============================================================================
-- Investigate badges for jenkins@apptivia.app and others
-- =============================================================================

-- Query 1: Check jenkins's badges and actual data
SELECT 
  p.email,
  p.full_name,
  pb.badge_name,
  pb.badge_type,
  pb.earned_at,
  -- Check actual scorecard data
  p.day_streak as actual_scorecard_streak,
  p.total_points,
  -- Check if they have scorecard completion data
  (SELECT COUNT(*) FROM kpi_values kv 
   JOIN kpi_metrics km ON km.id = kv.kpi_id 
   WHERE kv.profile_id = p.id AND km.key = 'scorecards_completed') as scorecard_count
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
WHERE p.email = 'jenkins@apptivia.app'
ORDER BY pb.earned_at DESC;

-- Query 2: Check all users with streak badges vs actual streak data
SELECT 
  p.email,
  p.full_name,
  p.day_streak as actual_streak,
  COUNT(CASE WHEN pb.badge_name LIKE '%Streak%' OR pb.badge_name LIKE '%streak%' THEN 1 END) as streak_badge_count,
  STRING_AGG(CASE WHEN pb.badge_name LIKE '%Streak%' OR pb.badge_name LIKE '%streak%' THEN pb.badge_name END, ', ') as streak_badges
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
GROUP BY p.id, p.email, p.full_name, p.day_streak
HAVING COUNT(CASE WHEN pb.badge_name LIKE '%Streak%' OR pb.badge_name LIKE '%streak%' THEN 1 END) > 0
ORDER BY p.day_streak ASC, p.email;

-- Query 3: Find inconsistencies - users with streak badges but 0 streak
SELECT 
  p.email,
  p.day_streak as actual_streak,
  pb.badge_name,
  pb.earned_at,
  'Has badge but no streak data' as issue
FROM profiles p
JOIN profile_badges pb ON pb.profile_id = p.id
WHERE (pb.badge_name LIKE '%Streak%' OR pb.badge_name LIKE '%streak%')
  AND (p.day_streak IS NULL OR p.day_streak = 0)
ORDER BY p.email, pb.badge_name;

-- Query 4: Check badge types and counts
SELECT 
  badge_type,
  COUNT(*) as badge_count,
  COUNT(DISTINCT profile_id) as users_with_this_type
FROM profile_badges
GROUP BY badge_type
ORDER BY badge_count DESC;

-- Query 5: Check specific badge names
SELECT 
  badge_name,
  badge_type,
  COUNT(*) as times_awarded,
  COUNT(DISTINCT profile_id) as unique_users
FROM profile_badges
GROUP BY badge_name, badge_type
ORDER BY times_awarded DESC
LIMIT 30;

-- Query 6: Check if badge awarding functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%badge%'
ORDER BY routine_name;
