/* ═══════════════════════════════════════════════════════════════════════════
   API Route: POST /api/employer-branding
   Model: llama-3.3-70b-versatile via Groq

   Generates employer branding content ideas with trend awareness.
   Steps: fetch trends → build prompt → call Groq → parse → return
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { GROQ_MODEL } from "@/lib/cv-groq";
import {
  type BrandingInput,
  type ContentPillar,
  type Platform,
  buildBrandingPrompt,
  buildFallbackResult,
  callGroqBranding,
  fetchTrendData,
  parseBrandingResponse,
} from "@/lib/employer-branding-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_PILLARS = new Set([
  "culture", "career-growth", "benefits", "behind-the-scenes",
  "employee-stories", "achievements", "csr", "leadership",
]);
const VALID_PLATFORMS = new Set([
  "linkedin", "instagram", "tiktok", "career-page", "twitter", "youtube",
]);

export async function POST(request: NextRequest) {
  // Tracked outside the try body so the catch block can tell a truncated
  // Groq response (finish_reason "length" — the JSON got cut off mid-way)
  // apart from a genuine parse failure, and give the user an actionable
  // message instead of a generic error.
  let groqFinishReason: string | null = null;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const companyName = String(body.companyName ?? "").trim();
    const industry = String(body.industry ?? "").trim();
    const pillars = (
      Array.isArray(body.pillars) ? body.pillars : []
    ).filter((p): p is ContentPillar => VALID_PILLARS.has(p as string));
    const platforms = (
      Array.isArray(body.platforms) ? body.platforms : []
    ).filter((p): p is Platform => VALID_PLATFORMS.has(p as string));

    if (!companyName || !industry || pillars.length === 0 || platforms.length === 0) {
      return NextResponse.json(
        {
          error:
            "Field wajib: companyName, industry, pillars (min 1), platforms (min 1)",
        },
        { status: 400 },
      );
    }

    const input: BrandingInput = {
      companyName,
      industry,
      employeeCount: String(body.employeeCount ?? ""),
      companyValues: String(body.companyValues ?? ""),
      openRoles: String(body.openRoles ?? ""),
      targetAudience: String(body.targetAudience ?? "Semua level"),
      pillars,
      platforms,
      additionalContext: String(body.additionalContext ?? ""),
      manualTrends: String(body.manualTrends ?? ""),
      campaignGoal: String(body.campaignGoal ?? "all"),
      referenceContentUrl: String(body.referenceContentUrl ?? ""),
      referenceContentNotes: String(body.referenceContentNotes ?? ""),
      referenceVideoMeta: String(body.referenceVideoMeta ?? ""),
      avoidTitles: (Array.isArray(body.avoidTitles) ? body.avoidTitles : [])
        .map((t) => String(t))
        .filter(Boolean)
        .slice(0, 20),
    };

    const trendData = await fetchTrendData(industry, platforms, input.manualTrends);
    const knownTrendUrls = trendData.map((t) => t.url).filter(Boolean);

    let ideaCount = { min: 6, max: 8 };
    let prompt = buildBrandingPrompt(input, trendData, ideaCount);
    let groq = await callGroqBranding(prompt);
    groqFinishReason = groq.finishReason;

    // Reference content, manual trends, and the detailed per-idea breakdown
    // we now require can push the response past the model's 8192-token
    // completion cap — the JSON gets cut off mid-string and fails to parse.
    // Retry once with fewer (still fully detailed) ideas instead of failing.
    if (groq.finishReason === "length") {
      console.warn("[employer-branding] Response truncated at max_tokens — retrying with fewer ideas");
      ideaCount = { min: 4, max: 5 };
      prompt = buildBrandingPrompt(input, trendData, ideaCount);
      groq = await callGroqBranding(prompt);
      groqFinishReason = groq.finishReason;
    }

    const result = parseBrandingResponse(groq.content, knownTrendUrls);

    return NextResponse.json({
      success: true,
      result,
      meta: {
        model: GROQ_MODEL,
        trendsFetched: trendData.length,
        remainingTokens: groq.remainingTokens,
        resetSeconds: groq.resetSeconds,
      },
    });
  } catch (error) {
    console.error("[employer-branding] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (
      message.includes("JSON") ||
      message.includes("parse") ||
      message.includes("Unexpected token")
    ) {
      return NextResponse.json({
        success: false,
        result: buildFallbackResult(
          groqFinishReason === "length"
            ? "Respons AI terpotong karena kepanjangan untuk konteks yang diberikan (masih terpotong meski sudah dicoba ulang dengan ide lebih sedikit). Coba persingkat catatan referensi/konteks tambahan, kurangi jumlah platform yang dipilih, lalu generate ulang."
            : "Gagal memparse respons AI. Coba generate ulang.",
        ),
        meta: { error: message },
      });
    }

    const isRateLimit = /rate limit|429/i.test(message);
    const retryAfter = (error as { retryAfter?: number })?.retryAfter;
    return NextResponse.json(
      { error: message, retryAfter },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    model: GROQ_MODEL,
    provider: "Groq (free tier)",
    apiKeyConfigured: !!(
      process.env.GROQ_API_KEY &&
      !process.env.GROQ_API_KEY.startsWith("gsk_xxx")
    ),
  });
}
