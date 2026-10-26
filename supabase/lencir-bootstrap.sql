-- ============================================================
-- People Intelligence — INSTANCE BARU: PEMASANGAN SEKALI JALAN
--
-- FILE INI DI-GENERATE dengan menggabungkan tiga file di bawah, apa adanya:
--   lencir-structure.sql
--   pay-module-seed.sql
--   assessment-module-seed.sql
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/bundle-lencir-sql.ts
--
-- Cara pakai: Supabase SQL Editor -> New query -> tempel seluruh isi file ini
-- -> Run. Hanya untuk database KOSONG (ada penjaga di awal yang menolak
-- database yang sudah berisi). Seluruhnya satu transaksi: kalau satu langkah
-- gagal, tidak ada yang terpasang setengah-setengah.
--
-- Setelah sukses, hasil terakhir menampilkan lima baris pemeriksaan; kolom
-- "jumlah" harus sama dengan "seharusnya". Lalu jalankan lencir-first-hr.sql.
-- ============================================================

begin;

-- ════════════════════════════════════════════════════════════
-- BAGIAN: lencir-structure.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- People Intelligence — STRUKTUR DATABASE LENGKAP (instance baru, mis. Lencir)
--
-- Diturunkan dari database produksi Rica Rico pada 26 Oktober 2026 dengan
-- membaca katalog Postgres (tabel, kolom, constraint, indeks, fungsi, RLS,
-- policy). HANYA struktur — tanpa satu baris data pun.
--
-- Kenapa file ini ada: supabase/*.sql lainnya adalah sejarah penambahan modul
-- satu per satu, dan dua bagian hanya pernah diterapkan lewat migrasi langsung
-- (pi_interview_questions, candidates.stage_history). Database baru yang
-- dibangun dari file-file lama akan kurang. File ini adalah potret utuh.
--
-- JANGAN disunting tangan untuk mengubah struktur. Perubahan struktur masuk
-- sebagai file/migrasi baru yang aditif (CLAUDE.md §1), lalu potret ini
-- dibuat ulang dari database yang sudah berubah.
--
-- Tidak termasuk (disengaja):
--   * rls_auto_enable() — pemicu bawaan Supabase, sudah ada di tiap proyek baru.
--   * Data apa pun: karyawan, kandidat, survei, outlet. Layar kosong yang jujur.
-- ============================================================

-- Sekali jalan pada database KOSONG. Kalau struktur sudah ada, berhenti dengan
-- pesan jelas alih-alih gagal di tengah jalan.
do $guard$
begin
  if to_regclass('public.pi_employees') is not null
     or to_regclass('public.candidates') is not null then
    raise exception 'Database ini sudah berisi struktur People Intelligence. File ini hanya untuk database kosong — jangan dijalankan ulang.';
  end if;
end
$guard$;

-- ── 1. Tabel ────────────────────────────────────────────────

create table if not exists public.activities (
  id text not null,
  action text not null,
  target text default ''::text,
  "user" text default 'You'::text,
  "time" timestamp with time zone default now(),
  type text not null
);

create table if not exists public.candidates (
  id text not null,
  name text not null,
  email text default ''::text,
  phone text default ''::text,
  stage text not null default 'applied'::text,
  job_req_id text default ''::text,
  department text default ''::text,
  "position" text not null,
  source text default 'Manual'::text,
  notes text default ''::text,
  cv_analysis jsonb,
  interview_results jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  stage_history jsonb not null default '[]'::jsonb
);

create table if not exists public.job_reqs (
  id text not null,
  title text not null,
  department text default ''::text,
  level text default ''::text,
  status text not null default 'draft'::text,
  description text default ''::text,
  requirements text default ''::text,
  salary_min bigint default 0,
  salary_max bigint default 0,
  currency text default 'IDR'::text,
  location text default ''::text,
  target_date text default ''::text,
  headcount integer default 1,
  hiring_manager text default ''::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.pi_assessment_norms (
  id text not null,
  tenant_id uuid,
  label text not null,
  provenance text not null default 'synthetic_demo'::text,
  sample_size integer not null default 0,
  effective_date date not null,
  entries jsonb not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_assessment_profiles (
  id text not null,
  tenant_id uuid,
  name text not null,
  family text not null default 'umum'::text,
  level text not null default 'staff'::text,
  description text default ''::text,
  requirements jsonb not null,
  recommend_threshold integer not null default 75,
  consider_threshold integer not null default 60,
  source text not null default 'template'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_assessment_sessions (
  id text not null,
  tenant_id uuid not null,
  candidate_id text,
  candidate_name text not null,
  candidate_email text default ''::text,
  "position" text not null default ''::text,
  battery_id text not null,
  profile_id text,
  norm_id text,
  access_token text not null,
  status text not null default 'invited'::text,
  invited_at timestamp with time zone not null default now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  expires_at timestamp with time zone,
  responses jsonb not null default '{}'::jsonb,
  timings jsonb not null default '[]'::jsonb,
  report jsonb,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_compensation (
  id uuid not null default gen_random_uuid(),
  employee_id uuid not null,
  upah_pokok numeric(14,2) not null,
  tunjangan_tetap jsonb not null default '[]'::jsonb,
  tunjangan_tidak_tetap jsonb not null default '[]'::jsonb,
  effective_date date not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_employee_profiles (
  employee_id uuid not null,
  work_group text not null,
  outlet_id uuid,
  placement_note text,
  supervisor_name text,
  legal_entity text,
  employment_label text,
  nickname text,
  gender text,
  birth_place text,
  birth_date date,
  religion text,
  blood_type text,
  marital_status text,
  mother_name text,
  phone text,
  email text,
  address text,
  emergency_name text,
  emergency_phone text,
  emergency_relation text,
  education_level text,
  education_institution text,
  education_major text,
  bank_name text,
  ktp_url text,
  kk_url text,
  photo_url text,
  data_flags text[] not null default '{}'::text[],
  source text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_employees (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  full_name text not null,
  nik text,
  npwp text,
  ptkp_status text not null,
  join_date date,
  employment_type text not null default 'PKWTT'::text,
  risk_class text not null default 'II'::text,
  department text,
  bank_account text,
  status text not null default 'active'::text,
  created_at timestamp with time zone not null default now(),
  hired_candidate_id text,
  "position" text
);

create table if not exists public.pi_hr_records (
  tenant_id uuid not null,
  kind text not null,
  record_id text not null,
  data jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.pi_interview_questions (
  id text not null,
  tenant_id uuid not null,
  competency_id text not null,
  competency_name text not null,
  type text not null,
  question text not null,
  strong_answer text not null default ''::text,
  red_flags jsonb not null default '[]'::jsonb,
  cluster text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_outlets (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  area text,
  spv_name text,
  location_type text,
  status text not null default 'active'::text,
  source text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_payroll_lines (
  id uuid not null default gen_random_uuid(),
  run_id uuid not null,
  employee_id uuid not null,
  gross numeric(14,2) not null default 0,
  components jsonb not null default '{}'::jsonb,
  bpjs_employee numeric(14,2) not null default 0,
  bpjs_employer numeric(14,2) not null default 0,
  taxable_base numeric(14,2) not null default 0,
  pph21 numeric(14,2) not null default 0,
  net numeric(14,2) not null default 0,
  created_at timestamp with time zone not null default now(),
  other_deductions jsonb not null default '[]'::jsonb
);

create table if not exists public.pi_payroll_runs (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  period text not null,
  status text not null default 'draft'::text,
  run_date timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_payslips (
  id uuid not null default gen_random_uuid(),
  line_id uuid not null,
  pdf_ref text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_statutory_config (
  id uuid not null default gen_random_uuid(),
  effective_date date not null,
  ptkp jsonb not null,
  ter_tables jsonb not null,
  bpjs_rates jsonb not null,
  progressive jsonb not null,
  umk numeric(14,2),
  created_at timestamp with time zone not null default now(),
  biaya_jabatan jsonb,
  overtime jsonb
);

create table if not exists public.pi_survey_action_raisers (
  action_id uuid not null,
  raised_by text not null
);

create table if not exists public.pi_survey_actions (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  title text not null,
  theme text,
  pic text,
  plan text,
  result text,
  status text not null default 'belum'::text,
  source text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_focus boolean not null default false,
  due_date date,
  told_back text
);

create table if not exists public.pi_survey_campaigns (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  token text not null,
  status text not null default 'open'::text,
  closes_at timestamp with time zone,
  target_count integer,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_survey_conclusions (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  category text not null,
  body text not null,
  source text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_survey_diagnoses (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  ord integer not null default 0,
  title text not null,
  owner text not null,
  spv text,
  metric text,
  metric_label text,
  evidence text[] not null default '{}'::text[],
  causes text[] not null default '{}'::text[],
  solutions jsonb not null default '[]'::jsonb,
  quotes text[] not null default '{}'::text[],
  notes text[] not null default '{}'::text[],
  source text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.pi_survey_insights (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  content jsonb not null,
  model text,
  shared_with_owner boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.pi_survey_responses (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  survey_id uuid not null,
  period date not null,
  submitted_at timestamp with time zone,
  respondent_name text,
  respondent_email text,
  employee_id uuid,
  answers jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamp with time zone not null default now(),
  campaign_id uuid,
  flags text[] not null default '{}'::text[],
  excluded boolean not null default false
);

create table if not exists public.pi_surveys (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  key text not null,
  title text not null,
  description text,
  audience text,
  cadence text,
  questions jsonb not null default '[]'::jsonb,
  headline text[] not null default '{}'::text[],
  source text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  segments text[] not null default '{}'::text[],
  config jsonb not null default '{}'::jsonb
);

create table if not exists public.pi_user_roles (
  user_id uuid not null,
  role text not null,
  display_name text,
  created_at timestamp with time zone not null default now(),
  created_by uuid default auth.uid()
);

-- ── 2. Kunci utama, keunikan, batasan nilai ─────────────────

alter table public.activities add constraint activities_pkey PRIMARY KEY (id);
alter table public.candidates add constraint candidates_pkey PRIMARY KEY (id);
alter table public.job_reqs add constraint job_reqs_pkey PRIMARY KEY (id);
alter table public.pi_assessment_norms add constraint pi_assessment_norms_pkey PRIMARY KEY (id);
alter table public.pi_assessment_profiles add constraint pi_assessment_profiles_pkey PRIMARY KEY (id);
alter table public.pi_assessment_sessions add constraint pi_assessment_sessions_access_token_key UNIQUE (access_token);
alter table public.pi_assessment_sessions add constraint pi_assessment_sessions_pkey PRIMARY KEY (id);
alter table public.pi_compensation add constraint pi_compensation_employee_id_effective_date_key UNIQUE (employee_id, effective_date);
alter table public.pi_compensation add constraint pi_compensation_pkey PRIMARY KEY (id);
alter table public.pi_employee_profiles add constraint pi_employee_profiles_pkey PRIMARY KEY (employee_id);
alter table public.pi_employee_profiles add constraint pi_employee_profiles_work_group_check CHECK ((work_group = ANY (ARRAY['spg'::text, 'spv'::text, 'office'::text, 'produksi'::text, 'santan'::text, 'sopir'::text, 'host_live'::text, 'lainnya'::text])));
alter table public.pi_employees add constraint pi_employees_hired_candidate_id_key UNIQUE (hired_candidate_id);
alter table public.pi_employees add constraint pi_employees_pkey PRIMARY KEY (id);
alter table public.pi_hr_records add constraint pi_hr_records_pkey PRIMARY KEY (tenant_id, kind, record_id);
alter table public.pi_interview_questions add constraint pi_interview_questions_pkey PRIMARY KEY (id);
alter table public.pi_outlets add constraint pi_outlets_location_type_check CHECK ((location_type = ANY (ARRAY['stasiun'::text, 'mall'::text, 'supermarket'::text, 'toko'::text, 'lainnya'::text])));
alter table public.pi_outlets add constraint pi_outlets_pkey PRIMARY KEY (id);
alter table public.pi_outlets add constraint pi_outlets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])));
alter table public.pi_outlets add constraint pi_outlets_tenant_id_name_key UNIQUE (tenant_id, name);
alter table public.pi_payroll_lines add constraint pi_payroll_lines_pkey PRIMARY KEY (id);
alter table public.pi_payroll_lines add constraint pi_payroll_lines_run_id_employee_id_key UNIQUE (run_id, employee_id);
alter table public.pi_payroll_runs add constraint pi_payroll_runs_pkey PRIMARY KEY (id);
alter table public.pi_payroll_runs add constraint pi_payroll_runs_tenant_id_period_key UNIQUE (tenant_id, period);
alter table public.pi_payslips add constraint pi_payslips_pkey PRIMARY KEY (id);
alter table public.pi_statutory_config add constraint pi_statutory_config_pkey PRIMARY KEY (id);
alter table public.pi_survey_action_raisers add constraint pi_survey_action_raisers_pkey PRIMARY KEY (action_id);
alter table public.pi_survey_actions add constraint pi_survey_actions_pkey PRIMARY KEY (id);
alter table public.pi_survey_actions add constraint pi_survey_actions_status_check CHECK ((status = ANY (ARRAY['belum'::text, 'berjalan'::text, 'selesai'::text, 'dibatalkan'::text])));
alter table public.pi_survey_campaigns add constraint pi_survey_campaigns_pkey PRIMARY KEY (id);
alter table public.pi_survey_campaigns add constraint pi_survey_campaigns_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
alter table public.pi_survey_campaigns add constraint pi_survey_campaigns_survey_id_period_key UNIQUE (survey_id, period);
alter table public.pi_survey_campaigns add constraint pi_survey_campaigns_token_key UNIQUE (token);
alter table public.pi_survey_conclusions add constraint pi_survey_conclusions_pkey PRIMARY KEY (id);
alter table public.pi_survey_conclusions add constraint pi_survey_conclusions_survey_id_period_category_key UNIQUE (survey_id, period, category);
alter table public.pi_survey_diagnoses add constraint pi_survey_diagnoses_pkey PRIMARY KEY (id);
alter table public.pi_survey_diagnoses add constraint pi_survey_diagnoses_survey_id_period_ord_key UNIQUE (survey_id, period, ord);
alter table public.pi_survey_insights add constraint pi_survey_insights_pkey PRIMARY KEY (id);
alter table public.pi_survey_insights add constraint pi_survey_insights_survey_id_period_key UNIQUE (survey_id, period);
alter table public.pi_survey_responses add constraint pi_survey_responses_pkey PRIMARY KEY (id);
alter table public.pi_surveys add constraint pi_surveys_cadence_check CHECK ((cadence = ANY (ARRAY['bulanan'::text, 'sekali'::text, 'tidak_tetap'::text])));
alter table public.pi_surveys add constraint pi_surveys_pkey PRIMARY KEY (id);
alter table public.pi_surveys add constraint pi_surveys_tenant_id_key_key UNIQUE (tenant_id, key);
alter table public.pi_user_roles add constraint pi_user_roles_pkey PRIMARY KEY (user_id);
alter table public.pi_user_roles add constraint pi_user_roles_role_check CHECK ((role = ANY (ARRAY['hr'::text, 'owner'::text])));

-- ── 3. Relasi antar-tabel ───────────────────────────────────

alter table public.pi_assessment_sessions add constraint pi_assessment_sessions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
alter table public.pi_compensation add constraint pi_compensation_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES pi_employees(id) ON DELETE CASCADE;
alter table public.pi_employee_profiles add constraint pi_employee_profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES pi_employees(id) ON DELETE CASCADE;
alter table public.pi_employee_profiles add constraint pi_employee_profiles_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES pi_outlets(id) ON DELETE SET NULL;
alter table public.pi_employees add constraint pi_employees_hired_candidate_id_fkey FOREIGN KEY (hired_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
alter table public.pi_payroll_lines add constraint pi_payroll_lines_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES pi_employees(id);
alter table public.pi_payroll_lines add constraint pi_payroll_lines_run_id_fkey FOREIGN KEY (run_id) REFERENCES pi_payroll_runs(id) ON DELETE CASCADE;
alter table public.pi_payslips add constraint pi_payslips_line_id_fkey FOREIGN KEY (line_id) REFERENCES pi_payroll_lines(id) ON DELETE CASCADE;
alter table public.pi_survey_action_raisers add constraint pi_survey_action_raisers_action_id_fkey FOREIGN KEY (action_id) REFERENCES pi_survey_actions(id) ON DELETE CASCADE;
alter table public.pi_survey_actions add constraint pi_survey_actions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_survey_campaigns add constraint pi_survey_campaigns_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_survey_conclusions add constraint pi_survey_conclusions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_survey_diagnoses add constraint pi_survey_diagnoses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_survey_insights add constraint pi_survey_insights_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_survey_responses add constraint pi_survey_responses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES pi_survey_campaigns(id) ON DELETE SET NULL;
alter table public.pi_survey_responses add constraint pi_survey_responses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES pi_employees(id) ON DELETE SET NULL;
alter table public.pi_survey_responses add constraint pi_survey_responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES pi_surveys(id) ON DELETE CASCADE;
alter table public.pi_user_roles add constraint pi_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 4. Indeks ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS activities_time_idx ON public.activities USING btree ("time" DESC);
CREATE INDEX IF NOT EXISTS idx_pi_assess_norms_eff ON public.pi_assessment_norms USING btree (effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_pi_assess_sessions_cand ON public.pi_assessment_sessions USING btree (candidate_id);
CREATE INDEX IF NOT EXISTS idx_pi_assess_sessions_status ON public.pi_assessment_sessions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_pi_assess_sessions_tenant ON public.pi_assessment_sessions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pi_comp_emp ON public.pi_compensation USING btree (employee_id);
CREATE INDEX IF NOT EXISTS pi_employee_profiles_group_idx ON public.pi_employee_profiles USING btree (work_group);
CREATE INDEX IF NOT EXISTS pi_employee_profiles_outlet_idx ON public.pi_employee_profiles USING btree (outlet_id);
CREATE INDEX IF NOT EXISTS idx_pi_emp_tenant ON public.pi_employees USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS pi_hr_records_tenant_idx ON public.pi_hr_records USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pi_iq_cluster ON public.pi_interview_questions USING btree (cluster);
CREATE INDEX IF NOT EXISTS idx_pi_iq_tenant ON public.pi_interview_questions USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pi_lines_run ON public.pi_payroll_lines USING btree (run_id);
CREATE INDEX IF NOT EXISTS pi_survey_actions_survey_idx ON public.pi_survey_actions USING btree (survey_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS pi_survey_responses_dedupe_idx ON public.pi_survey_responses USING btree (survey_id, submitted_at, COALESCE(respondent_email, respondent_name));
CREATE INDEX IF NOT EXISTS pi_survey_responses_survey_period_idx ON public.pi_survey_responses USING btree (survey_id, period);

-- ── 5. Fungsi ───────────────────────────────────────────────
-- Urutan penting: pi_role dulu, lalu pi_survey_visible (memanggil pi_role),
-- baru tiga fungsi ringkasan survei (memanggil pi_survey_visible). Fungsi
-- ber-bahasa SQL diperiksa isinya saat dibuat, jadi yang dipanggil harus ada.

CREATE OR REPLACE FUNCTION public.pi_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.pi_user_roles where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.pi_survey_visible(p_survey_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.pi_role() = 'hr' or (public.pi_role() = 'owner' and exists (
    select 1 from pi_surveys where id = p_survey_id and coalesce(config->>'visibility', 'all') <> 'hr'))
$function$;

CREATE OR REPLACE FUNCTION public.pi_survey_segments(p_survey_id uuid, p_segment text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with s as (select questions from pi_surveys where id = p_survey_id and p_segment = any (segments)),
  qk as (select x->>'key' as key from s, jsonb_array_elements(s.questions) x where coalesce(x->>'type', 'text') <> 'text'),
  r as (
    select id, period, coalesce(nullif(answers->>p_segment, ''), 'Tidak diisi') as grp, answers
    from pi_survey_responses where survey_id = p_survey_id and not excluded and exists (select 1 from s)
  ),
  g as (select period, grp, count(*) as n from r group by 1, 2),
  v as (
    select r.period, r.grp, qk.key, r.id, val
    from r cross join qk
    cross join lateral jsonb_array_elements_text(
      case
        when r.answers->qk.key is null or jsonb_typeof(r.answers->qk.key) = 'null' then '[]'::jsonb
        when jsonb_typeof(r.answers->qk.key) = 'array' then r.answers->qk.key
        else jsonb_build_array(r.answers->qk.key)
      end) as val
  ),
  c as (select period, grp, key, val, count(*) as n from v group by 1, 2, 3, 4),
  a as (select period, grp, key, count(distinct id) as answered from v group by 1, 2, 3),
  q as (
    select c.period, c.grp, c.key, jsonb_build_object('answered', a.answered, 'counts', jsonb_object_agg(c.val, c.n)) as obj
    from c join a using (period, grp, key) group by c.period, c.grp, c.key, a.answered
  ),
  gq as (
    select g.period, g.grp, g.n,
           coalesce((select jsonb_object_agg(q.key, q.obj) from q where q.period = g.period and q.grp = g.grp), '{}'::jsonb) as questions
    from g where g.n >= 3
  ),
  p as (select period, count(*) filter (where n < 3) as hidden from g group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', p.period,
           'hidden', p.hidden,
           'groups', coalesce((select jsonb_object_agg(gq.grp, jsonb_build_object('n', gq.n, 'questions', gq.questions)) from gq where gq.period = p.period), '{}'::jsonb)
         ) order by p.period), '[]'::jsonb)
  from p
  where public.pi_survey_visible(p_survey_id)
$function$;

CREATE OR REPLACE FUNCTION public.pi_survey_summary(p_survey_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with q as (
    select x->>'key' as key
    from pi_surveys s, jsonb_array_elements(s.questions) x
    where s.id = p_survey_id and coalesce(x->>'type', 'text') <> 'text'
  ),
  allr as (
    select id, period, excluded, lower(regexp_replace(coalesce(respondent_name, id::text), '[^a-zA-Z]', '', 'g')) as who
    from pi_survey_responses where survey_id = p_survey_id
  ),
  r as (select id, period, answers from pi_survey_responses where survey_id = p_survey_id and not excluded),
  v as (
    select r.id, r.period, q.key, val
    from r cross join q
    cross join lateral jsonb_array_elements_text(
      case
        when r.answers->q.key is null or jsonb_typeof(r.answers->q.key) = 'null' then '[]'::jsonb
        when jsonb_typeof(r.answers->q.key) = 'array' then r.answers->q.key
        else jsonb_build_array(r.answers->q.key)
      end) as val
  ),
  c as (select period, key, val, count(*) as n from v group by 1, 2, 3),
  a as (select period, key, count(distinct id) as answered from v group by 1, 2),
  pq as (
    select c.period, c.key, jsonb_build_object('answered', a.answered, 'counts', jsonb_object_agg(c.val, c.n)) as obj
    from c join a using (period, key) group by c.period, c.key, a.answered
  ),
  pp as (
    select period, count(*) filter (where not excluded) as n, count(*) as n_total,
           count(*) filter (where excluded) as n_excluded, count(distinct who) as n_people
    from allr group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', pp.period,
           'n', pp.n,
           'n_total', pp.n_total,
           'n_excluded', pp.n_excluded,
           'n_people', pp.n_people,
           'suppressed', pp.n < 3,
           'questions', case when pp.n < 3 then '{}'::jsonb
                             else coalesce((select jsonb_object_agg(pq.key, pq.obj) from pq where pq.period = pp.period), '{}'::jsonb) end
         ) order by pp.period), '[]'::jsonb)
  from pp
  where pp.n > 0 and public.pi_survey_visible(p_survey_id)
$function$;

CREATE OR REPLACE FUNCTION public.pi_survey_themes(p_survey_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with t as (
    select x->>'key' as key, x->>'pattern' as pattern,
           array(select jsonb_array_elements_text(x->'fields')) as fields
    from pi_surveys s, jsonb_array_elements(coalesce(s.config->'themes', '[]'::jsonb)) x
    where s.id = p_survey_id
  ),
  r as (select id, period, answers from pi_survey_responses where survey_id = p_survey_id and not excluded),
  hit as (
    select r.period, t.key, count(distinct r.id) as n
    from r join t on exists (
      select 1 from unnest(t.fields) f where coalesce(r.answers->>f, '') ~* t.pattern
    )
    group by 1, 2
  ),
  pp as (select period, count(*) as n from r group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', pp.period,
           'n', pp.n,
           'themes', case when pp.n < 3 then '{}'::jsonb
                          else coalesce((select jsonb_object_agg(h.key, h.n) from hit h where h.period = pp.period), '{}'::jsonb) end
         ) order by pp.period), '[]'::jsonb)
  from pp
  where public.pi_survey_visible(p_survey_id)
$function$;

-- Hak panggil: pi_role() boleh dipanggil siapa saja (aturan akses memakainya).
-- Empat fungsi survei hanya untuk akun yang sudah login (dan service role) —
-- anon tidak boleh, sama persis dengan database Rica Rico.
revoke execute on function public.pi_survey_visible(uuid) from public, anon;
revoke execute on function public.pi_survey_segments(uuid, text) from public, anon;
revoke execute on function public.pi_survey_summary(uuid) from public, anon;
revoke execute on function public.pi_survey_themes(uuid) from public, anon;
grant execute on function public.pi_survey_visible(uuid) to authenticated, service_role;
grant execute on function public.pi_survey_segments(uuid, text) to authenticated, service_role;
grant execute on function public.pi_survey_summary(uuid) to authenticated, service_role;
grant execute on function public.pi_survey_themes(uuid) to authenticated, service_role;

-- ── 6. Row Level Security ───────────────────────────────────
-- Semua 25 tabel dikunci. Tanpa peran di pi_user_roles, akun melihat 0 baris.
-- Peran pertama (hr) TIDAK dibuat di file ini — diberikan manual, lihat
-- supabase/lencir-first-hr.sql.

alter table public.activities enable row level security;
alter table public.candidates enable row level security;
alter table public.job_reqs enable row level security;
alter table public.pi_assessment_norms enable row level security;
alter table public.pi_assessment_profiles enable row level security;
alter table public.pi_assessment_sessions enable row level security;
alter table public.pi_compensation enable row level security;
alter table public.pi_employee_profiles enable row level security;
alter table public.pi_employees enable row level security;
alter table public.pi_hr_records enable row level security;
alter table public.pi_interview_questions enable row level security;
alter table public.pi_outlets enable row level security;
alter table public.pi_payroll_lines enable row level security;
alter table public.pi_payroll_runs enable row level security;
alter table public.pi_payslips enable row level security;
alter table public.pi_statutory_config enable row level security;
alter table public.pi_survey_action_raisers enable row level security;
alter table public.pi_survey_actions enable row level security;
alter table public.pi_survey_campaigns enable row level security;
alter table public.pi_survey_conclusions enable row level security;
alter table public.pi_survey_diagnoses enable row level security;
alter table public.pi_survey_insights enable row level security;
alter table public.pi_survey_responses enable row level security;
alter table public.pi_surveys enable row level security;
alter table public.pi_user_roles enable row level security;

-- ── 7. Policy ───────────────────────────────────────────────
-- Pola umum: hr dan owner boleh MEMBACA, hanya hr boleh MENULIS. Owner yang
-- mencoba menulis ditolak database (42501), bukan sekadar disembunyikan di UI.

do $policies$
declare
  t text;
begin
  -- baca (hr + owner)
  foreach t in array array[
    'activities','candidates','job_reqs',
    'pi_assessment_norms','pi_assessment_profiles','pi_assessment_sessions',
    'pi_compensation','pi_employee_profiles','pi_employees','pi_hr_records',
    'pi_interview_questions','pi_outlets','pi_payroll_lines','pi_payroll_runs',
    'pi_payslips','pi_statutory_config','pi_survey_campaigns'
  ] loop
    execute format(
      $f$create policy %I on public.%I as permissive for select to authenticated using (pi_role() = any (array['hr','owner']))$f$,
      'pi read ' || t, t);
  end loop;

  -- tulis (hanya hr)
  foreach t in array array[
    'activities','candidates','job_reqs',
    'pi_assessment_norms','pi_assessment_profiles','pi_assessment_sessions',
    'pi_compensation','pi_employee_profiles','pi_employees','pi_hr_records',
    'pi_interview_questions','pi_outlets','pi_payroll_lines','pi_payroll_runs',
    'pi_payslips','pi_statutory_config','pi_survey_campaigns',
    'pi_survey_actions','pi_survey_insights','pi_surveys'
  ] loop
    execute format(
      $f$create policy %I on public.%I as permissive for all to authenticated using (pi_role() = 'hr') with check (pi_role() = 'hr')$f$,
      'pi write ' || t, t);
  end loop;

  -- seluruhnya khusus hr (berisi nama responden, penyebab masalah, pengangkat butir)
  foreach t in array array[
    'pi_survey_action_raisers','pi_survey_conclusions','pi_survey_diagnoses','pi_survey_responses'
  ] loop
    execute format(
      $f$create policy %I on public.%I as permissive for all to authenticated using (pi_role() = 'hr') with check (pi_role() = 'hr')$f$,
      'pi hr only ' || t, t);
  end loop;
end
$policies$;

-- Pengecualian: owner hanya melihat survei yang tidak ditandai khusus hr, butir
-- tindak lanjutnya, dan insight yang sudah dibagikan HR.
create policy "pi read pi_surveys" on public.pi_surveys as permissive for select to authenticated
  using ((pi_role() = 'hr') or (pi_role() = 'owner' and coalesce(config ->> 'visibility', 'all') <> 'hr'));

create policy "pi read pi_survey_actions" on public.pi_survey_actions as permissive for select to authenticated
  using ((pi_role() = 'hr') or (pi_role() = 'owner' and exists (
    select 1 from pi_surveys s
    where s.id = pi_survey_actions.survey_id and coalesce(s.config ->> 'visibility', 'all') <> 'hr')));

create policy "pi read pi_survey_insights" on public.pi_survey_insights as permissive for select to authenticated
  using ((pi_role() = 'hr') or (pi_role() = 'owner' and shared_with_owner));

-- Peran: tiap akun boleh melihat perannya sendiri; hanya hr yang mengelola.
create policy "pi hr manage roles" on public.pi_user_roles as permissive for all to authenticated
  using (pi_role() = 'hr') with check (pi_role() = 'hr');
create policy "pi read own role" on public.pi_user_roles as permissive for select to authenticated
  using ((user_id = auth.uid()) or (pi_role() = 'hr'));


-- ════════════════════════════════════════════════════════════
-- BAGIAN: pay-module-seed.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- People Intelligence — Modul PAY · SEED TARIF STATUTORI
--
-- File ini HANYA berisi tarif statutori (PPh 21/TER, BPJS, PTKP, biaya jabatan,
-- lembur, UMK). Tarif = DATA ber-versi per effective_date, bukan kode — perubahan
-- tarif pemerintah dilakukan dengan MENAMBAH baris baru, bukan mengubah baris lama,
-- supaya perhitungan periode lampau tetap memakai tarif yang berlaku saat itu.
--
-- TIDAK ADA data karyawan di sini. Versi sebelumnya menyertakan 13 karyawan fiktif
-- (nama pesepakbola, NIK/NPWP karangan) sebagai data demo; semuanya dihapus karena
-- instance ini dipakai untuk perusahaan sungguhan. Karyawan diisi lewat aplikasi
-- (/pay/onboarding atau /pay/employees), bukan lewat file yang ikut masuk repo —
-- data karyawan asli tidak boleh berada di dalam repo (CLAUDE.md §6).
--
-- Jalankan SETELAH pay-module-schema.sql. Aman dijalankan ulang.
-- ============================================================

-- ── Konfigurasi statutori (TARIF TERVERIFIKASI — PP 58/2023) ──
-- Diverifikasi 2026-07-21 dari 2 sumber independen (klikpajak.id, hrdpintar.com),
-- disilangkan satu sama lain + terhadap kutipan resmi DJP (pajak.go.id) soal batas
-- teratas tiap kategori (A: >Rp1,4M, B: >Rp1,405M, C: >Rp1,419M — semua 34%) dan
-- jumlah bracket kategori A (44 baris). Satu baris di tabel C pada salah satu sumber
-- tidak monoton (turun dari 2% ke 1,75%) dan dibuang, diganti versi yang konsisten.
-- BPJS/PTKP/UMK di bawah adalah pengetahuan umum yang stabil sejak lama; PPh21/TER
-- adalah bagian paling berisiko salah sehingga ini yang diverifikasi via web.
-- biaya_jabatan: diverifikasi 2026-07-21 dari PMK 250/PMK.03/2008 (jdih.kemenkeu.go.id) +
-- dikonfirmasi DJP (pajak.go.id/en/node/61792) + Gadjian. TIDAK diatur/diubah oleh PP 58/2023
-- atau PMK 168/2023 -- kedua aturan itu hanya mengubah metode pemotongan bulanan (TER), bukan
-- komponen pengurang bruto ini. rate 5%, cap Rp500rb/bulan atau Rp6jt/tahun (kerja penuh setahun).
-- overtime: diverifikasi 2026-07-21 dari PP 35/2021 Pasal 31-32 (jdih.kemenkeu.go.id) --
-- MENGGANTIKAN Kepmenaker 102/2004 yang sudah dicabut Permenaker 23/2021. Batas lembur
-- harian naik 3->4 jam vs aturan lama, tier 4x dapat tambahan 1 jam (6 hari: jam 9-11,
-- bukan 9-10; 5 hari: jam 10-12, bukan 10-11) -- banyak blog HR masih pakai tabel lama, JANGAN.
insert into pi_statutory_config (id, effective_date, ptkp, ter_tables, bpjs_rates, progressive, biaya_jabatan, overtime, umk) values
 ('c0000000-0000-4000-8000-000000000001',
  '2026-01-01',
  '{"base":54000000,"married":4500000,"dependent":4500000,"max_dependents":3}',
  -- Kategori TER dipetakan dari status PTKP:
  --   A = TK/0,TK/1,K/0 | B = TK/2,TK/3,K/1,K/2 | C = K/3
  '{"A":[{"upTo":5400000,"rate":0},{"upTo":5650000,"rate":0.0025},{"upTo":5950000,"rate":0.005},{"upTo":6300000,"rate":0.0075},{"upTo":6750000,"rate":0.01},{"upTo":7500000,"rate":0.0125},{"upTo":8550000,"rate":0.015},{"upTo":9650000,"rate":0.0175},{"upTo":10050000,"rate":0.02},{"upTo":10350000,"rate":0.0225},{"upTo":10700000,"rate":0.025},{"upTo":11050000,"rate":0.03},{"upTo":11600000,"rate":0.035},{"upTo":12500000,"rate":0.04},{"upTo":13750000,"rate":0.05},{"upTo":15100000,"rate":0.06},{"upTo":16950000,"rate":0.07},{"upTo":19750000,"rate":0.08},{"upTo":24150000,"rate":0.09},{"upTo":26450000,"rate":0.1},{"upTo":28000000,"rate":0.11},{"upTo":30050000,"rate":0.12},{"upTo":32400000,"rate":0.13},{"upTo":35400000,"rate":0.14},{"upTo":39100000,"rate":0.15},{"upTo":43850000,"rate":0.16},{"upTo":47800000,"rate":0.17},{"upTo":51400000,"rate":0.18},{"upTo":56300000,"rate":0.19},{"upTo":62200000,"rate":0.2},{"upTo":68600000,"rate":0.21},{"upTo":77500000,"rate":0.22},{"upTo":89000000,"rate":0.23},{"upTo":103000000,"rate":0.24},{"upTo":125000000,"rate":0.25},{"upTo":157000000,"rate":0.26},{"upTo":206000000,"rate":0.27},{"upTo":337000000,"rate":0.28},{"upTo":454000000,"rate":0.29},{"upTo":550000000,"rate":0.3},{"upTo":695000000,"rate":0.31},{"upTo":910000000,"rate":0.32},{"upTo":1400000000,"rate":0.33},{"upTo":null,"rate":0.34}],"B":[{"upTo":6200000,"rate":0},{"upTo":6500000,"rate":0.0025},{"upTo":6850000,"rate":0.005},{"upTo":7300000,"rate":0.0075},{"upTo":9200000,"rate":0.01},{"upTo":10750000,"rate":0.015},{"upTo":11250000,"rate":0.02},{"upTo":11600000,"rate":0.025},{"upTo":12600000,"rate":0.03},{"upTo":13600000,"rate":0.04},{"upTo":14950000,"rate":0.05},{"upTo":16400000,"rate":0.06},{"upTo":18450000,"rate":0.07},{"upTo":21850000,"rate":0.08},{"upTo":26000000,"rate":0.09},{"upTo":27700000,"rate":0.1},{"upTo":29350000,"rate":0.11},{"upTo":31450000,"rate":0.12},{"upTo":33950000,"rate":0.13},{"upTo":37100000,"rate":0.14},{"upTo":41100000,"rate":0.15},{"upTo":45800000,"rate":0.16},{"upTo":49500000,"rate":0.17},{"upTo":53800000,"rate":0.18},{"upTo":58500000,"rate":0.19},{"upTo":64000000,"rate":0.2},{"upTo":71000000,"rate":0.21},{"upTo":80000000,"rate":0.22},{"upTo":93000000,"rate":0.23},{"upTo":109000000,"rate":0.24},{"upTo":129000000,"rate":0.25},{"upTo":163000000,"rate":0.26},{"upTo":211000000,"rate":0.27},{"upTo":374000000,"rate":0.28},{"upTo":459000000,"rate":0.29},{"upTo":555000000,"rate":0.3},{"upTo":704000000,"rate":0.31},{"upTo":957000000,"rate":0.32},{"upTo":1405000000,"rate":0.33},{"upTo":null,"rate":0.34}],"C":[{"upTo":6600000,"rate":0},{"upTo":6950000,"rate":0.0025},{"upTo":7350000,"rate":0.005},{"upTo":7800000,"rate":0.0075},{"upTo":8850000,"rate":0.01},{"upTo":9800000,"rate":0.0125},{"upTo":10950000,"rate":0.015},{"upTo":11200000,"rate":0.0175},{"upTo":12050000,"rate":0.02},{"upTo":12950000,"rate":0.03},{"upTo":14150000,"rate":0.04},{"upTo":15550000,"rate":0.05},{"upTo":17050000,"rate":0.06},{"upTo":19500000,"rate":0.07},{"upTo":22700000,"rate":0.08},{"upTo":26600000,"rate":0.09},{"upTo":28100000,"rate":0.1},{"upTo":30100000,"rate":0.11},{"upTo":32600000,"rate":0.12},{"upTo":35400000,"rate":0.13},{"upTo":38900000,"rate":0.14},{"upTo":43000000,"rate":0.15},{"upTo":47400000,"rate":0.16},{"upTo":51200000,"rate":0.17},{"upTo":55800000,"rate":0.18},{"upTo":60400000,"rate":0.19},{"upTo":66700000,"rate":0.2},{"upTo":74500000,"rate":0.21},{"upTo":83200000,"rate":0.22},{"upTo":95600000,"rate":0.23},{"upTo":110000000,"rate":0.24},{"upTo":134000000,"rate":0.25},{"upTo":169000000,"rate":0.26},{"upTo":221000000,"rate":0.27},{"upTo":390000000,"rate":0.28},{"upTo":463000000,"rate":0.29},{"upTo":561000000,"rate":0.3},{"upTo":709000000,"rate":0.31},{"upTo":965000000,"rate":0.32},{"upTo":1419000000,"rate":0.33},{"upTo":null,"rate":0.34}]}',
  '{"jht":{"employer":0.037,"employee":0.02},"jp":{"employer":0.02,"employee":0.01,"wage_cap":10547400},"jkk":{"I":0.0024,"II":0.0054,"III":0.0089,"IV":0.0127,"V":0.0174},"jkm":{"employer":0.003},"kesehatan":{"employer":0.04,"employee":0.01,"wage_cap":12000000}}',
  '[{"upTo":60000000,"rate":0.05},{"upTo":250000000,"rate":0.15},{"upTo":500000000,"rate":0.25},{"upTo":5000000000,"rate":0.30},{"upTo":null,"rate":0.35}]',
  '{"rate":0.05,"monthly_cap":500000,"annual_cap":6000000}',
  '{"hourly_divisor":173,"weekday":[{"maxHour":1,"multiplier":1.5},{"maxHour":null,"multiplier":2}],"restday_6day_week":[{"maxHour":7,"multiplier":2},{"maxHour":8,"multiplier":3},{"maxHour":11,"multiplier":4}],"restday_5day_week":[{"maxHour":8,"multiplier":2},{"maxHour":9,"multiplier":3},{"maxHour":12,"multiplier":4}]}',
  3400000)
on conflict (id) do nothing;

-- ── Config statutori v2 — berlaku sejak MARET 2026 ───────────
-- Diverifikasi 2026-07-23: plafon upah JP BPJS Ketenagakerjaan naik dari Rp10.547.400 ke
-- Rp11.086.300 sejak Maret 2026 (SE BPJS TK No. B/1226/022026, 25 Feb 2026; +5,11% ikut
-- pertumbuhan PDB, disesuaikan tiap Maret). Semua tarif lain DIKONFIRMASI masih terkini
-- (JHT 3,7/2, JP rate 2/1, JKK I-V, JKM 0,3, Kesehatan 4/1 cap 12jt tak berubah sejak 2020).
-- ADITIF: baris Januari (v1) dibiarkan utuh agar periode Jan-Feb 2026 tetap pakai plafon lama
-- yang benar. Engine memilih config per-periode (pickStatutoryConfigForPeriod), bukan yang
-- terbaru. Hanya jp.wage_cap yang diubah -- field lain disalin dari v1 via jsonb_set agar tidak
-- ada duplikasi/drift. VERIFIKASI ULANG plafon JP tiap Maret (mis. Maret 2027).
insert into pi_statutory_config (id, effective_date, ptkp, ter_tables, bpjs_rates, progressive, biaya_jabatan, overtime, umk)
select
  'c0000000-0000-4000-8000-000000000002',
  '2026-03-01',
  ptkp, ter_tables,
  jsonb_set(bpjs_rates, '{jp,wage_cap}', '11086300'::jsonb),
  progressive, biaya_jabatan, overtime, umk
from pi_statutory_config
where id = 'c0000000-0000-4000-8000-000000000001'
on conflict (id) do nothing;


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


commit;

-- ════════════════════════════════════════════════════════════
-- PEMERIKSAAN — kolom "jumlah" harus sama dengan "seharusnya"
-- ════════════════════════════════════════════════════════════
select 'tabel' as item, count(*)::int as jumlah, 25 as seharusnya
  from pg_tables where schemaname = 'public'
union all select 'aturan akses (policy)', count(*)::int, 46
  from pg_policies where schemaname = 'public'
union all select 'tarif statutori', count(*)::int, 2 from pi_statutory_config
union all select 'kelompok pembanding asesmen', count(*)::int, 1 from pi_assessment_norms
union all select 'profil jabatan bawaan', count(*)::int, 9 from pi_assessment_profiles;
