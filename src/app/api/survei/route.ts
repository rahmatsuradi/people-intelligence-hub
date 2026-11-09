/* ═══════════════════════════════════════════════════════════════════════════
   /api/survei — PUBLIK, dipakai formulir /survei/<token> (pengganti Google Form).

   Pengisi tidak punya akun, jadi semua akses lewat service-role di server — pola
   yang sama dengan /api/apply dan /api/assessment/session. Endpoint ini hanya:
     GET  ?token=…  → judul survei, bulan yang dinilai, dan definisi pertanyaan
     POST { token, name, contact?, answers }  → menyimpan SATU jawaban
   Yang tidak pernah keluar dari sini: jawaban orang lain, ringkasan, atau skor.

   Jawaban divalidasi terhadap definisi pertanyaan (validateSubmission): key asing,
   pilihan di luar opsi, dan jawaban untuk pertanyaan yang tidak tampil dibuang.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { INSTANCE } from "@/lib/instance";
import { isValidContact, jabatanGroup, periodLabel, questionsForPeriod, surveyPrivacyNote, validateSubmission, type SurveyConfig, type SurveyQuestion } from "@/lib/rr/pulse";
import { normalizePhone } from "@/lib/rr/pulse-remind";
import { findDuplicates, isOlderThan, type OtherEntry } from "@/lib/rr/survey-dupes";
import { isSurveySlug, surveyLinkSlug } from "@/lib/rr/survey-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Throttle per-IP: penahan spam isian dari satu sumber. Link pendek bernama (tanpa token) bisa
   ditebak, jadi lapisan ini + isian jebakan bot adalah penahan utama untuk link itu.

   Batasnya SENGAJA longgar: satu kantor/outlet memakai SATU alamat IP publik (wifi bersama,
   atau NAT operator seluler), jadi puluhan karyawan yang mengisi bersamaan tampak sebagai satu
   sumber. Batas lama (8 kiriman / 10 menit) menolak orang ke-9 dari wifi kantor yang sama. */
export const THROTTLE = { get: { max: 600, windowMs: 60_000 }, post: { max: 300, windowMs: 10 * 60_000 } } as const;

const hits = new Map<string, number[]>();
function limited(req: NextRequest, key: keyof typeof THROTTLE): boolean {
  const { max, windowMs } = THROTTLE[key];
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(kk); // jangan menumpuk selamanya
  const recent = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(k, recent); return true; }
  recent.push(now);
  hits.set(k, recent);
  return false;
}

interface CampaignRow {
  id: string; tenant_id: string; survey_id: string; period: string; status: "open" | "closed"; closes_at: string | null;
  pi_surveys: { title: string; description: string | null; questions: SurveyQuestion[]; config: SurveyConfig | null } | null;
}

const CAMPAIGN_COLS = "id, tenant_id, survey_id, period, status, closes_at, pi_surveys(title, description, questions, config)";
const NOT_FOUND = () => ({ error: NextResponse.json({ error: "Link tidak dikenal." }, { status: 404 }) });
const CLOSED = () => ({ error: NextResponse.json({ error: "Formulir ini sudah ditutup. Terima kasih." }, { status: 410 }) });

