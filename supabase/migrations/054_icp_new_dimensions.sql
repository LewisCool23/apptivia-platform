-- Migration 054: Add geography, company age, and keyword dimensions to Apptivia Test Org ICP
-- These dimensions use data returned directly from Apollo's company search response,
-- enabling higher ICP fit scores without requiring additional API enrichment calls.
--
-- New dimensions:
--   geography    — company must be in a target country (US, CA, UK, AU)
--   company_age  — company founded 2–20 years ago (scale-up sweet spot)
--   keywords     — Apollo company keyword tags match sales/revenue/crm signals
--
-- Weight redistribution (total still sums to 100):
--   industry:     25 → 20   (fuzzy match against Apollo taxonomy)
--   headcount:    30 → 20   (10–200 employees)
--   revenue:      20 → 10   (populated after enrichment)
--   technology:   25 → 10   (populated after enrichment)
--   geography:     0 → 20   (NEW — country match)
--   company_age:   0 → 15   (NEW — 2–20 years old)
--   keywords:      0 →  5   (NEW — Apollo keyword tags)

UPDATE organizations
SET icp_config = icp_config
  -- Add new fields
  || jsonb_build_object(
    'target_countries',  '["United States","Canada","United Kingdom","Australia"]'::jsonb,
    'company_age_min',   2,
    'company_age_max',   20,
    'target_keywords',   '["sales","revenue","crm","b2b","saas","salesforce","hubspot","outreach"]'::jsonb
  )
  -- Replace weights
  || jsonb_build_object(
    'weights', '{
      "industry":     20,
      "headcount":    20,
      "revenue":      10,
      "technology":   10,
      "geography":    20,
      "company_age":  15,
      "keywords":      5
    }'::jsonb
  )
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';
