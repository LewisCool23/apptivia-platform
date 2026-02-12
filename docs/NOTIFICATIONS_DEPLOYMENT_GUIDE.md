# Enhanced Notification System - Deployment Guide

## 🔔 Overview

The notification system has been completely redesigned with:
- **Database persistence** (not just localStorage)
- **Auto-notifications** when users earn achievements, badges, contest wins
- **29 notification types** (up from 3)
- **Real-time updates** via Supabase subscriptions
- **Priority levels**, deduplication, and auto-expiration
- **Comprehensive admin features**

---

## 📋 What Changed

### Before (Old System)
- ❌ Notifications stored in localStorage only
- ❌ Manually triggered via `addNotification()` calls
- ❌ Only 3 types: 'performance', 'badge', 'achievement'
- ❌ Lost when clearing browser data
- ❌ No centralized management

### After (New System)
- ✅ Stored in Supabase database
- ✅ Auto-triggered by database events (achievements, badges, contests)
- ✅ 29 notification types covering all gamification events
- ✅ Persistent across sessions and devices
- ✅ Admin can query, bulk-manage notifications

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

```bash
# In Supabase SQL Editor, run:
```

1. Open [migrations/024_enhanced_notifications.sql](supabase/migrations/024_enhanced_notifications.sql)
2. Copy entire file contents
3. Paste into Supabase SQL Editor
4. Execute

**Expected Output:**
```
✓ ENHANCED NOTIFICATION SYSTEM DEPLOYED!
✓ Database persistence for notifications
✓ 29 notification types
✓ Auto-notifications enabled
```

### Step 2: Backfill Historical Data (Optional)

```sql
-- Creates notifications for badges/achievements earned in last 30 days
```

1. Open [BACKFILL_NOTIFICATIONS.sql](BACKFILL_NOTIFICATIONS.sql)
2. Copy and run in SQL Editor

**Expected Output:**
```
✓ Backfilled notifications from existing data
→ Badge notifications: ~45
→ Achievement notifications: ~200+
→ Total notifications: ~250+
```

### Step 3: Test the System

```sql
-- Run diagnostic queries
```

1. Open [TEST_NOTIFICATIONS.sql](TEST_NOTIFICATIONS.sql)
2. Run queries one by one to verify:
   - ✅ Triggers are installed
   - ✅ Notifications being created
   - ✅ Unread counts working
   - ✅ Auto-cleanup functions available

### Step 4: Update Frontend (Optional - Advanced)

**Current State**: Frontend still uses localStorage-based notifications (works fine)

**To Enable Database Notifications**:

1. **Update NotificationContext.jsx:**
```jsx
// Replace localStorage logic with database hook
import { useNotificationsDB } from '../hooks/useNotificationsDB';

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
  } = useNotificationsDB(user?.id);
  
  // Rest of component...
}
```

2. **Test Real-Time Updates:**
- Earn an achievement → notification appears instantly
- Earn a badge → notification appears instantly
- Contest ends → winner notifications appear

---

## 📊 Notification Types

### Achievement & Progress (4)
- `achievement_earned` - User earned an achievement
- `achievement_milestone` - Hit 10, 25, 50, 100 achievements
- `level_up` - Apptivia level increased
- `skill_progress` - Made progress in a skillset

### Badges & Rewards (3)
- `badge_earned` - Standard badge awarded
- `rare_badge_earned` - Rare badge awarded (higher priority)
- `badge_milestone` - Hit 5, 10, 25 badges total

### Contests (5)
- `contest_started` - New contest launched
- `contest_ending_soon` - Contest ends in 24 hours
- `contest_winner` - 1st place winner
- `contest_top_3` - 2nd or 3rd place
- `contest_participation` - Contest ended, check results

### Performance (4)
- `scorecard_perfect` - 100%+ scorecard
- `scorecard_high` - 90-99% scorecard
- `scorecard_low` - <70% scorecard (coaching prompt)
- `top_performer` - #1 on leaderboard

### Streaks & Momentum (4)
- `streak_started` - New streak began
- `streak_milestone` - Hit 7, 30, 90 day streak
- `streak_lost` - Streak broken (motivational)
- `momentum_gained` - On a hot streak

### Team & Social (3)
- `team_achievement` - Your team accomplished something
- `team_contest_win` - Your team won contest
- `peer_surpassed` - Helpful competitive nudge

### Coaching & Guidance (2)
- `coaching_suggestion` - Coaching insight available
- `improvement_opportunity` - Area to focus on

### System (3)
- `system_update` - Platform updates
- `integration_sync` - CRM sync status
- `general_info` - General announcements

---

## 🔧 Key Functions

### For Admins

**Get unread count for a user:**
```sql
SELECT get_unread_notification_count('user-uuid-here');
```

**Mark all notifications read for a user:**
```sql
SELECT mark_all_notifications_read('user-uuid-here');
```

**Clean up old notifications:**
```sql
SELECT cleanup_old_notifications(); -- Returns count deleted
```

**Create custom notification:**
```sql
SELECT create_notification(
  p_profile_id := 'user-uuid',
  p_type := 'general_info'::notification_type,
  p_title := 'System Maintenance',
  p_message := 'Platform will be down Saturday 2-3am for upgrades',
  p_icon := '🔧',
  p_color := '#F59E0B',
  p_action_url := '/dashboard',
  p_priority := 8,
  p_dedupe_key := 'maintenance-2026-02-08'
);
```

### For Developers

**Trigger scorecard milestone notification:**
```sql
SELECT check_scorecard_milestones(
  p_profile_id := 'user-uuid',
  p_score := 112.5,
  p_period := 'Week of Feb 3-9'
);
```

