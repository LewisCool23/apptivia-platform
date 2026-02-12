# IMMEDIATE FIX: Achievement Data Not Showing

## The Problem

**Coach Page (Manager view)**: Shows 0 for Level Points, Achievements, and Points despite having 67% Team Average
**Profile Page**: "Skillset Progress" section is completely blank
**Skillset Cards**: "View Details" modal DOES show data (this is the only working section)

## Root Cause

The `profile_skillsets` table hasn't been initialized yet. Migration 013 creates this table and populates it, but it hasn't been applied to your production database.

## Quick Fix (5 minutes)

### Step 1: Run Diagnostic Script
Copy and paste this into Supabase SQL Editor to see current state:

```sql
-- Check if profile_skillsets exists and has data
SELECT COUNT(*) as records FROM profile_skillsets;

-- Check if required columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profile_skillsets' 
AND column_name IN ('total_points_earned', 'milestone_25_reached');
```

**Expected**: Records might be 0, and columns might be missing

### Step 2A: Add Missing Columns
Run this script in Supabase SQL Editor:

```sql
-- Add missing columns to profile_skillsets table
ALTER TABLE public.profile_skillsets
  ADD COLUMN IF NOT EXISTS total_points_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS milestone_25_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_50_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_75_reached boolean DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS milestone_100_reached boolean DEFAULT FALSE;
```

### Step 2B: Initialize Profile Skillsets
Run this script in Supabase SQL Editor:

```sql
-- Create initial records for all profiles × skillsets
DO $$
DECLARE
  profile_record RECORD;
  skillset_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM profiles LOOP
    FOR skillset_record IN SELECT id FROM skillsets LOOP
      INSERT INTO profile_skillsets (
        profile_id,
        skillset_id,
        progress,
        achievements_completed,
        total_points_earned,
        milestone_25_reached,
        milestone_50_reached,
        milestone_75_reached,
        milestone_100_reached
      )
      VALUES (
        profile_record.id,
        skillset_record.id,
        0,
        0,
        0,
        FALSE,
        FALSE,
        FALSE,
        FALSE
      )
      ON CONFLICT (profile_id, skillset_id) DO NOTHING;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Profile skillsets initialized';
END $$;
```

### Step 3: Award Achievements Based on KPI Performance
Run this to scan existing KPI data and award achievements:

```sql
-- Award achievements based on current KPI performance
SELECT check_and_award_achievements();
```

This function will:
- Scan all profiles with KPI data
- Award achievements for KPIs at 60%, 80%, and 100% attainment
- Update profile_skillsets with progress and points
- Award milestone bonuses at 25%, 50%, 75%, and 100%
- Update Apptivia Levels based on total points

### Step 4: Refresh Browser
1. Clear browser cache (Ctrl+Shift+Delete)
2. Reload the application
3. Navigate to Profile page → Should see skillset cards
4. Navigate to Coach page → Should see non-zero achievements and points

## Verification

### Profile Page
Should now show 5 skillset cards:
- Communication Excellence
- Sales Performance
- Pipeline Management
- Customer Success
- Strategic Leadership

Each card displays:
- Progress bar (0-100%)
- X of 100 Achievements
- X Total Points

### Coach Page (Manager)
Apptivia Level Mastery card should show:
- Current Team Apptivia Level (Bronze/Silver/Gold/Platinum/Diamond)
- Level Points (sum across team)
- Team Average Score (67% - this already works)
- Scorecard Streak
- Badges count
- **Achievements count (now non-zero)**
- **Total Points (now non-zero)**

### Coach Page (Power User)
Same card but shows individual stats:
- My Apptivia Level
- My Level Points
- My Achievements
- My Points

## If Still Showing 0

### Check 1: Verify Records Created
```sql
SELECT 
  p.email,
  COUNT(ps.id) as skillset_records,
  SUM(ps.achievements_completed) as achievements,
  SUM(ps.total_points_earned) as points
FROM profiles p
LEFT JOIN profile_skillsets ps ON ps.profile_id = p.id
GROUP BY p.id, p.email
ORDER BY p.email;
```

Should show 5 records per user.

### Check 2: Verify Achievements Awarded
```sql
SELECT 
  p.email,
  COUNT(pa.id) as achievements_earned,
  p.total_points
FROM profiles p
LEFT JOIN profile_achievements pa ON pa.profile_id = p.id
GROUP BY p.id, p.email, p.total_points
ORDER BY p.email;
```

Should show non-zero achievements if users have KPI performance data.

### Check 3: Check KPI Data Exists
```sql
SELECT 
  p.email,
  km.kpi_name,
  kv.value,
  CASE 
    WHEN km.target_value > 0 THEN (kv.value / km.target_value * 100)
    ELSE 0
  END as percent_of_target
FROM kpi_values kv
JOIN profiles p ON p.id = kv.profile_id
JOIN kpi_metrics km ON km.id = kv.kpi_metric_id
WHERE kv.week_start_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY p.email, km.kpi_name
LIMIT 20;
```

If percent_of_target >= 60%, user should earn achievements.

### Check 4: Try Manual Refresh
1. Log in to application
2. Go to Dashboard (Scorecard page)
3. Click Actions dropdown (top right)
4. Click "Refresh Achievements"
5. Should see toast: "Awarded X achievements!"
6. Navigate to Profile/Coach page to verify

## Long-Term Solution

### Apply Migration 013 Properly
For full system installation, run the complete migration:

**File**: `supabase/migrations/013_cumulative_progression_system.sql`

This creates:
1. `profile_skillsets` table
2. `profile_achievements` table
3. 5 progression functions
4. Initializes all data
5. Sets up constraints and indexes

### Set Up Automated Checking
Schedule daily achievement checks at 2 AM:

```sql
-- Option 1: Using pg_cron
SELECT cron.schedule(
  'check-achievements',
  '0 2 * * *',
  'SELECT check_and_award_achievements();'
);
```

Or use Supabase Edge Functions for scheduled execution.

## Support Files

Created 3 new files to help:

1. **TROUBLESHOOTING_ACHIEVEMENT_DATA.md** - Comprehensive troubleshooting guide
2. **supabase/migrations/014_initialize_profile_skillsets.sql** - Quick initialization script
3. **supabase/migrations/DIAGNOSTIC_ACHIEVEMENT_DATA.sql** - Diagnostic queries with interpretation

## Summary

The issue is simply that the database tables haven't been populated yet. The frontend code is correct and working - it's querying the right tables with the right logic. Once you initialize `profile_skillsets` and run the achievement check, everything will display correctly.

**3-Step Fix**:
1. Initialize profile_skillsets (SQL script above)
2. Run check_and_award_achievements() function
3. Refresh browser

This will populate all the missing data and the UI will immediately show achievements, points, and progress across all pages.
