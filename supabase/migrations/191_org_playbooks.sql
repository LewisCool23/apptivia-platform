-- Migration 191: Custom org playbooks table

CREATE TABLE IF NOT EXISTS org_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- prospecting, discovery, qualification, methodology, negotiation, coaching, analytics
  framework TEXT, -- optional framework name tag
  tagline TEXT,
  icon TEXT DEFAULT 'book',
  sections JSONB NOT NULL DEFAULT '[]', -- [{title, items: [string]}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read org playbooks" ON org_playbooks
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Service role full access on org_playbooks" ON org_playbooks
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_org_playbooks_org ON org_playbooks(organization_id) WHERE is_active = true;
