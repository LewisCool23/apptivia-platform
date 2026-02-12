# Troubleshooting: Empty Achievement Data

## Problem Description

### Symptoms
1. **Profile Page**: "Skillset Progress" section shows "No achievements tracked yet"
2. **Coach Page** (Manager view): Apptivia Level Mastery shows:
   - 0 Level Points
   - 0 Scorecard Streak
   - 0 Achievements
   - 0 Points (bottom stat)
   - 67% Team Average (only non-zero stat)
3. **Skillset Mastery Cards**: "View Details" modal DOES show data correctly

### Root Cause
The `profile_skillsets` table has not been initialized with records for existing profiles. This happens if:
- Migration 013 hasn't been applied to the production database yet
- The database was created before migration 013 was available
- Records were manually deleted

---

## Solution: Apply Migrations

### Step 1: Apply Migration 013 (Main System)
This migration creates all the cumulative progression functions and initializes data.

1. Open Supabase Dashboard → SQL Editor
2. Load and run: `supabase/migrations/013_cumulative_progression_system.sql`
3. Verify functions created:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name LIKE '%achievement%' OR routine_name LIKE '%skillset%';
```

Expected results:
- `check_and_award_achievements`
- `award_achievement`
- `calculate_skillset_progress`
- `award_skillset_milestone_points`
- `update_apptivia_level`

4. Verify profile_skillsets initialized:
```sql
SELECT COUNT(*) as total_records,
       COUNT(DISTINCT profile_id) as profiles,
       COUNT(DISTINCT skillset_id) as skillsets
FROM profile_skillsets;
```

Expected: `profiles × 5 skillsets` (e.g., 10 users = 50 records)

### Step 2: Award Initial Achievements
Run the achievement check function to scan existing KPI data and award achievements:

```sql
SELECT check_and_award_achievements();
```

This will:
- Scan all profiles with KPI data
- Award achievements based on performance (60%/80%/100% thresholds)
- Update profile_skillsets with progress and points
- Award milestone bonuses (25%/50%/75%/100%)
- Update Apptivia Levels based on total_points

### Step 3: Verify Data Population

**Check Profile Achievements:**
```sql
SELECT 
  p.email,
  COUNT(pa.id) as achievements_earned,
  SUM(a.points) as total_achievement_points,
  p.total_points as profile_total_points,
  p.apptivia_level
FROM profiles p
LEFT JOIN profile_achievements pa ON pa.profile_id = p.id
LEFT JOIN achievements a ON a.id = pa.achievement_id
GROUP BY p.id, p.email, p.total_points, p.apptivia_level
ORDER BY p.email;
```

**Check Skillset Progress:**
```sql
SELECT 
  p.email,
  s.name as skillset,
  ps.progress,
  ps.achievements_completed,
  ps.total_points_earned,
  ps.milestone_25_reached,
  ps.milestone_50_reached,
  ps.milestone_75_reached,
  ps.milestone_100_reached
