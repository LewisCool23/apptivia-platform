# Achievement System Fix: Criteria-Based Awarding

## The Problem

The old system awarded achievements **randomly** based on generic KPI percentages:
- ❌ 60%+ performance → Award ANY random easy achievement
- ❌ 80%+ performance → Award ANY random medium achievement
- ❌ Didn't check if user actually completed specific requirements
- ❌ Only looked at last 7 days of data

**Result**: Ava has 6 meetings but no "Book 1 meeting" achievement

## The Solution

New system awards achievements based on **specific criteria**:
- ✅ Each achievement has exact requirements (KPI + threshold)
- ✅ Checks all-time cumulative data (retroactive)
- ✅ Awards all eligible achievements at once
- ✅ Each achievement can only be earned once

## How to Apply

### Step 1: Populate Achievement Criteria
Run migration 015 in Supabase SQL Editor:
```sql
-- File: 015_populate_achievement_criteria.sql
-- This adds criteria to ~100 achievements based on their names
```

This will add criteria like:
- "Book 1 meetings from live calls" → `{kpi: "meetings", threshold: 1, cumulative: true}`
- "Make 50 outbound calls" → `{kpi: "call_connects", threshold: 50, cumulative: true}`
- "Send 100 emails" → `{kpi: "emails_sent", threshold: 100, cumulative: true}`

### Step 2: Install New Achievement Function
Run migration 016 in Supabase SQL Editor:
```sql
-- File: 016_criteria_based_achievements.sql
-- Replaces check_and_award_achievements() with criteria-based version
```

### Step 3: Award Achievements Retroactively
```sql
SELECT * FROM check_and_award_achievements();
```

This will:
- Scan ALL kpi_values for each user (all-time, cumulative)
- Check each achievement's criteria
- Award all eligible achievements
- Return a table showing how many achievements each user earned

### Step 4: Verify Results

**Check Ava's achievements:**
```sql
SELECT 
  a.name,
  a.criteria,
  a.points,
  pa.completed_at
FROM profile_achievements pa
JOIN achievements a ON a.id = pa.achievement_id
JOIN profiles p ON p.id = pa.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
ORDER BY pa.completed_at DESC;
```

**Check Ava's cumulative KPIs:**
```sql
SELECT 
  km.key,
  SUM(kv.value) as cumulative_value,
  km.goal
FROM kpi_values kv
JOIN kpi_metrics km ON km.id = kv.kpi_id
JOIN profiles p ON p.id = kv.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
  AND km.is_active = true
GROUP BY km.key, km.goal
ORDER BY km.key;
```

Expected for Ava:
- meetings: 6
- call_connects: 74
- talk_time_minutes: 111
- sourced_opps: 4
- stage2_opps: 12

**Check which achievements Ava should get:**
```sql
SELECT 
  a.name,
  a.difficulty,
  a.points,
  a.criteria
FROM achievements a
WHERE a.criteria IS NOT NULL
  AND (
    (a.criteria->>'kpi' = 'meetings' AND (a.criteria->>'threshold')::int <= 6)
    OR (a.criteria->>'kpi' = 'call_connects' AND (a.criteria->>'threshold')::int <= 74)
    OR (a.criteria->>'kpi' = 'talk_time_minutes' AND (a.criteria->>'threshold')::int <= 111)
    OR (a.criteria->>'kpi' = 'sourced_opps' AND (a.criteria->>'threshold')::int <= 4)
    OR (a.criteria->>'kpi' = 'stage2_opps' AND (a.criteria->>'threshold')::int <= 12)
  )
ORDER BY (a.criteria->>'threshold')::int;
```

This shows all achievements Ava qualifies for based on her cumulative data.

## Achievement Criteria Structure

Each achievement now has a `criteria` column with JSON:

```json
{
  "kpi": "meetings",           // Which KPI metric key
  "threshold": 1,              // Required value
  "operator": ">=",            // Comparison (>=, >, =, <=, <)
  "cumulative": true           // Use all-time total (not weekly)
}
```

## Expected Results for Ava

Based on her data:
- ✅ Book 1 meeting achievement (meetings >= 1)
- ✅ Book 5 meetings achievement (meetings >= 5)
- ✅ 50 calls achievement (call_connects >= 50)
- ✅ 60 minutes talk time (talk_time_minutes >= 60)
- ✅ First opportunity (sourced_opps >= 1)
- ✅ 5 Stage 2 opps (stage2_opps >= 5)
- ✅ 10 Stage 2 opps (stage2_opps >= 10)

**Estimated**: 15-25 achievements, 150-300 points

## Maintenance

### Add New Achievement
```sql
INSERT INTO achievements (
  name,
  description,
  difficulty,
  points,
  skillset_id,
  criteria
) VALUES (
  'Book 20 meetings',
  'Schedule 20 meetings from live calls',
  'medium',
  10,
  (SELECT id FROM skillsets WHERE name = 'Call Conqueror'),
  jsonb_build_object(
    'kpi', 'meetings',
    'threshold', 20,
    'operator', '>=',
    'cumulative', true
  )
);
```

### Update Criteria
```sql
UPDATE achievements 
SET criteria = jsonb_build_object(
  'kpi', 'emails_sent',
  'threshold', 50,
  'operator', '>=',
  'cumulative', true
)
WHERE name = 'Email Champion';
```

### Award New Achievements
After adding new achievements or updating criteria:
```sql
SELECT * FROM check_and_award_achievements();
```

This is safe to run anytime - it only awards achievements that haven't been earned yet.

## Addressing Your Questions

### 1. Analytics vs Dashboard Mismatch
The Analytics page might be using different date filters or aggregation logic. After fixing achievements, we should verify that both pages query the same source tables (`kpi_values`).

### 2. 5-Day Streak Badge with 53% Score
The badge system is separate from achievements. It checks `scorecard_submissions` table for consecutive days where the user met KPIs, not the overall percentage. With only 1 week of data, this might be:
- Bug in streak calculation (checking wrong date range)
- Historical data seeded incorrectly
- Badge criteria different from scorecard attainment

**Check streak data:**
```sql
SELECT 
  p.email,
  ss.week_start_date,
  ss.score,
  ss.streak_count
FROM scorecard_submissions ss
JOIN profiles p ON p.id = ss.profile_id
WHERE p.email = 'ava.carter@apptivia.app'
ORDER BY ss.week_start_date DESC;
```

### 3. One Week of Data = All Time
This is expected for a new system. "All Time" just means "since we started tracking." Once you have multiple weeks, All Time will aggregate across all weeks.

## Next Steps

1. **Run Migration 015** - Populate criteria (takes ~5 seconds)
2. **Run Migration 016** - Install new function (takes ~2 seconds)
3. **Award achievements** - Run SELECT * FROM check_and_award_achievements()
4. **Clear browser cache** and reload
5. **Verify Ava now has correct achievements** on Profile and Coach pages

All views should now align:
- Dashboard: Shows cumulative KPI values ✅
- Profile: Shows earned achievements based on KPIs ✅
- Coach: Shows same earned achievements ✅
- View Details Modal: Shows same earned achievements ✅

---

**Files Created:**
- [015_populate_achievement_criteria.sql](supabase/migrations/015_populate_achievement_criteria.sql)
- [016_criteria_based_achievements.sql](supabase/migrations/016_criteria_based_achievements.sql)
- ACHIEVEMENT_SYSTEM_FIX.md (this file)
