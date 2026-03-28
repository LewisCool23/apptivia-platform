-- Migration 058: Funnel view support + benchmark system
-- Adds stage3_opps KPI, kpi_benchmarks table, and seeds industry averages

-- 1. Add Stage 3 Opportunities KPI
INSERT INTO kpi_metrics (key, name, description, goal, weight, unit, category, is_custom, is_active, show_on_scorecard)
VALUES (
  'stage3_opps',
  'Stage 3 Opportunities',
  'Opportunities advanced to Stage 3 (late-stage / proposal)',
  2, 0.15, 'count', 'pipeline', false, true, false
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  goal = EXCLUDED.goal,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;

-- 2. Create kpi_benchmarks table
CREATE TABLE IF NOT EXISTS kpi_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  kpi_key text NOT NULL,
  benchmark_type text NOT NULL CHECK (benchmark_type IN ('industry', 'top_quartile', 'custom')),
  value numeric NOT NULL,
  label text,
  created_at timestamptz DEFAULT now()
);

-- Unique index: one row per (org, key, type), with global rows having NULL org_id
CREATE UNIQUE INDEX IF NOT EXISTS kpi_benchmarks_org_key_type
  ON kpi_benchmarks (org_id, kpi_key, benchmark_type)
  WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS kpi_benchmarks_global_key_type
  ON kpi_benchmarks (kpi_key, benchmark_type)
  WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_benchmarks_org ON kpi_benchmarks(org_id);
CREATE INDEX IF NOT EXISTS idx_kpi_benchmarks_key ON kpi_benchmarks(kpi_key);

-- 3. RLS
ALTER TABLE kpi_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read benchmarks" ON kpi_benchmarks;
CREATE POLICY "Authenticated users read benchmarks"
  ON kpi_benchmarks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage org benchmarks" ON kpi_benchmarks;
CREATE POLICY "Admins manage org benchmarks"
  ON kpi_benchmarks FOR ALL
  TO authenticated
  USING (
    org_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    org_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- 4. Seed global industry benchmarks (org_id IS NULL = applies to all orgs)
-- Absolute values are weekly per-rep targets based on SaaS SDR industry data.
-- Conversion rates (derived in UI): calls→meetings ~8%, meetings→opps ~40%,
-- opps→SQLs ~50%, SQLs→stage3 ~60%, stage3→closed ~35%

INSERT INTO kpi_benchmarks (org_id, kpi_key, benchmark_type, value, label) VALUES
  -- Industry averages
  (NULL, 'call_connects',  'industry',     80,  'SaaS Industry Avg'),
  (NULL, 'meetings',       'industry',      6,  'SaaS Industry Avg'),
  (NULL, 'sourced_opps',   'industry',      4,  'SaaS Industry Avg'),
  (NULL, 'stage2_opps',    'industry',      2,  'SaaS Industry Avg (SQLs)'),
  (NULL, 'stage3_opps',    'industry',      1,  'SaaS Industry Avg'),
  (NULL, 'closed_won',     'industry',      1,  'SaaS Industry Avg'),
  -- Top quartile (top 25% SDR performance)
  (NULL, 'call_connects',  'top_quartile', 160, 'Top Quartile'),
  (NULL, 'meetings',       'top_quartile',  14, 'Top Quartile'),
  (NULL, 'sourced_opps',   'top_quartile',   8, 'Top Quartile'),
  (NULL, 'stage2_opps',    'top_quartile',   5, 'Top Quartile'),
  (NULL, 'stage3_opps',    'top_quartile',   3, 'Top Quartile'),
  (NULL, 'closed_won',     'top_quartile',   2, 'Top Quartile')
ON CONFLICT DO NOTHING;
