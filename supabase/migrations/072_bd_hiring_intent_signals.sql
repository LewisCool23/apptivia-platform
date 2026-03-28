-- Migration 072: BD/Sales Hiring Intent Signals for Apptivia Test Org
-- Adds 5 high-intent buyer signals related to hiring SDRs, BDRs,
-- BD managers/VPs, SD managers/VPs, and Sales Enablement/RevOps roles.
-- These are the strongest buyer-intent signals for Apptivia's ICP because
-- companies actively building out their BD/Sales org need performance
-- tracking, coaching, and gamification tooling.

-- Also adds 3 new universal signals available to ALL orgs:
--   hiring_sales_managers, hiring_sales_enablement_revops
--   (hiring_sdrs/hiring_bdrs are org-custom since they're Apptivia-specific)

-- ============================================================
-- 1. Universal signal definitions (available to all orgs)
-- ============================================================

INSERT INTO engage_signal_definitions
  (signal_key, signal_name, category, description, default_score, default_strength, is_universal, sort_order)
VALUES
  ('hiring_sales_managers',
   'Hiring Sales Managers / VP Sales',
   'company_event',
   'Company posting for Sales Manager, VP of Sales, or Head of Sales. Building sales leadership indicates investment in structured sales operations and tooling.',
   76, 'high', true, 26),

  ('hiring_sales_enablement_revops',
   'Hiring Sales Enablement / RevOps',
   'company_event',
   'Company posting for Sales Enablement Manager, Revenue Operations, or Sales Ops roles. These are the people who evaluate and purchase sales performance tools.',
   78, 'high', true, 41)
ON CONFLICT (signal_key) DO NOTHING;


-- ============================================================
-- 2. Custom signals for Apptivia Test Org
-- ============================================================

INSERT INTO engage_org_signal_configs
  (organization_id, signal_definition_id, signal_key, signal_name, category, description, default_score, default_strength)
VALUES

  -- Hiring SDRs (Score 100 — user already added via UI, ON CONFLICT skips)
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'hiring_sdrs',
   'Hiring SDRs',
   'buyer_intent',
   'Company is hiring Sales Development Representatives. Scaling SDR teams creates immediate need for onboarding, performance tracking, coaching, and gamification — Apptivia''s core value proposition.',
   100, 'very_high'),

  -- Hiring BDRs (Score 100 — user already added via UI, ON CONFLICT skips)
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'hiring_bdrs',
   'Hiring BDRs',
   'buyer_intent',
   'Company is hiring Business Development Representatives. BDR teams are the prime user base for Apptivia — performance scoring, coaching plans, contests, and wallboards drive BDR productivity.',
   100, 'very_high'),

  -- Hiring BD Managers / VP of BD
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'hiring_bd_managers_vp',
   'Hiring BD Managers / VP of Business Development',
   'buyer_intent',
   'Company posting for Business Development Manager, Director of BD, or VP of Business Development. BD leadership hires signal a company formalizing their outbound motion — they will need performance management and coaching tools for their growing team.',
   95, 'very_high'),

  -- Hiring SD Managers / VP of SD
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'hiring_sd_managers_vp',
   'Hiring SD Managers / VP of Sales Development',
   'buyer_intent',
   'Company posting for Sales Development Manager, Director of Sales Development, or VP of Sales Development. SD leadership roles mean they are building structured SDR programs — scorecards, coaching plans, and contests become essential.',
   95, 'very_high'),

  -- Hiring Sales Enablement / RevOps (custom overlay with higher score than universal)
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', NULL,
   'hiring_enablement_revops',
   'Hiring Sales Enablement / RevOps',
   'buyer_intent',
   'Company hiring Sales Enablement, Revenue Operations, or Sales Operations roles. These roles are Apptivia''s primary economic buyer — they evaluate and purchase performance management tools.',
   90, 'very_high')

ON CONFLICT (organization_id, signal_key) WHERE signal_definition_id IS NULL DO NOTHING;
