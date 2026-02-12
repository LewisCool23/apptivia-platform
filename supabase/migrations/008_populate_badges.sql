-- Migration 008: Populate Badges and Badge Awarding System
-- Creates badge definitions and automatic badge awarding logic

-- Create a badge_definitions table to store badge metadata
CREATE TABLE IF NOT EXISTS badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_type TEXT NOT NULL, -- 'contest_winner', 'achievement_milestone', 'kpi_streak', 'scorecard', 'special'
  badge_name TEXT NOT NULL UNIQUE,
  badge_description TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  criteria_type TEXT, -- 'contest_rank', 'achievement_count', 'streak_days', 'scorecard_perfect', 'manual'
  criteria_value INTEGER, -- Threshold value for earning the badge
  points INTEGER DEFAULT 0, -- Points awarded with this badge
  is_rare BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Contest Winner Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('contest_winner', '1st Contest Winner', 'Won your first contest', '🏆', '#FFD700', 'contest_rank', 1, 100, true),
('contest_winner', '3x Contest Winner', 'Won 3 contests', '🥇', '#FFD700', 'contest_rank', 3, 250, true),
('contest_winner', '5x Contest Winner', 'Won 5 contests', '👑', '#FFD700', 'contest_rank', 5, 500, true),
('contest_winner', 'Contest Champion', 'Won 10 contests', '⭐', '#FFD700', 'contest_rank', 10, 1000, true),
('contest_winner', 'Silver Medalist', 'Finished 2nd in a contest', '🥈', '#C0C0C0', 'contest_rank', 2, 50, false),
('contest_winner', 'Bronze Medalist', 'Finished 3rd in a contest', '🥉', '#CD7F32', 'contest_rank', 3, 30, false),
('contest_winner', 'Podium Finisher', 'Finished top 3 in 5 contests', '🎯', '#FF6B6B', 'contest_rank', 5, 200, false)
ON CONFLICT (badge_name) DO NOTHING;

