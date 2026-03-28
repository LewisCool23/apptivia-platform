-- 086: Individual Development Plans (IDPs)
-- Long-term quarterly/annual growth plans for reps

-- ── IDP Templates ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idp_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT DEFAULT 'target',
  category      TEXT DEFAULT 'general',
  plan_type     TEXT NOT NULL DEFAULT 'quarterly' CHECK (plan_type IN ('quarterly','annual','custom')),
  default_duration_days INT DEFAULT 90,
  career_goals        JSONB DEFAULT '[]'::jsonb,
  development_areas   JSONB DEFAULT '[]'::jsonb,
  suggested_focus_kpis TEXT[] DEFAULT '{}',
  suggested_milestones JSONB DEFAULT '[]'::jsonb,
  suggested_actions   JSONB DEFAULT '[]'::jsonb,
  suggested_resources JSONB DEFAULT '[]'::jsonb,
  success_criteria    JSONB DEFAULT '[]'::jsonb,
  is_system     BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Individual Development Plans ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS individual_development_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  plan_type       TEXT NOT NULL DEFAULT 'quarterly' CHECK (plan_type IN ('quarterly','annual','custom')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','in_progress','completed','overdue','cancelled')),
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES profiles(id),
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  period_start    DATE,
  period_end      DATE,
  career_goals    JSONB DEFAULT '[]'::jsonb,
  development_areas JSONB DEFAULT '[]'::jsonb,
  focus_kpis      TEXT[] DEFAULT '{}',
  milestones      JSONB DEFAULT '[]'::jsonb,
  action_items    JSONB DEFAULT '[]'::jsonb,
  resources       JSONB DEFAULT '[]'::jsonb,
  success_criteria JSONB DEFAULT '[]'::jsonb,
  notes           TEXT,
  baseline_kpi_snapshot JSONB,
  current_kpi_snapshot  JSONB,
  visibility      TEXT DEFAULT 'individual' CHECK (visibility IN ('individual','team')),
  template_id     UUID REFERENCES idp_templates(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_idps_profile ON individual_development_plans(profile_id);
CREATE INDEX IF NOT EXISTS idx_idps_org ON individual_development_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_idps_status ON individual_development_plans(status);
CREATE INDEX IF NOT EXISTS idx_idps_created_by ON individual_development_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_idp_templates_org ON idp_templates(organization_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE individual_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE idp_templates ENABLE ROW LEVEL SECURITY;

-- IDPs: admins see all in org, managers see their team, reps see their own
CREATE POLICY idps_select ON individual_development_plans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = individual_development_plans.organization_id
    AND (
      p.role = 'admin'
      OR individual_development_plans.profile_id = auth.uid()
      OR individual_development_plans.created_by = auth.uid()
      OR (p.role IN ('manager','coach') AND individual_development_plans.team_id = p.team_id)
    )
  )
);

CREATE POLICY idps_insert ON individual_development_plans FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = individual_development_plans.organization_id
    AND p.role IN ('admin','manager','coach')
  )
);

CREATE POLICY idps_update ON individual_development_plans FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = individual_development_plans.organization_id
    AND (
      p.role = 'admin'
      OR individual_development_plans.created_by = auth.uid()
      OR (p.role IN ('manager','coach') AND individual_development_plans.team_id = p.team_id)
    )
  )
);

CREATE POLICY idps_delete ON individual_development_plans FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = individual_development_plans.organization_id
    AND (p.role = 'admin' OR individual_development_plans.created_by = auth.uid())
  )
);

-- Templates: system templates visible to all, org templates visible to org members
CREATE POLICY idp_templates_select ON idp_templates FOR SELECT USING (
  is_system = true
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = idp_templates.organization_id
  )
);

CREATE POLICY idp_templates_insert ON idp_templates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = idp_templates.organization_id
    AND p.role IN ('admin','manager')
  )
);

CREATE POLICY idp_templates_update ON idp_templates FOR UPDATE USING (
  is_system = false AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = idp_templates.organization_id
    AND p.role IN ('admin','manager')
  )
);

CREATE POLICY idp_templates_delete ON idp_templates FOR DELETE USING (
  is_system = false AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = idp_templates.organization_id
    AND p.role = 'admin'
  )
);

