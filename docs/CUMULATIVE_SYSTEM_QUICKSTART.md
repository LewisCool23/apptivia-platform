# Quick Start: Cumulative Progression System

## Step 1: Apply the Database Migration

Run the migration in your Supabase SQL Editor:

```sql
-- Navigate to: Supabase Dashboard → SQL Editor → New Query
-- Paste the contents of: supabase/migrations/013_cumulative_progression_system.sql
-- Click "Run" to execute
```

The migration will:
- ✅ Create/update all necessary tables and columns
- ✅ Install 5 progression calculation functions
- ✅ Initialize profile_skillsets for all users
- ✅ Recalculate existing progress from historical data
- ✅ Update Apptivia Levels based on current points

**Expected Output**: Success messages confirming installation

---

## Step 2: Test the System

### A. Check Database Functions
```sql
-- Test achievement checking (will scan all profiles and award achievements)
SELECT check_and_award_achievements();
-- Returns: Number of achievements awarded (integer)

-- Check a specific user's achievements
SELECT COUNT(*) as total_achievements
FROM profile_achievements
WHERE profile_id = '<your_user_id>';

-- Check skillset progress
SELECT 
  s.name as skillset,
  ps.progress,
  ps.achievements_completed,
  ps.total_points_earned
FROM profile_skillsets ps
JOIN skillsets s ON ps.skillset_id = s.id
WHERE ps.profile_id = '<your_user_id>'
ORDER BY ps.progress DESC;

-- Check Apptivia Level
SELECT 
  first_name,
  last_name,
  total_points,
  apptivia_level
FROM profiles
WHERE id = '<your_user_id>';
```

### B. Test in the UI
1. Log into Apptivia Platform
2. Go to **Dashboard**
3. Click **Actions** dropdown (top right)
4. Click **"Refresh Achievements"**
5. Observe toast notification showing results
6. Navigate to **Coach** page to see skillset progress

---

## Step 3: Understanding the System

### How Achievements Are Earned
1. **Activities** → KPI performance recorded
2. **KPI thresholds** trigger achievement awards:
   - Easy: 60% of goal
   - Medium: 80% of goal
   - Hard: 100%+ of goal
3. Click **"Refresh Achievements"** to award new achievements
4. Each achievement adds points to your **total_points**

### Skillset Mastery Progress
- Based on **cumulative achievement points earned**
- Max: 1,175 points per skillset (100 achievements)
- Progress = (Points Earned / 1,175) × 100
- **Never decreases** - progress is permanent

### Milestone Bonuses
When skillset reaches milestones, bonus points awarded:
- 25% → +250 pts
- 50% → +500 pts
- 75% → +750 pts
- 100% → +1,000 pts

### Apptivia Levels
Based on cumulative **total_points**:
- Bronze: 0-999
- Silver: 1,000-2,499
- Gold: 2,500-4,999
- Platinum: 5,000-9,999
- Diamond: 10,000+

---

## Step 4: Schedule Automatic Achievement Checking

### Option A: Supabase Edge Function (Recommended)
Create a scheduled function that runs daily:

```typescript
// supabase/functions/daily-achievement-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  const { data, error } = await supabase.rpc('check_and_award_achievements')
  
  return new Response(
    JSON.stringify({ achievements_awarded: data, error }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

Then schedule it in Supabase Dashboard:
- Go to **Database** → **Cron Jobs**
- Create new cron: `0 2 * * *` (runs at 2 AM daily)
- Function: `daily-achievement-check`

### Option B: Database Trigger (Alternative)
Create a trigger that runs after KPI values are inserted:

```sql
CREATE OR REPLACE FUNCTION trigger_check_achievements()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_and_award_achievements();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_kpi_insert
AFTER INSERT ON kpi_values
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_check_achievements();
```

⚠️ **Note**: This may run frequently if KPIs are updated often. Use with caution.

---

## Step 5: Monitor & Adjust

### Check Achievement Distribution
```sql
-- See how many achievements each user has earned
SELECT 
  p.first_name,
  p.last_name,
  COUNT(pa.id) as total_achievements,
  p.total_points,
  p.apptivia_level
FROM profiles p
LEFT JOIN profile_achievements pa ON p.id = pa.profile_id
GROUP BY p.id, p.first_name, p.last_name, p.total_points, p.apptivia_level
ORDER BY total_achievements DESC;

