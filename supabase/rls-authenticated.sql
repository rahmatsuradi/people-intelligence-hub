-- ═══════════════════════════════════════════════════════════════════════════
--  Hire Intelligence — Tighten RLS to authenticated users only
--
--  SUPERSEDED: schema.sql now applies these exact policies itself, so a fresh
--  setup is secure without this file. Kept because it is the remediation script
--  for any database created by an older schema.sql (which left the candidates
--  table readable and writable by the public anon key).
--
--  Still safe to run at any time — it is idempotent and only tightens access.
--
--  Replaces the permissive anon policies: now only logged-in (authenticated)
--  users can read/write. Anonymous access via the publishable key is blocked.
--  The public apply flow keeps working: it uses the service-role key server-side.
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove the old permissive anon policies
drop policy if exists "anon all candidates" on public.candidates;
drop policy if exists "anon all job_reqs"   on public.job_reqs;
drop policy if exists "anon all activities" on public.activities;

-- Allow access only to authenticated (logged-in) users
create policy "auth all candidates" on public.candidates for all to authenticated using (true) with check (true);
create policy "auth all job_reqs"   on public.job_reqs   for all to authenticated using (true) with check (true);
create policy "auth all activities" on public.activities for all to authenticated using (true) with check (true);
