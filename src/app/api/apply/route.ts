/* ═══════════════════════════════════════════════════════════════════════════
   API Route: POST /api/apply  — PUBLIC candidate application intake.

   Unauthenticated endpoint. A candidate uploads a CV; the server extracts the
   text, runs the same Groq analysis as the dashboard, and stores the result as
   a candidate row + activity entry using the SERVICE-ROLE key (RLS is
   authenticated-only, so the anon key can't write).

   The client only ever receives a minimal success/failure JSON — NEVER the
   score, recommendation, or any internal analysis.
═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { buildAnalysisPrompt, parseAnalysisResponse, verifyEvidenceQuotes } from "@/lib/cv-analyzer-ai";
import { extractPdfText, callGroq } from "@/lib/cv-groq";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { CvAnalysisSnapshot } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

/* ─── Simple per-IP throttle (best-effort, in-memory per instance) ───
   Protects this public endpoint from being spammed to burn the Groq quota.
   A genuine applicant submits once; this caps bursts per IP. In a serverless
   deployment the map is per-instance, which is enough to blunt naive abuse. */
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 5;                   // max submissions per window per IP
const hits = new Map<string, number[]>();

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
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
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genId(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

interface JobReqRow {
  title: string;
  department: string;
  status: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      // Misconfiguration — surface a clear, non-leaky message.
      return NextResponse.json(
        { success: false, error: "Server lamaran belum dikonfigurasi. Hubungi tim rekrutmen." },
        { status: 503 },
      );
    }

    if (isRateLimited(clientIp(request))) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak lamaran dari perangkat ini. Coba lagi beberapa menit lagi." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = (formData.get("name") as string)?.trim() ?? "";
    const email = (formData.get("email") as string)?.trim() ?? "";
    const phone = (formData.get("phone") as string)?.trim() ?? "";
    const jobReqId = (formData.get("jobReqId") as string)?.trim() ?? "";
    const src = ((formData.get("src") as string)?.trim() || "Apply Link").slice(0, 40);

    /* ─── Validate inputs ─── */
    if (!name) {
      return NextResponse.json({ success: false, error: "Nama lengkap wajib diisi." }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, error: "Email valid wajib diisi." }, { status: 400 });
    }
    if (!jobReqId) {
      return NextResponse.json({ success: false, error: "Lowongan tidak valid." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ success: false, error: "File CV (PDF) wajib diunggah." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json({ success: false, error: "File harus berformat PDF." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: "File terlalu besar (maksimal 10MB)." }, { status: 400 });
    }

    // Verify real PDF magic bytes — a spoofed content-type / .pdf name isn't enough
    // for a public endpoint. Every valid PDF starts with "%PDF-".
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ success: false, error: "File bukan PDF yang valid." }, { status: 400 });
    }

    /* ─── Confirm the role exists and is open BEFORE spending Groq quota ─── */
    const { data: role, error: roleErr } = await supabaseAdmin
      .from("job_reqs")
      .select("title, department, status")
      .eq("id", jobReqId)
      .maybeSingle<JobReqRow>();

    if (roleErr) {
      console.error("[apply] job_reqs lookup failed:", roleErr.message);
      return NextResponse.json({ success: false, error: "Gagal memuat lowongan. Coba lagi." }, { status: 500 });
    }
    if (!role || role.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Lowongan ini sudah tidak menerima lamaran." },
        { status: 404 },
      );
    }

    /* ─── Extract CV text ─── */
    const cvText = await extractPdfText(buffer);
    if (!cvText || cvText.length < 50) {
      return NextResponse.json(
        { success: false, error: "Teks tidak dapat dibaca dari PDF ini. Pastikan CV bukan hasil scan gambar, lalu unggah ulang." },
        { status: 422 },
      );
    }

    /* ─── Analyze with Groq (same pipeline as the dashboard) ─── */
    const prompt = buildAnalysisPrompt(cvText, name, role.title, role.department);
    const groq = await callGroq(prompt, 2);
    const result = verifyEvidenceQuotes(parseAnalysisResponse(groq.content), cvText).result;

    /* ─── Persist candidate + activity via service-role client ─── */
    const now = new Date().toISOString();
    const snapshot: CvAnalysisSnapshot = {
      reportId: genId("RPT"),
      overallScore: result.overallScore,
      matchScore: result.matchScore,
      confidence: result.confidence,
      recommendation: result.recommendation,
      summary: result.summary,
      frameworkLabel: result.frameworkLabel ?? "Multi-Framework",
      analyzedAt: now,
    };

    const candidateRow = {
      id: genId("C"),
      name,
      email,
      phone,
      stage: "applied",
      job_req_id: jobReqId,
      department: role.department,
      position: role.title,
      source: src,
      notes: "",
      cv_analysis: snapshot,
      interview_results: [],
      created_at: now,
      updated_at: now,
    };

    const { error: insertErr } = await supabaseAdmin.from("candidates").insert(candidateRow);
    if (insertErr) {
      console.error("[apply] candidate insert failed:", insertErr.message);
      return NextResponse.json(
        { success: false, error: "Lamaran gagal disimpan. Coba lagi sebentar." },
        { status: 500 },
      );
    }

    await supabaseAdmin.from("activities").insert({
      id: genId("A"),
      action: "New application:",
      target: `${name} — ${role.title}`,
      user: src,
      time: now,
      type: "create",
    });

    // Minimal success payload — no score / recommendation / analysis leaks to the candidate.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[apply] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const isRateLimit = /rate limit|429/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: isRateLimit
          ? "Sistem sedang sibuk memproses lamaran. Coba lagi beberapa saat lagi."
          : "Terjadi kesalahan saat memproses lamaran. Coba lagi.",
      },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}
