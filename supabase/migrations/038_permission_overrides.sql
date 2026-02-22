-- Migration 038: Move permission overrides from client localStorage to the database.
-- This ensures overrides are enforced server-side (via RLS + API), sync across
-- devices, and cannot be tampered with from the browser.

create table if not exists user_permission_overrides (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  overrides      jsonb not null default '{}',
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id)
);

alter table user_permission_overrides enable row level security;

-- Admins can read and write any override within their organization
create policy "Admins manage permission overrides"
  on user_permission_overrides
  for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = user_permission_overrides.organization_id
    )
  );

-- Every user can read their own overrides
create policy "Users read own permission overrides"
  on user_permission_overrides
  for select
  using (user_id = auth.uid());
