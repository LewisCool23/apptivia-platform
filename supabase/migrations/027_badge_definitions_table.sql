-- Migration 027: Create Badge Definitions Table
-- Purpose: Central table for all available badges in the system

-- Create badge_definitions table if it doesn't exist
CREATE TABLE IF NOT EXISTS badge_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_type TEXT NOT NULL, -- 'achievement_milestone', 'contest_participation', 'combo', 'milestone', 'volume', 'improvement', 'team', 'fun', 'revenue'
  badge_name TEXT NOT NULL UNIQUE,
  badge_description TEXT,
  icon TEXT DEFAULT '🏆',
  color TEXT DEFAULT '#3B82F6',
  criteria_type TEXT, -- 'achievement_count', 'manual', 'kpi_total', etc.
  criteria_value NUMERIC,
  points INTEGER DEFAULT 0,
  is_rare BOOLEAN DEFAULT FALSE,
  category TEXT, -- For grouping/filtering
  rarity TEXT, -- 'common', 'rare', 'epic', 'legendary'
  requirements JSONB, -- Flexible field for complex requirements
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure newer columns exist if the table pre-dated this migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_definitions' AND column_name = 'category'
  ) THEN
    ALTER TABLE badge_definitions ADD COLUMN category TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_definitions' AND column_name = 'rarity'
  ) THEN
    ALTER TABLE badge_definitions ADD COLUMN rarity TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_definitions' AND column_name = 'requirements'
  ) THEN
    ALTER TABLE badge_definitions ADD COLUMN requirements JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_definitions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE badge_definitions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'badge_definitions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE badge_definitions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_badge_definitions_type ON badge_definitions(badge_type);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_category ON badge_definitions(category);
CREATE INDEX IF NOT EXISTS idx_badge_definitions_rarity ON badge_definitions(rarity);

-- Enable RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read badge definitions
CREATE POLICY "Badge definitions are readable by everyone" ON badge_definitions
  FOR SELECT USING (true);

-- RLS Policy: Only admins can modify badge definitions
CREATE POLICY "Badge definitions are writable by admins" ON badge_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Insert all badge definitions if they don't exist
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, category, rarity, points, is_rare) VALUES
-- Achievement Milestones
('achievement_milestone', 'First Steps', 'Completed your first 5 achievements', '👣', '#4CAF50', 'achievement', 'common', 25, false),
('achievement_milestone', 'Rising Achiever', 'Completed 15 achievements', '🌟', '#4CAF50', 'achievement', 'common', 75, false),
('achievement_milestone', 'Achievement Pro', 'Completed 35 achievements', '⭐', '#4CAF50', 'achievement', 'rare', 200, false),
('achievement_milestone', 'Achievement Elite', 'Completed 75 achievements', '💫', '#4CAF50', 'achievement', 'epic', 450, true),
('achievement_milestone', 'Achievement Master', 'Completed 100 achievements', '🎯', '#4CAF50', 'achievement', 'legendary', 1000, true),

-- Contest Participation
('contest', 'Contest Rookie', 'Participated in your first contest', '🎯', '#FF9800', 'contest', 'common', 20, false),
('contest', 'Contest Veteran', 'Participated in 5 contests', '🎪', '#FF9800', 'contest', 'common', 75, false),
('contest', 'Contest Regular', 'Participated in 10 contests', '🎭', '#FF9800', 'contest', 'rare', 150, false),
('contest', 'Contest Winner', 'Won your first contest', '🏆', '#FFD700', 'contest', 'epic', 200, true),
('contest', 'Serial Winner', 'Won 3 contests', '👑', '#FFD700', 'contest', 'legendary', 500, true),

-- Combo Badges
('combo', 'Triple Threat', 'Won contest, 25+ achievements, and perfect scorecard', '🔥', '#E91E63', 'combo', 'legendary', 500, true),
('combo', 'All-Rounder', 'Progress in all 6 skillsets with 10+ achievements each', '🎯', '#E91E63', 'combo', 'epic', 400, true),
('combo', 'Power User', 'Earned 50+ achievements and 2000+ total points', '⚡', '#E91E63', 'combo', 'epic', 350, true),

-- Time Milestones
('milestone', 'First Day', 'Completed your first day on the platform', '🌅', '#00BCD4', 'milestone', 'common', 10, false),
('milestone', 'First Week', 'Active for your first week', '📅', '#00BCD4', 'milestone', 'common', 25, false),
('milestone', 'First Month', 'Active for your first month', '📆', '#00BCD4', 'milestone', 'common', 75, false),
('milestone', '100 Days Strong', 'Been active for 100 days', '💪', '#00BCD4', 'milestone', 'rare', 200, true),
('milestone', 'One Year Anniversary', 'Celebrating one year on the platform', '🎂', '#00BCD4', 'milestone', 'legendary', 500, true),

-- Call Volume
('volume', 'Call Starter', 'Made 50 call connects', '📞', '#3F51B5', 'activity', 'common', 30, false),
('volume', 'Call Pro', 'Made 100 call connects', '☎️', '#3F51B5', 'activity', 'common', 75, false),
('volume', 'Call Champion', 'Made 250 call connects', '📱', '#3F51B5', 'activity', 'rare', 150, false),
('volume', 'Call Legend', 'Made 500 call connects', '🎙️', '#3F51B5', 'activity', 'epic', 300, true),
('volume', 'Call Deity', 'Made 1000 call connects', '👑', '#3F51B5', 'activity', 'legendary', 750, true),

