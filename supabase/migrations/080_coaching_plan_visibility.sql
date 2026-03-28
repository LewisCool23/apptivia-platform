-- Migration 080: Coaching Plan Visibility + Privacy-scoped RLS
-- Adds visibility column to control whether power users can see plan content
-- 'individual' = safe to share with assigned reps (scoped to one rep's data)
-- 'team' = manager-only view (may contain cross-rep performance data)

-- 1. Add visibility column (default 'individual' for backward compatibility)
ALTER TABLE coaching_plans
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'individual'
  CHECK (visibility IN ('team', 'individual'));

-- 2. Backfill: auto-generated plans assigned to multiple members → 'team'
-- These likely contain team-wide data from buildPlaybookSummary
UPDATE coaching_plans
  SET visibility = 'team'
  WHERE plan_type = 'auto'
    AND array_length(assigned_to, 1) > 1;

-- 3. Replace SELECT policy: power_users restricted to individual-visibility + assigned
DROP POLICY IF EXISTS coaching_plans_select ON coaching_plans;

CREATE POLICY coaching_plans_select
  ON coaching_plans FOR SELECT
  USING (
    -- Admins see all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    -- Managers see plans they created, assigned to, or team-related
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
      AND (
        auth.uid() = created_by
        OR auth.uid() = ANY(assigned_to)
        OR team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = ANY(coaching_plans.assigned_to)
          AND p.team_id = (SELECT team_id FROM profiles WHERE id = auth.uid())
        )
      )
    )
    -- Coach role: own + assigned
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach')
      AND (auth.uid() = created_by OR auth.uid() = ANY(assigned_to))
    )
    -- Power users: ONLY individual-visibility plans assigned to them
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Power User')
      AND auth.uid() = ANY(assigned_to)
      AND visibility = 'individual'
    )
  );

COMMENT ON COLUMN coaching_plans.visibility IS
  'team = manager-only (contains cross-rep data), individual = safe to share with assigned reps';
