/* ═══════════════════════════════════════════════════════════════════════════
   API Route: /api/assessment/session — PUBLIK, dipakai halaman tes /tes/<token>.

   Kenapa lewat route server dan bukan Supabase langsung dari browser:
   tabel pi_assessment_sessions memuat data pribadi peserta dan RLS-nya
   authenticated-only. Peserta tes TIDAK punya akun. Jadi seluruh akses berjalan
   di server dengan service-role key — pola yang sama dengan /api/apply.

   Yang BOLEH keluar dari endpoint ini ke peserta: teks soal, pilihan jawaban,
   dan jawaban yang sudah ia isi sendiri.
   Yang TIDAK PERNAH keluar: kunci jawaban kognitif, nilai efektivitas opsi SJT,
   domain/keying item kepribadian, skor, sten, dan laporan hasil. Peserta
   menerima umpan balik lewat HR, bukan lewat respons JSON.

   GET  ?token=...  → memuat sesi + soal
   POST { token, sectionId, responses, elapsedSec, final } → menyimpan bagian
        yang selesai; bila final=true, menghitung dan menyimpan laporan.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BATTERY_BY_ID } from "@/lib/assessment/batteries";
import {
  loadJobProfiles,
  loadNormGroups,
  presentedItemIds,
  toPublicBattery,
  type PiAssessmentSessionRow,
} from "@/lib/assessment/assessment-data";
import { getItemById } from "@/lib/assessment/assessment-data";
import { pickNormGroupForDate } from "@/lib/assessment/norms";
import { buildAssessmentReport } from "@/lib/assessment/report";
import type { ResponseMap, SectionTiming } from "@/lib/assessment/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/* ─── Throttle sederhana per-IP ───
   Endpoint ini publik dan menerima token dari URL. Pembatasan ini menahan
   penebakan token secara brute force dari satu sumber. Token 165-bit sendiri
   sudah membuat penebakan tidak realistis; ini lapisan kedua, bukan yang utama. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return false;
}

const notConfigured = () =>
  NextResponse.json(
    { success: false, error: "Layanan asesmen belum dikonfigurasi. Hubungi tim rekrutmen." },
    { status: 503 },
  );

/** Pesan yang SAMA untuk token tidak ditemukan dan token kedaluwarsa.
 *  Membedakan keduanya memberi tahu penebak bahwa suatu token pernah ada. */
const invalidToken = () =>
  NextResponse.json(
    { success: false, error: "Tautan tes tidak valid atau sudah tidak berlaku." },
    { status: 404 },
  );

async function findSession(token: string) {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("pi_assessment_sessions")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<PiAssessmentSessionRow>();
  return data ?? null;
}

function isExpired(row: PiAssessmentSessionRow): boolean {
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() < Date.now();
}

/* ═══════════════════ GET — memuat sesi + soal ═══════════════════ */

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) return notConfigured();
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json({ success: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }

  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token || token.length < 16) return invalidToken();

  const row = await findSession(token);
  if (!row) return invalidToken();

  const battery = BATTERY_BY_ID[row.battery_id];
  if (!battery) {
    console.error("[assessment] baterai tidak dikenal:", row.battery_id);
    return NextResponse.json({ success: false, error: "Konfigurasi tes tidak lengkap. Hubungi tim rekrutmen." }, { status: 500 });
  }

  if (row.status === "completed") {
    return NextResponse.json({
      success: true,
      status: "completed",
      candidateName: row.candidate_name,
      position: row.position,
      completedAt: row.completed_at,
    });
  }

  if (isExpired(row)) {
    // Ditandai kedaluwarsa sekali saja supaya konsol HR menampilkannya apa adanya.
    if (row.status !== "expired") {
      await supabaseAdmin.from("pi_assessment_sessions").update({ status: "expired" }).eq("id", row.id);
    }
    return invalidToken();
  }

  const doneSections: string[] = (row.timings ?? []).map((t) => t.sectionId);

  return NextResponse.json({
    success: true,
    status: row.status,
    candidateName: row.candidate_name,
    position: row.position,
    battery: toPublicBattery(battery),
    // Jawaban yang sudah tersimpan dikembalikan agar peserta yang terputus
    // koneksinya tidak kehilangan pekerjaannya.
    responses: row.responses ?? {},
    completedSectionIds: doneSections,
    expiresAt: row.expires_at,
  });
}

/* ═══════════════════ POST — menyimpan bagian / menyelesaikan ═══════════════════ */

interface SubmitBody {
  token?: unknown;
  sectionId?: unknown;
  responses?: unknown;
  elapsedSec?: unknown;
  startedAt?: unknown;
  final?: unknown;
}

/** Menyaring jawaban: hanya item yang memang ada di section tsb, dan hanya nilai
 *  yang valid untuk format itemnya. Endpoint publik tidak boleh mempercayai
 *  apa pun dari klien — termasuk id item dan rentang nilainya. */
