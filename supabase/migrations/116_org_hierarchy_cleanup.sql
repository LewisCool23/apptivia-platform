-- =============================================================================
-- MIGRATION 116: Org Hierarchy Cleanup
-- =============================================================================
-- 1. Add secondary_role to profiles (dual admin+manager support)
-- 2. Add "Business Development" to department_enum
-- 3. Clean up duplicate org-scoped titles
-- 4. Fix demo profile titles (Senior/Junior Sales Rep, BD Manager)
-- 5. Backfill title_id for profiles missing it
-- 6. Title→Department auto-mapping backfill
-- 7. Recreate profiles_with_team_name view
-- =============================================================================

-- ── 1. Add secondary_role to profiles ────────────────────────────────────────
-- Nullable: NULL = no secondary role. Admin must always be primary role.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secondary_role text;

-- ── 2. Add "Business Development" to department_enum ─────────────────────────

ALTER TYPE department_enum ADD VALUE IF NOT EXISTS 'Business Development';

-- ── 3. Clean up duplicate org-scoped titles ──────────────────────────────────
-- Remove org-scoped titles that duplicate global titles (same title_key)

DELETE FROM titles
WHERE organization_id IS NOT NULL
  AND title_key IN (SELECT title_key FROM titles WHERE organization_id IS NULL);

-- ── 4. Fix demo profile titles ───────────────────────────────────────────────

-- Sarah Johnson & Alex Rivera: Senior/Junior Sales Rep → Account Executive
UPDATE profiles
SET title = 'Account Executive',
    title_id = (SELECT id FROM titles WHERE title_key = 'ae' AND organization_id IS NULL LIMIT 1)
WHERE (LOWER(title) LIKE '%senior sales rep%' OR LOWER(title) LIKE '%junior sales rep%');

-- Business Development Managers → Business Development Leaders (role = manager)
UPDATE profiles
SET title = 'Business Development Leader',
    title_id = (SELECT id FROM titles WHERE title_key = 'bd_leader' AND organization_id IS NULL LIMIT 1),
    role = 'manager'
WHERE LOWER(title) LIKE '%business development manager%';

-- ── 5. Backfill title_id for profiles missing it ─────────────────────────────

UPDATE profiles p
SET title_id = t.id
FROM titles t
WHERE t.organization_id IS NULL
  AND p.title_id IS NULL
  AND p.title IS NOT NULL
  AND LOWER(TRIM(p.title)) = LOWER(TRIM(t.title_name));

-- ── 6. Title→Department auto-mapping backfill ────────────────────────────────

-- BDR, BD Leader → Business Development
UPDATE profiles p SET department = 'Business Development'
FROM titles t
WHERE t.id = p.title_id
  AND t.title_key IN ('bdr', 'bd_leader')
  AND (p.department IS NULL);

-- AE, Sales Leader, Sales Admin, SDR, AM, SE → Sales
UPDATE profiles p SET department = 'Sales'
FROM titles t
WHERE t.id = p.title_id
  AND t.title_key IN ('ae', 'sales_leader', 'sales_admin', 'sdr', 'am', 'se')
  AND p.department IS NULL;

-- Marketing titles → Marketing
UPDATE profiles p SET department = 'Marketing'
FROM titles t
WHERE t.id = p.title_id
  AND t.title_key IN ('marketing_rep', 'marketing_leader')
  AND p.department IS NULL;

-- CS titles → Customer Success
UPDATE profiles p SET department = 'Customer Success'
FROM titles t
WHERE t.id = p.title_id
  AND t.title_key IN ('cs_rep', 'cs_leader')
  AND p.department IS NULL;

-- RevOps → Sales
UPDATE profiles p SET department = 'Sales'
FROM titles t
WHERE t.id = p.title_id
  AND t.title_key = 'revops'
  AND p.department IS NULL;

-- ── 7. Recreate view with secondary_role ─────────────────────────────────────

DROP VIEW IF EXISTS profiles_with_team_name;
CREATE VIEW profiles_with_team_name AS
SELECT p.*, t.name AS team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team_id;

-- ── 8. Record migration ─────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, name)
VALUES ('116', 'org_hierarchy_cleanup')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 116: secondary_role added, dept enum updated, titles cleaned, departments backfilled';
END $$;
