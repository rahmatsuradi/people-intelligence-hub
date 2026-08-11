-- ============================================================
-- People Intelligence — Modul ASSESSMENT: PEMASANGAN SEKALI JALAN
--
-- FILE INI DI-GENERATE dengan menggabungkan tiga file di bawah, apa adanya:
--   assessment-module-schema.sql
--   assessment-module-seed.sql
--   assessment-module-rls.sql
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/bundle-assessment-sql.ts
--
-- Cara pakai: buka Supabase SQL Editor -> New query -> tempel seluruh isi file
-- ini -> Run. Aman dijalankan ulang (create table if not exists, on conflict do
-- update, drop policy if exists) dan tidak meng-ALTER/DROP tabel modul lain.
--
-- Verifikasi setelahnya:
--   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/verify-assessment-setup.ts
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- BAGIAN: assessment-module-schema.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- People Intelligence — Modul ASSESSMENT / PSIKOTES (skema ADITIF)
-- Aman dijalankan di database yang sudah ada (di samping schema.sql
-- dan pay-module-schema.sql).
-- HANYA membuat tabel BARU. TIDAK meng-ALTER / DROP tabel milik modul lain.
-- Semua tabel diberi awalan `pi_assessment_` -> nol tabrakan.
-- `if not exists` -> aman dijalankan ulang.
-- Urutan pakai: assessment-module-schema.sql
--            -> assessment-module-seed.sql
--            -> assessment-module-rls.sql
-- ============================================================

create extension if not exists pgcrypto;

-- ── Kelompok norma (DATA ber-versi, seperti pi_statutory_config) ──
-- Norma TIDAK pernah ditimpa. Norma baru = baris baru dengan effective_date
-- baru, supaya laporan lama tetap bisa dihitung ulang dengan angka yang sama.
create table if not exists pi_assessment_norms (
  id             text primary key,                    -- mis. 'NORM-DEMO-UMUM-2026'
  tenant_id      uuid,                                -- null = norma bawaan lintas-tenant
  label          text not null,
  provenance     text not null default 'synthetic_demo', -- 'synthetic_demo' | 'local_sample'
  sample_size    int  not null default 0,
  effective_date date not null,
  entries        jsonb not null,                      -- [{ scaleId, mean, sd }]
  notes          text,
  created_at     timestamptz not null default now()
);

