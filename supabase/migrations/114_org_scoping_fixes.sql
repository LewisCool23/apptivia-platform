-- =============================================================================
-- MIGRATION 114: Org-Scoping Fixes
-- =============================================================================
-- 1. Fix kpi_org_config_history RLS — add INSERT policy for trigger
-- 2. Add organization_id to coaching_plans + coaching_plan_assignments
-- 3. Backfill organization_id on coaching tables from profiles
-- =============================================================================

-- ── 1. Fix kpi_org_config_history RLS ────────────────────────────────────────
-- The trigger fn_kpi_org_config_history() inserts into kpi_org_config_history
-- but only a SELECT policy exists. Add INSERT + UPDATE policies.

DROP POLICY IF EXISTS kpi_org_config_history_insert ON kpi_org_config_history;
CREATE POLICY kpi_org_config_history_insert
  ON kpi_org_config_history FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS kpi_org_config_history_update ON kpi_org_config_history;
CREATE POLICY kpi_org_config_history_update
  ON kpi_org_config_history FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- ── 2. Add organization_id to coaching_plans ─────────────────────────────────

ALTER TABLE coaching_plans
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_coaching_plans_org
  ON coaching_plans (organization_id);

-- ── 3. Add organization_id to coaching_plan_assignments ──────────────────────

ALTER TABLE coaching_plan_assignments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_coaching_plan_assignments_org
  ON coaching_plan_assignments (organization_id);

-- ── 4. Backfill organization_id on coaching_plans from created_by → profiles ─

UPDATE coaching_plans cp
SET organization_id = p.organization_id
FROM profiles p
WHERE p.id = cp.created_by
  AND cp.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

-- ── 5. Backfill organization_id on coaching_plan_assignments ─────────────────

UPDATE coaching_plan_assignments cpa
SET organization_id = p.organization_id
FROM profiles p
WHERE p.id = cpa.assigned_to
  AND cpa.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

-- ── 6. Record migration ─────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, name)
VALUES ('114', 'org_scoping_fixes')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 114: kpi_org_config_history RLS fix, coaching_plans + assignments org_id added and backfilled';
END $$;
