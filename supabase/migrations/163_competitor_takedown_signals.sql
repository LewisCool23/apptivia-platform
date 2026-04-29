-- Migration 163: Competitor Takedown signals + news cache
-- Source: Spec 05 — highest-converting signal type for prospects using competitor tools

-- 1. Seed 2 new universal signal definitions
INSERT INTO engage_signal_definitions (signal_key, signal_name, category, default_score, default_strength, is_universal, description)
VALUES
  ('competitor_takedown', 'Competitor Takedown', 'company_event', 85, 'very_high', true,
   'Fires when a tracked competitor has a material event (layoff, acquisition, price hike, outage). Prospects using that competitor are maximally reachable.'),
  ('website_visitor_activation', 'Website Visitor Activation', 'buyer_intent', 75, 'high', true,
   'Fires when an identified website visitor matches an existing prospect or ICP criteria. 24h response SLA.')
ON CONFLICT (signal_key) DO UPDATE SET
  signal_name = EXCLUDED.signal_name,
  category = EXCLUDED.category,
  default_score = EXCLUDED.default_score,
  default_strength = EXCLUDED.default_strength,
  description = EXCLUDED.description;

-- 2. Competitor news cache — prevents re-scraping and enables dedup
CREATE TABLE IF NOT EXISTS competitor_news_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  competitor_name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'layoff', 'price_increase', 'acquisition', 'shutdown',
    'data_breach', 'leadership_change', 'funding_round',
    'product_changes', 'outage', 'other'
  )),
  event_summary text NOT NULL,
  source_url text,
  source_title text,
  raw_payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  fired_signals_count integer NOT NULL DEFAULT 0,

  UNIQUE(organization_id, competitor_name, event_summary)
);

CREATE INDEX idx_competitor_news_org
  ON competitor_news_cache(organization_id, created_at DESC);

ALTER TABLE competitor_news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members see their org competitor news" ON competitor_news_cache
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "service_role bypass competitor_news_cache"
  ON competitor_news_cache FOR ALL
  USING (current_setting('role') = 'service_role')
  WITH CHECK (current_setting('role') = 'service_role');

COMMENT ON TABLE competitor_news_cache IS
  'Cached competitor takedown events from Tavily news search. Drives competitor_takedown signal firing.';
