-- ═══════════════════════════════════════════════════════════════════════════
--  Hire Intelligence — Supabase schema
--  Run this once in your Supabase project: SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Candidates ───
create table if not exists public.candidates (
  id                text primary key,
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
  updated_at        timestamptz default now()
);

-- ─── Job Requisitions ───
create table if not exists public.job_reqs (
  id             text primary key,
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
  updated_at     timestamptz default now()
);

-- ─── Activity Feed ───
create table if not exists public.activities (
  id        text primary key,
  action    text not null,
  target    text default '',
  "user"    text default 'You',
  "time"    timestamptz default now(),
  "type"    text not null
);

-- Helpful index for sorting the activity feed
create index if not exists activities_time_idx on public.activities ("time" desc);

-- ═══════════════════════════════════════════════════════════════════════════
--  Row Level Security (RLS) — authenticated users only
--
--  The anon/publishable key is PUBLIC: it ships inside client JS and anyone can
--  read it from the browser. It must never be able to read or write candidate
--  PII (name, email, phone, CV analysis). Policies below are therefore scoped
--  `to authenticated` — a policy with no `to` clause defaults to PUBLIC, which
--  includes anon, and that is what leaked in earlier versions of this file.
--
--  SAFE TO RE-RUN: drops the legacy permissive "anon all *" policies first, so
--  re-running this file TIGHTENS access. It can never reopen public access.
--  (Earlier versions recreated the anon policies here, meaning a re-run
--  silently reopened the whole candidates table to the internet.)
--
--  The public apply flow (/apply) is unaffected: it runs server-side with the
--  service-role key (src/lib/supabase-admin.ts), which bypasses RLS entirely.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.candidates enable row level security;
alter table public.job_reqs   enable row level security;
alter table public.activities enable row level security;

-- Legacy public-access policies — present if an older schema.sql was ever run.
drop policy if exists "anon all candidates" on public.candidates;
drop policy if exists "anon all job_reqs"   on public.job_reqs;
drop policy if exists "anon all activities" on public.activities;

-- Dropped then recreated so this block is idempotent; a momentary gap fails
-- CLOSED (no policy = no access), never open.
drop policy if exists "auth all candidates" on public.candidates;
drop policy if exists "auth all job_reqs"   on public.job_reqs;
drop policy if exists "auth all activities" on public.activities;

create policy "auth all candidates" on public.candidates for all to authenticated using (true) with check (true);
create policy "auth all job_reqs"   on public.job_reqs   for all to authenticated using (true) with check (true);
create policy "auth all activities" on public.activities for all to authenticated using (true) with check (true);
