/* ═══════════════════════════════════════════════════════════════════════════
   API Route: POST /api/hr-consultant

   Menjalankan percakapan dengan konsultan HR. Berjalan di server karena
   GROQ_API_KEY tidak boleh menyentuh browser.

   Konteks perusahaan dikirim dari klien HANYA bila pengguna mengaktifkan
   sakelarnya, dan disisipkan sebagai pesan sistem kedua. Sengaja tidak dibaca
   dari database di sini: data rekrutmen ada di localStorage per tenant, dan
   membaca ulang di server akan mengambil tenant yang salah. Konsekuensinya
   ditanggung dengan sanitasi ketat di bawah — apa pun dari klien dipangkas
   panjangnya dan tidak pernah dieksekusi sebagai instruksi baru.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { callGroqChat, type ChatMessage } from "@/lib/cv-groq";
import {
  buildContextBlock,
  buildRewriteInstruction,
  findGenericPhrases,
  HR_CONSULTANT_SYSTEM_PROMPT,
  type CompanySnapshot,
} from "@/lib/hr-consultant";

export const runtime = "nodejs";
export const maxDuration = 45;

/* Batas percakapan. Riwayat panjang menghabiskan kuota token per menit tanpa
   menambah kualitas jawaban — konsultan hanya perlu ingat beberapa giliran
   terakhir untuk menjaga benang percakapan. */
const MAX_TURNS = 12;
const MAX_MESSAGE_CHARS = 4000;

/* Throttle per-IP: endpoint ini memakai kuota Groq bersama dengan analisis CV. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
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

interface Body {
  messages?: unknown;
  context?: unknown;
}

/** Menyaring riwayat percakapan dari klien.
 *  Peran 'system' dari klien DIBUANG — kalau tidak, siapa pun bisa menimpa
 *  persona dan batasan konsultan hanya dengan mengubah payload di browser. */
function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || content.trim().length === 0) continue;
    out.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
  }
  return out.slice(-MAX_TURNS);
}

function sanitizeContext(raw: unknown): CompanySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<CompanySnapshot>;
  const str = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    companyName: str(c.companyName) || "Tidak disebutkan",
    industry: str(c.industry, 60) || "Tidak disebutkan",
    headcount: num(c.headcount),
    pipeline: c.pipeline
      ? {
          totalCandidates: num(c.pipeline.totalCandidates) ?? 0,
          activePipeline: num(c.pipeline.activePipeline) ?? 0,
          hired: num(c.pipeline.hired) ?? 0,
          openReqs: num(c.pipeline.openReqs) ?? 0,
          medianTimeToHireDays: num(c.pipeline.medianTimeToHireDays),
          offerAcceptRatePct: num(c.pipeline.offerAcceptRatePct),
          stalledCount: num(c.pipeline.stalledCount) ?? 0,
        }
      : null,
    openPositions: Array.isArray(c.openPositions)
      ? c.openPositions.slice(0, 12).map((r) => ({
          title: str(r?.title),
          department: str(r?.department, 60),
          headcount: num(r?.headcount) ?? 1,
          activePipeline: num(r?.activePipeline) ?? 0,
        }))
      : [],
    topSources: Array.isArray(c.topSources)
      ? c.topSources.slice(0, 8).map((s) => ({
          source: str(s?.source, 60),
          candidates: num(s?.candidates) ?? 0,
          hired: num(s?.hired) ?? 0,
        }))
      : [],
  };
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { success: false, error: "Terlalu banyak pertanyaan berturut-turut. Tunggu sebentar lalu coba lagi." },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Permintaan tidak valid." }, { status: 400 });
  }

  const history = sanitizeMessages(body.messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ success: false, error: "Tidak ada pertanyaan yang dikirim." }, { status: 400 });
  }

  const context = sanitizeContext(body.context);

  const messages: ChatMessage[] = [
    { role: "system", content: HR_CONSULTANT_SYSTEM_PROMPT },
    ...(context ? [{ role: "system" as const, content: buildContextBlock(context) }] : []),
    ...history,
  ];

  try {
    let reply = await callGroqChat(messages, { temperature: 0.4, maxTokens: 2000 });
    let rewritten = false;

    /* Penjaga mutu: larangan di prompt saja tidak cukup menahan model kembali
       ke frasa template. Bila jawaban masih memuat frasa kosong, minta sekali
       perbaikan yang terarah. Sekali saja — percobaan kedua jarang membaik dan
       hanya menggandakan waktu tunggu pengguna. */
    const offending = findGenericPhrases(reply);
    if (offending.length > 0) {
      try {
        const fixed = await callGroqChat(
          [...messages, { role: "assistant", content: reply }, { role: "user", content: buildRewriteInstruction(offending) }],
          { temperature: 0.5, maxTokens: 2000, maxAttempts: 1 },
        );
        // Hanya dipakai bila memang lebih baik. Perbaikan yang justru menambah
        // frasa kosong dibuang, dan jawaban pertama tetap dipakai.
        if (findGenericPhrases(fixed).length < offending.length) {
          reply = fixed;
          rewritten = true;
        }
      } catch {
        // Perbaikan gagal (kuota/jaringan) — jawaban pertama tetap berguna,
        // jadi jangan gagalkan seluruh permintaan hanya karena poles gagal.
      }
    }

    return NextResponse.json({ success: true, reply, usedContext: context !== null, rewritten });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[hr-consultant]", message);
    const isRateLimit = /rate limit|429/i.test(message);
    const notConfigured = /GROQ_API_KEY/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: notConfigured
          ? "Layanan AI belum dikonfigurasi. Kunci API belum dipasang di server."
          : isRateLimit
            ? "Layanan AI sedang sibuk. Coba lagi sekitar satu menit lagi."
            : "Gagal memproses pertanyaan. Coba lagi.",
      },
      { status: isRateLimit ? 429 : notConfigured ? 503 : 500 },
    );
  }
}
