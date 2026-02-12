-- PRODUCTION_CLEANUP.sql
-- Remove all sample/demo data while preserving product definitions
-- Run this before deploying to a production environment for a real company

-- This script removes:
-- ❌ Demo Company organization
-- ❌ Sample teams, profiles, users
-- ❌ Sample KPI values
-- ❌ Sample contests, badges, achievements
-- ❌ Sample notifications

-- This script KEEPS:
-- ✅ All table schemas and structures
-- ✅ KPI metric definitions (product features)
-- ✅ Badge definitions (82 badges)
-- ✅ Achievement definitions (100 achievements)
-- ✅ Skillset definitions
-- ✅ All functions and triggers

BEGIN;

-- Safety check: verify you're NOT running this on a database with production data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organizations 
    WHERE id != '00000000-0000-0000-0000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'WARNING: Non-demo organizations exist! Aborting to prevent data loss.';
  END IF;
END $$;

RAISE NOTICE 'Starting cleanup of demo data...';

-- 1. Delete sample coaching plans
DELETE FROM coaching_plans 
WHERE coach_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 2. Delete sample notifications
DELETE FROM notifications 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 3. Delete sample profile achievements
DELETE FROM profile_achievements 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 4. Delete sample profile skillsets
DELETE FROM profile_skillsets 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 5. Delete sample profile badges
DELETE FROM profile_badges 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 6. Delete sample contest data
DELETE FROM contest_leaderboards 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DELETE FROM contest_participants 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

DELETE FROM active_contests 
WHERE created_by IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 7. Delete sample KPI values
DELETE FROM kpi_values 
WHERE profile_id IN (
  SELECT id FROM profiles 
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- 8. Delete sample profiles (cascades to any remaining related data)
DELETE FROM profiles 
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 9. Delete sample teams
DELETE FROM teams 
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 10. Delete demo organization
DELETE FROM organizations 
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- 11. Clean up any remaining orphaned data (just in case)
DELETE FROM kpi_values WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_badges WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_skillsets WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_achievements WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM notifications WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM coaching_plans WHERE coach_id NOT IN (SELECT id FROM profiles);
DELETE FROM coaching_plans WHERE student_id NOT IN (SELECT id FROM profiles);
DELETE FROM contest_participants WHERE profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM contest_leaderboards WHERE profile_id NOT IN (SELECT id FROM profiles);

RAISE NOTICE 'Demo data cleanup complete!';

COMMIT;

-- Verification: Show counts of remaining data
SELECT 
  '=== DATA CLEANUP VERIFICATION ===' as status;

SELECT 
  'organizations' as table_name, 
  COUNT(*) as remaining_count,
  'Should be 0' as expected
FROM organizations

UNION ALL

SELECT 
  'teams', 
  COUNT(*),
  'Should be 0'
FROM teams

UNION ALL

SELECT 
  'profiles', 
  COUNT(*),
  'Should be 0'
FROM profiles

UNION ALL

SELECT 
  'kpi_values', 
  COUNT(*),
  'Should be 0'
FROM kpi_values

UNION ALL

SELECT 
  'profile_badges', 
  COUNT(*),
  'Should be 0'
FROM profile_badges

UNION ALL

SELECT 
  'profile_skillsets', 
  COUNT(*),
  'Should be 0'
FROM profile_skillsets

UNION ALL

SELECT 
  'active_contests', 
  COUNT(*),
  'Should be 0'
FROM active_contests

UNION ALL

SELECT 
  'notifications', 
  COUNT(*),
  'Should be 0'
FROM notifications

UNION ALL

SELECT 
  '--- PRODUCT DEFINITIONS (SHOULD REMAIN) ---', 
  NULL,
  NULL

UNION ALL

SELECT 
  'kpi_metrics', 
  COUNT(*),
  'Should have ~13+ metrics'
FROM kpi_metrics

UNION ALL

SELECT 
  'badges', 
  COUNT(*),
  'Should have 82 badges'
FROM badges

UNION ALL

SELECT 
  'achievements', 
  COUNT(*),
  'Should have 100 achievements'
FROM achievements

UNION ALL

SELECT 
  'skillsets', 
  COUNT(*),
  'Should have 10 skillsets'
FROM skillsets

UNION ALL

SELECT 
  'contest_templates', 
  COUNT(*),
  'Should have contest templates'
FROM contest_templates;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Cleanup complete! Database is ready for production company onboarding.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create new organization for your customer';
  RAISE NOTICE '2. Set up their admin user via Supabase Auth';
  RAISE NOTICE '3. Create teams for their organization';
  RAISE NOTICE '4. Configure integrations to sync their data';
  RAISE NOTICE '5. Import their users and begin syncing KPI data';
END $$;
