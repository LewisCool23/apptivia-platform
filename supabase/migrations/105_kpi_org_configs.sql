-- Migration 105: Per-org KPI configuration overlay
-- kpi_metrics stays as global catalog; kpi_org_configs stores per-org goal/weight/scorecard config.
-- Safe to re-run: drops and recreates.

-- Clean up partial prior run (safe even if tables don't exist yet)
DROP TABLE IF EXISTS kpi_org_config_history CASCADE;
DROP TABLE IF EXISTS kpi_org_configs CASCADE;
DROP FUNCTION IF EXISTS fn_kpi_org_config_history();

-- 1. Per-org KPI configuration
CREATE TABLE kpi_org_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kpi_id           UUID NOT NULL REFERENCES kpi_metrics(id) ON DELETE CASCADE,
  goal             NUMERIC NOT NULL,
  weight           NUMERIC NOT NULL DEFAULT 1.0,
  is_active        BOOLEAN DEFAULT true,
  show_on_scorecard BOOLEAN DEFAULT false,
  scorecard_position INTEGER,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, kpi_id)
);

ALTER TABLE kpi_org_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY kpi_org_configs_read ON kpi_org_configs
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

CREATE POLICY kpi_org_configs_write ON kpi_org_configs
  FOR ALL TO authenticated
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

CREATE INDEX idx_kpi_org_configs_org ON kpi_org_configs(organization_id);
CREATE INDEX idx_kpi_org_configs_kpi ON kpi_org_configs(kpi_id);
CREATE INDEX idx_kpi_org_configs_scorecard ON kpi_org_configs(organization_id, show_on_scorecard)
  WHERE show_on_scorecard = true;

-- 2. Backfill: copy current kpi_metrics config into kpi_org_configs for all existing orgs
INSERT INTO kpi_org_configs (organization_id, kpi_id, goal, weight, is_active, show_on_scorecard, scorecard_position)
SELECT o.id, m.id, m.goal, m.weight, m.is_active, m.show_on_scorecard, m.scorecard_position
FROM organizations o
CROSS JOIN kpi_metrics m
ON CONFLICT (organization_id, kpi_id) DO NOTHING;

-- 3. History tracking (mirrors kpi_metric_history pattern from migration 064)
CREATE TABLE kpi_org_config_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_config_id    UUID NOT NULL REFERENCES kpi_org_configs(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL,
  kpi_id           UUID NOT NULL,
  goal             NUMERIC NOT NULL,
  weight           NUMERIC NOT NULL,
  show_on_scorecard BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_to         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kpi_och_org ON kpi_org_config_history(organization_id, kpi_id);
CREATE INDEX idx_kpi_och_valid ON kpi_org_config_history(valid_from);

ALTER TABLE kpi_org_config_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_org_config_history_read ON kpi_org_config_history
  FOR SELECT TO authenticated USING (true);

-- 4. Trigger: auto-track config changes
CREATE OR REPLACE FUNCTION fn_kpi_org_config_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO kpi_org_config_history
      (org_config_id, organization_id, kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
    VALUES
      (NEW.id, NEW.organization_id, NEW.kpi_id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.goal IS DISTINCT FROM NEW.goal
       OR OLD.weight IS DISTINCT FROM NEW.weight
       OR OLD.show_on_scorecard IS DISTINCT FROM NEW.show_on_scorecard
       OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      UPDATE kpi_org_config_history SET valid_to = now()
        WHERE org_config_id = OLD.id AND valid_to IS NULL;
      INSERT INTO kpi_org_config_history
        (org_config_id, organization_id, kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
      VALUES
        (NEW.id, NEW.organization_id, NEW.kpi_id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kpi_org_config_history
AFTER INSERT OR UPDATE ON kpi_org_configs
FOR EACH ROW EXECUTE FUNCTION fn_kpi_org_config_history();

COMMENT ON TABLE kpi_org_configs IS 'Per-organization KPI configuration overlay. kpi_metrics is the global catalog; this table stores org-specific goals, weights, and scorecard selections.';
COMMENT ON TABLE kpi_org_config_history IS 'Point-in-time history of per-org KPI config changes for historical scoring.';
