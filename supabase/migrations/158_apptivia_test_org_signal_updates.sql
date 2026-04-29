-- ========================================================================
-- Migration 158: Update Apptivia Test Org signal configs from A1 Market Mapper
--
-- Adds 3 new score overrides on universal signals + 7 new custom signals
-- mapped from ICP segments (Scaling Builder, Performance-Stuck Operator,
-- Hybrid SDR Orchestrator) and Pain Stack (5 pains).
--
-- Source: Marketing Swarm A1 output, grounded in Batch 8-9 research.
-- Org: Apptivia Test Organization (c065a9f9-dd42-496d-bda3-246adcfe7949)
-- ========================================================================

-- ── 1. New Score Overrides on Universal Signals ─────────────────────────────

-- Boost layoffs_restructuring: SDR team cuts = Segment C entry signal
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id, is_enabled, score_override, strength_override
)
SELECT
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  id,
  true,
  78,
  'high'
FROM engage_signal_definitions
WHERE signal_key = 'layoffs_restructuring'
ON CONFLICT (organization_id, signal_definition_id) DO UPDATE
  SET score_override = 78, strength_override = 'high', updated_at = NOW();

-- Boost job_posting_ops: RevOps hire posting = Pain #5 / Segment B
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id, is_enabled, score_override, strength_override
)
SELECT
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  id,
  true,
  80,
  'high'
FROM engage_signal_definitions
WHERE signal_key = 'job_posting_ops'
ON CONFLICT (organization_id, signal_definition_id) DO UPDATE
  SET score_override = 80, strength_override = 'high', updated_at = NOW();

-- Boost tech_stack_change: Tool consolidation = Pain #3
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id, is_enabled, score_override, strength_override
)
SELECT
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  id,
  true,
  72,
  'high'
FROM engage_signal_definitions
WHERE signal_key = 'tech_stack_change'
ON CONFLICT (organization_id, signal_definition_id) DO UPDATE
  SET score_override = 72, strength_override = 'high', updated_at = NOW();

-- ── 2. New Custom Signals ───────────────────────────────────────────────────

-- Segment C core signal: AI SDR Tool Churn / Pullback
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'ai_sdr_tool_churn',
  'AI SDR Tool Churn / Pullback',
  'buyer_intent',
  'Company tried and churned from a pure-play AI SDR tool (11x, Artisan, Rox, Apollo AI). 50-70% of teams trying AI SDR tools churn within 3 months. These are hybrid-ready buyers looking for the intelligence layer AI SDR never delivered.',
  90,
  'very_high',
  true
);

-- Segment C: Hybrid SDR Model Discussion
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'hybrid_sdr_adoption',
  'Hybrid SDR Model Discussion',
  'buyer_intent',
  'Company or leader publicly discussing hybrid SDR strategy, "rethinking AI SDR," or pulling back from pure automation. 41% more deals closed by hybrid teams vs either alone. Indicates readiness for Apptivia orchestration layer.',
  78,
  'high',
  true
);

-- Segment C: SDR Team Rebuild After Cuts
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'sdr_team_rebuild',
  'SDR Team Rebuild After Cuts',
  'company_event',
  'Company that visibly cut SDR team in 2025 (36% of B2B companies did) and is now re-hiring. Rebuild = greenfield for Apptivia Scorecard + Coach from day one of the new team.',
  75,
  'high',
  true
);

-- New ICP persona: GTM Engineer Role Posted
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'gtm_engineer_hire',
  'GTM Engineer Role Posted',
  'company_event',
  'Company posting for a GTM Engineer role — the emerging technical buyer persona that orchestrates sales tools, data flows, and AI automation. GTM Engineers are natural Apptivia champions: they need the data layer underneath GTM.',
  80,
  'high',
  true
);

-- Pain #3: Sales Tool Stack Consolidation
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'tool_consolidation_initiative',
  'Sales Tool Stack Consolidation',
  'buyer_intent',
  'Company actively consolidating sales tool stack — reducing from 10+ tools toward fewer platforms. Budget tightening + tool fatigue drives consolidation toward unified performance intelligence. Apptivia sits above the tools as the decision layer.',
  82,
  'high',
  true
);

-- Pain #5: RevOps Need Without Budget
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'revops_budget_constraint',
  'RevOps Need Without Budget',
  'interest',
  'Company showing indicators of RevOps need (pipeline stalls, no coaching infrastructure, manual reporting) but has not hired or posted for a RevOps role — likely due to $180K-$250K cost barrier. Apptivia delivers 10 of 12 RevOps functions at 13x-17x cost advantage.',
  72,
  'high',
  true
);

-- Pain #1: Coaching by Gut, Not Data
INSERT INTO engage_org_signal_configs (
  id, organization_id, signal_definition_id,
  signal_key, signal_name, category, description,
  default_score, default_strength, is_enabled
) VALUES (
  gen_random_uuid(),
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  NULL,
  'coaching_methodology_gap',
  'Coaching by Gut, Not Data',
  'interest',
  'Company or sales leader expressing that coaching is intuition-based, inconsistent, or unmeasured. "Managers coach by gut," "spend coaching time on whoever is loudest." Scorecard + Aaron directly solves the visibility-to-coaching pipeline.',
  68,
  'medium',
  true
);

-- ── 3. Verification ─────────────────────────────────────────────────────────

DO $$
DECLARE
  override_count INTEGER;
  custom_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO override_count
  FROM engage_org_signal_configs
  WHERE organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
    AND signal_definition_id IS NOT NULL;

  SELECT COUNT(*) INTO custom_count
  FROM engage_org_signal_configs
  WHERE organization_id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
    AND signal_definition_id IS NULL;

  RAISE NOTICE 'Apptivia Test Org signal configs: % overrides, % custom signals',
    override_count, custom_count;
END;
$$;
