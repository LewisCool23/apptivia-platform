-- Migration 167: Unique index on engage_pipeline_deals for CRM sync upserts
-- Enables ON CONFLICT upsert so re-syncing the same deal updates instead of duplicating.
-- Regular (non-partial) index: PostgreSQL treats NULLs as distinct in unique indexes,
-- so manual deals with external_id = NULL won't conflict with each other.
-- NOTE: Partial indexes (WHERE ...) are NOT supported by PostgREST's onConflict parameter.

CREATE UNIQUE INDEX IF NOT EXISTS uq_pipeline_deals_source_external
  ON engage_pipeline_deals (organization_id, source, external_id);