FROM profile_skillsets ps
JOIN profiles p ON p.id = ps.profile_id
JOIN skillsets s ON s.id = ps.skillset_id
WHERE ps.achievements_completed > 0
ORDER BY p.email, s.name;
```

---

## Alternative: Manual Initialization

If migration 013 can't be applied immediately, run this quick fix:

```sql
-- Initialize profile_skillsets for all profiles
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
END $$;
```

Then use the "Refresh Achievements" button on the Dashboard to award achievements.

---

## Testing After Fix

### 1. Profile Page Test
1. Log in as any user
2. Navigate to Profile page
3. Scroll to "Skillset Progress" section
4. Should see 5 skillset cards with progress bars
5. Each card shows:
   - Skillset name and color
   - Progress percentage
   - "X of 100 Achievements" count
   - "X Total Points" earned

### 2. Coach Page Test (Manager)
1. Log in as manager
2. Navigate to Coach page
3. Check "Apptivia Level Mastery" card (top gradient card)
4. Should show:
   - Current Team Apptivia Level (e.g., "Gold")
   - Level Points (non-zero if achievements earned)
   - Average Score % (from scorecard)
   - Scorecard Streak (from scorecard_submissions)
   - Badges count
   - Achievements count (non-zero after refresh)
   - Total Points (sum across all skillsets)

### 3. Coach Page Test (Power User)
1. Log in as power user (e.g., Ava Carter)
2. Navigate to Coach page
3. Should show "My Apptivia Level" instead of team average
4. Stats should reflect individual profile.total_points
5. Achievements should show count from profile_achievements

### 4. Skillset Mastery Cards Test
1. On Coach page, view any skillset mastery card
2. Click "View Details"
3. Modal should show:
   - Progress bar
   - Achievements completed / 100
   - Points earned
   - List of achievements (Easy/Medium/Hard)
4. This section already works - confirming nothing broke

---

## Expected Data After Initial Run

Assuming users have KPI performance data:

### Example User: Ava Carter
- **Profile Page**: 5 skillset cards showing progress
- **Coach Page** (power user view):
  - Apptivia Level: "Bronze" to "Gold" (depends on points)
  - Level Points: 250 - 5,000 (depends on achievements + milestones)
  - Achievements: 5 - 50 (depends on KPI attainment)
  - Total Points: Same as Level Points
- **Skillset Cards**: Each shows 0-100% progress with earned points

### Example Manager: Sarah Johnson
- **Coach Page** (manager view):
  - Current Team Apptivia Level: "Silver" (average of team)
  - Level Points: 1,500 (average across team)
  - Achievements: 35 (sum across team)
  - Total Points: 7,500 (sum across team)
  - Team Average Score: 67% (from scorecard)

---

## Common Issues & Solutions

### Issue: "Still showing 0 after migration"
**Solution**: Click "Refresh Achievements" on Dashboard
- This runs `check_and_award_achievements()` function
- Scans ALL profiles with KPI data
- Awards achievements based on current performance
- Updates profile_skillsets and profiles tables

### Issue: "Profile page still empty"
**Check**:
```sql
SELECT * FROM profile_skillsets WHERE profile_id = '<user-id>';
```
If returns 0 rows → Run initialization script above

### Issue: "Achievements in modal but not on main page"
**Cause**: Modal queries achievements table directly, but main page uses profile_skillsets
**Solution**: Ensure profile_skillsets records exist (see above)

### Issue: "Manager sees 0 but team members have data"
**Check team assignments**:
```sql
SELECT p.email, p.team, t.name as team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team
WHERE p.team IS NOT NULL;
```
Ensure manager's selected teams match actual team assignments

### Issue: "Points not matching"
**Verify point calculations**:
```sql
-- Achievement points only (no milestones)
SELECT 
  p.email,
  SUM(a.points) as achievement_points_only
FROM profiles p
JOIN profile_achievements pa ON pa.profile_id = p.id
JOIN achievements a ON a.id = pa.achievement_id
GROUP BY p.id, p.email;

-- Total with milestones
SELECT 
  p.email,
  SUM(ps.total_points_earned) as total_with_milestones
FROM profiles p
JOIN profile_skillsets ps ON ps.profile_id = p.id
GROUP BY p.id, p.email;

-- Profile total_points (should match total_with_milestones)
SELECT email, total_points
FROM profiles
WHERE total_points > 0;
```

---

## Prevention: Automated Achievement Checking

To prevent future "0 data" issues, set up automated checking:

### Option 1: Supabase Edge Function (Recommended)
Create a scheduled function that runs daily:

```javascript
// supabase/functions/award-achievements/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.rpc('check_and_award_achievements')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ 
    success: true, 
    awardsGiven: data 
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Schedule via Supabase Dashboard → Edge Functions → Cron (daily at 2 AM)

### Option 2: Database Cron (pg_cron extension)
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily achievement check at 2 AM
SELECT cron.schedule(
  'check-achievements',
  '0 2 * * *',
  'SELECT check_and_award_achievements();'
);
```

### Option 3: Manual Dashboard Button
Users can click "Refresh Achievements" on Dashboard anytime.
- Located in Actions dropdown (top right)
- Shows toast notification with results
- Updates all data immediately

---

## Files Involved

### Database
- `supabase/migrations/013_cumulative_progression_system.sql` - Main system
- `supabase/migrations/014_initialize_profile_skillsets.sql` - Quick fix

### Frontend
- `src/pages/Profile.jsx` - Lines 290-318 (fetchAchievements query)
- `src/pages/Coach.jsx` - Lines 70-105 (userProfile fetch), 316-410 (stats display)
- `src/hooks/useCoachData.ts` - Lines 340-415 (profile_skillsets aggregation)
- `src/ApptiviaScorecard.tsx` - Lines 528-554 (Refresh Achievements button)
- `src/components/SkillsetDetailsModal.tsx` - Modal that already shows data correctly

---

## Success Criteria

After applying migrations and running achievement check:

✅ Profile page shows 5 skillset cards with progress
✅ Coach page (manager) shows non-zero achievements and points
✅ Coach page (power user) shows individual stats
✅ Skillset mastery cards show progress on main page
✅ "View Details" modals continue to work
✅ "Refresh Achievements" button awards new achievements
✅ All data persists across sessions (cumulative, never resets)

---

## Support

If issues persist after following this guide:

1. Check browser console for errors
2. Check Supabase logs for RPC errors
3. Verify RLS policies allow SELECT on:
   - profile_skillsets
   - profile_achievements
   - achievements
   - skillsets
4. Confirm user permissions (isPowerUser, isManager, isAdmin flags)
5. Review TROUBLESHOOTING_ACHIEVEMENT_DATA.md (this file)
