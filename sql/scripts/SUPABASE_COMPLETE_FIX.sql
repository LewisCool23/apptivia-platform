-- =============================================================================
-- SUPABASE SQL EDITOR: Complete Fix for Dials Data and Achievements
-- =============================================================================
-- Copy and paste this entire script into Supabase SQL Editor
-- This will backfill dials data and award achievements
-- =============================================================================

-- STEP 1: Backfill dials data from call_connects
DO $$
DECLARE
  dials_kpi_id UUID;
  call_connects_kpi_id UUID;
  records_inserted INTEGER := 0;
BEGIN
  SELECT id INTO dials_kpi_id FROM kpi_metrics WHERE key = 'dials';
  SELECT id INTO call_connects_kpi_id FROM kpi_metrics WHERE key = 'call_connects';

  INSERT INTO kpi_values (profile_id, kpi_id, value, period_start, period_end, created_at)
  SELECT 
    kv.profile_id,
    dials_kpi_id,
    ROUND(kv.value * 3.33)::INTEGER, -- Assumes 30% connect rate
    kv.period_start,
    kv.period_end,
    NOW()
  FROM kpi_values kv
  WHERE kv.kpi_id = call_connects_kpi_id
    AND kv.value > 0
    AND NOT EXISTS (
      SELECT 1 FROM kpi_values kv2
      WHERE kv2.profile_id = kv.profile_id
        AND kv2.kpi_id = dials_kpi_id
        AND kv2.period_start = kv.period_start
        AND kv2.period_end = kv.period_end
    );

  GET DIAGNOSTICS records_inserted = ROW_COUNT;
  RAISE NOTICE '✓ STEP 1 COMPLETE: Inserted % dials records', records_inserted;
END $$;

-- STEP 2: Award achievements based on new dials data
SELECT 
  '✓ STEP 2: Awarding achievements...' as status,
  profile_email,
  achievements_awarded,
  achievements_awarded || ' new achievements' as result
FROM check_and_award_achievements()
WHERE achievements_awarded > 0
ORDER BY achievements_awarded DESC
LIMIT 20;

-- STEP 3: Verify the fix worked
SELECT 
  '✓ STEP 3: Verification for sample users' as status,
  p.email,
  COALESCE(SUM(CASE WHEN km.key = 'dials' THEN kv.value ELSE 0 END), 0) as total_dials,
  COALESCE(SUM(CASE WHEN km.key = 'call_connects' THEN kv.value ELSE 0 END), 0) as total_connects,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '1 Dials Made'
  ) as has_1_dials,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '10 Dials Made'
  ) as has_10_dials
FROM profiles p
LEFT JOIN kpi_values kv ON kv.profile_id = p.id
LEFT JOIN kpi_metrics km ON km.id = kv.kpi_id AND km.key IN ('dials', 'call_connects')
WHERE p.email IN (
  'benjamin.webb@apptivia.app',
  'alex.rivera@apptivia.app',
  'jordan.smith@apptivia.app'
)
GROUP BY p.id, p.email
ORDER BY p.email;
