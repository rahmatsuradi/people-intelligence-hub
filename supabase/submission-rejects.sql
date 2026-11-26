-- ═══════════════════════════════════════════════════════════════════════════
--  Catatan kiriman formulir data karyawan yang DITOLAK  (26 Nov 2026)
--
--  Latar: formulir publik menolak kiriman (isian salah = 400, beda dengan KTP = 409,
--  gagal simpan = 500) TANPA menyimpan apa pun. Karyawan melihat pesan di layarnya, tetapi HR
--  tidak punya jejak — "sudah isi" vs "tidak ada di web" tidak bisa dibuktikan. Tabel ini
--  mencatat percobaan itu: siapa (nama/outlet/HP yang diketik), kapan, kenapa, field mana.
--
--  Yang TIDAK dicatat: NIK, rekening, tanggal lahir, alamat, isi pesan galat, foto. Hanya
--  nama field yang bermasalah.
--  Dibaca HR saja. Ditulis lewat service-role di /api/data-karyawan (gagal menulis tidak
--  menggagalkan formulir). Batas kiriman per IP (429) sengaja tidak dicatat.
--
--  Aditif: tabel baru. Tidak ada ALTER/DROP pada tabel lama. Aman dijalankan ulang.
--  Jalankan di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pi_employee_submission_rejects (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  link_id      uuid references public.pi_employee_data_links (id) on delete set null,
  status_code  int  not null,                       -- 400 | 409 | 500
  reason       text not null check (reason in ('isian_tidak_valid', 'beda_ktp', 'gagal_simpan')),
  fields       text[] not null default '{}',        -- nama field bermasalah (bukan nilainya)
  name         text,                                -- nama yang diketik
  outlet       text,
  contact      text,                                -- nomor HP yang diketik, untuk menghubungi
  created_at   timestamptz not null default now()
);
create index if not exists pi_employee_submission_rejects_created_idx
  on public.pi_employee_submission_rejects (tenant_id, created_at desc);

alter table public.pi_employee_submission_rejects enable row level security;
drop policy if exists "pi hr only pi_employee_submission_rejects" on public.pi_employee_submission_rejects;
create policy "pi hr only pi_employee_submission_rejects" on public.pi_employee_submission_rejects
  as permissive for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');
revoke all on public.pi_employee_submission_rejects from anon;
grant select, insert, update, delete on public.pi_employee_submission_rejects to authenticated;

-- Pemeriksaan
select count(*) as baris from public.pi_employee_submission_rejects;
