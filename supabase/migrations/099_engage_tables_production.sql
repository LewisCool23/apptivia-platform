-- Migration 099: Apptivia Engage — Production deployment
-- Creates all Engage tables for Supabase SQL Editor.
-- Based on migration 029 + 055 (last_called_at).
-- Drops any partial tables from earlier failed attempts first.

-- ============================================================
-- 0. CLEAN UP partial tables from failed attempts + enable extension
-- ============================================================
DROP TABLE IF EXISTS engage_activity_log CASCADE;
DROP TABLE IF EXISTS engage_outreach_drafts CASCADE;
DROP TABLE IF EXISTS engage_research_reports CASCADE;
DROP TABLE IF EXISTS engage_prospect_list_items CASCADE;
DROP TABLE IF EXISTS engage_prospect_lists CASCADE;
DROP TABLE IF EXISTS engage_prospects CASCADE;
DROP TABLE IF EXISTS engage_companies CASCADE;
DROP TABLE IF EXISTS engage_saved_searches CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. COMPANIES — enriched company profiles
-- ============================================================
CREATE TABLE engage_companies (
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

-- ============================================================
-- 2. PROSPECTS — individual contacts
-- ============================================================
CREATE TABLE engage_prospects (
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

  -- From migration 055
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

-- ============================================================
-- 3. PROSPECT LISTS — named collections
-- ============================================================
CREATE TABLE engage_prospect_lists (
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

-- Junction table
CREATE TABLE engage_prospect_list_items (
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

-- ============================================================
-- 4. SAVED SEARCHES — reusable query criteria
-- ============================================================
CREATE TABLE engage_saved_searches (
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

-- FK from prospect_lists to saved_searches (safe with DO block)
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

-- ============================================================
-- 5. RESEARCH REPORTS — AI-generated company/prospect briefs
-- ============================================================
CREATE TABLE engage_research_reports (
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

-- ============================================================
-- 6. OUTREACH DRAFTS — AI-generated messages
-- ============================================================
CREATE TABLE engage_outreach_drafts (
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

-- ============================================================
-- 7. ACTIVITY LOG — audit trail for all Engage actions
-- ============================================================
CREATE TABLE engage_activity_log (
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

-- ============================================================
-- 8. ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE engage_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospect_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_prospect_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engage_activity_log ENABLE ROW LEVEL SECURITY;

-- Org-scoped read/write policies (drop first for idempotency)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'engage_companies',
    'engage_prospects',
    'engage_prospect_lists',
    'engage_saved_searches',
    'engage_research_reports',
    'engage_outreach_drafts',
    'engage_activity_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'policy_org_' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (
        organization_id = (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )',
      'policy_org_' || tbl, tbl
    );
  END LOOP;
END $$;

-- List items policy (through list ownership)
DROP POLICY IF EXISTS policy_org_engage_prospect_list_items ON engage_prospect_list_items;
CREATE POLICY policy_org_engage_prospect_list_items
  ON engage_prospect_list_items FOR ALL
  USING (
    list_id IN (
      SELECT id FROM engage_prospect_lists
      WHERE organization_id = (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- 9. HELPER FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update prospect_count on list changes
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

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION engage_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'engage_companies',
    'engage_prospects',
    'engage_prospect_lists',
    'engage_saved_searches',
    'engage_outreach_drafts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION engage_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- 10. TABLE COMMENTS
-- ============================================================
COMMENT ON TABLE engage_companies IS 'Apptivia Engage: enriched company profiles for prospecting';
COMMENT ON TABLE engage_prospects IS 'Apptivia Engage: individual prospect contacts with scoring';
COMMENT ON TABLE engage_prospect_lists IS 'Apptivia Engage: named collections of prospects';
COMMENT ON TABLE engage_saved_searches IS 'Apptivia Engage: reusable search/filter criteria';
COMMENT ON TABLE engage_research_reports IS 'Apptivia Engage: AI-generated company & prospect briefs';
COMMENT ON TABLE engage_outreach_drafts IS 'Apptivia Engage: AI-generated outreach messages';
COMMENT ON TABLE engage_activity_log IS 'Apptivia Engage: audit trail of user actions and credit usage';
