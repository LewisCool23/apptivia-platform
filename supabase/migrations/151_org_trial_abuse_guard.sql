-- Migration 151: Add created_by_user_id to organizations for trial abuse prevention (F3)
-- Enforces max 1 active trial per auth user at the database level

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

-- Backfill: set created_by_user_id for existing orgs using the earliest admin profile
UPDATE organizations o
SET created_by_user_id = sub.admin_id
FROM (
  SELECT DISTINCT ON (p.organization_id) p.organization_id, p.id AS admin_id
  FROM profiles p
  WHERE p.organization_id IS NOT NULL
    AND p.role IN ('admin')
  ORDER BY p.organization_id, p.created_at ASC
) sub
WHERE o.id = sub.organization_id
  AND o.created_by_user_id IS NULL;

-- Partial unique index: only 1 active trial per user (trialing or active orgs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_one_active_trial_per_user
  ON organizations (created_by_user_id)
  WHERE subscription_status IN ('trialing', 'active')
    AND created_by_user_id IS NOT NULL;
