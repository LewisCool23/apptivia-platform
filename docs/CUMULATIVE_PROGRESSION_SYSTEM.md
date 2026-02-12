# Cumulative Progression System

## Overview
The Apptivia Platform now features a **fully cumulative gamification system** where progression never resets. This document explains how activities drive scorecard performance, which earns achievements, builds skillset mastery, and increases Apptivia Levels.

---

## The Apptivia Process Flow

```
Activities (Calls, Emails, Demos)
    ↓
KPI Values (Historical Storage)
    ↓
Achievement Awards (Based on Performance Thresholds)
    ↓
Skillset Mastery Progress (Cumulative Points from Achievements)
    ↓
Apptivia Level (Based on Total Points)
```

---

## 1. Activities → KPI Performance

Users perform sales activities that are tracked via integrations:
- **Call connects** via phone system
- **Meetings booked** via calendar integration
- **Emails sent** via email tracking
- **Opportunities created** via Salesforce/CRM
- **Tasks completed** via task management

These activities populate the `kpi_values` table with weekly performance data. Historical data is stored permanently (never deleted).

---

## 2. KPI Performance → Achievement Awards

### Achievement System
- **100 achievements per skillset** (5 skillsets × 100 = 500 total achievements)
- **Point distribution per skillset:**
  - 33 Easy achievements: **5 points each** = 165 points
  - 33 Medium achievements: **10 points each** = 330 points
  - 34 Hard achievements: **20 points each** = 680 points
  - **Total per skillset: 1,175 points**
  - **Total across all skillsets: 5,875 points**

### Achievement Earning Logic
Achievements are awarded automatically based on KPI performance thresholds:
- **Easy achievements**: Earned when KPI reaches **60% of goal**
- **Medium achievements**: Earned when KPI reaches **80% of goal**
- **Hard achievements**: Earned when KPI reaches **100% of goal or higher**

### How It Works
1. User performs activities → KPI values are recorded
2. Click **"Refresh Achievements"** button on Dashboard
3. System calls `check_and_award_achievements()` function
4. Function scans all profiles' latest KPI performance (past 7 days)
5. Awards new achievements based on thresholds
6. Each achievement is awarded **only once** (permanent record in `profile_achievements` table)

---

## 3. Achievements → Skillset Mastery

### Cumulative Progress Calculation
Skillset mastery is calculated from **total points earned** from achievements:

```
Progress % = (Total Achievement Points Earned / 1,175 max points) × 100
```

Example:
- User earns 10 easy achievements (5 pts each) = 50 points
- User earns 5 medium achievements (10 pts each) = 50 points
- User earns 2 hard achievements (20 pts each) = 40 points
- **Total: 140 points**
- **Progress: 140 / 1,175 = 11.9%**

### Key Features
- ✅ **Never decreases** - once earned, achievements are permanent
- ✅ **Visual progress bars** show 0-100% completion
- ✅ **Next achievement displayed** to guide users toward next goal
- ✅ **Achievements completed counter** shows X / 100 for each skillset

---

## 4. Skillset Mastery → Bonus Points

### Milestone Rewards
When a skillset reaches certain milestones, **bonus points** are awarded to `total_points` (one time only):

| Milestone | Bonus Points | Awarded Once |
|-----------|-------------|--------------|
| 25% Progress | +250 points | ✅ |
| 50% Progress | +500 points | ✅ |
| 75% Progress | +750 points | ✅ |
| 100% Mastery | +1,000 points | ✅ |
| **Total Bonus** | **+2,500 points** | **per skillset** |

### Maximum Possible Points
- Achievement points: **1,175 × 5 skillsets = 5,875 points**
- Milestone bonuses: **2,500 × 5 skillsets = 12,500 points**
- **Grand Total: 18,375 points maximum**

---

## 5. Total Points → Apptivia Level

### Level System
Apptivia Level is determined by cumulative `total_points`:

