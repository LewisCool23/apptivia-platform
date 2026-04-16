-- Migration 096: Sales DNA — Methodology + Qualification Framework at org level
-- Adds a sales_dna JSONB column to organizations for storing the org's chosen
-- sales methodology approach and qualification framework configuration.
--
-- Expected shape of sales_dna:
-- {
--   "methodology_approach": "single" | "hybrid" | "custom",
--   "primary_methodology": "challenger_sale" | "spin_selling" | ... | null,
--   "secondary_methodology": "..." | null,            -- hybrid only
--   "custom_methodology_name": "..." | null,          -- custom only
--   "custom_methodology_principles": ["...", ...],    -- custom only
--   "qualification_framework": "bant" | "meddic" | "meddpicc" | null,
--   "methodology_stage_mapping": [                    -- hybrid CEP stage overrides
--     { "stage_key": "qualification", "methodology_key": "spin_selling" }
--   ]
-- }

-- Add the sales_dna column
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sales_dna JSONB NOT NULL DEFAULT '{}';

-- Add a comment documenting the expected shape
COMMENT ON COLUMN organizations.sales_dna IS
  'Sales DNA configuration: methodology approach (single/hybrid/custom), primary & secondary methodology keys, qualification framework key, and optional CEP stage methodology mapping.';

-- Seed Apptivia Test Org with a default Sales DNA (Challenger + MEDDPICC)
UPDATE organizations
SET sales_dna = '{
  "methodology_approach": "single",
  "primary_methodology": "challenger_sale",
  "secondary_methodology": null,
  "custom_methodology_name": null,
  "custom_methodology_principles": [],
  "qualification_framework": "meddpicc",
  "methodology_stage_mapping": []
}'::jsonb
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
  AND (sales_dna IS NULL OR sales_dna = '{}'::jsonb);
