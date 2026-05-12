-- Migration 168: Fix contest leaderboard date filter to use overlap logic
--
-- The original update_contest_leaderboards() RPC used containment logic:
--   kv.period_start >= DATE(ac.start_date) AND kv.period_end <= DATE(ac.end_date)
-- This excludes any KPI week that isn't fully contained within the contest dates,
-- meaning non-Monday-start or non-Sunday-end contests get zero scores.
--
-- Fix: use overlap logic (same as useScorecardData.ts and contestUtils.ts):
--   kv.period_start <= DATE(ac.end_date) AND kv.period_end >= DATE(ac.start_date)

CREATE OR REPLACE FUNCTION update_contest_leaderboards()
RETURNS void AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;
