-- =============================================================================
-- SUPABASE SQL EDITOR VERSION: Backfill Missing Achievement Prerequisites
-- =============================================================================
-- Copy and paste this entire script into the Supabase SQL Editor and run it
-- This will fix users who have higher-tier achievements without prerequisites
-- =============================================================================

-- Run the backfill function
SELECT 
  profile_email,
  missing_achievements_awarded,
  CASE 
    WHEN missing_achievements_awarded > 0 
    THEN '✓ Fixed ' || missing_achievements_awarded || ' missing achievements'
    ELSE 'No gaps found'
  END as status
FROM backfill_missing_prerequisites()
ORDER BY missing_achievements_awarded DESC;

-- Show summary
SELECT 
  '✅ BACKFILL COMPLETE' as status,
  COUNT(*) as users_fixed,
  SUM(missing_achievements_awarded) as total_achievements_awarded,
  ROUND(AVG(missing_achievements_awarded), 1) as avg_per_user
FROM (SELECT * FROM backfill_missing_prerequisites()) as backfill
WHERE missing_achievements_awarded > 0;
