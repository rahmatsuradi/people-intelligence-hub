-- ═══════════════════════════════════════════════════════════════════════════
--  Formulir data karyawan (pengganti Google Form "Employee Database") + ekspor
--  ke template impor HRIS KantorKu.  — 17 November 2026
--
--  Alur: HR membuat link → karyawan mengisi /data-karyawan/<token> dari HP →
--  isian masuk ke pi_employee_data_submissions (BELUM mengubah master) → HR
--  membandingkan & menekan "Terapkan" → pi_employees / pi_employee_profiles /
--  pi_employee_hris diperbarui → /karyawan/kantorku mengekspor template KantorKu.
--
--  Isian tidak langsung menimpa master karena link bisa diteruskan ke orang lain;
--  HR yang memutuskan. Isian lama tidak pernah dihapus (riwayat + audit).
--
--  Aditif: tabel baru + bucket penyimpanan baru. Tidak ada ALTER/DROP pada tabel lama.
--  Aman dijalankan ulang. Jalankan di Supabase SQL Editor (Rica Rico; untuk Lencir
--  jalankan juga bila fitur ini dipakai di sana).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Kolom khusus KantorKu, 1:1 dengan pi_employees --------------------------
--    Kolom template KantorKu yang tidak ada di master lama. Semua boleh kosong:
--    kosong = belum diisi, bukan "tidak ada".
create table if not exists public.pi_employee_hris (
  employee_id          uuid primary key references public.pi_employees (id) on delete cascade,
  kantorku_employee_id text,          -- Employee ID di KantorKu (mis. 202604007); kosong = dibuat KantorKu saat impor
  company_email        text,          -- email login KantorKu; kosong = pakai email pribadi di profil
  employment_type      text check (employment_type in ('permanent', 'contract', 'probation', 'intern', 'freelance', 'borongan')),
  contract_end_date    date,          -- wajib di KantorKu untuk contract/probation/intern
  tax_status           text check (tax_status in ('Pegawai Tetap', 'Pegawai Tidak Tetap')),
  payee_type           text,          -- wajib bila Pegawai Tidak Tetap (pilihan di REF template)
  payment_schedule     text check (payment_schedule in ('Monthly', 'Weekly', 'Daily')),
  calculate_per        text check (calculate_per in ('Month', 'Shift')),
  taxability           text check (taxability in ('Gross', 'Gross Up', 'Nett')),
  account_holder       text,          -- nama di buku tabungan, harus persis
  bpjs_tk_number       text,
  bpjs_kes_number      text,
  branch               text,          -- harus persis nilai sheet "Existing Data"
  department           text,
  position             text,
  exported_at          timestamptz,   -- terakhir ikut berkas ekspor KantorKu
  updated_at           timestamptz not null default now(),
  updated_by           uuid default auth.uid()
);
create unique index if not exists pi_employee_hris_kk_id_idx on public.pi_employee_hris (kantorku_employee_id) where kantorku_employee_id is not null;

-- 2. Link formulir -----------------------------------------------------------
--    employee_id terisi = link pribadi (nama & data lama ditampilkan, sebagian disamarkan);
--    employee_id kosong = link umum (karyawan baru setelah offering letter).
create table if not exists public.pi_employee_data_links (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  token         text not null unique,      -- acak 24 byte (hex)
  employee_id   uuid references public.pi_employees (id) on delete cascade,
  label         text,
  status        text not null default 'open' check (status in ('open', 'closed')),
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  last_opened_at    timestamptz,
  last_submitted_at timestamptz
);
create index if not exists pi_employee_data_links_emp_idx on public.pi_employee_data_links (employee_id);

-- 3. Isian -------------------------------------------------------------------
create table if not exists public.pi_employee_data_submissions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  link_id       uuid references public.pi_employee_data_links (id) on delete set null,
  employee_id   uuid references public.pi_employees (id) on delete set null,   -- target (dari link pribadi, atau dipilih HR)
  answers       jsonb not null,            -- jawaban yang sudah divalidasi server
  files         jsonb not null default '{}',  -- { ktp, kk, photo: "<path di bucket pi-employee-docs>" }
  status        text not null default 'baru' check (status in ('baru', 'diterapkan', 'ditolak')),
  flags         text[] not null default '{}',
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  review_note   text
);
create index if not exists pi_employee_data_submissions_status_idx on public.pi_employee_data_submissions (status, submitted_at desc);
create index if not exists pi_employee_data_submissions_emp_idx on public.pi_employee_data_submissions (employee_id);

-- 4. RLS ---------------------------------------------------------------------
--    pi_employee_hris mengikuti pola master (baca hr/owner, tulis hr).
--    Link & isian = HR saja (isian memuat data pribadi mentah yang belum diverifikasi).
--    Formulir publik menulis lewat service-role di /api/data-karyawan.
alter table public.pi_employee_hris enable row level security;
drop policy if exists "pi read pi_employee_hris" on public.pi_employee_hris;
create policy "pi read pi_employee_hris" on public.pi_employee_hris
  for select to authenticated using (public.pi_role() in ('hr', 'owner'));
drop policy if exists "pi write pi_employee_hris" on public.pi_employee_hris;
create policy "pi write pi_employee_hris" on public.pi_employee_hris
  for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');
revoke all on public.pi_employee_hris from anon;
grant select, insert, update, delete on public.pi_employee_hris to authenticated;

do $$
declare t text;
begin
  foreach t in array array['pi_employee_data_links', 'pi_employee_data_submissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'pi hr only ' || t, t);
    execute format($f$create policy %I on public.%I as permissive for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr')$f$, 'pi hr only ' || t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- 5. Penyimpanan KTP / KK / pas foto ----------------------------------------
--    Bucket privat: tidak ada URL publik. Unggahan lewat service-role (formulir),
--    HR membuka lewat signed URL berumur pendek.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pi-employee-docs', 'pi-employee-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pi hr read employee docs" on storage.objects;
create policy "pi hr read employee docs" on storage.objects
  for select to authenticated using (bucket_id = 'pi-employee-docs' and public.pi_role() = 'hr');

-- Pemeriksaan ----------------------------------------------------------------
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('pi_employee_hris', 'pi_employee_data_links', 'pi_employee_data_submissions');
select id, public from storage.buckets where id = 'pi-employee-docs';
