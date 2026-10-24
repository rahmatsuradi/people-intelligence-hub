-- ═══════════════════════════════════════════════════════════════════════════
--  Rica Rico — Fase 1: master outlet, profil karyawan, dan akses HR / owner
--
--  1. pi_user_roles   — peran tiap akun login: 'hr' (baca + tulis) atau 'owner'
--                       (baca saja). Akun tanpa baris di sini tidak bisa membaca
--                       data apa pun.
--  2. pi_role()       — peran akun yang sedang login (security definer, supaya
--                       policy di tabel lain bisa memanggilnya tanpa rekursi RLS).
--  3. Policy semua tabel diganti dari "authenticated boleh semua" menjadi
--     baca = hr/owner, tulis = hr. Alur publik (/apply, /tes) tidak terdampak:
--     keduanya memakai service-role yang memang melewati RLS.
--  4. pi_outlets      — ±110 outlet Rica Rico (area, SPV, jenis lokasi).
--  5. pi_employee_profiles — data kerja & pribadi Rica Rico yang tidak dimiliki
--                       pi_employees (kelompok kerja, outlet, atasan, badan usaha
--                       BPJS, kontak, rekening, tanda kualitas data). 1 : 1.
--  6. pi_employees.join_date boleh kosong — banyak karyawan santan/sopir tidak
--     punya tanggal masuk tercatat; tanggal karangan lebih berbahaya karena
--     dipakai untuk prorata & masa kerja.
--
--  BOOTSTRAP (sekali, di SQL Editor, BUKAN di file ini): beri peran 'hr' ke akun
--  HR yang sudah ada, mis.
--    insert into pi_user_roles (user_id, role) select id, 'hr' from auth.users
--    where email = '<email-hr>' on conflict do nothing;
--  Sengaja tidak "semua akun = hr": file ini aman dijalankan ulang, dan
--  menjalankannya ulang setelah akun owner dibuat tidak boleh menaikkan owner
--  menjadi hr.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Peran ----------------------------------------------------------------
create table if not exists public.pi_user_roles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('hr', 'owner')),
  display_name text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);

create or replace function public.pi_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.pi_user_roles where user_id = auth.uid()
$$;

alter table public.pi_user_roles enable row level security;
drop policy if exists "pi read own role" on public.pi_user_roles;
create policy "pi read own role" on public.pi_user_roles
  for select to authenticated using (user_id = auth.uid() or public.pi_role() = 'hr');
drop policy if exists "pi hr manage roles" on public.pi_user_roles;
create policy "pi hr manage roles" on public.pi_user_roles
  for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');

-- 4. Outlet ---------------------------------------------------------------
create table if not exists public.pi_outlets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  name          text not null,
  area          text,                -- Jakarta 1..5, Tangerang, Bekasi
  spv_name      text,                -- SPV area yang memegang outlet
  location_type text check (location_type in ('stasiun', 'mall', 'supermarket', 'toko', 'lainnya')),
  status        text not null default 'active' check (status in ('active', 'closed')),
  source        text,                -- asal data (mis. tracker omset), untuk audit impor
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, name)
);

-- 5. Profil karyawan ------------------------------------------------------
create table if not exists public.pi_employee_profiles (
  employee_id          uuid primary key references public.pi_employees (id) on delete cascade,
  work_group           text not null check (work_group in ('spg', 'spv', 'office', 'produksi', 'santan', 'sopir', 'host_live', 'lainnya')),
  outlet_id            uuid references public.pi_outlets (id) on delete set null,
  placement_note       text,          -- penempatan non-outlet: Backup, Training, Event Mobile, Pusat
  supervisor_name      text,
  legal_entity         text,          -- badan usaha BPJS: CV Rica Rico Bakery Indonesia, UD Rica Rico, CV …, BPU
  employment_label     text,          -- label asli di rekap gaji, mis. "Pegawai Kontrak", "Freelance"
  nickname             text,
  gender               text,
  birth_place          text,
  birth_date           date,
  religion             text,
  blood_type           text,
  marital_status       text,
  mother_name          text,          -- dibutuhkan untuk pendaftaran BPJS
  phone                text,
  email                text,
  address              text,
  emergency_name       text,
  emergency_phone      text,
  emergency_relation   text,
  education_level      text,
  education_institution text,
  education_major      text,
  bank_name            text,
  ktp_url              text,
  kk_url               text,
  photo_url            text,
  data_flags           text[] not null default '{}',  -- tanda yang perlu dibereskan HR
  source               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists pi_employee_profiles_outlet_idx on public.pi_employee_profiles (outlet_id);
create index if not exists pi_employee_profiles_group_idx on public.pi_employee_profiles (work_group);

-- 6. Tanggal masuk boleh kosong -------------------------------------------
alter table public.pi_employees alter column join_date drop not null;

-- 3. Policy baca = hr/owner, tulis = hr -----------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'candidates', 'job_reqs', 'activities',
    'pi_employees', 'pi_compensation', 'pi_statutory_config', 'pi_payroll_runs', 'pi_payroll_lines', 'pi_payslips',
    'pi_assessment_norms', 'pi_assessment_profiles', 'pi_assessment_sessions', 'pi_interview_questions',
    'pi_hr_records', 'pi_outlets', 'pi_employee_profiles'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'auth all ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'pi read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'pi write ' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.pi_role() in (''hr'', ''owner''))', 'pi read ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.pi_role() = ''hr'') with check (public.pi_role() = ''hr'')', 'pi write ' || t, t);
  end loop;
end $$;
