-- Migration 150: Add observability to upsert_kpi_sum
--
-- Changes RETURNS VOID → RETURNS BOOLEAN so callers can detect and log
-- duplicate skips. Returns TRUE if the event was new, FALSE if skipped.

-- Must drop first — PG cannot change return type via CREATE OR REPLACE
DROP FUNCTION IF EXISTS upsert_kpi_sum(UUID, UUID, DATE, DATE, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION upsert_kpi_sum(
  p_profile_id        UUID,
  p_kpi_id            UUID,
  p_period_start      DATE,
  p_period_end        DATE,
  p_increment         NUMERIC,
  p_source            TEXT,
  p_external_event_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
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
      RETURN FALSE;  -- Already processed — idempotent skip
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

  RETURN TRUE;  -- New event processed
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('150', 'kpi_sum_dedup_observability', NOW())
ON CONFLICT (version) DO NOTHING;
