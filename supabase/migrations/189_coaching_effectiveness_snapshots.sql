-- Migration 189: Add KPI snapshots to coaching_plans for effectiveness tracking

ALTER TABLE coaching_plans ADD COLUMN IF NOT EXISTS kpi_snapshot_start JSONB;
ALTER TABLE coaching_plans ADD COLUMN IF NOT EXISTS kpi_snapshot_end JSONB;
