-- 097: KPI Role Templates — seed smart defaults per job title
-- Phase 4C: admins configure KPI sets (keys + goals + weights) per title,
--           apply to org KPI config with one click.

CREATE TABLE IF NOT EXISTS kpi_role_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title_key   text NOT NULL,          -- e.g. 'bdr', 'ae', 'sales_manager'
  template_name text NOT NULL,        -- e.g. 'BDR Default'
  kpi_configs jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- kpi_configs: [{ "kpi_key": "call_connects", "goal": 120, "weight": 0.30 }, ...]
  is_default  boolean DEFAULT false,  -- global default (null org_id) vs org-specific
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(organization_id, title_key)
);

-- Allow global defaults (organization_id IS NULL) — unique per title_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_role_templates_global
  ON kpi_role_templates (title_key) WHERE organization_id IS NULL;

-- RLS
ALTER TABLE kpi_role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_role_templates_select ON kpi_role_templates
  FOR SELECT USING (
    organization_id IS NULL  -- global defaults readable by all
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY kpi_role_templates_manage ON kpi_role_templates
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- ── Seed global defaults ────────────────────────────────────────────────────
-- BDR / SDR template: activity-heavy, pipeline-light
INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'bdr', 'BDR / SDR Default', true, '[
  {"kpi_key": "call_connects",    "goal": 120, "weight": 0.25},
  {"kpi_key": "talk_time_minutes","goal": 120, "weight": 0.20},
  {"kpi_key": "meetings",         "goal": 5,   "weight": 0.20},
  {"kpi_key": "sourced_opps",     "goal": 6,   "weight": 0.20},
  {"kpi_key": "emails_sent",      "goal": 80,  "weight": 0.15}
]'::jsonb);

-- AE template: pipeline + revenue-heavy
INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'ae', 'Account Executive Default', true, '[
  {"kpi_key": "sourced_opps",     "goal": 4,    "weight": 0.15},
  {"kpi_key": "stage2_opps",      "goal": 3,    "weight": 0.20},
  {"kpi_key": "meetings",         "goal": 8,    "weight": 0.15},
  {"kpi_key": "pipeline_created", "goal": 50000,"weight": 0.25},
  {"kpi_key": "revenue_generated",   "goal": 30000,"weight": 0.25}
]'::jsonb);

-- Sales Manager template: team metrics
INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'sales_manager', 'Sales Manager Default', true, '[
  {"kpi_key": "meetings",         "goal": 4,    "weight": 0.15},
  {"kpi_key": "pipeline_created", "goal": 80000,"weight": 0.25},
  {"kpi_key": "revenue_generated",   "goal": 60000,"weight": 0.30},
  {"kpi_key": "stage2_opps",      "goal": 5,    "weight": 0.15},
  {"kpi_key": "sourced_opps",     "goal": 6,    "weight": 0.15}
]'::jsonb);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kpi_role_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kpi_role_templates_updated_at
  BEFORE UPDATE ON kpi_role_templates
  FOR EACH ROW EXECUTE FUNCTION update_kpi_role_templates_updated_at();
