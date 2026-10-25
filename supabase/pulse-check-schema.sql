-- ═══════════════════════════════════════════════════════════════════════════
--  Pulse Check & Feedback — survei karyawan (Monthly Pulse Check, Feedback SPG)
--
--  Prinsip kerahasiaan: orang menulis keluhan lebih jujur bila tahu namanya
--  tidak sampai ke pemilik. Karena itu:
--    • pi_survey_responses (nama, email, jawaban tertulis) → HANYA HR (baca & tulis).
--    • pi_survey_action_raisers (siapa yang mengangkat tiap action item) → HANYA HR.
--    • pi_surveys, pi_survey_actions → baca HR & owner, tulis HR.
--    • Owner melihat ringkasan lewat pi_survey_summary(): hitungan per pilihan per
--      periode, TANPA nama dan TANPA jawaban tertulis. Periode dengan < 3 jawaban
--      disembunyikan rinciannya — satu-dua jawaban mudah ditebak siapa pengisinya.
--  Policy kolom tidak bisa dipakai di sini: HR dan owner sama-sama role
--  'authenticated', jadi pemisahan dilakukan per TABEL, bukan per kolom.
--
--  Definisi pertanyaan = DATA (kolom questions), bukan kode — survei baru atau
--  pertanyaan yang berubah cukup menambah baris/memperbarui jsonb.
--    questions: [{ key, label, type: choice|multi|scale|text, section?,
--                  options?: [{ value, score? }], min?, max?, higherIsBetter? }]
--  Pertanyaan bertipe 'text' tidak pernah masuk ringkasan.
--
--  Aman dijalankan ulang (create if not exists, drop policy if exists).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pi_surveys (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  key         text not null,              -- 'pulse_bulanan', 'feedback_spg'
  title       text not null,
  description text,
  audience    text,                       -- siapa yang mengisi, mis. "Office, SPV, CS, Host Live"
  cadence     text check (cadence in ('bulanan', 'sekali', 'tidak_tetap')),
  questions   jsonb not null default '[]',
  headline    text[] not null default '{}', -- key pertanyaan yang jadi angka utama
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, key)
);

create table if not exists public.pi_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  survey_id        uuid not null references public.pi_surveys (id) on delete cascade,
  period           date not null,          -- hari pertama bulan YANG DINILAI (bukan bulan mengisi)
  submitted_at     timestamptz,
  respondent_name  text,
  respondent_email text,
  employee_id      uuid references public.pi_employees (id) on delete set null,
  answers          jsonb not null default '{}',  -- { key: nilai | [nilai, …] }
  source           text,                   -- asal baris, untuk audit impor
  created_at       timestamptz not null default now()
);
create index if not exists pi_survey_responses_survey_period_idx on public.pi_survey_responses (survey_id, period);
-- Impor ulang tidak boleh menggandakan jawaban yang sama.
create unique index if not exists pi_survey_responses_dedupe_idx
  on public.pi_survey_responses (survey_id, submitted_at, coalesce(respondent_email, respondent_name));

create table if not exists public.pi_survey_actions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  survey_id   uuid not null references public.pi_surveys (id) on delete cascade,
  period      date not null,               -- periode pulse check yang memunculkan butir ini
  title       text not null,
  theme       text,                        -- tema untuk melacak keluhan berulang (libur, gaji, lembur, …)
  pic         text,                        -- penanggung jawab, mis. "Owner, HR"
  plan        text,                        -- langkah yang direncanakan
  result      text,                        -- hasil / tindak lanjut nyata
  status      text not null default 'belum' check (status in ('belum', 'berjalan', 'selesai', 'dibatalkan')),
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pi_survey_actions_survey_idx on public.pi_survey_actions (survey_id, period);

create table if not exists public.pi_survey_action_raisers (
  action_id  uuid primary key references public.pi_survey_actions (id) on delete cascade,
  raised_by  text not null                 -- nama karyawan yang mengangkat masalah ini (HR saja)
);

-- RLS -----------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pi_surveys', 'pi_survey_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'pi read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'pi write ' || t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.pi_role() in (''hr'', ''owner''))', 'pi read ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.pi_role() = ''hr'') with check (public.pi_role() = ''hr'')', 'pi write ' || t, t);
  end loop;
  foreach t in array array['pi_survey_responses', 'pi_survey_action_raisers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'pi read ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'pi write ' || t, t);
    execute format('drop policy if exists %I on public.%I', 'pi hr only ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (public.pi_role() = ''hr'') with check (public.pi_role() = ''hr'')', 'pi hr only ' || t, t);
  end loop;
end $$;

-- Ringkasan tanpa nama ------------------------------------------------------
-- Hasil: [{ period, n, suppressed, questions: { key: { answered, counts: { nilai: jumlah } } } }]
-- security definer: owner tidak bisa membaca pi_survey_responses, jadi fungsi ini
-- yang membacanya — dan hanya mengeluarkan hitungan. Pertanyaan 'text' dilewati.
-- Ambang 3 sengaja ditulis tetap, bukan parameter: parameter bisa dipanggil owner
-- dengan 0 untuk membuka periode yang seharusnya tersembunyi.
create or replace function public.pi_survey_summary(p_survey_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with q as (
    select x->>'key' as key
    from pi_surveys s, jsonb_array_elements(s.questions) x
    where s.id = p_survey_id and coalesce(x->>'type', 'text') <> 'text'
  ),
  r as (select id, period, answers from pi_survey_responses where survey_id = p_survey_id),
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
  pp as (select period, count(*) as n from r group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', pp.period,
           'n', pp.n,
           'suppressed', pp.n < 3,
           'questions', case when pp.n < 3 then '{}'::jsonb
                             else coalesce((select jsonb_object_agg(pq.key, pq.obj) from pq where pq.period = pp.period), '{}'::jsonb) end
         ) order by pp.period), '[]'::jsonb)
  from pp
  where public.pi_role() in ('hr', 'owner')
$$;

revoke all on function public.pi_survey_summary(uuid) from public, anon;
grant execute on function public.pi_survey_summary(uuid) to authenticated;
