-- ========================================================================
-- Migration 195: CRM Activity Records — unified call/email log from all sources
-- Stores individual activity records during CRM sync (previously discarded
-- after KPI aggregation). Also populated by in-app calls (Twilio) and
-- Engage emails for a single unified Records Tab view.
-- ========================================================================

CREATE TABLE IF NOT EXISTS crm_activity_records (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  integration_id    UUID REFERENCES integrations(id) ON DELETE SET NULL,

  -- Activity classification
  activity_type     TEXT NOT NULL CHECK (activity_type IN ('call', 'email')),
  activity_date     TIMESTAMPTZ NOT NULL,

  -- Deduplication — source + external_id unique per org
  source            TEXT NOT NULL,   -- salesforce, hubspot, apollo, gong, outreach, salesloft, apptivia
  external_id       TEXT NOT NULL,   -- provider-specific record ID

  -- Common fields
  subject           TEXT,
  contact_name      TEXT,
  contact_email     TEXT,
  direction         TEXT CHECK (direction IN ('inbound', 'outbound')),
  duration_seconds  INTEGER,
  status            TEXT,            -- completed, sent, no_answer, voicemail, etc.
  notes             TEXT,

  -- Recording (calls only)
  recording_url     TEXT,
  recording_source  TEXT,            -- gong, hubspot, twilio, outreach, etc.

  -- CRM link
  crm_url           TEXT,

  -- Catch-all for provider-specific extras
  metadata          JSONB DEFAULT '{}',

  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for dedup on re-sync
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_activity_org_source_ext
  ON crm_activity_records(organization_id, source, external_id);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_crm_activity_org_type_date
  ON crm_activity_records(organization_id, activity_type, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_profile_date
  ON crm_activity_records(organization_id, profile_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activity_source
  ON crm_activity_records(organization_id, source);

-- RLS
ALTER TABLE crm_activity_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org activity records" ON crm_activity_records
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage activity records" ON crm_activity_records
  FOR ALL USING (auth.role() = 'service_role');

-- Backfill existing in-app call logs into crm_activity_records
INSERT INTO crm_activity_records (
  organization_id, profile_id, activity_type, activity_date,
  source, external_id, contact_name, direction,
  duration_seconds, notes, recording_url, recording_source,
  metadata
)
SELECT
  organization_id,
  user_id,
  'call',
  call_date,
  'apptivia',
  COALESCE(twilio_call_sid, id::text),
  contact_name,
  call_direction,
  CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes * 60 ELSE NULL END,
  notes,
  recording_url,
  CASE WHEN recording_url IS NOT NULL THEN 'twilio' ELSE NULL END,
  COALESCE(ai_analysis, '{}'::jsonb)
FROM engage_call_logs
ON CONFLICT (organization_id, source, external_id) DO NOTHING;

-- Backfill sent Engage outreach drafts as email records
INSERT INTO crm_activity_records (
  organization_id, profile_id, activity_type, activity_date,
  source, external_id, subject, contact_email, direction,
  status, notes, metadata
)
SELECT
  d.organization_id,
  d.created_by,
  'email',
  d.created_at,
  'apptivia',
  d.id::text,
  d.subject,
  p.email,
  'outbound',
  'sent',
  LEFT(d.body, 500),
  jsonb_build_object('channel', d.channel, 'prospect_id', d.prospect_id)
FROM engage_outreach_drafts d
LEFT JOIN engage_prospects p ON p.id = d.prospect_id
WHERE d.status = 'sent'
ON CONFLICT (organization_id, source, external_id) DO NOTHING;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('195', 'crm_activity_records')
ON CONFLICT DO NOTHING;
