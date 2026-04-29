-- ========================================================================
-- Migration 159: Update Apptivia Test Org Sales DNA from Marketing Swarm
--
-- Sources: A2 Offer Architecture, A5 Nurture Orchestrator, A6 Conversion Closer
-- Replaces the default Challenger + MEDDPICC config (migration 096) with
-- Apptivia's proprietary 6-Phase Consultative Close methodology.
--
-- Single source of truth: organizations.sales_dna JSONB column.
-- Backend getSalesDnaContext() now reads from this column directly
-- (previously read from a sales_dna_configs table that never existed).
--
-- Extended fields added to the JSONB: coaching_philosophy, key_terminology,
-- custom_stages. These are invisible to the frontend SalesDnaConfig type
-- but the backend reads them for Aaron's coaching context.
--
-- Org: Apptivia Test Organization (c065a9f9-dd42-496d-bda3-246adcfe7949)
-- ========================================================================

-- ── 1. Update organizations.sales_dna JSONB (single source of truth) ────────

UPDATE organizations
SET sales_dna = '{
  "methodology_approach": "custom",
  "primary_methodology": null,
  "secondary_methodology": null,
  "custom_methodology_name": "6-Phase Consultative Close",
  "custom_methodology_principles": [
    "Frame Takeover: Set the conversation frame in 60-120 seconds. Establish yourself as guide, not vendor. Promise to diagnose before pitching. End with Fair? to install the frame.",
    "Problem Deep Dive: Get the buyer to FEEL the pain, not describe it. Use layered questions (opener, context, specifics, cost reveal, urgency). Write down exact phrases - they come back in Phase 4 verbatim.",
    "Belief Flip: Challenge the buyers current approach without attacking them. Use Belief Triangle (Current Vehicle to Dream Outcome to New Vehicle). Diagnose which belief is weak (Mechanism, Urgency, or Trust) and attack only that one.",
    "New Vehicle Intro: Show product only after earning the right. Mirror buyers exact pain phrases as use cases. Compress time-to-win (10min setup, Week 1 anomaly, Week 2 coaching plan, Week 4 KPI delta). Position in Category of One.",
    "Clarity Close: Do not ask do you want to buy - ask does this make sense for you? Use buyers own words. Three questions: Does it fit? Any reason not to start? Who else needs to decide?",
    "Objection Neutralizer: Objections are requests for reassurance, not rejections. Never argue - always ask. Use Friction-to-Fuel reframes. Tell Me Where It Breaks technique hands objection control to buyer."
  ],
  "qualification_framework": "meddpicc",
  "methodology_stage_mapping": [],
  "custom_stages": [
    {"name": "Frame Takeover", "description": "Set conversation frame, qualify lead source, establish diagnose-before-pitch commitment"},
    {"name": "Problem Deep Dive", "description": "Layered questions on 5 core pains, capture exact buyer phrases, run disqualification check (segment, pain rank, economic buyer, budget trigger, team size)"},
    {"name": "Belief Flip", "description": "Challenge current approach via Belief Triangle — diagnose weak belief (Mechanism, Urgency, or Trust) and attack only that one using analogy"},
    {"name": "New Vehicle Intro", "description": "Demo mapped to buyers specific pain using their exact phrases, Time-to-Win compression (10min to Week 4), Category of One positioning"},
    {"name": "Clarity Close", "description": "Mirror buyers words back, three questions (fit, timing, decision-maker), enrollment transitions, stop selling once yes is clear"},
    {"name": "Objection Neutralizer", "description": "12 Friction-to-Fuel reframes, Tell Me Where It Breaks technique, never argue — always ask, handle compared to what on pricing"}
  ],
  "coaching_philosophy": "Rep-first, never surveillance. Diagnose before prescribing — earn the right to coach by understanding the specific skill gap from KPI data, not generic advice. Measure coaching ROI in dollars via Sales Velocity (Opportunities x Deal Size x Win Rate / Cycle Length). Every coaching recommendation is scored against which Sales Velocity lever it moves and by how much. Earn the right to automate maturity model: Dashboard then Alerts then Coaching then Autopilot — do not show advanced features until basics are configured. Willingness to disqualify: if Apptivia is not the right fit, say so and point them somewhere useful. Use buyers exact language (mirroring) — never paraphrase high-charge phrases.",
  "key_terminology": {
    "Sales Performance Intelligence": "The category Apptivia owns — not conversation intelligence, not sales engagement, not gamification, not an AI SDR. The closed-loop layer that turns data from every tool into one answer: who needs coaching on what, this week.",
    "Sales Velocity": "(Opportunities x Deal Size x Win Rate) / Cycle Length — the composite metric every coaching recommendation is scored against. The four levers map to existing Scorecard KPIs.",
    "6-Week Coaching Gap": "The delay between when a reps KPIs start drifting (Week 2) and when a manager detects it (Week 9). By Week 9 its a PIP, not a coaching plan. Apptivia catches it in Week 2.",
    "RevOps Replacement Math": "10 of 12 benchmark RevOps functions productized at 13-17x cost advantage. 25 seats x $49 x 12 = $14,700/yr vs $180K-$250K fully loaded RevOps hire.",
    "Hybrid SDR Orchestration": "Human 60% + AI 40% model. Teams running hybrid close 41% more deals than either alone. Scorecard measures human side, Engage automates repetitive 40%, Aaron coaches the skill gap.",
    "Time-to-Win": "10min setup (first scorecard) -> Week 1 (first anomaly detected) -> Week 2 (first coaching plan drafted) -> Week 4 (first measurable KPI delta).",
    "Belief Triangle": "Current Vehicle (what buyer does today) -> Dream Outcome (what they want) -> New Vehicle (Apptivia as the bridge). Diagnose which of three beliefs is weak: Mechanism, Urgency, Trust.",
    "Friction-to-Fuel": "Reframing every objection from blocker to feature. Another tool becomes on top of your tools. My team will rebel becomes rep-first by design. 12 reframes in the library."
  }
}'::jsonb
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';

-- ── 2. Verification ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org_dna JSONB;
  principles_count INTEGER;
  stages_count INTEGER;
  terms_count INTEGER;
BEGIN
  SELECT sales_dna INTO org_dna
  FROM organizations
  WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';

  IF org_dna->>'methodology_approach' != 'custom' THEN
    RAISE EXCEPTION 'methodology_approach is %, expected custom', org_dna->>'methodology_approach';
  END IF;

  IF org_dna->>'custom_methodology_name' != '6-Phase Consultative Close' THEN
    RAISE EXCEPTION 'custom_methodology_name mismatch';
  END IF;

  principles_count := jsonb_array_length(org_dna->'custom_methodology_principles');
  stages_count := jsonb_array_length(org_dna->'custom_stages');
  terms_count := (SELECT COUNT(*) FROM jsonb_object_keys(org_dna->'key_terminology'));

  IF principles_count != 6 THEN
    RAISE EXCEPTION 'Expected 6 principles, got %', principles_count;
  END IF;

  RAISE NOTICE 'Sales DNA updated — methodology: 6-Phase Consultative Close, % principles, % stages, % key terms, qualification: MEDDPICC, coaching philosophy: set',
    principles_count, stages_count, terms_count;
END;
$$;
