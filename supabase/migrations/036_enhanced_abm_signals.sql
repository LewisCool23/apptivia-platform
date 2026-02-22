-- Migration 036: Enhanced ABM with AI-Powered Buyer Signals
-- Implements: Technographics, Buying Stage, Composite Readiness Score,
-- Signal Pattern Detection, Campaign Triggers, and Outcome Tracking

-- ============================================================
-- 1. TECHNOGRAPHICS TABLE — Technology stack tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_technographics (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  account_id      UUID REFERENCES engage_accounts(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  
  -- Technology details
  tech_name       TEXT NOT NULL,        -- e.g., "Salesforce", "HubSpot", "AWS"
  tech_category   TEXT NOT NULL,        -- e.g., "CRM", "Marketing Automation", "Cloud Infrastructure"
  vendor          TEXT,                 -- e.g., "Salesforce.com", "HubSpot Inc."
  
  -- Detection confidence
  confidence      TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high', 'verified')),
  source          TEXT,                 -- 'builtwith', 'wappalyzer', 'manual', 'job_posting', 'g2_review'
  source_url      TEXT,
  
  -- Spend & adoption signals
  adoption_stage  TEXT DEFAULT 'current' CHECK (adoption_stage IN ('evaluating', 'implementing', 'current', 'expanding', 'churning')),
  spend_trend     TEXT DEFAULT 'stable' CHECK (spend_trend IN ('increasing', 'stable', 'decreasing', 'unknown')),
  estimated_spend TEXT,                 -- e.g., "$10K-$50K/year"
  
  -- Timing
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technographics_org ON engage_technographics(organization_id);
CREATE INDEX IF NOT EXISTS idx_technographics_account ON engage_technographics(account_id);
CREATE INDEX IF NOT EXISTS idx_technographics_tech ON engage_technographics(tech_name);
CREATE INDEX IF NOT EXISTS idx_technographics_category ON engage_technographics(tech_category);

ALTER TABLE engage_technographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org technographics" ON engage_technographics
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org technographics" ON engage_technographics
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update org technographics" ON engage_technographics
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete org technographics" ON engage_technographics
  FOR DELETE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================
-- 2. ENHANCED ACCOUNTS — Add new ABM fields
-- ============================================================
ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS buying_stage TEXT DEFAULT 'unaware' 
  CHECK (buying_stage IN ('unaware', 'awareness', 'consideration', 'decision', 'purchase'));

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS readiness_score INTEGER DEFAULT 0 
  CHECK (readiness_score >= 0 AND readiness_score <= 100);

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS signal_velocity INTEGER DEFAULT 0;  -- signals per week

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS tech_fit_score INTEGER DEFAULT 0 
  CHECK (tech_fit_score >= 0 AND tech_fit_score <= 100);

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS spend_trajectory TEXT DEFAULT 'unknown'
  CHECK (spend_trajectory IN ('increasing', 'stable', 'decreasing', 'unknown'));

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS last_stage_change_at TIMESTAMPTZ;

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS predicted_close_date DATE;

ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS ai_buying_stage_reason TEXT;


-- ============================================================
-- 3. ENHANCED SIGNALS — Add buying stage and pattern fields
-- ============================================================
ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS buying_stage_indicator TEXT;  -- which stage this signal suggests

ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS pattern_id UUID;  -- links signals in same cluster

ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS is_pattern_trigger BOOLEAN DEFAULT false;  -- true if this signal triggered a pattern

ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('won', 'lost', 'pending', NULL));

ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ;

ALTER TABLE engage_intent_signals ADD COLUMN IF NOT EXISTS contributed_to_deal_id UUID;


-- ============================================================
-- 4. SIGNAL PATTERNS — Detect clusters of related signals
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_signal_patterns (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  account_id      UUID REFERENCES engage_accounts(id) ON DELETE CASCADE,
  
  -- Pattern classification
  pattern_type    TEXT NOT NULL,        -- 'buying_surge', 'competitor_research', 'tech_evaluation', 'budget_cycle', 'churn_risk'
  pattern_label   TEXT NOT NULL,        -- Human-readable label: "Active Competitor Evaluation"
  
  -- Pattern strength
  signal_count    INTEGER DEFAULT 0,
  combined_score  INTEGER DEFAULT 0 CHECK (combined_score >= 0 AND combined_score <= 100),
  confidence      TEXT DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high', 'very_high')),
  
  -- Inferred buying stage
  inferred_stage  TEXT CHECK (inferred_stage IN ('awareness', 'consideration', 'decision', 'purchase')),
  
  -- AI insights
  ai_summary      TEXT,
  ai_recommended_action TEXT,
  ai_urgency      TEXT DEFAULT 'medium' CHECK (ai_urgency IN ('low', 'medium', 'high', 'critical')),
  
  -- Timing
  first_signal_at TIMESTAMPTZ,
  last_signal_at  TIMESTAMPTZ,
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,          -- patterns decay over time
  
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'actioned', 'expired', 'dismissed')),
  actioned_by     UUID REFERENCES profiles(id),
  actioned_at     TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_org ON engage_signal_patterns(organization_id);
