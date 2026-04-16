-- ============================================================
-- Migration 121: engage_intent_signals — add signal_tier & respond_by
-- ============================================================
-- Enables the 3-tier signal classification system and SLA response
-- windows used by runAutoQualification() and the action queue builder.
--
-- signal_tier values: 'tier1' | 'tier2' | 'tier3'
--   tier1 = high-intent buying signals (24h SLA)
--   tier2 = company event signals (168h / 7-day SLA)
--   tier3 = weak/passive signals (no SLA enforced)
--
-- respond_by = computed timestamp: detected_at + tier SLA hours
-- ============================================================

-- Step 1: Add signal_tier column (text, nullable — populated by cron after detection)
ALTER TABLE engage_intent_signals
  ADD COLUMN IF NOT EXISTS signal_tier TEXT
    CHECK (signal_tier IN ('tier1', 'tier2', 'tier3'));

-- Step 2: Add respond_by column (timestamptz, nullable — null = no SLA for tier3)
ALTER TABLE engage_intent_signals
  ADD COLUMN IF NOT EXISTS respond_by TIMESTAMPTZ;

-- Step 3: Index on signal_tier for filtered queries in action queue builder
--   Used by: .or('signal_score.gte.75,signal_tier.eq.tier1')
CREATE INDEX IF NOT EXISTS idx_engage_intent_signals_signal_tier
  ON engage_intent_signals (signal_tier)
  WHERE signal_tier IS NOT NULL;

-- Step 4: Index on respond_by for SLA expiry queries (future dashboard use)
CREATE INDEX IF NOT EXISTS idx_engage_intent_signals_respond_by
  ON engage_intent_signals (organization_id, respond_by)
  WHERE respond_by IS NOT NULL;

-- Step 5: Backfill existing rows — classify by signal_score as a reasonable proxy
--   tier1: score >= 75, tier2: score >= 40, tier3: below 40
--   respond_by is left NULL for historical rows (SLA window not retroactively meaningful)
UPDATE engage_intent_signals
SET signal_tier = CASE
  WHEN signal_score >= 75 THEN 'tier1'
  WHEN signal_score >= 40 THEN 'tier2'
  ELSE 'tier3'
END
WHERE signal_tier IS NULL;
