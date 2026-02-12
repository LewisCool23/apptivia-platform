-- Migration: Integration System for Multi-Tenant Data Sync
-- Enables companies to connect their CRM/data sources to the platform

-- Drop existing tables to ensure clean migration
DROP TABLE IF EXISTS integration_sync_history CASCADE;
DROP TABLE IF EXISTS user_import_jobs CASCADE;
DROP TABLE IF EXISTS integrations CASCADE;
DROP TABLE IF EXISTS integration_mapping_templates CASCADE;

-- Integration Configurations Table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'salesforce', 'hubspot', 'pipedrive', 'csv_upload', etc.
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'disconnected', -- 'disconnected', 'connected', 'error', 'syncing'
  credentials JSONB, -- Encrypted connection details (tokens, API keys, etc.)
  field_mappings JSONB, -- Maps CRM fields to our KPI metrics
  sync_config JSONB, -- Frequency, filters, date ranges
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type);

-- Sync History Table (audit log of all data syncs)
CREATE TABLE integration_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- 'running', 'success', 'failed', 'partial'
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  sync_metadata JSONB -- Additional details about the sync
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_sync_history_integration ON integration_sync_history(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_org ON integration_sync_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_started ON integration_sync_history(sync_started_at);

-- Field Mapping Templates (predefined mappings for common CRMs)
CREATE TABLE integration_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL UNIQUE, -- 'salesforce', 'hubspot', etc.
  display_name TEXT NOT NULL,
  icon TEXT, -- Icon/logo for the integration
  description TEXT,
  default_field_mappings JSONB NOT NULL, -- Default field mapping configuration
  required_fields TEXT[], -- Fields that must be mapped
  oauth_config JSONB, -- OAuth configuration if applicable
  documentation_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default integration templates
INSERT INTO integration_mapping_templates (integration_type, display_name, icon, description, default_field_mappings, required_fields, documentation_url)
VALUES
  (
    'salesforce',
    'Salesforce',
    '☁️',
    'Connect your Salesforce CRM to automatically sync calls, meetings, and opportunities',
    '{
      "call_connects": {
        "object": "Task",
        "filter": "Type = ''Call'' AND Status = ''Completed''",
        "aggregation": "count",
        "dateField": "ActivityDate"
      },
      "talk_time_minutes": {
        "object": "Task",
        "filter": "Type = ''Call'' AND Status = ''Completed''",
        "field": "CallDurationInSeconds",
        "aggregation": "sum",
        "transform": "seconds_to_minutes"
      },
      "meetings": {
        "object": "Event",
        "filter": "Type = ''Meeting'' AND IsTask = false",
        "aggregation": "count",
        "dateField": "ActivityDate"
      },
      "sourced_opps": {
        "object": "Opportunity",
        "filter": "StageName = ''Prospecting''",
        "aggregation": "count",
        "dateField": "CreatedDate"
      },
      "stage2_opps": {
        "object": "Opportunity",
        "filter": "StageName IN (''Qualification'', ''Needs Analysis'')",
        "aggregation": "count",
        "dateField": "CreatedDate"
      }
    }'::jsonb,
    ARRAY['call_connects', 'meetings', 'sourced_opps'],
    'https://developer.salesforce.com/docs/apis'
  ),
  (
    'hubspot',
    'HubSpot',
    '🟠',
    'Sync your HubSpot CRM data including calls, meetings, and deals',
    '{
      "call_connects": {
        "object": "calls",
        "filter": "hs_call_status = ''COMPLETED''",
        "aggregation": "count",
        "dateField": "hs_timestamp"
      },
      "talk_time_minutes": {
        "object": "calls",
        "field": "hs_call_duration",
        "aggregation": "sum",
        "transform": "milliseconds_to_minutes"
      },
      "meetings": {
        "object": "meetings",
        "aggregation": "count",
        "dateField": "hs_timestamp"
      },
      "sourced_opps": {
        "object": "deals",
        "filter": "dealstage = ''appointmentscheduled''",
        "aggregation": "count",
        "dateField": "createdate"
      },
      "stage2_opps": {
        "object": "deals",
        "filter": "dealstage IN (''qualifiedtobuy'', ''presentationscheduled'')",
        "aggregation": "count",
        "dateField": "createdate"
      }
    }'::jsonb,
    ARRAY['call_connects', 'meetings'],
    'https://developers.hubspot.com/docs/api/overview'
  ),
  (
    'csv_upload',
    'CSV Upload',
    '📁',
    'Manually upload CSV files with your sales data',
    '{
      "file_format": "csv",
      "required_columns": ["date", "rep_email", "metric_name", "value"],
      "date_format": "YYYY-MM-DD",
      "mapping_instructions": "Map columns from your CSV to our KPI metrics"
    }'::jsonb,
    ARRAY['date', 'rep_email'],
    NULL
  )
ON CONFLICT (integration_type) DO NOTHING;

-- User Import Jobs (for bulk importing users)
CREATE TABLE user_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL, -- 'csv', 'google_workspace', 'azure_ad', 'manual'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  file_url TEXT, -- For CSV imports
  total_records INT DEFAULT 0,
  processed_records INT DEFAULT 0,
  created_records INT DEFAULT 0,
  updated_records INT DEFAULT 0,
  failed_records INT DEFAULT 0,
  error_log JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_user_import_org ON user_import_jobs(organization_id);

-- Update organizations table to track onboarding status
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT;

-- Function to update integration updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for integrations
DROP TRIGGER IF EXISTS trigger_update_integration_timestamp ON integrations;
CREATE TRIGGER trigger_update_integration_timestamp
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_timestamp();

-- Comments for documentation
COMMENT ON TABLE integrations IS 'Stores integration configurations for each organization';
COMMENT ON TABLE integration_sync_history IS 'Audit log of all data synchronization runs';
COMMENT ON TABLE integration_mapping_templates IS 'Predefined field mapping templates for popular CRM systems';
COMMENT ON TABLE user_import_jobs IS 'Tracks bulk user import operations';
COMMENT ON COLUMN integrations.field_mappings IS 'JSON mapping of CRM fields to our KPI metrics';
COMMENT ON COLUMN integrations.credentials IS 'Encrypted OAuth tokens and API credentials';
COMMENT ON COLUMN integrations.sync_config IS 'Sync frequency, filters, and configuration';
