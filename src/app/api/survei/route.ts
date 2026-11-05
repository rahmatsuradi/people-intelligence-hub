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
import { jabatanGroup, periodLabel, validateSubmission, type SurveyQuestion } from "@/lib/rr/pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Throttle per-IP. Token 190-bit sudah membuat penebakan tidak realistis; ini lapisan
   kedua terhadap spam isian dari satu sumber.

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
  pi_surveys: { title: string; description: string | null; questions: SurveyQuestion[] } | null;
}

async function findCampaign(token: string): Promise<{ row?: CampaignRow; error?: NextResponse }> {
  if (!supabaseAdmin) return { error: NextResponse.json({ error: "Formulir belum bisa dipakai. Hubungi HR." }, { status: 503 }) };
  if (!/^[a-z0-9]{20,64}$/.test(token)) return { error: NextResponse.json({ error: "Link tidak dikenal." }, { status: 404 }) };
  const { data } = await supabaseAdmin.from("pi_survey_campaigns")
    .select("id, tenant_id, survey_id, period, status, closes_at, pi_surveys(title, description, questions)")
    .eq("token", token).maybeSingle();
  const row = data as unknown as CampaignRow | null;
  if (!row?.pi_surveys) return { error: NextResponse.json({ error: "Link tidak dikenal." }, { status: 404 }) };
  if (row.status !== "open" || (row.closes_at && new Date(row.closes_at) < new Date())) {
    return { error: NextResponse.json({ error: "Formulir ini sudah ditutup. Terima kasih." }, { status: 410 }) };
  }
  return { row };
}

/** Hanya bagian definisi yang dibutuhkan untuk menampilkan formulir. */
function publicQuestion(q: SurveyQuestion) {
  return { key: q.key, label: q.label, type: q.type, section: q.section, required: q.required, showIf: q.showIf, min: q.min, max: q.max,
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
  return NextResponse.json({
    title: s.title, description: s.description, period: row!.period, periodLabel: periodLabel(row!.period), closesAt: row!.closes_at,
    questions: s.questions.map(publicQuestion), inviteName,
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
  const contact = (body.contact ?? "").trim().slice(0, 120) || null;
  const { answers, errors } = validateSubmission(row!.pi_surveys!, body.answers ?? {});
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

  // Indeks unik (survei, waktu isi, email/nama) menolak dua isian dengan nama yang sama di milidetik yang sama
  // (klik ganda, kirim ulang jaringan, atau dua orang bernama sama). Coba ulang dengan waktu +1 ms dan
  // jangan menampilkan "gagal" ke peserta.
  const base = Date.now();
  let saved: { id: string } | null = null;
  let insErr: { code?: string } | null = null;
  for (let attempt = 0; attempt < 4 && !saved; attempt++) {
    const res = await supabaseAdmin!.from("pi_survey_responses").insert({
      tenant_id: row!.tenant_id, survey_id: row!.survey_id, campaign_id: row!.id, period: row!.period,
      submitted_at: new Date(base + attempt).toISOString(), respondent_name: name, respondent_email: invite?.email || contact,
      employee_id: hitsByName.length === 1 ? hitsByName[0].id : null, answers, source: INSTANCE.surveySource, flags,
    }).select("id").single();
    saved = (res.data as { id: string } | null) ?? null;
    insErr = res.error as { code?: string } | null;
    if (insErr && insErr.code !== "23505") break;
  }
  if (!saved) return NextResponse.json({ error: "Jawaban gagal disimpan. Coba kirim ulang." }, { status: 500 });

  // Tandai orang ini sudah mengisi supaya pengingat WA berhenti. Isian lain dari ORANG YANG SAMA di
  // siklus ini (mengisi ulang lewat link pribadi, atau sebelumnya lewat link grup dengan email/nama
  // karyawan yang sama) ditandai ganda dan tidak dihitung — isian terakhir yang dipakai, tidak ada
  // yang dihapus. Dicocokkan hanya lewat email undangan atau employee_id, TIDAK lewat nama bebas.
  // Gagal di sini tidak membatalkan jawaban yang sudah tersimpan.
  if (invite) {
    const db = supabaseAdmin!;
    const empId = hitsByName.length === 1 ? (hitsByName[0].id as string) : null;
    await db.from("pi_survey_invites").update({ response_id: saved.id }).eq("id", invite.id);
    const earlier = new Set<string>(invite.response_id && invite.response_id !== saved.id ? [invite.response_id] : []);
    for (const [col, val] of [["respondent_email", invite.email], ["employee_id", empId]] as const) {
      if (!val) continue;
      const { data } = await db.from("pi_survey_responses").select("id").eq("campaign_id", row!.id).eq("excluded", false).neq("id", saved.id).eq(col, val);
      for (const x of (data ?? []) as { id: string }[]) earlier.add(x.id);
    }
    for (const id of earlier) {
      const { data: prev } = await db.from("pi_survey_responses").select("flags").eq("id", id).maybeSingle();
      if (!prev) continue;
      const merged = [...new Set([...((prev.flags as string[] | null) ?? []), "isian_ganda"])];
      await db.from("pi_survey_responses").update({ excluded: true, flags: merged }).eq("id", id);
    }
  }
  return NextResponse.json({ ok: true });
}
