-- ============================================================
-- Migration 125: active_contests — add winner_finalized_at
-- ============================================================
-- Adds a timestamp column so the contest-complete cron can
-- skip contests it already finalized, preventing double-award
-- of winner badges and notifications.
-- ============================================================

ALTER TABLE active_contests
  ADD COLUMN IF NOT EXISTS winner_finalized_at TIMESTAMPTZ;
