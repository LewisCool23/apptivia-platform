-- Migration 050: ICP + Signal config update for Apptivia Test Org
-- Org ID: c065a9f9-dd42-496d-bda3-246adcfe7949
--
-- Fixes applied vs original query:
--   1. solution_keywords[0] = "B2B SaaS" (Apollo keyword_tags expects company descriptors, not buyer phrases)
--   2. Replaced monday.com with Close CRM, Copper CRM, Freshsales in target_technologies
--   3. Removed 6sense + ZoomInfo from competitors (not direct competitors; risk of misclassification)
--      Added: Salesscreen, Hoopla, Highspot, Mindtickle
--   4. Added 5 additional job_titles_to_track for broader Apollo contact coverage

UPDATE organizations
SET
  -- ── Firmographic ICP scoring criteria ────────────────────────────────────
  icp_config = '{
    "enabled": true,
    "target_industries": [
      "SaaS",
      "B2B Software",
      "Technology",
      "Professional Services",
      "Staffing",
      "Financial Services",
      "Business Services",
      "Insurance",
      "Real Estate",
      "Telecommunications"
    ],
    "headcount_min": 10,
    "headcount_max": 200,
    "revenue_min_m": 1,
    "revenue_max_m": 30,
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
      "Slack"
    ],
    "weights": {
      "industry": 25,
      "headcount": 30,
      "revenue": 20,
      "technology": 25
    }
  }'::jsonb,

  -- ── Signal scan config — drives Tavily + Apollo scan behavior ────────────
  signal_config = '{
    "pain_points": [
      "no visibility into individual rep performance",
      "coaching reps without data or structure",
      "managing a sales team in spreadsheets",
      "high rep turnover with no root cause",
      "running contests in Slack or manually tracking leaderboards",
      "new sales manager promoted from top rep with no coaching framework",
      "missed quota two quarters in a row with no rep-level insight",
      "informal management breaking down after hiring reps 3-5",
      "new VP of Sales hired to professionalize a scrappy team",
      "disconnected tools for coaching, leaderboards, and prospecting"
    ],
    "solution_keywords": [
      "B2B SaaS",
      "sales performance management software",
      "sales coaching software",
      "sales rep performance tracking",
      "sales scorecard software",
      "sales manager coaching tools",
      "rep accountability software",
      "sales team performance dashboard",
      "sales leaderboard software",
      "sales contest software",
      "sales KPI tracking software",
      "sales 1:1 coaching tool",
      "sales motivation tools",
      "AI sales coach",
      "sales enablement for small teams",
      "sales team visibility tool",
      "sales activity tracking",
      "sales ramp time reduction",
      "sales onboarding software",
      "sales prospecting software",
      "buyer intent data for SMB",
      "frontline sales manager tools",
      "sales team management platform"
    ],
    "job_titles_to_track": [
      "VP of Sales",
      "Chief Revenue Officer",
      "Chief Sales Officer",
      "Director of Sales",
      "Head of Sales",
      "Sales Manager",
      "Sales Director",
      "Regional Sales Manager",
      "District Sales Manager",
      "Revenue Operations Manager",
      "Sales Operations Manager",
      "Sales Enablement Manager",
      "Sales Enablement Lead",
      "Business Development Manager",
      "Sales Development Manager",
      "Team Lead",
      "Sales Coach",
      "Inside Sales Manager",
      "Vice President of Revenue"
    ],
    "competitors": [
      "Ambition",
      "Spinify",
      "LevelEleven",
      "Salesscreen",
      "Hoopla",
      "Gong",
      "Chorus",
      "Salesloft",
      "Outreach",
      "Highspot",
      "Mindtickle",
      "Clari"
    ],
    "tech_stack_churning": [
      "Ambition",
      "LevelEleven",
      "Spinify",
      "Salesscreen",
      "Hoopla",
      "Chorus",
      "Gong"
    ]
  }'::jsonb

WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';
