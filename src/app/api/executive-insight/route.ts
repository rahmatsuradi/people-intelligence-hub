/* ═══════════════════════════════════════════════════════════════════════════
   API Route: POST /api/executive-insight
   Model: llama-3.3-70b-versatile via Groq

   Generates a short executive summary for the Overview dashboard from
   client-supplied real metrics. Falls back to a deterministic template
   (no AI) if Groq is unavailable — see executive-insight-ai.ts.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { generateExecutiveInsight, type ExecutiveMetrics } from "@/lib/executive-insight-ai";

export const runtime = "nodejs";
export const maxDuration = 15;

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const metrics: ExecutiveMetrics = {
      companyName: String(body.companyName ?? "Perusahaan").slice(0, 100),
      industry: String(body.industry ?? "").slice(0, 40),
      totalHeadcount: toNumber(body.totalHeadcount),
      pkwttPct: Math.max(0, Math.min(100, toNumber(body.pkwttPct))),
      pkwtCount: toNumber(body.pkwtCount),
      openRoles: toNumber(body.openRoles),
      activePipeline: toNumber(body.activePipeline),
      talentCount: toNumber(body.talentCount),
      talentAvgPct: Math.max(0, Math.min(100, toNumber(body.talentAvgPct))),
      enpsScore: body.enpsScore === null || body.enpsScore === undefined ? null : Math.max(-100, Math.min(100, toNumber(body.enpsScore))),
      enpsPeriod: body.enpsPeriod ? String(body.enpsPeriod).slice(0, 10) : null,
    };

    const result = await generateExecutiveInsight(metrics);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/executive-insight] Error:", err);
    return NextResponse.json({ error: "Gagal membuat ringkasan." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "executive-insight" });
}
