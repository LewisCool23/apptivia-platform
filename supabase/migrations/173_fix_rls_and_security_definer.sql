-- Migration 173: Fix 7 critical Supabase Security Advisor issues
-- 5 tables with RLS disabled + 2 views missing explicit security context

-- ── 1. kpi_values_backup_141 — backup table, deny all client access ─────────

ALTER TABLE IF EXISTS kpi_values_backup_141 ENABLE ROW LEVEL SECURITY;
-- No policies = deny all access from API (backup table should never be queried by clients)

-- ── 2. integration_calendar_events — org-scoped RLS ─────────────────────────

ALTER TABLE integration_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org calendar events"
  ON integration_calendar_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert calendar events for their org"
  ON integration_calendar_events FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their org calendar events"
  ON integration_calendar_events FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their org calendar events"
  ON integration_calendar_events FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- ── 3. integration_sync_cursors — org-scoped via integration FK ─────────────

ALTER TABLE integration_sync_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync cursors for their org integrations"
  ON integration_sync_cursors FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM integrations i
    JOIN profiles p ON p.organization_id = i.organization_id
    WHERE p.id = auth.uid()
  ));

CREATE POLICY "Users can manage sync cursors for their org integrations"
  ON integration_sync_cursors FOR ALL
  USING (integration_id IN (
    SELECT i.id FROM integrations i
    JOIN profiles p ON p.organization_id = i.organization_id
    WHERE p.id = auth.uid()
  ));

-- ── 4. schema_migrations — system table, deny all client access ─────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations') THEN
    ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
    -- No policies = deny all access from API (system table)
  END IF;
END $$;

-- ── 5. engage_enrichment_log — org-scoped RLS ───────────────────────────────

ALTER TABLE engage_enrichment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view enrichment logs for their org"
  ON engage_enrichment_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert enrichment logs for their org"
  ON engage_enrichment_log FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

-- ── 6. profiles_with_team_name — explicit SECURITY INVOKER ──────────────────

DROP VIEW IF EXISTS profiles_with_team_name;
CREATE VIEW profiles_with_team_name
  WITH (security_invoker = true)
AS
SELECT p.*, t.name AS team_name
FROM profiles p
LEFT JOIN teams t ON t.id = p.team_id;

-- ── 7. engage_resolved_signals — explicit SECURITY INVOKER ──────────────────

DROP VIEW IF EXISTS engage_resolved_signals;
CREATE VIEW engage_resolved_signals
  WITH (security_invoker = true)
AS
  SELECT
    sd.id                         AS definition_id,
    NULL::UUID                    AS org_config_id,
    NULL::UUID                    AS organization_id,
    sd.signal_key,
    sd.signal_name,
    sd.category,
    sd.description,
    sd.default_score              AS effective_score,
    sd.default_strength           AS effective_strength,
    sd.icon,
    sd.sort_order,
    true                          AS is_universal,
    true                          AS is_enabled,
    sd.created_at
  FROM engage_signal_definitions sd
  WHERE sd.is_universal = true AND sd.is_active = true

  UNION ALL

  SELECT
    NULL::UUID                    AS definition_id,
    osc.id                        AS org_config_id,
    osc.organization_id,
    osc.signal_key,
    osc.signal_name,
    osc.category,
    osc.description,
    osc.default_score             AS effective_score,
    osc.default_strength          AS effective_strength,
    osc.icon,
    0                             AS sort_order,
    false                         AS is_universal,
    true                          AS is_enabled,
    osc.created_at
  FROM engage_org_signal_configs osc
  WHERE osc.signal_definition_id IS NULL;

-- ── Record migration ────────────────────────────────────────────────────────

INSERT INTO schema_migrations (version, name)
VALUES ('173', 'fix_rls_and_security_definer')
ON CONFLICT DO NOTHING;
