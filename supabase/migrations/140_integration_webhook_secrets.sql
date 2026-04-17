-- Migration 140: Per-integration webhook secrets
-- Enables correct org attribution for incoming webhooks by matching the
-- signature against each integration's stored secret, rather than a single
-- global env var secret that can't disambiguate which org a webhook is for.
--
-- Stored encrypted at rest using the same AES-256-GCM mechanism as credentials.
-- During the Planera pilot transition window, the webhook handler falls back
-- to the global env-var secret (e.g. OUTREACH_WEBHOOK_SECRET) if no
-- per-integration secret is set.

BEGIN;

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS webhook_secret_encrypted JSONB DEFAULT NULL;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('140', 'integration_webhook_secrets', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
