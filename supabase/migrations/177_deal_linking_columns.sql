-- Migration 177: Deal linking columns + junction tables
-- Supports account/contact/meeting linking on deals

-- ── Add columns to engage_pipeline_deals ────────────────────────────
ALTER TABLE engage_pipeline_deals
  ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES engage_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_company_id UUID REFERENCES engage_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS win_loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_steps TEXT,
  ADD COLUMN IF NOT EXISTS competitor TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_linked_account
  ON engage_pipeline_deals(linked_account_id) WHERE linked_account_id IS NOT NULL;

-- ── Deal ↔ Contacts junction ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engage_deal_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES engage_pipeline_deals(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES engage_prospects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('decision_maker','champion','influencer','end_user','other')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),
  UNIQUE(deal_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON engage_deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_prospect ON engage_deal_contacts(prospect_id);

ALTER TABLE engage_deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_contacts_read ON engage_deal_contacts FOR SELECT USING (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);
CREATE POLICY deal_contacts_insert ON engage_deal_contacts FOR INSERT WITH CHECK (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);
CREATE POLICY deal_contacts_delete ON engage_deal_contacts FOR DELETE USING (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);

-- ── Deal ↔ Meetings junction ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engage_deal_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES engage_pipeline_deals(id) ON DELETE CASCADE,
  calendar_event_id UUID NOT NULL REFERENCES integration_calendar_events(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by UUID REFERENCES profiles(id),
  UNIQUE(deal_id, calendar_event_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_meetings_deal ON engage_deal_meetings(deal_id);

ALTER TABLE engage_deal_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_meetings_read ON engage_deal_meetings FOR SELECT USING (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);
CREATE POLICY deal_meetings_insert ON engage_deal_meetings FOR INSERT WITH CHECK (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);
CREATE POLICY deal_meetings_delete ON engage_deal_meetings FOR DELETE USING (
  deal_id IN (SELECT id FROM engage_pipeline_deals WHERE organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ))
);
