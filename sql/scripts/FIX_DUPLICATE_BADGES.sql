-- =============================================================================
-- CHECK AND FIX DUPLICATE BADGES
-- =============================================================================

-- 1. Check for duplicate badges in profile_badges
SELECT 
  p.email,
  pb.badge_name,
  COUNT(*) as count
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
GROUP BY p.email, pb.badge_name
HAVING COUNT(*) > 1;

-- 2. Check for duplicate notifications
SELECT 
  p.email,
  n.type,
  n.title,
  n.message,
  COUNT(*) as count
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
GROUP BY p.email, n.type, n.title, n.message
HAVING COUNT(*) > 1;

-- 3. See all badges for ava.carter
SELECT 
  pb.id,
  pb.badge_name,
  pb.badge_description,
  pb.earned_at,
  pb.badge_type
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
ORDER BY pb.badge_name, pb.earned_at;

-- 4. See all notifications for ava.carter
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.created_at,
  n.badge_id
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
ORDER BY n.created_at DESC;

-- =============================================================================
-- FIX: Delete duplicate badges (keep oldest)
-- =============================================================================
-- This will delete duplicate badges, keeping only the first one earned
DELETE FROM profile_badges
WHERE id IN (
  SELECT pb2.id
  FROM profile_badges pb1
  JOIN profile_badges pb2 ON pb1.profile_id = pb2.profile_id 
    AND pb1.badge_name = pb2.badge_name 
    AND pb1.earned_at < pb2.earned_at
  JOIN profiles p ON p.id = pb1.profile_id
  WHERE p.email = 'ava.carter@apptivia.app'
);

-- =============================================================================
-- FIX: Delete duplicate notifications (keep oldest)
-- =============================================================================
-- This will delete duplicate notifications with same dedupe_key
DELETE FROM notifications
WHERE id IN (
  SELECT n2.id
  FROM notifications n1
  JOIN notifications n2 ON n1.profile_id = n2.profile_id 
    AND n1.dedupe_key = n2.dedupe_key 
    AND n1.created_at < n2.created_at
  JOIN profiles p ON p.id = n1.profile_id
  WHERE p.email = 'ava.carter@apptivia.app'
    AND n1.dedupe_key IS NOT NULL
);

-- Verify fix
SELECT 
  p.email,
  pb.badge_name,
  COUNT(*) as badge_count
FROM profile_badges pb
JOIN profiles p ON p.id = pb.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
GROUP BY p.email, pb.badge_name
ORDER BY badge_name;
