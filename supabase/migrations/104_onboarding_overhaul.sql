-- Migration 104: Onboarding Overhaul
-- Adds departments table, links teams to departments, adds onboarding_readiness
-- Safe to re-run: drops existing objects before recreating

-- Clean up any partial prior run
DROP POLICY IF EXISTS departments_select ON departments;
DROP POLICY IF EXISTS departments_manage ON departments;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. Departments table (normalized hierarchy)
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Uses auth_user_org_id() and auth_user_role() from migration 039
CREATE POLICY departments_select ON departments
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

CREATE POLICY departments_manage ON departments
  FOR ALL TO authenticated
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- 2. Link teams to departments
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- 3. Onboarding readiness snapshot on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_readiness JSONB DEFAULT '{}';

-- 4. Backfill: create department rows from existing teams.department enum column
INSERT INTO departments (organization_id, name, sort_order)
SELECT DISTINCT t.organization_id, t.department::TEXT, 0
FROM teams t
WHERE t.department IS NOT NULL
  AND t.organization_id IS NOT NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- Link existing teams to new department rows
UPDATE teams t
SET department_id = d.id
FROM departments d
WHERE t.organization_id = d.organization_id
  AND t.department::TEXT = d.name
  AND t.department_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);

COMMENT ON TABLE departments IS 'Organizational departments — parent grouping for teams';
COMMENT ON COLUMN teams.department_id IS 'FK to departments table (normalized). teams.department text column kept for backwards compat.';
