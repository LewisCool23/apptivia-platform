-- Migration 181: Fix notification action_urls to use query params
-- Changes hash-based URLs (#badges, #achievements) to query-param-based (?tab=)
-- so Profile.jsx can read them via useSearchParams and auto-switch tabs.

-- 1. Backfill existing notifications with corrected URLs
UPDATE notifications SET action_url = '/profile?tab=skillset-progress'
WHERE action_url = '/profile#achievements';

UPDATE notifications SET action_url = '/profile?tab=badges'
WHERE action_url = '/profile#badges';

-- 2. Recreate notify_achievement_earned() with corrected action_url
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
    p_action_url := '/profile?tab=skillset-progress',
    p_priority := 7,
    p_dedupe_key := 'achievement-' || NEW.achievement_id || '-' || NEW.profile_id,
    p_achievement_id := NEW.achievement_id,
    p_skillset_id := v_achievement.skillset_id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recreate notify_badge_earned() with corrected action_url
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
    p_action_url := '/profile?tab=badges',
    p_priority := CASE WHEN v_is_rare THEN 9 ELSE 7 END,
    p_dedupe_key := 'badge-' || NEW.badge_name || '-' || NEW.profile_id,
    p_badge_id := NEW.id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('181', 'notification_action_url_fix')
ON CONFLICT DO NOTHING;
