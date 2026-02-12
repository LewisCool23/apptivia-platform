-- =============================================================================
-- CHECK: Where does day_streak get set and is it valid?
-- =============================================================================

-- Query 1: Check all users' day_streak vs actual scorecard data
SELECT 
  p.email,
  p.day_streak,
  COALESCE(SUM(kv.value), 0) as total_scorecards_completed,
  COUNT(DISTINCT kv.period_start) as periods_with_scorecard_data,
  CASE 
    WHEN p.day_streak > 0 AND COALESCE(SUM(kv.value), 0) = 0 
    THEN '⚠️ Has streak but no scorecard data'
    WHEN p.day_streak = 0 AND COALESCE(SUM(kv.value), 0) > 0
    THEN '⚠️ Has scorecard data but no streak'
    ELSE '✓ Consistent'
  END as status
FROM profiles p
LEFT JOIN kpi_values kv ON kv.profile_id = p.id
LEFT JOIN kpi_metrics km ON km.id = kv.kpi_id AND km.key = 'scorecards_completed'
GROUP BY p.id, p.email, p.day_streak
ORDER BY 
  CASE 
    WHEN p.day_streak > 0 AND COALESCE(SUM(kv.value), 0) = 0 THEN 1
    ELSE 2
  END,
  p.day_streak DESC;

-- Query 2: Check if there's a scorecards_completed KPI metric
SELECT 
  id,
  key,
  name,
  description
FROM kpi_metrics
WHERE key LIKE '%scorecard%' OR key LIKE '%streak%';

-- Query 3: Check if day_streak was manually set in migrations
SELECT 
  p.email,
  p.day_streak,
  p.created_at,
  p.updated_at
FROM profiles p
WHERE p.day_streak > 0
ORDER BY p.day_streak DESC
LIMIT 10;