**Query notifications by type:**
```sql
SELECT * FROM notifications 
WHERE type = 'badge_earned' 
  AND is_read = FALSE
ORDER BY created_at DESC;
```

---

## 🎯 Auto-Notifications In Action

### Scenario 1: User Earns Achievement
1. User completes KPI threshold (e.g., 25 call connects)
2. `check_and_award_achievements()` runs → inserts into `profile_achievements`
3. **TRIGGER** `trigger_notify_achievement_earned` fires
4. Notification created: "🎯 Achievement Unlocked! You earned '25 Call Connects' in Call Conqueror (+20 pts)"
5. Real-time subscription pushes to user's browser
6. Notification appears in panel instantly

### Scenario 2: User Earns Badge
1. `award_all_badges()` runs → inserts into `profile_badges`
2. **TRIGGER** `trigger_notify_badge_earned` fires
3. Checks if badge is rare → sets priority 9 vs 7
4. Notification created: "🏆 New Badge! You earned the 'Call Pro' badge (+75 pts)"
5. User sees notification

### Scenario 3: Contest Ends
1. Admin marks contest status = 'completed'
2. **TRIGGER** `trigger_notify_contest_winners` fires
3. Top 3 get winner notifications (🥇🥈🥉)
4. All other participants get participation notification
5. Everyone notified instantly

---

## 📈 Performance & Maintenance

### Database Indexes
All critical paths are indexed:
- `profile_id` - Fast user queries
- `type` - Filter by notification type
- `is_read` - Unread counts
- `created_at` - Sorted lists
- `dedupe_key` - Prevent duplicates
- `expires_at` - Auto-cleanup

### Recommended Maintenance

**Daily:** Run cleanup to delete old read notifications
```sql
-- Add to Supabase cron or scheduled function
SELECT cleanup_old_notifications();
```

**Weekly:** Check notification stats
```sql
SELECT type, COUNT(*) as count
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY type
ORDER BY count DESC;
```

**Monthly:** Review unread notifications per user
```sql
SELECT p.email, COUNT(*) as unread
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
WHERE n.is_read = FALSE
GROUP BY p.email
HAVING COUNT(*) > 10
ORDER BY unread DESC;
```

---

## 🎨 Notification Priority Guide

| Priority | Use Case | Examples |
|----------|----------|----------|
| **10** | Critical wins | Contest winner, President's Club |
| **9** | Rare rewards | Rare badges, major milestones |
| **8** | Important updates | Perfect scorecard, system alerts |
| **7** | Standard rewards | Badges, achievements, top 3 |
| **6** | Performance feedback | High scorecard, streak milestones |
| **5** | General info | Contest participation, reminders |
| **4** | Low urgency | Tips, suggestions |
| **3** | Background | Team updates, non-urgent coaching |
| **2** | FYI only | Integration syncs |
| **1** | Noise | Debug/test notifications |

---

## 🔍 Troubleshooting

### Issue: Notifications not appearing after earning achievement

**Check:**
```sql
-- Is trigger enabled?
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_achievement_earned';

-- Did achievement get inserted?
SELECT * FROM profile_achievements 
WHERE profile_id = 'user-uuid'
ORDER BY earned_at DESC
LIMIT 5;

-- Was notification created?
SELECT * FROM notifications
WHERE profile_id = 'user-uuid'
  AND type = 'achievement_earned'
ORDER BY created_at DESC
LIMIT 5;
```

### Issue: Too many notifications

**Solution:** Adjust deduplication
```sql
-- Check for duplicates
SELECT dedupe_key, COUNT(*)
FROM notifications
WHERE dedupe_key IS NOT NULL
GROUP BY dedupe_key
HAVING COUNT(*) > 1;
```

### Issue: Notifications not real-time

**Check:**
1. Real-time enabled in Supabase settings?
2. Browser console for subscription errors?
3. RLS policies allow reading notifications?

---

## ✅ Testing Checklist

- [ ] Run migration 024 successfully
- [ ] Backfill historical notifications
- [ ] Earn an achievement → notification appears
- [ ] Earn a badge → notification appears
- [ ] Mark notification as read → UI updates
- [ ] Mark all as read → all notifications marked
- [ ] Delete notification → removes from database
- [ ] Check unread count accurate
- [ ] Verify triggers installed (`SELECT * FROM information_schema.triggers`)
- [ ] Run test queries from TEST_NOTIFICATIONS.sql

---

## 🎉 Success Criteria

✅ **Database has notifications table** with 29 types
✅ **Triggers installed** for achievements, badges, contests  
✅ **Auto-notifications working** when users earn rewards
✅ **Unread counts accurate** 
✅ **Old notifications cleaned up** via scheduled job
✅ **Frontend shows notifications** (either localStorage or database)

---

## 📚 Next Steps

1. **Phase 1 (Required)**: Run migration 024 ✅
2. **Phase 2 (Optional)**: Backfill historical data
3. **Phase 3 (Advanced)**: Update frontend to use database hook
4. **Phase 4 (Future)**: Add push notifications, email digests

---

## 🆘 Support Files

- [migrations/024_enhanced_notifications.sql](supabase/migrations/024_enhanced_notifications.sql) - Main migration
- [BACKFILL_NOTIFICATIONS.sql](BACKFILL_NOTIFICATIONS.sql) - Historical data backfill
- [TEST_NOTIFICATIONS.sql](TEST_NOTIFICATIONS.sql) - Diagnostic queries
- [src/hooks/useNotificationsDB.ts](src/hooks/useNotificationsDB.ts) - Frontend hook

The notification system is now enterprise-grade with automatic triggering, persistence, and real-time updates! 🚀
