-- =============================================================================
-- ENHANCED BADGE SYSTEM - FINAL SUMMARY
-- =============================================================================

-- Overall badge statistics
SELECT 
  'TOTAL USERS' as metric,
  COUNT(DISTINCT p.id) as count
FROM profiles p
UNION ALL
SELECT 
  'TOTAL BADGE TYPES',
  COUNT(*) 
FROM badge_definitions
UNION ALL
SELECT 
  'TOTAL BADGES AWARDED',
  COUNT(*) 
FROM profile_badges;

-- Badge distribution by type
SELECT 
  COALESCE(pb.badge_type, 'NO BADGES') as badge_type,
  COUNT(DISTINCT p.id) as users,
  COUNT(pb.id) as total_awarded,
  ROUND(COUNT(DISTINCT p.id)::numeric / (SELECT COUNT(*) FROM profiles) * 100, 1) as pct_users
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
GROUP BY pb.badge_type
ORDER BY total_awarded DESC NULLS LAST;

-- Top users by badge count
SELECT 
  p.email,
  COUNT(pb.id) as total_badges,
  SUM(bd.points) as total_points,
  STRING_AGG(DISTINCT pb.badge_type, ', ' ORDER BY pb.badge_type) as badge_types
FROM profiles p
LEFT JOIN profile_badges pb ON pb.profile_id = p.id
LEFT JOIN badge_definitions bd ON bd.badge_name = pb.badge_name
GROUP BY p.id, p.email
ORDER BY total_badges DESC, total_points DESC
LIMIT 10;

-- Volume badge summary
SELECT 
  badge_name,
  COUNT(*) as users_earned,
  MIN(bd.criteria_value) as threshold,
  AVG(bd.points) as points
FROM profile_badges pb
JOIN badge_definitions bd ON bd.badge_name = pb.badge_name
WHERE pb.badge_type = 'volume'
GROUP BY badge_name, bd.criteria_value
ORDER BY threshold ASC;

-- Today's badge activity
SELECT 
  DATE_TRUNC('hour', earned_at) as hour,
  badge_type,
  COUNT(*) as badges_awarded
FROM profile_badges
WHERE earned_at::date = CURRENT_DATE
GROUP BY DATE_TRUNC('hour', earned_at), badge_type
ORDER BY hour DESC, badges_awarded DESC;
