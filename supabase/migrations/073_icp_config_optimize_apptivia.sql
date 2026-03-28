-- Migration 073: Optimize ICP Config for Apptivia Test Org
-- Org ID: c065a9f9-dd42-496d-bda3-246adcfe7949
--
-- Changes:
--   1. Add 6 target industries: B2B Sales (top priority), Marketing and Advertising,
--      E-Learning, Human Resources, Venture Capital and Private Equity,
--      Business Supplies and Equipment
--   2. Add 12 target technologies: Gong, Chorus, Ambition, Spinify, LevelEleven,
--      Clari, Highspot, Mindtickle, Lessonly, Seismic, Intercom, Drift
--   3. Tighten headcount from 10-200 to 25-500 (skip tiny shops, include mid-market)
--   4. Raise revenue_max_m from 30 to 100 (match expanded headcount ceiling)
--   5. Add Geography: US, Canada, UK, Australia
--   6. Add Keywords: 10 high-signal buyer-intent keywords
--   7. Redistribute weights across all 7 scoring dimensions

UPDATE organizations
SET icp_config = '{
  "enabled": true,
  "target_industries": [
    "SaaS",
    "B2B Software",
    "B2B Sales",
    "Technology",
    "Professional Services",
    "Staffing",
    "Financial Services",
    "Business Services",
    "Insurance",
    "Real Estate",
    "Telecommunications",
    "Marketing and Advertising",
    "E-Learning",
    "Human Resources",
    "Venture Capital and Private Equity",
    "Business Supplies and Equipment"
  ],
  "headcount_min": 25,
  "headcount_max": 500,
  "revenue_min_m": 1,
  "revenue_max_m": 100,
  "target_technologies": [
    "Salesforce",
    "HubSpot",
    "Outreach",
    "Salesloft",
    "Apollo",
    "Pipedrive",
    "Zoho CRM",
    "Close CRM",
    "Copper CRM",
    "Freshsales",
    "Slack",
    "Gong",
    "Chorus",
    "Ambition",
    "Spinify",
    "LevelEleven",
    "Clari",
    "Highspot",
    "Mindtickle",
    "Lessonly",
    "Seismic",
    "Intercom",
    "Drift"
  ],
  "target_countries": [
    "United States",
    "Canada",
    "United Kingdom",
    "Australia"
  ],
  "company_age_min": 2,
  "company_age_max": 20,
  "target_keywords": [
    "sales",
    "revenue",
    "crm",
    "b2b",
    "saas",
    "salesforce",
    "hubspot",
    "outreach",
    "sales performance",
    "SDR",
    "BDR",
    "sales coaching",
    "gamification",
    "sales enablement",
    "revenue operations",
    "quota attainment",
    "sales onboarding",
    "rep productivity"
  ],
  "weights": {
    "industry":     20,
    "headcount":    15,
    "revenue":      10,
    "technology":   10,
    "geography":    20,
    "company_age":  15,
    "keywords":     10
  }
}'::jsonb
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';
