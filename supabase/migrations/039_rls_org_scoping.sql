-- Migration 039: Replace permissive USING(true) RLS policies with org-scoped ones.
--
-- Actual schema (verified):
--   organizations : has id (IS the org)
--   teams         : has organization_id
--   profiles      : has organization_id (added in 035)
--   kpi_metrics   : GLOBAL — no organization_id (shared KPI definitions)
--   kpi_values    : no organization_id — scoped via profile_id → profiles.organization_id

-- ── Helper functions (SECURITY DEFINER bypasses RLS — no circular dependency) ──
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── organizations ─────────────────────────────────────────────────────────────
-- Users should only see and modify their own organization record.

DROP POLICY IF EXISTS "Allow authenticated users to view organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated users to manage organizations" ON organizations;

CREATE POLICY "org_select" ON organizations
  FOR SELECT TO authenticated
  USING (id = auth_user_org_id());

CREATE POLICY "org_admin_update" ON organizations
  FOR UPDATE TO authenticated
  USING (id = auth_user_org_id() AND auth_user_role() = 'admin')
  WITH CHECK (id = auth_user_org_id());

-- ── teams ─────────────────────────────────────────────────────────────────────
-- Teams have organization_id — scope reads to own org, writes to admin/manager.

DROP POLICY IF EXISTS "Allow authenticated users to view teams" ON teams;
DROP POLICY IF EXISTS "Allow authenticated users to insert/update teams" ON teams;

CREATE POLICY "teams_org_select" ON teams
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

CREATE POLICY "teams_admin_manager_manage" ON teams
  FOR ALL TO authenticated
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (organization_id = auth_user_org_id());

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Profiles have organization_id (added in migration 035).
-- All org members can read each other's profiles (needed for scorecard, leaderboards).
-- Only users can update their own; only admins can update others in the same org.

DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON profiles;

CREATE POLICY "profiles_org_select" ON profiles
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id() OR id = auth.uid());

CREATE POLICY "profiles_self_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (organization_id = auth_user_org_id() AND auth_user_role() = 'admin');

-- ── kpi_metrics ───────────────────────────────────────────────────────────────
-- kpi_metrics is a GLOBAL table with no organization_id.
-- All authenticated users may read metric definitions.
-- Writes go through the service role (backend) only — no client write policy needed.

DROP POLICY IF EXISTS "Allow authenticated users to view kpi_metrics" ON kpi_metrics;
DROP POLICY IF EXISTS "Allow authenticated users to manage kpi_metrics" ON kpi_metrics;

CREATE POLICY "kpi_metrics_all_read" ON kpi_metrics
  FOR SELECT TO authenticated
  USING (true);

-- ── kpi_values ────────────────────────────────────────────────────────────────
-- kpi_values has no organization_id — org isolation goes through profile_id.
-- A user's KPI value belongs to their org if their profile does.

DROP POLICY IF EXISTS "Allow authenticated users to view kpi_values" ON kpi_values;
DROP POLICY IF EXISTS "Allow authenticated users to manage kpi_values" ON kpi_values;

-- Org members can read KPI values for everyone in their org
CREATE POLICY "kpi_values_org_select" ON kpi_values
  FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
    )
  );

-- Any org member can insert their own KPI values (activity recording)
CREATE POLICY "kpi_values_self_insert" ON kpi_values
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR profile_id IN (
      SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
    )
  );

-- Managers/admins can update or delete KPI values (corrections)
CREATE POLICY "kpi_values_admin_manager_update" ON kpi_values
  FOR UPDATE TO authenticated
  USING (
    auth_user_role() IN ('admin', 'manager')
    AND profile_id IN (
      SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
    )
  );

CREATE POLICY "kpi_values_admin_manager_delete" ON kpi_values
  FOR DELETE TO authenticated
  USING (
    auth_user_role() IN ('admin', 'manager')
    AND profile_id IN (
      SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
    )
  );
