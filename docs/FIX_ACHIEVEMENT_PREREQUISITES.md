# Achievement Prerequisite Fix

## Problem Identified

Users were receiving higher-tier achievements without the prerequisite lower-tier achievements. For example:
- ✅ Have "10 Call Connects" achievement  
- ❌ Missing "1 Call Connect" achievement

This is illogical - you cannot achieve 10 call connects without first having 1 call connect.

## Root Cause

The `check_and_award_achievements()` function was processing achievements in random order, not respecting threshold progression. It would check if a user qualifies for "10 Call Connects" and award it, but might skip checking "1 Call Connect" if it was already (incorrectly) missing.

## Solution Implemented

Created migration `019_fix_achievement_prerequisites.sql` which:

1. **Updated `check_and_award_achievements()` function**
   - Now processes achievements ordered by KPI and threshold (low to high)
   - Ensures "1 Call Connect" is checked and awarded before "10 Call Connects"
   - Prevents the issue from happening in the future

2. **Created `backfill_missing_prerequisites()` function**
   - Scans all users with achievements
   - Identifies missing prerequisite achievements
   - Automatically awards them retroactively

## How to Apply the Fix

### Step 1: Apply the Migration

Run the migration file to update the database:

```sql
-- Option A: Via Supabase CLI
supabase db reset

-- Option B: Via SQL editor in Supabase Dashboard
-- Copy and paste contents of supabase/migrations/019_fix_achievement_prerequisites.sql
-- and execute it
```

### Step 2: Backfill Missing Achievements

Run the backfill function to fix existing user data:

```sql
-- This will award all missing prerequisite achievements
SELECT * FROM backfill_missing_prerequisites();
```

**Expected output:** List of users and how many missing achievements were awarded to each.

### Step 3: Verify the Fix

Run a fresh check to ensure everything is working:

```sql
-- This should award any remaining new achievements
SELECT * FROM check_and_award_achievements();
```

### Step 4: Test in the UI

1. Log in to the Apptivia Platform
2. Navigate to the Coach page or Profile page
3. Check achievements for any user
4. Verify that achievements now appear in logical order:
   - If user has "10 Call Connects", they should also have "1 Call Connect"
   - If user has "10 Call Connects", they should have "10 Dials Made" or higher

## Technical Details

### What Changed in `check_and_award_achievements()`

**Before:**
```sql
SELECT a.id, a.name, a.criteria, a.skillset_id, a.points
FROM achievements a
WHERE a.criteria IS NOT NULL
  AND NOT EXISTS (...)
-- No specific ordering - random processing order
```

**After:**
```sql
SELECT a.id, a.name, a.criteria, a.skillset_id, a.points,
  (a.criteria->>'kpi') as kpi_order,
  COALESCE((a.criteria->>'threshold')::NUMERIC, 0) as threshold_order
FROM achievements a
WHERE a.criteria IS NOT NULL
  AND NOT EXISTS (...)
ORDER BY 
  kpi_order,           -- Group by KPI first
  threshold_order ASC,  -- Then sort by threshold (low to high)
  a.name
```

### How `backfill_missing_prerequisites()` Works

1. For each user, get their earned achievements
2. For each earned achievement with threshold T:
   - Find all achievements with same KPI but threshold < T
   - Check if user qualifies for those achievements
   - Award any that are missing

Example:
```
User has: "10 Call Connects" (threshold: 10)
User's actual call_connects: 15

Backfill checks:
- "1 Call Connect" (threshold: 1) - 15 >= 1 ✅ Award it
- "5 Call Connects" (threshold: 5) - 15 >= 5 ✅ Award it  
```

## Related KPIs and Prerequisites

Some KPIs have logical relationships:
- **call_connects** typically requires **dials** (you can't connect without dialing)
- **meetings** typically requires **call_connects** (meetings usually come from calls)

The current fix ensures threshold ordering within each KPI. If you want to enforce cross-KPI prerequisites (e.g., "Can't award 10 Call Connects without 10 Dials"), that would require additional logic.

## Verification Queries

### Check for users with prerequisite gaps

```sql
-- Find users who have higher achievements but miss lower ones
SELECT 
  p.email,
  a_high.name as has_achievement,
  (a_high.criteria->>'threshold')::INT as has_threshold,
  a_low.name as missing_achievement,
  (a_low.criteria->>'threshold')::INT as missing_threshold
FROM profile_achievements pa
JOIN achievements a_high ON a_high.id = pa.achievement_id
JOIN profiles p ON p.id = pa.profile_id
CROSS JOIN achievements a_low
WHERE 
  (a_high.criteria->>'kpi') = (a_low.criteria->>'kpi')
  AND (a_high.criteria->>'threshold')::INT > (a_low.criteria->>'threshold')::INT
  AND NOT EXISTS (
    SELECT 1 FROM profile_achievements pa2
    WHERE pa2.profile_id = pa.profile_id
      AND pa2.achievement_id = a_low.id
  )
ORDER BY p.email, (a_high.criteria->>'kpi'), missing_threshold;
```

### Count missing prerequisites per user

```sql
-- Summary of how many prerequisite gaps exist
WITH gaps AS (
  SELECT 
    p.id,
    p.email,
    COUNT(*) as gap_count
  FROM profile_achievements pa
  JOIN achievements a_high ON a_high.id = pa.achievement_id
  JOIN profiles p ON p.id = pa.profile_id
  CROSS JOIN achievements a_low
  WHERE 
    (a_high.criteria->>'kpi') = (a_low.criteria->>'kpi')
    AND (a_high.criteria->>'threshold')::INT > (a_low.criteria->>'threshold')::INT
    AND NOT EXISTS (
      SELECT 1 FROM profile_achievements pa2
      WHERE pa2.profile_id = pa.profile_id
        AND pa2.achievement_id = a_low.id
    )
  GROUP BY p.id, p.email
)
SELECT 
  COUNT(*) as users_with_gaps,
  SUM(gap_count) as total_gaps,
  ROUND(AVG(gap_count), 1) as avg_gaps_per_user
FROM gaps;
```

## Troubleshooting

### Issue: Backfill runs but doesn't award any achievements

**Possible causes:**
1. All prerequisites are already awarded (good!)
2. Users don't have the KPI data to qualify
3. The `award_achievement()` function failed

**Solution:** Check the database logs for NOTICE messages to see what the function attempted.

### Issue: Users still have gaps after backfill

**Possible causes:**
1. The user's KPI data doesn't qualify them for the missing achievement
2. There was an error in the `award_achievement()` function

**Solution:** Manually check the user's KPI values:

```sql
SELECT 
  km.key,
  COALESCE(SUM(kv.value), 0) as total_value
FROM kpi_metrics km
LEFT JOIN kpi_values kv ON kv.kpi_id = km.id 
  AND kv.profile_id = 'USER_ID_HERE'
WHERE km.is_active = true
GROUP BY km.key
ORDER BY km.key;
```

## Maintenance

Going forward, the updated `check_and_award_achievements()` function will prevent this issue from reoccurring. The function is called:
- When users click "Refresh Dashboard" on the Scorecard page
- Potentially via scheduled jobs (if configured)
- Manually via SQL when needed

## Questions?

If you encounter issues or have questions:
1. Check the Supabase logs for error messages
2. Run the verification queries above
3. Inspect the `profile_achievements` table directly
