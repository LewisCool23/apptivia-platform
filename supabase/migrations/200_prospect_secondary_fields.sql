-- Migration 200: Add secondary email/phone fields to engage_prospects
-- Enables storing alternate contact info in the Contact Detail Panel

ALTER TABLE engage_prospects
  ADD COLUMN IF NOT EXISTS secondary_email TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('200', 'prospect_secondary_fields')
ON CONFLICT DO NOTHING;
