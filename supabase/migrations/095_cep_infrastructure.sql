-- ============================================================
-- Migration 095: Customer Engagement Process (CEP) Infrastructure
-- Configurable sales process stages, per-deal progress tracking,
-- stage transition history, and org-level job titles.
-- ============================================================

-- ── 1. CEP STAGES — Org-level configurable process stages ───

CREATE TABLE IF NOT EXISTS cep_stages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Stage identity
  stage_key       TEXT NOT NULL,
  stage_name      TEXT NOT NULL,
  stage_order     INTEGER NOT NULL,

  -- Future multi-CEP support (V1: always 'new_business')
  cep_type        TEXT NOT NULL DEFAULT 'new_business',

  -- Stage configuration
  color           TEXT DEFAULT '#6366f1',
  win_probability INTEGER DEFAULT 0 CHECK (win_probability >= 0 AND win_probability <= 100),

  -- Checklist & exit criteria (JSONB arrays)
  -- checklist_items: [{ "key": "...", "label": "...", "required": false }]
  checklist_items JSONB DEFAULT '[]',
  -- exit_criteria: [{ "key": "...", "label": "..." }]
  exit_criteria   JSONB DEFAULT '[]',
  -- role_responsibilities: [{ "title": "AE", "responsibility": "Lead discovery call" }]
  role_responsibilities JSONB DEFAULT '[]',

  -- Deal velocity
  expected_days   INTEGER,
  is_terminal     BOOLEAN DEFAULT false,

  -- Metadata
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, cep_type, stage_key)
);

CREATE INDEX IF NOT EXISTS idx_cep_stages_org
  ON cep_stages(organization_id, cep_type, stage_order);

-- ── 2. CEP DEAL STAGES — Per-deal stage transition history ──

CREATE TABLE IF NOT EXISTS cep_deal_stages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id         UUID NOT NULL REFERENCES engage_pipeline_deals(id) ON DELETE CASCADE,
  cep_stage_id    UUID NOT NULL REFERENCES cep_stages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at       TIMESTAMPTZ,

  checklist_completed JSONB DEFAULT '{}',
  exit_criteria_met   JSONB DEFAULT '{}',

  notes           TEXT,
  advanced_by     UUID REFERENCES profiles(id),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cep_deal_stages_deal
  ON cep_deal_stages(deal_id);
CREATE INDEX IF NOT EXISTS idx_cep_deal_stages_current
  ON cep_deal_stages(deal_id) WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cep_deal_stages_org
  ON cep_deal_stages(organization_id);

-- ── 3. Add cep_stage_id FK to engage_pipeline_deals ─────────

ALTER TABLE engage_pipeline_deals
  ADD COLUMN IF NOT EXISTS cep_stage_id UUID REFERENCES cep_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_cep_stage
  ON engage_pipeline_deals(cep_stage_id)
  WHERE cep_stage_id IS NOT NULL;

-- ── 4. TITLES — Org-level job function titles ───────────────

CREATE TABLE IF NOT EXISTS titles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title_key       TEXT NOT NULL,
  title_name      TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, title_key)
);

CREATE INDEX IF NOT EXISTS idx_titles_org
  ON titles(organization_id, sort_order);

-- Add title_id FK to profiles (nullable)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS title_id UUID REFERENCES titles(id) ON DELETE SET NULL;

-- ── 5. ROW-LEVEL SECURITY ───────────────────────────────────

ALTER TABLE cep_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

-- cep_stages
CREATE POLICY "Users can view org cep_stages" ON cep_stages
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can insert org cep_stages" ON cep_stages
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can update org cep_stages" ON cep_stages
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can delete org cep_stages" ON cep_stages
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- cep_deal_stages
CREATE POLICY "Users can view org cep_deal_stages" ON cep_deal_stages
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can insert org cep_deal_stages" ON cep_deal_stages
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can update org cep_deal_stages" ON cep_deal_stages
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can delete org cep_deal_stages" ON cep_deal_stages
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- titles
CREATE POLICY "Users can view org titles" ON titles
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can insert org titles" ON titles
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can update org titles" ON titles
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can delete org titles" ON titles
  FOR DELETE USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- FIX: Missing DELETE policy on engage_pipeline_deals (latent bug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'engage_pipeline_deals' AND policyname = 'Users can delete org deals'
  ) THEN
    CREATE POLICY "Users can delete org deals" ON engage_pipeline_deals
      FOR DELETE USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

-- ── 6. UPDATED_AT TRIGGERS ──────────────────────────────────

-- Ensure the shared trigger function exists (originally from migration 029)
CREATE OR REPLACE FUNCTION engage_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cep_stages_updated_at
  BEFORE UPDATE ON cep_stages
  FOR EACH ROW EXECUTE FUNCTION engage_set_updated_at();

CREATE TRIGGER trg_cep_deal_stages_updated_at
  BEFORE UPDATE ON cep_deal_stages
  FOR EACH ROW EXECUTE FUNCTION engage_set_updated_at();

CREATE TRIGGER trg_titles_updated_at
  BEFORE UPDATE ON titles
  FOR EACH ROW EXECUTE FUNCTION engage_set_updated_at();

-- ── 7. SEED DATA — Standard B2B CEP for Apptivia Test Org ───