-- ── Seed system templates ─────────────────────────────────────────────────────
INSERT INTO idp_templates (name, description, icon, category, plan_type, default_duration_days, career_goals, development_areas, suggested_focus_kpis, suggested_milestones, suggested_actions, suggested_resources, success_criteria, is_system) VALUES
(
  'Sales Leadership Path',
  'Develop leadership skills for reps aspiring to management roles',
  'crown',
  'leadership',
  'annual',
  365,
  '[{"goal":"Develop team leadership capabilities","timeframe":"12 months"},{"goal":"Build coaching and mentoring skills","timeframe":"6 months"},{"goal":"Demonstrate strategic thinking in pipeline management","timeframe":"9 months"}]'::jsonb,
  '[{"area":"Team Leadership","current_level":"beginner","target_level":"intermediate"},{"area":"Coaching & Mentoring","current_level":"beginner","target_level":"proficient"},{"area":"Strategic Planning","current_level":"beginner","target_level":"intermediate"}]'::jsonb,
  ARRAY['pipeline_created','win_rate','meetings'],
  '[{"title":"Lead a team meeting","target_date_offset_days":30,"status":"pending"},{"title":"Mentor a new hire for 4 weeks","target_date_offset_days":90,"status":"pending"},{"title":"Present quarterly strategy to leadership","target_date_offset_days":180,"status":"pending"},{"title":"Shadow manager for 1 week","target_date_offset_days":60,"status":"pending"}]'::jsonb,
  '[{"action":"Shadow current manager for 1 full week","category":"on_the_job"},{"action":"Complete leadership fundamentals course","category":"training"},{"action":"Lead 2 team meetings per month","category":"practice"},{"action":"Mentor a junior rep for one quarter","category":"coaching"}]'::jsonb,
  '[{"title":"Leadership Fundamentals for Sales","type":"course","url":""},{"title":"Coaching Habit by Michael Bungay Stanier","type":"book","url":""},{"title":"Weekly 1:1 with manager focused on leadership growth","type":"mentoring","url":""}]'::jsonb,
  '[{"criterion":"Successfully led 6+ team meetings with positive feedback"},{"criterion":"Mentored at least 1 rep through a full quarter"},{"criterion":"Presented a pipeline strategy that was adopted by the team"},{"criterion":"Received leadership-ready assessment from manager"}]'::jsonb,
  true
),
(
  'Pipeline Mastery',
  'Master pipeline generation, qualification, and management techniques',
  'target',
  'skills',
  'quarterly',
  90,
  '[{"goal":"Increase qualified pipeline by 25%","timeframe":"3 months"},{"goal":"Improve deal qualification accuracy","timeframe":"2 months"},{"goal":"Reduce pipeline leakage by 15%","timeframe":"3 months"}]'::jsonb,
  '[{"area":"Pipeline Generation","current_level":"intermediate","target_level":"advanced"},{"area":"Deal Qualification","current_level":"beginner","target_level":"proficient"},{"area":"Forecasting","current_level":"beginner","target_level":"intermediate"}]'::jsonb,
  ARRAY['pipeline_created','sourced_opps','qualified_leads','stage2_opps'],
  '[{"title":"Audit current pipeline and tag deal health","target_date_offset_days":7,"status":"pending"},{"title":"Implement MEDDIC qualification on all new opps","target_date_offset_days":21,"status":"pending"},{"title":"Achieve 20% increase in Stage 2 conversions","target_date_offset_days":60,"status":"pending"},{"title":"Hit 25% pipeline growth target","target_date_offset_days":90,"status":"pending"}]'::jsonb,
  '[{"action":"Conduct a full pipeline audit with manager","category":"on_the_job"},{"action":"Apply MEDDIC framework to every new opportunity","category":"practice"},{"action":"Review and update pipeline weekly with forecast notes","category":"habit"},{"action":"Role-play discovery calls 2x per week","category":"practice"}]'::jsonb,
  '[{"title":"MEDDIC Sales Methodology","type":"methodology","url":""},{"title":"Pipeline Management Best Practices","type":"guide","url":""},{"title":"Weekly pipeline review with manager","type":"coaching","url":""}]'::jsonb,
  '[{"criterion":"Pipeline value increased by 25% vs. baseline"},{"criterion":"MEDDIC criteria documented on 100% of new Stage 2+ deals"},{"criterion":"Forecast accuracy within 10% of actual for the quarter"},{"criterion":"Zero stale deals (>30 days without activity) in pipeline"}]'::jsonb,
  true
),
(
  'Communication Excellence',
  'Enhance sales communication skills across calls, emails, and presentations',
  'message-circle',
  'skills',
  'quarterly',
  90,
  '[{"goal":"Improve talk-to-listen ratio to 40/60","timeframe":"2 months"},{"goal":"Increase email response rates by 20%","timeframe":"3 months"},{"goal":"Deliver compelling product demos consistently","timeframe":"3 months"}]'::jsonb,
  '[{"area":"Active Listening","current_level":"intermediate","target_level":"advanced"},{"area":"Written Communication","current_level":"intermediate","target_level":"proficient"},{"area":"Presentation Skills","current_level":"beginner","target_level":"intermediate"}]'::jsonb,
  ARRAY['talk_to_listen_ratio','questions_asked','emails_sent','demos_completed'],
  '[{"title":"Record and review 5 calls for talk ratio analysis","target_date_offset_days":14,"status":"pending"},{"title":"A/B test 3 email templates and measure response rates","target_date_offset_days":30,"status":"pending"},{"title":"Complete presentation skills workshop","target_date_offset_days":45,"status":"pending"},{"title":"Deliver demo that receives 9+ NPS from prospect","target_date_offset_days":75,"status":"pending"}]'::jsonb,
  '[{"action":"Review call recordings weekly with manager focus on listening","category":"coaching"},{"action":"Practice asking 3+ open-ended questions per discovery call","category":"habit"},{"action":"Draft personalized email templates for top 5 personas","category":"practice"},{"action":"Record practice demos and self-review before client delivery","category":"practice"}]'::jsonb,
  '[{"title":"Never Split the Difference by Chris Voss","type":"book","url":""},{"title":"Call recording review sessions","type":"coaching","url":""},{"title":"Email copywriting for sales guide","type":"guide","url":""}]'::jsonb,
  '[{"criterion":"Talk-to-listen ratio consistently at 40/60 or better"},{"criterion":"Email reply rates improved 20% vs. baseline"},{"criterion":"Delivered 3+ demos with 9+ prospect satisfaction score"},{"criterion":"Manager assessment shows marked improvement in active listening"}]'::jsonb,
  true
),
(
  'New Hire Ramp Plan',
  'Structured 90-day onboarding and ramp plan for new sales hires',
  'rocket',
  'onboarding',
  'quarterly',
  90,
  '[{"goal":"Achieve full ramp quota attainment by Day 90","timeframe":"3 months"},{"goal":"Build a healthy pipeline from scratch","timeframe":"2 months"},{"goal":"Master product knowledge and sales process","timeframe":"1 month"}]'::jsonb,
  '[{"area":"Product Knowledge","current_level":"none","target_level":"proficient"},{"area":"Sales Process","current_level":"none","target_level":"intermediate"},{"area":"Prospecting","current_level":"beginner","target_level":"intermediate"},{"area":"CRM Usage","current_level":"none","target_level":"proficient"}]'::jsonb,
  ARRAY['call_connects','meetings','pipeline_created','emails_sent'],
  '[{"title":"Complete product certification","target_date_offset_days":14,"status":"pending"},{"title":"Shadow 10 calls with top performers","target_date_offset_days":21,"status":"pending"},{"title":"Book first 5 meetings independently","target_date_offset_days":30,"status":"pending"},{"title":"Close first deal","target_date_offset_days":60,"status":"pending"},{"title":"Hit 75% of full quota in Month 3","target_date_offset_days":90,"status":"pending"}]'::jsonb,
  '[{"action":"Complete all product training modules in LMS","category":"training"},{"action":"Shadow 10 calls across 3 different top performers","category":"on_the_job"},{"action":"Build target account list of 50 companies","category":"practice"},{"action":"Make 30+ dials per day in first month","category":"habit"},{"action":"Log all activities in CRM same day","category":"habit"}]'::jsonb,
  '[{"title":"Product training modules (internal LMS)","type":"course","url":""},{"title":"Sales playbook and battle cards","type":"guide","url":""},{"title":"Buddy system — assigned senior rep","type":"mentoring","url":""},{"title":"Weekly 1:1 with manager","type":"coaching","url":""}]'::jsonb,
  '[{"criterion":"Passed product certification exam with 80%+"},{"criterion":"Completed all 10 call shadows with notes submitted"},{"criterion":"Built pipeline of 3x quota by Day 60"},{"criterion":"Hit 75%+ of full monthly quota in Month 3"},{"criterion":"CRM hygiene score above 90%"}]'::jsonb,
  true
);
