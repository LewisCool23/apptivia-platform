-- =============================================================================
-- SUPABASE VERSION: Deploy Enhanced Badge System
-- =============================================================================
-- Copy and paste this into Supabase SQL Editor
-- =============================================================================

-- First, check current badge count
SELECT 'BEFORE:' as status, COUNT(*) as total_badges FROM badge_definitions;

-- Then run migration 022 content directly...
-- (Copy the entire contents of 022_enhanced_badge_system.sql here)

-- Then run migration 023 content...
-- (Copy the entire contents of 023_volume_badge_auto_award.sql here)

-- Award badges to all users
SELECT award_all_badges();

-- Final verification
SELECT 'AFTER:' as status, COUNT(*) as total_badges FROM badge_definitions;

-- Show breakdown
SELECT 
  badge_type,
  COUNT(*) as count,
  STRING_AGG(badge_name, ', ' ORDER BY criteria_value NULLS LAST) as badges
FROM badge_definitions
GROUP BY badge_type
ORDER BY count DESC;
