/* ═══════════════════════════════════════════════════════════════════════════
   API Route: POST /api/analyze-cv
   Model: qwen/qwen3.8-27b via Groq (free tier, no billing required)
   
   Groq free tier: 14,400 req/day, 500,000 tokens/day — jauh lebih longgar
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import {
  buildAnalysisPrompt,
  buildFallbackResult,
  parseAnalysisResponse,
} from "@/lib/cv-analyzer-ai";
import { GROQ_MODEL, extractPdfText, callGroq } from "@/lib/cv-groq";

export const runtime = "nodejs";
export const maxDuration = 30;

/* ─── Main handler ─── */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    // candidateName is OPTIONAL — when omitted (bulk mode), the AI extracts it from the CV.
    const candidateName = (formData.get("candidateName") as string)?.trim() ?? "";
    const targetPosition = (formData.get("targetPosition") as string)?.trim();
    const department = (formData.get("department") as string)?.trim();
    // Bulk mode sends noRetry=true: do a single fast attempt and let the client
    // pace + retry, so each serverless call stays well under the timeout.
    const noRetry = (formData.get("noRetry") as string) === "true";

    if (!file || !targetPosition || !department) {
      return NextResponse.json(
        { error: "Field wajib: file (PDF), targetPosition, department" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ error: "File harus berformat PDF" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File terlalu besar (maksimal 10MB)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const cvText = await extractPdfText(buffer);

    if (!cvText || cvText.length < 50) {
      return NextResponse.json(
        { error: "Teks tidak dapat diekstrak dari PDF ini. Pastikan PDF bukan hasil scan gambar." },
        { status: 422 }
      );
    }

    const prompt = buildAnalysisPrompt(cvText, candidateName, targetPosition, department);
    const groq = await callGroq(prompt, noRetry ? 1 : 3);
    const result = parseAnalysisResponse(groq.content);

    return NextResponse.json({
      success: true,
      result,
      meta: {
        model: GROQ_MODEL,
        cvTextLength: cvText.length,
        remainingTokens: groq.remainingTokens,
        resetSeconds: groq.resetSeconds,
      },
    });

  } catch (error) {
    console.error("[analyze-cv] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (
      message.includes("JSON") ||
      message.includes("parse") ||
      message.includes("Unexpected token")
    ) {
      return NextResponse.json({
        success: false,
        result: buildFallbackResult("Gagal memparse respons AI. Coba upload ulang."),
        meta: { error: message },
      });
    }

    const isRateLimit = /rate limit|429/i.test(message);
    const retryAfter = (error as { retryAfter?: number })?.retryAfter;
    return NextResponse.json({ error: message, retryAfter }, { status: isRateLimit ? 429 : 500 });
  }
}

/* ─── Health check ─── */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    model: GROQ_MODEL,
    provider: "Groq (free tier)",
    apiKeyConfigured: !!(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith("gsk_xxx")),
  });
}
