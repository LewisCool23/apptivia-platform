-- Migration 142: Aaron daily message counts + RPCs
--
-- Moves the Starter plan daily message limit from in-memory (_aaronDailyLimits)
-- to a DB-backed table. In-memory state resets on PM2 restart, allowing users
-- to bypass the 10-message/day limit. DB persistence fixes this.
--
-- Pattern: check BEFORE Anthropic call, increment AFTER success (fire-and-forget).
-- This avoids charging a message slot for failed API calls.

BEGIN;

CREATE TABLE IF NOT EXISTS aaron_daily_message_counts (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day     DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Check daily limit — returns current count WITHOUT incrementing.
-- Called BEFORE the Anthropic API call.
CREATE OR REPLACE FUNCTION check_aaron_daily_limit(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT count INTO current_count
  FROM aaron_daily_message_counts
  WHERE user_id = p_user_id AND day = CURRENT_DATE;

  RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Increment daily count AFTER successful Anthropic response.
-- Uses INSERT ON CONFLICT for atomicity (same pattern as upsert_kpi_sum).
CREATE OR REPLACE FUNCTION increment_aaron_daily_count(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO aaron_daily_message_counts (user_id, day, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, day)
  DO UPDATE SET count = aaron_daily_message_counts.count + 1;
END;
$$ LANGUAGE plpgsql;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('142', 'aaron_daily_message_counts', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
