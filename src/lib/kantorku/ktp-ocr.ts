/* ═══════════════════════════════════════════════════════════════════════════
   Membaca NIK, nama, dan tanggal lahir dari foto KTP — HANYA dipanggil kode server
   (/api/data-karyawan, /api/kantorku/ktp-check). Model = GROQ_MODEL yang sama dengan
   CV Analyzer (qwen/qwen3.8-27b menerima gambar; docs Groq "Vision", dicek 21 Nov 2026),
   jadi tidak ada kunci/akun baru. Satu gambar ±2.048 token; batas paket gratis 8.000
   token/menit → ±3 KTP per menit. Saat sibuk (429) pembacaan dilewati dan isian ditandai
   `ktp_belum_dicek` — HR membacanya belakangan lewat tombol "Cek KTP".

   Foto KTP berisi data pribadi: dikirim ke Groq hanya untuk dibaca (tanpa disimpan di
   prompt lain), hasilnya hanya NIK/nama/tanggal lahir — alamat dan lainnya tidak diminta.
   ═══════════════════════════════════════════════════════════════════════════ */

import { GROQ_MODEL } from "@/lib/cv-groq";
import { parseKtpReading, type KtpReading } from "./ktp-check";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const PROMPT = `Ini foto kartu identitas. Baca HANYA yang tertulis di kartu, jangan menebak.
Kembalikan JSON: {"adalah_ktp": true|false, "nik": "16 digit atau null", "nama": "nama persis seperti tertulis atau null", "tanggal_lahir": "DD-MM-YYYY atau null"}.
- adalah_ktp = false bila ini bukan KTP Indonesia (mis. KK, SIM, kartu lain, foto orang, kosong).
- nik: angka setelah tulisan NIK, tepat 16 digit. Bila ada digit yang tidak terbaca jelas, isi null.
- nama: setelah tulisan "Nama".
- tanggal_lahir: dari baris "Tempat/Tgl Lahir", bagian tanggalnya saja.`;

export type KtpReadOutcome =
  | { ok: true; reading: KtpReading }
  | { ok: false; reason: "ai_sibuk" | "ai_galat"; retryAfter?: number };

/** Satu kali panggil, tanpa percobaan ulang — formulir tidak boleh menunggu lama. */
export async function readKtpImage(bytes: Buffer, mime: string, opts: { timeoutMs?: number } = {}): Promise<KtpReadOutcome> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_xxx")) return { ok: false, reason: "ai_galat" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } },
          ],
        }],
      }),
    });
    if (res.status === 429) {
      const ra = parseFloat(res.headers.get("retry-after") ?? "");
      return { ok: false, reason: "ai_sibuk", ...(Number.isFinite(ra) ? { retryAfter: ra } : {}) };
    }
    if (!res.ok) {
      console.error("[ktp-ocr] Groq", res.status, (await res.text()).slice(0, 200));
      return { ok: false, reason: res.status >= 500 ? "ai_sibuk" : "ai_galat" };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    let parsed: unknown = null;
    try { parsed = json ? JSON.parse(json) : null; } catch { parsed = null; }
    return { ok: true, reading: parseKtpReading(parsed, new Date().toISOString(), GROQ_MODEL) };
  } catch (e) {
    console.error("[ktp-ocr]", (e as Error).name === "AbortError" ? "timeout" : (e as Error).message);
    return { ok: false, reason: "ai_sibuk" };
  } finally {
    clearTimeout(timer);
  }
}

/** Foto saja; PDF tidak dikirim ke model gambar. */
export const KTP_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