/** `ref` = token link, atau nama form (link pendek) yang membuka bulan terbaru yang masih terbuka. */
async function findCampaign(ref: string): Promise<{ row?: CampaignRow; error?: NextResponse }> {
  if (!supabaseAdmin) return { error: NextResponse.json({ error: "Formulir belum bisa dipakai. Hubungi HR." }, { status: 503 }) };
  let row: CampaignRow | null = null;
  if (/^[a-z0-9]{20,64}$/.test(ref)) {
    const { data } = await supabaseAdmin.from("pi_survey_campaigns").select(CAMPAIGN_COLS).eq("token", ref).maybeSingle();
    row = data as unknown as CampaignRow | null;
    if (!row?.pi_surveys) return NOT_FOUND();
  } else if (isSurveySlug(ref)) {
    const { data: surveys } = await supabaseAdmin.from("pi_surveys").select("id, key, title, config");
    const ids = ((surveys ?? []) as { id: string; key: string; title: string; config: SurveyConfig }[])
      .filter((s) => !s.config?.privateLink && surveyLinkSlug(s, INSTANCE.shortName) === ref).map((s) => s.id);
    if (!ids.length) return NOT_FOUND();
    const { data } = await supabaseAdmin.from("pi_survey_campaigns").select(CAMPAIGN_COLS).in("survey_id", ids).eq("status", "open").order("period", { ascending: false }).limit(1);
    row = (data?.[0] ?? null) as unknown as CampaignRow | null;
    if (!row?.pi_surveys) return CLOSED();
  } else return NOT_FOUND();
  if (row.status !== "open" || (row.closes_at && new Date(row.closes_at) < new Date())) return CLOSED();
  return { row };
}

/** Hanya bagian definisi yang dibutuhkan untuk menampilkan formulir. */
function publicQuestion(q: SurveyQuestion) {
  return { key: q.key, label: q.label, type: q.type, section: q.section, required: q.required, showIf: q.showIf, min: q.min, max: q.max, minLabel: q.minLabel, maxLabel: q.maxLabel, help: q.help, suggest: q.suggest,
    options: q.options?.map((o) => ({ value: o.value, label: o.label })) };
}

