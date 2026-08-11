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
