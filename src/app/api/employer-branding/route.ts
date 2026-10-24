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
  type GroqBrandingCall,
  budgetMaxTokens,
  buildBrandingPrompt,
  buildFallbackResult,
  callGroqBranding,
  fetchCompanyContext,
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

// Caps free-text fields so a single verbose paste can't blow the prompt past
// Groq's 12,000-token-per-request budget on its own. Generous enough for a
// real paragraph, not so long it dominates the prompt.
function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// Progressively smaller idea counts to fall back through when a request
// comes back too large (413, rejected before generation) or truncated
// (finish_reason "length", cut off mid-JSON). Each step shrinks both the
// prompt (fewer format citations aren't affected, but less avoidTitles/
// context repetition risk) and, more importantly, the max_tokens budget.
// Started lower than before (4-5, not 5-6) — each idea now requires a
// fuller 5-8 beat breakdown (see instruction #4 in the prompt), which
// eats more of the 12k token budget per idea than the old 4-6 beats did.
const IDEA_COUNT_STEPS = [
  { min: 4, max: 5 },
  { min: 3, max: 3 },
  { min: 2, max: 2 },
] as const;

export async function POST(request: NextRequest) {
  // Tracked outside the try body so the catch block can tell what actually
  // went wrong (too large vs. truncated vs. a genuine parse failure) and
  // give the user an actionable message instead of a generic error.
  let lastFailureKind: "tooLarge" | "truncated" | null = null;

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
      companyValues: truncate(String(body.companyValues ?? ""), 500),
      openRoles: truncate(String(body.openRoles ?? ""), 500),
      targetAudience: String(body.targetAudience ?? "Semua level"),
      pillars,
      platforms,
      additionalContext: truncate(String(body.additionalContext ?? ""), 400),
      manualTrends: truncate(String(body.manualTrends ?? ""), 400),
      campaignGoal: String(body.campaignGoal ?? "all"),
      referenceContentUrl: truncate(String(body.referenceContentUrl ?? ""), 300),
      referenceContentNotes: truncate(String(body.referenceContentNotes ?? ""), 500),
      referenceVideoMeta: truncate(String(body.referenceVideoMeta ?? ""), 150),
      avoidTitles: (Array.isArray(body.avoidTitles) ? body.avoidTitles : [])
        .map((t) => String(t))
        .filter(Boolean)
        .slice(0, 15),
    };

    // Run trend research and company research in parallel — this is what
    // makes the AI actually understand the company from its name alone
    // (recent real news, if any exist) instead of reasoning from a bare
    // label. Demo/fictional company names simply return no news, which is
    // fine — the prompt falls back to the user-entered profile fields.
    const [trendData, companyNewsData] = await Promise.all([
      fetchTrendData(industry, platforms, input.manualTrends),
      fetchCompanyContext(companyName),
    ]);
    const knownTrendUrls = [
      ...trendData.map((t) => t.url),
      ...companyNewsData.map((t) => t.url),
    ].filter(Boolean);

    // Groq's org-level TPM budget for this model is a hard 12,000 tokens per
    // request (prompt + requested max_tokens combined), well below the
    // model's own 8192-token completion cap — a request that asks for too
    // much is rejected outright (413) before any generation happens, and
    // there's nothing to retry-with-backoff about. Instead, step down
    // through smaller idea counts (which shrinks both the prompt and the
    // completion budget needed) until a request actually fits.
    let groq: GroqBrandingCall | null = null;

    for (let step = 0; step < IDEA_COUNT_STEPS.length; step++) {
      const ideaCount = IDEA_COUNT_STEPS[step];
      const isLastStep = step === IDEA_COUNT_STEPS.length - 1;
      const prompt = buildBrandingPrompt(input, trendData, companyNewsData, ideaCount);
      const maxTokens = budgetMaxTokens(prompt);

      try {
        const attempt = await callGroqBranding(prompt, maxTokens);
        if (attempt.finishReason === "length") {
          lastFailureKind = "truncated";
          console.warn(`[employer-branding] Truncated with ${ideaCount.min}-${ideaCount.max} ideas${isLastStep ? " (final step)" : " — stepping down"}`);
          if (!isLastStep) continue;
          // Last step and still truncated — leave `groq` null so the loop
          // falls through to the "didn't fit even at minimum" response
          // below, instead of handing truncated/invalid JSON to the parser.
          break;
        }
        groq = attempt;
        lastFailureKind = null;
        break;
      } catch (err) {
        if ((err as { tooLarge?: boolean })?.tooLarge && !isLastStep) {
          lastFailureKind = "tooLarge";
          console.warn(`[employer-branding] 413 with ${ideaCount.min}-${ideaCount.max} ideas — stepping down`);
          continue;
        }
        throw err;
      }
    }

    if (!groq) {
      // Every step (down to 2 ideas) still didn't fit or kept truncating —
      // something in the fixed/required parts of the prompt itself (not
      // just user input) is too large for the budget.
      return NextResponse.json({
        success: false,
        result: buildFallbackResult(
          lastFailureKind === "tooLarge"
            ? "Permintaan tetap terlalu besar untuk batas token Groq meski sudah dicoba dengan lebih sedikit ide. Coba persingkat catatan referensi/konteks tambahan, lalu generate ulang."
            : "Respons AI terus terpotong meski sudah dicoba dengan lebih sedikit ide. Coba persingkat catatan referensi/konteks tambahan, lalu generate ulang.",
        ),
        meta: { error: lastFailureKind ?? "unknown" },
      });
    }

    const result = parseBrandingResponse(groq.content, knownTrendUrls);

    return NextResponse.json({
      success: true,
      result,
      meta: {
        model: GROQ_MODEL,
        trendsFetched: trendData.length,
        companyNewsFetched: companyNewsData.length,
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
          "Gagal memparse respons AI. Coba generate ulang.",
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
