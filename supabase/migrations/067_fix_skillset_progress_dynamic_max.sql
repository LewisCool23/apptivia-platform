-- ========================================================================
-- Migration 067: Fix skillset progress calculation
--
-- Problem: calculate_skillset_progress() hardcodes max_possible_points = 1175,
-- which was based on the original 100 achievements per skillset.
-- Migration 063 deleted trivial achievements and restructured talk-time
-- achievements, changing the actual point totals per skillset.
-- This causes progress to hit 100% before all achievements are earned.
--
-- Fix: Dynamically compute max_possible_points from the achievements table.
-- Then recalculate all existing profile_skillsets rows.
-- ========================================================================

-- ── 1. Replace the function with dynamic max ──────────────────────────────

CREATE OR REPLACE FUNCTION calculate_skillset_progress(
  p_profile_id UUID,
  p_skillset_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_total_points_earned INTEGER;
  max_possible_points INTEGER;
  progress_percentage NUMERIC;
BEGIN
  -- Calculate total points earned from achievements in this skillset
  SELECT COALESCE(SUM(a.points), 0)
  INTO v_total_points_earned
  FROM profile_achievements pa
  JOIN achievements a ON pa.achievement_id = a.id
  WHERE pa.profile_id = p_profile_id
    AND a.skillset_id = p_skillset_id;

  -- Dynamically compute max possible points from actual achievements
  SELECT COALESCE(SUM(points), 1)
  INTO max_possible_points
  FROM achievements
  WHERE skillset_id = p_skillset_id;

  -- Calculate percentage (0-100)
  progress_percentage := (v_total_points_earned::NUMERIC / max_possible_points) * 100;

  -- Update the profile_skillsets record
  UPDATE profile_skillsets
  SET
    progress = LEAST(progress_percentage, 100),
    total_points_earned = v_total_points_earned,
    achievements_completed = (
      SELECT COUNT(*)
      FROM profile_achievements pa
      JOIN achievements a ON pa.achievement_id = a.id
      WHERE pa.profile_id = p_profile_id
        AND a.skillset_id = p_skillset_id
    ),
    updated_at = NOW()
  WHERE profile_id = p_profile_id
    AND skillset_id = p_skillset_id;

  RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Recalculate all existing profile_skillsets rows ────────────────────

DO $$
DECLARE
  rec RECORD;
  new_progress NUMERIC;
BEGIN
  FOR rec IN
    SELECT profile_id, skillset_id
    FROM profile_skillsets
  LOOP
    new_progress := calculate_skillset_progress(rec.profile_id, rec.skillset_id);
  END LOOP;

  RAISE NOTICE 'Recalculated all profile_skillsets progress values';
END;
$$;
