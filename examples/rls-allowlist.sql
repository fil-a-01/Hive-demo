-- Team-shared ops, not multi-tenant SaaS.
-- Threat model: invite-only teammates on one database. Allowlist → role → RLS.
-- Caveat: operational tables often use USING (true) for authenticated; that is
-- shared-team visibility, not row-owner isolation. Do not pitch as multi-tenant.

create table if not exists allowed_users (
  email text primary key,
  role text not null check (role in ('operator', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from allowed_users au
  where lower(au.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

alter table allowed_users enable row level security;

-- Self can read own allowlist row; admin can read all.
create policy allowed_users_select_self
  on allowed_users
  for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy allowed_users_select_admin
  on allowed_users
  for select
  to authenticated
  using (current_app_role() = 'admin');

-- Example ops table: everyone on the allowlist sees the same Northwind / Avery rows.
create table if not exists operator_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table operator_notes enable row level security;

-- Team-shared: any authenticated allowlisted user sees all notes (not row-owner).
create policy operator_notes_team_read
  on operator_notes
  for select
  to authenticated
  using (true);

-- Writes: app checks allowlist first; some Server Actions then use service role.
-- Trust boundary for those paths is application code, not this policy.
