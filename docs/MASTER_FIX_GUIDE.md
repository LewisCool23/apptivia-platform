# 🚀 MASTER FIX GUIDE: Achievement Data Not Showing

## Start Here

Your profile and coach pages show 0 data because the database hasn't been set up with the cumulative progression system yet.

---

## Step 1: Check Your Database Status (30 seconds)

Run this in Supabase SQL Editor:

```sql
-- Quick status check
SELECT 
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_name = 'check_and_award_achievements') as functions_exist,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'profile_skillsets' 
   AND column_name = 'total_points_earned') as columns_exist,
  (SELECT COUNT(*) FROM profile_skillsets) as records_exist;
```

**Read the results:**
- `functions_exist = 0` → Go to **Path A** (Full Setup)
- `functions_exist = 1, columns_exist = 0` → Go to **Path B** (Add Columns)
- `functions_exist = 1, columns_exist = 1, records_exist = 0` → Go to **Path C** (Initialize Only)
- `functions_exist = 1, columns_exist = 1, records_exist > 0` → Go to **Path D** (Award Achievements)

---

## Path A: Full Setup (Functions Don't Exist)

**Time**: 5 minutes  
**You need**: Migration 013 has never been run

### What to do:
1. Open Supabase SQL Editor
2. Load file: `supabase/migrations/013_cumulative_progression_system.sql`
3. Click "Run"
4. Wait 30-60 seconds for completion
5. Go to **Path D** to award achievements

**This creates**:
- All 5 progression functions
- profile_achievements table
- All necessary columns in profile_skillsets
- Initializes all records
- Sets up triggers and constraints

**Next**: Skip to Path D

---

## Path B: Add Missing Columns

**Time**: 2 minutes  
**You need**: Functions exist but columns are missing

### Run this script:
```sql
-- Add missing columns to profile_skillsets
ALTER TABLE public.profile_skillsets
  ADD COLUMN IF NOT EXISTS total_points_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_25_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_50_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_75_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_100_reached boolean DEFAULT FALSE;
```

**Next**: Go to Path C

---

## Path C: Initialize Records

**Time**: 1 minute  
**You need**: Columns exist but no records

### Run this script:
```sql
DO $$
DECLARE
  profile_record RECORD;
  skillset_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM profiles LOOP
    FOR skillset_record IN SELECT id FROM skillsets LOOP
      INSERT INTO profile_skillsets (
        profile_id, skillset_id, progress, achievements_completed,
        total_points_earned, milestone_25_reached, milestone_50_reached,
        milestone_75_reached, milestone_100_reached
      )
      VALUES (
        profile_record.id, skillset_record.id, 0, 0, 0,
        FALSE, FALSE, FALSE, FALSE
      )
      ON CONFLICT (profile_id, skillset_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
```

**Next**: Go to Path D

---

## Path D: Award Achievements (FINAL STEP)

**Time**: 30 seconds  
**You need**: Everything set up, just need to award achievements

### Run this script:
```sql
SELECT check_and_award_achievements();
```

**What this does**:
- Scans all users' KPI performance data
- Awards achievements for 60%, 80%, and 100% attainment
- Updates profile_skillsets with progress and points
- Awards milestone bonuses (25%, 50%, 75%, 100%)
- Updates each user's total_points and apptivia_level

### Verify results:
```sql
SELECT 
  p.email,
  SUM(ps.achievements_completed) as achievements,
  SUM(ps.total_points_earned) as points,
  p.apptivia_level
FROM profiles p
JOIN profile_skillsets ps ON ps.profile_id = p.id
GROUP BY p.id, p.email, p.apptivia_level
ORDER BY points DESC;
```

Should show non-zero values for users with KPI data.

---

## Step 2: Refresh Your Browser

1. Clear browser cache (Ctrl+Shift+Delete)
2. Reload application
3. Check results:

### ✅ Profile Page
Should show 5 skillset cards:
- Communication Excellence
- Sales Performance
- Pipeline Management
- Customer Success
- Strategic Leadership

Each with progress bars and point totals.

### ✅ Coach Page (Manager View)
Apptivia Level Mastery card should show:
- Team's average Apptivia Level
- Total Level Points (aggregated)
- Team Average Score
- Achievements (total count across team)
- Points (total across team)

