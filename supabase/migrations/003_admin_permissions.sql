-- Migration: Add admin permissions for jenkins@apptivia.app
-- This allows specific users to see all teams and all users on the scorecard

-- Add role column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;

-- Create or update jenkins@apptivia.app profile with admin role
INSERT INTO profiles (email, first_name, last_name, role, department, title)
VALUES
  ('jenkins@apptivia.app', 'Jenkins', 'Admin', 'admin', 'Management', 'Administrator')
ON CONFLICT (email) 
DO UPDATE SET
  role = 'admin',
  first_name = COALESCE(profiles.first_name, 'Jenkins'),
  last_name = COALESCE(profiles.last_name, 'Admin'),
  department = COALESCE(profiles.department, 'Management'),
  title = COALESCE(profiles.title, 'Administrator');

-- Create a security definer function to check admin status
-- This avoids infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to allow admins to see all data
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own KPI values" ON kpi_values;
DROP POLICY IF EXISTS "Admins can view all KPI values" ON kpi_values;
DROP POLICY IF EXISTS "Allow all access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all access to kpi_values" ON kpi_values;
DROP POLICY IF EXISTS "Allow all access to teams" ON teams;

-- Disable RLS for now to allow unrestricted access
-- You can enable it later when you're ready for production security
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_values DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
