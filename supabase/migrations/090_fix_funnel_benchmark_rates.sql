-- Migration 090: Fix ALL funnel benchmark conversion rates
--
-- Migration 089 fixed meetings→opps and stage3→won but broke opps→SQLs (100%)
-- and SQLs→stage3 (150%). Using decimal values (column is numeric) so all 5
-- derived conversion rates are realistic SaaS SDR benchmarks:
--
--   Industry:       call→mtg 7.5%, mtg→opp 40%, opp→sql 50%, sql→stg3 58%, stg3→won 36%
--   Top Quartile:   call→mtg 8.8%, mtg→opp 43%, opp→sql 58%, sql→stg3 60%, stg3→won 40%

-- ── Industry benchmarks ──────────────────────────────────────────────────────

-- sourced_opps: 2 → 2.4  (mtg→opp = 2.4/6 = 40%)
UPDATE kpi_benchmarks SET value = 2.4
WHERE org_id IS NULL AND kpi_key = 'sourced_opps' AND benchmark_type = 'industry';

-- stage2_opps: 2 → 1.2  (opp→sql = 1.2/2.4 = 50%)
UPDATE kpi_benchmarks SET value = 1.2
WHERE org_id IS NULL AND kpi_key = 'stage2_opps' AND benchmark_type = 'industry';

-- stage3_opps: 3 → 0.7  (sql→stg3 = 0.7/1.2 = 58%)
UPDATE kpi_benchmarks SET value = 0.7
WHERE org_id IS NULL AND kpi_key = 'stage3_opps' AND benchmark_type = 'industry';

-- closed_won: 1 → 0.25  (stg3→won = 0.25/0.7 = 36%)
UPDATE kpi_benchmarks SET value = 0.25
WHERE org_id IS NULL AND kpi_key = 'closed_won' AND benchmark_type = 'industry';

-- ── Top quartile benchmarks ──────────────────────────────────────────────────

-- stage2_opps: 5 → 3.5  (opp→sql = 3.5/6 = 58%)
UPDATE kpi_benchmarks SET value = 3.5
WHERE org_id IS NULL AND kpi_key = 'stage2_opps' AND benchmark_type = 'top_quartile';

-- stage3_opps: 3 → 2.1  (sql→stg3 = 2.1/3.5 = 60%)
UPDATE kpi_benchmarks SET value = 2.1
WHERE org_id IS NULL AND kpi_key = 'stage3_opps' AND benchmark_type = 'top_quartile';

-- closed_won: 2 → 0.85  (stg3→won = 0.85/2.1 = 40%)
UPDATE kpi_benchmarks SET value = 0.85
WHERE org_id IS NULL AND kpi_key = 'closed_won' AND benchmark_type = 'top_quartile';
