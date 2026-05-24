-- Migration 185: Consolidate account_id into linked_account_id on engage_pipeline_deals
-- account_id was the legacy column (migration 051, signal→pipeline workflow)
-- linked_account_id is the current/preferred column (migration 177, Active Deal Modal)
-- This migration backfills any orphaned account_id values, then drops the legacy column.

-- Step 1: Backfill — copy account_id into linked_account_id where linked_account_id is NULL
UPDATE engage_pipeline_deals
SET linked_account_id = account_id
WHERE account_id IS NOT NULL
  AND linked_account_id IS NULL;

-- Step 2: Drop the legacy column
ALTER TABLE engage_pipeline_deals DROP COLUMN IF EXISTS account_id;
