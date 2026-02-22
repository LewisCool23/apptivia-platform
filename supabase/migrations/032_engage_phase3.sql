-- ========================================================================
-- Migration 032: Engage Phase 3 — Sequences/Cadences, Account-Based
--                                  Intelligence, AI Playbook Builder
-- ========================================================================

-- ── 1. Sequences (multi-step outreach cadences) ──────────────────────

CREATE TABLE IF NOT EXISTS engage_sequences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_by      UUID REFERENCES profiles(id),

  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Schedule config
  default_channel TEXT DEFAULT 'email',     -- 'email', 'linkedin', 'call', 'mixed'
  send_window_start TIME DEFAULT '09:00',   -- earliest send time
  send_window_end   TIME DEFAULT '17:00',   -- latest send time
  send_timezone     TEXT DEFAULT 'America/New_York',
  skip_weekends     BOOLEAN DEFAULT true,

  -- Metrics (denormalised for fast reads)
  total_steps       INTEGER DEFAULT 0,
  total_enrolled    INTEGER DEFAULT 0,
  total_completed   INTEGER DEFAULT 0,
  total_replied     INTEGER DEFAULT 0,

  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sequences_org ON engage_sequences(organization_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON engage_sequences(organization_id, status);

ALTER TABLE engage_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org sequences" ON engage_sequences
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org sequences" ON engage_sequences
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update org sequences" ON engage_sequences
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete org sequences" ON engage_sequences
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── 2. Sequence Steps ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS engage_sequence_steps (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     UUID NOT NULL REFERENCES engage_sequences(id) ON DELETE CASCADE,

  step_number     INTEGER NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'linkedin', 'call', 'task')),
  delay_days      INTEGER DEFAULT 1,       -- days to wait after previous step (0 = same day)

  -- Content (can be AI-generated or manual)
  subject         TEXT,                    -- email subject
  body            TEXT,                    -- message body or call script
  ai_generated    BOOLEAN DEFAULT false,
  ai_prompt       TEXT,                    -- prompt used if AI-generated
  tone            TEXT DEFAULT 'professional',

  -- Conditions
  send_if         TEXT DEFAULT 'no_reply', -- 'always', 'no_reply', 'no_open', 'custom'
  skip_if_replied BOOLEAN DEFAULT true,

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seq_steps_sequence ON engage_sequence_steps(sequence_id, step_number);

ALTER TABLE engage_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage steps via sequence" ON engage_sequence_steps
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM engage_sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );


-- ── 3. Sequence Enrollments (prospects in a sequence) ────────────────

