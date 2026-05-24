-- Migration 182: Atomic upsert RPC for website_visitors
-- Replaces check-then-insert pattern to eliminate race condition on concurrent visits.
-- Uses INSERT ... ON CONFLICT (session_id) DO UPDATE to atomically insert or increment.

CREATE OR REPLACE FUNCTION upsert_website_visitor(
  p_organization_id UUID,
  p_session_id      TEXT,
  p_ip_address      TEXT,
  p_company_name    TEXT,
  p_company_domain  TEXT,
  p_last_seen_url   TEXT,
  p_referrer        TEXT,
  p_page_title      TEXT,
  p_now             TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO website_visitors (
    organization_id, session_id, ip_address, company_name, company_domain,
    last_seen_url, referrer, page_title, page_views, first_seen_at, last_seen_at
  ) VALUES (
    p_organization_id, p_session_id, p_ip_address, p_company_name, p_company_domain,
    p_last_seen_url, p_referrer, p_page_title, 1, p_now, p_now
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_seen_url = EXCLUDED.last_seen_url,
    page_title    = EXCLUDED.page_title,
    last_seen_at  = EXCLUDED.last_seen_at,
    page_views    = website_visitors.page_views + 1;
END;
$$;
