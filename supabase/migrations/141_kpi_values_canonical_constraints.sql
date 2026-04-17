-- Migration 141: kpi_values canonical constraints + atomic sum RPC
--
-- Phase 0 found: kpi_values has ONLY a PK on id — NO unique constraints at all.
-- Phase 0.5 confirmed: zero duplicate rows across 20,672 records.
--
-- This migration adds:
--   1. Backup table (retained per spec — DO NOT DROP without explicit approval)
--   2. Partial unique on external_event_id (dedup same webhook event re-delivery)
--   3. Composite unique on (profile_id, kpi_id, period_start) (one aggregated row per period)
--   4. RPC upsert_kpi_sum() for atomic increment (eliminates read-then-write race)

BEGIN;

-- 1. Backup (safe — zero dups confirmed)
CREATE TABLE IF NOT EXISTS kpi_values_backup_141 AS TABLE kpi_values;

-- 2. Partial unique: prevents re-processing the same webhook event
--    NULLs are exempt (aggregated sum rows store NULL external_event_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_values_external_event
  ON kpi_values (external_event_id)
  WHERE external_event_id IS NOT NULL;

-- 3. Composite unique: one aggregated row per profile + KPI + week
ALTER TABLE kpi_values
  ADD CONSTRAINT uq_kpi_values_profile_kpi_period
  UNIQUE (profile_id, kpi_id, period_start);

-- 4. Atomic sum-mode upsert RPC
--    Replaces the JS-side SELECT→UPDATE/INSERT pattern which has a TOCTOU race:
--    two concurrent webhooks can both SELECT the same value, then both UPDATE,
--    losing one increment. This RPC uses INSERT ... ON CONFLICT ... DO UPDATE
--    which is atomic within a single SQL statement.
CREATE OR REPLACE FUNCTION upsert_kpi_sum(
  p_profile_id    UUID,
  p_kpi_id        UUID,
  p_period_start  DATE,
  p_period_end    DATE,
  p_increment     NUMERIC,
  p_source        TEXT,
  p_external_event_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO kpi_values (profile_id, kpi_id, period_start, period_end, value, source, external_event_id, sample_count)
  VALUES (p_profile_id, p_kpi_id, p_period_start, p_period_end, p_increment, p_source, p_external_event_id, 1)
  ON CONFLICT (profile_id, kpi_id, period_start)
  DO UPDATE SET
    value        = kpi_values.value + p_increment,
    source       = p_source,
    sample_count = COALESCE(kpi_values.sample_count, 1) + 1;
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('141', 'kpi_values_canonical_constraints', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
