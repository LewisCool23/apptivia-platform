-- Migration 051: Signal-to-Pipeline workflow
-- 1. Link pipeline deals to accounts (account_id FK)
-- 2. Track source + promotion timestamp on accounts

-- ── engage_pipeline_deals: add account_id ──────────────────
ALTER TABLE engage_pipeline_deals
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES engage_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_account
  ON engage_pipeline_deals(account_id)
  WHERE account_id IS NOT NULL;

-- ── engage_accounts: add source + promotion timestamp ──────
ALTER TABLE engage_accounts
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
  -- values: 'manual' | 'signal_prospecting' | 'import' | 'company_research'

ALTER TABLE engage_accounts
  ADD COLUMN IF NOT EXISTS promoted_from_signal_at TIMESTAMPTZ;

COMMENT ON COLUMN engage_accounts.source IS
  'Origin of this account record: manual, signal_prospecting, import, company_research';

COMMENT ON COLUMN engage_accounts.promoted_from_signal_at IS
  'Timestamp when this account was promoted from Signal Prospecting';

COMMENT ON COLUMN engage_pipeline_deals.account_id IS
  'Optional link to the engage_accounts record this deal belongs to';
