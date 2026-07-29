-- ═══════════════════════════════════════════════════════════════════════════
--  Hire Intelligence — Supabase schema
--  Run this once in your Supabase project: SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Candidates ───
-- Primary key is composite (user_id, id): each row is owned by a user, and the
-- client-generated id only needs to be unique within that user's data.
create table if not exists public.candidates (
  id                text not null,
  user_id           uuid not null default auth.uid(),
  name              text not null,
  email             text default '',
  phone             text default '',
  stage             text not null default 'applied',
  job_req_id        text default '',
  department        text default '',
  position          text not null,
  source            text default 'Manual',
  notes             text default '',
  cv_analysis       jsonb,
  interview_results jsonb default '[]'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  primary key (user_id, id)
);

-- ─── Job Requisitions ───
create table if not exists public.job_reqs (
  id             text not null,
  user_id        uuid not null default auth.uid(),
  title          text not null,
  department     text default '',
  level          text default '',
  status         text not null default 'draft',
  description    text default '',
  requirements   text default '',
  salary_min     bigint default 0,
  salary_max     bigint default 0,
  currency       text default 'IDR',
  location       text default '',
  target_date    text default '',
  headcount      int default 1,
  hiring_manager text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  primary key (user_id, id)
);

-- ─── Activity Feed ───
create table if not exists public.activities (
  id        text not null,
  user_id   uuid not null default auth.uid(),
  action    text not null,
  target    text default '',
  "user"    text default 'You',
  "time"    timestamptz default now(),
  "type"    text not null,
  primary key (user_id, id)
);

-- Helpful indexes
create index if not exists activities_time_idx on public.activities ("time" desc);
create index if not exists candidates_user_idx on public.candidates (user_id);
create index if not exists job_reqs_user_idx   on public.job_reqs (user_id);
create index if not exists activities_user_idx on public.activities (user_id);

-- ═══════════════════════════════════════════════════════════════════════════
--  Row Level Security (RLS) — per-user isolation
--  Each row is owned by the user who created it (user_id defaults to auth.uid()).
--  Policies scope every operation to the authenticated owner, so one user can
--  never read or write another user's candidates. Requires login (the anon key
--  alone has a null auth.uid() and therefore sees nothing).
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.candidates enable row level security;
alter table public.job_reqs   enable row level security;
alter table public.activities enable row level security;

-- Drop any legacy permissive policies from earlier versions.
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
