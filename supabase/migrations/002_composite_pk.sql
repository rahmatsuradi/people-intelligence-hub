-- ═══════════════════════════════════════════════════════════════════════════
--  Migration 002 — composite primary key (user_id, id)
--
--  Makes the app truly multi-tenant: the client-generated `id` only needs to be
--  unique WITHIN a user's data, so two users can hold rows with the same id
--  (e.g. the fixed demo IDs like C-DEMO-001) without colliding, and there is no
--  cross-user primary-key contention on randomly-generated ids.
--
--  Run AFTER migration 001. Supabase dashboard → SQL Editor → paste → Run.
--
--  ⚠️  A composite key including user_id requires every row to have a non-null
--  user_id. The block below backfills orphaned rows (created before ownership
--  existed) to an owner. NOTE: auth.uid() is NULL in the SQL editor (it runs as
--  the postgres role), so we resolve the owner from auth.users instead.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Backfill orphaned rows to an owner.
--    Defaults to the FIRST account in auth.users — correct for a single-user
--    project. If you have multiple users and want to assign legacy rows to a
--    specific person, replace the sub-select with that user's UUID.
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;
  if owner_id is null then
    raise notice 'No users found in auth.users — skipping backfill. Sign up first, then re-run.';
  else
    update public.candidates set user_id = owner_id where user_id is null;
    update public.job_reqs   set user_id = owner_id where user_id is null;
    update public.activities set user_id = owner_id where user_id is null;
  end if;
end $$;

-- 2. Enforce ownership (fails loudly if any orphaned rows remain).
alter table public.candidates alter column user_id set not null;
alter table public.job_reqs   alter column user_id set not null;
alter table public.activities alter column user_id set not null;

-- 3. Swap the single-column primary key for the composite (user_id, id).
alter table public.candidates drop constraint if exists candidates_pkey;
alter table public.job_reqs   drop constraint if exists job_reqs_pkey;
alter table public.activities drop constraint if exists activities_pkey;

alter table public.candidates add primary key (user_id, id);
alter table public.job_reqs   add primary key (user_id, id);
alter table public.activities add primary key (user_id, id);
