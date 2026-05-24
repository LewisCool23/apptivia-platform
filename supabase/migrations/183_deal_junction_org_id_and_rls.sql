-- Migration 183: Add organization_id to deal junction tables + missing RLS policies
-- Fixes P1-21 (org FK on junction tables) and P2-49-51 (missing RLS policies)

-- ══════════════════════════════════════════════════════════════════════
-- 1. Add organization_id to engage_deal_contacts
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE engage_deal_contacts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill from parent deal
UPDATE engage_deal_contacts dc
  SET organization_id = d.organization_id
  FROM engage_pipeline_deals d
  WHERE dc.deal_id = d.id AND dc.organization_id IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE engage_deal_contacts
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_contacts_org ON engage_deal_contacts(organization_id);

-- Add UPDATE policy (was missing)
CREATE POLICY deal_contacts_update ON engage_deal_contacts FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- ══════════════════════════════════════════════════════════════════════
-- 2. Add organization_id to engage_deal_meetings
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE engage_deal_meetings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE engage_deal_meetings dm
  SET organization_id = d.organization_id
  FROM engage_pipeline_deals d
  WHERE dm.deal_id = d.id AND dm.organization_id IS NULL;

ALTER TABLE engage_deal_meetings
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_meetings_org ON engage_deal_meetings(organization_id);

-- Add UPDATE policy (was missing)
CREATE POLICY deal_meetings_update ON engage_deal_meetings FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- ══════════════════════════════════════════════════════════════════════
-- 3. Add organization_id to engage_sequence_steps
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE engage_sequence_steps
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE engage_sequence_steps ss
  SET organization_id = s.organization_id
  FROM engage_sequences s
  WHERE ss.sequence_id = s.id AND ss.organization_id IS NULL;

-- Some steps may have no parent sequence — allow NULL temporarily for those
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM engage_sequence_steps WHERE organization_id IS NULL) THEN
    ALTER TABLE engage_sequence_steps ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sequence_steps_org ON engage_sequence_steps(organization_id);

-- ══════════════════════════════════════════════════════════════════════
-- 4. Add organization_id to engage_sequence_enrollments
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE engage_sequence_enrollments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE engage_sequence_enrollments se
  SET organization_id = s.organization_id
  FROM engage_sequences s
  WHERE se.sequence_id = s.id AND se.organization_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM engage_sequence_enrollments WHERE organization_id IS NULL) THEN
    ALTER TABLE engage_sequence_enrollments ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_org ON engage_sequence_enrollments(organization_id);

-- ══════════════════════════════════════════════════════════════════════
-- 5. Missing RLS policies for engage_deal_activities
-- ══════════════════════════════════════════════════════════════════════
CREATE POLICY deal_activities_org_update ON engage_deal_activities FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY deal_activities_org_delete ON engage_deal_activities FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
