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

-- ═══════════════════════════════════════════════════════════════════════════
--  Tahap 2 (25 Oktober 2026): link isi sendiri, insight AI, rincian per kelompok,
--  dan tindak lanjut gaya "fokus + tutup lingkaran". Semua ALTER di bawah hanya
--  menyentuh tabel milik modul ini.
-- ═══════════════════════════════════════════════════════════════════════════

-- Satu link = satu siklus (survei × bulan yang dinilai). Peserta tidak punya akun:
-- formulir publik /survei/<token> menulis lewat service-role di /api/survei.
create table if not exists public.pi_survey_campaigns (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  survey_id    uuid not null references public.pi_surveys (id) on delete cascade,
  period       date not null,
  token        text not null unique,
  status       text not null default 'open' check (status in ('open', 'closed')),
  closes_at    timestamptz,                -- lewat tanggal ini formulir menolak jawaban
  target_count int,                        -- jumlah orang yang diharapkan mengisi (untuk tingkat partisipasi)
  note         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (survey_id, period)
);

alter table public.pi_survey_responses add column if not exists campaign_id uuid references public.pi_survey_campaigns (id) on delete set null;
alter table public.pi_surveys add column if not exists segments text[] not null default '{}';  -- key pengelompok, mis. {tenure} / {spv}

-- Tindak lanjut: maksimal beberapa fokus per siklus, tenggat, dan "sudah disampaikan
-- balik ke karyawan" — survei yang tidak pernah dijawab balik membuat orang berhenti mengisi.
alter table public.pi_survey_actions add column if not exists is_focus boolean not null default false;
alter table public.pi_survey_actions add column if not exists due_date date;
alter table public.pi_survey_actions add column if not exists told_back text;

-- Insight AI per siklus. Dibuat HR; owner hanya melihat yang sudah dibagikan HR.
create table if not exists public.pi_survey_insights (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  survey_id         uuid not null references public.pi_surveys (id) on delete cascade,
  period            date not null,
  content           jsonb not null,
  model             text,
  shared_with_owner boolean not null default false,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (survey_id, period)
);

do $$
begin
  alter table public.pi_survey_campaigns enable row level security;
  drop policy if exists "pi read pi_survey_campaigns" on public.pi_survey_campaigns;
  drop policy if exists "pi write pi_survey_campaigns" on public.pi_survey_campaigns;
  create policy "pi read pi_survey_campaigns" on public.pi_survey_campaigns for select to authenticated using (public.pi_role() in ('hr', 'owner'));
  create policy "pi write pi_survey_campaigns" on public.pi_survey_campaigns for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');

  alter table public.pi_survey_insights enable row level security;
  drop policy if exists "pi read pi_survey_insights" on public.pi_survey_insights;
  drop policy if exists "pi write pi_survey_insights" on public.pi_survey_insights;
  create policy "pi read pi_survey_insights" on public.pi_survey_insights for select to authenticated
    using (public.pi_role() = 'hr' or (public.pi_role() = 'owner' and shared_with_owner));
  create policy "pi write pi_survey_insights" on public.pi_survey_insights for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');
end $$;

