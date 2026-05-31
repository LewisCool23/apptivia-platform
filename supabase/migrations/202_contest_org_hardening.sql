-- Migration 202: Contest org-scoping hardening
-- Cleans orphaned contest data and ensures RLS is enabled

-- 1. Remove orphaned leaderboard entries (contests deleted before org-scoping)
DELETE FROM contest_leaderboards
WHERE contest_id NOT IN (SELECT id FROM active_contests);

-- 2. Remove orphaned participant entries
DELETE FROM contest_participants
WHERE contest_id NOT IN (SELECT id FROM active_contests);

-- 3. Ensure RLS is enabled (idempotent)
ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_leaderboards ENABLE ROW LEVEL SECURITY;