INSERT INTO cep_stages (organization_id, cep_type, stage_key, stage_name, stage_order, color, win_probability, expected_days, is_terminal, checklist_items, exit_criteria, role_responsibilities)
VALUES
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'lead',
   'Lead', 1, '#94a3b8', 5, 7, false,
   '[{"key":"lead_source_identified","label":"Lead source identified","required":true},{"key":"contact_info_verified","label":"Contact info verified","required":true}]'::jsonb,
   '[{"key":"initial_outreach_complete","label":"Initial outreach completed"}]'::jsonb,
   '[{"title":"BDR","responsibility":"Qualify inbound lead and schedule first meeting"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'opp_creation',
   'Opp Creation', 2, '#60a5fa', 10, 5, false,
   '[{"key":"opportunity_created_in_crm","label":"Opportunity created in CRM","required":true},{"key":"stakeholder_mapped","label":"Key stakeholders mapped","required":false}]'::jsonb,
   '[{"key":"discovery_call_scheduled","label":"Discovery call scheduled"}]'::jsonb,
   '[{"title":"BDR","responsibility":"Create opportunity record"},{"title":"AE","responsibility":"Confirm deal viability"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'qualification',
   'Qualification', 3, '#818cf8', 20, 14, false,
   '[{"key":"bant_completed","label":"BANT/MEDDPICC qualification completed","required":true},{"key":"champion_identified","label":"Champion/economic buyer identified","required":true},{"key":"pain_points_documented","label":"Pain points documented","required":false},{"key":"competitive_landscape_mapped","label":"Competitive landscape mapped","required":false}]'::jsonb,
   '[{"key":"budget_range_confirmed","label":"Budget range confirmed"},{"key":"timeline_established","label":"Timeline established"}]'::jsonb,
   '[{"title":"BDR","responsibility":"Conduct initial discovery and hand off qualified details"},{"title":"AE","responsibility":"Lead deeper qualification calls and discovery"},{"title":"PS","responsibility":"Provide technical validation if needed"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'best_case',
   'Best Case', 4, '#a78bfa', 40, 14, false,
   '[{"key":"demo_delivered","label":"Demo/proof-of-concept delivered","required":true},{"key":"proposal_sent","label":"Proposal/quote sent","required":true},{"key":"decision_criteria_agreed","label":"Decision criteria agreed upon","required":false}]'::jsonb,
   '[{"key":"verbal_intent","label":"Verbal intent to proceed received"}]'::jsonb,
   '[{"title":"AE","responsibility":"Deliver tailored demo and proposal"},{"title":"PS","responsibility":"Support technical proof-of-concept"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'forecast',
   'Forecast', 5, '#c084fc', 60, 10, false,
   '[{"key":"pricing_agreed","label":"Pricing and terms agreed","required":true},{"key":"legal_review_started","label":"Legal/procurement review started","required":false},{"key":"implementation_plan_shared","label":"Implementation plan shared","required":false}]'::jsonb,
   '[{"key":"written_confirmation","label":"Written confirmation of intent"}]'::jsonb,
   '[{"title":"AE","responsibility":"Negotiate final terms"},{"title":"CSS","responsibility":"Prepare implementation timeline"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'commit',
   'Commit', 6, '#e879f9', 80, 7, false,
   '[{"key":"contract_sent","label":"Contract sent for signature","required":true},{"key":"internal_approvals_complete","label":"Internal approvals complete","required":true}]'::jsonb,
   '[{"key":"signature_received","label":"Contract signed"}]'::jsonb,
   '[{"title":"AE","responsibility":"Shepherd contract through signature"},{"title":"CSS","responsibility":"Begin onboarding prep"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'closed_won',
   'Closed Won', 7, '#34d399', 100, NULL, true,
   '[{"key":"revenue_booked","label":"Revenue booked in system","required":true},{"key":"handoff_complete","label":"AE-to-CS handoff complete","required":true}]'::jsonb,
   '[]'::jsonb,
   '[{"title":"AE","responsibility":"Complete handoff documentation"},{"title":"CSS","responsibility":"Begin customer onboarding"}]'::jsonb),

  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'new_business', 'closed_lost',
   'Closed Lost', 8, '#f87171', 0, NULL, true,
   '[{"key":"loss_reason_documented","label":"Loss reason documented","required":true}]'::jsonb,
   '[]'::jsonb,
   '[{"title":"AE","responsibility":"Document loss reason and competitive intel"}]'::jsonb)
ON CONFLICT (organization_id, cep_type, stage_key) DO NOTHING;

-- Seed default titles for Apptivia Test Org
INSERT INTO titles (organization_id, title_key, title_name, description, sort_order)
VALUES
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'bdr', 'BDR', 'Business Development Representative', 1),
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'ae', 'AE', 'Account Executive', 2),
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'ps', 'PS', 'Pre-Sales / Solutions Engineer', 3),
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'ts', 'TS', 'Technical Specialist', 4),
  ('c065a9f9-dd42-496d-bda3-246adcfe7949', 'css', 'CSS', 'Customer Success Specialist', 5)
ON CONFLICT (organization_id, title_key) DO NOTHING;

-- ── 8. COMMENTS ─────────────────────────────────────────────

COMMENT ON TABLE cep_stages IS 'CEP: Org-configurable sales process stages with checklists, exit criteria, and role responsibilities';
COMMENT ON TABLE cep_deal_stages IS 'CEP: Per-deal stage transition history with checklist completion tracking';
COMMENT ON TABLE titles IS 'CEP: Org-level job function titles (BDR, AE, PS, etc.) for role responsibilities';
COMMENT ON COLUMN engage_pipeline_deals.cep_stage_id IS 'FK to current CEP stage; null = legacy/no CEP configured';
COMMENT ON COLUMN profiles.title_id IS 'FK to org-level titles table; null = no structured title assigned';
