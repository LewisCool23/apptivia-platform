-- Migration 107: Allow managers to manage scheduled reports (not just admins)
-- The API endpoint already requires 'manager' role minimum, but RLS only allowed admins.

DROP POLICY IF EXISTS "Admins can manage scheduled reports" ON scheduled_reports;

CREATE POLICY "Managers and admins can manage scheduled reports"
  ON scheduled_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND organization_id = scheduled_reports.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
      AND organization_id = scheduled_reports.organization_id
    )
  );
