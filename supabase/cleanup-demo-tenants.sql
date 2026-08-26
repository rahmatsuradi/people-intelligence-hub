-- ============================================================
-- People Intelligence — PEMBERSIHAN DATA DEMO LAMA
--
-- Menghapus dua perusahaan demo fiktif beserta seluruh datanya:
--   • Valora TV     — tenant 11111111-1111-4111-8111-111111111111 (754 karyawan sintetis)
--   • Zus Textile   — tenant 22222222-2222-4222-8222-222222222222 (245 karyawan sintetis)
--   • Kandidat / lowongan / aktivitas demo di modul Hire (berawalan C-DEMO-, C-ZUS-, dst.)
--
-- Kenapa perlu dijalankan: kode aplikasi sudah tidak membuat data ini lagi, tetapi baris
-- yang TERLANJUR tersimpan di database masih ada. Khusus tabel Hire (candidates/job_reqs/
-- activities) tidak punya kolom tenant, jadi kandidat demo lama akan tetap ikut tersinkron
-- turun ke aplikasi kalau tidak dihapus dari sini.
--
-- ⚠️ MENGHAPUS DATA SECARA PERMANEN. Jalankan di Supabase SQL Editor project yang benar.
--    Langkah 1 hanya MENGHITUNG (aman). Jalankan langkah 1 dulu, periksa angkanya,
--    baru jalankan langkah 2.
-- ============================================================


-- ── LANGKAH 1 · Hitung dulu (tidak menghapus apa pun) ────────
select 'pi_employees (tenant demo)'        as tabel, count(*) as baris_akan_dihapus
  from pi_employees
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
union all
select 'pi_payroll_runs (tenant demo)', count(*)
  from pi_payroll_runs
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
union all
select 'pi_assessment_sessions (tenant demo)', count(*)
  from pi_assessment_sessions
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')
union all
select 'candidates (demo)', count(*)
  from public.candidates
 where id like 'C-DEMO-%' or id like 'C-ZUS-%'
union all
select 'job_reqs (demo)', count(*)
  from public.job_reqs
 where id like 'REQ-DEMO-%' or id like 'REQ-ZUS-%' or hiring_manager like 'Demo:%'
union all
select 'activities (demo)', count(*)
  from public.activities
 where id like 'A-DEMO%' or id like 'A-ZUS-%';


-- ── LANGKAH 2 · Hapus ────────────────────────────────────────
-- Dibungkus transaksi: kalau salah satu perintah gagal, tidak ada yang terhapus
-- sebagian. Urutannya penting — pi_payroll_lines.employee_id menunjuk pi_employees
-- TANPA on delete cascade, jadi run payroll harus dihapus lebih dulu (lines dan
-- payslips ikut terhapus lewat cascade) sebelum karyawannya bisa dihapus.

begin;

-- Modul Pay -------------------------------------------------
-- Hapus run payroll: pi_payroll_lines cascade dari run, pi_payslips cascade dari line.
delete from pi_payroll_runs
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

-- Hapus karyawan: pi_compensation cascade dari pi_employees.
delete from pi_employees
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

-- Modul Assessment ------------------------------------------
-- Norma bawaan & profil jabatan (tenant_id null) TIDAK disentuh — keduanya lintas-tenant
-- dan masih dipakai perusahaan yang sekarang.
delete from pi_assessment_sessions
 where tenant_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

-- Modul Hire ------------------------------------------------
-- Tabel ini tidak punya kolom tenant, jadi penyaringnya adalah pola id data demo.
delete from public.candidates
 where id like 'C-DEMO-%' or id like 'C-ZUS-%';

delete from public.job_reqs
 where id like 'REQ-DEMO-%' or id like 'REQ-ZUS-%' or hiring_manager like 'Demo:%';

delete from public.activities
 where id like 'A-DEMO%' or id like 'A-ZUS-%';

commit;


-- ── LANGKAH 3 · Bersihkan cache di browser ───────────────────
-- Aplikasi menyimpan salinan lokal per perusahaan di localStorage. Salinan milik dua
-- tenant lama sudah tidak terbaca (kuncinya berganti), tetapi masih memakan ruang.
-- Jalankan di Console browser pada alamat aplikasi untuk membuangnya:
--
--   Object.keys(localStorage)
--     .filter(k => k.startsWith('hi_') || k === 'pi_active_company_id')
--     .forEach(k => localStorage.removeItem(k));
--   location.reload();
