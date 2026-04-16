-- Fix teams.manager_id FK: was referencing empty public.users table,
-- should reference profiles (where actual user data lives).

ALTER TABLE teams
  DROP CONSTRAINT IF EXISTS teams_manager_fk,
  ADD CONSTRAINT teams_manager_fk FOREIGN KEY (manager_id) REFERENCES profiles(id);

-- Backfill manager_id from profiles with role='manager' on each team.
-- Uses DISTINCT ON to pick one manager per team (earliest created).
UPDATE teams t
SET manager_id = sub.manager_profile_id
FROM (
  SELECT DISTINCT ON (p.team_id)
    p.team_id,
    p.id AS manager_profile_id
  FROM profiles p
  WHERE p.role = 'manager'
    AND p.team_id IS NOT NULL
  ORDER BY p.team_id, p.created_at ASC
) sub
WHERE t.id = sub.team_id
  AND t.manager_id IS NULL;
