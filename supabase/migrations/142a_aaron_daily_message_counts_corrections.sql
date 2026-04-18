-- Migration 142a: Correct aaron_daily_message_counts to match spec
--
-- Fixes 9 deviations from build_v2 spec introduced in migration 142:
--   1. Rename column: day → message_date
--   2. Add organization_id (NOT NULL, FK to organizations)
--   3. Add created_at / updated_at timestamps
--   4. Add index on message_date
--   5. Enable RLS + 2 policies
--   6. Replace check_aaron_daily_limit RPC (INTEGER → BOOLEAN, 1 → 3 args)
--   7. Replace increment_aaron_daily_count RPC (VOID → INTEGER, 1 → 3 args)
--   8. Add SECURITY DEFINER to both RPCs
--   9. Add GRANT statements
--
-- Safe: table has 0 rows in prod (feature just deployed, no Starter users active).

BEGIN;

-- 1. Rename column: day → message_date
ALTER TABLE aaron_daily_message_counts RENAME COLUMN day TO message_date;

-- Remove the DEFAULT CURRENT_DATE that was on the old 'day' column (spec has no default)
ALTER TABLE aaron_daily_message_counts ALTER COLUMN message_date DROP DEFAULT;

-- 2. Add organization_id — nullable first, then backfill, then NOT NULL
ALTER TABLE aaron_daily_message_counts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill from profiles (safe for 0-row table, but correct pattern for future rows)
UPDATE aaron_daily_message_counts adc
SET organization_id = p.organization_id
FROM profiles p
WHERE adc.user_id = p.id
  AND adc.organization_id IS NULL;

-- Delete any orphans that couldn't be backfilled (shouldn't exist)
DELETE FROM aaron_daily_message_counts WHERE organization_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE aaron_daily_message_counts ALTER COLUMN organization_id SET NOT NULL;

-- 3. Add timestamps
ALTER TABLE aaron_daily_message_counts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE aaron_daily_message_counts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Index on message_date
CREATE INDEX IF NOT EXISTS aaron_daily_counts_date_idx
  ON aaron_daily_message_counts (message_date);

-- 5. RLS
ALTER TABLE aaron_daily_message_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY aaron_daily_counts_read_own ON aaron_daily_message_counts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY aaron_daily_counts_service_bypass ON aaron_daily_message_counts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Replace check_aaron_daily_limit: (UUID) → (UUID, DATE, INTEGER) RETURNS BOOLEAN
DROP FUNCTION IF EXISTS check_aaron_daily_limit(UUID);

CREATE OR REPLACE FUNCTION check_aaron_daily_limit(
  p_user_id UUID,
  p_date DATE,
  p_limit INTEGER DEFAULT 10
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(count, 0) INTO v_count
  FROM aaron_daily_message_counts
  WHERE user_id = p_user_id AND message_date = p_date;

  RETURN COALESCE(v_count, 0) < p_limit;
END;
$$;

-- 7. Replace increment_aaron_daily_count: (UUID) → (UUID, UUID, DATE) RETURNS INTEGER
DROP FUNCTION IF EXISTS increment_aaron_daily_count(UUID);

CREATE OR REPLACE FUNCTION increment_aaron_daily_count(
  p_user_id UUID,
  p_organization_id UUID,
  p_date DATE
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  INSERT INTO aaron_daily_message_counts (user_id, organization_id, message_date, count)
  VALUES (p_user_id, p_organization_id, p_date, 1)
  ON CONFLICT (user_id, message_date)
  DO UPDATE SET
    count = aaron_daily_message_counts.count + 1,
    updated_at = NOW()
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- 8. GRANT to service_role
GRANT EXECUTE ON FUNCTION check_aaron_daily_limit(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_aaron_daily_count(UUID, UUID, DATE) TO service_role;

-- 9. Schema migrations record
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('142a', 'aaron_daily_message_counts_corrections', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
