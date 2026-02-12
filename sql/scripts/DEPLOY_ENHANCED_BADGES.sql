-- =============================================================================
-- DEPLOY NEW BADGE SYSTEM: Apply All Changes
-- =============================================================================
-- Run this in Supabase SQL Editor to deploy the enhanced badge system
-- =============================================================================

-- Run all the migrations in sequence
\echo 'Step 1: Deploying enhanced badge definitions...'
\i supabase/migrations/022_enhanced_badge_system.sql

\echo ''
\echo 'Step 2: Setting up auto-award functions...'
\i supabase/migrations/023_volume_badge_auto_award.sql

\echo ''
\echo 'Step 3: Awarding badges to existing users...'
SELECT award_all_badges();

\echo ''
\echo 'Step 4: Verification - Badge Summary'
\echo ''

-- Show badge count by type
SELECT 
  badge_type,
  COUNT(*) as badge_count,
  SUM(points) as total_points_value,
  COUNT(CASE WHEN is_rare THEN 1 END) as rare_badges
FROM badge_definitions
GROUP BY badge_type
ORDER BY badge_count DESC;

\echo ''
\echo '✅ Enhanced badge system deployed successfully!'
\echo ''
\echo 'Total badges available for users to earn.'
\echo ''
