-- Migration 057: Add missing columns to engage_research_reports
-- Aligns table schema with what engageApi.ts saveReport() sends.

ALTER TABLE engage_research_reports
  ADD COLUMN IF NOT EXISTS title        TEXT,
  ADD COLUMN IF NOT EXISTS company_id   UUID,
  ADD COLUMN IF NOT EXISTS data_sources TEXT[],
  ADD COLUMN IF NOT EXISTS created_by   UUID;