-- Insert Achievement Milestone Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('achievement_milestone', 'Achievement Hunter', 'Completed 10 achievements', '🎖️', '#4CAF50', 'achievement_count', 10, 50, false),
('achievement_milestone', 'Achievement Master', 'Completed 25 achievements', '🏅', '#4CAF50', 'achievement_count', 25, 150, false),
('achievement_milestone', 'Achievement Legend', 'Completed 50 achievements', '💎', '#4CAF50', 'achievement_count', 50, 300, true),
('achievement_milestone', 'Achievement God', 'Completed 100 achievements', '👼', '#4CAF50', 'achievement_count', 100, 750, true),
('achievement_milestone', 'Full Skillset', 'Completed all achievements in one skillset', '🌟', '#9C27B0', 'achievement_count', 100, 500, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Insert KPI Streak Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('kpi_streak', '5-Day KPI Streak', 'Met all KPIs for 5 consecutive days', '🔥', '#FF5722', 'streak_days', 5, 50, false),
('kpi_streak', '10-Day KPI Streak', 'Met all KPIs for 10 consecutive days', '🚀', '#FF5722', 'streak_days', 10, 150, false),
('kpi_streak', '30-Day KPI Streak', 'Met all KPIs for 30 consecutive days', '⚡', '#FF5722', 'streak_days', 30, 500, true),
('kpi_streak', '90-Day KPI Streak', 'Met all KPIs for 90 consecutive days', '🌪️', '#FF5722', 'streak_days', 90, 1500, true),
('kpi_streak', 'Unstoppable', 'Met all KPIs for 180 consecutive days', '💥', '#FF5722', 'streak_days', 180, 3000, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Insert Scorecard Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('scorecard', '1st 100% Weekly Scorecard', 'First perfect weekly scorecard', '💯', '#2196F3', 'scorecard_perfect', 1, 100, false),
('scorecard', '5x Perfect Scorecards', 'Achieved 5 perfect weekly scorecards', '✨', '#2196F3', 'scorecard_perfect', 5, 250, false),
('scorecard', '10x Perfect Scorecards', 'Achieved 10 perfect weekly scorecards', '🎪', '#2196F3', 'scorecard_perfect', 10, 600, true),
('scorecard', 'Perfect Month', 'All scorecards perfect for an entire month', '📊', '#2196F3', 'scorecard_perfect', 4, 400, true),
('scorecard', 'Consistency King', 'Maintained 90%+ scorecard average for 12 weeks', '👔', '#2196F3', 'scorecard_perfect', 12, 1000, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Insert Special Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('special', 'Early Adopter', 'One of the first users on the platform', '🌱', '#795548', 'manual', NULL, 200, true),
('special', 'Team Player', 'Helped 10 team members achieve their goals', '🤝', '#607D8B', 'manual', NULL, 300, false),
('special', 'Rising Star', 'Fastest improvement in overall performance', '⭐', '#FFC107', 'manual', NULL, 250, true),
('special', 'Department MVP', 'Top performer in your department this quarter', '💼', '#009688', 'manual', NULL, 500, true),
('special', 'Coaching Champion', 'Completed 50 coaching sessions', '🎓', '#673AB7', 'manual', NULL, 400, false)
ON CONFLICT (badge_name) DO NOTHING;

-- Function to award contest badges
CREATE OR REPLACE FUNCTION award_contest_badges()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Award 1st place badges for contest winners
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, contest_id)
  SELECT 
    cl.profile_id,
    'contest_winner',
    bd.badge_name,
    ac.name || ' - 1st Place',
    bd.icon,
    bd.color,
    cl.contest_id
  FROM contest_leaderboards cl
  JOIN active_contests ac ON cl.contest_id = ac.id
  CROSS JOIN badge_definitions bd
  WHERE ac.status = 'completed'
    AND cl.rank = 1
    AND bd.badge_name = '1st Contest Winner'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = cl.profile_id 
        AND pb.contest_id = cl.contest_id 
        AND pb.badge_type = 'contest_winner'
    );

  -- Award 2nd place badges
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, contest_id)
  SELECT 
    cl.profile_id,
    'contest_winner',
    bd.badge_name,
    ac.name || ' - 2nd Place',
    bd.icon,
    bd.color,
    cl.contest_id
  FROM contest_leaderboards cl
  JOIN active_contests ac ON cl.contest_id = ac.id
  CROSS JOIN badge_definitions bd
  WHERE ac.status = 'completed'
    AND cl.rank = 2
    AND bd.badge_name = 'Silver Medalist'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = cl.profile_id 
        AND pb.contest_id = cl.contest_id 
        AND pb.badge_type = 'contest_winner'
    );

  -- Award 3rd place badges
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, contest_id)
  SELECT 
    cl.profile_id,
    'contest_winner',
    bd.badge_name,
    ac.name || ' - 3rd Place',
    bd.icon,
    bd.color,
    cl.contest_id
  FROM contest_leaderboards cl
  JOIN active_contests ac ON cl.contest_id = ac.id
  CROSS JOIN badge_definitions bd
  WHERE ac.status = 'completed'
    AND cl.rank = 3
    AND bd.badge_name = 'Bronze Medalist'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = cl.profile_id 
        AND pb.contest_id = cl.contest_id 
        AND pb.badge_type = 'contest_winner'
    );

  -- Award milestone badges for multiple contest wins
  FOR profile_record IN 
    SELECT profile_id, COUNT(*) as win_count
    FROM profile_badges
    WHERE badge_type = 'contest_winner' 
      AND badge_name = '1st Contest Winner'
    GROUP BY profile_id
  LOOP
    -- 3x Contest Winner
    IF profile_record.win_count >= 3 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color
      FROM badge_definitions bd
      WHERE bd.badge_name = '3x Contest Winner'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = '3x Contest Winner'
        );
    END IF;

    -- 5x Contest Winner
    IF profile_record.win_count >= 5 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color
      FROM badge_definitions bd
      WHERE bd.badge_name = '5x Contest Winner'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = '5x Contest Winner'
        );
    END IF;

    -- Contest Champion (10x)
    IF profile_record.win_count >= 10 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color,
        true
      FROM badge_definitions bd
      WHERE bd.badge_name = 'Contest Champion'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = 'Contest Champion'
        );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to award achievement badges
