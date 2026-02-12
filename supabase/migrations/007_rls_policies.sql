-- Migration 007: Add Row Level Security Policies
-- Enable RLS and create policies for public tables

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Teams policies - Allow all authenticated users to view teams
CREATE POLICY "Allow authenticated users to view teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert/update teams"
  ON teams FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Profiles policies - Allow users to view all profiles, update own profile
CREATE POLICY "Allow authenticated users to view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow users to insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- KPI Metrics policies - Allow all authenticated users to view metrics
CREATE POLICY "Allow authenticated users to view kpi_metrics"
  ON kpi_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage kpi_metrics"
  ON kpi_metrics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- KPI Values policies - Allow all authenticated users to view and manage
CREATE POLICY "Allow authenticated users to view kpi_values"
  ON kpi_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage kpi_values"
  ON kpi_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Organizations policies
CREATE POLICY "Allow authenticated users to view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add policies for other tables if they have RLS enabled
DO $$
BEGIN
  -- Skillsets policies
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'skillsets') THEN
    EXECUTE 'ALTER TABLE skillsets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Allow authenticated users to view skillsets" ON skillsets FOR SELECT TO authenticated USING (true)';
  END IF;

  -- Achievements policies
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'achievements') THEN
    EXECUTE 'ALTER TABLE achievements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Allow authenticated users to view achievements" ON achievements FOR SELECT TO authenticated USING (true)';
  END IF;

  -- Contests policies
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'contests') THEN
    EXECUTE 'ALTER TABLE contests ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Allow authenticated users to view contests" ON contests FOR SELECT TO authenticated USING (true)';
  END IF;

  -- Profile badges policies
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profile_badges') THEN
    EXECUTE 'ALTER TABLE profile_badges ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "Allow authenticated users to view profile_badges" ON profile_badges FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

COMMENT ON POLICY "Allow authenticated users to view teams" ON teams IS 'All authenticated users can view team information';
COMMENT ON POLICY "Allow authenticated users to view profiles" ON profiles IS 'All authenticated users can view profile information';
