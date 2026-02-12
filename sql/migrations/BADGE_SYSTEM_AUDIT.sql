-- =============================================================================
-- BADGE SYSTEM AUDIT: Current Badge Inventory and Analysis
-- =============================================================================

-- Query 1: Total badge count and breakdown by type
SELECT 
  badge_type,
  COUNT(*) as badge_count,
  STRING_AGG(badge_name, ', ' ORDER BY badge_name) as badge_names
FROM badge_definitions
GROUP BY badge_type
ORDER BY badge_count DESC;

-- Query 2: All badges with details
SELECT 
  badge_type,
  badge_name,
  badge_description,
  icon,
  criteria_type,
  criteria_value,
  points,
  is_rare,
  CASE 
    WHEN criteria_type = 'manual' THEN '👤 Manual award only'
    WHEN criteria_type = 'streak_days' THEN '📅 Requires ' || criteria_value || ' day streak'
    WHEN criteria_type = 'achievement_count' THEN '🎯 Requires ' || criteria_value || ' achievements'
    WHEN criteria_type = 'scorecard_perfect' THEN '💯 Requires ' || criteria_value || ' perfect scorecards'
    WHEN criteria_type = 'contest_rank' THEN '🏆 Finish rank #' || criteria_value || ' in contest'
    ELSE 'Other criteria'
  END as criteria_summary
FROM badge_definitions
ORDER BY 
  badge_type,
  COALESCE(criteria_value, 0),
  badge_name;

-- Query 3: Badge point distribution
SELECT 
  badge_type,
  MIN(points) as min_points,
  MAX(points) as max_points,
  ROUND(AVG(points)) as avg_points,
  SUM(points) as total_possible_points
FROM badge_definitions
GROUP BY badge_type
ORDER BY total_possible_points DESC;

-- Query 4: How many badges have been awarded currently?
SELECT 
  bd.badge_type,
  bd.badge_name,
  COUNT(pb.id) as times_awarded,
  COUNT(DISTINCT pb.profile_id) as unique_users
FROM badge_definitions bd
LEFT JOIN profile_badges pb ON pb.badge_name = bd.badge_name
GROUP BY bd.badge_type, bd.badge_name
ORDER BY times_awarded DESC, bd.badge_type, bd.badge_name;

-- Query 5: Rare vs Common badges
SELECT 
  CASE WHEN is_rare THEN 'Rare' ELSE 'Common' END as rarity,
  COUNT(*) as badge_count,
  SUM(points) as total_points_value
FROM badge_definitions
GROUP BY is_rare
ORDER BY is_rare DESC;

-- Query 6: Total counts
SELECT 
  (SELECT COUNT(*) FROM badge_definitions) as total_badge_types,
  (SELECT COUNT(*) FROM badge_definitions WHERE is_rare) as rare_badges,
  (SELECT COUNT(*) FROM badge_definitions WHERE criteria_type = 'manual') as manual_badges,
  (SELECT COUNT(*) FROM badge_definitions WHERE criteria_type != 'manual') as automatic_badges,
  (SELECT SUM(points) FROM badge_definitions) as total_points_possible;