CREATE OR REPLACE FUNCTION award_achievement_badges()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
BEGIN
  -- Award badges based on achievement counts
  FOR profile_record IN 
    SELECT profile_id, SUM(achievements_completed) as total_achievements
    FROM profile_skillsets
    GROUP BY profile_id
  LOOP
    -- Achievement Hunter (10)
    IF profile_record.total_achievements >= 10 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color
      FROM badge_definitions bd
      WHERE bd.badge_name = 'Achievement Hunter'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = 'Achievement Hunter'
        );
    END IF;

    -- Achievement Master (25)
    IF profile_record.total_achievements >= 25 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color
      FROM badge_definitions bd
      WHERE bd.badge_name = 'Achievement Master'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = 'Achievement Master'
        );
    END IF;

    -- Achievement Legend (50)
    IF profile_record.total_achievements >= 50 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color
      FROM badge_definitions bd
      WHERE bd.badge_name = 'Achievement Legend'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = 'Achievement Legend'
        );
    END IF;

    -- Achievement God (100)
    IF profile_record.total_achievements >= 100 THEN
      INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
      SELECT 
        profile_record.profile_id,
        bd.badge_type,
        bd.badge_name,
        bd.badge_description,
        bd.icon,
        bd.color,
        true
      FROM badge_definitions bd
      WHERE bd.badge_name = 'Achievement God'
        AND NOT EXISTS (
          SELECT 1 FROM profile_badges pb 
          WHERE pb.profile_id = profile_record.profile_id 
            AND pb.badge_name = 'Achievement God'
        );
    END IF;
  END LOOP;

  -- Award Full Skillset badges for completing all achievements in one skillset
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
  SELECT 
    ps.profile_id,
    bd.badge_type,
    bd.badge_name,
    s.name || ' Master - ' || bd.badge_description,
    bd.icon,
    bd.color
  FROM profile_skillsets ps
  JOIN skillsets s ON ps.skillset_id = s.id
  CROSS JOIN badge_definitions bd
  WHERE ps.achievements_completed >= 100
    AND bd.badge_name = 'Full Skillset'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = ps.profile_id 
        AND pb.badge_description LIKE s.name || ' Master%'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to award KPI streak badges
CREATE OR REPLACE FUNCTION award_streak_badges()
RETURNS void AS $$
BEGIN
  -- Award badges based on day_streak in profiles table
  -- 5-Day Streak
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
  SELECT 
    p.id,
    bd.badge_type,
    bd.badge_name,
    bd.badge_description,
    bd.icon,
    bd.color
  FROM profiles p
  CROSS JOIN badge_definitions bd
  WHERE p.day_streak >= 5
    AND bd.badge_name = '5-Day KPI Streak'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = p.id 
        AND pb.badge_name = '5-Day KPI Streak'
    );

  -- 10-Day Streak
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
  SELECT 
    p.id,
    bd.badge_type,
    bd.badge_name,
    bd.badge_description,
    bd.icon,
    bd.color
  FROM profiles p
  CROSS JOIN badge_definitions bd
  WHERE p.day_streak >= 10
    AND bd.badge_name = '10-Day KPI Streak'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = p.id 
        AND pb.badge_name = '10-Day KPI Streak'
    );

  -- 30-Day Streak
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
  SELECT 
    p.id,
    bd.badge_type,
    bd.badge_name,
    bd.badge_description,
    bd.icon,
    bd.color
  FROM profiles p
  CROSS JOIN badge_definitions bd
  WHERE p.day_streak >= 30
    AND bd.badge_name = '30-Day KPI Streak'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = p.id 
        AND pb.badge_name = '30-Day KPI Streak'
    );

  -- 90-Day Streak
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color)
  SELECT 
    p.id,
    bd.badge_type,
    bd.badge_name,
    bd.badge_description,
    bd.icon,
    bd.color
  FROM profiles p
  CROSS JOIN badge_definitions bd
  WHERE p.day_streak >= 90
    AND bd.badge_name = '90-Day KPI Streak'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = p.id 
        AND pb.badge_name = '90-Day KPI Streak'
    );

  -- Unstoppable (180-Day Streak)
  INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
  SELECT 
    p.id,
    bd.badge_type,
    bd.badge_name,
    bd.badge_description,
    bd.icon,
    bd.color,
    true
  FROM profiles p
  CROSS JOIN badge_definitions bd
  WHERE p.day_streak >= 180
    AND bd.badge_name = 'Unstoppable'
    AND NOT EXISTS (
      SELECT 1 FROM profile_badges pb 
      WHERE pb.profile_id = p.id 
        AND pb.badge_name = 'Unstoppable'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to award scorecard badges (placeholder - requires scorecard tracking table)
CREATE OR REPLACE FUNCTION award_scorecard_badges()
RETURNS void AS $$
BEGIN
  -- This function will be implemented when scorecard tracking is available
  -- For now, it's a placeholder for future scorecard badge logic
  RAISE NOTICE 'Scorecard badge awarding not yet implemented - awaiting scorecard tracking table';
END;
$$ LANGUAGE plpgsql;

-- Master function to award all badges
CREATE OR REPLACE FUNCTION award_all_badges()
RETURNS void AS $$
BEGIN
  PERFORM award_contest_badges();
  PERFORM award_achievement_badges();
  PERFORM award_streak_badges();
  PERFORM award_scorecard_badges();
END;
$$ LANGUAGE plpgsql;

-- Update some profiles to have higher achievement counts to earn badges
WITH ranked_skillsets AS (
  SELECT 
    id,
    profile_id,
    skillset_id,
    ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY skillset_id) as rn
  FROM profile_skillsets
  WHERE profile_id IN (SELECT id FROM profiles ORDER BY created_at LIMIT 3)
)
UPDATE profile_skillsets ps
SET achievements_completed = CASE 
  WHEN rs.rn = 1 THEN 35
  WHEN rs.rn = 2 THEN 28
  WHEN rs.rn = 3 THEN 15
  ELSE ps.achievements_completed
