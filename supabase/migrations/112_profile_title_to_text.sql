-- Migration 112: Convert profiles.title from profile_title enum to text
-- Fix: Onboarding sends title labels like "Business Development Leader"
-- which aren't valid values in the profile_title enum type.
-- Converting to text allows any title value and matches how the column
-- is already used (seed data inserts plain text like "Senior Sales Rep").

-- Step 0: Save and drop the view that depends on profiles.title
-- (profiles_with_team_name is not used by the app but blocks ALTER TYPE)
DROP VIEW IF EXISTS profiles_with_team_name;

-- Step 1: Drop default values that reference the enum type
ALTER TABLE profiles ALTER COLUMN title DROP DEFAULT;
ALTER TABLE action_plans ALTER COLUMN title DROP DEFAULT;

-- Step 2: Change profiles.title column from enum to text
ALTER TABLE profiles
  ALTER COLUMN title TYPE text USING title::text;

-- Step 3: Change action_plans.title if it also uses the enum
ALTER TABLE action_plans
  ALTER COLUMN title TYPE text USING title::text;

-- Step 4: Drop the enum type now that nothing references it
DROP TYPE IF EXISTS profile_title;

-- Step 4: Recreate the view (profiles joined with team name)
CREATE OR REPLACE VIEW profiles_with_team_name AS
SELECT
  p.*,
  t.name AS team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team_id;
