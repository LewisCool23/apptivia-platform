-- Migration 188: Add tenure_months and influence_score to engage_prospects,
-- and ai_enhanced_analysis JSONB to engage_accounts

-- Prospect tenure (computed from employment history where available)
ALTER TABLE engage_prospects ADD COLUMN IF NOT EXISTS tenure_months INT;

-- Influence score (0-100, computed during enrichment/save)
ALTER TABLE engage_prospects ADD COLUMN IF NOT EXISTS influence_score INT DEFAULT 0;

-- Enhanced AI analysis output (outbound_guidance, outreach_strategy, suggested_key_contacts, deal_risk_assessment)
ALTER TABLE engage_accounts ADD COLUMN IF NOT EXISTS ai_enhanced_analysis JSONB;

-- Index for sorting by influence
CREATE INDEX IF NOT EXISTS idx_engage_prospects_influence ON engage_prospects(influence_score DESC) WHERE influence_score > 0;
