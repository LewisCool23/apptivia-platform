-- =============================================================================
-- VIEW BACKFILLED NOTIFICATIONS
-- =============================================================================

-- Summary counts
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- Recent notifications by user
SELECT 
  p.email,
  p.full_name,
  COUNT(n.id) as total_notifications,
  COUNT(CASE WHEN n.type = 'badge_earned' THEN 1 END) as badge_notifications,
  COUNT(CASE WHEN n.type = 'rare_badge_earned' THEN 1 END) as rare_badge_notifications,
  COUNT(CASE WHEN n.type = 'achievement_earned' THEN 1 END) as achievement_notifications,
  MAX(n.created_at) as most_recent_notification
FROM profiles p
JOIN notifications n ON n.profile_id = p.id
GROUP BY p.id, p.email, p.full_name
ORDER BY total_notifications DESC
LIMIT 10;

-- Sample of recent notifications
SELECT 
  p.email,
  n.type,
  n.title,
  n.message,
  n.priority,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
ORDER BY n.created_at DESC
LIMIT 20;

-- Total stats
SELECT 
  'Total Notifications' as metric,
  COUNT(*) as count
FROM notifications
UNION ALL
SELECT 
  'Unread Notifications',
  COUNT(*)
FROM notifications WHERE is_read = FALSE
UNION ALL
SELECT 
  'Badge Notifications',
  COUNT(*)
FROM notifications WHERE type IN ('badge_earned', 'rare_badge_earned')
UNION ALL
SELECT 
  'Achievement Notifications',
  COUNT(*)
FROM notifications WHERE type = 'achievement_earned';
