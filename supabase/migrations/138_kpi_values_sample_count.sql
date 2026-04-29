-- Migration 138: Add sample_count for averaging KPI aggregation
-- Enables proper rolling averages for call intelligence KPIs
-- (talk_to_listen_ratio, interactivity_score, longest_monologue_sec)

BEGIN;

ALTER TABLE kpi_values
ADD COLUMN IF NOT EXISTS sample_count INTEGER DEFAULT 1 NOT NULL;

COMMENT ON COLUMN kpi_values.sample_count IS 'Number of data points aggregated into this value. Used for avg/max aggregation KPIs like talk_to_listen_ratio.';

COMMIT;