| Level | Points Required | Icon Color |
|-------|----------------|------------|
| **Bronze** | 0 - 999 | Bronze |
| **Silver** | 1,000 - 2,499 | Silver |
| **Gold** | 2,500 - 4,999 | Gold |
| **Platinum** | 5,000 - 9,999 | Platinum |
| **Diamond** | 10,000+ | Diamond |

### Points Sources
Total points accumulate from:
1. **Achievement points** (5, 10, or 20 pts each)
2. **Skillset milestone bonuses** (250, 500, 750, 1000 pts)

Total points **never decrease** - it's a lifetime cumulative score.

---

## Database Schema

### Key Tables

#### `profile_achievements`
Permanent record of earned achievements:
```sql
- profile_id (UUID)
- achievement_id (UUID)
- completed_at (timestamp)
- points_awarded (integer)
UNIQUE(profile_id, achievement_id) -- Can only earn once
```

#### `profile_skillsets`
Cumulative skillset progress tracking:
```sql
- profile_id (UUID)
- skillset_id (UUID)
- progress (0-100 percentage)
- achievements_completed (count)
- total_points_earned (cumulative points from achievements)
- milestone_25_reached (boolean)
- milestone_50_reached (boolean)
- milestone_75_reached (boolean)
- milestone_100_reached (boolean)
```

#### `profiles`
User totals for Apptivia Level:
```sql
- total_points (cumulative lifetime points)
- apptivia_level (Bronze/Silver/Gold/Platinum/Diamond)
```

---

## Key Functions

### `check_and_award_achievements()`
**Purpose**: Scans all profiles and awards new achievements based on recent KPI performance.

**Usage**:
```sql
SELECT check_and_award_achievements();
```

**Returns**: Integer count of achievements awarded.

**Called by**: Dashboard "Refresh Achievements" button.

---

### `award_achievement(profile_id, achievement_id)`
**Purpose**: Awards a single achievement to a profile.

**Process**:
1. Check if already earned (skip if yes)
2. Insert into `profile_achievements`
3. Add achievement points to `total_points`
4. Recalculate skillset progress
5. Check and award milestone bonuses
6. Update Apptivia Level

**Returns**: Boolean (TRUE if awarded, FALSE if already earned).

---

### `calculate_skillset_progress(profile_id, skillset_id)`
**Purpose**: Recalculates skillset progress percentage from earned achievements.

**Returns**: Numeric progress percentage (0-100).

**Updates**: `profile_skillsets` record with new progress, achievement count, and points total.

---

### `award_skillset_milestone_points(profile_id, skillset_id, new_progress)`
**Purpose**: Awards bonus points when skillset reaches 25%, 50%, 75%, or 100% (one time per milestone).

**Bonus Awards**:
- 25% → +250 pts
- 50% → +500 pts
- 75% → +750 pts
- 100% → +1,000 pts

---

### `update_apptivia_level(profile_id)`
**Purpose**: Updates user's Apptivia Level based on current `total_points`.

**Returns**: New level name (Bronze/Silver/Gold/Platinum/Diamond).

---

## User Experience

### Dashboard "Refresh Achievements" Button
Located in the **Actions dropdown** on the Dashboard page:
1. User clicks "Refresh Achievements"
2. System shows loading state: "Refreshing..."
3. Backend calls `check_and_award_achievements()`
4. Toast notification displays results:
   - Success: "3 new achievements awarded!"
   - Info: "No new achievements earned yet. Keep pushing!"
   - Error: "Failed to refresh achievements"
5. Dashboard data automatically refreshes

### What Users See
- **Skillset progress bars** showing 0-100% completion
- **Achievement counters** (e.g., "23 / 100 completed")
- **Next achievement description** to guide progression
- **Apptivia Level badge** (Bronze/Silver/Gold/Platinum/Diamond)
- **Total points display** showing lifetime cumulative score

---

## Migration Details

### Migration 013: `013_cumulative_progression_system.sql`

