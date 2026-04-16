CREATE TABLE IF NOT EXISTS engage_enrichment_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  domain           text,                          -- company domain (null for person enrichments)
  prospect_email   text,                          -- person email (null for company enrichments)
  enrichment_type  text        NOT NULL,          -- 'company' | 'person' | 'phone_batch'
  provider         text        NOT NULL,          -- 'apollo' | 'pdl' | 'hunter' | 'tavily'
  hit              boolean     NOT NULL,          -- true = provider returned data, false = miss/error
  fields_filled    text[],                        -- array of field names this provider populated
  error_message    text,                          -- null if hit = true
  from_cache       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes for cost analytics queries
CREATE INDEX IF NOT EXISTS idx_enrichment_log_org_created
  ON engage_enrichment_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_provider
  ON engage_enrichment_log (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_domain
  ON engage_enrichment_log (domain, created_at DESC);

COMMENT ON TABLE engage_enrichment_log IS
  'Per-call log of every external enrichment API call. Used for cost tracking, ROI analysis, and provider budget enforcement.';
