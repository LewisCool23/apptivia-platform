-- Migration 052: ICP Prospector
-- Documents the new 'icp_prospector' source value for engage_accounts
-- and adds an index to support filtering accounts by origin.

COMMENT ON COLUMN engage_accounts.source IS
  'Origin of this account record: manual | signal_prospecting | import | company_research | icp_prospector';

CREATE INDEX IF NOT EXISTS idx_engage_accounts_source
  ON engage_accounts(organization_id, source)
  WHERE source IS NOT NULL;
