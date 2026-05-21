-- Migration 179: Multi-ICP Profiles
-- Replaces org-level icp_config + signal_config with per-profile storage.
-- Org-level columns are NOT dropped — they serve as read fallback during transition.

-- 1. Create engage_icp_profiles table
CREATE TABLE IF NOT EXISTS engage_icp_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Profile',
  description TEXT,
  icp_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  signal_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engage_icp_profiles_org
  ON engage_icp_profiles(organization_id);

-- Partial unique: only 1 default profile per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_engage_icp_profiles_default
  ON engage_icp_profiles(organization_id) WHERE is_default = true;

-- RLS
ALTER TABLE engage_icp_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY engage_icp_profiles_select ON engage_icp_profiles
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY engage_icp_profiles_insert ON engage_icp_profiles
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY engage_icp_profiles_update ON engage_icp_profiles
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

CREATE POLICY engage_icp_profiles_delete ON engage_icp_profiles
  FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- 2. Auto-migrate existing org-level configs into default profiles
INSERT INTO engage_icp_profiles (organization_id, name, icp_config, signal_config, is_default, sort_order)
SELECT
  id,
  COALESCE(
    (icp_config->>'target_industries')::text,
    industry,
    'Default'
  ) || ' Profile',
  COALESCE(icp_config, '{}'::jsonb),
  COALESCE(signal_config, '{}'::jsonb),
  true,
  0
FROM organizations
WHERE icp_config IS NOT NULL OR signal_config IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Add icp_profile_id FK to engage_accounts
ALTER TABLE engage_accounts
  ADD COLUMN IF NOT EXISTS icp_profile_id UUID REFERENCES engage_icp_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_engage_accounts_icp_profile
  ON engage_accounts(icp_profile_id) WHERE icp_profile_id IS NOT NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_icp_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_icp_profile_updated_at
  BEFORE UPDATE ON engage_icp_profiles
  FOR EACH ROW EXECUTE FUNCTION update_icp_profile_updated_at();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('179', 'engage_icp_profiles')
ON CONFLICT DO NOTHING;
