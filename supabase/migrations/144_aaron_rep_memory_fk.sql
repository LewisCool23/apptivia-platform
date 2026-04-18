-- Migration 144: Enforce FK from aaron_rep_memory.user_id to profiles.id
-- Phase 0 confirmed zero orphans — the DELETE is a defensive no-op.
BEGIN;

DELETE FROM aaron_rep_memory
WHERE user_id NOT IN (SELECT id FROM profiles);

ALTER TABLE aaron_rep_memory
  ADD CONSTRAINT aaron_rep_memory_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('144', 'aaron_rep_memory_fk', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
