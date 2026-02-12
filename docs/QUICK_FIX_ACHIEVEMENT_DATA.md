# Quick Fix Card: Achievement Data Not Showing

## 🔴 Problem
- Profile page: Skillset Progress section blank
- Coach page: 0 achievements, 0 points (but team average works)
- Skillset cards: Only "View Details" modal shows data

## ✅ Solution (Copy & Paste These 3 Scripts)

### Script 1A: Add Missing Columns (Run This First)
```sql
-- Add missing columns to profile_skillsets table
ALTER TABLE public.profile_skillsets
  ADD COLUMN IF NOT EXISTS total_points_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_25_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_50_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_75_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_100_reached boolean DEFAULT FALSE;
```

### Script 1B: Initialize Profile Skillsets
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

### Script 2: Award Achievements
```sql
SELECT check_and_award_achievements();
```

### Script 3: Verify (Optional)
```sql
SELECT 
  p.email,
  SUM(ps.achievements_completed) as achievements,
  SUM(ps.total_points_earned) as points
FROM profiles p
JOIN profile_skillsets ps ON ps.profile_id = p.id
GROUP BY p.id, p.email
ORDER BY points DESC;
```

## 🎯 What These Scripts Do

**Script 1A**: Adds missing columns to profile_skillsets table
- total_points_earned (integer)
- milestone_25_reached, milestone_50_reached, milestone_75_reached, milestone_100_reached (booleans)
- These columns track cumulative points and milestone bonuses

**Script 1B**: Creates 5 records per user (one for each skillset)
- Communication Excellence
- Sales Performance  
- Pipeline Management
- Customer Success
- Strategic Leadership

**Script 2**: Scans KPI performance data and awards achievements
- Checks kpi_values for performance >= 60%, 80%, 100%
- Creates profile_achievements records
- Updates profile_skillsets with progress and points
- Awards milestone bonuses at 25%, 50%, 75%, 100%
- Updates profiles.total_points and apptivia_level

**Script 3**: Shows results - who earned what

## 📊 Expected Results

### Before
```
Profile page: "No achievements tracked yet"
Coach page:   0 Level Points, 0 Achievements
```

### After
```
Profile page: 5 skillset cards with progress bars
Coach page:   2,610 Level Points, 145 Achievements
```

## 🚀 Where to Run

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste Script 1 → Run
4. Paste Script 2 → Run
5. Paste Script 3 → Run (optional verification)
6. Refresh browser on your app

## ⚠️ If Still Showing 0

Check if functions exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'check_and_award_achievements';
```

If returns 0 rows → Run migration 013 first:
- File: `supabase/migrations/013_cumulative_progression_system.sql`
- This creates all 5 progression functions

## 📁 Full Documentation

- `IMMEDIATE_FIX_ACHIEVEMENT_DATA.md` - Detailed fix instructions
- `TROUBLESHOOTING_ACHIEVEMENT_DATA.md` - Complete troubleshooting
- `ACHIEVEMENT_DATA_BEFORE_AFTER.md` - Visual comparison
- `DIAGNOSTIC_ACHIEVEMENT_DATA.sql` - Diagnostic queries

## 🎉 Success Indicators

✅ Profile page shows 5 skillset cards with progress
✅ Coach page (manager) shows team total achievements/points
✅ Coach page (power user) shows individual achievements/points
✅ Dashboard "Refresh Achievements" button works
✅ All data persists (never resets)

## 🔄 Keep Data Updated

Use "Refresh Achievements" button on Dashboard (Actions dropdown)
- Scans new KPI data
- Awards new achievements
- Updates points and levels
- Shows toast: "Awarded X achievements!"

## ⏱️ Total Time: 3 minutes
1. Run Script 1 (10 seconds)
2. Run Script 2 (30 seconds - depends on data size)
3. Refresh browser (5 seconds)
4. Verify data showing (30 seconds)

---

**Need help?** See TROUBLESHOOTING_ACHIEVEMENT_DATA.md for detailed diagnostics
