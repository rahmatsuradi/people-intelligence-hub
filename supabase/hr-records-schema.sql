-- ═══════════════════════════════════════════════════════════════════════════
--  People Intelligence — penyimpanan cloud untuk fitur HR (pi_hr_records)
--
--  Satu tabel dokumen untuk 14 koleksi milik enam fitur: eNPS & umpan balik,
--  pelatihan (kursus, peserta, anggaran), suksesi (9-box, posisi kunci, suksesor),
--  OD (struktur pelaporan, grade, pemetaan jabatan→grade), hubungan industrial
--  (kasus, dokumen PP/PKB), dan matriks kompetensi. Daftar `kind` yang sah ada di
--  src/lib/hr-records.ts (HR_KINDS).
--
--  Kenapa satu tabel jsonb, bukan 14 tabel bertipe: fitur-fitur ini baru dan bentuk
--  datanya masih akan berubah; dengan jsonb, perubahan bentuk tidak butuh ALTER.
--  Pecah ke tabel bertipe bila nanti dibutuhkan kueri/laporan lintas koleksi.
--
--  Aditif dan aman dijalankan ulang: create ... if not exists, tanpa ALTER/DROP pada
--  tabel lain. Isinya sensitif (kasus PHK/disiplin, penilaian kinerja), jadi RLS
--  aktif dan hanya role `authenticated` yang boleh baca/tulis — pola yang sama
--  dengan pi_employees.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pi_hr_records (
  tenant_id  uuid        not null,
  kind       text        not null,
  record_id  text        not null,
  data       jsonb       not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid                 default auth.uid(),
  primary key (tenant_id, kind, record_id)
);

create index if not exists pi_hr_records_tenant_idx on public.pi_hr_records (tenant_id);

alter table public.pi_hr_records enable row level security;

drop policy if exists "auth all pi_hr_records" on public.pi_hr_records;
create policy "auth all pi_hr_records" on public.pi_hr_records
  for all to authenticated using (true) with check (true);
