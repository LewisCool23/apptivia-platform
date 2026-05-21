-- Migration 180: Account Page Overhaul
-- Adds website_url/linkedin_url to engage_accounts, linked_deal_id to calendar events,
-- and creates engage_account_contacts junction table.

-- ═══════════════════════════════════════════════════════════════
-- 1. Add website_url and linkedin_url to engage_accounts
-- ══════════════════════��══════════════════════════════��═════════

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Backfill website_url from domain where populated
UPDATE engage_accounts SET website_url = 'https://' || domain WHERE domain IS NOT NULL AND website_url IS NULL;

-- ═══════════��═══════════════���═══════════════════════════════════
-- 2. Add linked_deal_id to integration_calendar_events
-- ══��══════���══════════════════════════════���══════════════════════

ALTER TABLE integration_calendar_events ADD COLUMN IF NOT EXISTS linked_deal_id UUID REFERENCES engage_pipeline_deals(id) ON DELETE SET NULL;

-- ════════��══════════════════════════════════════════════════════
-- 3. Create engage_account_contacts junction table
-- ═══════════���═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS engage_account_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES engage_accounts(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES engage_prospects(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Contact data (for contacts without prospect record)
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  linkedin_url TEXT,
  -- Relationship metadata
  is_buying_committee BOOLEAN NOT NULL DEFAULT false,
  committee_role TEXT,       -- 'decision_maker', 'champion', 'influencer', 'blocker', 'end_user'
  influence_level TEXT DEFAULT 'medium',  -- 'high', 'medium', 'low'
  is_suggested BOOLEAN NOT NULL DEFAULT false,
  source TEXT DEFAULT 'manual',  -- 'manual', 'signal', 'import', 'discover'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_contacts_account ON engage_account_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_account_contacts_org ON engage_account_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_contacts_prospect ON engage_account_contacts(prospect_id) WHERE prospect_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_contacts_unique_email ON engage_account_contacts(account_id, email) WHERE email IS NOT NULL;

-- RLS
ALTER TABLE engage_account_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view account contacts"
  ON engage_account_contacts FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can manage account contacts"
  ON engage_account_contacts FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Updated_at trigger
CREATE TRIGGER set_updated_at_account_contacts
  BEFORE UPDATE ON engage_account_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
