-- 079: Feedback Signals — lightweight helpfulness ratings for AI suggestions
-- and coaching content. Enables continuous improvement loop.

CREATE TABLE feedback_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  feature_area text NOT NULL,
  content_key text,
  helpful boolean NOT NULL,
  context jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedback_signals_org ON feedback_signals(organization_id);
CREATE INDEX idx_feedback_signals_area ON feedback_signals(feature_area);

ALTER TABLE feedback_signals ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON feedback_signals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own feedback (for dedup on page reload)
CREATE POLICY "Users can read own feedback"
  ON feedback_signals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all feedback for their org
CREATE POLICY "Admins can view org feedback"
  ON feedback_signals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
