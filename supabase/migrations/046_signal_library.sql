-- Migration 046: Universal Signal Library + Org-Specific Signal Configs
-- Introduces a global signal definition library that all orgs get by default,
-- plus per-org overrides and custom signals.
--
-- Design:
--   engage_signal_definitions  — global, is_universal = true means every org gets it
--   engage_org_signal_configs  — per-org: disable/override universal signals, or add custom ones
--
-- Query pattern for "signals active for org X":
--   All universal+active definitions
--   MINUS those the org has explicitly disabled
--   UNION org's custom signals (signal_definition_id IS NULL)
--   WITH score/strength overrides applied where set


-- ============================================================
-- 1. SIGNAL DEFINITIONS — Global library
-- ============================================================

CREATE TABLE IF NOT EXISTS engage_signal_definitions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identifier that maps to engage_intent_signals.signal_type
  signal_key      TEXT NOT NULL UNIQUE,      -- e.g. 'funding_round', 'leadership_change'
  signal_name     TEXT NOT NULL,             -- e.g. 'Funding Round'

  -- Classification
  category        TEXT NOT NULL CHECK (category IN (
    'buyer_intent',   -- high-intent: actively evaluating or ready to buy
    'interest',       -- softer: early-stage awareness or engagement
    'company_event',  -- trigger events: growth, change, or motion signals
    'universal'       -- generic, applies broadly
  )),

  description     TEXT,
  default_score   INTEGER DEFAULT 50 CHECK (default_score >= 0 AND default_score <= 100),
  default_strength TEXT DEFAULT 'medium' CHECK (default_strength IN ('low', 'medium', 'high', 'very_high')),

  -- Universal signals are available to all orgs without any config entry
  is_universal    BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,

  -- Display
  icon            TEXT,        -- optional icon key for the UI
  sort_order      INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_defs_category ON engage_signal_definitions(category);
CREATE INDEX IF NOT EXISTS idx_signal_defs_universal ON engage_signal_definitions(is_universal, is_active);


-- ============================================================
-- 2. ORG SIGNAL CONFIGS — Per-org overrides and custom signals
-- ============================================================

