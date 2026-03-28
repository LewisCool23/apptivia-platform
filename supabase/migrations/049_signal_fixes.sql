-- Migration 049: Signal database fixes
-- 1. Add 3 Glassdoor signal definitions to the universal library
-- 2. Add partial unique index on engage_intent_signals to prevent cross-scan duplicates

-- ============================================================
-- 1. Glassdoor signal definitions (active in pipeline since 048 but missing from library)
-- ============================================================

INSERT INTO engage_signal_definitions
  (signal_key, signal_name, category, description, default_score, default_strength, is_universal, sort_order)
VALUES
  (
    'glassdoor_leadership_concern',
    'Glassdoor: Leadership Concern',
    'company_event',
    'Employees are publicly flagging leadership or management issues on Glassdoor. Indicates instability at the top — a natural forcing function for vendor re-evaluation.',
    68, 'high', true, 106
  ),
  (
    'glassdoor_culture_issue',
    'Glassdoor: Culture Issue',
    'company_event',
    'Employees cite toxic culture, poor morale, or burnout in Glassdoor reviews. High attrition risk — companies in this state often seek tools that improve team performance visibility.',
    62, 'medium', true, 107
  ),
  (
    'glassdoor_rating_decline',
    'Glassdoor: Rating Decline',
    'company_event',
    'Company overall Glassdoor rating is declining. A falling rating signals internal dysfunction — often precedes leadership changes and tool/process overhauls.',
    60, 'medium', true, 108
  )
ON CONFLICT (signal_key) DO NOTHING;


-- ============================================================
-- 2. Partial unique index — prevents duplicate signals from
--    repeated scans on the same article + company + org
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_signals_dedup
  ON engage_intent_signals (organization_id, company_name, source_url)
  WHERE source_url IS NOT NULL;
