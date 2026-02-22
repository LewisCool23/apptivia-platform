-- ========================================================================
-- Migration 031: Engage Phase 1 — Pipeline Operator, Signal Prospecting,
--                                  KPI Anomaly Watchdog
-- ========================================================================

-- ── 1. Pipeline Deals (for Pipeline Operator workflow) ─────────────────

CREATE TABLE IF NOT EXISTS engage_pipeline_deals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  owner_id      UUID REFERENCES profiles(id),

  -- Core deal fields
  deal_name     TEXT NOT NULL,
  deal_value    NUMERIC(12,2) DEFAULT 0,
  stage         TEXT NOT NULL DEFAULT 'discovery',
  probability   INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  close_date    DATE,

  -- Activity tracking
  last_activity_at  TIMESTAMPTZ,
  last_activity_type TEXT,     -- e.g. 'email', 'call', 'meeting', 'note'
  -- days_inactive is computed at query time via view/hook (NOW() is not immutable)

  -- Source & sync
  source        TEXT DEFAULT 'manual',  -- 'hubspot', 'salesforce', 'manual'
  external_id   TEXT,                   -- CRM record ID
  crm_url       TEXT,

  -- Forecast
  forecast_category TEXT DEFAULT 'pipeline',  -- 'commit', 'best_case', 'pipeline', 'omitted'
  ai_forecast_note  TEXT,                     -- AI-generated forecast commentary

  -- Metadata
  tags          TEXT[] DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org ON engage_pipeline_deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_owner ON engage_pipeline_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage ON engage_pipeline_deals(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_close ON engage_pipeline_deals(organization_id, close_date);

-- RLS
ALTER TABLE engage_pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org deals" ON engage_pipeline_deals
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org deals" ON engage_pipeline_deals
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update org deals" ON engage_pipeline_deals
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ── 2. Intent Signals (for Signal-Based Prospecting) ──────────────────

CREATE TABLE IF NOT EXISTS engage_intent_signals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,

  -- Who/what the signal is about (no FK — prospect/company tables may not exist yet)
  prospect_id     UUID,
  company_id      UUID,
  company_name    TEXT,
  prospect_name   TEXT,

  -- Signal classification
  signal_type     TEXT NOT NULL,  -- 'competitor_engagement', 'job_change', 'funding', 'hiring', 'content_engagement', 'tech_adoption'
  signal_strength TEXT DEFAULT 'medium' CHECK (signal_strength IN ('low', 'medium', 'high', 'very_high')),
  signal_score    INTEGER DEFAULT 50 CHECK (signal_score >= 0 AND signal_score <= 100),

  -- Signal details
  title           TEXT NOT NULL,
  description     TEXT,
  source_url      TEXT,
  source_platform TEXT,   -- 'linkedin', 'crunchbase', 'web', 'twitter', 'job_board', etc.
  detected_at     TIMESTAMPTZ DEFAULT NOW(),

  -- AI enrichment
  ai_summary      TEXT,
  ai_recommended_action TEXT,
  ai_outreach_angle TEXT,

  -- Status
  status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
  actioned_by     UUID REFERENCES profiles(id),
  actioned_at     TIMESTAMPTZ,

  -- Metadata
  raw_data        JSONB DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_signals_org ON engage_intent_signals(organization_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_type ON engage_intent_signals(organization_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_intent_signals_status ON engage_intent_signals(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_intent_signals_score ON engage_intent_signals(signal_score DESC);
CREATE INDEX IF NOT EXISTS idx_intent_signals_prospect ON engage_intent_signals(prospect_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_company ON engage_intent_signals(company_id);

ALTER TABLE engage_intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org signals" ON engage_intent_signals
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org signals" ON engage_intent_signals
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update org signals" ON engage_intent_signals
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ── 3. KPI Anomalies (for KPI Anomaly Watchdog) ──────────────────────

CREATE TABLE IF NOT EXISTS engage_kpi_anomalies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  profile_id      UUID REFERENCES profiles(id),

  -- KPI reference
  kpi_key         TEXT NOT NULL,
  kpi_name        TEXT NOT NULL,

  -- Anomaly data
  anomaly_type    TEXT NOT NULL DEFAULT 'drop',  -- 'drop', 'spike', 'stagnation', 'streak_break'
  severity        TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

  -- Values
  current_value   NUMERIC(12,2),
  previous_value  NUMERIC(12,2),
  rolling_avg     NUMERIC(12,2),
  deviation_pct   NUMERIC(6,2),        -- e.g. -25.5 means 25.5% below rolling avg

  -- Period
  period_start    DATE,
  period_end      DATE,
  detected_at     TIMESTAMPTZ DEFAULT NOW(),

  -- AI analysis
  ai_analysis     TEXT,                -- AI-generated explanation
  ai_recommendation TEXT,             -- Recommended coaching action
  suggested_coaching_plan_id UUID,     -- Link to auto-suggested coaching plan

  -- Status
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,

  -- Metadata
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_anomalies_org ON engage_kpi_anomalies(organization_id);
CREATE INDEX IF NOT EXISTS idx_kpi_anomalies_profile ON engage_kpi_anomalies(profile_id);
CREATE INDEX IF NOT EXISTS idx_kpi_anomalies_kpi ON engage_kpi_anomalies(kpi_key);
CREATE INDEX IF NOT EXISTS idx_kpi_anomalies_status ON engage_kpi_anomalies(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_kpi_anomalies_severity ON engage_kpi_anomalies(severity);

ALTER TABLE engage_kpi_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org anomalies" ON engage_kpi_anomalies
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org anomalies" ON engage_kpi_anomalies
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update org anomalies" ON engage_kpi_anomalies
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );


-- ── 4. Pipeline Snapshots (daily forecast snapshots) ─────────────────

CREATE TABLE IF NOT EXISTS engage_pipeline_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Aggregated data
  total_pipeline_value  NUMERIC(14,2) DEFAULT 0,
  weighted_value        NUMERIC(14,2) DEFAULT 0,
  deal_count            INTEGER DEFAULT 0,
  at_risk_count         INTEGER DEFAULT 0,
  commit_value          NUMERIC(14,2) DEFAULT 0,
  best_case_value       NUMERIC(14,2) DEFAULT 0,

  -- AI forecast
  ai_forecast_summary   TEXT,
  ai_confidence         TEXT DEFAULT 'medium',

  -- Stage breakdown
  stage_breakdown       JSONB DEFAULT '{}',   -- { "discovery": { count: 2, value: 50000 }, ... }

  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_snapshots_org ON engage_pipeline_snapshots(organization_id, snapshot_date DESC);

ALTER TABLE engage_pipeline_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org snapshots" ON engage_pipeline_snapshots
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org snapshots" ON engage_pipeline_snapshots
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