**What it does**:
1. Creates/ensures `profile_achievements` table exists
2. Adds milestone tracking columns to `profile_skillsets`
3. Creates all progression calculation functions
4. Initializes `profile_skillsets` for all profiles × skillsets
5. Recalculates all existing progress from historical data
6. Updates all Apptivia Levels based on current `total_points`

**Safe to run**: Uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` to prevent duplicates.

---

## Frontend Changes

### `src/hooks/useCoachData.ts`
**Changed**: Replaced dynamic KPI-based skillset calculation with persistent database queries.

**Before**: Calculated progress from live KPI percentages (fluctuated up/down).

**After**: Fetches cumulative progress from `profile_skillsets` table (never decreases).

### `src/ApptiviaScorecard.tsx`
**Added**:
- `isRefreshing` state
- `handleRefreshAchievements()` function
- "Refresh Achievements" action in PageActionBar dropdown

---

## Testing & Verification

### Manual Test Steps
1. **Check Initial State**:
   ```sql
   SELECT id, first_name, total_points, apptivia_level FROM profiles;
   SELECT profile_id, skillset_id, progress, achievements_completed 
   FROM profile_skillsets WHERE profile_id = '<user_id>';
   ```

2. **Award Achievements**:
   ```sql
   SELECT check_and_award_achievements();
   ```

3. **Verify Awards**:
   ```sql
   SELECT COUNT(*) FROM profile_achievements WHERE profile_id = '<user_id>';
   SELECT progress, achievements_completed, total_points_earned
   FROM profile_skillsets WHERE profile_id = '<user_id>';
   ```

4. **Check Level Update**:
   ```sql
   SELECT total_points, apptivia_level FROM profiles WHERE id = '<user_id>';
   ```

5. **Test UI**: Click "Refresh Achievements" button on Dashboard and verify toast notifications.

---

## Best Practices

### For Admins
- Run `check_and_award_achievements()` on a schedule (daily or weekly)
- Monitor achievement distribution to ensure fair earning rates
- Adjust KPI thresholds in function if needed (currently 60%, 80%, 100%)

### For Users
- Click "Refresh Achievements" after completing major activities
- Focus on KPIs that align with specific skillsets for targeted progress
- Check Coach page to see skillset progress and next achievements

---

## Troubleshooting

### "No new achievements earned yet"
- Ensure KPI values are being recorded in `kpi_values` table
- Check if recent performance (past 7 days) meets thresholds (60%, 80%, 100% of goal)
- Verify `kpi_metrics` table has correct goals configured

### Skillset progress not updating
- Run `SELECT calculate_skillset_progress('<profile_id>', '<skillset_id>');` manually
- Check `profile_achievements` table for earned achievements
- Verify achievements exist for that skillset in `achievements` table

### Apptivia Level not changing
- Check `total_points` value: `SELECT total_points FROM profiles WHERE id = '<user_id>';`
- Run `SELECT update_apptivia_level('<profile_id>');` manually
- Verify thresholds: Bronze (0), Silver (1000), Gold (2500), Platinum (5000), Diamond (10000)

---

## Future Enhancements

### Potential Additions
1. **Achievement Categories**: Group achievements by activity type (calls, emails, pipeline)
2. **Leaderboards**: Rank users by total_points or skillset mastery
3. **Achievement Notifications**: Push notifications when new achievements are earned
4. **Custom Thresholds**: Per-team or per-role achievement difficulty settings
5. **Achievement Badges**: Visual badges for special achievements
6. **Streak Bonuses**: Extra points for consecutive weeks of high performance
7. **Team Achievements**: Collaborative achievements that require team effort

---

## Summary

The cumulative progression system ensures that **all progress is permanent** and **never resets**. Users continuously build their Apptivia Level through consistent performance, creating a true reflection of their long-term productivity and growth.

**Key Principle**: Activities → KPIs → Achievements → Skillsets → Level → **Cumulative, Never Decreasing**
