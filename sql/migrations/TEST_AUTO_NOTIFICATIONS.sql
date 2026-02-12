-- =============================================================================
-- TEST AUTO-NOTIFICATIONS
-- =============================================================================
-- Test that notifications are automatically created when badges/achievements earned
-- =============================================================================

-- =============================================================================
-- STEP 1: Award badges (this should trigger notifications automatically)
-- =============================================================================
SELECT award_all_badges();

-- =============================================================================
-- STEP 2: Check if badge notifications were auto-created
-- =============================================================================
SELECT 
  p.email,
  n.type,
  n.title,
  n.message,
  n.priority,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.type IN ('badge_earned', 'rare_badge_earned')
ORDER BY n.created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: Check notification stats by type
-- =============================================================================
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread,
  MAX(created_at) as most_recent
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- =============================================================================
-- STEP 4: Check users with notifications
-- =============================================================================
SELECT 
  p.email,
  COUNT(n.id) as total_notifications,
  COUNT(CASE WHEN n.is_read = FALSE THEN 1 END) as unread_notifications
FROM profiles p
LEFT JOIN notifications n ON n.profile_id = p.id
GROUP BY p.id, p.email
HAVING COUNT(n.id) > 0
ORDER BY total_notifications DESC
LIMIT 10;

-- =============================================================================
-- STEP 5: View all recent notifications (last 24 hours)
-- =============================================================================
SELECT 
  p.email,
  n.type,
  n.title,
  n.priority,
  n.is_read,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.created_at > NOW() - INTERVAL '24 hours'
ORDER BY n.created_at DESC;
