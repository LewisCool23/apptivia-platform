-- =============================================================================
-- MIGRATION 115: Make profiles.title nullable
-- =============================================================================
-- The signup flow creates a profile before title is selected during onboarding.
-- The NOT NULL constraint causes "null value in column title" errors.
-- =============================================================================

ALTER TABLE profiles ALTER COLUMN title DROP NOT NULL;

-- ── Record migration ─────────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, name)
VALUES ('115', 'profiles_title_nullable')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 115: profiles.title is now nullable';
END $$;
