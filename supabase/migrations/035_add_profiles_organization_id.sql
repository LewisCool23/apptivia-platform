-- Migration 035: Add organization_id column to profiles table
-- The profiles table references organizations but was missing the column.
-- This is required for multi-tenant features: Engage, Organization Settings, etc.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
