-- Migration 078: Recalculate all profile_skillsets cached values
-- After migration 077 removed/moved achievements, the profile_skillsets cache
-- has inflated values. This recalculates everything from profile_achievements
-- (the source of truth).

BEGIN;

-- Step 1: Recalculate achievements_completed, total_points_earned, and progress
-- for every profile_skillsets row using actual profile_achievements data.
UPDATE profile_skillsets ps
SET
  achievements_completed = COALESCE(computed.earned_count, 0),
  total_points_earned = COALESCE(computed.earned_points, 0),
  progress = CASE
    WHEN COALESCE(computed.total_points, 0) = 0 THEN 0
    ELSE LEAST(100, ROUND((COALESCE(computed.earned_points, 0)::numeric / computed.total_points) * 100))
  END
FROM (
  SELECT
    ps2.profile_id,
    ps2.skillset_id,
    -- Total points available for this skillset (from achievements table)
    (SELECT COALESCE(SUM(a.points), 0) FROM achievements a WHERE a.skillset_id = ps2.skillset_id) AS total_points,
    -- Earned count: achievements in this skillset that the user has earned
    COUNT(pa.achievement_id) AS earned_count,
    -- Earned points: sum of points for earned achievements in this skillset
    COALESCE(SUM(a.points), 0) AS earned_points
  FROM profile_skillsets ps2
  LEFT JOIN profile_achievements pa
    ON pa.profile_id = ps2.profile_id
  LEFT JOIN achievements a
    ON a.id = pa.achievement_id
    AND a.skillset_id = ps2.skillset_id
  GROUP BY ps2.profile_id, ps2.skillset_id
) computed
WHERE ps.profile_id = computed.profile_id
  AND ps.skillset_id = computed.skillset_id;

-- Step 2: Recalculate profiles.total_points from the sum of all
-- profile_skillsets.total_points_earned for each profile.
UPDATE profiles p
SET total_points = COALESCE(totals.sum_points, 0)
FROM (
  SELECT profile_id, SUM(total_points_earned) AS sum_points
  FROM profile_skillsets
  GROUP BY profile_id
) totals
WHERE p.id = totals.profile_id;

-- Step 3: Recalculate profiles.apptivia_level based on total_points.
-- Uses the same thresholds as constants/skillsets.ts LEVELS:
--   Developing: 0-999, Intermediate: 1000-2499, Proficient: 2500-4999,
--   Elite: 5000-9999, Master: 10000+
UPDATE profiles
SET apptivia_level = CASE
  WHEN total_points >= 10000 THEN 'Master'
  WHEN total_points >= 5000 THEN 'Elite'
  WHEN total_points >= 2500 THEN 'Proficient'
  WHEN total_points >= 1000 THEN 'Intermediate'
  ELSE 'Developing'
END
WHERE role NOT IN ('admin', 'manager', 'coach');

COMMIT;
