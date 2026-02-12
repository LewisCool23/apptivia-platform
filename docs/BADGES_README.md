# Badges System Documentation

## Overview

The badges system is a comprehensive gamification feature that rewards users for various accomplishments including contest wins, achievement completions, KPI streaks, and perfect scorecards. Badges are displayed on user profiles and serve as visual recognition of their efforts.

## Database Structure

### Tables

#### `badge_definitions`
Stores metadata for all available badge types:
- **badge_type**: Category of badge ('contest_winner', 'achievement_milestone', 'kpi_streak', 'scorecard', 'special')
- **badge_name**: Unique name of the badge
- **badge_description**: Description of how to earn the badge
- **icon**: Emoji or icon character
- **color**: Hex color code for badge styling
- **criteria_type**: How the badge is earned
- **criteria_value**: Threshold value for earning
- **points**: Points awarded with the badge
- **is_rare**: Whether the badge is rare/special

#### `profile_badges`
Stores earned badges for each user:
- **profile_id**: User who earned the badge
- **badge_type**: Type of badge earned
- **badge_name**: Name of the badge
- **badge_description**: Context-specific description
- **icon**: Badge icon
- **color**: Badge color
- **contest_id**: Link to contest (if applicable)
- **achievement_id**: Link to achievement (if applicable)
- **earned_at**: When the badge was earned
- **is_featured**: Whether to display prominently

## Badge Categories

### 1. Contest Winner Badges 🏆
Awarded for winning or placing in contests:
- **1st Contest Winner** - Won your first contest (🏆, Gold)
- **3x Contest Winner** - Won 3 contests (🥇, Gold)
- **5x Contest Winner** - Won 5 contests (👑, Gold)
- **Contest Champion** - Won 10 contests (⭐, Gold, Featured)
- **Silver Medalist** - Finished 2nd in a contest (🥈, Silver)
- **Bronze Medalist** - Finished 3rd in a contest (🥉, Bronze)
- **Podium Finisher** - Top 3 in 5 contests (🎯, Red)

### 2. Achievement Milestone Badges 🎖️
Awarded for completing achievements:
- **Achievement Hunter** - Completed 10 achievements (🎖️, Green)
- **Achievement Master** - Completed 25 achievements (🏅, Green)
- **Achievement Legend** - Completed 50 achievements (💎, Green, Rare)
- **Achievement God** - Completed 100 achievements (👼, Green, Featured)
- **Full Skillset** - Completed all achievements in one skillset (🌟, Purple, Rare)

### 3. KPI Streak Badges 🔥
Awarded for maintaining consistent KPI performance:
- **5-Day KPI Streak** - Met all KPIs for 5 consecutive days (🔥, Orange)
- **10-Day KPI Streak** - Met all KPIs for 10 consecutive days (🚀, Orange)
- **30-Day KPI Streak** - Met all KPIs for 30 consecutive days (⚡, Orange, Rare)
- **90-Day KPI Streak** - Met all KPIs for 90 consecutive days (🌪️, Orange, Rare)
- **Unstoppable** - Met all KPIs for 180 consecutive days (💥, Orange, Featured)

### 4. Scorecard Badges 💯
Awarded for perfect weekly scorecards:
- **1st 100% Weekly Scorecard** - First perfect weekly scorecard (💯, Blue)
- **5x Perfect Scorecards** - Achieved 5 perfect weekly scorecards (✨, Blue)
- **10x Perfect Scorecards** - Achieved 10 perfect weekly scorecards (🎪, Blue, Rare)
- **Perfect Month** - All scorecards perfect for an entire month (📊, Blue, Rare)
- **Consistency King** - Maintained 90%+ scorecard average for 12 weeks (👔, Blue, Rare)

### 5. Special Badges ⭐
Manually awarded by administrators:
- **Early Adopter** - One of the first users (🌱, Brown, Rare)
- **Team Player** - Helped 10 team members (🤝, Gray)
- **Rising Star** - Fastest improvement (⭐, Yellow, Rare)
- **Department MVP** - Top department performer (💼, Teal, Rare)
- **Coaching Champion** - Completed 50 coaching sessions (🎓, Purple)

## Badge Awarding Functions

### `award_contest_badges()`
Automatically awards badges when contests are completed:
- Awards 1st, 2nd, and 3rd place badges
- Tracks multiple wins for milestone badges
- Called when contest status changes to 'completed'

### `award_achievement_badges()`
Automatically awards badges based on achievement counts:
- Checks total achievements completed across all skillsets
- Awards milestone badges at 10, 25, 50, 100 achievements
- Awards "Full Skillset" badge when all 100 achievements in a skillset are completed

### `award_streak_badges()`
Automatically awards badges based on KPI streaks:
- Reads `day_streak` from profiles table
- Awards badges at 5, 10, 30, 90, 180 day milestones
- Updates automatically when streak increases

### `award_scorecard_badges()`
Placeholder for scorecard-based badges:
- Will award badges for perfect weekly scorecards
- Requires scorecard tracking table implementation

### `award_all_badges()`
Master function that runs all badge awarding logic:
- Executes all badge awarding functions
- Can be called manually or via scheduled job
- Idempotent - won't duplicate badges

