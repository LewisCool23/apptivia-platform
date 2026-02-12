-- =============================================================================
-- TEST NOTIFICATION SYSTEM
-- =============================================================================
-- Queries to test and verify the notification system
-- =============================================================================

-- =============================================================================
-- 1. CHECK NOTIFICATION STATS
-- =============================================================================
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
  'Read Notifications',
  COUNT(*)
FROM notifications WHERE is_read = TRUE;

-- =============================================================================
-- 2. NOTIFICATIONS BY TYPE
-- =============================================================================
SELECT 
  type,
  COUNT(*) as count,
  COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread,
  ROUND(AVG(priority), 1) as avg_priority
FROM notifications
GROUP BY type
ORDER BY count DESC;

-- =============================================================================
-- 3. RECENT NOTIFICATIONS (Last 24 hours)
-- =============================================================================
SELECT 
  p.email,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.created_at > NOW() - INTERVAL '24 hours'
ORDER BY n.created_at DESC
LIMIT 20;

-- =============================================================================
-- 4. UNREAD NOTIFICATIONS PER USER
-- =============================================================================
SELECT 
  p.email,
  p.full_name,
  COUNT(*) as unread_count,
  STRING_AGG(DISTINCT n.type::text, ', ') as notification_types
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.is_read = FALSE
GROUP BY p.id, p.email, p.full_name
ORDER BY unread_count DESC;

-- =============================================================================
-- 5. HIGH PRIORITY UNREAD NOTIFICATIONS
-- =============================================================================
SELECT 
  p.email,
  n.type,
  n.title,
  n.priority,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.is_read = FALSE
  AND n.priority >= 8
ORDER BY n.priority DESC, n.created_at DESC;

-- =============================================================================
-- 6. TEST: Get unread count for a specific user
-- =============================================================================
-- Replace with actual profile_id
SELECT get_unread_notification_count(
  (SELECT id FROM profiles WHERE email = 'test@apptivia.app' LIMIT 1)
) as unread_count;

-- =============================================================================
-- 7. TEST: Create a test notification
-- =============================================================================
SELECT create_notification(
  p_profile_id := (SELECT id FROM profiles WHERE email = 'test@apptivia.app' LIMIT 1),
  p_type := 'general_info'::notification_type,
  p_title := 'Test Notification',
  p_message := 'This is a test notification from the enhanced system',
  p_icon := '🔔',
  p_color := '#3B82F6',
  p_action_url := '/dashboard',
  p_priority := 5,
  p_dedupe_key := 'test-notification-' || NOW()::text
) as notification_id;

-- =============================================================================
-- 8. TEST: Mark all notifications read for a user
-- =============================================================================
-- SELECT mark_all_notifications_read(
--   (SELECT id FROM profiles WHERE email = 'test@apptivia.app' LIMIT 1)
-- );

-- =============================================================================
-- 9. CLEANUP: Delete old read notifications
-- =============================================================================
-- SELECT cleanup_old_notifications() as deleted_count;

-- =============================================================================
-- 10. CHECK AUTO-TRIGGERS ARE WORKING
-- =============================================================================
-- Check if triggers exist
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_notify%'
ORDER BY trigger_name;

-- Verify trigger functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name LIKE 'notify_%'
  AND routine_schema = 'public'
ORDER BY routine_name;
