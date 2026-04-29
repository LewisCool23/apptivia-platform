-- Migration 149: Fix sum-mode KPI dedup on re-sync
--
-- Problem: upsert_kpi_sum() increments value on every call, even for events
-- already processed. Only the first event's external_event_id is stored per
-- weekly row, so events 2+ are never detected as duplicates. Re-syncing an
-- integration doubles/triples KPI values.
--
-- Fix: Add a processed_event_ids JSONB array to track ALL event IDs that have
-- been aggregated into each sum row. The RPC checks this array before
-- incrementing, making re-sync idempotent.

BEGIN;

-- 1. Add tracking column (no-op if already exists)
ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS processed_event_ids JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill: seed existing rows with their current external_event_id
UPDATE kpi_values
SET processed_event_ids = jsonb_build_array(external_event_id)
WHERE external_event_id IS NOT NULL
  AND (processed_event_ids IS NULL OR processed_event_ids = '[]'::jsonb);

-- 3. Replace the upsert_kpi_sum RPC with dedup-aware version
CREATE OR REPLACE FUNCTION upsert_kpi_sum(
  p_profile_id        UUID,
  p_kpi_id            UUID,
  p_period_start      DATE,
  p_period_end        DATE,
  p_increment         NUMERIC,
  p_source            TEXT,
  p_external_event_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Dedup: skip if this specific event was already aggregated into the weekly row.
  IF p_external_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM kpi_values
      WHERE profile_id  = p_profile_id
        AND kpi_id      = p_kpi_id
        AND period_start = p_period_start
        AND processed_event_ids @> to_jsonb(p_external_event_id::text)
    ) THEN
      RETURN;  -- Already processed — idempotent skip
    END IF;
  END IF;

  INSERT INTO kpi_values (
    profile_id, kpi_id, period_start, period_end,
    value, source, external_event_id, sample_count, processed_event_ids
  )
  VALUES (
    p_profile_id, p_kpi_id, p_period_start, p_period_end,
    p_increment, p_source, p_external_event_id, 1,
    CASE WHEN p_external_event_id IS NOT NULL
         THEN jsonb_build_array(p_external_event_id)
         ELSE '[]'::jsonb
    END
  )
  ON CONFLICT (profile_id, kpi_id, period_start)
  DO UPDATE SET
    value              = kpi_values.value + p_increment,
    source             = p_source,
    sample_count       = COALESCE(kpi_values.sample_count, 1) + 1,
    processed_event_ids = CASE
      WHEN p_external_event_id IS NOT NULL
      THEN COALESCE(kpi_values.processed_event_ids, '[]'::jsonb) || jsonb_build_array(p_external_event_id)
      ELSE kpi_values.processed_event_ids
    END;
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('149', 'kpi_sum_dedup', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
