-- ============================================================
-- People Intelligence — PENGINGAT SURVEI LEWAT WHATSAPP (semi-otomatis)
--
-- Web menghitung siapa yang belum mengisi dan kapan gilirannya diingatkan;
-- HR menekan "Kirim WA" (membuka WhatsApp dengan pesan siap kirim). Tidak ada
-- layanan pengirim pihak ketiga — semua pesan dikirim dari WA HR sendiri.
--
--   pi_survey_recipients  daftar orang yang diharapkan mengisi (nama, nomor WA)
--   pi_survey_invites     satu baris per link × orang: token link pribadi, dan
--                         jawaban yang masuk lewat link itu (response_id)
--   pi_survey_wa_log      kapan HR menekan "Kirim WA" (pribadi atau ke grup)
--
-- Semua tabel KHUSUS HR (berisi nomor WA dan siapa yang belum mengisi).
-- Aditif: tidak mengubah tabel lain. Aman dijalankan ulang.
-- ============================================================

create table if not exists public.pi_survey_recipients (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  name        text not null,              -- nama panggilan, dipakai di pesan ("Halo Kia")
  full_name   text,                       -- untuk mencocokkan isian lewat link grup
  email       text,                       -- email yang dipakai jawaban lama, supaya riwayat per orang tidak terpecah
  phone       text,                       -- format 62xxxxxxxxxx
  divisi      text,
  active      boolean not null default true,
  note        text,
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, name)
);
alter table public.pi_survey_recipients add column if not exists email text;

create table if not exists public.pi_survey_invites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  campaign_id   uuid not null references public.pi_survey_campaigns (id) on delete cascade,
  recipient_id  uuid not null references public.pi_survey_recipients (id) on delete cascade,
  token         text not null unique,     -- link pribadi: /survei/<token link>?u=<token ini>
  response_id   uuid references public.pi_survey_responses (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (campaign_id, recipient_id)
);

create table if not exists public.pi_survey_wa_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  campaign_id  uuid not null references public.pi_survey_campaigns (id) on delete cascade,
  invite_id    uuid references public.pi_survey_invites (id) on delete cascade,  -- null = pesan ke grup
  kind         text not null check (kind in ('pribadi', 'grup')),
  sent_at      timestamptz not null default now(),
  sent_by      uuid default auth.uid()
);
create index if not exists pi_survey_wa_log_campaign_idx on public.pi_survey_wa_log (campaign_id, sent_at);

do $$
declare t text;
begin
  foreach t in array array['pi_survey_recipients', 'pi_survey_invites', 'pi_survey_wa_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'pi hr only ' || t, t);
    execute format($f$create policy %I on public.%I as permissive for all to authenticated using (public.pi_role() = 'hr') with check (public.pi_role() = 'hr')$f$, 'pi hr only ' || t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('pi_survey_recipients', 'pi_survey_invites', 'pi_survey_wa_log');