export async function GET(request: NextRequest) {
  if (limited(request, "get")) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  const { row, error } = await findCampaign(request.nextUrl.searchParams.get("token") ?? "");
  if (error) return error;
  const s = row!.pi_surveys!;
  // Link pribadi dari pengingat WA: nama orangnya diisikan ke formulir. Gagal = formulir biasa.
  const u = request.nextUrl.searchParams.get("u") ?? "";
  let inviteName: string | null = null;
  if (/^[a-z0-9]{20,64}$/.test(u)) {
    const { data: inv } = await supabaseAdmin!.from("pi_survey_invites").select("pi_survey_recipients(name, full_name)").eq("token", u).eq("campaign_id", row!.id).maybeSingle();
    const who = (inv as unknown as { pi_survey_recipients: { name: string; full_name: string | null } | null } | null)?.pi_survey_recipients;
    inviteName = who ? (who.full_name || who.name) : null;
  }
  const questions = questionsForPeriod(s.questions, row!.period).filter((q) => !q.hidden);
  // Saran isian outlet: nama outlet aktif saja, bukan data karyawan. Gagal = kolom teks biasa.
  let outlets: string[] = [];
  if (questions.some((q) => q.suggest === "outlets")) {
    const { data } = await supabaseAdmin!.from("pi_outlets").select("name").eq("tenant_id", row!.tenant_id).eq("status", "active").order("name");
    outlets = ((data ?? []) as { name: string }[]).map((o) => o.name);
  }
  return NextResponse.json({
    title: s.title, description: s.description, period: row!.period, periodLabel: periodLabel(row!.period), closesAt: row!.closes_at,
    questions: questions.map(publicQuestion), inviteName, outlets, privacyNote: surveyPrivacyNote(s.config), contactNote: s.config?.contactNote ?? null,
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

export async function POST(request: NextRequest) {
  if (limited(request, "post")) return NextResponse.json({ error: "Terlalu banyak kiriman dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { token?: string; invite?: string; name?: string; contact?: string; answers?: Record<string, unknown>; website?: string };
  if (body.website) return NextResponse.json({ ok: true }); // isian jebakan bot — diam-diam diabaikan
  const { row, error } = await findCampaign(body.token ?? "");
  if (error) return error;

  const name = (body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return NextResponse.json({ error: "Nama lengkap wajib diisi." }, { status: 400 });
  const contact = (body.contact ?? "").trim().slice(0, 120);
  if (!isValidContact(contact)) return NextResponse.json({ error: "Email atau nomor WA wajib diisi." }, { status: 400 });
  const { answers, errors } = validateSubmission({ questions: questionsForPeriod(row!.pi_surveys!.questions, row!.period) }, body.answers ?? {});
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

  // Tautkan ke master karyawan hanya bila namanya cocok tepat ke SATU orang.
  const { data: emps } = await supabaseAdmin!.from("pi_employees").select("id, full_name, position").eq("tenant_id", row!.tenant_id);
  const hitsByName = (emps ?? []).filter((e) => norm(e.full_name as string) === norm(name));
  // Kelompok jabatan (pertanyaan tersembunyi) diisi dari master karyawan, bukan ditanyakan.
  if (row!.pi_surveys!.questions.some((q) => q.key === "jabatan" && q.hidden)) {
    answers.jabatan = jabatanGroup(hitsByName.length === 1 ? (hitsByName[0].position as string | null) : null);
  }

  // Link pribadi dari pengingat WA (pi_survey_invites): orangnya sudah diketahui. Jawaban diberi
  // email yang sama dengan jawaban lamanya supaya riwayat per orang tidak terpecah.
  // Link yang diteruskan ke orang lain: kalau nama yang diketik bukan nama pemilik link, jawaban
  // disimpan sebagai isian biasa (ditandai untuk HR) — tidak boleh menggantikan jawaban pemiliknya.
  let invite: { id: string; response_id: string | null; email: string | null } | null = null;
  const flags: string[] = [];
  if (body.invite && /^[a-z0-9]{20,64}$/.test(body.invite)) {
    const { data: inv } = await supabaseAdmin!.from("pi_survey_invites").select("id, response_id, pi_survey_recipients(email, name, full_name)")
      .eq("token", body.invite).eq("campaign_id", row!.id).maybeSingle();
    const r = inv as unknown as { id: string; response_id: string | null; pi_survey_recipients: { email: string | null; name: string; full_name: string | null } | null } | null;
    const who = r?.pi_survey_recipients;
    if (r && who && [who.full_name, who.name].some((n) => n && norm(n) === norm(name))) {
      invite = { id: r.id, response_id: r.response_id, email: who.email?.trim().toLowerCase() || null };
    } else if (r) flags.push("link_pribadi_nama_beda");
  }

  // Lewat link grup: nomor/email yang cocok ke SATU penerima memakai email penerima itu, supaya riwayat
  // per orang menyambung dengan jawaban lamanya. Tidak cocok = kontak disimpan apa adanya. Hanya
  // identitas riwayat; status "sudah isi" di pengingat WA tetap tidak memakai kontak yang diketik.
  let knownEmail = invite?.email ?? null;
  if (!invite) {
    const { data: recipients } = await supabaseAdmin!.from("pi_survey_recipients").select("email, phone").eq("tenant_id", row!.tenant_id);
    const phone = normalizePhone(contact);
    const hits = ((recipients ?? []) as { email: string | null; phone: string | null }[])
      .filter((r) => (phone && r.phone === phone) || r.email?.trim().toLowerCase() === contact.toLowerCase());
    if (hits.length === 1 && hits[0].email) knownEmail = hits[0].email.trim().toLowerCase();
  }

  // Indeks unik (survei, waktu isi, email/nama) menolak dua isian dengan nama yang sama di milidetik yang sama
  // (klik ganda, kirim ulang jaringan, atau dua orang bernama sama). Coba ulang dengan waktu +1 ms dan
  // jangan menampilkan "gagal" ke peserta.
  const base = Date.now();
  let saved: { id: string } | null = null;
  let savedAt = "";
  let insErr: { code?: string } | null = null;
  for (let attempt = 0; attempt < 4 && !saved; attempt++) {
    savedAt = new Date(base + attempt).toISOString();
    const res = await supabaseAdmin!.from("pi_survey_responses").insert({
      tenant_id: row!.tenant_id, survey_id: row!.survey_id, campaign_id: row!.id, period: row!.period,
      submitted_at: savedAt, respondent_name: name, respondent_email: knownEmail || contact,
      employee_id: hitsByName.length === 1 ? hitsByName[0].id : null, answers, source: INSTANCE.surveySource, flags,
    }).select("id").single();
    saved = (res.data as { id: string } | null) ?? null;
    insErr = res.error as { code?: string } | null;
    if (insErr && insErr.code !== "23505") break;
  }
  if (!saved) return NextResponse.json({ error: "Jawaban gagal disimpan. Coba kirim ulang." }, { status: 500 });

  // Tandai orang ini sudah mengisi supaya pengingat WA berhenti, lalu keluarkan isian lama dari orang
  // yang sama di siklus ini (aturannya di survey-dupes.ts). Isian terakhir yang dipakai, tidak ada yang
  // dihapus. Gagal di sini tidak membatalkan jawaban yang sudah tersimpan.
  const db = supabaseAdmin!;
  type Other = OtherEntry & { employee_id: string | null };
  const me = {
    id: saved.id, name, contact: knownEmail || contact, submittedAt: savedAt,
    store: typeof answers.store === "string" ? answers.store : null,
    rater: typeof answers.rater === "string" ? answers.rater : null,
    // Link pribadi yang dipakai orang lain tidak boleh mengeluarkan isian siapa pun.
    mayReplace: !flags.includes("link_pribadi_nama_beda"),
  };
  const { data: rows, error: othersErr } = await db.from("pi_survey_responses")
    .select("id, respondent_name, respondent_email, employee_id, submitted_at, flags, store:answers->>store, rater:answers->>rater")
    .eq("campaign_id", row!.id).eq("excluded", false).neq("id", saved.id);
  if (othersErr) console.error("Cek isian ganda gagal:", othersErr.message);
  const others = (rows ?? []) as unknown as Other[];
  const { replaced, selfFlags } = findDuplicates(row!.pi_surveys!.config?.kind, me, others);
  const addFlag = new Map(replaced.map((x) => [x.id, x.flag]));
  if (invite) {
    await db.from("pi_survey_invites").update({ response_id: saved.id }).eq("id", invite.id);
    const empId = hitsByName.length === 1 ? (hitsByName[0].id as string) : null;
    let candidates = others;
    if (othersErr) { // cadangan bila kueri gabungan gagal: cara lama, per email undangan / employee_id / isian sebelumnya
      const by = ([["respondent_email", invite.email], ["employee_id", empId], ["id", invite.response_id]] as const).filter(([, v]) => v);
      const res = await Promise.all(by.map(([col, val]) => db.from("pi_survey_responses").select("id, respondent_name, respondent_email, employee_id, submitted_at, flags")
        .eq("campaign_id", row!.id).eq("excluded", false).neq("id", saved.id).eq(col, val!)));
      candidates = res.flatMap((r) => (r.data ?? []) as unknown as Other[]);
    }
    for (const x of candidates) {
      const same = x.id === invite.response_id || (!!invite.email && x.respondent_email === invite.email) || (!!empId && x.employee_id === empId);
      if (same && isOlderThan(x, me) && !addFlag.has(x.id)) addFlag.set(x.id, "isian_ganda");
    }
  }
  for (const [id, flag] of addFlag) {
    // Baca ulang tepat sebelum menulis supaya tanda yang baru ditambahkan kiriman lain tidak tertimpa.
    const { data: prev } = await db.from("pi_survey_responses").select("flags").eq("id", id).maybeSingle();
    if (!prev) continue;
    await db.from("pi_survey_responses").update({ excluded: true, flags: [...new Set([...((prev.flags as string[] | null) ?? []), flag])] }).eq("id", id);
  }
  // Pengisi link pribadi sudah dikenal, jadi nama yang kebetulan sama tidak perlu dicek HR.
  const newFlags = invite ? selfFlags.filter((f) => f !== "cek_isian_ganda") : selfFlags;
  if (newFlags.length) await db.from("pi_survey_responses").update({ flags: [...flags, ...newFlags] }).eq("id", saved.id).eq("excluded", false);
  return NextResponse.json({ ok: true });
}