function sanitizeResponses(raw: unknown, allowedItemIds: string[]): ResponseMap {
  if (!raw || typeof raw !== "object") return {};
  const allowed = new Set(allowedItemIds);
  const out: ResponseMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(id)) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) continue;
    const item = getItemById(id);
    if (!item) continue;
    if (item.format === "likert5") {
      if (value >= 1 && value <= 5) out[id] = value;
    } else if (item.format === "multiple_choice") {
      if (value < item.options.length) out[id] = value;
    } else {
      if (value < item.options.length) out[id] = value;
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return notConfigured();
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json({ success: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ success: false, error: "Permintaan tidak valid." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const sectionId = typeof body.sectionId === "string" ? body.sectionId : "";
  if (!token || !sectionId) return NextResponse.json({ success: false, error: "Permintaan tidak lengkap." }, { status: 400 });

  const row = await findSession(token);
  if (!row) return invalidToken();
  if (row.status === "completed") {
    return NextResponse.json({ success: false, error: "Tes ini sudah diselesaikan." }, { status: 409 });
  }
  if (isExpired(row)) return invalidToken();

  const battery = BATTERY_BY_ID[row.battery_id];
  const section = battery?.sections.find((s) => s.id === sectionId);
  if (!battery || !section) {
    return NextResponse.json({ success: false, error: "Bagian tes tidak dikenali." }, { status: 400 });
  }

  const clean = sanitizeResponses(body.responses, section.itemIds);
  const mergedResponses: ResponseMap = { ...(row.responses ?? {}), ...clean };

  const nowIso = new Date().toISOString();
  const elapsedSec =
    typeof body.elapsedSec === "number" && Number.isFinite(body.elapsedSec) && body.elapsedSec >= 0
      ? Math.round(body.elapsedSec)
      : 0;

  const newTiming: SectionTiming = {
    sectionId,
    startedAt: typeof body.startedAt === "string" ? body.startedAt : nowIso,
    submittedAt: nowIso,
    elapsedSec,
  };
  // Section yang dikirim ulang (mis. koneksi terputus lalu diulang) menimpa
  // catatan waktunya, bukan menambah baris kedua yang akan menggandakan durasi.
  const mergedTimings: SectionTiming[] = [
    ...(row.timings ?? []).filter((t) => t.sectionId !== sectionId),
    newTiming,
  ];

  const isFinal = body.final === true;

  /* ─── Belum final: simpan kemajuan saja ─── */
  if (!isFinal) {
    const { error } = await supabaseAdmin
      .from("pi_assessment_sessions")
      .update({
        responses: mergedResponses,
        timings: mergedTimings,
        status: "in_progress",
        started_at: row.started_at ?? nowIso,
      })
      .eq("id", row.id);

    if (error) {
      console.error("[assessment] gagal menyimpan kemajuan:", error.message);
      return NextResponse.json({ success: false, error: "Gagal menyimpan jawaban. Coba lagi." }, { status: 500 });
    }
    return NextResponse.json({ success: true, saved: true });
  }

  /* ─── Final: hitung laporan di server ─── */
  const [profilesRes, normsRes] = await Promise.all([
    loadJobProfiles(supabaseAdmin, row.tenant_id),
    loadNormGroups(supabaseAdmin),
  ]);

  const normGroup = pickNormGroupForDate(normsRes.data, nowIso, row.norm_id ?? undefined);
  if (!normGroup) {
    // Tanpa norma yang berlaku, skor mentah tidak bisa diterjemahkan. Jawaban
    // tetap disimpan supaya bisa diskor ulang setelah norma dilengkapi —
    // meminta peserta mengerjakan ulang karena kesalahan konfigurasi kami
    // adalah hal yang tidak boleh terjadi.
    await supabaseAdmin
      .from("pi_assessment_sessions")
      .update({ responses: mergedResponses, timings: mergedTimings, status: "in_progress", started_at: row.started_at ?? nowIso })
      .eq("id", row.id);
    console.error("[assessment] tidak ada norma yang berlaku untuk sesi", row.id);
    return NextResponse.json(
      { success: false, error: "Jawaban Anda tersimpan, tetapi hasil belum dapat diproses. Tim rekrutmen akan menindaklanjuti." },
      { status: 500 },
    );
  }

  const profile = row.profile_id ? profilesRes.data.find((p) => p.id === row.profile_id) ?? null : null;

  const report = buildAssessmentReport({
    sessionId: row.id,
    candidateName: row.candidate_name,
    position: row.position,
    batteryId: row.battery_id,
    completedAt: nowIso,
    responses: mergedResponses,
    presentedItemIds: presentedItemIds(row.battery_id),
    timings: mergedTimings,
    normGroup,
    profile,
  });

  const { error } = await supabaseAdmin
    .from("pi_assessment_sessions")
    .update({
      responses: mergedResponses,
      timings: mergedTimings,
      status: "completed",
      started_at: row.started_at ?? nowIso,
      completed_at: nowIso,
      norm_id: normGroup.id,
      report,
    })
    .eq("id", row.id);

  if (error) {
    console.error("[assessment] gagal menyimpan hasil:", error.message);
    return NextResponse.json({ success: false, error: "Gagal menyimpan hasil. Coba lagi." }, { status: 500 });
  }

  await supabaseAdmin.from("activities").insert({
    id: `A-${Date.now().toString(36).toUpperCase()}`,
    action: "Asesmen selesai:",
    target: `${row.candidate_name} — ${row.position || "tanpa posisi"}`,
    user: "Kandidat",
    time: nowIso,
    type: "update",
  });

  // Peserta hanya diberi tahu bahwa jawabannya diterima. Tidak ada skor,
  // sten, verdict, maupun potongan laporan yang dikirim balik.
  return NextResponse.json({ success: true, completed: true });
}
