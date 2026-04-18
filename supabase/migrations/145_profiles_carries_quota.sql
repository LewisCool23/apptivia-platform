-- Migration 145: Add carries_quota flag to profiles for player-coach support
BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS carries_quota BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS profiles_carries_quota_idx
  ON profiles (organization_id, carries_quota)
  WHERE carries_quota = TRUE;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('145', 'profiles_carries_quota', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
