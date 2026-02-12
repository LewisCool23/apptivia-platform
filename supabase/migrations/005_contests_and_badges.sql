-- Migration 005: Contests and Badges System
-- Complete gamification infrastructure for competitive team engagement

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS profile_badges CASCADE;
DROP TABLE IF EXISTS contest_leaderboards CASCADE;
DROP TABLE IF EXISTS contest_participants CASCADE;
DROP TABLE IF EXISTS active_contests CASCADE;
DROP TABLE IF EXISTS contest_templates CASCADE;
DROP TRIGGER IF EXISTS trigger_auto_enroll_contests ON profiles;
DROP FUNCTION IF EXISTS auto_enroll_in_active_contests();
DROP FUNCTION IF EXISTS update_contest_leaderboards();

-- Contest Templates: Reusable contest types that can be launched multiple times
CREATE TABLE contest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  kpi_key TEXT NOT NULL, -- References kpi_metrics.key (e.g., 'call_connects', 'meetings')
  calculation_type TEXT NOT NULL DEFAULT 'sum', -- 'sum', 'average', 'count', 'max'
  icon TEXT, -- Icon name for UI display
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Active Contests: Running instances of contests
CREATE TABLE active_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES contest_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kpi_key TEXT NOT NULL,
  calculation_type TEXT NOT NULL DEFAULT 'sum',
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'upcoming', 'completed', 'cancelled'
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reward_type TEXT, -- 'gift_card', 'bonus', 'trophy', 'team_lunch', 'pto', 'custom'
  reward_value TEXT, -- "$100", "1 Day PTO", "Team Lunch", etc.
  reward_description TEXT,
  participant_type TEXT NOT NULL DEFAULT 'individual', -- 'individual', 'team', 'department'
  created_by UUID REFERENCES profiles(id),
  winner_id UUID REFERENCES profiles(id), -- Winner for individual contests
  winner_team_id UUID REFERENCES teams(id), -- Winner for team contests
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contest Participants: Track who's enrolled in each contest
CREATE TABLE contest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES active_contests(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id), -- For team-based contests
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(contest_id, profile_id)
);

-- Contest Leaderboards: Cached rankings with real-time scores
CREATE TABLE contest_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES active_contests(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id),
  rank INTEGER NOT NULL,
  score NUMERIC(10, 2) NOT NULL DEFAULT 0,
  previous_rank INTEGER, -- Track rank changes for UI animations
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, profile_id)
);

