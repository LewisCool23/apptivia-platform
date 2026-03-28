-- ============================================================================
-- Migration 084: Add direction column + new KPI metrics for Gong, Outreach, Sendoso
-- ============================================================================
-- Adds 'direction' column to kpi_metrics and kpi_metric_history to support
-- "lower is better" KPIs (e.g. talk_to_listen_ratio, longest_monologue_sec).
-- Seeds 11 new KPI metrics. All default to show_on_scorecard = false.
-- ============================================================================

-- ── 1. Add direction column ─────────────────────────────────────────────────

ALTER TABLE kpi_metrics
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'higher'
  CHECK (direction IN ('higher', 'lower'));

ALTER TABLE kpi_metric_history
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'higher';

-- ── 2. Update history trigger to track direction changes ────────────────────

CREATE OR REPLACE FUNCTION fn_kpi_metrics_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO kpi_metric_history
      (kpi_id, goal, weight, show_on_scorecard, is_active, direction, valid_from)
    VALUES
      (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, NEW.direction, now());

  ELSIF TG_OP = 'UPDATE' THEN
    IF (
      OLD.goal              IS DISTINCT FROM NEW.goal              OR
      OLD.weight            IS DISTINCT FROM NEW.weight            OR
      OLD.show_on_scorecard IS DISTINCT FROM NEW.show_on_scorecard OR
      OLD.is_active         IS DISTINCT FROM NEW.is_active         OR
      OLD.direction         IS DISTINCT FROM NEW.direction
    ) THEN
      UPDATE kpi_metric_history
      SET    valid_to = now()
      WHERE  kpi_id   = OLD.id
        AND  valid_to IS NULL;

      INSERT INTO kpi_metric_history
        (kpi_id, goal, weight, show_on_scorecard, is_active, direction, valid_from)
      VALUES
        (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, NEW.direction, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Seed Gong call intelligence KPIs ─────────────────────────────────────

INSERT INTO kpi_metrics (key, name, description, goal, weight, unit, category, direction, show_on_scorecard, scorecard_position, is_active)
VALUES
  ('talk_to_listen_ratio', 'Talk-to-Listen Ratio', 'Percentage of call time the rep talks vs listens. Lower is better — top reps listen more.', 40, 0.10, 'percentage', 'engagement', 'lower', false, 100, true),
  ('longest_monologue_sec', 'Longest Monologue', 'Longest uninterrupted speaking stretch in seconds. Shorter monologues indicate better discovery.', 120, 0.05, 'seconds', 'engagement', 'lower', false, 101, true),
  ('questions_asked', 'Questions Asked / Call', 'Average questions asked per call. More questions correlate with better discovery and deal progression.', 8, 0.05, 'count', 'engagement', 'higher', false, 102, true),
  ('next_steps_mentioned', 'Next Steps Set', 'Number of calls where explicit next steps were established. Strong closing signal.', 5, 0.05, 'count', 'engagement', 'higher', false, 103, true),
  ('interactivity_score', 'Interactivity Score', 'Gong composite engagement metric measuring back-and-forth conversation quality.', 70, 0.05, 'score', 'engagement', 'higher', false, 104, true)
ON CONFLICT (key) DO NOTHING;

-- ── 4. Seed Outreach KPIs ───────────────────────────────────────────────────

INSERT INTO kpi_metrics (key, name, description, goal, weight, unit, category, direction, show_on_scorecard, scorecard_position, is_active)
VALUES
  ('sequences_started', 'Sequences Started', 'Number of outreach sequences initiated. Measures proactive prospecting effort.', 10, 0.05, 'count', 'activity', 'higher', false, 105, true),
  ('emails_opened', 'Emails Opened', 'Number of tracked email opens from outreach campaigns.', 100, 0.05, 'count', 'activity', 'higher', false, 106, true),
  ('tasks_completed', 'Tasks Completed', 'Outreach tasks marked complete. Measures follow-through on sequence steps.', 30, 0.05, 'count', 'activity', 'higher', false, 107, true)
ON CONFLICT (key) DO NOTHING;

-- ── 5. Seed Sendoso KPIs ────────────────────────────────────────────────────

INSERT INTO kpi_metrics (key, name, description, goal, weight, unit, category, direction, show_on_scorecard, scorecard_position, is_active)
VALUES
  ('gifts_sent', 'Gifts Sent', 'Direct mail and gifts sent to prospects/customers via Sendoso.', 10, 0.05, 'count', 'engagement', 'higher', false, 108, true),
  ('gifts_accepted', 'Gifts Accepted', 'Gifts that were accepted or claimed by the recipient.', 5, 0.05, 'count', 'engagement', 'higher', false, 109, true),
  ('gift_influenced_meetings', 'Gift-Influenced Meetings', 'Meetings booked within attribution window after a gift was sent.', 3, 0.05, 'count', 'engagement', 'higher', false, 110, true)
ON CONFLICT (key) DO NOTHING;
