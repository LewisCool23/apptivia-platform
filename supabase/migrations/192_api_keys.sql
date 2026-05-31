-- Migration 192: API key management for external access (MCP / Claude Skills)

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL, -- SHA-256 hash of the key
  key_prefix TEXT NOT NULL, -- first 8 chars for identification (e.g., "aptv_xxxx")
  scopes TEXT[] DEFAULT '{read}', -- read, write, admin
  rate_limit_per_minute INT DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on api_keys" ON api_keys
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id) WHERE is_active = true;
