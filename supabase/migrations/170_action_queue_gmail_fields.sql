-- Add Gmail send tracking columns to engage_signal_actions
ALTER TABLE engage_signal_actions
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

COMMENT ON COLUMN engage_signal_actions.recipient_email IS
  'Email address the outreach was sent to (resolved from prospect or manually entered).';
COMMENT ON COLUMN engage_signal_actions.gmail_message_id IS
  'Gmail API message ID returned after sending via the user personal Google integration.';
