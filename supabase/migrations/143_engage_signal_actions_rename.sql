-- Migration 143: Standardize engage_signal_actions.org_id → organization_id
BEGIN;

ALTER TABLE engage_signal_actions RENAME COLUMN org_id TO organization_id;

DROP POLICY IF EXISTS engage_signal_actions_org_read ON engage_signal_actions;
DROP POLICY IF EXISTS engage_signal_actions_org_write ON engage_signal_actions;
DROP POLICY IF EXISTS engage_signal_actions_service_role ON engage_signal_actions;

CREATE POLICY engage_signal_actions_org_read ON engage_signal_actions
  FOR SELECT USING (organization_id = auth_user_org_id());

CREATE POLICY engage_signal_actions_org_write ON engage_signal_actions
  FOR ALL USING (organization_id = auth_user_org_id());

CREATE POLICY engage_signal_actions_service_role ON engage_signal_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER INDEX IF EXISTS engage_signal_actions_org_id_idx
  RENAME TO engage_signal_actions_organization_id_idx;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('143', 'engage_signal_actions_rename', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