-- Profile Badges: Achievement rewards displayed on profiles
CREATE TABLE profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL, -- 'contest_winner', 'achievement', 'milestone', 'streak'
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  icon TEXT,
  color TEXT, -- Hex color for badge display
  contest_id UUID REFERENCES active_contests(id), -- If earned from contest
  achievement_id UUID REFERENCES achievements(id), -- If earned from achievement
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  display_order INTEGER DEFAULT 0, -- For sorting badges on profile
  is_featured BOOLEAN DEFAULT FALSE -- Pin to top of profile
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_contests_status ON active_contests(status);
CREATE INDEX IF NOT EXISTS idx_active_contests_dates ON active_contests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_contest_participants_contest ON contest_participants(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_participants_profile ON contest_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_contest_leaderboards_contest ON contest_leaderboards(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_contest_leaderboards_profile ON contest_leaderboards(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_badges_profile ON profile_badges(profile_id, earned_at DESC);

-- Insert default contest templates
INSERT INTO contest_templates (name, description, kpi_key, calculation_type, icon) VALUES
('Call Volume Challenge', 'Most calls connected in the contest period', 'call_connects', 'sum', '📞'),
('Meeting Master', 'Most meetings booked during the contest', 'meetings', 'sum', '📅'),
('Pipeline Power', 'Highest total pipeline value generated', 'pipeline', 'sum', '💰'),
('Talk Time Champion', 'Most minutes on calls with prospects', 'talk_time_minutes', 'sum', '⏱️'),
('Email Warrior', 'Most emails sent during the period', 'emails_sent', 'sum', '✉️'),
('Close Rate King', 'Highest close rate percentage', 'close_rate', 'average', '👑'),
('Perfect Week', 'All KPIs above target for the week', 'all_kpis', 'count', '⭐');

-- Sample active contest (Call Volume Challenge - currently active)
INSERT INTO active_contests (
  name, 
  description, 
  kpi_key, 
  calculation_type, 
  status, 
  start_date, 
  end_date, 
  reward_type, 
  reward_value,
  reward_description,
  participant_type
) VALUES (
  'Call Volume Challenge',
  'Most calls this week wins $100 gift card',
  'call_connects',
  'sum',
  'active',
  NOW() - INTERVAL '3 days',
  NOW() + INTERVAL '4 days',
  'gift_card',
  '$100',
  '$100 Amazon Gift Card',
  'individual'
);

-- Sample upcoming contest (Pipeline Generation)
INSERT INTO active_contests (
  name, 
  description, 
  kpi_key, 
  calculation_type, 
  status, 
  start_date, 
  end_date, 
  reward_type, 
  reward_value,
  reward_description,
  participant_type
) VALUES (
  'Pipeline Generation',
  'Highest pipeline value this month',
  'pipeline',
  'sum',
  'upcoming',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '37 days',
  'team_lunch',
  'Team Lunch',
  'Team celebration lunch at choice restaurant',
  'individual'
);

-- Sample completed contest (Meeting Master)
INSERT INTO active_contests (
  name, 
  description, 
  kpi_key, 
  calculation_type, 
  status, 
  start_date, 
  end_date, 
  reward_type, 
  reward_value,
  reward_description,
  participant_type,
  winner_id
) VALUES (
  'Meeting Master',
  'Most meetings booked last quarter',
  'meetings',
  'sum',
  'completed',
  NOW() - INTERVAL '90 days',
  NOW() - INTERVAL '7 days',
  'bonus',
  '$500',
  '$500 Performance Bonus',
  'individual',
  (SELECT id FROM profiles WHERE full_name = 'Mike Chen' LIMIT 1)
);

-- Enroll all active profiles in the active contest
INSERT INTO contest_participants (contest_id, profile_id, team_id)
SELECT 
  ac.id,
  p.id,
  p.team_id
FROM active_contests ac
CROSS JOIN profiles p
WHERE ac.status = 'active'
ON CONFLICT (contest_id, profile_id) DO NOTHING;

-- Calculate initial leaderboard for active contest
-- This will be recalculated periodically via a scheduled job or real-time trigger
WITH contest_scores AS (
  SELECT 
    cp.contest_id,
    cp.profile_id,
    cp.team_id,
    COALESCE(SUM(kv.value), 0) as total_score
  FROM contest_participants cp
  LEFT JOIN active_contests ac ON cp.contest_id = ac.id
  LEFT JOIN kpi_metrics km ON km.key = ac.kpi_key
  LEFT JOIN kpi_values kv ON kv.profile_id = cp.profile_id 
    AND kv.kpi_id = km.id
    AND kv.period_start >= DATE(ac.start_date)
    AND kv.period_end <= DATE(ac.end_date)
  WHERE ac.status = 'active'
  GROUP BY cp.contest_id, cp.profile_id, cp.team_id
),
ranked_scores AS (
  SELECT 
    contest_id,
    profile_id,
    team_id,
    total_score,
    RANK() OVER (PARTITION BY contest_id ORDER BY total_score DESC) as rank
  FROM contest_scores
)
INSERT INTO contest_leaderboards (contest_id, profile_id, team_id, rank, score)
SELECT contest_id, profile_id, team_id, rank, total_score
FROM ranked_scores
ON CONFLICT (contest_id, profile_id) 
DO UPDATE SET 
  previous_rank = contest_leaderboards.rank,
  rank = EXCLUDED.rank,
  score = EXCLUDED.score,
  last_updated = NOW();

-- Award badges to contest winner and top performers
INSERT INTO profile_badges (profile_id, badge_type, badge_name, badge_description, icon, color, contest_id)
SELECT 
  cl.profile_id,
  'contest_winner',
  CASE 
    WHEN cl.rank = 1 THEN '🥇 1st Place'
    WHEN cl.rank = 2 THEN '🥈 2nd Place'
    WHEN cl.rank = 3 THEN '🥉 3rd Place'
  END,
  ac.name || ' - ' || ac.reward_value,
  CASE 
    WHEN cl.rank = 1 THEN '🥇'
    WHEN cl.rank = 2 THEN '🥈'
    WHEN cl.rank = 3 THEN '🥉'
  END,
  CASE 
    WHEN cl.rank = 1 THEN '#FFD700'
    WHEN cl.rank = 2 THEN '#C0C0C0'
    WHEN cl.rank = 3 THEN '#CD7F32'
  END,
  cl.contest_id
FROM contest_leaderboards cl
JOIN active_contests ac ON cl.contest_id = ac.id
WHERE ac.status = 'completed'
AND cl.rank <= 3
ON CONFLICT DO NOTHING;

-- Function to recalculate contest leaderboards (can be called periodically)
CREATE OR REPLACE FUNCTION update_contest_leaderboards()
RETURNS void AS $$
BEGIN
  WITH contest_scores AS (
    SELECT 
      cp.contest_id,
      cp.profile_id,
      cp.team_id,
      ac.calculation_type,
      ac.kpi_key,
      CASE ac.calculation_type
        WHEN 'sum' THEN COALESCE(SUM(kv.value), 0)
        WHEN 'average' THEN COALESCE(AVG(kv.value), 0)
        WHEN 'max' THEN COALESCE(MAX(kv.value), 0)
        WHEN 'count' THEN COALESCE(COUNT(kv.value), 0)
      END as total_score
    FROM contest_participants cp
    LEFT JOIN active_contests ac ON cp.contest_id = ac.id
    LEFT JOIN kpi_metrics km ON km.key = ac.kpi_key
    LEFT JOIN kpi_values kv ON kv.profile_id = cp.profile_id 
      AND kv.kpi_id = km.id
      AND kv.period_start >= DATE(ac.start_date)
      AND kv.period_end <= DATE(ac.end_date)
    WHERE ac.status = 'active'
    GROUP BY cp.contest_id, cp.profile_id, cp.team_id, ac.calculation_type, ac.kpi_key
  ),
  ranked_scores AS (
    SELECT 
      contest_id,
      profile_id,
      team_id,
      total_score,
      RANK() OVER (PARTITION BY contest_id ORDER BY total_score DESC) as new_rank
    FROM contest_scores
  )
  INSERT INTO contest_leaderboards (contest_id, profile_id, team_id, rank, score, previous_rank)
  SELECT contest_id, profile_id, team_id, new_rank, total_score, new_rank
  FROM ranked_scores
  ON CONFLICT (contest_id, profile_id) 
  DO UPDATE SET 
    previous_rank = contest_leaderboards.rank,
    rank = EXCLUDED.rank,
    score = EXCLUDED.score,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-enroll new active profiles in active contests
CREATE OR REPLACE FUNCTION auto_enroll_in_active_contests()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contest_participants (contest_id, profile_id, team_id)
  SELECT id, NEW.id, NEW.team_id
  FROM active_contests
  WHERE status = 'active'
  ON CONFLICT (contest_id, profile_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_enroll_contests
AFTER INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION auto_enroll_in_active_contests();

-- Comments for documentation
COMMENT ON TABLE contest_templates IS 'Reusable contest types that can be launched multiple times';
COMMENT ON TABLE active_contests IS 'Running instances of contests with start/end dates and rewards';
COMMENT ON TABLE contest_participants IS 'Tracks which profiles are enrolled in which contests';
COMMENT ON TABLE contest_leaderboards IS 'Cached rankings with real-time scores for performance';
COMMENT ON TABLE profile_badges IS 'Achievement badges displayed on user profiles';
COMMENT ON FUNCTION update_contest_leaderboards IS 'Recalculates all active contest leaderboards from KPI data';
