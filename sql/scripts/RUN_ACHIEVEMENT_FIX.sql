-- =============================================================================
-- QUICK FIX SCRIPT: Run this to fix achievement prerequisites immediately
-- =============================================================================
-- This script applies the fix and backfills missing achievements in one go
-- =============================================================================

-- Step 1: Apply the migration (if not already applied)
\i supabase/migrations/019_fix_achievement_prerequisites.sql

-- Step 2: Backfill missing prerequisites for all users
\echo ''
\echo '═════════════════════════════════════════════════════════════'
\echo 'Running backfill for missing prerequisites...'
\echo '═════════════════════════════════════════════════════════════'
\echo ''

SELECT * FROM backfill_missing_prerequisites();

\echo ''
\echo '═════════════════════════════════════════════════════════════'
\echo 'Backfill complete! Summary:'
\echo '═════════════════════════════════════════════════════════════'

-- Show summary of backfill results
SELECT 
  COUNT(*) as users_fixed,
  SUM(missing_achievements_awarded) as total_achievements_awarded
FROM (SELECT * FROM backfill_missing_prerequisites()) as backfill;

-- Step 3: Optionally run a verification check
\echo ''
\echo '═════════════════════════════════════════════════════════════'
\echo 'Verification: Checking for remaining gaps (should be 0 or minimal)...'
\echo '═════════════════════════════════════════════════════════════'
\echo ''

WITH gaps AS (
  SELECT 
    p.email,
    a_high.name as has_achievement,
    (a_high.criteria->>'threshold')::INT as has_threshold,
    a_low.name as missing_achievement,
    (a_low.criteria->>'threshold')::INT as missing_threshold,
    (a_high.criteria->>'kpi') as kpi
  FROM profile_achievements pa
  JOIN achievements a_high ON a_high.id = pa.achievement_id
  JOIN profiles p ON p.id = pa.profile_id
  CROSS JOIN achievements a_low
  WHERE 
    a_high.criteria IS NOT NULL
    AND a_low.criteria IS NOT NULL
    AND (a_high.criteria->>'kpi') = (a_low.criteria->>'kpi')
    AND (a_high.criteria->>'threshold')::NUMERIC > (a_low.criteria->>'threshold')::NUMERIC
    AND NOT EXISTS (
      SELECT 1 FROM profile_achievements pa2
      WHERE pa2.profile_id = pa.profile_id
        AND pa2.achievement_id = a_low.id
    )
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ No gaps found - all prerequisites are properly awarded!'
    ELSE '⚠ Found ' || COUNT(*) || ' remaining gaps - these may need manual review'
  END as status,
  COUNT(*) as remaining_gaps
FROM gaps;

\echo ''
\echo '═════════════════════════════════════════════════════════════'
\echo 'Fix complete!'
\echo '═════════════════════════════════════════════════════════════'
\echo ''
\echo 'Next: Verify in the UI that achievements appear in correct order'
\echo ''
