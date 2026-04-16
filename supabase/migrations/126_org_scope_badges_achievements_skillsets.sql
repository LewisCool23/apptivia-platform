-- ============================================================
-- Migration 126: Add organization_id to profile_badges,
--   profile_achievements, profile_skillsets for direct org-scoping
-- ============================================================
-- Replaces FK-based RLS (subquery through profiles) with direct
-- organization_id column for better performance and explicit isolation.
-- ============================================================

-- ── Step 1: Add nullable columns first ────────────────────────
ALTER TABLE profile_badges
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE profile_achievements
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE profile_skillsets
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ── Step 2: Backfill from profiles table ──────────────────────
UPDATE profile_badges pb
  SET organization_id = p.organization_id
  FROM profiles p
  WHERE pb.profile_id = p.id
    AND pb.organization_id IS NULL;

UPDATE profile_achievements pa
  SET organization_id = p.organization_id
  FROM profiles p
  WHERE pa.profile_id = p.id
    AND pa.organization_id IS NULL;

UPDATE profile_skillsets ps
  SET organization_id = p.organization_id
  FROM profiles p
  WHERE ps.profile_id = p.id
    AND ps.organization_id IS NULL;

-- ── Step 3: Set NOT NULL after backfill ───────────────────────
-- (Only if all rows were backfilled — orphan rows with no profile are deleted first)
DELETE FROM profile_badges WHERE organization_id IS NULL AND profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_achievements WHERE organization_id IS NULL AND profile_id NOT IN (SELECT id FROM profiles);
DELETE FROM profile_skillsets WHERE organization_id IS NULL AND profile_id NOT IN (SELECT id FROM profiles);

ALTER TABLE profile_badges ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE profile_achievements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE profile_skillsets ALTER COLUMN organization_id SET NOT NULL;

-- ── Step 4: Add indexes for org-scoped queries ────────────────
CREATE INDEX IF NOT EXISTS idx_profile_badges_org
  ON profile_badges(organization_id);
CREATE INDEX IF NOT EXISTS idx_profile_achievements_org
  ON profile_achievements(organization_id);
CREATE INDEX IF NOT EXISTS idx_profile_skillsets_org
  ON profile_skillsets(organization_id);

-- ── Step 5: Replace FK-based RLS with direct org_id check ─────
-- Drop old policies (from migrations 007 and 109)
DROP POLICY IF EXISTS "Allow authenticated users to view profile_badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: view badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: manage badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: view achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: manage achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: view skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Org isolation: manage skillsets" ON profile_skillsets;

-- Direct org_id policies (faster than subquery through profiles)
CREATE POLICY "Org isolation: view badges"
  ON profile_badges FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage badges"
  ON profile_badges FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: view achievements"
  ON profile_achievements FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage achievements"
  ON profile_achievements FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: view skillsets"
  ON profile_skillsets FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage skillsets"
  ON profile_skillsets FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- ── Step 6: Service role bypass (cron jobs use service_role) ──
-- Drop if exists for idempotency
DROP POLICY IF EXISTS "Service role: profile_badges" ON profile_badges;
DROP POLICY IF EXISTS "Service role: profile_achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Service role: profile_skillsets" ON profile_skillsets;

CREATE POLICY "Service role: profile_badges"
  ON profile_badges FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role: profile_achievements"
  ON profile_achievements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role: profile_skillsets"
  ON profile_skillsets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Step 7: Update award_achievement() to include organization_id ──
-- The function inserts into profile_achievements which now requires
-- organization_id (NOT NULL). We look it up from profiles to avoid
-- changing the function signature and all callers.
CREATE OR REPLACE FUNCTION award_achievement(
  p_profile_id UUID,
  p_achievement_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  achievement_points INTEGER;
  achievement_skillset UUID;
  profile_org_id UUID;
  new_progress NUMERIC;
  already_earned BOOLEAN;
BEGIN
  -- Check if achievement already earned
  SELECT EXISTS(
    SELECT 1 FROM profile_achievements
    WHERE profile_id = p_profile_id
      AND achievement_id = p_achievement_id
  ) INTO already_earned;

  IF already_earned THEN
    RETURN FALSE;
  END IF;

  -- Get achievement details
  SELECT points, skillset_id INTO achievement_points, achievement_skillset
  FROM achievements
  WHERE id = p_achievement_id;

  -- Get profile's organization_id
  SELECT organization_id INTO profile_org_id
  FROM profiles
  WHERE id = p_profile_id;

  -- Award the achievement (now with org_id)
  INSERT INTO profile_achievements (profile_id, achievement_id, points_awarded, organization_id)
  VALUES (p_profile_id, p_achievement_id, achievement_points, profile_org_id);

  -- Add achievement points directly to total_points
  UPDATE profiles
  SET total_points = total_points + achievement_points
  WHERE id = p_profile_id;

  -- Recalculate skillset progress
  new_progress := calculate_skillset_progress(p_profile_id, achievement_skillset);

  -- Check and award milestone bonuses
  PERFORM award_skillset_milestone_points(p_profile_id, achievement_skillset, new_progress);

  -- Update Apptivia Level
  PERFORM update_apptivia_level(p_profile_id);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
