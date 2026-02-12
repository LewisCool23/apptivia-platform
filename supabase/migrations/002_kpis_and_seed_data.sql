-- Migration: Create simplified KPI tables and seed with sample data
-- This creates a lightweight KPI system for the scorecard

-- Drop existing kpi_metrics table if it exists and recreate
DROP TABLE IF EXISTS kpi_metrics CASCADE;

-- Create simplified KPI metrics table
CREATE TABLE kpi_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  goal numeric NOT NULL DEFAULT 100,
  weight numeric NOT NULL DEFAULT 1.0,
  unit text DEFAULT 'count',
  created_at timestamptz DEFAULT now()
);

-- Drop and recreate KPI values table
DROP TABLE IF EXISTS kpi_values CASCADE;

-- Create KPI values table (actual performance data)
CREATE TABLE kpi_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES kpi_metrics(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id),
  value numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpi_values_kpi_id ON kpi_values(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_profile_id ON kpi_values(profile_id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_team_id ON kpi_values(team_id);
CREATE INDEX IF NOT EXISTS idx_kpi_values_period ON kpi_values(period_start, period_end);

-- Insert KPI metric definitions
INSERT INTO kpi_metrics (key, name, description, goal, weight, unit)
VALUES
  ('call_connects', 'Call Connects', 'Number of successful call connections', 100, 0.30, 'count'),
  ('talk_time_minutes', 'Talk Time Minutes', 'Total talk time in minutes', 100, 0.30, 'minutes'),
  ('meetings', 'Meetings', 'Number of scheduled meetings', 3, 0.10, 'count'),
  ('sourced_opps', 'Sourced Opportunities', 'Number of opportunities sourced', 4, 0.10, 'count'),
  ('stage2_opps', 'Stage 2 Opportunities', 'Opportunities advanced to Stage 2', 3, 0.20, 'count')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  goal = EXCLUDED.goal,
  weight = EXCLUDED.weight;

-- Seed sample organizations and teams (if they don't exist)
INSERT INTO organizations (id, name, industry, subscription_plan)
VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Demo Company', 'Technology', 'Pro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, organization_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Sales Team Alpha', 'Primary sales team'),
  ('00000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Sales Team Beta', 'Secondary sales team')
ON CONFLICT (id) DO NOTHING;

-- Update teams to have department field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='teams' AND column_name='department') THEN
    ALTER TABLE teams ADD COLUMN department text;
  END IF;
END $$;

UPDATE teams SET department = 'Sales' WHERE department IS NULL;

-- Seed sample profiles (sales reps)
INSERT INTO profiles (id, email, first_name, last_name, team_id, department, title)
VALUES
  ('00000000-0000-0000-0000-000000000100'::uuid, 'sarah.johnson@demo.com', 'Sarah', 'Johnson', '00000000-0000-0000-0000-000000000010'::uuid, 'Sales', 'Senior Sales Rep'),
  ('00000000-0000-0000-0000-000000000101'::uuid, 'mike.chen@demo.com', 'Mike', 'Chen', '00000000-0000-0000-0000-000000000010'::uuid, 'Sales', 'Sales Rep'),
  ('00000000-0000-0000-0000-000000000102'::uuid, 'jordan.smith@demo.com', 'Jordan', 'Smith', '00000000-0000-0000-0000-000000000011'::uuid, 'Sales', 'Sales Rep'),
  ('00000000-0000-0000-0000-000000000103'::uuid, 'alex.rivera@demo.com', 'Alex', 'Rivera', '00000000-0000-0000-0000-000000000011'::uuid, 'Sales', 'Junior Sales Rep')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  team_id = EXCLUDED.team_id,
  department = EXCLUDED.department;

-- Seed KPI values for this week (Jan 12-18, 2026)
-- Realistic weekly performance: ~100 calls, ~150 min talk time (2:3 ratio), ~10 meetings, ~7 sourced opps, ~12 stage 2 opps
-- Apptivia Scores will range from 50% to 150% based on these values

-- Sarah Johnson - Top Performer (150% score)
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT 
  m.id,
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000010'::uuid,
  CASE m.key
    WHEN 'call_connects' THEN 150
    WHEN 'talk_time_minutes' THEN 225
    WHEN 'meetings' THEN 15
    WHEN 'sourced_opps' THEN 10
    WHEN 'stage2_opps' THEN 18
  END,
  '2026-01-12'::date,
  '2026-01-18'::date
FROM kpi_metrics m
ON CONFLICT DO NOTHING;

-- Mike Chen - Strong Performer (120% score)
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT 
  m.id,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000010'::uuid,
  CASE m.key
    WHEN 'call_connects' THEN 120
    WHEN 'talk_time_minutes' THEN 180
    WHEN 'meetings' THEN 12
    WHEN 'sourced_opps' THEN 8
    WHEN 'stage2_opps' THEN 14
  END,
  '2026-01-12'::date,
  '2026-01-18'::date
FROM kpi_metrics m
ON CONFLICT DO NOTHING;

-- Jordan Smith - Average Performer (100% score)
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT 
  m.id,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000011'::uuid,
  CASE m.key
    WHEN 'call_connects' THEN 100
    WHEN 'talk_time_minutes' THEN 150
    WHEN 'meetings' THEN 10
    WHEN 'sourced_opps' THEN 7
    WHEN 'stage2_opps' THEN 12
  END,
  '2026-01-12'::date,
  '2026-01-18'::date
FROM kpi_metrics m
ON CONFLICT DO NOTHING;

-- Alex Rivera - Developing Performer (75% score)
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT 
  m.id,
  '00000000-0000-0000-0000-000000000103'::uuid,
  '00000000-0000-0000-0000-000000000011'::uuid,
  CASE m.key
    WHEN 'call_connects' THEN 75
    WHEN 'talk_time_minutes' THEN 113
    WHEN 'meetings' THEN 7
    WHEN 'sourced_opps' THEN 5
    WHEN 'stage2_opps' THEN 9
  END,
  '2026-01-12'::date,
  '2026-01-18'::date
FROM kpi_metrics m
ON CONFLICT DO NOTHING;
