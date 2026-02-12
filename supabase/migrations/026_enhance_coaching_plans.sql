-- Migration: Enhance coaching plans system with templates and assignments

-- Update coaching_plans table structure
ALTER TABLE coaching_plans 
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled Plan',
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS goals TEXT[],
  ADD COLUMN IF NOT EXISTS focus_kpis TEXT[],
  ADD COLUMN IF NOT EXISTS action_items TEXT[],
  ADD COLUMN IF NOT EXISTS success_metrics TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID[] DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS date_range_start DATE,
  ADD COLUMN IF NOT EXISTS date_range_end DATE;

-- Rename plan_text to content for consistency
ALTER TABLE coaching_plans 
  RENAME COLUMN plan_text TO content;

-- Create coaching_plan_templates table
CREATE TABLE IF NOT EXISTS coaching_plan_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎯',
  category TEXT NOT NULL, -- 'pipeline', 'activity', 'quality', 'efficiency'
  focus_kpis TEXT[] NOT NULL,
  suggested_goals TEXT[],
  suggested_actions TEXT[],
  duration_days INT DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create coaching_plan_assignments table
CREATE TABLE IF NOT EXISTS coaching_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES coaching_plans(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  progress_notes TEXT,
  completed_at TIMESTAMPTZ,
  UNIQUE(plan_id, assigned_to)
);

-- Enable RLS
ALTER TABLE coaching_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_plan_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates (everyone can read)
CREATE POLICY coaching_plan_templates_read
  ON coaching_plan_templates
  FOR SELECT
  USING (true);

-- RLS policies for assignments
CREATE POLICY coaching_plan_assignments_read
  ON coaching_plan_assignments
  FOR SELECT
  USING (
    auth.uid() = assigned_to 
    OR auth.uid() = assigned_by
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY coaching_plan_assignments_insert
  ON coaching_plan_assignments
  FOR INSERT
  WITH CHECK (
    auth.uid() = assigned_by
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY coaching_plan_assignments_update
  ON coaching_plan_assignments
  FOR UPDATE
  USING (
    auth.uid() = assigned_to 
    OR auth.uid() = assigned_by
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Seed coaching plan templates
INSERT INTO coaching_plan_templates (id, name, description, icon, category, focus_kpis, suggested_goals, suggested_actions, duration_days)
VALUES
  (
    'pipeline-acceleration',
    'Pipeline Acceleration',
    'Boost pipeline creation and velocity',
    '🚀',
    'pipeline',
    ARRAY['pipeline_created', 'sourced_opps', 'stage2_opps', 'qualified_leads'],
    ARRAY['Increase pipeline by 25% this period', 'Source 10+ new opportunities', 'Advance 5+ deals to stage 2'],
    ARRAY['Block 2 hours daily for prospecting', 'Target 20 high-intent accounts', 'Run outbound sequence to top 50 accounts', 'Qualify deals within 48 hours'],
    14
  ),
  (
    'activity-boost',
    'Activity Boost',
    'Increase daily outreach and engagement',
    '⚡',
    'activity',
    ARRAY['call_connects', 'emails_sent', 'meetings', 'social_touches'],
    ARRAY['Make 50+ calls this week', 'Send 100+ emails', 'Book 10+ meetings'],
    ARRAY['Use peak call windows (8-10am, 4-6pm)', 'Personalize first line of all emails', 'Follow 3x3 cadence: 3 touches, 3 channels, 3 days', 'Stack meeting invites with calendar links'],
    7
  ),
  (
    'conversion-master',
    'Conversion Excellence',
    'Improve connect-to-meeting conversion',
    '📈',
    'quality',
    ARRAY['meetings', 'call_connects', 'demos_completed', 'win_rate'],
    ARRAY['Achieve 20%+ connect-to-meeting rate', 'Complete 5+ product demos', 'Close 3+ deals'],
    ARRAY['End every call with a calendar ask', 'Use structured discovery framework', 'Create mutual action plans for all demos', 'Review win/loss weekly'],
    14
  ),
  (
    'talk-time-focus',
    'Talk Time Maximization',
    'Increase customer conversation time',
    '🎤',
    'quality',
    ARRAY['talk_time_minutes', 'meetings', 'demos_completed'],
    ARRAY['Hit 300+ minutes of talk time', 'Average 30+ minutes per call', 'Complete 8+ discovery calls'],
    ARRAY['Stack calls in focused blocks', 'Use open-ended questions', 'Summarize and confirm value', 'Reduce gaps between conversations'],
    7
  ),
  (
    'follow-through-champion',
    'Follow-Through Excellence',
    'Master responsiveness and follow-ups',
    '✅',
    'efficiency',
    ARRAY['response_time', 'follow_ups', 'meetings'],
    ARRAY['Respond within 2 hours', 'Zero missed follow-ups', 'Convert 50%+ of follow-ups to next steps'],
    ARRAY['Set response SLA and track it', 'Use templates for common replies', 'Schedule next steps during calls', 'Batch inbox time twice daily'],
    7
  ),
  (
    'closing-momentum',
    'Closing Momentum',
    'Drive deals to completion',
    '🎯',
    'pipeline',
    ARRAY['win_rate', 'stage2_opps', 'demos_completed', 'pipeline_created'],
    ARRAY['Close 3+ deals', 'Maintain 25%+ win rate', 'Advance 80% of demos'],
    ARRAY['Multi-thread all late-stage deals', 'Run weekly deal reviews', 'Document objections and responses', 'Create champion playbooks'],
    14
  );

-- Update coaching_plans RLS to allow managers to see team plans
DROP POLICY IF EXISTS coaching_plans_owner_access ON coaching_plans;

CREATE POLICY coaching_plans_full_access
  ON coaching_plans
  FOR ALL
  USING (
    auth.uid() = created_by
    OR auth.uid() = ANY(assigned_to)
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );
