-- =============================================================================
-- DIAGNOSTIC: Check for Achievement Prerequisite Gaps
-- =============================================================================
-- Run this to see if users actually have missing prerequisite achievements
-- =============================================================================

-- Query 1: Find users who have higher-tier achievements without lower-tier ones
SELECT 
  p.email,
  p.full_name,
  (a_high.criteria->>'kpi') as kpi,
  a_high.name as has_achievement,
  (a_high.criteria->>'threshold')::INT as has_threshold,
  a_low.name as missing_achievement,
  (a_low.criteria->>'threshold')::INT as missing_threshold
FROM profile_achievements pa
JOIN achievements a_high ON a_high.id = pa.achievement_id
JOIN profiles p ON p.id = pa.profile_id
CROSS JOIN achievements a_low
WHERE 
  a_high.criteria IS NOT NULL
  AND a_low.criteria IS NOT NULL
  AND (a_high.criteria->>'kpi') = (a_low.criteria->>'kpi')
  AND (a_high.criteria->>'threshold')::NUMERIC > (a_low.criteria->>'threshold')::NUMERIC
  AND NOT EXISTS (
    SELECT 1 FROM profile_achievements pa2
    WHERE pa2.profile_id = pa.profile_id
      AND pa2.achievement_id = a_low.id
  )
ORDER BY p.email, kpi, missing_threshold
LIMIT 50;

-- Query 2: Count gaps per user
WITH gaps AS (
  SELECT 
    p.id,
    p.email,
    p.full_name,
    COUNT(*) as gap_count
  FROM profile_achievements pa
  JOIN achievements a_high ON a_high.id = pa.achievement_id
  JOIN profiles p ON p.id = pa.profile_id
  CROSS JOIN achievements a_low
  WHERE 
    a_high.criteria IS NOT NULL
    AND a_low.criteria IS NOT NULL
    AND (a_high.criteria->>'kpi') = (a_low.criteria->>'kpi')
    AND (a_high.criteria->>'threshold')::NUMERIC > (a_low.criteria->>'threshold')::NUMERIC
    AND NOT EXISTS (
      SELECT 1 FROM profile_achievements pa2
      WHERE pa2.profile_id = pa.profile_id
        AND pa2.achievement_id = a_low.id
    )
  GROUP BY p.id, p.email, p.full_name
)
SELECT 
  COUNT(*) as users_with_gaps,
  SUM(gap_count) as total_gaps,
  ROUND(AVG(gap_count), 1) as avg_gaps_per_user,
  MAX(gap_count) as max_gaps_one_user
FROM gaps;

-- Query 3: Check a specific example - users with "10 Call Connects" 
SELECT 
  p.email,
  p.full_name,
  a.name as achievement_name,
  (a.criteria->>'threshold')::INT as threshold,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id
      AND a2.name = '1 Call Connects'
  ) as has_1_call_connect,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id
      AND a2.name = '10 Dials Made'
  ) as has_10_dials
FROM profile_achievements pa
JOIN achievements a ON a.id = pa.achievement_id
JOIN profiles p ON p.id = pa.profile_id
WHERE a.name = '10 Call Connects'
ORDER BY p.email;

-- Query 4: Check user's actual KPI values vs achievements they have
SELECT 
  p.email,
  km.key as kpi,
  COALESCE(SUM(kv.value), 0) as total_kpi_value,
  COUNT(DISTINCT pa.achievement_id) as achievements_earned_for_this_kpi,
  STRING_AGG(DISTINCT a.name, ', ' ORDER BY a.name) as achievement_names
FROM profiles p
LEFT JOIN kpi_values kv ON kv.profile_id = p.id
LEFT JOIN kpi_metrics km ON km.id = kv.kpi_id
LEFT JOIN profile_achievements pa ON pa.profile_id = p.id
LEFT JOIN achievements a ON a.id = pa.achievement_id 
  AND (a.criteria->>'kpi') = km.key
WHERE km.key IN ('call_connects', 'dials', 'meetings')
GROUP BY p.email, km.key
HAVING COALESCE(SUM(kv.value), 0) > 0
ORDER BY p.email, km.key
LIMIT 20;
