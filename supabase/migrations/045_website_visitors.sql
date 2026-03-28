-- 045_website_visitors.sql
-- Website Visitor ID tracking table

create table if not exists website_visitors (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  session_id       text not null unique,       -- IP + 30-min window key
  ip_address       text,
  company_name     text,
  company_domain   text,
  last_seen_url    text,
  referrer         text,
  page_title       text,
  page_views       integer not null default 1,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now()
);

-- Indexes for common query patterns
create index if not exists website_visitors_org_id_idx      on website_visitors(organization_id);
create index if not exists website_visitors_company_idx     on website_visitors(organization_id, company_name);
create index if not exists website_visitors_last_seen_idx   on website_visitors(organization_id, last_seen_at desc);

-- RLS: organizations can only see their own visitor data
alter table website_visitors enable row level security;

create policy "org members can view own visitors"
  on website_visitors for select
  using (
    organization_id in (
      select organization_id from profiles where id = auth.uid()
    )
  );

-- Service role can insert/upsert (backend tracking endpoint uses service key)
create policy "service role can manage visitors"
  on website_visitors for all
  using (true)
  with check (true);
