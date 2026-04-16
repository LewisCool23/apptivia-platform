-- =============================================================================
-- MIGRATION 113: Org Architecture Overhaul
-- =============================================================================
-- 1. full_name → GENERATED column (computed from first_name + last_name)
-- 2. level_enum → segment_enum (Territory, Mid-Market, Enterprise)
-- 3. Global titles seed (organization_id = NULL)
-- 4. Backfill title_id on existing profiles
-- =============================================================================

-- ── 1. Fix full_name — make it a GENERATED column ─────────────────────────────

-- Drop ALL views that depend on profiles.* (blocks ALTER on any profiles column)
DROP VIEW IF EXISTS profiles_with_team_name;

-- Drop existing full_name (regular text column) so we can re-add as GENERATED
ALTER TABLE profiles DROP COLUMN IF EXISTS full_name;

-- Add as GENERATED ALWAYS
ALTER TABLE profiles ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
  TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
) STORED;

-- NOTE: View will be recreated AFTER all column alterations are complete (section 2g)

-- ── 2. Segment enum — replace level_enum ──────────────────────────────────────

-- 2a. Convert ALL columns using level_enum to text (required to drop the enum)
ALTER TABLE profiles ALTER COLUMN level TYPE text USING level::text;
ALTER TABLE teams ALTER COLUMN level TYPE text USING level::text;
ALTER TABLE action_plans ALTER COLUMN focus_area TYPE text USING focus_area::text;

-- 2c. Map old values + catch-all for unexpected values (profiles)
UPDATE profiles SET level = 'Mid-Market' WHERE level = 'Midmarket';
UPDATE profiles SET level = NULL
  WHERE level IS NOT NULL
    AND level NOT IN ('Territory', 'Mid-Market', 'Enterprise');

-- Same for teams.level
UPDATE teams SET level = 'Mid-Market' WHERE level = 'Midmarket';
UPDATE teams SET level = NULL
  WHERE level IS NOT NULL
    AND level NOT IN ('Territory', 'Mid-Market', 'Enterprise');

-- 2d. Drop old enum and create new one
DROP TYPE IF EXISTS level_enum;
CREATE TYPE segment_enum AS ENUM ('Territory', 'Mid-Market', 'Enterprise');

-- 2e. Convert column to new enum and rename
-- For profiles: level → segment
ALTER TABLE profiles ALTER COLUMN level TYPE segment_enum
  USING CASE
    WHEN level IS NULL THEN NULL
    ELSE level::segment_enum
  END;
ALTER TABLE profiles RENAME COLUMN level TO segment;

-- For action_plans.focus_area: keep as text (it stores free-text focus areas now)
-- No conversion to segment_enum needed — it held level values but is really free-text

-- 2f. Convert teams.level to segment_enum and rename to segment
ALTER TABLE teams ALTER COLUMN level TYPE segment_enum
  USING CASE
    WHEN level IS NULL THEN NULL
    ELSE level::segment_enum
  END;
ALTER TABLE teams RENAME COLUMN level TO segment;

-- 2g. NOW recreate the view (after all profiles column changes are done)
CREATE OR REPLACE VIEW profiles_with_team_name AS
SELECT p.*, t.name AS team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team_id;

-- ── 3. Global titles — make titles table support global defaults ──────────────

-- 3a. Allow NULL organization_id for global titles
ALTER TABLE titles ALTER COLUMN organization_id DROP NOT NULL;

-- 3b. Partial unique index for global titles (org_id IS NULL)
-- The existing UNIQUE(organization_id, title_key) won't catch NULL duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_titles_global
  ON titles (title_key) WHERE organization_id IS NULL;

-- 3c. Seed 13 global titles
INSERT INTO titles (organization_id, title_key, title_name, description, sort_order) VALUES
  (NULL, 'bdr',              'Business Development Rep',    'Business Development Representative', 1),
  (NULL, 'bd_leader',        'Business Development Leader', 'Business Development Team Leader',    2),
  (NULL, 'sdr',              'Sales Development Rep',       'Sales Development Representative',    3),
  (NULL, 'ae',               'Account Executive',           'Account Executive',                   4),
  (NULL, 'sales_leader',     'Sales Leader',                'Sales Team Leader',                   5),
  (NULL, 'sales_admin',      'Sales Administrator',         'Sales Administrator',                 6),
  (NULL, 'am',               'Account Manager',             'Account Manager',                     7),
  (NULL, 'se',               'Solutions Engineer',           'Pre-Sales / Solutions Engineer',      8),
  (NULL, 'marketing_rep',    'Marketing Rep',               'Marketing Representative',            9),
  (NULL, 'marketing_leader', 'Marketing Leader',            'Marketing Team Leader',              10),
  (NULL, 'cs_rep',           'Customer Success Rep',        'Customer Success Representative',    11),
  (NULL, 'cs_leader',        'Customer Success Leader',     'Customer Success Team Leader',       12),
  (NULL, 'revops',           'Revenue Operations',          'Revenue Operations Specialist',      13)
ON CONFLICT (title_key) WHERE organization_id IS NULL DO NOTHING;

-- ── 4. Backfill title_id on existing profiles ─────────────────────────────────

-- Match profiles.title (text) → titles.title_name → set title_id
UPDATE profiles p
SET title_id = t.id
FROM titles t
WHERE t.organization_id IS NULL
  AND p.title_id IS NULL
  AND p.title IS NOT NULL
  AND (
    LOWER(p.title) = LOWER(t.title_name)
    OR (p.title ILIKE '%Sales Rep%' AND t.title_key = 'bdr')
    OR (p.title ILIKE '%Junior Sales%' AND t.title_key = 'sdr')
    OR (p.title ILIKE '%Senior Sales%' AND t.title_key = 'ae')
    OR (p.title ILIKE '%Business Development Manager%' AND t.title_key = 'bd_leader')
    OR (p.title ILIKE '%Sales Administrator%' AND t.title_key = 'sales_admin')
  );

-- ── 5. Backfill segments on teams from name patterns ─────────────────────────

UPDATE teams SET segment = 'Territory'::segment_enum
  WHERE segment IS NULL AND LOWER(name) LIKE '%territory%';
UPDATE teams SET segment = 'Mid-Market'::segment_enum
  WHERE segment IS NULL AND (LOWER(name) LIKE '%mid%market%' OR LOWER(name) LIKE '%midmarket%');
UPDATE teams SET segment = 'Enterprise'::segment_enum
  WHERE segment IS NULL AND LOWER(name) LIKE '%enterprise%';

-- Sync segment from teams → profiles (only where profile has no segment yet)
UPDATE profiles p SET segment = t.segment
  FROM teams t
  WHERE t.id = p.team_id
    AND t.segment IS NOT NULL
    AND p.segment IS NULL;

-- ── 6. Backfill departments on profiles from teams → departments ─────────────

-- profiles.department is department_enum — only set if departments.name is a valid enum value
UPDATE profiles p
SET department = d.name::department_enum
FROM teams t
JOIN departments d ON d.id = t.department_id
WHERE t.id = p.team_id
  AND t.department_id IS NOT NULL
  AND p.department IS NULL
  AND d.name IN ('Sales', 'Marketing', 'Customer Success', 'Product', 'Engineering');

-- ── 7. Record migration ──────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, name)
VALUES ('113', 'org_architecture_overhaul')
ON CONFLICT DO NOTHING;

-- ── 8. Done ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 113: full_name generated, segment_enum, global titles, title_id backfill, segment+department backfill';
END $$;
