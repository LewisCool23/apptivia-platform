-- Migration 093: Seed realistic performance dips for KPI Watchdog demo
--
-- Introduces deliberate drops in the most recent seeded week (March 16-22)
-- for 3 reps, so the Watchdog detects meaningful anomalies when comparing
-- against the 4-week rolling average.
--
-- Affected reps:
--   Sarah Johnson  — top performer has a bad week (vacation/sick): activity KPIs ~50% drop
--   Jordan Smith   — pipeline slump: pipeline + deal KPIs ~40% drop
--   Testington Passalot — bottom performer collapses: most KPIs ~60% drop
--
-- Only updates the March 16-22 week. Historical data stays intact so the
-- rolling average remains realistic.

-- ── Sarah Johnson: activity slump (simulates vacation/sick week) ────────────
-- Drop call_connects, talk_time, dials, meetings, emails_sent, conversations, follow_ups
UPDATE kpi_values SET value = ROUND(value * 0.45, 1)
WHERE period_start = '2026-03-16'
  AND period_end = '2026-03-22'
  AND profile_id = (SELECT id FROM profiles WHERE first_name = 'Sarah' AND last_name = 'Johnson' LIMIT 1)
  AND kpi_id IN (
    SELECT id FROM kpi_metrics WHERE key IN (
      'call_connects', 'talk_time_minutes', 'dials', 'meetings',
      'emails_sent', 'conversations', 'follow_ups', 'discovery_calls'
    )
  );

-- Her response_time also worsens (higher = worse for lower-is-better)
UPDATE kpi_values SET value = ROUND(value * 2.5, 1)
WHERE period_start = '2026-03-16'
  AND period_end = '2026-03-22'
  AND profile_id = (SELECT id FROM profiles WHERE first_name = 'Sarah' AND last_name = 'Johnson' LIMIT 1)
  AND kpi_id IN (SELECT id FROM kpi_metrics WHERE key = 'response_time');

-- ── Jordan Smith: pipeline slump ────────────────────────────────────────────
-- Drop sourced_opps, stage2_opps, stage3_opps, pipeline_created, pipeline_advanced,
-- closed_won, revenue_generated
UPDATE kpi_values SET value = ROUND(value * 0.55, 1)
WHERE period_start = '2026-03-16'
  AND period_end = '2026-03-22'
  AND profile_id = (SELECT id FROM profiles WHERE first_name = 'Jordan' AND last_name = 'Smith' LIMIT 1)
  AND kpi_id IN (
    SELECT id FROM kpi_metrics WHERE key IN (
      'sourced_opps', 'stage2_opps', 'stage3_opps', 'pipeline_created',
      'pipeline_advanced', 'closed_won', 'revenue_generated', 'qualified_leads'
    )
  );

-- Jordan's sales cycle lengthens (worse for lower-is-better)
UPDATE kpi_values SET value = ROUND(value * 1.8, 1)
WHERE period_start = '2026-03-16'
  AND period_end = '2026-03-22'
  AND profile_id = (SELECT id FROM profiles WHERE first_name = 'Jordan' AND last_name = 'Smith' LIMIT 1)
  AND kpi_id IN (SELECT id FROM kpi_metrics WHERE key = 'sales_cycle_days');

-- ── Testington Passalot: across-the-board collapse ──────────────────────────
-- Already a bottom performer — drops further on engagement + outreach KPIs
UPDATE kpi_values SET value = ROUND(value * 0.35, 1)
WHERE period_start = '2026-03-16'
  AND period_end = '2026-03-22'
  AND profile_id = (SELECT id FROM profiles WHERE first_name = 'Testington' AND last_name = 'Passalot' LIMIT 1)
  AND kpi_id IN (
    SELECT id FROM kpi_metrics WHERE key IN (
      'sequences_created', 'prospects_enrolled', 'sequence_replies',
      'engage_signals_actioned', 'engage_deals_influenced',
      'demos_completed', 'social_touches', 'outreach_drafts_sent'
    )
  );
