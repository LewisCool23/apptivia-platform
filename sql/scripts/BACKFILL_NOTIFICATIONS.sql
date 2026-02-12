-- =============================================================================
-- BACKFILL NOTIFICATIONS FOR EXISTING DATA
-- =============================================================================
-- Run this AFTER migration 024 to create notifications for existing badges
-- and recent achievements
-- =============================================================================

-- =============================================================================
-- 1. CREATE NOTIFICATIONS FOR EXISTING BADGES (Last 30 days)
-- =============================================================================
INSERT INTO notifications (
  profile_id,
  type,
  title,
  message,
  icon,
  color,
  action_url,
  priority,
  dedupe_key,
  badge_id,
  created_at
)
SELECT 
  pb.profile_id,
  CASE 
    WHEN bd.is_rare THEN 'rare_badge_earned'::notification_type
    ELSE 'badge_earned'::notification_type
  END,
  CASE 
    WHEN bd.is_rare THEN '✨ Rare Badge Earned!'
    ELSE '🏆 New Badge!'
  END,
  'You earned the "' || pb.badge_name || '" badge' || 
    CASE WHEN bd.points IS NOT NULL THEN ' (+' || bd.points || ' pts)' ELSE '' END,
  COALESCE(pb.icon, '🏆'),
  COALESCE(pb.color, '#3B82F6'),
  '/profile#badges',
  CASE WHEN bd.is_rare THEN 9 ELSE 7 END,
  'badge-' || pb.badge_name || '-' || pb.profile_id,
  pb.id,
  pb.earned_at
FROM profile_badges pb
LEFT JOIN badge_definitions bd ON bd.badge_name = pb.badge_name
WHERE pb.earned_at > NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.dedupe_key = 'badge-' || pb.badge_name || '-' || pb.profile_id
  );

-- =============================================================================
-- 2. CREATE NOTIFICATIONS FOR RECENT ACHIEVEMENTS (Last 30 days)
-- =============================================================================
INSERT INTO notifications (
  profile_id,
  type,
  title,
  message,
  icon,
  color,
  action_url,
  priority,
  dedupe_key,
  achievement_id,
  skillset_id,
  created_at
)
SELECT 
  pa.profile_id,
  'achievement_earned'::notification_type,
  '🎯 Achievement Unlocked!',
  'You earned "' || a.name || '" in ' || s.name || ' (+' || a.points || ' pts)',
  '🎯',
  s.color,
  '/profile#achievements',
  7,
  'achievement-' || pa.achievement_id || '-' || pa.profile_id,
  pa.achievement_id,
  a.skillset_id,
  pa.completed_at
FROM profile_achievements pa
JOIN achievements a ON a.id = pa.achievement_id
JOIN skillsets s ON s.id = a.skillset_id
WHERE pa.completed_at > NOW() - INTERVAL '30 days'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.dedupe_key = 'achievement-' || pa.achievement_id || '-' || pa.profile_id
  );

-- =============================================================================
-- 3. SUMMARY
-- =============================================================================
DO $$
DECLARE
  badge_notifications INTEGER;
  achievement_notifications INTEGER;
  total_notifications INTEGER;
BEGIN
  SELECT COUNT(*) INTO badge_notifications 
  FROM notifications WHERE type IN ('badge_earned', 'rare_badge_earned');
  
  SELECT COUNT(*) INTO achievement_notifications 
  FROM notifications WHERE type = 'achievement_earned';
  
  SELECT COUNT(*) INTO total_notifications FROM notifications;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ Backfilled notifications from existing data';
  RAISE NOTICE '  → Badge notifications: %', badge_notifications;
  RAISE NOTICE '  → Achievement notifications: %', achievement_notifications;
  RAISE NOTICE '  → Total notifications: %', total_notifications;
  RAISE NOTICE '';
END $$;
