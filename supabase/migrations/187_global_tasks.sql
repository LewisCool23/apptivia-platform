-- Migration 187: Global tasks table (decoupled from deal-only tasks)
-- Tasks can be linked to any entity: deal, prospect, account, or sequence

CREATE TABLE IF NOT EXISTS engage_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- Optional entity links
  deal_id UUID REFERENCES engage_pipeline_deals(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES engage_prospects(id) ON DELETE SET NULL,
  account_id UUID REFERENCES engage_accounts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES engage_sequences(id) ON DELETE SET NULL,

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engage_tasks_org ON engage_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_engage_tasks_assigned ON engage_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_engage_tasks_due ON engage_tasks(due_date) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_engage_tasks_deal ON engage_tasks(deal_id) WHERE deal_id IS NOT NULL;

-- RLS
ALTER TABLE engage_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "engage_tasks_org_read" ON engage_tasks
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "engage_tasks_org_insert" ON engage_tasks
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "engage_tasks_org_update" ON engage_tasks
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "engage_tasks_org_delete" ON engage_tasks
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- Migrate existing deal tasks into the new table (if engage_deal_tasks exists)
INSERT INTO engage_tasks (organization_id, created_by, assigned_to, title, description, due_date, priority, status, deal_id, completed_at, created_at, updated_at)
SELECT organization_id, created_by, assigned_to, title, description, due_date, priority, status, deal_id, completed_at, created_at, updated_at
FROM engage_deal_tasks
ON CONFLICT DO NOTHING;
