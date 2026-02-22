-- ========================================================================
-- Migration 042: Webhook Ingest — Outreach.io Activity Events
-- ========================================================================

-- Add source tracking and dedup key to kpi_values
ALTER TABLE kpi_values
  ADD COLUMN IF NOT EXISTS source            TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_event_id TEXT;

-- Unique index ensures each Outreach event is only counted once
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_values_ext_event
  ON kpi_values(external_event_id)
  WHERE external_event_id IS NOT NULL;

-- Audit log for all inbound webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source           TEXT NOT NULL,               -- 'outreach', 'salesloft', etc.
  event_type       TEXT NOT NULL,               -- raw event name
  external_id      TEXT,                        -- source event ID
  organization_id  UUID,
  profile_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  processed        BOOLEAN NOT NULL DEFAULT false,
  kpis_updated     TEXT[] DEFAULT '{}',
  error            TEXT,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org    ON webhook_events(organization_id, received_at DESC);

-- No RLS needed — webhook events are written by the backend service account
