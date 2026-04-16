-- =============================================================================
-- MIGRATION 110: Add organization_id to notifications
-- =============================================================================
-- Makes notifications org-scoped for proper multi-tenancy.
-- Previously relied on subquery join through profiles — now direct column.
-- =============================================================================

-- ── 1. Add column (nullable first for backfill) ─────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ── 2. Backfill from profiles ───────────────────────────────────────────────

UPDATE notifications n
SET organization_id = p.organization_id
FROM profiles p
WHERE n.profile_id = p.id
  AND n.organization_id IS NULL;

-- Delete orphaned notifications (no matching profile)
DELETE FROM notifications WHERE organization_id IS NULL;

-- ── 3. Make NOT NULL ────────────────────────────────────────────────────────

ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;

-- ── 4. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_organization_id
  ON notifications(organization_id);

CREATE INDEX IF NOT EXISTS idx_notifications_org_profile
  ON notifications(organization_id, profile_id);

-- ── 5. Update create_notification() to accept organization_id ───────────────

CREATE OR REPLACE FUNCTION create_notification(
  p_profile_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_dedupe_key TEXT DEFAULT NULL,
  p_achievement_id UUID DEFAULT NULL,
  p_badge_id UUID DEFAULT NULL,
  p_contest_id UUID DEFAULT NULL,
  p_skillset_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  v_org_id UUID;
BEGIN
  -- Resolve org_id: use param if provided, otherwise look up from profile
  v_org_id := p_organization_id;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id FROM profiles WHERE id = p_profile_id;
  END IF;

  -- Check for duplicate if dedupe_key provided
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO notification_id
    FROM notifications
    WHERE profile_id = p_profile_id
      AND dedupe_key = p_dedupe_key
      AND created_at > NOW() - INTERVAL '24 hours';

    IF notification_id IS NOT NULL THEN
      RETURN notification_id;
    END IF;
  END IF;

  -- Create new notification
  INSERT INTO notifications (
    profile_id, organization_id, type, title, message, icon, color,
    action_url, priority, dedupe_key,
    achievement_id, badge_id, contest_id, skillset_id
  ) VALUES (
    p_profile_id, v_org_id, p_type, p_title, p_message, p_icon, p_color,
    p_action_url, p_priority, p_dedupe_key,
    p_achievement_id, p_badge_id, p_contest_id, p_skillset_id
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- ── 6. Update trigger: achievement earned ───────────────────────────────────

CREATE OR REPLACE FUNCTION notify_achievement_earned()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement RECORD;
  v_org_id UUID;
BEGIN
  SELECT a.*, s.name as skillset_name
  INTO v_achievement
  FROM achievements a
  JOIN skillsets s ON s.id = a.skillset_id
  WHERE a.id = NEW.achievement_id;

  SELECT organization_id INTO v_org_id FROM profiles WHERE id = NEW.profile_id;

  PERFORM create_notification(
    p_profile_id := NEW.profile_id,
    p_type := 'achievement_earned'::notification_type,
    p_title := 'Achievement Unlocked!',
    p_message := 'You earned "' || v_achievement.name || '" in ' || v_achievement.skillset_name || ' (+' || v_achievement.points || ' pts)',
    p_icon := '🎯',
    p_color := '#10B981',
    p_action_url := '/profile#achievements',
    p_priority := 7,
    p_dedupe_key := 'achievement-' || NEW.achievement_id || '-' || NEW.profile_id,
    p_achievement_id := NEW.achievement_id,
    p_skillset_id := v_achievement.skillset_id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 7. Update trigger: badge earned ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_badge_earned()
RETURNS TRIGGER AS $$
DECLARE
  v_is_rare BOOLEAN;
  v_points INTEGER;
  v_badge_type TEXT;
  v_notification_type notification_type;
  v_org_id UUID;
BEGIN
  SELECT is_rare, points, badge_type
  INTO v_is_rare, v_points, v_badge_type
  FROM badge_definitions
  WHERE badge_name = NEW.badge_name
  LIMIT 1;

  SELECT organization_id INTO v_org_id FROM profiles WHERE id = NEW.profile_id;

  IF v_is_rare THEN
    v_notification_type := 'rare_badge_earned'::notification_type;
  ELSE
    v_notification_type := 'badge_earned'::notification_type;
  END IF;

  PERFORM create_notification(
    p_profile_id := NEW.profile_id,
    p_type := v_notification_type,
    p_title := CASE WHEN v_is_rare THEN 'Rare Badge Earned!' ELSE 'New Badge!' END,
    p_message := 'You earned the "' || NEW.badge_name || '" badge' ||
                 CASE WHEN v_points IS NOT NULL THEN ' (+' || v_points || ' pts)' ELSE '' END,
    p_icon := COALESCE(NEW.icon, '🏆'),
    p_color := COALESCE(NEW.color, '#3B82F6'),
    p_action_url := '/profile#badges',
    p_priority := CASE WHEN v_is_rare THEN 9 ELSE 7 END,
    p_dedupe_key := 'badge-' || NEW.badge_name || '-' || NEW.profile_id,
    p_badge_id := NEW.id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 8. Update trigger: contest winners ──────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_contest_winners()
RETURNS TRIGGER AS $$
DECLARE
  v_winner RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN

    FOR v_winner IN
      SELECT cl.profile_id, cl.rank, cl.score, p.full_name
      FROM contest_leaderboards cl
      JOIN profiles p ON p.id = cl.profile_id
      WHERE cl.contest_id = NEW.id
        AND cl.rank <= 3
      ORDER BY cl.rank
    LOOP
      PERFORM create_notification(
        p_profile_id := v_winner.profile_id,
        p_type := CASE
          WHEN v_winner.rank = 1 THEN 'contest_winner'::notification_type
          ELSE 'contest_top_3'::notification_type
        END,
        p_title := CASE
          WHEN v_winner.rank = 1 THEN 'Contest Winner!'
          WHEN v_winner.rank = 2 THEN '2nd Place!'
          WHEN v_winner.rank = 3 THEN '3rd Place!'
        END,
        p_message := 'You placed #' || v_winner.rank || ' in "' || NEW.name || '" contest!' ||
                     CASE WHEN NEW.reward_value IS NOT NULL THEN ' - ' || NEW.reward_value ELSE '' END,
        p_icon := CASE
          WHEN v_winner.rank = 1 THEN '🥇'
          WHEN v_winner.rank = 2 THEN '🥈'
          ELSE '🥉'
        END,
        p_color := CASE
          WHEN v_winner.rank = 1 THEN '#FFD700'
          WHEN v_winner.rank = 2 THEN '#C0C0C0'
          ELSE '#CD7F32'
        END,
        p_action_url := '/contests',
        p_priority := 10,
        p_dedupe_key := 'contest-win-' || NEW.id || '-' || v_winner.profile_id,
        p_contest_id := NEW.id,
        p_organization_id := NEW.organization_id
      );
    END LOOP;

    -- Notify all participants
    PERFORM create_notification(
      profile_id,
      'contest_participation'::notification_type,
      'Contest Completed',
      'The "' || NEW.name || '" contest has ended. Check the leaderboard!',
      '🎪',
      '#FF9800',
      '/contests',
      5,
      'contest-end-' || NEW.id || '-' || profile_id,
      NULL, NULL, NEW.id, NULL,
      NEW.organization_id
    )
    FROM contest_participants
    WHERE contest_id = NEW.id
      AND profile_id NOT IN (
        SELECT profile_id FROM contest_leaderboards
        WHERE contest_id = NEW.id AND rank <= 3
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 9. Drop old RLS policies and create new ones using organization_id ──────

DROP POLICY IF EXISTS "Org isolation: view own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: update own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: insert notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: delete own notifications" ON notifications;

-- SELECT: user can see own notifications within their org
CREATE POLICY "Org isolation: view own notifications"
  ON notifications FOR SELECT
  USING (
    profile_id = auth.uid()
    AND organization_id = auth_user_org_id()
  );

-- UPDATE: user can update own notifications within their org
CREATE POLICY "Org isolation: update own notifications"
  ON notifications FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND organization_id = auth_user_org_id()
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND organization_id = auth_user_org_id()
  );

-- INSERT: can only insert for profiles in own org
CREATE POLICY "Org isolation: insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    organization_id = auth_user_org_id()
  );

-- DELETE: user can delete own notifications
CREATE POLICY "Org isolation: delete own notifications"
  ON notifications FOR DELETE
  USING (
    profile_id = auth.uid()
    AND organization_id = auth_user_org_id()
  );

-- ── 10. Done ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE '✓ Migration 110: notifications.organization_id added, backfilled, RLS updated';
END $$;
