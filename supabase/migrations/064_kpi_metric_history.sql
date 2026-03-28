-- ============================================================================
-- Migration 064: KPI Metric History (Point-in-Time Config Tracking)
-- ============================================================================
-- Problem: kpi_metrics stores only the CURRENT goal/weight. When an admin
-- changes a goal, every historical scorecard period is retroactively
-- recalculated against the new goal — making history unstable.
--
-- Solution: kpi_metric_history records every configuration state with
-- valid_from / valid_to timestamps. Historical score queries join to this
-- table and always see the goal/weight that was in effect at the time.
--
-- A DB trigger on kpi_metrics auto-inserts a history row on every INSERT
-- and closes/reopens on every relevant UPDATE (goal, weight,
-- show_on_scorecard, is_active).
-- ============================================================================

-- ── 1. History table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kpi_metric_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id           uuid        NOT NULL REFERENCES kpi_metrics(id) ON DELETE CASCADE,
  goal             numeric     NOT NULL,
  weight           numeric     NOT NULL,
  show_on_scorecard boolean    NOT NULL DEFAULT false,
  is_active        boolean     NOT NULL DEFAULT true,
  -- valid_from: moment this config became active
  -- valid_to:   moment it was superseded (NULL = still active)
  valid_from       timestamptz NOT NULL,
  valid_to         timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kmh_kpi_id    ON kpi_metric_history(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kmh_valid_from ON kpi_metric_history(valid_from);
CREATE INDEX IF NOT EXISTS idx_kmh_valid_to   ON kpi_metric_history(valid_to);

-- ── 2. Backfill ───────────────────────────────────────────────────────────────
-- Seed current kpi_metrics state as the baseline history row for every KPI.
-- valid_from = 2026-01-12: the earliest date in kpi_values (migration 002
-- seed data). All data before this implementation uses this baseline config.
-- valid_to = NULL (still active — will be closed when the next change fires).

INSERT INTO kpi_metric_history
  (kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
SELECT
  id,
  goal,
  weight,
  show_on_scorecard,
  is_active,
  '2026-01-12 00:00:00+00'::timestamptz
FROM kpi_metrics
ON CONFLICT DO NOTHING;

-- ── 3. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_kpi_metrics_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New KPI: open its first history row
    INSERT INTO kpi_metric_history
      (kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
    VALUES
      (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only capture a new history row when score-relevant columns change.
    -- IS DISTINCT FROM handles NULL comparisons correctly.
    IF (
      OLD.goal             IS DISTINCT FROM NEW.goal             OR
      OLD.weight           IS DISTINCT FROM NEW.weight           OR
      OLD.show_on_scorecard IS DISTINCT FROM NEW.show_on_scorecard OR
      OLD.is_active        IS DISTINCT FROM NEW.is_active
    ) THEN
      -- Close the currently-active history row
      UPDATE kpi_metric_history
      SET    valid_to = now()
      WHERE  kpi_id   = OLD.id
        AND  valid_to IS NULL;

      -- Open a new history row with the updated values
      INSERT INTO kpi_metric_history
        (kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
      VALUES
        (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kpi_metrics_history ON kpi_metrics;

CREATE TRIGGER trg_kpi_metrics_history
AFTER INSERT OR UPDATE ON kpi_metrics
FOR EACH ROW
EXECUTE FUNCTION fn_kpi_metrics_history();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE kpi_metric_history ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (scorecard hooks query this directly)
CREATE POLICY "kpi_metric_history_read"
  ON kpi_metric_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can write (trigger writes as the DB user, not via client)
-- No client-facing INSERT/UPDATE/DELETE policy needed.