-- Email Volume
('volume', 'Email Starter', 'Sent 100 personalized emails', '✉️', '#9C27B0', 'activity', 'common', 30, false),
('volume', 'Email Pro', 'Sent 250 personalized emails', '📧', '#9C27B0', 'activity', 'common', 75, false),
('volume', 'Email Champion', 'Sent 500 personalized emails', '📬', '#9C27B0', 'activity', 'rare', 150, false),
('volume', 'Email Legend', 'Sent 1000 personalized emails', '📮', '#9C27B0', 'activity', 'epic', 300, true),

-- Meeting Volume
('volume', 'Meeting Starter', 'Booked 10 meetings', '🗓️', '#FF5722', 'activity', 'common', 40, false),
('volume', 'Meeting Pro', 'Booked 25 meetings', '📋', '#FF5722', 'activity', 'common', 100, false),
('volume', 'Meeting Champion', 'Booked 50 meetings', '📝', '#FF5722', 'activity', 'rare', 200, false),
('volume', 'Meeting Legend', 'Booked 100 meetings', '🎯', '#FF5722', 'activity', 'epic', 400, true),

-- Pipeline
('volume', 'Pipeline Builder', 'Created 10 qualified opportunities', '🔧', '#009688', 'pipeline', 'common', 50, false),
('volume', 'Pipeline Architect', 'Created 25 qualified opportunities', '🏗️', '#009688', 'pipeline', 'common', 125, false),
('volume', 'Pipeline Master', 'Created 50 qualified opportunities', '🏛️', '#009688', 'pipeline', 'rare', 250, true),
('volume', 'Pipeline Titan', 'Created 100 qualified opportunities', '🌉', '#009688', 'pipeline', 'epic', 500, true),

-- Improvement & Momentum
('improvement', 'On Fire', 'Earned 5 achievements in one week', '🔥', '#FF6F00', 'momentum', 'rare', 100, false),
('improvement', 'Speed Demon', 'Earned 10 achievements in one week', '⚡', '#FF6F00', 'momentum', 'epic', 250, true),
('improvement', 'Unstoppable Force', 'Earned 20 achievements in one month', '💥', '#FF6F00', 'momentum', 'legendary', 500, true),
('improvement', 'Comeback Kid', 'Improved scorecard by 30%+ in one period', '📈', '#FF6F00', 'momentum', 'rare', 200, false),

-- Team & Collaboration
('team', 'Helpful Hand', 'Assisted 3 team members with their goals', '🤝', '#607D8B', 'team', 'common', 50, false),
('team', 'Mentor', 'Helped 5 team members improve their performance', '🎓', '#607D8B', 'team', 'rare', 150, false),
('team', 'Team Champion', 'Your team won a team-based contest', '👥', '#607D8B', 'team', 'epic', 200, false),

-- Fun & Creative
('fun', 'Early Bird', 'First to hit scorecard goal 5 weeks in a row', '🌅', '#FFC107', 'fun', 'rare', 100, false),
('fun', 'Night Owl', 'Completed activity after 8pm for 10 consecutive days', '🦉', '#FFC107', 'fun', 'common', 75, false),
('fun', 'Weekend Warrior', 'Logged activity on 10 weekends', '⚔️', '#FFC107', 'fun', 'rare', 150, false),
('fun', 'Lucky Streak', 'Hit exactly 100% scorecard 7 times', '🍀', '#FFC107', 'fun', 'epic', 200, true),
('fun', 'Overachiever', 'Exceeded 150%+ on scorecard', '🚀', '#FFC107', 'fun', 'rare', 250, true),

-- Revenue & Results
('revenue', 'First Deal', 'Closed your first deal', '💰', '#4CAF50', 'revenue', 'common', 100, false),
('revenue', 'Deal Maker', 'Closed 5 deals', '💵', '#4CAF50', 'revenue', 'common', 250, false),
('revenue', 'Deal Closer', 'Closed 10 deals', '💸', '#4CAF50', 'revenue', 'rare', 500, false),
('revenue', 'Revenue Driver', 'Generated over $100K in revenue', '🏆', '#4CAF50', 'revenue', 'epic', 400, true),
('revenue', 'Revenue Champion', 'Generated over $500K in revenue', '👑', '#4CAF50', 'revenue', 'legendary', 1000, true),

-- Scorecard Excellence
('scorecard', 'Perfect Score', 'Achieved 100% on scorecard', '💯', '#2196F3', 'scorecard', 'common', 50, false),
('scorecard', 'Consistency Pro', 'Hit 100% scorecard 5 times', '📊', '#2196F3', 'scorecard', 'rare', 150, false),
('scorecard', 'Consistency Master', 'Hit 100% scorecard 10 times', '🎯', '#2196F3', 'scorecard', 'epic', 300, true),
('scorecard', 'Hot Streak', '5 perfect scorecards in a row', '🔥', '#2196F3', 'scorecard', 'epic', 400, true),
('scorecard', 'Perfection', '10 perfect scorecards in a row', '⭐', '#2196F3', 'scorecard', 'legendary', 800, true)

ON CONFLICT (badge_name) DO UPDATE SET
  badge_description = EXCLUDED.badge_description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  points = EXCLUDED.points,
  updated_at = NOW();

-- Success message
DO $$
DECLARE
  badge_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO badge_count FROM badge_definitions;
  RAISE NOTICE '✓ Badge Definitions Table Created';
  RAISE NOTICE '✓ % badges available in the system', badge_count;
END $$;
