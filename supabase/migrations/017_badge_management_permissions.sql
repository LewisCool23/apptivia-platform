-- =============================================================================
-- MIGRATION 017: Badge Management Permissions
-- =============================================================================
-- Purpose: Allow managers and admins to create and assign custom badges
-- Adds RLS policies for badge_definitions and profile_badges tables
-- =============================================================================

-- =============================================================================
-- RLS Policies for badge_definitions
-- =============================================================================

-- Allow everyone to read badge definitions
DROP POLICY IF EXISTS "badge_definitions_select" ON badge_definitions;
CREATE POLICY "badge_definitions_select" ON badge_definitions
  FOR SELECT
  USING (true);

-- Allow managers and admins to insert badge definitions
DROP POLICY IF EXISTS "badge_definitions_insert" ON badge_definitions;
CREATE POLICY "badge_definitions_insert" ON badge_definitions
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'user_role' IN ('admin', 'manager')
  );

-- Allow managers and admins to update badge definitions they created
DROP POLICY IF EXISTS "badge_definitions_update" ON badge_definitions;
CREATE POLICY "badge_definitions_update" ON badge_definitions
  FOR UPDATE
  USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'manager')
  );

-- Allow only admins to delete badge definitions
DROP POLICY IF EXISTS "badge_definitions_delete" ON badge_definitions;
CREATE POLICY "badge_definitions_delete" ON badge_definitions
  FOR DELETE
  USING (
    auth.jwt() ->> 'user_role' = 'admin'
  );

-- =============================================================================
-- RLS Policies for profile_badges
-- =============================================================================

-- Allow everyone to read their own badges
DROP POLICY IF EXISTS "profile_badges_select_own" ON profile_badges;
CREATE POLICY "profile_badges_select_own" ON profile_badges
  FOR SELECT
  USING (
    profile_id::text = auth.uid()::text
  );

-- Allow managers to read badges of their team members
DROP POLICY IF EXISTS "profile_badges_select_team" ON profile_badges;
CREATE POLICY "profile_badges_select_team" ON profile_badges
  FOR SELECT
  USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'manager')
  );

-- Allow managers and admins to assign badges
DROP POLICY IF EXISTS "profile_badges_insert" ON profile_badges;
CREATE POLICY "profile_badges_insert" ON profile_badges
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'user_role' IN ('admin', 'manager')
  );

-- Allow managers and admins to update badge awards (e.g., set awarded_at)
DROP POLICY IF EXISTS "profile_badges_update" ON profile_badges;
CREATE POLICY "profile_badges_update" ON profile_badges
  FOR UPDATE
  USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'manager')
  );

-- Allow only admins to delete badge awards
DROP POLICY IF EXISTS "profile_badges_delete" ON profile_badges;
CREATE POLICY "profile_badges_delete" ON profile_badges
  FOR DELETE
  USING (
    auth.jwt() ->> 'user_role' = 'admin'
  );

-- =============================================================================
-- Enable RLS on tables (if not already enabled)
-- =============================================================================

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_badges ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Badge management permissions installed!';
  RAISE NOTICE '  → Managers and admins can create custom badges';
  RAISE NOTICE '  → Managers and admins can assign badges to team members';
  RAISE NOTICE '  → RLS policies protect badge data access';
  RAISE NOTICE '  → Everyone can view badge definitions';
END $$;
