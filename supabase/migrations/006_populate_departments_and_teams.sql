-- Migration 006: Populate Departments, Teams, and KPI Data
-- Ensure teams have department values and add sample KPI data

-- First, ensure department_enum exists with necessary values
-- Note: We add each enum value separately so they can be committed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_enum') THEN
    CREATE TYPE department_enum AS ENUM ('Sales', 'Marketing');
  END IF;
END $$;

-- Add Customer Success enum value if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Customer Success' AND enumtypid = 'department_enum'::regtype) THEN
    ALTER TYPE department_enum ADD VALUE 'Customer Success';
  END IF;
END $$;

-- Add Product enum value if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Product' AND enumtypid = 'department_enum'::regtype) THEN
    ALTER TYPE department_enum ADD VALUE 'Product';
  END IF;
END $$;

-- Add Engineering enum value if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Engineering' AND enumtypid = 'department_enum'::regtype) THEN
    ALTER TYPE department_enum ADD VALUE 'Engineering';
  END IF;
END $$;

-- Update existing teams to have departments if they don't already
UPDATE teams 
SET department = (CASE 
  WHEN name ILIKE '%sales%' THEN 'Sales'
  WHEN name ILIKE '%marketing%' THEN 'Marketing'
  WHEN name ILIKE '%support%' OR name ILIKE '%success%' THEN 'Customer Success'
  WHEN name ILIKE '%product%' THEN 'Product'
  WHEN name ILIKE '%engineering%' OR name ILIKE '%dev%' THEN 'Engineering'
  ELSE 'Sales'
END)::department_enum
WHERE department IS NULL;

-- If no teams exist, create some sample teams with departments
INSERT INTO teams (name, department) 
SELECT * FROM (VALUES 
  ('SDR Team Alpha', 'Sales'::department_enum),
  ('SDR Team Beta', 'Sales'::department_enum),
  ('Account Executives', 'Sales'::department_enum),
  ('Customer Success Team', 'Customer Success'::department_enum),
  ('Marketing Team', 'Marketing'::department_enum)
) AS v(name, department)
WHERE NOT EXISTS (SELECT 1 FROM teams LIMIT 1);

-- Update profiles to have departments matching their teams
UPDATE profiles p
SET department = t.department
FROM teams t
WHERE p.team_id = t.id
AND (p.department IS NULL OR p.department != t.department);

-- If any profiles don't have a team_id, assign them to the first team
UPDATE profiles
SET team_id = (SELECT id FROM teams LIMIT 1),
    department = (SELECT department FROM teams LIMIT 1)
WHERE team_id IS NULL;

-- Ensure all profiles have a department even without a team
UPDATE profiles
SET department = 'Sales'::department_enum
WHERE department IS NULL;

-- Add sample KPI data for all profiles
-- This adds realistic performance data for the current week
-- Realistic weekly performance: ~100 calls, ~150 min talk time (2:3 ratio), ~10 meetings, ~7 sourced opps, ~12 stage 2 opps
WITH profile_list AS (
  SELECT 
    p.id as profile_id,
    t.id as team_id,
    ROW_NUMBER() OVER (ORDER BY p.id) as row_num
  FROM profiles p
  LEFT JOIN teams t ON p.team_id = t.id
),
kpi_list AS (
  SELECT id, key FROM kpi_metrics
),
week_dates AS (
  SELECT 
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1) as week_start,
    CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1) + 6 as week_end
)
INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
SELECT 
  k.id,
  p.profile_id,
  p.team_id,
  CASE k.key
    -- Generate realistic values with proper ratios and varying performance (50-150%)
    -- Performance multiplier varies by profile to create range of scores
    WHEN 'call_connects' THEN 
      FLOOR((50 + (p.row_num * 11) % 100) * (0.5 + (p.row_num * 0.1) % 1.0))::numeric  -- 50-150 calls range
    WHEN 'talk_time_minutes' THEN 
      FLOOR((50 + (p.row_num * 11) % 100) * (0.5 + (p.row_num * 0.1) % 1.0) * 1.5)::numeric  -- 2:3 ratio with calls
    WHEN 'meetings' THEN 
      FLOOR((5 + (p.row_num * 7) % 10) * (0.5 + (p.row_num * 0.12) % 1.0))::numeric  -- 5-15 meetings
    WHEN 'sourced_opps' THEN 
      FLOOR((3 + (p.row_num * 5) % 8) * (0.5 + (p.row_num * 0.13) % 1.0))::numeric  -- 3-11 opportunities
    WHEN 'stage2_opps' THEN 
      FLOOR((6 + (p.row_num * 7) % 12) * (0.5 + (p.row_num * 0.11) % 1.0))::numeric  -- 6-18 stage 2 opps
    ELSE FLOOR(RANDOM() * 100)::numeric
  END,
  w.week_start,
  w.week_end
FROM profile_list p
CROSS JOIN kpi_list k
CROSS JOIN week_dates w
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN teams.department IS 'Department this team belongs to (Sales, Marketing, Customer Success, etc.)';
COMMENT ON COLUMN profiles.department IS 'Department this profile belongs to (should match their team)';