CREATE INDEX IF NOT EXISTS idx_patterns_account ON engage_signal_patterns(account_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON engage_signal_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON engage_signal_patterns(status);
CREATE INDEX IF NOT EXISTS idx_patterns_score ON engage_signal_patterns(combined_score DESC);

ALTER TABLE engage_signal_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org patterns" ON engage_signal_patterns
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org patterns" ON engage_signal_patterns
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update org patterns" ON engage_signal_patterns
  FOR UPDATE USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================
-- 5. CAMPAIGN TRIGGERS — Automated actions based on signals
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_campaign_triggers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_by      UUID REFERENCES profiles(id),
  
  -- Trigger definition
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  
  -- Conditions (JSONB for flexibility)
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  -- Example: { "readiness_score_gte": 75, "buying_stage": ["consideration", "decision"], "signal_types": ["funding", "leadership_change"] }
  
  -- Action to take
  action_type     TEXT NOT NULL CHECK (action_type IN ('add_to_sequence', 'notify_slack', 'create_task', 'assign_owner', 'update_tier', 'add_tag')),
  action_config   JSONB NOT NULL DEFAULT '{}',
  -- Example for add_to_sequence: { "sequence_id": "uuid", "step": 1 }
  -- Example for notify_slack: { "channel": "#sales-alerts", "message_template": "..." }
  
  -- Stats
  times_triggered INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_org ON engage_campaign_triggers(organization_id);
CREATE INDEX IF NOT EXISTS idx_triggers_active ON engage_campaign_triggers(organization_id, is_active);

ALTER TABLE engage_campaign_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org triggers" ON engage_campaign_triggers
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can manage org triggers" ON engage_campaign_triggers
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================
-- 6. TRIGGER EXECUTIONS — Log of trigger firings
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_trigger_executions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  trigger_id      UUID NOT NULL REFERENCES engage_campaign_triggers(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES engage_accounts(id) ON DELETE SET NULL,
  signal_id       UUID,
  pattern_id      UUID,
  
  -- Execution details
  executed_at     TIMESTAMPTZ DEFAULT NOW(),
  action_type     TEXT NOT NULL,
  action_result   JSONB DEFAULT '{}',  -- { "success": true, "details": "..." }
  
  -- For outcome tracking
  deal_created    BOOLEAN DEFAULT false,
  deal_id         UUID,
  deal_value      NUMERIC,
  deal_outcome    TEXT CHECK (deal_outcome IN ('won', 'lost', 'open', NULL))
);

CREATE INDEX IF NOT EXISTS idx_trigger_exec_org ON engage_trigger_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_trigger_exec_trigger ON engage_trigger_executions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_trigger_exec_account ON engage_trigger_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_trigger_exec_time ON engage_trigger_executions(executed_at DESC);

ALTER TABLE engage_trigger_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org trigger executions" ON engage_trigger_executions
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org trigger executions" ON engage_trigger_executions
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================
-- 7. OUTCOME TRACKING — Learn which signals lead to wins
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_signal_outcomes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  
  -- Link to original signal/pattern
  signal_id       UUID REFERENCES engage_intent_signals(id) ON DELETE SET NULL,
  pattern_id      UUID REFERENCES engage_signal_patterns(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES engage_accounts(id) ON DELETE SET NULL,
  
  -- Deal outcome
  deal_id         UUID,
  deal_value      NUMERIC,
  deal_outcome    TEXT NOT NULL CHECK (deal_outcome IN ('won', 'lost')),
  days_to_close   INTEGER,
  
  -- What contributed
  signal_type     TEXT,
  pattern_type    TEXT,
  buying_stage_at_signal TEXT,
  readiness_score_at_signal INTEGER,
  
  -- Timing
  signal_detected_at TIMESTAMPTZ,
  deal_closed_at    TIMESTAMPTZ,
  recorded_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_org ON engage_signal_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_signal_type ON engage_signal_outcomes(signal_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_pattern_type ON engage_signal_outcomes(pattern_type);
CREATE INDEX IF NOT EXISTS idx_outcomes_outcome ON engage_signal_outcomes(deal_outcome);

ALTER TABLE engage_signal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org outcomes" ON engage_signal_outcomes
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert org outcomes" ON engage_signal_outcomes
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================
-- 8. MICRO-SEGMENTS — Dynamic segments based on shared behavior
-- ============================================================
CREATE TABLE IF NOT EXISTS engage_micro_segments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  created_by      UUID REFERENCES profiles(id),
  
  name            TEXT NOT NULL,
  description     TEXT,
  
  -- Segment criteria (JSONB for flexibility)
  criteria        JSONB NOT NULL DEFAULT '{}',
  -- Example: { "buying_stage": ["consideration"], "signal_types": ["competitor_engagement"], "tech_stack_includes": ["Salesforce"] }
  
  -- Dynamic membership
  is_dynamic      BOOLEAN DEFAULT true,  -- auto-updates membership
  account_count   INTEGER DEFAULT 0,
  
  -- Stats
  avg_readiness_score INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_org ON engage_micro_segments(organization_id);

ALTER TABLE engage_micro_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org segments" ON engage_micro_segments
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can manage org segments" ON engage_micro_segments
  FOR ALL USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- Segment membership junction
CREATE TABLE IF NOT EXISTS engage_segment_members (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  segment_id      UUID NOT NULL REFERENCES engage_micro_segments(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES engage_accounts(id) ON DELETE CASCADE,
  added_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segment_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON engage_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_account ON engage_segment_members(account_id);


-- ============================================================
-- 9. HELPER FUNCTIONS
-- ============================================================

-- Function to calculate composite readiness score
CREATE OR REPLACE FUNCTION calculate_readiness_score(
  p_account_score INTEGER,
  p_intent_score INTEGER,
  p_engagement_score INTEGER,
  p_tech_fit_score INTEGER,
  p_signal_velocity INTEGER
) RETURNS INTEGER AS $$
BEGIN
  -- Weighted composite: Intent (35%) + Account Fit (25%) + Engagement (20%) + Tech Fit (15%) + Velocity Bonus (5%)
  RETURN LEAST(100, GREATEST(0,
    (COALESCE(p_intent_score, 0) * 0.35 +
     COALESCE(p_account_score, 0) * 0.25 +
     COALESCE(p_engagement_score, 0) * 0.20 +
     COALESCE(p_tech_fit_score, 0) * 0.15 +
     LEAST(COALESCE(p_signal_velocity, 0) * 5, 5))::INTEGER
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Function to infer buying stage from signals
CREATE OR REPLACE FUNCTION infer_buying_stage(
  p_signal_types TEXT[],
  p_avg_signal_score INTEGER,
  p_signal_count INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_decision_signals INTEGER := 0;
  v_consideration_signals INTEGER := 0;
  v_awareness_signals INTEGER := 0;
BEGIN
  -- Count signal types by stage
  SELECT 
    COUNT(*) FILTER (WHERE x IN ('contract_win', 'leadership_change', 'expansion')),
    COUNT(*) FILTER (WHERE x IN ('competitor_engagement', 'product_launch', 'review_sentiment', 'tech_adoption')),
    COUNT(*) FILTER (WHERE x IN ('content_engagement', 'event_participation', 'press_release', 'hiring', 'funding'))
  INTO v_decision_signals, v_consideration_signals, v_awareness_signals
  FROM unnest(p_signal_types) AS x;
  
  -- Decision stage: high score + decision signals
  IF v_decision_signals >= 2 AND p_avg_signal_score >= 70 THEN
    RETURN 'decision';
  END IF;
  
  -- Consideration stage: medium-high score + comparison signals
  IF v_consideration_signals >= 2 AND p_avg_signal_score >= 50 THEN
    RETURN 'consideration';
  END IF;
  
  -- Awareness stage: early signals
  IF p_signal_count >= 1 THEN
    RETURN 'awareness';
  END IF;
  
  RETURN 'unaware';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

