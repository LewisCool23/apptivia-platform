-- ============================================================================
-- Migration 109: Organization Isolation (Multi-Tenancy RLS)
--
-- Ensures all user-data tables are scoped to the authenticated user's org.
-- Uses auth_user_org_id() from migration 039.
--
-- IDEMPOTENT: Safe to re-run. Each step uses IF NOT EXISTS / IF EXISTS guards.
-- No BEGIN/COMMIT wrapper — Supabase SQL Editor auto-commits each statement,
-- so a failure mid-way won't roll back prior successful statements.
-- ============================================================================

-- ── 1a. Add organization_id to tables that need it ──────────────────────────

ALTER TABLE active_contests
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE contest_templates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- ── 1b. Backfill from created_by → profiles.organization_id ─────────────────

UPDATE active_contests ac
SET organization_id = p.organization_id
FROM profiles p
WHERE ac.created_by = p.id AND ac.organization_id IS NULL;

UPDATE contest_templates ct
SET organization_id = p.organization_id
FROM profiles p
WHERE ct.created_by = p.id AND ct.organization_id IS NULL;

-- ── 1c. Delete orphaned rows where backfill couldn't resolve an org ─────────
-- (e.g. created_by references a deleted profile or is NULL)
-- Also delete contest_participants and contest_leaderboards that reference
-- orphaned contests to avoid FK violations.

DELETE FROM contest_leaderboards
WHERE contest_id IN (SELECT id FROM active_contests WHERE organization_id IS NULL);

DELETE FROM contest_participants
WHERE contest_id IN (SELECT id FROM active_contests WHERE organization_id IS NULL);

DELETE FROM active_contests WHERE organization_id IS NULL;
DELETE FROM contest_templates WHERE organization_id IS NULL;

-- ── 1d. Make NOT NULL after backfill + orphan cleanup ───────────────────────

ALTER TABLE active_contests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contest_templates ALTER COLUMN organization_id SET NOT NULL;

-- ── 1e. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_active_contests_org ON active_contests(organization_id);
CREATE INDEX IF NOT EXISTS idx_contest_templates_org ON contest_templates(organization_id);

-- ── 1f. Enable RLS on tables that don't have it yet ─────────────────────────

ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skillsets ENABLE ROW LEVEL SECURITY;

-- ── 1g. Drop old permissive policies (IF EXISTS = idempotent) ───────────────

-- active_contests
DROP POLICY IF EXISTS "Users can view active contests" ON active_contests;
DROP POLICY IF EXISTS "Admins can manage contests" ON active_contests;

-- contest_templates
DROP POLICY IF EXISTS "Anyone can view templates" ON contest_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON contest_templates;

-- contest_participants
DROP POLICY IF EXISTS "Users can view contest participants" ON contest_participants;

-- contest_leaderboards
DROP POLICY IF EXISTS "Users can view leaderboards" ON contest_leaderboards;

-- profile_badges
DROP POLICY IF EXISTS "Users can view own badges" ON profile_badges;
DROP POLICY IF EXISTS "Users can view all badges" ON profile_badges;
DROP POLICY IF EXISTS "Admins can manage badges" ON profile_badges;

-- profile_achievements
DROP POLICY IF EXISTS "Users can view achievements" ON profile_achievements;

-- profile_skillsets
DROP POLICY IF EXISTS "Users can view skillsets" ON profile_skillsets;

-- notifications (profile_id column per migration 024)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- Also drop new policies in case of re-run (so CREATE POLICY doesn't conflict)
DROP POLICY IF EXISTS "Org isolation: view contests" ON active_contests;
DROP POLICY IF EXISTS "Org isolation: manage contests" ON active_contests;
DROP POLICY IF EXISTS "Org isolation: view templates" ON contest_templates;
DROP POLICY IF EXISTS "Org isolation: manage templates" ON contest_templates;
DROP POLICY IF EXISTS "Org isolation: view achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: manage achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: view badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: manage badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: view skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Org isolation: manage skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Org isolation: view participants" ON contest_participants;
DROP POLICY IF EXISTS "Org isolation: manage participants" ON contest_participants;
DROP POLICY IF EXISTS "Org isolation: view leaderboards" ON contest_leaderboards;
DROP POLICY IF EXISTS "Org isolation: manage leaderboards" ON contest_leaderboards;
DROP POLICY IF EXISTS "Org isolation: view own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: update own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: insert notifications" ON notifications;

-- ── 1h. Create org-scoped RLS policies ──────────────────────────────────────

-- Pattern A: Tables with organization_id column ──────────────────────────────

-- active_contests
CREATE POLICY "Org isolation: view contests"
  ON active_contests FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage contests"
  ON active_contests FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- contest_templates
CREATE POLICY "Org isolation: view templates"
  ON contest_templates FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage templates"
  ON contest_templates FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- Pattern B: Tables linked via profile_id ────────────────────────────────────

-- profile_achievements
CREATE POLICY "Org isolation: view achievements"
  ON profile_achievements FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage achievements"
  ON profile_achievements FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- profile_badges
CREATE POLICY "Org isolation: view badges"
  ON profile_badges FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage badges"
  ON profile_badges FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- profile_skillsets
CREATE POLICY "Org isolation: view skillsets"
  ON profile_skillsets FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage skillsets"
  ON profile_skillsets FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- Pattern C: Tables linked via contest_id → active_contests ──────────────────

-- contest_participants
CREATE POLICY "Org isolation: view participants"
  ON contest_participants FOR SELECT
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage participants"
  ON contest_participants FOR ALL
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

-- contest_leaderboards
CREATE POLICY "Org isolation: view leaderboards"
  ON contest_leaderboards FOR SELECT
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage leaderboards"
  ON contest_leaderboards FOR ALL
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

-- Pattern D: Notifications (profile_id per migration 024) ────────────────────

CREATE POLICY "Org isolation: view own notifications"
  ON notifications FOR SELECT
  USING (
    profile_id = auth.uid()
    AND profile_id IN (SELECT id FROM profiles WHERE organization_id = auth_user_org_id())
  );

CREATE POLICY "Org isolation: update own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Org isolation: insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE organization_id = auth_user_org_id())
  );

-- ── 1i. Fix auto-enroll trigger to scope by org ────────────────────────────

CREATE OR REPLACE FUNCTION auto_enroll_contest_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auto_enroll THEN
    INSERT INTO contest_participants (contest_id, profile_id)
    SELECT NEW.id, p.id
    FROM profiles p
    WHERE p.organization_id = NEW.organization_id
      AND p.role IN ('rep', 'bdr', 'sdr', 'ae', 'am')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
