/* ═══════════════════════════════════════════════════════════════════════════
   Shared server-side CV helpers — PDF text extraction + Groq analysis call.
   Reused by /api/analyze-cv (dashboard) and /api/apply (public apply flow).

   SERVER ONLY — imports `unpdf` and calls the Groq API with the API key.
   Never import this from a client component.
═══════════════════════════════════════════════════════════════════════════ */

import { extractText, getDocumentProxy } from "unpdf";

export const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/* ─── Validasi: apakah teks readable? ─── */
export function isReadableText(text: string): boolean {
  if (!text || text.length < 50) return false;
  const printable = text.split("").filter((c) => {
    const code = c.charCodeAt(0);
    return (code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9;
  }).length;
  return printable / text.length > 0.7;
}

/* ─── PDF text extraction (unpdf, with UTF-8 fallback) ─── */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8Array);
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = text?.trim() ?? "";
    if (isReadableText(trimmed)) {
      console.log("[cv-groq] unpdf OK, length:", trimmed.length);
      return trimmed;
    }
    throw new Error("unpdf returned unreadable text");
  } catch (err) {
    console.warn("[cv-groq] unpdf failed:", (err as Error).message);
    const fallback = buffer
      .toString("utf-8")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{4,}/g, "\n")
      .trim();

    if (isReadableText(fallback)) {
      console.log("[cv-groq] Fallback UTF-8 OK, length:", fallback.length);
      return fallback;
    }
    console.warn("[cv-groq] Both extraction methods failed");
    return "";
  }
}

/* ─── Groq API call (OpenAI-compatible) ─── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GroqCall {
  content: string;
  remainingTokens: number | null; // x-ratelimit-remaining-tokens (per-minute bucket)
  resetSeconds: number | null;     // x-ratelimit-reset-tokens, normalised to seconds
}

// Groq sends durations like "185ms", "7.66s", "1m26.4s" — normalise to seconds.
export function parseDurationSeconds(s: string | null): number | null {
  if (!s) return null;
  let total = 0;
  const m = s.match(/([\d.]+)m(?![s])/); if (m) total += parseFloat(m[1]) * 60;
  const sec = s.match(/([\d.]+)s/); if (sec) total += parseFloat(sec[1]);
  const ms = s.match(/([\d.]+)ms/); if (ms) total += parseFloat(ms[1]) / 1000;
  if (!m && !sec && !ms) { const n = parseFloat(s); return Number.isFinite(n) ? n : null; }
  return total;
}

/* ─── Percakapan bebas (bukan mode JSON) ───
   callGroq() di bawah mengunci response_format ke JSON karena seluruh alur CV
   memang butuh JSON. Konsultan HR sebaliknya harus menjawab dalam prosa dan
   menjaga konteks beberapa giliran percakapan, jadi ia butuh jalur sendiri —
   memaksakan JSON di sana akan membuat jawabannya kaku dan sulit dibaca. */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callGroqChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; maxAttempts?: number } = {},
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_xxx")) {
    throw new Error("GROQ_API_KEY belum dikonfigurasi di .env.local. Dapatkan key gratis di console.groq.com");
  }

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages,
    // Lebih tinggi dari alur CV (0,2): nasihat manajerial butuh keluwesan
    // merumuskan, bukan ekstraksi data yang harus deterministik.
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2000,
  });

  const MAX_ATTEMPTS = Math.max(1, opts.maxAttempts ?? 3);
  let lastErr = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
    });

    if (response.ok) {
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Groq mengembalikan respons kosong.");
      return text;
    }

    const errorText = await response.text();
    console.error(`[groq-chat] ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}):`, errorText.slice(0, 300));

    if (response.status === 401) throw new Error("GROQ_API_KEY tidak valid.");
    if (response.status === 400) throw new Error(`Permintaan tidak valid: ${errorText.slice(0, 160)}`);

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = parseFloat(response.headers.get("retry-after") ?? "");
      const backoff = Math.min(4000, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 500);
      await sleep(backoff);
      lastErr = `Groq ${response.status}`;
      continue;
    }
    throw new Error(`Groq API error ${response.status}`);
  }

  throw new Error(`Groq gagal setelah ${MAX_ATTEMPTS} percobaan (${lastErr}).`);
}

export async function callGroq(prompt: string, maxAttempts = 3): Promise<GroqCall> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("gsk_xxx")) {
    throw new Error("GROQ_API_KEY belum dikonfigurasi di .env.local. Dapatkan key gratis di console.groq.com");
  }

  console.log(`[cv-groq] Calling Groq ${GROQ_MODEL}, prompt: ${prompt.length} chars`);

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content: "Kamu adalah HR Intelligence Analyst. Selalu kembalikan respons dalam format JSON valid saja, tanpa teks tambahan, tanpa markdown code block.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2600, // enough for the full JSON (≤11 competencies); lower = more CVs fit the 12k tokens/min budget
    response_format: { type: "json_object" }, // Groq JSON mode
  });

  const MAX_ATTEMPTS = Math.max(1, maxAttempts);
  let lastErr = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body,
    });

    if (response.ok) {
      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Groq mengembalikan respons kosong.");
      console.log("[cv-groq] Groq OK, tokens:", data.usage?.prompt_tokens, "+", data.usage?.completion_tokens);
      const remTok = parseFloat(response.headers.get("x-ratelimit-remaining-tokens") ?? "");
      return {
        content: text,
        remainingTokens: Number.isFinite(remTok) ? remTok : null,
        resetSeconds: parseDurationSeconds(response.headers.get("x-ratelimit-reset-tokens")),
      };
    }

    const errorText = await response.text();
    console.error(`[cv-groq] Groq ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}):`, errorText.slice(0, 400));

    // Non-retryable client errors — fail immediately
    if (response.status === 401) throw new Error("GROQ_API_KEY tidak valid. Periksa key di .env.local");
    if (response.status === 400) throw new Error(`Request tidak valid: ${errorText.slice(0, 200)}`);

    // Retryable: 429 (rate limit) and 5xx (server) — back off and retry
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = parseFloat(response.headers.get("retry-after") ?? "");
      // Cap backoff so the serverless function never approaches its timeout.
      const backoff = Math.min(4000, Number.isFinite(retryAfter) ? retryAfter * 1000 : 2 ** attempt * 500);
      console.log(`[cv-groq] Retrying in ${backoff}ms…`);
      await sleep(backoff);
      lastErr = `Groq ${response.status}`;
      continue;
    }

    if (response.status === 429) {
      const ra = parseFloat(response.headers.get("retry-after") ?? "");
      const err = new Error("Rate limit Groq tercapai.") as Error & { retryAfter?: number };
      if (Number.isFinite(ra)) err.retryAfter = ra;
      throw err;
    }
    throw new Error(`Groq API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  throw new Error(`Groq gagal setelah ${MAX_ATTEMPTS} percobaan (${lastErr}). Coba lagi nanti.`);
}