### ✅ Coach Page (Power User View)
Same card showing individual stats:
- My Apptivia Level
- My Level Points
- My Achievements
- My Points

---

## Still Showing 0? Troubleshoot

### Issue: Functions don't exist
**Error**: `function check_and_award_achievements() does not exist`  
**Fix**: Go to Path A (run migration 013)

### Issue: Column doesn't exist
**Error**: `column "total_points_earned" does not exist`  
**Fix**: Go to Path B (add columns)

### Issue: No KPI data
**Check**:
```sql
SELECT COUNT(*) FROM kpi_values WHERE week_start_date >= CURRENT_DATE - INTERVAL '30 days';
```
**Fix**: Users need to have KPI performance data first. Activities → KPI values → Achievements.

### Issue: RLS policies blocking
**Check**:
```sql
-- Test as your user
SELECT * FROM profile_skillsets LIMIT 1;
```
**Fix**: Ensure RLS policies allow SELECT on profile_skillsets for authenticated users.

---

## Quick Reference Files

**Just want the quick fix?**
→ [QUICK_FIX_ACHIEVEMENT_DATA.md](QUICK_FIX_ACHIEVEMENT_DATA.md)

**Need step-by-step instructions?**
→ [IMMEDIATE_FIX_ACHIEVEMENT_DATA.md](IMMEDIATE_FIX_ACHIEVEMENT_DATA.md)

**Want to see before/after?**
→ [ACHIEVEMENT_DATA_BEFORE_AFTER.md](ACHIEVEMENT_DATA_BEFORE_AFTER.md)

**Having issues?**
→ [TROUBLESHOOTING_ACHIEVEMENT_DATA.md](TROUBLESHOOTING_ACHIEVEMENT_DATA.md)

**Need to check migration status?**
→ [CHECK_MIGRATION_013_STATUS.sql](CHECK_MIGRATION_013_STATUS.sql)

**Want diagnostic queries?**
→ [supabase/migrations/DIAGNOSTIC_ACHIEVEMENT_DATA.sql](supabase/migrations/DIAGNOSTIC_ACHIEVEMENT_DATA.sql)

---

## Summary of Paths

| Path | When to Use | Time | Files Needed |
|------|------------|------|--------------|
| **A** | Functions don't exist | 5 min | migration 013 |
| **B** | Columns missing | 2 min | ALTER TABLE script |
| **C** | No records | 1 min | DO $$ script |
| **D** | Everything ready | 30 sec | SELECT function call |

**Most common**: Path A → D (new setup)  
**Quick fix**: Path B → C → D (existing but incomplete)

---

## Maintenance: Keep Data Updated

After initial setup, use the **Dashboard "Refresh Achievements" button**:

1. Log in to application
2. Go to Dashboard (Scorecard page)
3. Click Actions dropdown (top right)
4. Click "Refresh Achievements"
5. See toast: "Awarded X achievements!"

This runs the same `check_and_award_achievements()` function and keeps data current.

**Automate it**: Set up daily cron job at 2 AM to run the function automatically.

---

## Success Criteria

✅ Profile page shows 5 skillset cards with progress  
✅ Coach page (manager) shows team aggregated stats  
✅ Coach page (power user) shows individual stats  
✅ All data persists across sessions (cumulative)  
✅ Points and levels update automatically  
✅ "Refresh Achievements" button works on Dashboard  

---

## Support

If issues persist after following this guide:

1. Run [CHECK_MIGRATION_013_STATUS.sql](CHECK_MIGRATION_013_STATUS.sql)
2. Run [DIAGNOSTIC_ACHIEVEMENT_DATA.sql](supabase/migrations/DIAGNOSTIC_ACHIEVEMENT_DATA.sql)
3. Check browser console for errors
4. Review [TROUBLESHOOTING_ACHIEVEMENT_DATA.md](TROUBLESHOOTING_ACHIEVEMENT_DATA.md)

---

**Total Time to Fix**: 2-5 minutes depending on path  
**Difficulty**: Copy/paste SQL scripts  
**Risk**: Zero - all scripts use CONFLICT handling and IF NOT EXISTS checks
