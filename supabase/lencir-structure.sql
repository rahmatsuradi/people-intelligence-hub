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