END
FROM ranked_skillsets rs
WHERE ps.id = rs.id;

-- Update profiles to have varied KPI streaks to earn streak badges
WITH ranked_profiles AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM profiles
  WHERE id IN (SELECT id FROM profiles ORDER BY created_at LIMIT 4)
)
UPDATE profiles p
SET day_streak = CASE 
  WHEN rp.rn = 1 THEN 12
  WHEN rp.rn = 2 THEN 7
  WHEN rp.rn = 3 THEN 35
  WHEN rp.rn = 4 THEN 5
  ELSE p.day_streak
END
FROM ranked_profiles rp
WHERE p.id = rp.id;

-- Run the badge awarding functions to populate initial badges
SELECT award_all_badges();

-- Add some sample special badges manually for demo profiles (if they exist)
-- Award "Early Adopter" badge to the first 2 profiles
INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
SELECT 
  p.id,
  bd.badge_type,
  bd.badge_name,
  bd.badge_description,
  bd.icon,
  bd.color,
  true
FROM badge_definitions bd
CROSS JOIN LATERAL (
  SELECT id FROM profiles ORDER BY created_at LIMIT 2
) p
WHERE bd.badge_name = 'Early Adopter'
  AND EXISTS (SELECT 1 FROM profiles LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM profile_badges pb 
    WHERE pb.profile_id = p.id
      AND pb.badge_name = 'Early Adopter'
  );

-- Award "Rising Star" badge to the 3rd profile
INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
SELECT 
  p.id,
  bd.badge_type,
  bd.badge_name,
  bd.badge_description,
  bd.icon,
  bd.color,
  false
FROM badge_definitions bd
CROSS JOIN LATERAL (
  SELECT id FROM profiles ORDER BY created_at LIMIT 1 OFFSET 2
) p
WHERE bd.badge_name = 'Rising Star'
  AND EXISTS (SELECT 1 FROM profiles LIMIT 1 OFFSET 2)
  AND NOT EXISTS (
    SELECT 1 FROM profile_badges pb 
    WHERE pb.profile_id = p.id
      AND pb.badge_name = 'Rising Star'
  );

-- Award "Team Player" badge to the 2nd profile
INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, is_featured)
SELECT 
  p.id,
  bd.badge_type,
  bd.badge_name,
  bd.badge_description,
  bd.icon,
  bd.color,
  false
FROM badge_definitions bd
CROSS JOIN LATERAL (
  SELECT id FROM profiles ORDER BY created_at LIMIT 1 OFFSET 1
) p
WHERE bd.badge_name = 'Team Player'
  AND EXISTS (SELECT 1 FROM profiles LIMIT 1 OFFSET 1)
  AND NOT EXISTS (
    SELECT 1 FROM profile_badges pb 
    WHERE pb.profile_id = p.id
      AND pb.badge_name = 'Team Player'
  );

-- Add comments for documentation
COMMENT ON TABLE badge_definitions IS 'Metadata for all available badge types and their earning criteria';
COMMENT ON FUNCTION award_contest_badges IS 'Awards badges for contest winners and top performers';
COMMENT ON FUNCTION award_achievement_badges IS 'Awards badges based on achievement completion milestones';
COMMENT ON FUNCTION award_streak_badges IS 'Awards badges for maintaining KPI streaks';
COMMENT ON FUNCTION award_all_badges IS 'Master function to run all badge awarding logic';
