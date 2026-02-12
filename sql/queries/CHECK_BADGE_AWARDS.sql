-- =============================================================================
-- CHECK BADGE AWARDS AFTER MIGRATION 023
-- =============================================================================

-- Total badges awarded per user
SELECT 
  p.email,
  COUNT(pb.id) as total_badges,
  SUM(bd.points) as total_points,
  COUNT(CASE WHEN bd.is_rare THEN 1 END) as rare_badges
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
LEFT JOIN badge_definitions bd ON bd.badge_name = pb.badge_name
GROUP BY p.id, p.email
ORDER BY total_badges DESC;

-- Badges by type
SELECT 
  badge_type,
  COUNT(*) as badges_awarded,
  COUNT(DISTINCT profile_id) as users_with_badge
FROM profile_badges
GROUP BY badge_type
ORDER BY badges_awarded DESC;

-- Volume badges specifically
SELECT 
  p.email,
  pb.badge_name,
  pb.badge_description,
  pb.earned_at
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
WHERE pb.badge_type = 'volume'
ORDER BY p.email, pb.badge_name;

-- Check if any new badges were awarded today
SELECT 
  p.email,
  pb.badge_type,
  pb.badge_name,
  pb.earned_at
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
WHERE pb.earned_at::date = CURRENT_DATE
ORDER BY pb.earned_at DESC;
