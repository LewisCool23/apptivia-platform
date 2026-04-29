-- Migration 156: Add UNIQUE constraints on definition tables to prevent duplicates
-- Root cause: multiple migrations INSERT without ON CONFLICT, and no UNIQUE
-- constraints existed on natural keys — causing definitions to be duplicated.
-- All duplicates were cleaned up manually; these constraints prevent recurrence.

-- Using COALESCE so NULL organization_id values are treated as equal
-- (standard SQL UNIQUE treats NULLs as distinct, which allowed duplicates)

-- 1. achievements: name + org
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_name_org_unique
  ON achievements (name, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'));

-- 2. skillsets: replace global name UNIQUE with org-scoped
--    Drop the old column-level constraint first
ALTER TABLE skillsets DROP CONSTRAINT IF EXISTS skillsets_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_skillsets_name_org_unique
  ON skillsets (name, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'));

-- 3. badge_definitions: fix NULL org handling
--    Migration 139 added (badge_name, organization_id) but NULLs bypass it
ALTER TABLE badge_definitions DROP CONSTRAINT IF EXISTS badge_definitions_badge_name_org_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_defs_name_org_unique
  ON badge_definitions (badge_name, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'));

-- 4. profile_badges: prevent same badge being awarded twice to same rep
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_badges_unique
  ON profile_badges (profile_id, badge_name);

-- 5. teams: prevent duplicate team names per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name_org_unique
  ON teams (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'), name);

-- 6. engage_playbooks: prevent duplicate playbook names per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_engage_playbooks_name_org_unique
  ON engage_playbooks (organization_id, name);

DO $$
BEGIN
  RAISE NOTICE 'Migration 156: UNIQUE constraints added on achievements, skillsets, badge_definitions, profile_badges, teams, engage_playbooks';
END $$;
