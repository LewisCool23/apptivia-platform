-- Migration 155: Add trial_expiry_notified_at to organizations (F18)
-- Used by checkTrialExpiryNotifications cron to avoid repeat expiry emails.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_expiry_notified_at timestamptz;
