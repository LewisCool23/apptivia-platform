-- Migration: Add scheduled_reports table
-- This table stores automated report schedules

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL, -- 'scorecard', 'analytics', 'coach', 'contests', 'team_performance'
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  day_of_week VARCHAR(20), -- 'monday', 'tuesday', etc. (for weekly reports)
  time TIME NOT NULL, -- Time of day to send report
  recipients TEXT[] NOT NULL, -- Array of email addresses
  include_charts BOOLEAN DEFAULT true,
  include_summary BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sent_at TIMESTAMP,
  next_scheduled_at TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_organization ON scheduled_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_scheduled ON scheduled_reports(next_scheduled_at) WHERE active = true;

-- Add RLS policies
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's scheduled reports" ON scheduled_reports
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage scheduled reports" ON scheduled_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      AND organization_id = scheduled_reports.organization_id
    )
  );

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_scheduled_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_reports_updated_at();
