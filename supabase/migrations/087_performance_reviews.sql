-- 087: Performance Reviews (Mid-Year & Annual)
-- Collaborative review workflow with historical data snapshots

CREATE TABLE IF NOT EXISTS performance_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_type       TEXT NOT NULL CHECK (review_type IN ('mid_year','annual')),
  title             TEXT NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  profile_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manager_id        UUID NOT NULL REFERENCES profiles(id),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_self_assessment','self_assessment_submitted',
    'manager_review','finalized','acknowledged','reopened'
  )),

  -- Historical data snapshots (JSONB, populated when review is created/refreshed)
  scorecard_summary       JSONB,   -- weekly scores over period
  kpi_attainment          JSONB,   -- per-KPI actuals vs goals
  skillset_progress       JSONB,   -- mastery levels at snapshot time
  achievements_earned     JSONB,   -- achievements during period
  badges_earned           JSONB,   -- badges during period
  coaching_plans_summary  JSONB,   -- coaching plans assigned/completed
  idps_summary            JSONB,   -- IDPs active/completed during period

  -- Manager sections
  manager_summary             TEXT,
  manager_strengths           JSONB DEFAULT '[]'::jsonb,
  manager_areas_for_improvement JSONB DEFAULT '[]'::jsonb,
  manager_goals_next_period   JSONB DEFAULT '[]'::jsonb,
  manager_rating              INT CHECK (manager_rating BETWEEN 1 AND 5),
  manager_comments            TEXT,

  -- Rep self-assessment sections
  rep_self_assessment    TEXT,
  rep_accomplishments    JSONB DEFAULT '[]'::jsonb,
  rep_challenges         JSONB DEFAULT '[]'::jsonb,
  rep_goals_next_period  JSONB DEFAULT '[]'::jsonb,
  rep_comments           TEXT,

  -- Final
  final_rating           INT CHECK (final_rating BETWEEN 1 AND 5),
  final_summary          TEXT,
  acknowledged_at        TIMESTAMPTZ,
  acknowledgment_comment TEXT,

  -- Workflow timestamps
  sent_for_assessment_at        TIMESTAMPTZ,
  self_assessment_submitted_at  TIMESTAMPTZ,
  manager_review_started_at     TIMESTAMPTZ,
  finalized_at                  TIMESTAMPTZ,
  reopened_at                   TIMESTAMPTZ,

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE (profile_id, review_type, period_start)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_profile ON performance_reviews(profile_id);
CREATE INDEX IF NOT EXISTS idx_reviews_manager ON performance_reviews(manager_id);
CREATE INDEX IF NOT EXISTS idx_reviews_org ON performance_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON performance_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_type ON performance_reviews(review_type);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- Admins see all in org, managers see reviews they manage, reps see their own
CREATE POLICY reviews_select ON performance_reviews FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = performance_reviews.organization_id
    AND (
      p.role = 'admin'
      OR performance_reviews.profile_id = auth.uid()
      OR performance_reviews.manager_id = auth.uid()
    )
  )
);

CREATE POLICY reviews_insert ON performance_reviews FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = performance_reviews.organization_id
    AND p.role IN ('admin','manager')
  )
);

CREATE POLICY reviews_update ON performance_reviews FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = performance_reviews.organization_id
    AND (
      p.role = 'admin'
      OR performance_reviews.manager_id = auth.uid()
      OR (performance_reviews.profile_id = auth.uid() AND performance_reviews.status IN ('pending_self_assessment','finalized'))
    )
  )
);

CREATE POLICY reviews_delete ON performance_reviews FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.organization_id = performance_reviews.organization_id
    AND (p.role = 'admin' OR (performance_reviews.manager_id = auth.uid() AND performance_reviews.status = 'draft'))
  )
);
