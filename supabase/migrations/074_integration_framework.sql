-- Migration 074: Integration Framework
-- Enhances integration infrastructure for OAuth, calendar sync, and multi-provider support

-- ── Enhance integrations table with OAuth + sync columns ────────────────────

ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS oauth_state TEXT,
  ADD COLUMN IF NOT EXISTS oauth_state_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scopes TEXT[],
  ADD COLUMN IF NOT EXISTS instance_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- ── Calendar events table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  external_event_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  attendees JSONB DEFAULT '[]',
  is_all_day BOOLEAN DEFAULT false,
  organizer_email TEXT,
  event_type TEXT DEFAULT 'meeting',  -- 'meeting', 'call', '1on1', 'demo', 'other'
  external_link TEXT,
  raw_data JSONB DEFAULT '{}',
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_cal_events_org_time
  ON integration_calendar_events(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_cal_events_profile_time
  ON integration_calendar_events(profile_id, start_time);

-- ── Sync cursor tracking (incremental sync per entity type) ─────────────────

CREATE TABLE IF NOT EXISTS integration_sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- 'contacts', 'deals', 'activities', 'meetings', 'emails', 'leads'
  last_sync_cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  records_synced INT DEFAULT 0,
  UNIQUE(integration_id, entity_type)
);

-- ── Populate oauth_config for existing providers ────────────────────────────

UPDATE integration_mapping_templates
SET oauth_config = '{
  "authorization_url": "https://login.salesforce.com/services/oauth2/authorize",
  "token_url": "https://login.salesforce.com/services/oauth2/token",
  "scopes": ["api", "refresh_token", "offline_access"],
  "response_type": "code"
}'::jsonb
WHERE integration_type = 'salesforce';

UPDATE integration_mapping_templates
SET oauth_config = '{
  "authorization_url": "https://app.hubspot.com/oauth/authorize",
  "token_url": "https://api.hubapi.com/oauth/v1/token",
  "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write", "crm.objects.deals.read", "crm.objects.deals.write", "crm.objects.companies.read", "timeline"],
  "response_type": "code"
}'::jsonb
WHERE integration_type = 'hubspot';

-- ── Add new provider templates ──────────────────────────────────────────────

INSERT INTO integration_mapping_templates
  (integration_type, display_name, icon, description, default_field_mappings, required_fields, oauth_config, documentation_url, is_active)
VALUES
  ('outreach', 'Outreach.io', 'outreach', 'Sync Outreach sequences, calls, and meeting activity',
   '{"call_connects":{"object":"activities","filter":"type=call","aggregation":"count"},"meetings":{"object":"meetings","aggregation":"count"},"sequence_replies":{"object":"emails","filter":"replied=true","aggregation":"count"}}'::jsonb,
   ARRAY['call_connects','meetings','sequence_replies'],
   '{"authorization_url":"https://api.outreach.io/oauth/authorize","token_url":"https://api.outreach.io/oauth/token","scopes":["prospects.read","prospects.write","activities.read","meetings.read","opportunities.read"],"response_type":"code"}'::jsonb,
   'https://api.outreach.io/api/v2/docs',
   true),

  ('salesloft', 'SalesLoft', 'salesloft', 'Sync SalesLoft cadence and call activity',
   '{"call_connects":{"object":"activities","filter":"type=call","aggregation":"count"},"meetings":{"object":"meetings","aggregation":"count"}}'::jsonb,
   ARRAY['call_connects','meetings'],
   '{"authorization_url":"https://accounts.salesloft.com/oauth/authorize","token_url":"https://accounts.salesloft.com/oauth/token","scopes":["read","write"],"response_type":"code"}'::jsonb,
   'https://developers.salesloft.com/docs/api',
   true),

  ('marketo', 'Marketo', 'marketo', 'Sync Marketo lead and engagement data',
   '{"leads_created":{"object":"leads","aggregation":"count","dateField":"createdAt"}}'::jsonb,
   ARRAY['leads_created'],
   '{"token_url":"https://{munchkin_id}.mktorest.com/identity/oauth/token","grant_type":"client_credentials"}'::jsonb,
   'https://developers.marketo.com/rest-api/',
   true),

  ('microsoft_calendar', 'Microsoft Outlook', 'microsoft', 'Sync Outlook calendar events and create meetings',
   '{}'::jsonb,
   ARRAY[]::text[],
   '{"authorization_url":"https://login.microsoftonline.com/common/oauth2/v2.0/authorize","token_url":"https://login.microsoftonline.com/common/oauth2/v2.0/token","scopes":["Calendars.ReadWrite","User.Read","offline_access"],"response_type":"code"}'::jsonb,
   'https://learn.microsoft.com/en-us/graph/api/resources/calendar',
   true),

  ('google_calendar', 'Google Calendar', 'google', 'Sync Google Calendar events and create meetings',
   '{}'::jsonb,
   ARRAY[]::text[],
   '{"authorization_url":"https://accounts.google.com/o/oauth2/v2/auth","token_url":"https://oauth2.googleapis.com/token","scopes":["https://www.googleapis.com/auth/calendar","https://www.googleapis.com/auth/calendar.events"],"response_type":"code","access_type":"offline","prompt":"consent"}'::jsonb,
   'https://developers.google.com/calendar/api/v3/reference',
   true)
ON CONFLICT (integration_type) DO UPDATE
  SET oauth_config = EXCLUDED.oauth_config,
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      is_active = true;
