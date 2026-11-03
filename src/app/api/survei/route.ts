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
   kedua terhadap spam isian dari satu sumber. */
const hits = new Map<string, number[]>();
function limited(req: NextRequest, key: string, max: number, windowMs: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
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
  if (limited(request, "get", 60, 60_000)) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
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
  if (limited(request, "post", 8, 10 * 60_000)) return NextResponse.json({ error: "Terlalu banyak kiriman dari perangkat ini. Coba lagi nanti." }, { status: 429 });
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
  let invite: { id: string; response_id: string | null; email: string | null } | null = null;
  if (body.invite && /^[a-z0-9]{20,64}$/.test(body.invite)) {
    const { data: inv } = await supabaseAdmin!.from("pi_survey_invites").select("id, response_id, pi_survey_recipients(email)")
      .eq("token", body.invite).eq("campaign_id", row!.id).maybeSingle();
    const r = inv as unknown as { id: string; response_id: string | null; pi_survey_recipients: { email: string | null } | null } | null;
    if (r) invite = { id: r.id, response_id: r.response_id, email: r.pi_survey_recipients?.email?.trim().toLowerCase() || null };
  }

  const { data: saved, error: insErr } = await supabaseAdmin!.from("pi_survey_responses").insert({
    tenant_id: row!.tenant_id, survey_id: row!.survey_id, campaign_id: row!.id, period: row!.period,
    submitted_at: new Date().toISOString(), respondent_name: name, respondent_email: invite?.email || contact,
    employee_id: hitsByName.length === 1 ? hitsByName[0].id : null, answers, source: INSTANCE.surveySource,
  }).select("id").single();
  if (insErr || !saved) return NextResponse.json({ error: "Jawaban gagal disimpan. Coba kirim ulang." }, { status: 500 });

  // Tandai orang ini sudah mengisi supaya pengingat WA berhenti. Mengisi ulang lewat link yang sama:
  // isian terakhir yang dihitung, isian sebelumnya ditandai ganda (tidak dihapus). Gagal di sini
  // tidak membatalkan jawaban yang sudah tersimpan.
  if (invite) {
    await supabaseAdmin!.from("pi_survey_invites").update({ response_id: saved.id }).eq("id", invite.id);
    if (invite.response_id && invite.response_id !== saved.id) {
      const { data: prev } = await supabaseAdmin!.from("pi_survey_responses").select("flags").eq("id", invite.response_id).maybeSingle();
      if (prev) {
        const flags = [...new Set([...((prev.flags as string[] | null) ?? []), "isian_ganda"])];
        await supabaseAdmin!.from("pi_survey_responses").update({ excluded: true, flags }).eq("id", invite.response_id);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