-- ── Profil jabatan (kebutuhan posisi terhadap skala) ─────────
-- Inilah "disiapkan sesuai posisi dan permintaan perusahaan": tiap perusahaan
-- boleh menyunting rentang target & ambang kritisnya sendiri.
create table if not exists pi_assessment_profiles (
  id                  text primary key,               -- mis. 'JP-SUPERVISOR'
  tenant_id           uuid,                           -- null = template bawaan
  name                text not null,
  family              text not null default 'umum',
  level               text not null default 'staff',  -- staff|supervisor|manager|specialist
  description         text default '',
  requirements        jsonb not null,                 -- [{ scaleId, targetStenMin, targetStenMax, weight, direction, criticalMinSten, rationale }]
  recommend_threshold int  not null default 75,
  consider_threshold  int  not null default 60,
  source              text not null default 'template', -- 'template' | 'custom'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Sesi asesmen (satu undangan = satu baris) ────────────────
-- access_token: rahasia URL yang dikirim ke peserta. Route publik /tes/<token>
-- diakses TANPA login, jadi tokennya harus panjang dan acak; dibuat di server.
-- candidate_id: tautan opsional ke modul Hire (on delete set null) — kandidat
-- dihapus dari pipeline tidak boleh menghapus jejak asesmennya.
create table if not exists pi_assessment_sessions (
  id              text primary key,                   -- mis. 'AS-20260811-A1B2'
  tenant_id       uuid not null,
  candidate_id    text references public.candidates(id) on delete set null,
  candidate_name  text not null,
  candidate_email text default '',
  position        text not null default '',
  battery_id      text not null,                      -- 'BAT-FULL' | 'BAT-SCREEN' | 'BAT-LEAD'
  profile_id      text,                               -- profil jabatan target (nullable)
  norm_id         text,                               -- norma yang dipakai saat menskor
  access_token    text not null unique,
  status          text not null default 'invited',    -- invited|in_progress|completed|expired
  invited_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz,
  responses       jsonb not null default '{}',        -- { itemId: nilai }
  timings         jsonb not null default '[]',        -- [{ sectionId, startedAt, submittedAt, elapsedSec }]
  -- Laporan disimpan sebagai SNAPSHOT, bukan dihitung ulang setiap dibuka.
  -- Bank item, norma, dan profil jabatan bisa berubah; laporan yang sudah
  -- diterbitkan tidak boleh ikut berubah sendiri di kemudian hari.
  report          jsonb,
  created_at      timestamptz not null default now()
);

-- ── Index bantu ──────────────────────────────────────────────
create index if not exists idx_pi_assess_sessions_tenant on pi_assessment_sessions(tenant_id);
create index if not exists idx_pi_assess_sessions_status on pi_assessment_sessions(status);
create index if not exists idx_pi_assess_sessions_cand   on pi_assessment_sessions(candidate_id);
create index if not exists idx_pi_assess_norms_eff       on pi_assessment_norms(effective_date desc);

-- CATATAN RLS: `create table` di project ini mengaktifkan RLS otomatis TANPA
-- policy apa pun -> bahkan pengguna authenticated mendapat 0 baris.
-- Jalankan supabase/assessment-module-rls.sql setelah file ini.


-- ════════════════════════════════════════════════════════════
-- BAGIAN: assessment-module-seed.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- People Intelligence — Modul ASSESSMENT: SEED (norma + profil jabatan)
--
-- FILE INI DI-GENERATE. Jangan disunting langsung.
-- Sumber: src/lib/assessment/norms.ts dan src/lib/assessment/job-profiles.ts
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/generate-assessment-seed.ts
--
-- Aman dijalankan ulang: memakai on conflict do update, jadi menjalankan
-- kembali file ini menyelaraskan baris yang ada, bukan menggandakannya.
--
-- ── PERINGATAN NORMA ────────────────────────────────────────
-- Baris norma di bawah ber-provenance 'synthetic_demo' dengan sample_size = 0.
-- Angka mean/SD-nya TIDAK berasal dari sampel pekerja Indonesia mana pun; itu
-- nilai tengah yang masuk akal supaya demo bisa berjalan. Selama norma masih
-- sintetis, persentil yang dihasilkan sah untuk MEMBANDINGKAN kandidat dalam
-- satu lowongan (semua diukur dengan penggaris yang sama), dan TIDAK sah
-- sebagai ambang kelulusan absolut.
-- Norma nyata dibangun setelah terkumpul >= 100 peserta pada populasi yang
-- sebanding, lalu dimasukkan sebagai BARIS BARU dengan effective_date baru —
-- bukan menimpa baris ini (laporan lama harus tetap reproducible).
--
-- ── CATATAN PROFIL JABATAN ──────────────────────────────────
-- Profil di bawah adalah TEMPLATE hasil penalaran praktik, bukan hasil job
-- analysis pada jabatan di perusahaan tertentu, dan bukan hasil studi validasi
-- terhadap data kinerja. tenant_id sengaja NULL = template bawaan lintas-tenant.
-- Perusahaan menyalinnya menjadi profil custom (source='custom', tenant_id
-- terisi) lewat halaman Profil Jabatan bila ingin menyesuaikan rentang target.
-- ============================================================

-- ── Kelompok norma ──────────────────────────────────────────

insert into pi_assessment_norms (id, tenant_id, label, provenance, sample_size, effective_date, entries, notes)
values (
  'NORM-DEMO-UMUM-2026',
  null,
  'Norma demo — umum (sintetis)',
  'synthetic_demo',
  0,
  '2026-01-01',
  '[{"scaleId":"O","mean":34,"sd":5.5},{"scaleId":"C","mean":36,"sd":5.5},{"scaleId":"E","mean":32,"sd":6},{"scaleId":"A","mean":37,"sd":5},{"scaleId":"N","mean":28,"sd":6.5},{"scaleId":"COG_NUM","mean":6,"sd":2},{"scaleId":"COG_VER","mean":6.5,"sd":1.9},{"scaleId":"COG_LOG","mean":6,"sd":2.1},{"scaleId":"COG_TOTAL","mean":18.5,"sd":5},{"scaleId":"SJT_LEAD","mean":8,"sd":1.5},{"scaleId":"SJT_INTEG","mean":8.4,"sd":1.4},{"scaleId":"SJT_COLLAB","mean":8,"sd":1.5},{"scaleId":"SJT_PROBSOLV","mean":8,"sd":1.6},{"scaleId":"SJT_ADAPT","mean":8,"sd":1.6},{"scaleId":"SJT_SAFETY","mean":8.4,"sd":1.5},{"scaleId":"SJT_TOTAL","mean":48.8,"sd":6}]'::jsonb,
  'Nilai sintetis untuk keperluan demo/portofolio. Bukan hasil pengambilan sampel. Jangan dipakai sebagai dasar keputusan penerimaan.'
)
on conflict (id) do update set
  label          = excluded.label,
  provenance     = excluded.provenance,
  sample_size    = excluded.sample_size,
  effective_date = excluded.effective_date,
  entries        = excluded.entries,
  notes          = excluded.notes;

-- ── Profil jabatan (template bawaan) ────────────────────────

-- Operator / Staf Produksi (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-OPERATOR',
  null,
  'Operator / Staf Produksi',
  'produksi',
  'staff',
  'Pekerjaan berulang dengan standar mutu dan keselamatan yang ketat. Yang menentukan bukan kecepatan berpikir abstrak, melainkan konsistensi mengikuti prosedur dan ketahanan terhadap rutinitas.',
  '[{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":4,"rationale":"Kepatuhan pada prosedur dan konsistensi mutu adalah inti pekerjaan ini."},{"scaleId":"SJT_SAFETY","targetStenMin":6,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Pelanggaran prosedur keselamatan di lantai produksi berisiko cedera; ini ambang kritis, bukan preferensi."},{"scaleId":"N","targetStenMin":1,"targetStenMax":6,"weight":2,"direction":"lower","criticalMinSten":null,"rationale":"Ketahanan terhadap tekanan target dan shift; reaktivitas tinggi mempercepat kelelahan."},{"scaleId":"COG_TOTAL","targetStenMin":4,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":3,"rationale":"Cukup untuk memahami instruksi kerja dan membaca alat ukur sederhana."},{"scaleId":"A","targetStenMin":5,"targetStenMax":9,"weight":1,"direction":"midrange","criticalMinSten":null,"rationale":"Bekerja dalam regu; terlalu rendah menyulitkan koordinasi shift."}]'::jsonb,
  75,
  60,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- QC Inspector / Quality Control (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-QC',
  null,
  'QC Inspector / Quality Control',
  'quality',
  'staff',
  'Menemukan cacat yang mudah terlewat dan berani menahan barang meskipun ditekan target pengiriman.',
  '[{"scaleId":"C","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Ketelitian pada detail kecil adalah pekerjaannya, bukan pelengkapnya."},{"scaleId":"SJT_INTEG","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":6,"rationale":"Harus tahan menolak meloloskan barang saat ditekan; ini ambang kritis."},{"scaleId":"A","targetStenMin":3,"targetStenMax":7,"weight":2,"direction":"midrange","criticalMinSten":null,"rationale":"Terlalu ramah menyulitkan menolak barang rekan sendiri; terlalu rendah memicu konflik dengan produksi."},{"scaleId":"COG_NUM","targetStenMin":5,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Membaca sampling plan, toleransi ukuran, dan persentase reject."},{"scaleId":"SJT_SAFETY","targetStenMin":6,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Bekerja di area produksi dengan aturan K3 yang sama."}]'::jsonb,
  78,
  62,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Supervisor / Leader Lini (supervisor)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-SUPERVISOR',
  null,
  'Supervisor / Leader Lini',
  'penyeliaan',
  'supervisor',
  'Menjembatani target manajemen dan kondisi nyata di lapangan. Sebagian besar kegagalan supervisor bukan soal teknis, melainkan cara menangani orang dan keputusan cepat.',
  '[{"scaleId":"SJT_LEAD","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Menegur, menyepakati target, dan menjaga akuntabilitas tanpa merusak hubungan kerja."},{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":4,"rationale":"Menjaga jadwal, catatan shift, dan tindak lanjut yang tidak boleh terlewat."},{"scaleId":"E","targetStenMin":5,"targetStenMax":9,"weight":2,"direction":"midrange","criticalMinSten":null,"rationale":"Perlu nyaman berbicara di depan regu; sangat tinggi bisa mengurangi porsi mendengarkan."},{"scaleId":"N","targetStenMin":1,"targetStenMax":5,"weight":2,"direction":"lower","criticalMinSten":1,"rationale":"Emosi supervisor menular ke seluruh shift."},{"scaleId":"SJT_COLLAB","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":null,"rationale":"Sebagian besar hambatan produksi diselesaikan lintas bagian."},{"scaleId":"COG_TOTAL","targetStenMin":5,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Membaca data output, reject, dan menghitung penyesuaian beban shift."}]'::jsonb,
  76,
  62,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Staf Administrasi & Keuangan (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-ADMIN',
  null,
  'Staf Administrasi & Keuangan',
  'administrasi',
  'staff',
  'Pekerjaan berbasis dokumen dan angka, di mana satu salah ketik bisa berlanjut jauh ke laporan dan pembayaran.',
  '[{"scaleId":"C","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Ketelitian dan keteraturan dokumen adalah inti pekerjaan."},{"scaleId":"COG_NUM","targetStenMin":6,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":4,"rationale":"Bekerja dengan angka, persentase, dan rekonsiliasi setiap hari."},{"scaleId":"SJT_INTEG","targetStenMin":7,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":6,"rationale":"Akses ke dokumen keuangan menuntut integritas; ini ambang kritis."},{"scaleId":"COG_VER","targetStenMin":5,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Memahami surat, kontrak, dan instruksi tertulis."},{"scaleId":"N","targetStenMin":1,"targetStenMax":6,"weight":1,"direction":"lower","criticalMinSten":null,"rationale":"Tenggat pelaporan yang berulang membutuhkan ketahanan yang stabil."}]'::jsonb,
  78,
  64,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Staf HR / People Operations (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-HR',
  null,
  'Staf HR / People Operations',
  'hr',
  'staff',
  'Menangani data karyawan yang sensitif sekaligus berhadapan langsung dengan orang dalam situasi yang sering emosional.',
  '[{"scaleId":"SJT_INTEG","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":6,"rationale":"Memegang data pribadi karyawan (UU PDP 27/2022) dan informasi upah; ambang kritis."},{"scaleId":"A","targetStenMin":6,"targetStenMax":9,"weight":2,"direction":"midrange","criticalMinSten":null,"rationale":"Harus mudah didekati, tetapi tetap sanggup menyampaikan keputusan yang tidak disukai."},{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Kepatuhan tenggat statutori (BPJS, PPh 21) tidak mentolerir kelalaian."},{"scaleId":"SJT_COLLAB","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":null,"rationale":"Bekerja lintas fungsi hampir setiap hari."},{"scaleId":"COG_VER","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Membaca peraturan, kontrak kerja, dan menyusun komunikasi tertulis."},{"scaleId":"N","targetStenMin":1,"targetStenMax":6,"weight":1,"direction":"lower","criticalMinSten":null,"rationale":"Sering menjadi tempat keluhan; perlu batas emosional yang stabil."}]'::jsonb,
  76,
  62,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Sales / Account Executive (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-SALES',
  null,
  'Sales / Account Executive',
  'sales',
  'staff',
  'Pekerjaan dengan penolakan sebagai kejadian harian. Yang membedakan bukan keramahan, melainkan ketahanan setelah ditolak dan kedisiplinan menindaklanjuti.',
  '[{"scaleId":"E","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Memulai kontak dengan orang asing berulang kali setiap hari."},{"scaleId":"N","targetStenMin":1,"targetStenMax":5,"weight":3,"direction":"lower","criticalMinSten":1,"rationale":"Ketahanan terhadap penolakan; ini pembeda utama di peran ini."},{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Tindak lanjut yang tertib menentukan konversi, bukan pertemuan pertamanya."},{"scaleId":"SJT_COLLAB","targetStenMin":5,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Koordinasi dengan tim operasional untuk memenuhi janji ke klien."},{"scaleId":"SJT_INTEG","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":5,"rationale":"Menjanjikan yang tidak bisa dipenuhi merusak akun jangka panjang."}]'::jsonb,
  74,
  60,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Reporter / Produser Berita (staff)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-JURNALIS',
  null,
  'Reporter / Produser Berita',
  'media',
  'staff',
  'Tenggat harian yang tidak bisa digeser, narasumber yang berubah mendadak, dan tanggung jawab akurasi ke publik.',
  '[{"scaleId":"COG_VER","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Memahami dokumen, menyusun narasi akurat, dan menangkap kesimpulan yang tidak didukung fakta."},{"scaleId":"SJT_ADAPT","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Rencana liputan berubah menjelang tayang hampir setiap hari."},{"scaleId":"SJT_INTEG","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":6,"rationale":"Akurasi dan independensi redaksi; ambang kritis, bukan preferensi."},{"scaleId":"O","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":null,"rationale":"Rasa ingin tahu pada topik baru adalah bahan bakar pekerjaan ini."},{"scaleId":"N","targetStenMin":1,"targetStenMax":5,"weight":2,"direction":"lower","criticalMinSten":null,"rationale":"Tekanan tenggat tayang bersifat harian dan berulang."},{"scaleId":"E","targetStenMin":5,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Mendekati narasumber yang belum dikenal."}]'::jsonb,
  76,
  62,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Manajer / Kepala Departemen (manager)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-MANAJER',
  null,
  'Manajer / Kepala Departemen',
  'manajemen',
  'manager',
  'Keputusan yang diambil berdampak pada banyak orang dan sulit dibatalkan. Bobot terbesar ada pada penilaian situasional dan kemampuan menalar, bukan pada sifat tertentu.',
  '[{"scaleId":"COG_TOTAL","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Kompleksitas keputusan naik tajam di level ini; kemampuan menalar adalah prediktor terkuat."},{"scaleId":"SJT_LEAD","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Mengembangkan dan menuntut akuntabilitas orang lain."},{"scaleId":"SJT_PROBSOLV","targetStenMin":7,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":5,"rationale":"Masalah yang naik ke meja manajer adalah yang tidak selesai di bawah."},{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Tindak lanjut dan konsistensi standar di seluruh tim."},{"scaleId":"N","targetStenMin":1,"targetStenMax":5,"weight":2,"direction":"lower","criticalMinSten":1,"rationale":"Stabilitas emosional atasan menentukan rasa aman psikologis tim."},{"scaleId":"O","targetStenMin":5,"targetStenMax":10,"weight":1,"direction":"higher","criticalMinSten":null,"rationale":"Bersedia meninjau ulang cara kerja yang sudah mapan."}]'::jsonb,
  78,
  64,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();

-- Teknisi / Maintenance (specialist)
insert into pi_assessment_profiles (id, tenant_id, name, family, level, description, requirements, recommend_threshold, consider_threshold, source)
values (
  'JP-TEKNISI',
  null,
  'Teknisi / Maintenance',
  'teknik',
  'specialist',
  'Mendiagnosis kerusakan di bawah tekanan waktu henti mesin, dengan risiko keselamatan yang nyata.',
  '[{"scaleId":"COG_LOG","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":5,"rationale":"Diagnosis kerusakan adalah penalaran sebab-akibat yang berlapis."},{"scaleId":"SJT_SAFETY","targetStenMin":7,"targetStenMax":10,"weight":3,"direction":"higher","criticalMinSten":6,"rationale":"Bekerja pada mesin bertenaga; ambang kritis."},{"scaleId":"SJT_PROBSOLV","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Mencari akar masalah, bukan sekadar menghidupkan kembali mesin."},{"scaleId":"C","targetStenMin":6,"targetStenMax":10,"weight":2,"direction":"higher","criticalMinSten":4,"rationale":"Pencatatan riwayat perbaikan dan jadwal preventif."},{"scaleId":"N","targetStenMin":1,"targetStenMax":6,"weight":1,"direction":"lower","criticalMinSten":null,"rationale":"Tekanan saat lini berhenti sangat tinggi."}]'::jsonb,
  76,
  62,
  'template'
)
on conflict (id) do update set
  name                = excluded.name,
  family              = excluded.family,
  level               = excluded.level,
  description         = excluded.description,
  requirements        = excluded.requirements,
  recommend_threshold = excluded.recommend_threshold,
  consider_threshold  = excluded.consider_threshold,
  updated_at          = now();


-- ════════════════════════════════════════════════════════════
-- BAGIAN: assessment-module-rls.sql
-- ════════════════════════════════════════════════════════════

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
