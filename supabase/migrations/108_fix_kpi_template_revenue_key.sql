-- Migration 108: Fix revenue_closed → revenue_generated in KPI role templates
-- The kpi_metrics table uses 'revenue_generated' but templates referenced 'revenue_closed',
-- causing the AE and Sales Manager templates to silently drop 25-30% of weight.

-- AE template: fix revenue_closed → revenue_generated
UPDATE kpi_role_templates
SET kpi_configs = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'kpi_key' = 'revenue_closed'
      THEN jsonb_set(elem, '{kpi_key}', '"revenue_generated"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(kpi_configs) AS elem
)
WHERE title_key = 'ae' AND organization_id IS NULL;

-- Sales Manager template: fix revenue_closed → revenue_generated
UPDATE kpi_role_templates
SET kpi_configs = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'kpi_key' = 'revenue_closed'
      THEN jsonb_set(elem, '{kpi_key}', '"revenue_generated"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(kpi_configs) AS elem
)
WHERE title_key = 'sales_manager' AND organization_id IS NULL;
