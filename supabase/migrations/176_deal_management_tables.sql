-- Migration 176: Deal management tables — tasks and activity log
-- Supports the new Active Deal Modal with task management and deal audit trail

-- ── Deal Tasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engage_deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES engage_pipeline_deals(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal ON engage_deal_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_org ON engage_deal_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_assigned ON engage_deal_tasks(assigned_to) WHERE assigned_to IS NOT NULL;

ALTER TABLE engage_deal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_tasks_org_read ON engage_deal_tasks FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY deal_tasks_org_insert ON engage_deal_tasks FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY deal_tasks_org_update ON engage_deal_tasks FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY deal_tasks_org_delete ON engage_deal_tasks FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- Auto-update updated_at
CREATE TRIGGER trg_deal_tasks_updated_at
  BEFORE UPDATE ON engage_deal_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Deal Activity Log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engage_deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES engage_pipeline_deals(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN engage_deal_activities.activity_type IS
  'One of: stage_changed, field_updated, call_logged, task_created, task_completed, meeting_attached, contact_linked, account_linked, note_added, created';

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON engage_deal_activities(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_activities_org ON engage_deal_activities(organization_id);

ALTER TABLE engage_deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_activities_org_read ON engage_deal_activities FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY deal_activities_org_insert ON engage_deal_activities FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
