-- Migration 111: Make profiles.team_id nullable
-- Fix: NOT NULL constraint on team_id blocks invites and signups
-- because users don't always have a team assigned at creation time.

ALTER TABLE profiles ALTER COLUMN team_id DROP NOT NULL;
