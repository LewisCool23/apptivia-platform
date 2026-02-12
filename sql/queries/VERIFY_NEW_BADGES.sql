-- =============================================================================
-- VERIFY NEW BADGES WERE ADDED
-- =============================================================================

-- Total badge count
SELECT 
  'Total Badges' as metric,
  COUNT(*) as count
FROM badge_definitions;

-- Breakdown by type
SELECT 
  badge_type,
  COUNT(*) as badge_count,
  STRING_AGG(badge_name, ', ' ORDER BY criteria_value NULLS LAST) as badge_names
FROM badge_definitions
GROUP BY badge_type
ORDER BY badge_count DESC;

-- Check for new badges added today
SELECT 
  badge_type,
  badge_name,
  badge_description,
  points,
  is_rare
FROM badge_definitions
WHERE created_at::date = CURRENT_DATE
ORDER BY badge_type, criteria_value NULLS LAST;
