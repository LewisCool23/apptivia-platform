-- Migration 152: Fix orphaned achievement KPI keys (F5)
-- Remaps 3 achievement criteria.kpi values that don't match actual kpi_metrics keys.
-- (closed_won_deals→closed_won was already fixed in migration 068)

-- pipeline_advanced → stage3_opps (9 achievements: "Deals Progressed")
UPDATE achievements
SET criteria = jsonb_set(criteria, '{kpi}', '"stage3_opps"')
WHERE criteria->>'kpi' = 'pipeline_advanced';

-- qualified_leads → sourced_opps (8 achievements: "Qualified Leads")
UPDATE achievements
SET criteria = jsonb_set(criteria, '{kpi}', '"sourced_opps"')
WHERE criteria->>'kpi' = 'qualified_leads';

-- social_touches → emails_sent (9 achievements: "Social Touches")
UPDATE achievements
SET criteria = jsonb_set(criteria, '{kpi}', '"emails_sent"')
WHERE criteria->>'kpi' = 'social_touches';
