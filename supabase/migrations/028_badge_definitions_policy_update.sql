-- Migration 028: Allow managers to manage badge definitions

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Badge definitions are writable by admins'
      AND tablename = 'badge_definitions'
  ) THEN
    DROP POLICY "Badge definitions are writable by admins" ON badge_definitions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Badge definitions are writable by admins and managers'
      AND tablename = 'badge_definitions'
  ) THEN
    CREATE POLICY "Badge definitions are writable by admins and managers" ON badge_definitions
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'manager')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'manager')
        )
      );
  END IF;
END $$;
