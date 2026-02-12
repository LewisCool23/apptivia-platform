-- =============================================================================
-- MIGRATION 022: Enhanced Badge System - Add Progression & Engagement Badges
-- =============================================================================
-- Purpose: Expand badge system with better progression and engagement
-- Addresses:
--   1. More mid-tier badges for better progression
--   2. Cross-category combo badges
--   3. Fun/creative engagement badges
--   4. Activity-specific badges for different KPIs
-- =============================================================================

-- =============================================================================
-- CATEGORY 1: MID-TIER ACHIEVEMENT BADGES (Better Progression)
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('achievement_milestone', 'First Steps', 'Completed your first 5 achievements', '👣', '#4CAF50', 'achievement_count', 5, 25, false),
('achievement_milestone', 'Rising Achiever', 'Completed 15 achievements', '🌟', '#4CAF50', 'achievement_count', 15, 75, false),
('achievement_milestone', 'Achievement Pro', 'Completed 35 achievements', '⭐', '#4CAF50', 'achievement_count', 35, 200, false),
('achievement_milestone', 'Achievement Elite', 'Completed 75 achievements', '💫', '#4CAF50', 'achievement_count', 75, 450, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 2: CONTEST PARTICIPATION BADGES (Not Just Winners)
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('contest_participation', 'Contest Rookie', 'Participated in your first contest', '🎯', '#FF9800', 'manual', 1, 20, false),
('contest_participation', 'Contest Veteran', 'Participated in 5 contests', '🎪', '#FF9800', 'manual', 5, 75, false),
('contest_participation', 'Contest Regular', 'Participated in 10 contests', '🎭', '#FF9800', 'manual', 10, 150, false),
('contest_participation', 'Contest Enthusiast', 'Participated in 25 contests', '🎬', '#FF9800', 'manual', 25, 300, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 3: CROSS-CATEGORY COMBO BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('combo', 'Triple Threat', 'Won a contest, earned 25+ achievements, and achieved a perfect scorecard', '🔥', '#E91E63', 'manual', NULL, 500, true),
('combo', 'All-Rounder', 'Progress in all 6 skillsets with 10+ achievements each', '🎯', '#E91E63', 'manual', NULL, 400, true),
('combo', 'Power User', 'Earned 50+ achievements and 2000+ total points', '⚡', '#E91E63', 'manual', NULL, 350, true),
('combo', 'Consistency Master', '5 perfect scorecards and 10+ achievements in one month', '📊', '#E91E63', 'manual', NULL, 450, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 4: TIME-BASED MILESTONE BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('milestone', 'First Day', 'Completed your first day on the platform', '🌅', '#00BCD4', 'manual', 1, 10, false),
('milestone', 'First Week', 'Active for your first week', '📅', '#00BCD4', 'manual', 7, 25, false),
('milestone', 'First Month', 'Active for your first month', '📆', '#00BCD4', 'manual', 30, 75, false),
('milestone', '100 Days Strong', 'Been active for 100 days', '💪', '#00BCD4', 'manual', 100, 200, true),
('milestone', 'One Year Anniversary', 'Celebrating one year on the platform', '🎂', '#00BCD4', 'manual', 365, 500, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 5: ACTIVITY VOLUME BADGES (Specific KPIs)
-- =============================================================================

-- Call Volume Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('volume', 'Call Starter', 'Made 50 call connects', '📞', '#3F51B5', 'manual', 50, 30, false),
('volume', 'Call Pro', 'Made 100 call connects', '☎️', '#3F51B5', 'manual', 100, 75, false),
('volume', 'Call Champion', 'Made 250 call connects', '📱', '#3F51B5', 'manual', 250, 150, false),
('volume', 'Call Legend', 'Made 500 call connects', '🎙️', '#3F51B5', 'manual', 500, 300, true),
('volume', 'Call Deity', 'Made 1000 call connects', '👑', '#3F51B5', 'manual', 1000, 750, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Email Volume Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('volume', 'Email Starter', 'Sent 100 personalized emails', '✉️', '#9C27B0', 'manual', 100, 30, false),
('volume', 'Email Pro', 'Sent 250 personalized emails', '📧', '#9C27B0', 'manual', 250, 75, false),
('volume', 'Email Champion', 'Sent 500 personalized emails', '📬', '#9C27B0', 'manual', 500, 150, false),
('volume', 'Email Legend', 'Sent 1000 personalized emails', '📮', '#9C27B0', 'manual', 1000, 300, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Meeting Volume Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('volume', 'Meeting Starter', 'Booked 10 meetings', '🗓️', '#FF5722', 'manual', 10, 40, false),
('volume', 'Meeting Pro', 'Booked 25 meetings', '📋', '#FF5722', 'manual', 25, 100, false),
('volume', 'Meeting Champion', 'Booked 50 meetings', '📝', '#FF5722', 'manual', 50, 200, false),
('volume', 'Meeting Legend', 'Booked 100 meetings', '🎯', '#FF5722', 'manual', 100, 400, true)
ON CONFLICT (badge_name) DO NOTHING;

-- Pipeline Badges
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('volume', 'Pipeline Builder', 'Created 10 qualified opportunities', '🔧', '#009688', 'manual', 10, 50, false),
('volume', 'Pipeline Architect', 'Created 25 qualified opportunities', '🏗️', '#009688', 'manual', 25, 125, false),
('volume', 'Pipeline Master', 'Created 50 qualified opportunities', '🏛️', '#009688', 'manual', 50, 250, true),
('volume', 'Pipeline Titan', 'Created 100 qualified opportunities', '🌉', '#009688', 'manual', 100, 500, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 6: IMPROVEMENT & MOMENTUM BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('improvement', 'On Fire', 'Earned 5 achievements in one week', '🔥', '#FF6F00', 'manual', NULL, 100, false),
('improvement', 'Speed Demon', 'Earned 10 achievements in one week', '⚡', '#FF6F00', 'manual', NULL, 250, true),
('improvement', 'Unstoppable Force', 'Earned 20 achievements in one month', '💥', '#FF6F00', 'manual', NULL, 500, true),
('improvement', 'Comeback Kid', 'Improved scorecard by 30%+ in one period', '📈', '#FF6F00', 'manual', NULL, 200, false),
('improvement', 'Phoenix Rising', 'Went from bottom 25% to top 25% in performance', '🔥', '#FF6F00', 'manual', NULL, 400, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 7: TEAM & COLLABORATION BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('team', 'Helpful Hand', 'Assisted 3 team members with their goals', '🤝', '#607D8B', 'manual', 3, 50, false),
('team', 'Mentor', 'Helped 5 team members improve their performance', '🎓', '#607D8B', 'manual', 5, 150, false),
('team', 'Team Champion', 'Your team won a team-based contest', '👥', '#607D8B', 'manual', NULL, 200, false),
('team', 'Culture Builder', 'Recognized for exceptional team collaboration', '🌟', '#607D8B', 'manual', NULL, 300, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 8: FUN & CREATIVE BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('fun', 'Early Bird', 'First to hit scorecard goal 5 weeks in a row', '🌅', '#FFC107', 'manual', NULL, 100, false),
('fun', 'Night Owl', 'Completed activity after 8pm for 10 consecutive days', '🦉', '#FFC107', 'manual', NULL, 75, false),
('fun', 'Weekend Warrior', 'Logged activity on 10 weekends', '⚔️', '#FFC107', 'manual', NULL, 150, false),
('fun', 'Lucky Streak', 'Hit exactly 100% scorecard 7 times', '🍀', '#FFC107', 'manual', NULL, 200, true),
('fun', 'Overachiever', 'Exceeded 150%+ on scorecard', '🚀', '#FFC107', 'manual', NULL, 250, true),
('fun', 'Jack of All Trades', 'Earned at least 1 achievement in all 6 skillsets', '🎭', '#FFC107', 'manual', NULL, 175, false)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- CATEGORY 9: REVENUE & RESULTS BADGES
-- =============================================================================
INSERT INTO badge_definitions (badge_type, badge_name, badge_description, icon, color, criteria_type, criteria_value, points, is_rare) VALUES
('revenue', 'First Deal', 'Closed your first deal', '💰', '#4CAF50', 'manual', 1, 100, false),
('revenue', 'Deal Maker', 'Closed 5 deals', '💵', '#4CAF50', 'manual', 5, 250, false),
('revenue', 'Deal Closer', 'Closed 10 deals', '💸', '#4CAF50', 'manual', 10, 500, false),
('revenue', 'Revenue Driver', 'Generated over 100,000 in revenue', '🏆', '#4CAF50', 'manual', 100000, 400, true),
('revenue', 'Revenue Champion', 'Generated over 500,000 in revenue', '👑', '#4CAF50', 'manual', 500000, 1000, true),
('revenue', 'Presidents Club', 'Top revenue performer for the quarter', '⭐', '#4CAF50', 'manual', NULL, 1500, true)
ON CONFLICT (badge_name) DO NOTHING;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
DO $$
DECLARE
  new_badges_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO new_badges_count FROM badge_definitions;
  
  RAISE NOTICE '';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '✓ ENHANCED BADGE SYSTEM DEPLOYED!';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'NEW BADGE CATEGORIES ADDED:';
  RAISE NOTICE '  1. 📈 Mid-Tier Achievement Badges (4) - Better progression';
  RAISE NOTICE '  2. 🎪 Contest Participation (4) - Not just winners';
  RAISE NOTICE '  3. 🔥 Cross-Category Combos (4) - Multi-skill achievements';
  RAISE NOTICE '  4. 📅 Time-Based Milestones (5) - Platform longevity';
  RAISE NOTICE '  5. 📊 Activity Volume (17) - Specific KPI goals';
  RAISE NOTICE '  6. ⚡ Improvement & Momentum (5) - Growth recognition';
  RAISE NOTICE '  7. 👥 Team & Collaboration (4) - Helping others';
  RAISE NOTICE '  8. 🎭 Fun & Creative (6) - Engagement & personality';
  RAISE NOTICE '  9. 💰 Revenue & Results (6) - Business outcomes';
  RAISE NOTICE '';
  RAISE NOTICE 'TOTAL BADGE COUNT: % badges', new_badges_count;
  RAISE NOTICE '';
  RAISE NOTICE 'NEW FEATURES:';
  RAISE NOTICE '  ✓ Better progression ladder (5→10→15→25→35→50→75→100)';
  RAISE NOTICE '  ✓ Combo badges reward multi-dimensional excellence';
  RAISE NOTICE '  ✓ Volume badges for call, email, meeting, pipeline activities';
  RAISE NOTICE '  ✓ Improvement badges recognize growth & momentum';
  RAISE NOTICE '  ✓ Team badges encourage collaboration';
  RAISE NOTICE '  ✓ Fun badges add personality & engagement';
  RAISE NOTICE '  ✓ Revenue badges align with business goals';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Create auto-awarding functions for volume badges';
  RAISE NOTICE '  2. Implement improvement tracking for momentum badges';
  RAISE NOTICE '  3. Set up team collaboration tracking';
  RAISE NOTICE '  4. Link revenue badges to CRM data';
  RAISE NOTICE '';
  RAISE NOTICE 'To see all badges: SELECT * FROM badge_definitions ORDER BY badge_type, criteria_value;';
  RAISE NOTICE '═════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
