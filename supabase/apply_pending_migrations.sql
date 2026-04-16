-- ===========================================================================
-- COMBINED MIGRATION SCRIPT: 096 → 112  (Safe / Idempotent)
--
-- Run this in the Supabase SQL Editor.  Every statement uses IF NOT EXISTS,
-- ON CONFLICT, DROP … IF EXISTS, or CREATE OR REPLACE so it is safe to
-- re-run even if some migrations were already applied.
--
-- At the end the script records every migration in a new schema_migrations
-- tracking table so you always know what has been applied.
--
-- NOTE: If the SQL Editor times out on a very large paste, split at the
--       "════ Migration NNN" headers and run in batches.
-- ===========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 0:  Migration tracking table
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS schema_migrations (
  version   TEXT PRIMARY KEY,
  name      TEXT,
  applied_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE schema_migrations IS 'Tracks which numbered migrations have been applied to this database.';


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 096: Sales DNA column on organizations
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sales_dna JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN organizations.sales_dna IS
  'Sales DNA configuration: methodology approach, primary/secondary methodology, qualification framework, CEP stage mapping.';

-- Seed Apptivia Test Org (no-op if already set)
UPDATE organizations
SET sales_dna = '{
  "methodology_approach": "single",
  "primary_methodology": "challenger_sale",
  "qualification_framework": "meddpicc"
}'::jsonb
WHERE id = 'c065a9f9-dd42-496d-bda3-246adcfe7949'
  AND (sales_dna IS NULL OR sales_dna = '{}'::jsonb);

INSERT INTO schema_migrations (version, name) VALUES ('096', 'sales_dna') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 097: KPI Role Templates
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kpi_role_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title_key       text NOT NULL,
  template_name   text NOT NULL,
  kpi_configs     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default      boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(organization_id, title_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_role_templates_global
  ON kpi_role_templates (title_key) WHERE organization_id IS NULL;

ALTER TABLE kpi_role_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_role_templates_select ON kpi_role_templates;
CREATE POLICY kpi_role_templates_select ON kpi_role_templates
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS kpi_role_templates_manage ON kpi_role_templates;
CREATE POLICY kpi_role_templates_manage ON kpi_role_templates
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- Seed global defaults (skip if already present)
INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'bdr', 'BDR / SDR Default', true, '[
  {"kpi_key":"call_connects","goal":120,"weight":0.25},
  {"kpi_key":"talk_time_minutes","goal":120,"weight":0.20},
  {"kpi_key":"meetings","goal":5,"weight":0.20},
  {"kpi_key":"sourced_opps","goal":6,"weight":0.20},
  {"kpi_key":"emails_sent","goal":80,"weight":0.15}
]'::jsonb)
ON CONFLICT (title_key) WHERE organization_id IS NULL DO NOTHING;

INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'ae', 'Account Executive Default', true, '[
  {"kpi_key":"sourced_opps","goal":4,"weight":0.15},
  {"kpi_key":"stage2_opps","goal":3,"weight":0.20},
  {"kpi_key":"meetings","goal":8,"weight":0.15},
  {"kpi_key":"pipeline_created","goal":50000,"weight":0.25},
  {"kpi_key":"revenue_generated","goal":30000,"weight":0.25}
]'::jsonb)
ON CONFLICT (title_key) WHERE organization_id IS NULL DO NOTHING;

INSERT INTO kpi_role_templates (organization_id, title_key, template_name, is_default, kpi_configs)
VALUES (NULL, 'sales_manager', 'Sales Manager Default', true, '[
  {"kpi_key":"meetings","goal":4,"weight":0.15},
  {"kpi_key":"pipeline_created","goal":80000,"weight":0.25},
  {"kpi_key":"revenue_generated","goal":60000,"weight":0.30},
  {"kpi_key":"stage2_opps","goal":5,"weight":0.15},
  {"kpi_key":"sourced_opps","goal":6,"weight":0.15}
]'::jsonb)
ON CONFLICT (title_key) WHERE organization_id IS NULL DO NOTHING;

CREATE OR REPLACE FUNCTION update_kpi_role_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kpi_role_templates_updated_at ON kpi_role_templates;
CREATE TRIGGER trg_kpi_role_templates_updated_at
  BEFORE UPDATE ON kpi_role_templates
  FOR EACH ROW EXECUTE FUNCTION update_kpi_role_templates_updated_at();

