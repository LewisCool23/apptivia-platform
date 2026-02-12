-- =============================================================================
-- FIX DUPLICATE BADGES - ALL USERS
-- =============================================================================
-- Run this to clean up duplicate badges for ALL users
-- =============================================================================

-- 1. Show duplicate badges before cleanup
SELECT 
  p.email,
  pb.badge_name,
  COUNT(*) as duplicate_count
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
GROUP BY p.id, p.email, pb.badge_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, p.email;

-- 2. Delete duplicate badges (keep oldest earned_at)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, badge_name 
      ORDER BY earned_at ASC
    ) as rn
  FROM profile_badges
)
DELETE FROM profile_badges
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 3. Show how many duplicate notifications exist
SELECT 
  p.email,
  n.dedupe_key,
  COUNT(*) as duplicate_count
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.dedupe_key IS NOT NULL
GROUP BY p.id, p.email, n.dedupe_key
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, p.email;

-- 4. Delete duplicate notifications (keep oldest created_at)
WITH duplicate_notifications AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY profile_id, dedupe_key 
      ORDER BY created_at ASC
    ) as rn
  FROM notifications
  WHERE dedupe_key IS NOT NULL
)
DELETE FROM notifications
WHERE id IN (
  SELECT id FROM duplicate_notifications WHERE rn > 1
);

-- 5. Verify cleanup - check for remaining duplicates
SELECT 
  'Duplicate Badges Remaining' as check_type,
  COUNT(*) as count
FROM (
  SELECT profile_id, badge_name, COUNT(*) as cnt
  FROM profile_badges
  GROUP BY profile_id, badge_name
  HAVING COUNT(*) > 1
) duplicates
UNION ALL
SELECT 
  'Duplicate Notifications Remaining',
  COUNT(*)
FROM (
  SELECT profile_id, dedupe_key, COUNT(*) as cnt
  FROM notifications
  WHERE dedupe_key IS NOT NULL
  GROUP BY profile_id, dedupe_key
  HAVING COUNT(*) > 1
) dup_notifs;

-- 6. Summary
DO $$
DECLARE
  total_badges INTEGER;
  total_notifications INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_badges FROM profile_badges;
  SELECT COUNT(*) INTO total_notifications FROM notifications;
  
  RAISE NOTICE '';
  RAISE NOTICE '✓ Duplicate cleanup completed';
  RAISE NOTICE '  → Total badges: %', total_badges;
  RAISE NOTICE '  → Total notifications: %', total_notifications;
  RAISE NOTICE '';
END $$;
