-- Migration 178: Call recording, local presence, and voicemail drop
-- Adds recording/transcript/intelligence columns to engage_call_logs
-- Creates twilio_local_numbers pool and voicemail_templates tables

-- 1. Add recording + transcript columns to engage_call_logs
ALTER TABLE engage_call_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_segments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS conversational_intelligence JSONB,
  ADD COLUMN IF NOT EXISTS call_sentiment TEXT;

-- 2. Local presence number pool
CREATE TABLE IF NOT EXISTS twilio_local_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  area_code TEXT NOT NULL,
  twilio_sid TEXT NOT NULL,
  friendly_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_numbers_org_area
  ON twilio_local_numbers(organization_id, area_code) WHERE is_active;

-- RLS for twilio_local_numbers
ALTER TABLE twilio_local_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY twilio_local_numbers_select ON twilio_local_numbers
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY twilio_local_numbers_insert ON twilio_local_numbers
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY twilio_local_numbers_update ON twilio_local_numbers
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY twilio_local_numbers_delete ON twilio_local_numbers
  FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 3. Voicemail templates
CREATE TABLE IF NOT EXISTS voicemail_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  duration_seconds INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for voicemail_templates
ALTER TABLE voicemail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY voicemail_templates_select ON voicemail_templates
  FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY voicemail_templates_insert ON voicemail_templates
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY voicemail_templates_update ON voicemail_templates
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY voicemail_templates_delete ON voicemail_templates
  FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('178', 'call_recording_and_presence')
ON CONFLICT DO NOTHING;