INSERT INTO schema_migrations (version, name) VALUES ('097', 'kpi_role_templates') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 098: Seed KPI data for week 2026-03-23
-- (test/demo data — skipped in combined script; run manually if needed)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO schema_migrations (version, name) VALUES ('098', 'seed_last_completed_week (skipped — demo data)') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 099: Apptivia Engage tables
-- ═══════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. engage_companies
CREATE TABLE IF NOT EXISTS engage_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  logo_url TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  industry TEXT,
  sub_industry TEXT,
  employee_count_range TEXT,
  annual_revenue_range TEXT,
  founded_year INT,
  headquarters_city TEXT,
  headquarters_state TEXT,
  headquarters_country TEXT,
  tech_stack JSONB DEFAULT '[]',
  funding_data JSONB DEFAULT '{}',
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  source_id TEXT,
  enriched_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engage_companies_domain
  ON engage_companies(organization_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engage_companies_org
  ON engage_companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_engage_companies_industry
  ON engage_companies(organization_id, industry);
CREATE INDEX IF NOT EXISTS idx_engage_companies_name
  ON engage_companies USING gin (name gin_trgm_ops);

-- 2. engage_prospects
CREATE TABLE IF NOT EXISTS engage_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES engage_companies(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  ) STORED,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  avatar_url TEXT,
  title TEXT,
  seniority_level TEXT,
  department TEXT,
  company_name TEXT,
  fit_score INT DEFAULT 0,
  intent_score INT DEFAULT 0,
  status TEXT DEFAULT 'new',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  source TEXT,
  source_id TEXT,
  enriched_at TIMESTAMPTZ,
  raw_data JSONB,
  last_called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engage_prospects_email
  ON engage_prospects(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engage_prospects_org
  ON engage_prospects(organization_id);
CREATE INDEX IF NOT EXISTS idx_engage_prospects_company
  ON engage_prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_engage_prospects_status
  ON engage_prospects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_engage_prospects_score
  ON engage_prospects(organization_id, fit_score DESC);

-- 3. engage_prospect_lists
CREATE TABLE IF NOT EXISTS engage_prospect_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_smart BOOLEAN DEFAULT false,
  saved_search_id UUID,
  prospect_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_engage_lists_org
  ON engage_prospect_lists(organization_id);

-- 4. engage_prospect_list_items
CREATE TABLE IF NOT EXISTS engage_prospect_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES engage_prospect_lists(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES engage_prospects(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),
  UNIQUE (list_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_engage_list_items_list
  ON engage_prospect_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_engage_list_items_prospect
  ON engage_prospect_list_items(prospect_id);

-- 5. engage_saved_searches
CREATE TABLE IF NOT EXISTS engage_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  search_type TEXT NOT NULL DEFAULT 'prospect',
  filters JSONB NOT NULL DEFAULT '{}',
  result_count INT DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_engage_searches_org
  ON engage_saved_searches(organization_id);

-- FK from prospect_lists to saved_searches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_engage_lists_saved_search'
  ) THEN
    ALTER TABLE engage_prospect_lists
      ADD CONSTRAINT fk_engage_lists_saved_search
      FOREIGN KEY (saved_search_id) REFERENCES engage_saved_searches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. engage_research_reports
CREATE TABLE IF NOT EXISTS engage_research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES engage_companies(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES engage_prospects(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  model_used TEXT,
  data_sources TEXT[] DEFAULT '{}',
  tokens_used INT DEFAULT 0,
  generation_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT chk_report_target CHECK (
    company_id IS NOT NULL OR prospect_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_engage_reports_company
  ON engage_research_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_engage_reports_prospect
  ON engage_research_reports(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engage_reports_org
  ON engage_research_reports(organization_id);

-- 7. engage_outreach_drafts
CREATE TABLE IF NOT EXISTS engage_outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES engage_prospects(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  personalization_context JSONB,
  status TEXT DEFAULT 'draft',
  model_used TEXT,
  prompt_template TEXT,
  tokens_used INT DEFAULT 0,
  version INT DEFAULT 1,
  parent_draft_id UUID REFERENCES engage_outreach_drafts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_engage_drafts_prospect
  ON engage_outreach_drafts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_engage_drafts_org
  ON engage_outreach_drafts(organization_id);
CREATE INDEX IF NOT EXISTS idx_engage_drafts_status
  ON engage_outreach_drafts(organization_id, status);

-- 8. engage_activity_log
CREATE TABLE IF NOT EXISTS engage_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  credits_used NUMERIC(6,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engage_activity_org
  ON engage_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_engage_activity_user
  ON engage_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_engage_activity_action
  ON engage_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_engage_activity_created
  ON engage_activity_log(created_at DESC);

-- 9. RLS for all Engage tables
ALTER TABLE engage_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospect_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_activity_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'engage_companies','engage_prospects','engage_prospect_lists',
    'engage_saved_searches','engage_research_reports',
    'engage_outreach_drafts','engage_activity_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'policy_org_' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
        organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
      )', 'policy_org_' || tbl, tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS policy_org_engage_prospect_list_items ON engage_prospect_list_items;
CREATE POLICY policy_org_engage_prospect_list_items
  ON engage_prospect_list_items FOR ALL
  USING (
    list_id IN (
      SELECT id FROM engage_prospect_lists
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 10. Triggers
CREATE OR REPLACE FUNCTION update_engage_list_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE engage_prospect_lists
      SET prospect_count = prospect_count + 1, updated_at = NOW()
      WHERE id = NEW.list_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE engage_prospect_lists
      SET prospect_count = GREATEST(prospect_count - 1, 0), updated_at = NOW()
      WHERE id = OLD.list_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_engage_list_count ON engage_prospect_list_items;
CREATE TRIGGER trg_engage_list_count
  AFTER INSERT OR DELETE ON engage_prospect_list_items
  FOR EACH ROW EXECUTE FUNCTION update_engage_list_count();

CREATE OR REPLACE FUNCTION engage_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'engage_companies','engage_prospects','engage_prospect_lists',
    'engage_saved_searches','engage_outreach_drafts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION engage_set_updated_at()', tbl, tbl
    );
  END LOOP;
END $$;

INSERT INTO schema_migrations (version, name) VALUES ('099', 'engage_tables_production') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 100: Engage prospect ownership
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE engage_prospects
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_engage_prospects_assigned
  ON engage_prospects(assigned_to) WHERE assigned_to IS NOT NULL;

INSERT INTO schema_migrations (version, name) VALUES ('100', 'engage_prospect_owner') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 101: Aaron per-rep memory
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS aaron_rep_memory (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary         TEXT,
  goals           TEXT[] DEFAULT '{}',
  challenges      TEXT[] DEFAULT '{}',
  strengths       TEXT[] DEFAULT '{}',
  preferences     JSONB DEFAULT '{}',
  last_topics     TEXT[] DEFAULT '{}',
  message_count   INTEGER DEFAULT 0,
  last_updated    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_aaron_memory_user
  ON aaron_rep_memory(user_id, organization_id);

ALTER TABLE aaron_rep_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own memory" ON aaron_rep_memory;
CREATE POLICY "Users can view own memory" ON aaron_rep_memory
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own memory" ON aaron_rep_memory;
CREATE POLICY "Users can delete own memory" ON aaron_rep_memory
  FOR DELETE USING (user_id = auth.uid());

INSERT INTO schema_migrations (version, name) VALUES ('101', 'aaron_rep_memory') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 102: Stripe billing columns
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_stripe_customer
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_stripe_subscription
  ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

INSERT INTO schema_migrations (version, name) VALUES ('102', 'stripe_billing') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 103: Demo requests table
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS demo_requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT,
  team_size   TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_insert" ON demo_requests;
CREATE POLICY "service_insert" ON demo_requests FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "service_select" ON demo_requests;
CREATE POLICY "service_select" ON demo_requests FOR SELECT TO service_role USING (true);

INSERT INTO schema_migrations (version, name) VALUES ('103', 'demo_requests') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 104: Onboarding Overhaul — Departments + onboarding_readiness
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS departments_manage ON departments;
CREATE POLICY departments_manage ON departments
  FOR ALL TO authenticated
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

-- Link teams to departments
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Onboarding readiness on organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_readiness JSONB DEFAULT '{}';

-- Backfill departments from existing teams.department (safe: ON CONFLICT DO NOTHING)
INSERT INTO departments (organization_id, name, sort_order)
SELECT DISTINCT t.organization_id, t.department::TEXT, 0
FROM teams t
WHERE t.department IS NOT NULL
  AND t.organization_id IS NOT NULL
ON CONFLICT (organization_id, name) DO NOTHING;

-- Link existing teams to department rows
UPDATE teams t
SET department_id = d.id
FROM departments d
WHERE t.organization_id = d.organization_id
  AND t.department::TEXT = d.name
  AND t.department_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department_id);

INSERT INTO schema_migrations (version, name) VALUES ('104', 'onboarding_overhaul') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 105: Per-org KPI configuration (kpi_org_configs)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kpi_org_configs (
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

DROP POLICY IF EXISTS kpi_org_configs_read ON kpi_org_configs;
CREATE POLICY kpi_org_configs_read ON kpi_org_configs
  FOR SELECT TO authenticated
  USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS kpi_org_configs_write ON kpi_org_configs;
CREATE POLICY kpi_org_configs_write ON kpi_org_configs
  FOR ALL TO authenticated
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('admin', 'manager')
  );

CREATE INDEX IF NOT EXISTS idx_kpi_org_configs_org ON kpi_org_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_org_configs_kpi ON kpi_org_configs(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_org_configs_scorecard ON kpi_org_configs(organization_id, show_on_scorecard)
  WHERE show_on_scorecard = true;

-- Backfill: copy global kpi_metrics into kpi_org_configs for existing orgs
INSERT INTO kpi_org_configs (organization_id, kpi_id, goal, weight, is_active, show_on_scorecard, scorecard_position)
SELECT o.id, m.id, m.goal, m.weight, m.is_active, m.show_on_scorecard, m.scorecard_position
FROM organizations o
CROSS JOIN kpi_metrics m
ON CONFLICT (organization_id, kpi_id) DO NOTHING;

-- History tracking table
CREATE TABLE IF NOT EXISTS kpi_org_config_history (
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

CREATE INDEX IF NOT EXISTS idx_kpi_och_org ON kpi_org_config_history(organization_id, kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_och_valid ON kpi_org_config_history(valid_from);

ALTER TABLE kpi_org_config_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_org_config_history_read ON kpi_org_config_history;
CREATE POLICY kpi_org_config_history_read ON kpi_org_config_history
  FOR SELECT TO authenticated USING (true);

-- Trigger: auto-track config changes
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

DROP TRIGGER IF EXISTS trg_kpi_org_config_history ON kpi_org_configs;
CREATE TRIGGER trg_kpi_org_config_history
  AFTER INSERT OR UPDATE ON kpi_org_configs
  FOR EACH ROW EXECUTE FUNCTION fn_kpi_org_config_history();

INSERT INTO schema_migrations (version, name) VALUES ('105', 'kpi_org_configs') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 106: KPI import jobs table
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kpi_import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  status          text NOT NULL DEFAULT 'processing',
  filename        text,
  total_rows      int NOT NULL DEFAULT 0,
  rows_imported   int NOT NULL DEFAULT 0,
  rows_skipped    int NOT NULL DEFAULT 0,
  rows_failed     int NOT NULL DEFAULT 0,
  error_log       jsonb,
  week_range      text,
  rep_count       int DEFAULT 0,
  kpi_count       int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kpi_import_jobs_org
  ON kpi_import_jobs(organization_id, created_at DESC);

ALTER TABLE kpi_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view import jobs" ON kpi_import_jobs;
CREATE POLICY "Org members can view import jobs"
  ON kpi_import_jobs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

INSERT INTO schema_migrations (version, name) VALUES ('106', 'kpi_import_jobs') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 107: Scheduled reports — allow managers (not just admins)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can manage scheduled reports" ON scheduled_reports;
DROP POLICY IF EXISTS "Managers and admins can manage scheduled reports" ON scheduled_reports;

CREATE POLICY "Managers and admins can manage scheduled reports"
  ON scheduled_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND organization_id = scheduled_reports.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND organization_id = scheduled_reports.organization_id
    )
  );

INSERT INTO schema_migrations (version, name) VALUES ('107', 'scheduled_reports_manager_rls') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 108: Fix revenue_closed → revenue_generated in KPI templates
-- ═══════════════════════════════════════════════════════════════════════════
-- Safe to re-run: only updates rows that still have the wrong key
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
WHERE title_key = 'ae' AND organization_id IS NULL
  AND kpi_configs::text LIKE '%revenue_closed%';

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
WHERE title_key = 'sales_manager' AND organization_id IS NULL
  AND kpi_configs::text LIKE '%revenue_closed%';

INSERT INTO schema_migrations (version, name) VALUES ('108', 'fix_kpi_template_revenue_key') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 109: Organization Isolation (multi-tenancy RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. Add organization_id to contests tables
ALTER TABLE active_contests
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE contest_templates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- 1b. Backfill from created_by → profiles.organization_id
UPDATE active_contests ac
SET organization_id = p.organization_id
FROM profiles p
WHERE ac.created_by = p.id AND ac.organization_id IS NULL;

UPDATE contest_templates ct
SET organization_id = p.organization_id
FROM profiles p
WHERE ct.created_by = p.id AND ct.organization_id IS NULL;

-- 1c. Delete orphaned rows (no org)
DELETE FROM contest_leaderboards
WHERE contest_id IN (SELECT id FROM active_contests WHERE organization_id IS NULL);

DELETE FROM contest_participants
WHERE contest_id IN (SELECT id FROM active_contests WHERE organization_id IS NULL);

DELETE FROM active_contests WHERE organization_id IS NULL;
DELETE FROM contest_templates WHERE organization_id IS NULL;

-- 1d. Make NOT NULL (safe: orphans deleted above; no-op if already NOT NULL)
DO $$ BEGIN
  ALTER TABLE active_contests ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'active_contests.organization_id SET NOT NULL: %', SQLERRM;
END $$;

DO $$ BEGIN
  ALTER TABLE contest_templates ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'contest_templates.organization_id SET NOT NULL: %', SQLERRM;
END $$;

-- 1e. Indexes
CREATE INDEX IF NOT EXISTS idx_active_contests_org ON active_contests(organization_id);
CREATE INDEX IF NOT EXISTS idx_contest_templates_org ON contest_templates(organization_id);

-- 1f. Enable RLS
ALTER TABLE contest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_skillsets ENABLE ROW LEVEL SECURITY;

-- 1g. Drop old + new policies (for idempotency)
DROP POLICY IF EXISTS "Users can view active contests" ON active_contests;
DROP POLICY IF EXISTS "Admins can manage contests" ON active_contests;
DROP POLICY IF EXISTS "Anyone can view templates" ON contest_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON contest_templates;
DROP POLICY IF EXISTS "Users can view contest participants" ON contest_participants;
DROP POLICY IF EXISTS "Users can view leaderboards" ON contest_leaderboards;
DROP POLICY IF EXISTS "Users can view own badges" ON profile_badges;
DROP POLICY IF EXISTS "Users can view all badges" ON profile_badges;
DROP POLICY IF EXISTS "Admins can manage badges" ON profile_badges;
DROP POLICY IF EXISTS "Users can view achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Users can view skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: view contests" ON active_contests;
DROP POLICY IF EXISTS "Org isolation: manage contests" ON active_contests;
DROP POLICY IF EXISTS "Org isolation: view templates" ON contest_templates;
DROP POLICY IF EXISTS "Org isolation: manage templates" ON contest_templates;
DROP POLICY IF EXISTS "Org isolation: view achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: manage achievements" ON profile_achievements;
DROP POLICY IF EXISTS "Org isolation: view badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: manage badges" ON profile_badges;
DROP POLICY IF EXISTS "Org isolation: view skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Org isolation: manage skillsets" ON profile_skillsets;
DROP POLICY IF EXISTS "Org isolation: view participants" ON contest_participants;
DROP POLICY IF EXISTS "Org isolation: manage participants" ON contest_participants;
DROP POLICY IF EXISTS "Org isolation: view leaderboards" ON contest_leaderboards;
DROP POLICY IF EXISTS "Org isolation: manage leaderboards" ON contest_leaderboards;

-- 1h. Create org-scoped policies

-- active_contests
CREATE POLICY "Org isolation: view contests"
  ON active_contests FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage contests"
  ON active_contests FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- contest_templates
CREATE POLICY "Org isolation: view templates"
  ON contest_templates FOR SELECT
  USING (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: manage templates"
  ON contest_templates FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- profile_achievements
CREATE POLICY "Org isolation: view achievements"
  ON profile_achievements FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage achievements"
  ON profile_achievements FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- profile_badges
CREATE POLICY "Org isolation: view badges"
  ON profile_badges FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage badges"
  ON profile_badges FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- profile_skillsets
CREATE POLICY "Org isolation: view skillsets"
  ON profile_skillsets FOR SELECT
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage skillsets"
  ON profile_skillsets FOR ALL
  USING (profile_id IN (
    SELECT id FROM profiles WHERE organization_id = auth_user_org_id()
  ));

-- contest_participants
CREATE POLICY "Org isolation: view participants"
  ON contest_participants FOR SELECT
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage participants"
  ON contest_participants FOR ALL
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

-- contest_leaderboards
CREATE POLICY "Org isolation: view leaderboards"
  ON contest_leaderboards FOR SELECT
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

CREATE POLICY "Org isolation: manage leaderboards"
  ON contest_leaderboards FOR ALL
  USING (contest_id IN (
    SELECT id FROM active_contests WHERE organization_id = auth_user_org_id()
  ));

-- 1i. Fix auto-enroll trigger to scope by org
CREATE OR REPLACE FUNCTION auto_enroll_contest_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auto_enroll THEN
    INSERT INTO contest_participants (contest_id, profile_id)
    SELECT NEW.id, p.id
    FROM profiles p
    WHERE p.organization_id = NEW.organization_id
      AND p.role IN ('rep', 'bdr', 'sdr', 'ae', 'am')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO schema_migrations (version, name) VALUES ('109', 'org_isolation') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 110: Add organization_id to notifications
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add column
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Backfill from profiles
UPDATE notifications n
SET organization_id = p.organization_id
FROM profiles p
WHERE n.profile_id = p.id
  AND n.organization_id IS NULL;

-- 3. Delete orphaned notifications (no matching profile → no org)
DELETE FROM notifications WHERE organization_id IS NULL
  AND profile_id NOT IN (SELECT id FROM profiles WHERE organization_id IS NOT NULL);

-- 4. Set NOT NULL (safe after cleanup; wrapped for safety)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE organization_id IS NULL) THEN
    ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'notifications: some rows still have NULL organization_id — skipping SET NOT NULL';
  END IF;
END $$;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id
  ON notifications(organization_id);

CREATE INDEX IF NOT EXISTS idx_notifications_org_profile
  ON notifications(organization_id, profile_id);

-- 6. Updated create_notification function
CREATE OR REPLACE FUNCTION create_notification(
  p_profile_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 5,
  p_dedupe_key TEXT DEFAULT NULL,
  p_achievement_id UUID DEFAULT NULL,
  p_badge_id UUID DEFAULT NULL,
  p_contest_id UUID DEFAULT NULL,
  p_skillset_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
  v_org_id UUID;
BEGIN
  v_org_id := p_organization_id;
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id FROM profiles WHERE id = p_profile_id;
  END IF;

  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO notification_id
    FROM notifications
    WHERE profile_id = p_profile_id
      AND dedupe_key = p_dedupe_key
      AND created_at > NOW() - INTERVAL '24 hours';
    IF notification_id IS NOT NULL THEN
      RETURN notification_id;
    END IF;
  END IF;

  INSERT INTO notifications (
    profile_id, organization_id, type, title, message, icon, color,
    action_url, priority, dedupe_key,
    achievement_id, badge_id, contest_id, skillset_id
  ) VALUES (
    p_profile_id, v_org_id, p_type, p_title, p_message, p_icon, p_color,
    p_action_url, p_priority, p_dedupe_key,
    p_achievement_id, p_badge_id, p_contest_id, p_skillset_id
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Updated triggers
CREATE OR REPLACE FUNCTION notify_achievement_earned()
RETURNS TRIGGER AS $$
DECLARE
  v_achievement RECORD;
  v_org_id UUID;
BEGIN
  SELECT a.*, s.name as skillset_name
  INTO v_achievement
  FROM achievements a
  JOIN skillsets s ON s.id = a.skillset_id
  WHERE a.id = NEW.achievement_id;

  SELECT organization_id INTO v_org_id FROM profiles WHERE id = NEW.profile_id;

  PERFORM create_notification(
    p_profile_id := NEW.profile_id,
    p_type := 'achievement_earned'::notification_type,
    p_title := 'Achievement Unlocked!',
    p_message := 'You earned "' || v_achievement.name || '" in ' || v_achievement.skillset_name || ' (+' || v_achievement.points || ' pts)',
    p_icon := '🎯',
    p_color := '#10B981',
    p_action_url := '/profile#achievements',
    p_priority := 7,
    p_dedupe_key := 'achievement-' || NEW.achievement_id || '-' || NEW.profile_id,
    p_achievement_id := NEW.achievement_id,
    p_skillset_id := v_achievement.skillset_id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_badge_earned()
RETURNS TRIGGER AS $$
DECLARE
  v_is_rare BOOLEAN;
  v_points INTEGER;
  v_badge_type TEXT;
  v_notification_type notification_type;
  v_org_id UUID;
BEGIN
  SELECT is_rare, points, badge_type
  INTO v_is_rare, v_points, v_badge_type
  FROM badge_definitions
  WHERE badge_name = NEW.badge_name
  LIMIT 1;

  SELECT organization_id INTO v_org_id FROM profiles WHERE id = NEW.profile_id;

  IF v_is_rare THEN
    v_notification_type := 'rare_badge_earned'::notification_type;
  ELSE
    v_notification_type := 'badge_earned'::notification_type;
  END IF;

  PERFORM create_notification(
    p_profile_id := NEW.profile_id,
    p_type := v_notification_type,
    p_title := CASE WHEN v_is_rare THEN 'Rare Badge Earned!' ELSE 'New Badge!' END,
    p_message := 'You earned the "' || NEW.badge_name || '" badge' ||
                 CASE WHEN v_points IS NOT NULL THEN ' (+' || v_points || ' pts)' ELSE '' END,
    p_icon := COALESCE(NEW.icon, '🏆'),
    p_color := COALESCE(NEW.color, '#3B82F6'),
    p_action_url := '/profile#badges',
    p_priority := CASE WHEN v_is_rare THEN 9 ELSE 7 END,
    p_dedupe_key := 'badge-' || NEW.badge_name || '-' || NEW.profile_id,
    p_badge_id := NEW.id,
    p_organization_id := v_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_contest_winners()
RETURNS TRIGGER AS $$
DECLARE
  v_winner RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    FOR v_winner IN
      SELECT cl.profile_id, cl.rank, cl.score, p.full_name
      FROM contest_leaderboards cl
      JOIN profiles p ON p.id = cl.profile_id
      WHERE cl.contest_id = NEW.id AND cl.rank <= 3
      ORDER BY cl.rank
    LOOP
      PERFORM create_notification(
        p_profile_id := v_winner.profile_id,
        p_type := CASE
          WHEN v_winner.rank = 1 THEN 'contest_winner'::notification_type
          ELSE 'contest_top_3'::notification_type
        END,
        p_title := CASE
          WHEN v_winner.rank = 1 THEN 'Contest Winner!'
          WHEN v_winner.rank = 2 THEN '2nd Place!'
          WHEN v_winner.rank = 3 THEN '3rd Place!'
        END,
        p_message := 'You placed #' || v_winner.rank || ' in "' || NEW.name || '" contest!' ||
                     CASE WHEN NEW.reward_value IS NOT NULL THEN ' - ' || NEW.reward_value ELSE '' END,
        p_icon := CASE
          WHEN v_winner.rank = 1 THEN '🥇'
          WHEN v_winner.rank = 2 THEN '🥈'
          ELSE '🥉'
        END,
        p_color := CASE
          WHEN v_winner.rank = 1 THEN '#FFD700'
          WHEN v_winner.rank = 2 THEN '#C0C0C0'
          ELSE '#CD7F32'
        END,
        p_action_url := '/contests',
        p_priority := 10,
        p_dedupe_key := 'contest-win-' || NEW.id || '-' || v_winner.profile_id,
        p_contest_id := NEW.id,
        p_organization_id := NEW.organization_id
      );
    END LOOP;

    PERFORM create_notification(
      profile_id,
      'contest_participation'::notification_type,
      'Contest Completed',
      'The "' || NEW.name || '" contest has ended. Check the leaderboard!',
      '🎪', '#FF9800', '/contests', 5,
      'contest-end-' || NEW.id || '-' || profile_id,
      NULL, NULL, NEW.id, NULL,
      NEW.organization_id
    )
    FROM contest_participants
    WHERE contest_id = NEW.id
      AND profile_id NOT IN (
        SELECT profile_id FROM contest_leaderboards
        WHERE contest_id = NEW.id AND rank <= 3
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Drop and recreate notification RLS with organization_id
DROP POLICY IF EXISTS "Org isolation: view own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: update own notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: insert notifications" ON notifications;
DROP POLICY IF EXISTS "Org isolation: delete own notifications" ON notifications;

CREATE POLICY "Org isolation: view own notifications"
  ON notifications FOR SELECT
  USING (profile_id = auth.uid() AND organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: update own notifications"
  ON notifications FOR UPDATE
  USING (profile_id = auth.uid() AND organization_id = auth_user_org_id())
  WITH CHECK (profile_id = auth.uid() AND organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: delete own notifications"
  ON notifications FOR DELETE
  USING (profile_id = auth.uid() AND organization_id = auth_user_org_id());

INSERT INTO schema_migrations (version, name) VALUES ('110', 'notifications_org_id') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 111: Make profiles.team_id nullable
-- ═══════════════════════════════════════════════════════════════════════════
-- (You already ran this manually — safe to re-run)
ALTER TABLE profiles ALTER COLUMN team_id DROP NOT NULL;

INSERT INTO schema_migrations (version, name) VALUES ('111', 'profiles_team_id_nullable') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 112: Convert profiles.title from enum to text
-- ═══════════════════════════════════════════════════════════════════════════
-- (You already ran this manually — safe to re-run)
DROP VIEW IF EXISTS profiles_with_team_name;

-- Drop defaults that reference the enum (no-op if already dropped)
DO $$ BEGIN
  ALTER TABLE profiles ALTER COLUMN title DROP DEFAULT;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE action_plans ALTER COLUMN title DROP DEFAULT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Convert to text (no-op if already text)
ALTER TABLE profiles ALTER COLUMN title TYPE text USING title::text;
ALTER TABLE action_plans ALTER COLUMN title TYPE text USING title::text;

-- Drop enum (no-op if already dropped)
DROP TYPE IF EXISTS profile_title;

-- Recreate the view
CREATE OR REPLACE VIEW profiles_with_team_name AS
SELECT p.*, t.name AS team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team_id;

INSERT INTO schema_migrations (version, name) VALUES ('112', 'profile_title_to_text') ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- ALSO RECORD earlier migrations (001–095) as already applied
-- so the tracking table reflects the full history.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO schema_migrations (version, name) VALUES
  ('001', 'init_schema'),
  ('002', 'kpis_and_seed_data'),
  ('003', 'admin_permissions'),
  ('004', 'skillsets_and_achievements'),
  ('005', 'contests_and_badges'),
  ('006', 'populate_departments_and_teams'),
  ('007', 'rls_policies'),
  ('008', 'populate_badges'),
  ('009', 'expand_kpi_metrics'),
  ('010', 'populate_historical_data'),
  ('011', 'update_achievement_copy'),
  ('012', 'coaching_plans'),
  ('013', 'cumulative_progression_system'),
  ('014', 'initialize_profile_skillsets'),
  ('015', 'populate_achievement_criteria'),
  ('016', 'criteria_based_achievements'),
  ('017', 'badge_management_permissions'),
  ('018', 'redesign_achievements'),
  ('019', 'fix_achievement_prerequisites'),
  ('020', 'backfill_dials_data'),
  ('021', 'fix_badge_system'),
  ('022', 'enhanced_badge_system'),
  ('023', 'volume_badge_auto_award'),
  ('024', 'enhanced_notifications'),
  ('025', 'integrations_system'),
  ('026', 'enhance_coaching_plans'),
  ('027', 'badge_definitions_table'),
  ('028', 'badge_definitions_policy_update'),
  ('029', 'apptivia_engage'),
  ('030', 'update_scorecard_achievement_names'),
  ('031', 'engage_phase1_workflows'),
  ('032', 'engage_phase3'),
  ('033', 'engage_integration'),
  ('034', 'prompt_library'),
  ('035', 'add_profiles_organization_id'),
  ('036', 'enhanced_abm_signals'),
  ('038', 'permission_overrides'),
  ('039', 'rls_org_scoping'),
  ('040', 'icp_config'),
  ('041', 'call_logs'),
  ('042', 'webhook_ingest'),
  ('043', 'deal_risk_notifications'),
  ('044', 'activity_feed'),
  ('045', 'website_visitors'),
  ('046', 'signal_library'),
  ('047', 'new_signal_types'),
  ('048', 'capterra_glassdoor_signals'),
  ('049', 'signal_fixes'),
  ('050', 'icp_update_apptivia_test_org'),
  ('051', 'signal_to_pipeline'),
  ('052', 'icp_prospector'),
  ('053', 'icp_apollo_industry_labels'),
  ('054', 'icp_new_dimensions'),
  ('055', 'twilio_call_enhancements'),
  ('056', 'engage_research_reports'),
  ('057', 'research_reports_columns'),
  ('058', 'funnel_benchmarks'),
  ('059', 'sample_kpi_data_6months'),
  ('060', 'reset_and_seed_kpi_data'),
  ('061', 'tiered_kpi_seed_data'),
  ('062', 'autopilot_infrastructure'),
  ('063', 'achievement_cleanup'),
  ('064', 'kpi_metric_history'),
  ('065', 'scorecard_master_redesign'),
  ('066', 'fix_kpi_history_trigger_security'),
  ('067', 'fix_skillset_progress_dynamic_max'),
  ('068', 'fix_closed_won_deals_kpi_key'),
  ('069', 'plan_effectiveness'),
  ('070', 'fix_scorecard_master_color'),
  ('071', 'seed_last_week_kpi_data'),
  ('072', 'bd_hiring_intent_signals'),
  ('073', 'icp_config_optimize_apptivia'),
  ('074', 'integration_framework'),
  ('075', 'invitations'),
  ('076', 'user_integrations'),
  ('077', 'engage_achievement_cleanup'),
  ('078', 'recalculate_profile_skillsets'),
  ('079', 'feedback_signals'),
  ('080', 'coaching_plan_visibility'),
  ('081', 'seed_last_week_kpi_data'),
  ('082', 'coaching_plan_enhancements'),
  ('083', 'gong_integration'),
  ('084', 'new_kpis_and_direction'),
  ('085', 'sendoso_integration'),
  ('086', 'individual_development_plans'),
  ('087', 'performance_reviews'),
  ('088', 'seed_integration_kpi_data'),
  ('089', 'fix_benchmarks_and_directions'),
  ('090', 'fix_funnel_benchmark_rates'),
  ('091', 'fix_kpi_seed_data'),
  ('092', 'kpi_anomalies_delete_policy'),
  ('093', 'seed_demo_anomaly_dips'),
  ('094', 'invitation_accept_policy'),
  ('095', 'cep_infrastructure')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE — Verify
-- ═══════════════════════════════════════════════════════════════════════════
SELECT version, name, applied_at
FROM schema_migrations
ORDER BY version;
