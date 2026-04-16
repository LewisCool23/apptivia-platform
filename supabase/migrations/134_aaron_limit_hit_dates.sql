-- Persist Aaron daily limit hit events (for upgrade trigger analysis -- complements in-memory _aaronDailyLimits)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aaron_limit_hit_dates jsonb DEFAULT '[]';
-- Array of ISO date strings when the user hit their daily Aaron limit
-- Trimmed to last 30 dates on each write
