-- =============================================================================
-- MIGRATION 139: Seed Structural Definitions for All Organizations
-- =============================================================================
-- Purpose: Ensure every org has the structural definitions needed for the
-- achievement/badge/skillset system to function.
--
-- Migration 118 backfilled skillsets, achievements, and badge_definitions
-- ONLY to Apptivia Test Organization. This migration copies those structural
-- definitions to every other org that currently has zero skillsets.
--
-- What gets seeded (structural definitions only):
--   - skillsets (7 category containers)
--   - achievements (rule definitions for cron evaluation)
--   - badge_definitions (badge templates)
--
-- What does NOT get seeded (earned through activity):
--   - profile_achievements, profile_badges, profile_skillsets
--
-- IDEMPOTENT: Safe to re-run. Only seeds orgs with zero skillsets.
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 0: Fix UNIQUE constraints to be org-scoped
-- ═══════════════════════════════════════════════════════════════════════════════
-- skillsets.name and badge_definitions.badge_name have plain UNIQUE constraints
-- that block inserting the same names for different orgs. Change to composite.

-- Skillsets: name → (name, organization_id)
DO $$
BEGIN
  -- Try dropping the constraint (name varies by how it was created)
  BEGIN
    ALTER TABLE skillsets DROP CONSTRAINT IF EXISTS skillsets_name_key;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE skillsets DROP CONSTRAINT IF EXISTS skillsets_name_unique;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  -- Drop any unique index on name alone
  DROP INDEX IF EXISTS skillsets_name_key;
  DROP INDEX IF EXISTS skillsets_name_idx;
  -- Add composite unique
  ALTER TABLE skillsets ADD CONSTRAINT skillsets_name_org_unique
    UNIQUE (name, organization_id);
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'skillsets_name_org_unique already exists';
END $$;

-- Badge definitions: badge_name → (badge_name, organization_id)
DO $$
BEGIN
  BEGIN
    ALTER TABLE badge_definitions DROP CONSTRAINT IF EXISTS badge_definitions_badge_name_key;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE badge_definitions DROP CONSTRAINT IF EXISTS badge_definitions_badge_name_unique;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  DROP INDEX IF EXISTS badge_definitions_badge_name_key;
  DROP INDEX IF EXISTS badge_definitions_badge_name_idx;
  ALTER TABLE badge_definitions ADD CONSTRAINT badge_definitions_badge_name_org_unique
    UNIQUE (badge_name, organization_id);
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'badge_definitions_badge_name_org_unique already exists';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Seed skillsets for orgs that have none
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  source_org_id UUID;
  target_org RECORD;
  source_skillset RECORD;
  new_skillset_id UUID;
  source_achievement RECORD;
  new_skillset_target UUID;
  seeded_org_count INT := 0;
  seeded_skillset_count INT := 0;
  seeded_achievement_count INT := 0;
  seeded_badge_count INT := 0;
  row_count_var INT;
BEGIN
  -- Find the source org (Apptivia Test Organization)
  SELECT id INTO source_org_id
  FROM organizations
  WHERE name = 'Apptivia Test Organization'
  LIMIT 1;

  IF source_org_id IS NULL THEN
    RAISE EXCEPTION 'Source organization "Apptivia Test Organization" not found';
  END IF;

  RAISE NOTICE 'Source org: %', source_org_id;

  -- Loop through orgs that need seeding (zero skillsets)
  FOR target_org IN
    SELECT o.id, o.name
    FROM organizations o
    WHERE o.id != source_org_id
      AND NOT EXISTS (
        SELECT 1 FROM skillsets s WHERE s.organization_id = o.id
      )
  LOOP
    RAISE NOTICE 'Seeding org: % (%)', target_org.name, target_org.id;
    seeded_org_count := seeded_org_count + 1;

    -- ─────────────────────────────────────────────────
    -- Seed skillsets
    -- ─────────────────────────────────────────────────
    FOR source_skillset IN
      SELECT id, name, description, icon, color
      FROM skillsets
      WHERE organization_id = source_org_id
    LOOP
      new_skillset_id := gen_random_uuid();

      INSERT INTO skillsets (id, organization_id, name, description, icon, color)
      VALUES (
        new_skillset_id,
        target_org.id,
        source_skillset.name,
        source_skillset.description,
        source_skillset.icon,
        source_skillset.color
      );

      seeded_skillset_count := seeded_skillset_count + 1;

      -- ─────────────────────────────────────────────────
      -- Seed achievements for this skillset
      -- ─────────────────────────────────────────────────
      FOR source_achievement IN
        SELECT name, description, points, difficulty, criteria
        FROM achievements
        WHERE organization_id = source_org_id
          AND skillset_id = source_skillset.id
      LOOP
        INSERT INTO achievements (
          id, organization_id, skillset_id,
          name, description, points, difficulty, criteria
        )
        VALUES (
          gen_random_uuid(),
          target_org.id,
          new_skillset_id,
          source_achievement.name,
          source_achievement.description,
          source_achievement.points,
          source_achievement.difficulty,
          source_achievement.criteria
        );

        seeded_achievement_count := seeded_achievement_count + 1;
      END LOOP;
    END LOOP;

    -- ─────────────────────────────────────────────────
    -- Seed badge definitions
    -- ─────────────────────────────────────────────────
    INSERT INTO badge_definitions (
      id, organization_id,
      badge_type, badge_name, badge_description,
      icon, color, criteria_type, criteria_value,
      points, is_rare, category, rarity, requirements
    )
    SELECT
      gen_random_uuid(),
      target_org.id,
      bd.badge_type, bd.badge_name, bd.badge_description,
      bd.icon, bd.color, bd.criteria_type, bd.criteria_value,
      bd.points, bd.is_rare, bd.category, bd.rarity, bd.requirements
    FROM badge_definitions bd
    WHERE bd.organization_id = source_org_id;

    GET DIAGNOSTICS row_count_var = ROW_COUNT;
    seeded_badge_count := seeded_badge_count + row_count_var;

  END LOOP;

  RAISE NOTICE '──────────────────────────────────────';
  RAISE NOTICE 'Migration 139 complete:';
  RAISE NOTICE '  Organizations seeded: %', seeded_org_count;
  RAISE NOTICE '  Skillsets seeded: %', seeded_skillset_count;
  RAISE NOTICE '  Achievement definitions seeded: %', seeded_achievement_count;
  RAISE NOTICE '  Badge definitions seeded (approx): %', seeded_badge_count;
  RAISE NOTICE '──────────────────────────────────────';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Record migration
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO schema_migrations (version, name)
VALUES ('139', 'seed_org_structural_definitions')
ON CONFLICT DO NOTHING;

COMMIT;
