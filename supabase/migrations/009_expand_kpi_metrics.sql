-- Migration: Expand KPI metrics with comprehensive sales metrics
-- Adds ability for users to customize their scorecard with various sales KPIs

-- Add is_custom column to track user-created vs system KPIs
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS category text DEFAULT 'activity';
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS show_on_scorecard boolean DEFAULT false;
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS scorecard_position integer;
ALTER TABLE kpi_metrics ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add more comprehensive sales KPI metrics
INSERT INTO kpi_metrics (key, name, description, goal, weight, unit, category, is_custom, show_on_scorecard, scorecard_position)
VALUES
  -- Original 5 Core Metrics (Featured on Scorecard by default)
  ('call_connects', 'Call Connects', 'Number of successful call connections', 100, 0.30, 'count', 'activity', false, true, 1),
  ('talk_time_minutes', 'Talk Time Minutes', 'Total talk time in minutes', 100, 0.30, 'minutes', 'activity', false, true, 2),
  ('meetings', 'Meetings', 'Number of scheduled meetings', 3, 0.10, 'count', 'engagement', false, true, 3),
  ('sourced_opps', 'Sourced Opportunities', 'Number of opportunities sourced', 4, 0.10, 'count', 'pipeline', false, true, 4),
  ('stage2_opps', 'Stage 2 Opportunities', 'Opportunities advanced to Stage 2', 3, 0.20, 'count', 'pipeline', false, true, 5),
  
  -- Additional Outbound Activity Metrics
  ('dials', 'Dials', 'Total number of outbound dials made', 200, 0.15, 'count', 'activity', false, false, null),
  ('emails_sent', 'Emails Sent', 'Total outbound emails sent', 150, 0.10, 'count', 'activity', false, false, null),
  ('social_touches', 'Social Touches', 'LinkedIn messages and interactions', 50, 0.05, 'count', 'activity', false, false, null),
  
  -- Additional Engagement Metrics
  ('conversations', 'Conversations', 'Meaningful conversations with prospects', 80, 0.20, 'count', 'engagement', false, false, null),
  ('demos_completed', 'Demos Completed', 'Product demonstrations delivered', 5, 0.15, 'count', 'engagement', false, false, null),
  ('follow_ups', 'Follow-ups', 'Follow-up activities completed', 30, 0.08, 'count', 'engagement', false, false, null),
  
  -- Additional Pipeline Metrics
  ('pipeline_created', 'Pipeline Created', 'Total pipeline value created', 50000, 0.25, 'currency', 'pipeline', false, false, null),
  ('pipeline_advanced', 'Pipeline Advanced', 'Pipeline value moved to next stage', 30000, 0.20, 'currency', 'pipeline', false, false, null),
  ('qualified_leads', 'Qualified Leads', 'Leads qualified for sales process', 10, 0.15, 'count', 'pipeline', false, false, null),
  ('discovery_calls', 'Discovery Calls', 'Initial discovery calls completed', 8, 0.12, 'count', 'pipeline', false, false, null),
  
  -- Revenue Metrics
  ('closed_won', 'Closed Won Deals', 'Number of deals closed and won', 2, 0.30, 'count', 'revenue', false, false, null),
  ('revenue_generated', 'Revenue Generated', 'Total revenue from closed deals', 100000, 0.40, 'currency', 'revenue', false, false, null),
  ('average_deal_size', 'Average Deal Size', 'Average size of closed deals', 50000, 0.15, 'currency', 'revenue', false, false, null),
  
  -- Efficiency Metrics
  ('response_time', 'Response Time (hrs)', 'Average response time to leads in hours', 2, 0.10, 'hours', 'efficiency', false, false, null),
  ('win_rate', 'Win Rate', 'Percentage of opportunities won', 30, 0.20, 'percentage', 'efficiency', false, false, null),
  ('sales_cycle_days', 'Sales Cycle (days)', 'Average days to close a deal', 30, 0.10, 'days', 'efficiency', false, false, null)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  goal = EXCLUDED.goal,
  weight = EXCLUDED.weight,
  category = EXCLUDED.category,
  show_on_scorecard = EXCLUDED.show_on_scorecard,
  scorecard_position = EXCLUDED.scorecard_position;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for kpi_metrics table
DROP TRIGGER IF EXISTS update_kpi_metrics_updated_at ON kpi_metrics;
CREATE TRIGGER update_kpi_metrics_updated_at
  BEFORE UPDATE ON kpi_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for kpi_metrics (allow authenticated users to read and admins to write)
ALTER TABLE kpi_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read KPI metrics" ON kpi_metrics;
CREATE POLICY "Allow authenticated users to read KPI metrics"
  ON kpi_metrics FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admins to manage KPI metrics" ON kpi_metrics;
CREATE POLICY "Allow admins to manage KPI metrics"
  ON kpi_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create view for active KPIs only
CREATE OR REPLACE VIEW active_kpi_metrics AS
SELECT * FROM kpi_metrics
WHERE is_active = true
ORDER BY category, name;

COMMENT ON TABLE kpi_metrics IS 'Sales KPI metric definitions with customization support';
COMMENT ON COLUMN kpi_metrics.is_custom IS 'True if this KPI was created by a user';
COMMENT ON COLUMN kpi_metrics.is_active IS 'False to soft-delete a KPI without losing historical data';
COMMENT ON COLUMN kpi_metrics.category IS 'Groups KPIs: activity, engagement, pipeline, revenue, efficiency';
