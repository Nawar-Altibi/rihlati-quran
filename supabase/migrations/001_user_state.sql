-- 001_user_state.sql — run in the Supabase SQL Editor before enabling accounts.
-- Each row stores exactly one authenticated person's Quran journey.
-- No service_role is used by the application API.
begin;

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint reasonable_payload_size check (octet_length(payload::text) <= 524288)
);

alter table public.user_state enable row level security;

revoke all on table public.user_state from public, anon, authenticated;
grant select, insert, update on table public.user_state to authenticated;

drop policy if exists "read own Quran state" on public.user_state;
drop policy if exists "insert own Quran state" on public.user_state;
drop policy if exists "update own Quran state" on public.user_state;

create policy "read own Quran state"
  on public.user_state for select to authenticated
  using (user_id = (select auth.uid()));

create policy "insert own Quran state"
  on public.user_state for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "update own Quran state"
  on public.user_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists idx_user_state_updated on public.user_state(updated_at desc);

-- A recovery proof must be consumed once before a password can be changed.
-- The browser never receives access to the session JWT; Pages Functions uses
-- the same verified user's JWT for this short-lived proof row.
create table if not exists public.account_recovery_proofs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nonce_hash text not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null
);

alter table public.account_recovery_proofs enable row level security;
revoke all on table public.account_recovery_proofs from public, anon, authenticated;
grant select, insert, update, delete on table public.account_recovery_proofs to authenticated;

drop policy if exists "read own recovery proof" on public.account_recovery_proofs;
drop policy if exists "insert own recovery proof" on public.account_recovery_proofs;
drop policy if exists "update own recovery proof" on public.account_recovery_proofs;
drop policy if exists "delete own recovery proof" on public.account_recovery_proofs;

create policy "read own recovery proof"
  on public.account_recovery_proofs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "insert own recovery proof"
  on public.account_recovery_proofs for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "update own recovery proof"
  on public.account_recovery_proofs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "delete own recovery proof"
  on public.account_recovery_proofs for delete to authenticated
  using (user_id = (select auth.uid()));

commit;

-- Verification: authenticated A must not read/update user B's row, and anon gets 0 results.
-- DO NOT grant the service_role key to browsers, edge script output, or public env vars.
