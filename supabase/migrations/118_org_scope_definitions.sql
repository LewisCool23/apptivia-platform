-- =============================================================================
-- MIGRATION 118: Org-Scope Definitions
-- =============================================================================
-- 1. Add organization_id to skillsets + RLS
-- 2. Add organization_id to badge_definitions + RLS
-- 3. Add organization_id to achievements + RLS
-- 4. Fix kpi_org_config_history RLS (replace USING(true) with org check)
-- 5. Add org-scoped RLS to coaching_plans
-- 6. Add org-scoped RLS to coaching_plan_assignments
--
-- Uses auth_user_org_id() and auth_user_role() from migration 039.
-- IDEMPOTENT: Safe to re-run (IF NOT EXISTS / IF EXISTS guards).
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. SKILLSETS — add organization_id, index, backfill, RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE skillsets
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_skillsets_org ON skillsets(organization_id);

-- Backfill all existing skillsets to Apptivia Test Org
UPDATE skillsets
SET organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
WHERE organization_id IS NULL;

-- Drop old permissive policy from migration 007
DROP POLICY IF EXISTS "Allow authenticated users to view skillsets" ON skillsets;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS skillsets_org_select ON skillsets;
DROP POLICY IF EXISTS skillsets_org_admin_all ON skillsets;

-- SELECT: users can only see skillsets belonging to their org
CREATE POLICY skillsets_org_select
  ON skillsets FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- INSERT/UPDATE/DELETE: admins only, scoped to their org
CREATE POLICY skillsets_org_admin_all
  ON skillsets FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. BADGE_DEFINITIONS — add organization_id, index, backfill, RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE badge_definitions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_badge_definitions_org ON badge_definitions(organization_id);

-- Backfill all existing badge definitions to Apptivia Test Org
UPDATE badge_definitions
SET organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
WHERE organization_id IS NULL;

-- Drop old permissive policies from migration 027
DROP POLICY IF EXISTS "Badge definitions are readable by everyone" ON badge_definitions;
DROP POLICY IF EXISTS "Badge definitions are writable by admins" ON badge_definitions;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS badge_definitions_org_select ON badge_definitions;
DROP POLICY IF EXISTS badge_definitions_org_admin_all ON badge_definitions;

-- SELECT: users can only see badge definitions belonging to their org
CREATE POLICY badge_definitions_org_select
  ON badge_definitions FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- INSERT/UPDATE/DELETE: admins only, scoped to their org
CREATE POLICY badge_definitions_org_admin_all
  ON badge_definitions FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ACHIEVEMENTS — add organization_id, index, backfill, RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_achievements_org ON achievements(organization_id);

-- Backfill all existing achievements to Apptivia Test Org
UPDATE achievements
SET organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
WHERE organization_id IS NULL;

-- Drop old permissive policy from migration 007
DROP POLICY IF EXISTS "Allow authenticated users to view achievements" ON achievements;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS achievements_org_select ON achievements;
DROP POLICY IF EXISTS achievements_org_admin_all ON achievements;

-- SELECT: users can only see achievements belonging to their org
CREATE POLICY achievements_org_select
  ON achievements FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- INSERT/UPDATE/DELETE: admins only, scoped to their org
CREATE POLICY achievements_org_admin_all
  ON achievements FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. KPI_ORG_CONFIG_HISTORY — replace USING(true) policies with org check
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing permissive policies from migrations 105 and 114
DROP POLICY IF EXISTS kpi_org_config_history_read ON kpi_org_config_history;
DROP POLICY IF EXISTS kpi_org_config_history_insert ON kpi_org_config_history;
DROP POLICY IF EXISTS kpi_org_config_history_update ON kpi_org_config_history;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS kpi_org_config_history_org_select ON kpi_org_config_history;
DROP POLICY IF EXISTS kpi_org_config_history_org_insert ON kpi_org_config_history;
DROP POLICY IF EXISTS kpi_org_config_history_org_update ON kpi_org_config_history;

-- SELECT: scoped to user's org
CREATE POLICY kpi_org_config_history_org_select
  ON kpi_org_config_history FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- INSERT: needed by the trigger function (runs as SECURITY DEFINER context)
-- The trigger inserts via fn_kpi_org_config_history() which fires AFTER INSERT/UPDATE
-- on kpi_org_configs. Since the trigger function itself is not SECURITY DEFINER,
-- the insert happens as the authenticated user, so we need a permissive INSERT policy
-- scoped to the user's org.
CREATE POLICY kpi_org_config_history_org_insert
  ON kpi_org_config_history FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- UPDATE: needed by trigger to close out old history rows (set valid_to)