CREATE TABLE IF NOT EXISTS engage_sequence_enrollments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     UUID NOT NULL REFERENCES engage_sequences(id) ON DELETE CASCADE,
  prospect_id     UUID,            -- references engage_prospects(id) if table exists
  enrolled_by     UUID REFERENCES profiles(id),

  -- Progress
  current_step    INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed', 'removed')),
  enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
  last_step_at    TIMESTAMPTZ,
  next_step_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,

  -- Prospect snapshot (denormalised)
  prospect_name   TEXT,
  prospect_email  TEXT,
  prospect_company TEXT,

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON engage_sequence_enrollments(sequence_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_prospect ON engage_sequence_enrollments(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next ON engage_sequence_enrollments(next_step_at) WHERE status = 'active';

ALTER TABLE engage_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage enrollments via sequence" ON engage_sequence_enrollments
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM engage_sequences WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );


-- ── 4. Sequence Step Executions (log of each sent step) ──────────────

CREATE TABLE IF NOT EXISTS engage_sequence_executions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id   UUID NOT NULL REFERENCES engage_sequence_enrollments(id) ON DELETE CASCADE,
  step_id         UUID NOT NULL REFERENCES engage_sequence_steps(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,

  channel         TEXT NOT NULL,
  subject         TEXT,
  body            TEXT,

  -- Outcome
  status          TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_enrollment ON engage_sequence_executions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_executions_step ON engage_sequence_executions(step_id);

ALTER TABLE engage_sequence_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions via enrollment" ON engage_sequence_executions
  FOR ALL USING (
    enrollment_id IN (
      SELECT id FROM engage_sequence_enrollments WHERE sequence_id IN (
        SELECT id FROM engage_sequences WHERE organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );


-- ── 5. Account Intelligence (account-level scoring & mapping) ─────────

CREATE TABLE IF NOT EXISTS engage_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  company_id      UUID,            -- references engage_companies(id) if table exists

  -- Identity (denormalised from engage_companies)
  account_name    TEXT NOT NULL,
  domain          TEXT,
  industry        TEXT,
  employee_count  INTEGER,
  annual_revenue  TEXT,

  -- Scoring
  account_score   INTEGER DEFAULT 0 CHECK (account_score >= 0 AND account_score <= 100),
  intent_score    INTEGER DEFAULT 0 CHECK (intent_score >= 0 AND intent_score <= 100),
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  tier            TEXT DEFAULT 'untiered' CHECK (tier IN ('tier_1', 'tier_2', 'tier_3', 'untiered')),

  -- Buying committee mapping
  buying_committee JSONB DEFAULT '[]',  -- [{ role, name, prospect_id, title, influence_level }]
  decision_maker_id UUID,          -- references engage_prospects(id) if table exists
  champion_id       UUID,            -- references engage_prospects(id) if table exists

  -- Territory
  territory       TEXT,
  assigned_to     UUID REFERENCES profiles(id),

  -- Engagement
  signals_count   INTEGER DEFAULT 0,
  last_signal_at  TIMESTAMPTZ,
  outreach_count  INTEGER DEFAULT 0,
  last_outreach_at TIMESTAMPTZ,

  -- AI insights
  ai_summary      TEXT,
  ai_strategy     TEXT,                 -- recommended engagement strategy
  ai_risk_factors TEXT[],

  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'nurture', 'engaged', 'opportunity', 'customer', 'churned')),
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON engage_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tier ON engage_accounts(organization_id, tier);
CREATE INDEX IF NOT EXISTS idx_accounts_score ON engage_accounts(account_score DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_assigned ON engage_accounts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON engage_accounts(organization_id, domain);

ALTER TABLE engage_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org accounts" ON engage_accounts
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org accounts" ON engage_accounts
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update org accounts" ON engage_accounts
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete org accounts" ON engage_accounts
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── 6. AI Playbooks ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS engage_playbooks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_by      UUID REFERENCES profiles(id),

  name            TEXT NOT NULL,
  description     TEXT,
  playbook_type   TEXT DEFAULT 'signal' CHECK (playbook_type IN ('signal', 'pipeline', 'account', 'custom')),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  -- Trigger conditions (when to fire this playbook)
  trigger_config  JSONB DEFAULT '{}',  -- { signal_types, min_score, pipeline_stage, account_tier, ... }

  -- Steps / actions
  steps           JSONB DEFAULT '[]',  -- [{ step_number, action_type, description, template, channel, delay }]

  -- AI generation metadata
  ai_generated    BOOLEAN DEFAULT false,
  ai_source_data  JSONB DEFAULT '{}',  -- data used to generate (signals, pipeline snapshot, etc.)
  ai_model        TEXT,
  ai_tokens_used  INTEGER DEFAULT 0,

  -- Metrics
  times_used      INTEGER DEFAULT 0,
  success_rate    NUMERIC(5,2),         -- % of times the play led to a positive outcome

  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbooks_org ON engage_playbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_type ON engage_playbooks(organization_id, playbook_type);
CREATE INDEX IF NOT EXISTS idx_playbooks_status ON engage_playbooks(organization_id, status);

ALTER TABLE engage_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org playbooks" ON engage_playbooks
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org playbooks" ON engage_playbooks
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update org playbooks" ON engage_playbooks
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete org playbooks" ON engage_playbooks
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ── 7. Playbook Executions (tracking when a playbook is used) ────────

CREATE TABLE IF NOT EXISTS engage_playbook_executions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id     UUID NOT NULL REFERENCES engage_playbooks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  executed_by     UUID REFERENCES profiles(id),

  -- Context
  account_id      UUID REFERENCES engage_accounts(id),
  prospect_id     UUID,            -- references engage_prospects(id) if table exists
  deal_id         UUID,            -- references engage_pipeline_deals(id) if table exists
  signal_id       UUID,            -- references engage_intent_signals(id) if table exists

  -- Progress
  current_step    INTEGER DEFAULT 1,
  status          TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  outcome         TEXT,                  -- 'meeting_booked', 'deal_created', 'no_response', etc.
  outcome_notes   TEXT,

  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playbook_exec_playbook ON engage_playbook_executions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_exec_org ON engage_playbook_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_playbook_exec_account ON engage_playbook_executions(account_id);

ALTER TABLE engage_playbook_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage playbook executions" ON engage_playbook_executions
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
