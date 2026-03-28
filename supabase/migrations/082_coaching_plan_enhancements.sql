-- Migration 082: Coaching Plan Enhancements
-- 1. Fix CHECK constraint on coaching_plan_assignments to include 'in_progress'
-- 2. Fix coaching_plans SELECT RLS policy — role = 'Power User' never matches actual DB values
-- 3. Create coaching_plan_requests table for power user request flow

-- ============================================================
-- 1. Fix coaching_plan_assignments status CHECK constraint
--    Bug: original constraint only allowed ('active', 'completed', 'cancelled')
--    but UI writes 'in_progress', causing silent insert failures
-- ============================================================
ALTER TABLE coaching_plan_assignments DROP CONSTRAINT IF EXISTS coaching_plan_assignments_status_check;
ALTER TABLE coaching_plan_assignments ADD CONSTRAINT coaching_plan_assignments_status_check
  CHECK (status IN ('active', 'in_progress', 'completed', 'cancelled'));

-- ============================================================
-- 2. Fix coaching_plans SELECT RLS policy
--    Bug: migration 080 line 47 checks role = 'Power User' (capitalized)
--    but actual DB values are 'user' (default from migration 003) or 'power_user'.
--    This causes assigned reps to see NO coaching plans at all.
-- ============================================================
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
    -- Reps / power users: ONLY individual-visibility plans assigned to them
    -- Handles all role values: 'user', 'power_user', 'Power User'
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND LOWER(role::text) IN ('user', 'power_user', 'power user'))
      AND auth.uid() = ANY(assigned_to)
      AND visibility = 'individual'
    )
  );

-- ============================================================
-- 3. Create coaching_plan_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS coaching_plan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  requested_by UUID REFERENCES profiles(id),
  manager_id UUID REFERENCES profiles(id),
  message TEXT,
  current_score NUMERIC,
  lagging_kpis JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'dismissed')),
  fulfilled_plan_id UUID REFERENCES coaching_plans(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE coaching_plan_requests ENABLE ROW LEVEL SECURITY;

-- Reps can view their own requests
CREATE POLICY "Users can view own requests" ON coaching_plan_requests
  FOR SELECT USING (auth.uid() = requested_by);

-- Reps can create requests
CREATE POLICY "Users can create requests" ON coaching_plan_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Managers can view requests directed at them
CREATE POLICY "Managers can view team requests" ON coaching_plan_requests
  FOR SELECT USING (auth.uid() = manager_id);

-- Managers can update request status
CREATE POLICY "Managers can update requests" ON coaching_plan_requests
  FOR UPDATE USING (auth.uid() = manager_id);

-- Admins can do everything for their org
CREATE POLICY "Admins full access" ON coaching_plan_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = coaching_plan_requests.organization_id
        AND profiles.role = 'admin'
    )
  );
