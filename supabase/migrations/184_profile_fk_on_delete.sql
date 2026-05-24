-- Migration 184: Add ON DELETE SET NULL to profile FK columns
-- Fixes P1-22: Profile deletion would violate FK constraints
-- Using SET NULL (not CASCADE) — deleting a user should not delete their contests, deals, etc.

-- Helper: drop and re-add FK with ON DELETE SET NULL
-- We use a DO block to handle each constraint idempotently.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find all FK constraints referencing profiles(id) that lack ON DELETE action
  FOR r IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'profiles'
      AND ccu.column_name = 'id'
      AND rc.delete_rule = 'NO ACTION'
  LOOP
    -- Drop old constraint
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      r.table_schema, r.table_name, r.constraint_name
    );
    -- Re-add with ON DELETE SET NULL
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES profiles(id) ON DELETE SET NULL',
      r.table_schema, r.table_name, r.constraint_name, r.column_name
    );

    RAISE NOTICE 'Updated FK: %.% (%) → ON DELETE SET NULL', r.table_name, r.column_name, r.constraint_name;
  END LOOP;
END $$;
