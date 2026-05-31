-- Migration 201: Clean up cross-org contest participants
-- The original seed in migration 005 used CROSS JOIN without org filter,
-- enrolling profiles from ALL organizations into contests.
-- This removes orphaned participant rows where the profile doesn't belong
-- to the same organization as the contest.

DELETE FROM contest_participants cp
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p
  JOIN active_contests ac ON ac.id = cp.contest_id
  WHERE p.id = cp.profile_id
    AND p.organization_id = ac.organization_id
);