CREATE POLICY kpi_org_config_history_org_update
  ON kpi_org_config_history FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. COACHING_PLANS — add org-scoped RLS
--    (organization_id column already added in migration 114)
--    (RLS already enabled in migration 012)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing policies (from migrations 028 and 082)
DROP POLICY IF EXISTS coaching_plans_owner_access ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_select ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_insert ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_update ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_delete ON coaching_plans;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS coaching_plans_org_select ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_org_insert ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_org_update ON coaching_plans;
DROP POLICY IF EXISTS coaching_plans_org_delete ON coaching_plans;

-- SELECT: org-scoped + role-based visibility
CREATE POLICY coaching_plans_org_select
  ON coaching_plans FOR SELECT TO authenticated
  USING (
    -- Must be in same org
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Admins see all org plans
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      -- Managers see plans they created, assigned to, or team-related
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
        AND (
          auth.uid() = created_by
          OR auth.uid() = ANY(assigned_to)
          OR team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = ANY(coaching_plans.assigned_to)
            AND p.team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
          )
        )
      )
      -- Coach role: own + assigned
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach')
        AND (auth.uid() = created_by OR auth.uid() = ANY(assigned_to))
      )
      -- Reps / power users: only plans assigned to them
      OR auth.uid() = ANY(assigned_to)
    )
  );

-- INSERT: admin, manager, coach can create within their org
CREATE POLICY coaching_plans_org_insert
  ON coaching_plans FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );

-- UPDATE: admin, manager, coach can update their own org's plans
CREATE POLICY coaching_plans_org_update
  ON coaching_plans FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      auth.uid() = created_by
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );

-- DELETE: admin, manager, coach can delete their own org's plans
CREATE POLICY coaching_plans_org_delete
  ON coaching_plans FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      auth.uid() = created_by
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. COACHING_PLAN_ASSIGNMENTS — add org-scoped RLS
--    (organization_id column already added in migration 114)
--    (RLS already enabled in migration 026)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing policies (from migrations 026 and 028)
DROP POLICY IF EXISTS coaching_plan_assignments_read ON coaching_plan_assignments;
DROP POLICY IF EXISTS coaching_plan_assignments_insert ON coaching_plan_assignments;
DROP POLICY IF EXISTS coaching_plan_assignments_update ON coaching_plan_assignments;

-- Drop new policies in case of re-run
DROP POLICY IF EXISTS coaching_plan_assignments_org_select ON coaching_plan_assignments;
DROP POLICY IF EXISTS coaching_plan_assignments_org_insert ON coaching_plan_assignments;
DROP POLICY IF EXISTS coaching_plan_assignments_org_update ON coaching_plan_assignments;
DROP POLICY IF EXISTS coaching_plan_assignments_org_delete ON coaching_plan_assignments;

-- SELECT: org-scoped, assignee or assigner or admin/manager
CREATE POLICY coaching_plan_assignments_org_select
  ON coaching_plan_assignments FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      auth.uid() = assigned_to
      OR auth.uid() = assigned_by
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
      )
    )
  );

-- INSERT: admin/manager within their org
CREATE POLICY coaching_plan_assignments_org_insert
  ON coaching_plan_assignments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- UPDATE: assignee can update own status, assigner or admin/manager can update
CREATE POLICY coaching_plan_assignments_org_update
  ON coaching_plan_assignments FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      auth.uid() = assigned_to
      OR auth.uid() = assigned_by
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
      )
    )
  );

-- DELETE: admin/manager within their org
CREATE POLICY coaching_plan_assignments_org_delete
  ON coaching_plan_assignments FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Record migration
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO schema_migrations (version, name)
VALUES ('118', 'org_scope_definitions')
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'Migration 118: org_scope_definitions applied';
  RAISE NOTICE '  - skillsets: organization_id added, backfilled, org-scoped RLS';
  RAISE NOTICE '  - badge_definitions: organization_id added, backfilled, org-scoped RLS';
  RAISE NOTICE '  - achievements: organization_id added, backfilled, org-scoped RLS';
  RAISE NOTICE '  - kpi_org_config_history: RLS upgraded from USING(true) to org-scoped';
  RAISE NOTICE '  - coaching_plans: RLS upgraded to include org_id check';
  RAISE NOTICE '  - coaching_plan_assignments: RLS upgraded to include org_id check';
END $$;