## Usage

### Running Badge Award Functions

To manually award all badges (useful after migrations or data imports):

```sql
SELECT award_all_badges();
```

To award specific badge types:

```sql
SELECT award_contest_badges();
SELECT award_achievement_badges();
SELECT award_streak_badges();
```

### Manually Awarding Special Badges

Special badges are awarded manually by inserting into `profile_badges`:

```sql
INSERT INTO profile_badges (
  profile_id, 
  badge_type, 
  badge_name, 
  badge_description, 
  icon, 
  color, 
  is_featured
)
SELECT 
  'user-uuid-here',
  bd.badge_type,
  bd.badge_name,
  bd.badge_description,
  bd.icon,
  bd.color,
  true
FROM badge_definitions bd
WHERE bd.badge_name = 'Department MVP';
```

### Viewing User Badges

Query to see all badges for a user:

```sql
SELECT 
  pb.*,
  ac.name as contest_name,
  a.name as achievement_name
FROM profile_badges pb
LEFT JOIN active_contests ac ON pb.contest_id = ac.id
LEFT JOIN achievements a ON pb.achievement_id = a.id
WHERE pb.profile_id = 'user-uuid-here'
ORDER BY pb.is_featured DESC, pb.earned_at DESC;
```

## Profile Page Display

The Profile page displays badges and achievements in two sections:

### Badges Grid
- Shows all earned badges in a responsive grid
- Featured badges have special styling (gold gradient)
- Displays badge icon, name, description, and earned date
- Shows associated contest or achievement name
- "Show All" button appears when user has more than 8 badges

### Skillset Progress
- Shows progress in each of the 5 skillsets
- Displays completion percentage and achievement count
- Shows next milestone for each skillset
- Color-coded progress bars matching skillset colors
- "Show All" button appears when user has more than 3 skillsets

## Integration Points

### Automated Badge Awarding

Badges can be automatically awarded by:

1. **Contest Completion Trigger**: When a contest is marked as completed, call `award_contest_badges()`
2. **Achievement Updates**: When profile_skillsets is updated, call `award_achievement_badges()`
3. **Daily Cron Job**: Run `award_all_badges()` daily to catch any missed awards
4. **Real-time Updates**: Use database triggers to award badges immediately when conditions are met

### Recommended Triggers

```sql
-- Trigger to award badges when contests complete
CREATE OR REPLACE FUNCTION trigger_award_contest_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    PERFORM award_contest_badges();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contest_completion_badges
AFTER UPDATE ON active_contests
FOR EACH ROW
EXECUTE FUNCTION trigger_award_contest_badges();

-- Trigger to award badges when achievements increase
CREATE OR REPLACE FUNCTION trigger_award_achievement_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.achievements_completed > OLD.achievements_completed THEN
    PERFORM award_achievement_badges();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER achievement_progress_badges
AFTER UPDATE ON profile_skillsets
FOR EACH ROW
EXECUTE FUNCTION trigger_award_achievement_badges();

-- Trigger to award badges when streaks increase
CREATE OR REPLACE FUNCTION trigger_award_streak_badges()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.day_streak > OLD.day_streak THEN
    PERFORM award_streak_badges();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER streak_badges
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_award_streak_badges();
```

## Future Enhancements

1. **Scorecard Tracking**: Implement scorecard tracking table and complete `award_scorecard_badges()`
2. **Badge Notifications**: Add real-time notifications when badges are earned
3. **Badge Collections**: Group badges into collections or seasons
4. **Leaderboards**: Create badge leaderboards showing users with most/rarest badges
5. **Social Sharing**: Allow users to share earned badges
6. **Badge Tiers**: Add bronze/silver/gold tiers for each badge type
7. **Time-Limited Badges**: Create special event badges available for limited time
8. **Team Badges**: Add badges earned as a team vs individual

## Troubleshooting

### Badges Not Appearing

1. Check if migration 008 has been run: `SELECT * FROM badge_definitions;`
2. Verify badge awarding functions exist: `\df award_*`
3. Run badge awarding manually: `SELECT award_all_badges();`
4. Check for errors in profile_badges table: `SELECT * FROM profile_badges WHERE profile_id = 'user-id';`

### Duplicate Badges

The badge awarding functions include checks to prevent duplicates:
- `NOT EXISTS` clauses ensure badges aren't awarded twice
- Run `award_all_badges()` safely - it won't create duplicates

### Performance Issues

If badge awarding is slow:
1. Ensure indexes exist on profile_badges (profile_id, earned_at)
2. Consider running badge awards in background job
3. Batch process badge awards for large user bases
4. Cache badge counts in profile table

## Testing

To test the badge system:

```sql
-- 1. Check badge definitions loaded
SELECT COUNT(*) FROM badge_definitions;
-- Should return ~30 badge types

-- 2. Award badges to test user
SELECT award_all_badges();

-- 3. Verify badges were created
SELECT COUNT(*) FROM profile_badges;

-- 4. Check specific user's badges
SELECT * FROM profile_badges 
WHERE profile_id = 'test-user-id'
ORDER BY earned_at DESC;
```
