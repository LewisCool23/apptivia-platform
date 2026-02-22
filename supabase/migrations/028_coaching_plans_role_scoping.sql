-- Migration 028: Coaching Plans role-based scoping
-- 1. Managers see only their own plans + plans for their team members + plans they created
-- 2. Power users can only see plans assigned to them (no create/edit/delete)
-- 3. Admins see everything (unchanged)
-- 4. Assignees can update their own assignment status/progress

-- Drop existing policy
DROP POLICY IF EXISTS coaching_plans_full_access ON coaching_plans;

-- New scoped SELECT policy
CREATE POLICY coaching_plans_select
  ON coaching_plans FOR SELECT
  USING (
    -- Admins see all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    -- Managers see plans they created, are assigned to, or where team_id matches their team
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
    -- Coach/power_user: only own + assigned
    OR auth.uid() = created_by
    OR auth.uid() = ANY(assigned_to)
  );

-- INSERT: admin, manager, coach can create; power_user cannot
CREATE POLICY coaching_plans_insert
  ON coaching_plans FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );

-- UPDATE: admin, manager, coach can update their own; power_user cannot
CREATE POLICY coaching_plans_update
  ON coaching_plans FOR UPDATE
  USING (
    (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );

-- DELETE: admin, manager, coach can delete their own; power_user cannot
CREATE POLICY coaching_plans_delete
  ON coaching_plans FOR DELETE
  USING (
    (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'coach')
    )
  );

-- Allow assignees (including power_users) to update their own assignment status
DROP POLICY IF EXISTS coaching_plan_assignments_update ON coaching_plan_assignments;
CREATE POLICY coaching_plan_assignments_update
  ON coaching_plan_assignments FOR UPDATE
  USING (
    auth.uid() = assigned_to
    OR auth.uid() = assigned_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
