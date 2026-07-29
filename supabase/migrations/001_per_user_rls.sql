-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 001 — per-user data isolation (RLS)
--
--  Upgrades an EXISTING Hire Intelligence database from the old permissive
--  "anon can read/write everything" policies to per-user row ownership.
--
--  How to run: Supabase dashboard → SQL Editor → New query → paste → Run.
--  Safe to run more than once (idempotent).
--
--  ⚠️  BACKFILL: existing rows were created before ownership existed and have a
--  NULL user_id, so after this migration they are invisible to everyone. If you
--  want to CLAIM the existing rows for your own account, log in to the app first
--  (so auth.uid() resolves to you), then run the OPTIONAL backfill block at the
--  bottom while authenticated as that user.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add ownership column (defaults to the creating user on future inserts).
alter table public.candidates add column if not exists user_id uuid default auth.uid();
alter table public.job_reqs   add column if not exists user_id uuid default auth.uid();
alter table public.activities add column if not exists user_id uuid default auth.uid();

-- 2. Index the ownership column for the per-user filter.
create index if not exists candidates_user_idx on public.candidates (user_id);
create index if not exists job_reqs_user_idx   on public.job_reqs (user_id);
create index if not exists activities_user_idx on public.activities (user_id);

-- 3. Replace permissive policies with per-user policies.
alter table public.candidates enable row level security;
alter table public.job_reqs   enable row level security;
alter table public.activities enable row level security;

drop policy if exists "anon all candidates" on public.candidates;
drop policy if exists "anon all job_reqs"   on public.job_reqs;
drop policy if exists "anon all activities" on public.activities;
drop policy if exists "own candidates" on public.candidates;
drop policy if exists "own job_reqs"   on public.job_reqs;
drop policy if exists "own activities" on public.activities;

create policy "own candidates" on public.candidates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own job_reqs" on public.job_reqs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own activities" on public.activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── OPTIONAL backfill ───────────────────────────────────────────────────────
-- Claim all previously-unowned rows for an existing account so they stay
-- visible. NOTE: auth.uid() is NULL in the SQL editor (it runs as the postgres
-- role), so resolve the owner from auth.users instead. Defaults to the first
-- account — fine for a single-user project; use a specific UUID otherwise.
-- (Migration 002 performs this same backfill automatically before adding the
-- composite primary key, so you can skip this and just run 002.)
--
-- update public.candidates set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;
-- update public.job_reqs   set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;
-- update public.activities set user_id = (select id from auth.users order by created_at limit 1) where user_id is null;
