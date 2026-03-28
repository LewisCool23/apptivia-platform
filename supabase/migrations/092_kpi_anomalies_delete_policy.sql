-- Migration 092: Add missing DELETE policy on engage_kpi_anomalies
--
-- The table only had SELECT, INSERT, UPDATE policies. Without DELETE,
-- the Watchdog's cleanup of stale anomalies was silently blocked by RLS.

CREATE POLICY "Users can delete org anomalies" ON engage_kpi_anomalies
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
