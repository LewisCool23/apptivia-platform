-- =============================================================================
-- MIGRATION 157: Make Skillsets, Achievements, Badge Definitions GLOBAL
-- =============================================================================
-- These are universal structural definitions — same for every organization.
-- Per-org duplication (added by migration 118) caused data inconsistency:
--   - 102 achievements with mismatched org_id vs parent skillset org_id
--   - Different achievement counts per org (163 vs 165)
--   - Endless sync/copy failures
--
-- This migration:
--   1. Consolidates to ONE canonical set (Apptivia Test Org's IDs preserved)
--   2. Remaps all FK references (profile_achievements, profile_skillsets, etc.)
--   3. Removes organization_id dependency from structural tables
--   4. Replaces org-scoped constraints with global ones
--
-- After this: skillsets, achievements, badge_definitions have org_id = NULL.
-- Only profile_achievements, profile_skillsets, profile_badges remain per-org.
-- =============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 1: BUILD MAPPING TABLES
-- ════════════════════════════════════════════════════════════════════════════════
-- Canonical = Apptivia Test Org (c065a9f9-...) — includes original hardcoded UUIDs

CREATE TEMP TABLE skill_map AS
SELECT ct.id AS ct_id, at_s.id AS at_id, ct.name
FROM skillsets ct
JOIN skillsets at_s ON at_s.name = ct.name
  AND at_s.organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
WHERE ct.organization_id = '06dac631-b734-4c77-82ad-a24f826aec4f';

CREATE TEMP TABLE ach_map AS
SELECT ct.id AS ct_id, at_a.id AS at_id, ct.name
FROM achievements ct
JOIN achievements at_a ON at_a.name = ct.name
  AND at_a.organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
WHERE ct.organization_id = '06dac631-b734-4c77-82ad-a24f826aec4f';

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 2: REMAP FK REFERENCES (Construction Test → Apptivia Test)
-- ════════════════════════════════════════════════════════════════════════════════

-- 2a. Remove profile_achievements that would become duplicates after remapping
--     (safety guard: if a user somehow has both CT and AT versions of same achievement)
DELETE FROM profile_achievements pa
USING ach_map am
WHERE pa.achievement_id = am.ct_id
  AND EXISTS (
    SELECT 1 FROM profile_achievements pa2
    WHERE pa2.profile_id = pa.profile_id
      AND pa2.achievement_id = am.at_id
  );

-- 2b. Remap profile_achievements
UPDATE profile_achievements pa
SET achievement_id = am.at_id
FROM ach_map am
WHERE pa.achievement_id = am.ct_id;

-- 2c. Remove profile_skillsets that would become duplicates after remapping
DELETE FROM profile_skillsets ps
USING skill_map sm
WHERE ps.skillset_id = sm.ct_id
  AND EXISTS (
    SELECT 1 FROM profile_skillsets ps2
    WHERE ps2.profile_id = ps.profile_id
      AND ps2.skillset_id = sm.at_id
  );

-- 2d. Remap profile_skillsets
UPDATE profile_skillsets ps
SET skillset_id = sm.at_id
FROM skill_map sm
WHERE ps.skillset_id = sm.ct_id;

-- 2e. Remap profile_badges optional achievement_id
UPDATE profile_badges pb
SET achievement_id = am.at_id
FROM ach_map am
WHERE pb.achievement_id = am.ct_id;

-- 2f. Remap notifications optional FKs
UPDATE notifications n
SET achievement_id = am.at_id
FROM ach_map am
WHERE n.achievement_id = am.ct_id;

UPDATE notifications n
SET skillset_id = sm.at_id
FROM skill_map sm
WHERE n.skillset_id = sm.ct_id;

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 3: DELETE CONSTRUCTION TEST ACHIEVEMENTS (that have AT counterparts)
-- ════════════════════════════════════════════════════════════════════════════════

DELETE FROM achievements WHERE id IN (SELECT ct_id FROM ach_map);

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 4: FIX ALL REMAINING SKILLSET REFERENCES → CANONICAL SKILLSETS
-- ════════════════════════════════════════════════════════════════════════════════
-- Handles: CT-only achievements still pointing to CT skillsets,
-- AND any mismatched achievements pointing to CT skillsets (the 102 mismatches).

UPDATE achievements a
SET skillset_id = sm.at_id
FROM skill_map sm
WHERE a.skillset_id = sm.ct_id;

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 5: DELETE CONSTRUCTION TEST SKILLSETS
-- ════════════════════════════════════════════════════════════════════════════════
-- All FK references already remapped — safe to delete

DELETE FROM skillsets WHERE id IN (SELECT ct_id FROM skill_map);

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 6: CONSOLIDATE BADGE DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════════
-- profile_badges references by badge_name (not id), so just deduplicate.
-- Keep one row per badge_name, preferring Apptivia Test version.

WITH canonical_badges AS (
  SELECT DISTINCT ON (badge_name) id
  FROM badge_definitions
  ORDER BY badge_name,
    CASE WHEN organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949' THEN 0 ELSE 1 END,
    id
)
DELETE FROM badge_definitions
WHERE id NOT IN (SELECT id FROM canonical_badges);

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 7: MAKE ALL STRUCTURAL DEFINITIONS GLOBAL (org_id → NULL)
-- ════════════════════════════════════════════════════════════════════════════════

UPDATE skillsets SET organization_id = NULL;
UPDATE achievements SET organization_id = NULL;
UPDATE badge_definitions SET organization_id = NULL;

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 8: REPLACE ORG-SCOPED CONSTRAINTS WITH GLOBAL ONES
-- ════════════════════════════════════════════════════════════════════════════════

-- Drop org-scoped unique constraints
ALTER TABLE skillsets DROP CONSTRAINT IF EXISTS skillsets_name_org_unique;
DROP INDEX IF EXISTS idx_skillsets_name_org_unique;

DROP INDEX IF EXISTS idx_achievements_name_org_unique;

ALTER TABLE badge_definitions DROP CONSTRAINT IF EXISTS badge_definitions_badge_name_org_unique;
DROP INDEX IF EXISTS idx_badge_defs_name_org_unique;

-- Add global unique constraints (name only, no org scoping)
CREATE UNIQUE INDEX IF NOT EXISTS idx_skillsets_name_global ON skillsets (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_name_global ON achievements (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_defs_name_global ON badge_definitions (badge_name);

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE 9: REPORT
-- ════════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS ach_map;
DROP TABLE IF EXISTS skill_map;

DO $$
DECLARE
  s_count INT;
  a_count INT;
  b_count INT;
  null_check INT;
  s_rec RECORD;
BEGIN
  SELECT COUNT(*) INTO s_count FROM skillsets;
  SELECT COUNT(*) INTO a_count FROM achievements;
  SELECT COUNT(*) INTO b_count FROM badge_definitions;
  SELECT COUNT(*) INTO null_check FROM (
    SELECT organization_id FROM skillsets WHERE organization_id IS NOT NULL
    UNION ALL
    SELECT organization_id FROM achievements WHERE organization_id IS NOT NULL
    UNION ALL
    SELECT organization_id FROM badge_definitions WHERE organization_id IS NOT NULL
  ) x;

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 157: Global Structural Definitions';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Skillsets: % (expected: 7)', s_count;
  RAISE NOTICE 'Achievements: %', a_count;
  RAISE NOTICE 'Badge definitions: %', b_count;
  RAISE NOTICE 'Remaining non-NULL org_ids: % (expected: 0)', null_check;
  RAISE NOTICE '';

  FOR s_rec IN
    SELECT s.name, COUNT(a.id) AS ach_count
    FROM skillsets s
    LEFT JOIN achievements a ON a.skillset_id = s.id
    GROUP BY s.name ORDER BY s.name
  LOOP
    RAISE NOTICE '  %: % achievements', s_rec.name, s_rec.ach_count;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;
