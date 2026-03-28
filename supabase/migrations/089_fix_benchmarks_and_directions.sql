-- Migration 089: Fix funnel benchmark conversion rates + KPI direction corrections
--
-- 1. Fix industry benchmarks so derived conversion rates match real SaaS SDR data:
--      calls→meetings ~8%, meetings→opps ~40%, opps→SQLs ~50%,
--      SQLs→stage3 ~50%, stage3→closed ~33%
--    Original seed had sourced_opps=4 (gave 66.7% meeting→opp) and stage3_opps=1
--    (gave 100% stage3→won). Corrected to sourced_opps=2 and stage3_opps=3.
--
-- 2. Fix direction for response_time and sales_cycle_days (lower is better).

-- ── 1. Fix industry benchmarks ─────────────────────────────────────────────────

-- sourced_opps: 4 → 2  (meetings→opps becomes 2/6 = 33%, realistic ~35-40%)
UPDATE kpi_benchmarks
SET value = 2
WHERE org_id IS NULL AND kpi_key = 'sourced_opps' AND benchmark_type = 'industry';

-- stage3_opps: 1 → 3  (stage3→won becomes 1/3 = 33%, realistic ~30-35%)
UPDATE kpi_benchmarks
SET value = 3
WHERE org_id IS NULL AND kpi_key = 'stage3_opps' AND benchmark_type = 'industry';

-- Also fix top_quartile sourced_opps to maintain realistic ratios:
-- top quartile meetings=14, sourced_opps was 8 → 57%. Set to 6 → 6/14 = 43%
UPDATE kpi_benchmarks
SET value = 6
WHERE org_id IS NULL AND kpi_key = 'sourced_opps' AND benchmark_type = 'top_quartile';

-- top quartile stage3_opps: 3 is already correct (closed_won=2, so 2/3 = 67% — top quartile should be higher)

-- ── 2. Fix KPI directions ──────────────────────────────────────────────────────

-- response_time: lower response time = better performance
UPDATE kpi_metrics SET direction = 'lower' WHERE key = 'response_time';

-- sales_cycle_days: shorter sales cycle = better performance
UPDATE kpi_metrics SET direction = 'lower' WHERE key = 'sales_cycle_days';

-- The kpi_metric_history trigger will automatically capture these direction changes.