CREATE TABLE IF NOT EXISTS engage_org_signal_configs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- If referencing a universal signal: override or disable it
  -- If NULL: this row IS a custom signal definition for this org
  signal_definition_id UUID REFERENCES engage_signal_definitions(id) ON DELETE CASCADE,

  -- For universal signal overrides
  is_enabled      BOOLEAN DEFAULT true,      -- set false to disable a universal signal for this org
  score_override  INTEGER CHECK (score_override >= 0 AND score_override <= 100),
  strength_override TEXT CHECK (strength_override IN ('low', 'medium', 'high', 'very_high')),

  -- For custom signals (signal_definition_id IS NULL) — must supply these
  signal_key      TEXT,        -- must be unique per org; maps to engage_intent_signals.signal_type
  signal_name     TEXT,
  category        TEXT CHECK (category IN ('buyer_intent', 'interest', 'company_event', 'universal')),
  description     TEXT,
  default_score   INTEGER DEFAULT 50 CHECK (default_score >= 0 AND default_score <= 100),
  default_strength TEXT DEFAULT 'medium' CHECK (default_strength IN ('low', 'medium', 'high', 'very_high')),
  icon            TEXT,

  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- One override row per universal signal per org
  UNIQUE(organization_id, signal_definition_id),

  -- Custom signals must have a key, name, and category
  CONSTRAINT chk_custom_signal_fields CHECK (
    signal_definition_id IS NOT NULL
    OR (signal_key IS NOT NULL AND signal_name IS NOT NULL AND category IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_org_signal_configs_org ON engage_org_signal_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_signal_configs_def ON engage_org_signal_configs(signal_definition_id);
CREATE INDEX IF NOT EXISTS idx_org_signal_configs_enabled ON engage_org_signal_configs(organization_id, is_enabled);

-- Unique index for custom signals (signal_definition_id IS NULL) to prevent duplicate keys per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_signal_configs_custom_key
  ON engage_org_signal_configs(organization_id, signal_key)
  WHERE signal_definition_id IS NULL;

-- RLS
ALTER TABLE engage_signal_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_org_signal_configs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist (makes migration idempotent)
DROP POLICY IF EXISTS "Anyone can view signal definitions" ON engage_signal_definitions;
DROP POLICY IF EXISTS "Service role manages signal definitions" ON engage_signal_definitions;
DROP POLICY IF EXISTS "Users can view org signal configs" ON engage_org_signal_configs;
DROP POLICY IF EXISTS "Admins can manage org signal configs" ON engage_org_signal_configs;

-- Signal definitions are globally readable (no org restriction)
CREATE POLICY "Anyone can view signal definitions" ON engage_signal_definitions
  FOR SELECT USING (true);

-- Only service role can insert/update definitions
CREATE POLICY "Service role manages signal definitions" ON engage_signal_definitions
  FOR ALL USING (auth.role() = 'service_role');

-- Org signal configs: users see/manage their org's configs
CREATE POLICY "Users can view org signal configs" ON engage_org_signal_configs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage org signal configs" ON engage_org_signal_configs
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );


-- ============================================================
-- 3. HELPER VIEW — Resolved signals per org
--    Returns the effective signal list for a given org,
--    merging universal definitions + org overrides + custom signals.
-- ============================================================

CREATE OR REPLACE VIEW engage_resolved_signals AS
  -- Universal signals (with no org context — used for joining)
  SELECT
    sd.id                         AS definition_id,
    NULL::UUID                    AS org_config_id,
    NULL::UUID                    AS organization_id,
    sd.signal_key,
    sd.signal_name,
    sd.category,
    sd.description,
    sd.default_score              AS effective_score,
    sd.default_strength           AS effective_strength,
    sd.icon,
    sd.sort_order,
    true                          AS is_universal,
    true                          AS is_enabled,
    sd.created_at
  FROM engage_signal_definitions sd
  WHERE sd.is_universal = true AND sd.is_active = true

  UNION ALL

  -- Org custom signals
  SELECT
    NULL::UUID                    AS definition_id,
    osc.id                        AS org_config_id,
    osc.organization_id,
    osc.signal_key,
    osc.signal_name,
    osc.category,
    osc.description,
    osc.default_score             AS effective_score,
    osc.default_strength          AS effective_strength,
    osc.icon,
    0                             AS sort_order,
    false                         AS is_universal,
    true                          AS is_enabled,
    osc.created_at
  FROM engage_org_signal_configs osc
  WHERE osc.signal_definition_id IS NULL;  -- custom only


-- ============================================================
-- 4. SEED: Universal / Evergreen B2B Prospecting Signals
-- ============================================================

INSERT INTO engage_signal_definitions
  (signal_key, signal_name, category, description, default_score, default_strength, is_universal, sort_order)
VALUES
-- ON CONFLICT: skip rows that already exist (idempotent re-runs)

  -- Company Events (trigger events — growth, change, motion)
  ('funding_round',
   'Funding Round',
   'company_event',
   'Company recently closed a funding round (Seed, Series A/B/C, etc.). Indicates budget availability and growth mode.',
   72, 'high', true, 10),

  ('leadership_change',
   'Leadership Change',
   'company_event',
   'New C-suite or VP-level hire (CEO, CRO, VP Sales, VP Marketing). New leaders evaluate and replace vendors in their first 90 days.',
   78, 'high', true, 20),

  ('sales_leadership_hire',
   'Sales Leadership Hire',
   'company_event',
   'Specifically hired a VP of Sales, Sales Director, or Head of Revenue. Strongest leadership trigger for sales tool evaluation.',
   82, 'high', true, 25),

  ('headcount_growth',
   'Headcount Growth',
   'company_event',
   'Company is actively growing its team, indicating expansion mode and potential new budget.',
   60, 'medium', true, 30),

  ('sales_team_expansion',
   'Sales Team Expansion',
   'company_event',
   'Company is hiring multiple sales reps or SDRs. Scaling sales = new management and tooling challenges.',
   70, 'high', true, 35),

  ('sales_enablement_hire',
   'Sales Enablement Hire',
   'company_event',
   'Job posting or hire for a Sales Enablement Manager or Revenue Enablement role. Signals investment in sales effectiveness.',
   74, 'high', true, 40),

  ('ma_activity',
   'M&A Activity',
   'company_event',
   'Company involved in a merger or acquisition. Often triggers technology stack consolidation and vendor re-evaluation.',
   65, 'medium', true, 50),

  ('company_expansion',
   'Company Expansion',
   'company_event',
   'Opening new offices, entering new markets, or expanding geographically.',
   55, 'medium', true, 60),

  -- Interest Signals (early-stage awareness or engagement)
  ('tech_stack_change',
   'Tech Stack Change',
   'interest',
   'Company recently added or dropped a significant tool. Indicates openness to new technology purchases.',
   58, 'medium', true, 70),

  ('crm_adoption',
   'CRM Adoption',
   'interest',
   'Company recently adopted a CRM (Salesforce, HubSpot, etc.). Signals structured sales process emerging — a natural time to layer on performance tools.',
   68, 'high', true, 75),

  ('news_mention',
   'News / Press Mention',
   'interest',
   'Company featured in news or press release. Indicates public momentum and a good hook for outreach.',
   38, 'low', true, 80),

  ('social_activity_spike',
   'Social Media Activity Spike',
   'interest',
   'Unusual increase in company or key contact social media engagement. Indicates active thought leadership or upcoming initiative.',
   42, 'low', true, 85),

  ('content_engagement',
   'Content Engagement',
   'interest',
   'Key contacts from the company consuming blog posts, whitepapers, or case studies in your category.',
   45, 'medium', true, 90),

  ('job_posting_ops',
   'Sales Ops / RevOps Job Posting',
   'interest',
   'Company posting for Sales Operations or Revenue Operations roles. Signals investment in sales infrastructure and data.',
   62, 'medium', true, 95),

  ('review_site_activity',
   'Review Site Activity',
   'interest',
   'Company employees leaving or researching reviews on G2, Capterra, or TrustRadius for tools in your category.',
   65, 'medium', true, 100),

  -- ── Additional Company Events ──────────────────────────────

  ('executive_departure',
   'Executive Departure',
   'company_event',
   'Senior executive leaving the company. Departures in Sales, Operations, or Finance often trigger vendor re-evaluation and new budget ownership.',
   70, 'high', true, 105),

  ('ipo_or_spac',
   'IPO / SPAC Filing',
   'company_event',
   'Company filed for IPO or is going public via SPAC. Significant budget expansion, new compliance needs, and vendor upgrades typically follow.',
   75, 'high', true, 110),

  ('private_equity_investment',
   'Private Equity Investment',
   'company_event',
   'PE firm acquired or invested in the company. PE-backed companies face intense performance pressure and often upgrade tooling to hit targets.',
   78, 'high', true, 115),

  ('layoffs_restructuring',
   'Layoffs / Restructuring',
   'company_event',
   'Company announced layoffs or a restructure. Often followed by efficiency tool purchases to do more with fewer people.',
   68, 'medium', true, 120),

  ('strategic_partnership',
   'Strategic Partnership Announced',
   'company_event',
   'New partnership or integration announcement. Signals growth mode and often new co-selling or channel motion that requires tooling.',
   55, 'medium', true, 125),

  ('product_launch',
   'New Product Launch',
   'company_event',
   'Company launched a new product or major feature. New launches require sales team enablement and often drive hiring.',
   58, 'medium', true, 130),

  ('new_market_entry',
   'New Market Entry',
   'company_event',
   'Entering a new geographic market or new vertical. Signals expansion requiring new sales motions, processes, and tools.',
   65, 'medium', true, 135),

  ('rebranding',
   'Company Rebrand',
   'company_event',
   'Company undergoing a rebrand or name change. Often coincides with strategy shifts and new tool evaluations.',
   45, 'low', true, 140),

  ('government_contract_win',
   'Government / Enterprise Contract Win',
   'company_event',
   'Company won a significant government or enterprise contract. Indicates rapid scaling of delivery and potentially sales headcount.',
   62, 'medium', true, 145),

  ('award_recognition',
   'Industry Award / Recognition',
   'company_event',
   'Company received industry recognition (Inc. 5000, Best Places to Work, etc.). Growth signal and good outreach hook.',
   40, 'low', true, 150),

  -- ── Buyer Intent / Research Signals ──────────────────────

  ('rfp_issuance',
   'RFP Issued',
   'buyer_intent',
   'Company published or distributed a Request for Proposal in your product category. High-intent: actively seeking a vendor.',
   92, 'very_high', true, 155),

  ('pricing_page_research',
   'Pricing Page Research',
   'buyer_intent',
   'Contacts from the company visiting pricing pages of vendors in your category. Clear evaluation intent.',
   85, 'very_high', true, 160),

  ('demo_request_competitor',
   'Competitor Demo Request',
   'buyer_intent',
   'Company requested a demo from a direct competitor. Actively in buying cycle — ideal time for a counter-engagement.',
   88, 'very_high', true, 165),

  ('category_keyword_search',
   'Category Keyword Search',
   'buyer_intent',
   'Surge in search activity around keywords in your product category (detected via intent data providers like Bombora or G2).',
   80, 'high', true, 170),

  ('case_study_consumption',
   'Case Study / ROI Content Consumption',
   'buyer_intent',
   'Contact reading case studies, ROI calculators, or bottom-of-funnel content in your category. Late-stage research behavior.',
   75, 'high', true, 175),

  -- ── Tech / Digital Signals ────────────────────────────────

  ('cloud_migration',
   'Cloud Migration Initiative',
   'interest',
   'Company undergoing cloud migration or infrastructure modernization. Signals openness to new SaaS tooling.',
   55, 'medium', true, 180),

  ('digital_transformation',
   'Digital Transformation Initiative',
   'interest',
   'Public announcement or job postings indicating a digital transformation program. Often involves replacing legacy tools.',
   60, 'medium', true, 185),

  ('tech_stack_expansion',
   'Rapid Tech Stack Expansion',
   'interest',
   'Company adding multiple new SaaS tools in a short period. Signals a buying culture and budget availability.',
   62, 'medium', true, 190),

  ('api_integration_hiring',
   'API / Integration Role Hiring',
   'interest',
   'Company hiring for API, integration, or middleware roles. Signals they are building connective tissue between tools.',
   50, 'medium', true, 195),

  ('cybersecurity_investment',
   'Cybersecurity Investment',
   'interest',
   'Company hiring security roles or announcing security tool adoption. Signals mature IT budget and vendor evaluation process.',
   48, 'low', true, 200),

  -- ── People / Talent Signals ───────────────────────────────

  ('key_contact_job_change',
   'Key Contact Changed Jobs',
   'company_event',
   'A known champion or buyer at a customer or prospect changed jobs. They may bring your product to their new company, or the old account needs re-engagement.',
   72, 'high', true, 205),

  ('high_employee_growth',
   'Rapid Employee Growth',
   'company_event',
   'Company headcount grew 20%+ in the past 6 months. Scale creates new coordination, management, and tooling challenges.',
   68, 'high', true, 210),

  ('operations_hire',
   'Operations / Finance Hire',
   'interest',
   'Hiring for COO, CFO, VP of Operations, or Finance roles. These buyers often own tooling budgets and process improvement.',
   58, 'medium', true, 215),

  ('remote_hybrid_shift',
   'Remote / Hybrid Work Shift',
   'interest',
   'Company publicly shifting to remote or hybrid work. Drives investment in digital collaboration and performance visibility tools.',
   50, 'medium', true, 220),

  -- ── Engagement / Content Signals ─────────────────────────

  ('event_sponsorship',
   'Industry Event Sponsorship',
   'interest',
   'Company sponsoring or exhibiting at an industry conference. Signals budget, growth mode, and active go-to-market investment.',
   52, 'medium', true, 225),

  ('thought_leadership_publish',
   'Publishing Thought Leadership',
   'interest',
   'Company publishing blog posts, whitepapers, or speaking at events in your category. Engaged with the conversation — warm audience.',
   42, 'low', true, 230),

  ('analyst_report_mention',
   'Mentioned in Analyst Report',
   'interest',
   'Company cited in Gartner, Forrester, or industry analyst coverage. Indicates maturity and visibility — often entering a formal buying process.',
   58, 'medium', true, 235),

  ('podcast_media_appearance',
   'Podcast / Media Appearance',
   'interest',
   'Executive or company appeared on a podcast or in media. Signals active thought leadership and momentum.',
   38, 'low', true, 240),

  -- ── Financial / Operational Signals ──────────────────────

  ('revenue_milestone',
   'Revenue Milestone Announced',
   'company_event',
   'Company publicly announced a revenue milestone (e.g., $1M ARR, $10M ARR). Growth = new budget and hiring.',
   65, 'medium', true, 245),

  ('cost_reduction_initiative',
   'Cost Reduction Initiative',
   'company_event',
   'Company announced cost-cutting or efficiency drive. Creates demand for tools that reduce headcount or improve output per rep.',
   62, 'medium', true, 250),

  ('fiscal_year_start',
   'New Fiscal Year / Budget Cycle',
   'interest',
   'Company entering Q1 or new fiscal year — the highest-probability window for new vendor evaluations and budget approvals.',
   68, 'high', true, 255),

  ('board_change',
   'Board Member Addition',
   'company_event',
   'New board member added — often brings vendor recommendations or mandates performance reporting improvements.',
   55, 'medium', true, 260)
ON CONFLICT (signal_key) DO NOTHING;


-- ============================================================
-- 5. SEED: Apptivia Test Org Custom Signals
--    org_id: c065a9f9-dd42-496d-bda3-246adcfe7949
-- ============================================================

-- Score overrides for universal signals relevant to Apptivia's ICP
-- (funding and leadership changes are extra valuable for selling Apptivia)
INSERT INTO engage_org_signal_configs
  (organization_id, signal_definition_id, is_enabled, score_override, strength_override)
SELECT
  'c065a9f9-dd42-496d-bda3-246adcfe7949',
  sd.id,
  true,
  overrides.score,
  overrides.strength
FROM engage_signal_definitions sd
JOIN (VALUES
  ('funding_round',          85, 'high'),
  ('sales_leadership_hire',  90, 'very_high'),
  ('sales_team_expansion',   78, 'high'),
  ('crm_adoption',           80, 'high'),
  ('sales_enablement_hire',  82, 'high')
) AS overrides(key, score, strength) ON sd.signal_key = overrides.key
ON CONFLICT (organization_id, signal_definition_id) DO NOTHING;


-- Apptivia-specific Buyer Intent signals (custom — no universal equivalent)
INSERT INTO engage_org_signal_configs
  (organization_id, signal_definition_id, signal_key, signal_name, category, description, default_score, default_strength)
VALUES

  -- Buyer Intent: actively evaluating sales performance tools
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'sales_tool_category_research',
   'Researching Sales Performance Tools',
   'buyer_intent',
   'Company or contacts researching sales coaching, performance management, or sales enablement software (G2, Capterra, TrustRadius category pages).',
   88, 'very_high'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'competitor_evaluation',
   'Evaluating Competitor Sales Tools',
   'buyer_intent',
   'Contact or company visiting competitor pages (Ambition, Spinify, Gong, Chorus, Salesloft) or comparing platforms.',
   85, 'very_high'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'rfp_vendor_evaluation',
   'Active RFP / Vendor Evaluation',
   'buyer_intent',
   'Company issuing an RFP or signals from intent data providers (Bombora, 6sense) indicating active vendor evaluation in sales performance category.',
   95, 'very_high'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'multi_stakeholder_intent',
   'Multiple Stakeholders Showing Interest',
   'buyer_intent',
   'Three or more contacts from the same company visiting category or competitor pages — account-level buying committee forming.',
   88, 'very_high'),

  -- Interest: softer engagement with Apptivia's category
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'sales_performance_content',
   'Sales Performance Content Consumption',
   'interest',
   'Contact consuming blog posts, whitepapers, or LinkedIn articles about sales rep performance, quota attainment, or coaching ROI.',
   52, 'medium'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'sales_productivity_event',
   'Sales Productivity Event Attendance',
   'interest',
   'Contact registered or attended a webinar or event focused on sales productivity, RevOps, or frontline sales management.',
   58, 'medium'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'thought_leader_follow',
   'Following Sales Performance Thought Leaders',
   'interest',
   'Company employees following LinkedIn thought leaders in sales coaching, gamification, or revenue leadership topics.',
   42, 'low'),

  -- Company/Trigger Events specific to Apptivia ICP
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'series_a_b_funding',
   'Series A or B Funding',
   'company_event',
   'Company closed a Series A or B round — typically 10–50 person companies entering growth phase with a dedicated sales team forming.',
   85, 'high'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'missed_quota_signal',
   'Missed Quota / Sales Performance Issue',
   'company_event',
   'News, LinkedIn posts, or job postings that suggest the company missed targets, had layoffs, or is restructuring their sales team.',
   80, 'high'),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'first_sales_manager',
   'First-Time Sales Manager Promoted',
   'company_event',
   'An IC sales rep was promoted to manager. First-time managers lack coaching frameworks — high-fit moment for Apptivia Coach.',
   72, 'high')
ON CONFLICT (organization_id, signal_key) WHERE signal_definition_id IS NULL DO NOTHING;
