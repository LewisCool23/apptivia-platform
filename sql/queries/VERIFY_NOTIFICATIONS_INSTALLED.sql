-- =============================================================================
-- VERIFY NOTIFICATION SYSTEM INSTALLED
-- =============================================================================

-- 1. Check notifications table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'notifications';

-- 2. Check notification_type enum created with all 29 types
SELECT 
  enumlabel as notification_type
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'notification_type'
ORDER BY enumlabel;

-- 3. Verify triggers installed
SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_notify%'
ORDER BY trigger_name;

-- 4. Verify functions created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%notification%' OR routine_name LIKE 'check_scorecard%')
ORDER BY routine_name;

-- 5. Check if any notifications exist yet
SELECT 
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN is_read = FALSE THEN 1 END) as unread_count
FROM notifications;

-- 6. Test create_notification function
SELECT create_notification(
  p_profile_id := (SELECT id FROM profiles WHERE email LIKE '%test%' LIMIT 1),
  p_type := 'general_info'::notification_type,
  p_title := '🎉 Notification System Active',
  p_message := 'The enhanced notification system is now operational!',
  p_icon := '🎉',
  p_color := '#10B981',
  p_action_url := '/dashboard',
  p_priority := 8,
  p_dedupe_key := 'system-test-' || NOW()::text
) as test_notification_id;

-- 7. Verify test notification was created
SELECT 
  type,
  title,
  message,
  priority,
  created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 1;
