-- Migration 148: Add 'upgrade_nudge' to notification_type enum
-- Required by checkUpgradeTriggers() cron which inserts notifications with type 'upgrade_nudge'.
-- Without this value, all upgrade trigger notifications fail with 22P02 (invalid enum value).
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- Do NOT wrap in BEGIN/COMMIT.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'upgrade_nudge';

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('148', 'add_upgrade_nudge_notification_type', NOW())
ON CONFLICT (version) DO NOTHING;
