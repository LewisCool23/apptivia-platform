-- Migration 076: Per-User Integration Support
-- Allows individual users to connect personal integrations (calendar, Salesforce, etc.)
-- while preserving org-level integrations for admin-managed connections.

-- ── Add profile_id column to integrations table ──────────────────────────────

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integrations_profile
  ON integrations(profile_id) WHERE profile_id IS NOT NULL;

-- Unique constraint: one integration per type per user (user-level) or per org (org-level)
-- Uses COALESCE to treat NULL profile_id as a sentinel for org-level integrations
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_org_type_user
  ON integrations(organization_id, integration_type, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'));

COMMENT ON COLUMN integrations.profile_id IS 'NULL = org-level integration; non-NULL = personal integration owned by this user';