-- Rincian per kelompok (mis. lama kerja, SPV) untuk pertanyaan utama.
-- Hasil: [{ period, groups: { nilai_kelompok: { n, questions: { key: { answered, counts } } } }, hidden: jumlah_kelompok_kecil }]
-- Kelompok < 3 orang tidak dikeluarkan sama sekali (hanya dihitung di "hidden"),
-- dengan ambang tetap yang sama seperti pi_survey_summary().
create or replace function public.pi_survey_segments(p_survey_id uuid, p_segment text)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select headline, segments from pi_surveys where id = p_survey_id and p_segment = any (segments)),
  r as (
    select id, period, coalesce(nullif(answers->>p_segment, ''), 'Tidak diisi') as grp, answers
    from pi_survey_responses where survey_id = p_survey_id and exists (select 1 from s)
  ),
  g as (select period, grp, count(*) as n from r group by 1, 2),
  v as (
    select r.period, r.grp, h.key, r.id, val
    from r cross join s cross join lateral unnest(s.headline) as h(key)
    cross join lateral jsonb_array_elements_text(
      case
        when r.answers->h.key is null or jsonb_typeof(r.answers->h.key) = 'null' then '[]'::jsonb
        when jsonb_typeof(r.answers->h.key) = 'array' then r.answers->h.key
        else jsonb_build_array(r.answers->h.key)
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
  where public.pi_role() in ('hr', 'owner')
$$;

revoke all on function public.pi_survey_segments(uuid, text) from public, anon;
grant execute on function public.pi_survey_segments(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Tahap 3 (26 Oktober 2026): Feedback SPG Bulanan, Feedback 360 SPV, dan
--  kelengkapan data Pulse Office (kesimpulan per kategori, jabatan, partisipasi).
-- ═══════════════════════════════════════════════════════════════════════════

-- Tanda kualitas data per jawaban. Jawaban ganda (nama sama, bulan sama) TIDAK
-- dihapus — ditandai dan dikeluarkan dari hitungan (excluded); jawaban terakhir dipakai.
alter table public.pi_survey_responses add column if not exists flags text[] not null default '{}';
alter table public.pi_survey_responses add column if not exists excluded boolean not null default false;

-- Pengaturan per survei (data, bukan kode): visibility 'hr' = owner tidak melihat
-- survei ini sama sekali (mis. 360 antar 7 SPV — terlalu kecil untuk tanpa nama);
-- targets = siapa yang dinilai di tiap blok formulir 360.
alter table public.pi_surveys add column if not exists config jsonb not null default '{}';

-- Kesimpulan per kategori per bulan (pengganti sheet "Conclusion" / Dropdown 2026):
-- Company Benefit, Work Environment, Technical Issue, Personal Issue, atau per divisi.
-- Isinya sering menyebut nama pengangkat, jadi HANYA HR.
create table if not exists public.pi_survey_conclusions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  survey_id  uuid not null references public.pi_surveys (id) on delete cascade,
  period     date not null,
  category   text not null,
  body       text not null,
  source     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, period, category)
);

do $$
begin
  alter table public.pi_survey_conclusions enable row level security;
  drop policy if exists "pi hr only pi_survey_conclusions" on public.pi_survey_conclusions;
  create policy "pi hr only pi_survey_conclusions" on public.pi_survey_conclusions for all to authenticated
    using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr');

  drop policy if exists "pi read pi_surveys" on public.pi_surveys;
  create policy "pi read pi_surveys" on public.pi_surveys for select to authenticated
    using (public.pi_role() = 'hr' or (public.pi_role() = 'owner' and coalesce(config->>'visibility', 'all') <> 'hr'));

  drop policy if exists "pi read pi_survey_actions" on public.pi_survey_actions;
  create policy "pi read pi_survey_actions" on public.pi_survey_actions for select to authenticated
    using (public.pi_role() = 'hr' or (public.pi_role() = 'owner' and exists (
      select 1 from public.pi_surveys s where s.id = survey_id and coalesce(s.config->>'visibility', 'all') <> 'hr')));
end $$;

-- Owner boleh membaca ringkasan hanya untuk survei yang tidak berlabel visibility 'hr'.
create or replace function public.pi_survey_visible(p_survey_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.pi_role() = 'hr' or (public.pi_role() = 'owner' and exists (
    select 1 from pi_surveys where id = p_survey_id and coalesce(config->>'visibility', 'all') <> 'hr'))
$$;

create or replace function public.pi_survey_summary(p_survey_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with q as (
    select x->>'key' as key
    from pi_surveys s, jsonb_array_elements(s.questions) x
    where s.id = p_survey_id and coalesce(x->>'type', 'text') <> 'text'
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
  pp as (select period, count(*) as n from r group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', pp.period,
           'n', pp.n,
           'suppressed', pp.n < 3,
           'questions', case when pp.n < 3 then '{}'::jsonb
                             else coalesce((select jsonb_object_agg(pq.key, pq.obj) from pq where pq.period = pp.period), '{}'::jsonb) end
         ) order by pp.period), '[]'::jsonb)
  from pp
  where public.pi_survey_visible(p_survey_id)
$$;

-- Rincian per kelompok kini untuk SEMUA pertanyaan non-teks (rapor SPV butuh keenam
-- skala, bukan hanya angka utama). Kelompok < 3 orang tetap tidak dikeluarkan.
create or replace function public.pi_survey_segments(p_survey_id uuid, p_segment text)
returns jsonb language sql stable security definer set search_path = public as $$
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
$$;

revoke all on function public.pi_survey_visible(uuid) from public, anon;
grant execute on function public.pi_survey_visible(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  Tahap 4 (26 Oktober 2026): dashboard visual.
--   • pi_survey_summary kini melaporkan juga baris masuk, dikecualikan, dan orang unik per periode —
--     supaya "berapa sebenarnya jawabannya" tidak perlu ditebak dari angka yang dihitung.
--   • pi_survey_themes: jumlah ORANG yang menyebut tiap tema keluhan per bulan. Definisi tema = DATA
--     (pi_surveys.config.themes: key, label, pattern regex PostgreSQL, fields). Owner hanya menerima hitungan.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.pi_survey_summary(p_survey_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
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
$$;

create or replace function public.pi_survey_themes(p_survey_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
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
$$;

revoke all on function public.pi_survey_themes(uuid) from public, anon;
grant execute on function public.pi_survey_themes(uuid) to authenticated;
