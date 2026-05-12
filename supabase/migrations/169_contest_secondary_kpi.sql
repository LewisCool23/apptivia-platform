-- Migration 169: Add secondary KPI tracking to contests (display-only)
--
-- Adds an optional secondary KPI that is tracked and displayed on the
-- leaderboard but does NOT affect ranking (rank is still determined
-- solely by the primary KPI).

-- 1. Add secondary_kpi_key to active_contests
ALTER TABLE active_contests ADD COLUMN IF NOT EXISTS secondary_kpi_key TEXT;

-- 2. Add secondary_score to contest_leaderboards
ALTER TABLE contest_leaderboards ADD COLUMN IF NOT EXISTS secondary_score NUMERIC(10, 2) DEFAULT 0;

-- 3. Update the leaderboard recalculation function to also compute secondary scores
CREATE OR REPLACE FUNCTION update_contest_leaderboards()
RETURNS void AS $$
BEGIN
  -- First: compute primary scores and ranks (unchanged logic)
  WITH contest_scores AS (
    SELECT
      cp.contest_id,
      cp.profile_id,
      cp.team_id,
      ac.calculation_type,
      ac.kpi_key,
      CASE ac.calculation_type
        WHEN 'sum' THEN COALESCE(SUM(kv.value), 0)
        WHEN 'average' THEN COALESCE(AVG(kv.value), 0)
        WHEN 'max' THEN COALESCE(MAX(kv.value), 0)
        WHEN 'count' THEN COALESCE(COUNT(kv.value), 0)
      END as total_score
    FROM contest_participants cp
    LEFT JOIN active_contests ac ON cp.contest_id = ac.id
    LEFT JOIN kpi_metrics km ON km.key = ac.kpi_key
    LEFT JOIN kpi_values kv ON kv.profile_id = cp.profile_id
      AND kv.kpi_id = km.id
      AND kv.period_start <= DATE(ac.end_date)
      AND kv.period_end >= DATE(ac.start_date)
    WHERE ac.status = 'active'
    AND cp.is_active = true
    GROUP BY cp.contest_id, cp.profile_id, cp.team_id, ac.calculation_type, ac.kpi_key
  ),
  ranked_scores AS (
    SELECT
      contest_id,
      profile_id,
      team_id,
      total_score,
      RANK() OVER (PARTITION BY contest_id ORDER BY total_score DESC) as new_rank
    FROM contest_scores
  )
  INSERT INTO contest_leaderboards (contest_id, profile_id, team_id, rank, score, previous_rank)
  SELECT contest_id, profile_id, team_id, new_rank, total_score, new_rank
  FROM ranked_scores
  ON CONFLICT (contest_id, profile_id)
  DO UPDATE SET
    previous_rank = contest_leaderboards.rank,
    rank = EXCLUDED.rank,
    score = EXCLUDED.score,
    last_updated = NOW();

  -- Second: compute secondary scores for contests that have a secondary_kpi_key
  UPDATE contest_leaderboards cl
  SET secondary_score = sub.sec_score
  FROM (
    SELECT
      cp.contest_id,
      cp.profile_id,
      CASE ac.calculation_type
        WHEN 'sum' THEN COALESCE(SUM(kv.value), 0)
        WHEN 'average' THEN COALESCE(AVG(kv.value), 0)
        WHEN 'max' THEN COALESCE(MAX(kv.value), 0)
        WHEN 'count' THEN COALESCE(COUNT(kv.value), 0)
      END as sec_score
    FROM contest_participants cp
    JOIN active_contests ac ON cp.contest_id = ac.id
    JOIN kpi_metrics km ON km.key = ac.secondary_kpi_key
    LEFT JOIN kpi_values kv ON kv.profile_id = cp.profile_id
      AND kv.kpi_id = km.id
      AND kv.period_start <= DATE(ac.end_date)
      AND kv.period_end >= DATE(ac.start_date)
    WHERE ac.status = 'active'
    AND ac.secondary_kpi_key IS NOT NULL
    AND cp.is_active = true
    GROUP BY cp.contest_id, cp.profile_id, ac.calculation_type
  ) sub
  WHERE cl.contest_id = sub.contest_id
  AND cl.profile_id = sub.profile_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN active_contests.secondary_kpi_key IS 'Optional secondary KPI tracked for display only — does not affect ranking';
COMMENT ON COLUMN contest_leaderboards.secondary_score IS 'Score for the secondary KPI (display only, does not affect rank)';
