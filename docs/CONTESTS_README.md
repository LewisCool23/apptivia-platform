# Contests & Gamification System

Complete gamification infrastructure for competitive team engagement in the Apptivia Platform.

## 🎯 Features

### 1. **Contest Management**
- Create custom contests based on any KPI metric
- Support for individual, team, and department competitions
- Flexible date ranges (daily, weekly, monthly, quarterly)
- Multiple calculation types: sum, average, max, count
- Customizable rewards: gift cards, bonuses, trophies, PTO, team events

### 2. **Live Leaderboards**
- Real-time rankings calculated from KPI data
- Visual rank change indicators (⬆️ up, ⬇️ down, 🆕 new)
- Top 10 display with expandable full leaderboard
- User's current position highlighted
- Participant count and days remaining

### 3. **Badge System**
- **Contest Badges**: 🥇 🥈 🥉 for top 3 finishers
- **Achievement Badges**: ⭐ for completing skillset achievements
- **Milestone Badges**: 🎖️ for streaks, levels, special accomplishments
- Featured badge system for highlighting top awards
- Display on profile page and leaderboards

### 4. **Enrollment System**
- Auto-enrollment for all active team members
- Opt-in/opt-out functionality
- Participation tracking across multiple contests
- Team-based contest support

## 📁 File Structure

```
supabase/migrations/
  └── 005_contests_and_badges.sql       # Database schema

src/
  ├── hooks/
  │   └── useContests.ts                # Contest data fetching hook
  ├── components/
  │   └── ContestCreationModal.tsx      # Manager UI for creating contests
  ├── pages/
  │   ├── Contests.jsx                  # Main contests page with leaderboards
  │   └── Profile.jsx                   # Profile page with badges display
  └── utils/
      └── contestUtils.ts               # Leaderboard calculation utilities
```

## 🗄️ Database Schema

### Tables

1. **contest_templates**
   - Reusable contest types
   - Pre-configured KPI metrics and calculation methods
   - 7 default templates included

2. **active_contests**
   - Running contest instances
   - Status: active, upcoming, completed, cancelled
   - Date ranges, rewards, participant types

3. **contest_participants**
   - Enrollment tracking
   - Team associations
   - Active/inactive status

4. **contest_leaderboards**
   - Cached rankings for performance
   - Real-time score updates
   - Rank change tracking

5. **profile_badges**
   - Award history
   - Badge metadata (icon, color, description)
   - Links to contests/achievements

## 🚀 Usage

### Creating a Contest (Manager)

1. Navigate to Contests page
2. Click "Create Contest" button
3. Fill in contest details:
   - Name and description
   - Select KPI to track
   - Choose calculation method (sum, average, max, count)
   - Set start and end dates
   - Define reward type and value
   - Select participant type (individual/team/department)
4. Click "Create Contest"
5. All active team members auto-enrolled

### Viewing Leaderboards

1. Active contests show "View Leaderboard" button
2. Click to expand live rankings
3. See current standings with rank changes
4. Your position highlighted in blue
5. Top 3 shown with medal emojis 🥇🥈🥉

### Earning Badges

**Contest Badges:**
- Automatically awarded when contest completes
- Top 3 finishers receive gold, silver, bronze badges
- 1st place badge is "featured" on profile

**Achievement Badges:**
- Use `awardAchievementBadge()` utility function
- Linked to skillset achievements
- Displayed in profile badges section

**Milestone Badges:**
- Use `awardMilestoneBadge()` utility function
- Custom icon and color
- Examples: "7-Day Streak", "Level 10", "100 Calls"

## ⚙️ Leaderboard Updates

### Automatic Updates
Database trigger recalculates leaderboards when:
- New KPI values are recorded
- Contest participants change
- Contest status changes

### Manual Updates
```javascript
import { updateAllContestLeaderboards, updateContestLeaderboard } from './utils/contestUtils';

// Update all active contests
await updateAllContestLeaderboards();

// Update specific contest
await updateContestLeaderboard(contestId);
```

### Scheduled Updates
Recommended: Run `updateAllContestLeaderboards()` every 15 minutes via cron job or scheduled function.

## 🎨 UI Components

### Contest Card
- Status badge (Active/Upcoming/Completed)
- Participant count
- Days remaining/starts in
- Current leader and score
- Reward information
- Enrollment button
- Leaderboard toggle

### Leaderboard Entry
- Rank (medals for top 3, numbers for others)
- Profile name and team
- Rank change indicator
- Current score
- Highlight for current user

### Badge Display
- Grid layout (responsive)
- Featured badges highlighted
- Icon, name, description
- Associated contest/achievement
- Earned date
- Color-coded borders

## 📊 Sample Data

Migration includes:
- 3 sample contests (active, upcoming, completed)
- Auto-enrollment for existing profiles
- Initial leaderboard calculations
- Sample badges for completed contest

## 🔧 Configuration

### Contest Templates
Edit `contest_templates` table to add new pre-configured contest types:
```sql
INSERT INTO contest_templates (name, description, kpi_key, calculation_type, icon)
VALUES ('Revenue Race', 'Highest revenue generated', 'revenue', 'sum', '💵');
```

### Reward Types
Supported values:
- `gift_card`: Gift cards (Amazon, Visa, etc.)
- `bonus`: Cash bonuses
- `trophy`: Physical trophies/plaques
- `team_lunch`: Team celebration events
- `pto`: Paid time off days
- `custom`: Custom rewards

### Calculation Types
- `sum`: Total of all values (e.g., total calls)
- `average`: Mean value (e.g., average close rate)
- `max`: Highest single value (e.g., biggest deal)
- `count`: Number of activities (e.g., number of demos)

## 🎯 Business Value

1. **Increased Motivation**: Gamification drives 30-40% improvement in engagement
2. **Healthy Competition**: Leaderboards foster peer accountability
3. **Clear Goals**: Contests focus team effort on specific KPIs
4. **Recognition**: Badges provide lasting recognition for achievements
5. **Data-Driven**: Real-time KPI tracking ensures fairness and transparency
6. **Flexibility**: Managers can create custom contests for any metric
7. **Retention**: Gamification improves employee satisfaction and retention

## 🔄 Real-Time Updates

The system uses Supabase real-time subscriptions for:
- Live leaderboard updates
- Contest enrollment changes
- New badge awards
- Status changes (active → completed)

Subscribe to updates in components:
```javascript
const { data, loading, refetch } = useContests(userId);

// Refetch on demand
refetch();
```

## 🚨 Important Notes

1. **Migration Required**: Run `005_contests_and_badges.sql` before using
2. **Auto-Enrollment**: New team members automatically join active contests
3. **Badge Awards**: Top 3 finishers receive badges when contest completes
4. **Leaderboard Cache**: Rankings cached for performance, updated periodically
5. **Permissions**: Only managers should access contest creation modal
6. **Data Integrity**: Contest dates validated (end > start)

## 📈 Future Enhancements

- [ ] Team vs team competitions
- [ ] Multi-contest tournaments
- [ ] Social sharing of badges
- [ ] Contest history analytics
- [ ] Automated contest scheduling
- [ ] Integration with Slack/Teams for notifications
- [ ] Contest insights dashboard for managers
- [ ] Customizable badge designs
- [ ] Leaderboard widgets for digital signage

## 🎓 Related Documentation

- [KPI System Documentation](../README.md)
- [Coach Page & Achievements](../INTEGRATION_GUIDE.md)
- [Database Schema](../supabase/migrations/)
- [API Reference](../QUICK_REFERENCE.md)
