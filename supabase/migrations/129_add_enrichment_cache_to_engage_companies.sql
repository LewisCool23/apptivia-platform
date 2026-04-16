-- Add enrichment cache columns to engage_companies
ALTER TABLE engage_companies
  ADD COLUMN IF NOT EXISTS enriched_at        timestamptz,
  ADD COLUMN IF NOT EXISTS raw_enrichment_data jsonb;

-- Index for fast cache lookups by domain
CREATE INDEX IF NOT EXISTS idx_engage_companies_domain_enriched
  ON engage_companies (domain, enriched_at);

COMMENT ON COLUMN engage_companies.enriched_at         IS 'Timestamp of last enrichment run. NULL = never enriched.';
COMMENT ON COLUMN engage_companies.raw_enrichment_data IS 'Merged Apollo + PDL response snapshot at time of enrichment.';
