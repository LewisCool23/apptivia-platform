-- ========================================================================
-- Migration 044: Activity Feed / Timeline
-- Unified activity stream aggregating deal moves, calls, signals, badges
-- ========================================================================

CREATE TABLE IF NOT EXISTS engage_activity_events (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID NOT NULL,
  actor_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- who did it

  -- Event classification
  event_type       TEXT NOT NULL,  -- See constants below
  -- Core event types:
  --   'deal.created'          'deal.stage_changed'      'deal.closed_won'
  --   'deal.closed_lost'      'call.logged'             'call.analyzed'
  --   'badge.earned'          'signal.detected'         'outreach.email_replied'
  --   'outreach.meeting_booked' 'coaching_plan.created' 'general'

  -- Related entities (optional)
  deal_id          UUID REFERENCES engage_pipeline_deals(id)  ON DELETE SET NULL,
  call_log_id      UUID REFERENCES engage_call_logs(id)       ON DELETE SET NULL,

  -- Display
  title            TEXT NOT NULL,
  description      TEXT,
  icon             TEXT,             -- emoji or icon key
  color            TEXT DEFAULT '#6366f1',  -- hex for feed dot

  -- Source
  source           TEXT DEFAULT 'manual',  -- 'manual', 'outreach', 'system'
  metadata         JSONB DEFAULT '{}',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_org      ON engage_activity_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor    ON engage_activity_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_deal     ON engage_activity_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_type     ON engage_activity_events(organization_id, event_type, created_at DESC);

ALTER TABLE engage_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org activity" ON engage_activity_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activity" ON engage_activity_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── Auto-log deal changes ─────────────────────────────────────────────────
-- Trigger that writes an activity event whenever a deal's stage changes

CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO engage_activity_events (
      organization_id, actor_id, event_type,
      deal_id, title, description, icon, color, source
    ) VALUES (
      NEW.organization_id,
      NEW.owner_id,
      CASE
        WHEN NEW.stage = 'closed_won'  THEN 'deal.closed_won'
        WHEN NEW.stage = 'closed_lost' THEN 'deal.closed_lost'
        ELSE 'deal.stage_changed'
      END,
      NEW.id,
      CASE
        WHEN NEW.stage = 'closed_won'  THEN 'Deal Closed Won 🏆'
        WHEN NEW.stage = 'closed_lost' THEN 'Deal Closed Lost'
        ELSE 'Deal Stage Changed'
      END,
      '"' || NEW.deal_name || '" moved from ' || COALESCE(OLD.stage, '?') || ' → ' || NEW.stage,
      CASE
        WHEN NEW.stage = 'closed_won'  THEN '🏆'
        WHEN NEW.stage = 'closed_lost' THEN '❌'
        ELSE '🔄'
      END,
      CASE
        WHEN NEW.stage = 'closed_won'  THEN '#10b981'
        WHEN NEW.stage = 'closed_lost' THEN '#ef4444'
        ELSE '#6366f1'
      END,
      'system'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deal_stage_change ON engage_pipeline_deals;
CREATE TRIGGER trg_deal_stage_change
  AFTER UPDATE OF stage ON engage_pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION log_deal_stage_change();

-- ── Auto-log call logs ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_call_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO engage_activity_events (
    organization_id, actor_id, event_type,
    call_log_id, title, description, icon, color, source
  ) VALUES (
    NEW.organization_id,
    NEW.user_id,
    CASE WHEN NEW.ai_analysis IS NOT NULL THEN 'call.analyzed' ELSE 'call.logged' END,
    NEW.id,
    CASE WHEN NEW.ai_analysis IS NOT NULL THEN 'Call Logged & Analyzed' ELSE 'Call Logged' END,
    COALESCE(
      CASE WHEN NEW.contact_name IS NOT NULL THEN 'Call with ' || NEW.contact_name ELSE NULL END,
      'Call logged'
    )
    || CASE WHEN NEW.duration_minutes IS NOT NULL THEN ' (' || NEW.duration_minutes || ' min)' ELSE '' END,
    '📞',
    '#8b5cf6',
    'manual'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_call_log_created ON engage_call_logs;
CREATE TRIGGER trg_call_log_created
  AFTER INSERT ON engage_call_logs
  FOR EACH ROW EXECUTE FUNCTION log_call_created();