-- Check achievement earning rate by difficulty
SELECT 
  a.difficulty,
  COUNT(*) as times_earned,
  AVG(a.points) as avg_points
FROM profile_achievements pa
JOIN achievements a ON pa.achievement_id = a.id
GROUP BY a.difficulty
ORDER BY a.difficulty;

-- See which skillsets are progressing fastest
SELECT 
  s.name as skillset,
  AVG(ps.progress) as avg_progress,
  COUNT(CASE WHEN ps.milestone_25_reached THEN 1 END) as reached_25,
  COUNT(CASE WHEN ps.milestone_50_reached THEN 1 END) as reached_50,
  COUNT(CASE WHEN ps.milestone_75_reached THEN 1 END) as reached_75,
  COUNT(CASE WHEN ps.milestone_100_reached THEN 1 END) as reached_100
FROM profile_skillsets ps
JOIN skillsets s ON ps.skillset_id = s.id
GROUP BY s.name
ORDER BY avg_progress DESC;
```

### Adjust Thresholds (If Needed)
If achievements are being earned too fast or too slow, modify the thresholds in the `check_and_award_achievements()` function:

```sql
-- Edit lines 280-320 in the migration file
-- Current thresholds:
-- Easy: >= 60%
-- Medium: >= 80%
-- Hard: >= 100%

-- Example adjustment (make it harder):
CREATE OR REPLACE FUNCTION check_and_award_achievements()
...
  IF kpi_record.percentage >= 70 THEN  -- Changed from 60
    -- Award easy achievements
...
  IF kpi_record.percentage >= 90 THEN  -- Changed from 80
    -- Award medium achievements
...
  IF kpi_record.percentage >= 110 THEN  -- Changed from 100
    -- Award hard achievements
...
```

---

## Troubleshooting

### Issue: "No achievements awarded"
**Cause**: No recent KPI data or performance below thresholds

**Fix**:
```sql
-- Check if KPI values exist for past 7 days
SELECT COUNT(*) 
FROM kpi_values 
WHERE period_end >= CURRENT_DATE - INTERVAL '7 days';

-- If 0, add test data:
INSERT INTO kpi_values (profile_id, kpi_id, value, period_start, period_end)
SELECT 
  p.id,
  k.id,
  k.goal * 1.2,  -- 120% of goal (should trigger achievements)
  CURRENT_DATE - 7,
  CURRENT_DATE
FROM profiles p
CROSS JOIN kpi_metrics k
WHERE k.is_active = true
LIMIT 10;

-- Then retry:
SELECT check_and_award_achievements();
```

### Issue: "Skillset progress not updating"
**Cause**: Need to manually recalculate

**Fix**:
```sql
-- Recalculate for specific user
SELECT calculate_skillset_progress('<profile_id>', '<skillset_id>');

-- Recalculate for all users and skillsets
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT profile_id, skillset_id FROM profile_skillsets LOOP
    PERFORM calculate_skillset_progress(rec.profile_id, rec.skillset_id);
  END LOOP;
END $$;
```

### Issue: "Apptivia Level not changing"
**Cause**: Need to manually update level

**Fix**:
```sql
-- Update specific user
SELECT update_apptivia_level('<profile_id>');

-- Update all users
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM profiles LOOP
    PERFORM update_apptivia_level(rec.id);
  END LOOP;
END $$;
```

---

## Success Checklist

- [ ] Migration 013 applied successfully
- [ ] `check_and_award_achievements()` returns a number (not error)
- [ ] `profile_achievements` table has records
- [ ] `profile_skillsets` shows progress > 0 for active users
- [ ] `profiles.apptivia_level` reflects current points
- [ ] "Refresh Achievements" button works in Dashboard UI
- [ ] Toast notifications display correctly
- [ ] Coach page shows cumulative skillset progress
- [ ] Progress bars never decrease (test over multiple refreshes)

---

## Next Steps

1. ✅ **Monitor** achievement earning rates in first week
2. ✅ **Adjust** thresholds if needed based on user feedback
3. ✅ **Schedule** daily/weekly automatic checking
4. ✅ **Communicate** new system to users (send CUMULATIVE_PROGRESSION_SYSTEM.md)
5. ✅ **Celebrate** when first user reaches Diamond level! 💎

---

**Questions?** Check the full documentation: `CUMULATIVE_PROGRESSION_SYSTEM.md`
