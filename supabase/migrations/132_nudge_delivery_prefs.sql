-- Nudge channel preferences per user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nudge_channel text NOT NULL DEFAULT 'in_app'
  CHECK (nudge_channel IN ('in_app', 'email', 'slack', 'email_and_slack'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_webhook_url text; -- personal incoming webhook
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nudge_digest_mode boolean NOT NULL DEFAULT false;
-- digest_mode: true = batch nudges into one weekly email rather than individual sends

-- Org-level Slack webhook for manager/admin nudge broadcasts
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slack_webhook_url text;
