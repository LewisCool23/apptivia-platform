-- =============================================================================
-- CHECK FOR CROSS-KPI PREREQUISITE ISSUE
-- =============================================================================
-- The problem: Users have "10 Call Connects" but not "10 Dials Made"
-- This is a CROSS-KPI issue (call_connects vs dials)
-- =============================================================================

-- Query 1: Check if users with call_connects achievements also have dials achievements
SELECT 
  p.email,
  p.full_name,
  -- Call Connects data
  COALESCE(SUM(CASE WHEN km.key = 'call_connects' THEN kv.value ELSE 0 END), 0) as total_call_connects,
  COUNT(DISTINCT CASE WHEN a.criteria->>'kpi' = 'call_connects' THEN a.id END) as call_connect_achievements,
  -- Dials data
  COALESCE(SUM(CASE WHEN km.key = 'dials' THEN kv.value ELSE 0 END), 0) as total_dials,
  COUNT(DISTINCT CASE WHEN a.criteria->>'kpi' = 'dials' THEN a.id END) as dials_achievements,
  -- Checks
  (COUNT(DISTINCT CASE WHEN a.criteria->>'kpi' = 'call_connects' THEN a.id END) > 0 
   AND COUNT(DISTINCT CASE WHEN a.criteria->>'kpi' = 'dials' THEN a.id END) = 0) as has_connects_but_no_dials,
  -- Show which call_connects achievements they have
  STRING_AGG(DISTINCT CASE WHEN a.criteria->>'kpi' = 'call_connects' THEN a.name END, ', ' ORDER BY CASE WHEN a.criteria->>'kpi' = 'call_connects' THEN a.name END) as connect_achievements
FROM profiles p
LEFT JOIN kpi_values kv ON kv.profile_id = p.id
LEFT JOIN kpi_metrics km ON km.id = kv.kpi_id AND km.key IN ('call_connects', 'dials')
LEFT JOIN profile_achievements pa ON pa.profile_id = p.id
LEFT JOIN achievements a ON a.id = pa.achievement_id AND a.criteria->>'kpi' IN ('call_connects', 'dials')
GROUP BY p.id, p.email, p.full_name
HAVING COUNT(DISTINCT CASE WHEN a.criteria->>'kpi' = 'call_connects' THEN a.id END) > 0
ORDER BY has_connects_but_no_dials DESC, p.email
LIMIT 20;

-- Query 2: Check specific users - do they have "1 Dials Made" achievement?
SELECT 
  p.email,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '1 Dials Made'
  ) as has_1_dials,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '10 Dials Made'
  ) as has_10_dials,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '1 Call Connects'
  ) as has_1_call_connect,
  EXISTS (
    SELECT 1 FROM profile_achievements pa2
    JOIN achievements a2 ON a2.id = pa2.achievement_id
    WHERE pa2.profile_id = p.id AND a2.name = '10 Call Connects'
  ) as has_10_call_connects
FROM profiles p
WHERE p.email IN (
  'alex.rivera@apptivia.app',
  'jordan.smith@apptivia.app',
  'benjamin.webb@apptivia.app'
)
ORDER BY p.email;

-- Query 3: Check if "Dials Made" achievements even exist in the database
SELECT 
  name,
  (criteria->>'kpi') as kpi,
  (criteria->>'threshold')::INT as threshold
FROM achievements
WHERE name LIKE '%Dials%' OR name LIKE '%Dial%'
ORDER BY (criteria->>'threshold')::INT;

-- Query 4: Count achievements by KPI type
SELECT 
  (criteria->>'kpi') as kpi,
  COUNT(*) as achievement_count,
  MIN((criteria->>'threshold')::INT) as min_threshold,
  MAX((criteria->>'threshold')::INT) as max_threshold
FROM achievements
WHERE criteria IS NOT NULL
GROUP BY (criteria->>'kpi')
ORDER BY kpi;
