-- ═══════════════════════════════════════════════════════════════════════════
--  People Intelligence — RLS modul Assessment (authenticated saja)
--  Pola identik dengan pay-module-rls.sql dan rls-authenticated.sql.
--
--  PENTING — kenapa anon TIDAK diberi akses apa pun ke pi_assessment_sessions:
--  tabel ini memuat nama, email, jawaban, dan laporan psikologis peserta.
--  Itu data pribadi (UU PDP No. 27/2022), sebagian bersifat sensitif. Kunci
--  anon/publishable ikut terkirim ke browser dan bisa dibaca siapa pun.
--
--  Halaman tes publik /tes/<token> tetap berfungsi karena TIDAK menyentuh
--  Supabase dari browser: seluruh baca/tulisnya lewat route server
--  /api/assessment/session yang memakai service-role key (melewati RLS),
--  dan hanya mengembalikan item soal — tidak pernah kunci jawaban maupun skor.
--  Polanya sama persis dengan alur /apply milik modul Hire.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pi_assessment_norms    enable row level security;
alter table public.pi_assessment_profiles enable row level security;
alter table public.pi_assessment_sessions enable row level security;

drop policy if exists "auth all pi_assessment_norms"    on public.pi_assessment_norms;
drop policy if exists "auth all pi_assessment_profiles" on public.pi_assessment_profiles;
drop policy if exists "auth all pi_assessment_sessions" on public.pi_assessment_sessions;

-- Kalau versi lama file ini pernah membuka akses anon, baris di bawah menutupnya.
-- Aman dijalankan ulang: file ini hanya MEMPERKETAT akses, tidak pernah membuka.
drop policy if exists "anon all pi_assessment_sessions" on public.pi_assessment_sessions;
drop policy if exists "anon read pi_assessment_norms"   on public.pi_assessment_norms;

create policy "auth all pi_assessment_norms"    on public.pi_assessment_norms    for all to authenticated using (true) with check (true);
create policy "auth all pi_assessment_profiles" on public.pi_assessment_profiles for all to authenticated using (true) with check (true);
create policy "auth all pi_assessment_sessions" on public.pi_assessment_sessions for all to authenticated using (true) with check (true);
