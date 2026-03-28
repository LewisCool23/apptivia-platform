-- Migration 053: Update Apptivia Test Org ICP target_industries to Apollo taxonomy labels
-- Apollo stores company.industry using specific labels (e.g. "Computer Software", "Internet").
-- Using those exact labels in target_industries makes ICP scoring work without any translation.
--
-- Replaced:
--   "SaaS", "B2B Software"       → "Computer Software", "Internet"
--   "Technology"                 → "Information Technology and Services"
--   "Professional Services",
--   "Business Services"          → "Management Consulting"
--   "Staffing"                   → "Staffing and Recruiting"
--   "Financial Services"         → "Financial Services"   (unchanged — Apollo matches)
--   "Insurance"                  → "Insurance"            (unchanged)
--   "Real Estate"                → "Real Estate"          (unchanged)
--   "Telecommunications"         → "Telecommunications"   (unchanged)

UPDATE organizations
SET icp_config = jsonb_set(
  icp_config,
  '{target_industries}',
  '["Computer Software","Internet","Information Technology and Services","Management Consulting","Staffing and Recruiting","Financial Services","Insurance","Real Estate","Telecommunications"]'::jsonb
)
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949';
