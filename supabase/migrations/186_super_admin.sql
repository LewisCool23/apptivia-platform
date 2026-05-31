-- Migration 186: Add is_super_admin boolean to profiles
-- Used to gate internal-only features (e.g., Pilot Dashboard) away from customer orgs

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Grant super admin to the platform owners
UPDATE profiles SET is_super_admin = true WHERE email IN ('sean@apptivia.app', 'sean.adams@apptivia.app');
