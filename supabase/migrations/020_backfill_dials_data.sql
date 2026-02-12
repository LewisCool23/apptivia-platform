-- =============================================================================
-- MIGRATION 020: Backfill Dials KPI Data
-- =============================================================================
-- Purpose: Backfill missing dials data by estimating from call_connects
-- Reason: Users can't have call connects without making dials first
-- Assumption: Average 30% connect rate (i.e., dials = call_connects / 0.30)
-- =============================================================================

DO $$
DECLARE
  dials_kpi_id UUID;
  call_connects_kpi_id UUID;
  records_inserted INTEGER := 0;
BEGIN
  -- Get KPI IDs
  SELECT id INTO dials_kpi_id FROM kpi_metrics WHERE key = 'dials';
  SELECT id INTO call_connects_kpi_id FROM kpi_metrics WHERE key = 'call_connects';

  IF dials_kpi_id IS NULL THEN
    RAISE EXCEPTION 'dials KPI metric not found';
  END IF;

  IF call_connects_kpi_id IS NULL THEN
    RAISE EXCEPTION 'call_connects KPI metric not found';
  END IF;

  -- Backfill dials based on call_connects
  -- Assumes 30% connect rate, so dials = call_connects * 3.33
  INSERT INTO kpi_values (profile_id, kpi_id, value, period_start, period_end, created_at)
  SELECT 
    kv.profile_id,
    dials_kpi_id,
    ROUND(kv.value * 3.33)::INTEGER as estimated_dials, -- 30% connect rate
    kv.period_start,
    kv.period_end,
    NOW()
  FROM kpi_values kv
  WHERE kv.kpi_id = call_connects_kpi_id
    AND kv.value > 0
    AND NOT EXISTS (
      -- Only insert if dials data doesn't exist for this period
      SELECT 1 FROM kpi_values kv2
      WHERE kv2.profile_id = kv.profile_id
        AND kv2.kpi_id = dials_kpi_id
        AND kv2.period_start = kv.period_start
        AND kv2.period_end = kv.period_end
    );

  GET DIAGNOSTICS records_inserted = ROW_COUNT;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Backfilled dials data!';
  RAISE NOTICE '  → Inserted % dials records based on call_connects', records_inserted;
  RAISE NOTICE '  → Assumption: 30%% connect rate (dials = call_connects × 3.33)';
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- Verification Query
-- =============================================================================
DO $$
DECLARE
  user_count INTEGER;
  total_dials NUMERIC;
  total_connects NUMERIC;
BEGIN
  -- Count users who now have dials data
  SELECT 
    COUNT(DISTINCT kv.profile_id),
    SUM(CASE WHEN km.key = 'dials' THEN kv.value ELSE 0 END),
    SUM(CASE WHEN km.key = 'call_connects' THEN kv.value ELSE 0 END)
  INTO user_count, total_dials, total_connects
  FROM kpi_values kv
  JOIN kpi_metrics km ON km.id = kv.kpi_id
  WHERE km.key IN ('dials', 'call_connects');

  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  → % users with KPI data', user_count;
  RAISE NOTICE '  → Total dials: %', total_dials;
  RAISE NOTICE '  → Total connects: %', total_connects;
  IF total_dials > 0 THEN
    RAISE NOTICE '  → Connect rate: %%', ROUND((total_connects / total_dials * 100)::NUMERIC, 1);
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- Success Message
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '1. Award dials achievements to users:';
  RAISE NOTICE '   SELECT * FROM check_and_award_achievements();';
  RAISE NOTICE '';
  RAISE NOTICE '2. Verify achievements were awarded:';
  RAISE NOTICE '   SELECT email, has_1_dials, has_10_dials';
  RAISE NOTICE '   FROM (check query from CHECK_DIALS_ISSUE.sql)';
  RAISE NOTICE '';
  RAISE NOTICE '3. Going forward, ensure dials are tracked in your data import';
  RAISE NOTICE '   process so you have accurate real-time data.';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
END $$;
