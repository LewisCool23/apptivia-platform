-- ============================================================
-- Migration 127: CRM Bidirectional Sync Infrastructure
-- ============================================================
-- Three new tables for outbound CRM push capability:
--   1. integration_push_queue  — pending outbound actions
--   2. integration_entity_map  — bidirectional ID mapping
--   3. integration_push_log    — audit trail
-- ============================================================

-- ── 1. Push Queue ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_push_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  integration_id  UUID NOT NULL REFERENCES integrations(id),
  entity_type   TEXT NOT NULL,           -- 'contact', 'deal', 'activity', 'meeting', 'note'
  entity_id     UUID,                     -- apptivia internal ID (nullable for creates)
  action        TEXT NOT NULL DEFAULT 'create',  -- 'create', 'update', 'log_activity'
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'skipped'
  retry_count   INTEGER NOT NULL DEFAULT 0,
  max_retries   INTEGER NOT NULL DEFAULT 3,
  external_id   TEXT,                     -- CRM-side ID once created/found
  error_message TEXT,
  triggered_by  TEXT,                     -- 'cron', 'event', 'manual', 'sequence_engine'
  source_event  TEXT,                     -- e.g. 'coaching_plan_assigned', 'achievement_earned'
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_queue_status
  ON integration_push_queue(status, scheduled_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_push_queue_org
  ON integration_push_queue(organization_id);

CREATE INDEX IF NOT EXISTS idx_push_queue_integration
  ON integration_push_queue(integration_id);

-- ── 2. Entity Map (bidirectional ID mapping) ─────────────────
CREATE TABLE IF NOT EXISTS integration_entity_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  integration_id  UUID NOT NULL REFERENCES integrations(id),
  apptivia_entity TEXT NOT NULL,          -- 'profile', 'deal', 'account', 'meeting'
  apptivia_id     UUID NOT NULL,
  external_entity TEXT NOT NULL,          -- 'Contact', 'Lead', 'Deal', 'Opportunity'
  external_id     TEXT NOT NULL,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(integration_id, apptivia_entity, apptivia_id),
  UNIQUE(integration_id, external_entity, external_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_map_lookup
  ON integration_entity_map(integration_id, apptivia_entity, apptivia_id);

CREATE INDEX IF NOT EXISTS idx_entity_map_reverse
  ON integration_entity_map(integration_id, external_entity, external_id);

-- ── 3. Push Log (audit trail) ────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_push_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  integration_id  UUID NOT NULL REFERENCES integrations(id),
  queue_item_id   UUID REFERENCES integration_push_queue(id),
  entity_type     TEXT NOT NULL,
  action          TEXT NOT NULL,
  status          TEXT NOT NULL,          -- 'sent', 'failed', 'skipped'
  external_id     TEXT,
  request_payload JSONB,
  response_payload JSONB,
  error_message   TEXT,
  duration_ms     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_org
  ON integration_push_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_log_integration
  ON integration_push_log(integration_id, created_at DESC);

-- ── 4. RLS Policies ──────────────────────────────────────────
ALTER TABLE integration_push_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_push_log   ENABLE ROW LEVEL SECURITY;

-- Org isolation
CREATE POLICY "Org isolation: push_queue"
  ON integration_push_queue FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: entity_map"
  ON integration_entity_map FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

CREATE POLICY "Org isolation: push_log"
  ON integration_push_log FOR ALL
  USING (organization_id = auth_user_org_id())
  WITH CHECK (organization_id = auth_user_org_id());

-- Service role bypass (cron + backend)
CREATE POLICY "Service role: push_queue"
  ON integration_push_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role: entity_map"
  ON integration_entity_map FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role: push_log"
  ON integration_push_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
