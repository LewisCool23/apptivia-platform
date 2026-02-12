-- =============================================================================
-- MIGRATION 023: Auto-Award Functions for Volume Badges
-- =============================================================================
-- Purpose: Create automatic badge awarding for volume-based badges
-- These badges are awarded based on cumulative KPI values
-- =============================================================================

-- Function to award volume badges based on KPI data
CREATE OR REPLACE FUNCTION award_volume_badges()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
  kpi_totals RECORD;
BEGIN
  -- Loop through all profiles
  FOR profile_record IN 
    SELECT id, email FROM profiles
  LOOP
    -- Get cumulative KPI totals for this profile
    SELECT 
      COALESCE(SUM(CASE WHEN km.key = 'call_connects' THEN kv.value ELSE 0 END), 0) as total_calls,
      COALESCE(SUM(CASE WHEN km.key = 'emails_sent' THEN kv.value ELSE 0 END), 0) as total_emails,
      COALESCE(SUM(CASE WHEN km.key = 'meetings' THEN kv.value ELSE 0 END), 0) as total_meetings,
      COALESCE(SUM(CASE WHEN km.key = 'sourced_opps' THEN kv.value ELSE 0 END), 0) as total_opps
    INTO kpi_totals
    FROM kpi_values kv
    JOIN kpi_metrics km ON km.id = kv.kpi_id
    WHERE kv.profile_id = profile_record.id
      AND km.key IN ('call_connects', 'emails_sent', 'meetings', 'sourced_opps');

    -- Award Call Volume Badges
    IF kpi_totals.total_calls >= 1000 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Call Deity'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_calls >= 500 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Call Legend'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_calls >= 250 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Call Champion'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_calls >= 100 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Call Pro'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_calls >= 50 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Call Starter'
      ON CONFLICT DO NOTHING;
    END IF;

    -- Award Email Volume Badges
    IF kpi_totals.total_emails >= 1000 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Email Legend'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_emails >= 500 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Email Champion'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_emails >= 250 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Email Pro'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_emails >= 100 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Email Starter'
      ON CONFLICT DO NOTHING;
    END IF;

    -- Award Meeting Volume Badges
    IF kpi_totals.total_meetings >= 100 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Meeting Legend'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_meetings >= 50 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Meeting Champion'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_meetings >= 25 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Meeting Pro'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_meetings >= 10 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Meeting Starter'
      ON CONFLICT DO NOTHING;
    END IF;

    -- Award Pipeline Volume Badges
    IF kpi_totals.total_opps >= 100 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Pipeline Titan'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_opps >= 50 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Pipeline Master'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_opps >= 25 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Pipeline Architect'
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF kpi_totals.total_opps >= 10 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT profile_record.id, badge_type, badge_name, badge_description, icon, color
      FROM badge_definitions WHERE badge_name = 'Pipeline Builder'
      ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;
  
  RAISE NOTICE '✓ Volume badges awarded based on KPI data';
END;
$$ LANGUAGE plpgsql;

-- Update award_all_badges to include volume badges
CREATE OR REPLACE FUNCTION award_all_badges()
RETURNS void AS $$
BEGIN
  -- Award all badge types
  PERFORM award_achievement_badges();
  PERFORM award_contest_badges();
  PERFORM award_scorecard_badges();
  PERFORM award_volume_badges();
  -- Note: Streak badges still disabled until proper tracking
  
  RAISE NOTICE '✓ Awarded badges (achievement, contest, scorecard, volume)';
  RAISE NOTICE '⚠️  Streak badges still disabled - awaiting proper streak tracking';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION award_volume_badges IS 'Awards badges based on cumulative KPI values (calls, emails, meetings, opportunities)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✓ Volume badge auto-award functions created!';
  RAISE NOTICE '  → Badges will be awarded automatically based on KPI totals';
  RAISE NOTICE '  → Run: SELECT award_all_badges(); to award badges now';
  RAISE NOTICE '';
END $$;
