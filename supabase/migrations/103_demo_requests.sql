-- Demo request form submissions from landing page
CREATE TABLE IF NOT EXISTS demo_requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT,
  team_size   TEXT,
  message     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Allow backend service role to insert
ALTER TABLE demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_insert" ON demo_requests FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_select" ON demo_requests FOR SELECT TO service_role USING (true);

COMMENT ON TABLE demo_requests IS 'Inbound demo requests from apptivia.app landing page';
