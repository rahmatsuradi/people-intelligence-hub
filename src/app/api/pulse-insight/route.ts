/* ═══════════════════════════════════════════════════════════════════════════
   /api/pulse-insight — buat insight AI untuk satu siklus Pulse Check (KHUSUS HR).

   Alur: muat jawaban (service-role) → hitung ringkasan dengan summarize() (cermin
   pi_survey_summary) → kumpulkan komentar tertulis & SAMARKAN nama/kontak → prompt
   (pulse-insight.ts) → Groq mode JSON → parseInsight (samarkan ulang) → simpan ke
   pi_survey_insights dengan shared_with_owner = false. HR yang memutuskan kapan
   insight dibagikan ke owner.

   Rekan yang paling sering diapresiasi dihitung PASTI di server (appreciationCounts)
   dan tidak pernah dikirim ke AI.

   Masalah utama (11 Nov 2026, pulse-themes.ts): browser lebih dulu memanggil langkah
   {step: "tema", batch: 0..n-1, state} — tiap panggilan membaca SATU bagian komentar dan
   mengembalikan state + berapa detik menunggu jatah token Groq (8.000/menit). Setelah
   semua bagian, panggilan biasa dengan {state} menghitung jumlah per tema secara pasti,
   lalu insight disusun dari tabel tema itu (bukan dari 140 komentar pertama). Tanpa
   state, perilakunya sama dengan sebelumnya.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHr } from "@/lib/require-hr";
import { callGroq, GROQ_MODEL } from "@/lib/cv-groq";
import { appreciatedText, appreciationCounts, conclusionCategories, summarize, type SegmentPeriod, type Survey, type SurveyAction, type SurveyResponse } from "@/lib/rr/pulse";
import { buildInsightPrompt, collectComments, makeScrubber, parseInsight, parseMasalahNarration } from "@/lib/rr/pulse-insight";
import {
  NON_OPINION_KEYS, buildClassifyPrompt, buildPeta, buildProblemUnits, composeMasalah, isPositiveQuestion, isTrivialComment, masalahPromptBlock, mergeClassification,
  planBatches, questionLegend, sanitizeState, tallyThemes, waitBeforeNext,
} from "@/lib/rr/pulse-themes";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEGMENT_LABEL: Record<string, string> = { tenure: "Lama kerja", spv: "SPV area", divisi: "Divisi" };
/** Teks yang isinya identitas (outlet, SPV, penilai, nama rekan), bukan pendapat — tidak dikirim ke AI. */
const IDENTITY_TEXT = NON_OPINION_KEYS;

export async function POST(request: NextRequest) {
  const me = await requireHr(request);
  if (me instanceof NextResponse) return me;
  const db = supabaseAdmin!;
  const body = (await request.json().catch(() => ({}))) as { surveyId?: string; period?: string; step?: string; batch?: number; state?: unknown };
  const { surveyId, period } = body;
  if (!surveyId || !/^\d{4}-\d{2}-01$/.test(period ?? "")) return NextResponse.json({ error: "Survei dan periode wajib diisi." }, { status: 400 });

  const [{ data: survey }, { data: responses }, { data: actions }, { data: campaign }] = await Promise.all([
    db.from("pi_surveys").select("id, tenant_id, key, title, audience, questions, headline, segments, config").eq("id", surveyId).maybeSingle(),
    db.from("pi_survey_responses").select("id, period, respondent_name, answers").eq("survey_id", surveyId).eq("excluded", false).range(0, 9999),
    db.from("pi_survey_actions").select("title, theme, status, period").eq("survey_id", surveyId).in("status", ["belum", "berjalan"]).order("period", { ascending: false }),
    db.from("pi_survey_campaigns").select("target_count").eq("survey_id", surveyId).eq("period", period!).maybeSingle(),
  ]);
  if (!survey) return NextResponse.json({ error: "Survei tidak ditemukan." }, { status: 404 });
  const s = survey as unknown as Survey & { tenant_id: string };
  const rs = (responses ?? []) as Pick<SurveyResponse, "id" | "period" | "respondent_name" | "answers">[];
  const inPeriod = rs.filter((r) => r.period === period);
  if (inPeriod.length < 3) return NextResponse.json({ error: "Insight butuh minimal 3 jawaban di periode ini." }, { status: 400 });

  const { data: emps } = await db.from("pi_employees").select("full_name").eq("tenant_id", s.tenant_id).range(0, 9999);
  const staff = (emps ?? []).map((e) => e.full_name as string);
  const scrub = makeScrubber([...staff, ...inPeriod.map((r) => r.respondent_name ?? "").filter(Boolean)]);
  const segKey = s.segments?.[0] ?? null;
  const units = buildProblemUnits(s, inPeriod, scrub, IDENTITY_TEXT, segKey);
  const batches = planBatches(units);
  const categories = conclusionCategories(s);

  if (body.step === "tema") {
    const b = Number(body.batch ?? 0);
    if (!Number.isInteger(b) || b < 0) return NextResponse.json({ error: "Bagian tidak valid." }, { status: 400 });
    const state = sanitizeState(body.state, units, categories);
    if (b >= batches.length) return NextResponse.json({ state, batch: b, batches: batches.length, waitSeconds: 0 });
    const prompt = buildClassifyPrompt({
      surveyTitle: s.title, audience: s.audience ?? null, legend: questionLegend(s, IDENTITY_TEXT), units, batch: batches[b],
      batchNo: b + 1, batches: batches.length, themes: state.themes, openActions: (actions ?? []).map((a) => String(a.title)), categories,
    });
    try {
      const out = await callGroq(prompt, 2, { maxTokens: 2000 });
      const next = mergeClassification(out.content, state, units, batches[b], categories, scrub);
      return NextResponse.json({ state: next, batch: b, batches: batches.length, waitSeconds: waitBeforeNext(out.remainingTokens, out.resetSeconds) });
    } catch (e) {
      const ra = (e as Error & { retryAfter?: number }).retryAfter;
      if (/rate limit/i.test((e as Error).message)) return NextResponse.json({ error: "Jatah AI per menit habis.", retryAfter: Math.ceil(ra ?? 30) }, { status: 429 });
      return NextResponse.json({ error: `AI gagal membaca komentar bagian ${b + 1}: ${(e as Error).message}` }, { status: 502 });
    }
  }

  // Rincian kelompok: cermin pi_survey_segments() — kelompok < 3 orang tidak ikut.
  let segData: SegmentPeriod | null = null;
  if (segKey) {
    const by = new Map<string, typeof inPeriod>();
    for (const r of inPeriod) {
      const g = String(r.answers[segKey] ?? "") || "Tidak diisi";
      by.set(g, [...(by.get(g) ?? []), r]);
    }
    const groups: SegmentPeriod["groups"] = {};
    let hidden = 0;
    for (const [g, list] of by) {
      if (list.length < 3) { hidden++; continue; }
      const sum = summarize({ questions: s.questions.filter((q) => s.headline.includes(q.key)) }, list)[0];
      groups[g] = { n: list.length, questions: sum.questions };
    }
    segData = { period: period!, hidden, groups };
  }

  const comments = collectComments(s, inPeriod.map((r) => r.answers), scrub, IDENTITY_TEXT);

  // Masalah utama: hanya bila browser sudah menjalankan langkah "tema" (state dikirim).
  const groupN = new Map<string, number>();
  if (segKey) for (const r of inPeriod) { const g = String(r.answers[segKey] ?? "").trim() || "Tidak diisi"; groupN.set(g, (groupN.get(g) ?? 0) + 1); }
  const segLabel = segKey ? SEGMENT_LABEL[segKey] ?? segKey : null;
  const themeState = body.state ? sanitizeState(body.state, units, categories) : null;
  const tallied = themeState?.themes.length ? tallyThemes(themeState, units, inPeriod.length, groupN) : null;
  const positiveKeys = s.questions.filter((q) => q.type === "text" && isPositiveQuestion(q.label) && !IDENTITY_TEXT.includes(q.key)).map((q) => q.key);
  const positives = inPeriod.flatMap((r) => positiveKeys.map((k) => r.answers[k])).filter((v): v is string => typeof v === "string" && !isTrivialComment(v) && v.trim().length >= 12).map((v) => scrub(v));

  const prompt = buildInsightPrompt({
    survey: s, period: period!, summaries: summarize(s, rs),
    segments: segKey ? { label: SEGMENT_LABEL[segKey] ?? segKey, data: segData } : null,
    openActions: (actions ?? []) as Pick<SurveyAction, "title" | "theme" | "status" | "period">[],
    comments, targetCount: (campaign?.target_count as number | null) ?? null,
    masalah: tallied?.tally.length ? masalahPromptBlock(tallied.tally, themeState!, units, tallied.dasar, segLabel) : null,
    positives,
  });

  let content;
  try {
    const out = await callGroq(prompt, 2, tallied?.tally.length ? { maxTokens: 3000 } : {});
    content = parseInsight(out.content, scrub);
    if (tallied?.tally.length) {
      content.masalah_utama = composeMasalah(tallied.tally, parseMasalahNarration(out.content, scrub));
      content.masalah_dasar = { ...tallied.dasar, kelompok_label: segLabel };
      content.masalah_peta = buildPeta(themeState!, units);
    }
  } catch (e) {
    const ra = (e as Error & { retryAfter?: number }).retryAfter;
    if (/rate limit/i.test((e as Error).message)) return NextResponse.json({ error: "Jatah AI per menit habis.", retryAfter: Math.ceil(ra ?? 30) }, { status: 429 });
    return NextResponse.json({ error: `AI gagal membuat insight: ${(e as Error).message}` }, { status: 502 });
  }
  const praised = inPeriod.map((r) => appreciatedText(r.answers)).filter((v): v is string => !!v);
  if (praised.length) content.apresiasi = appreciationCounts(praised, staff);
  content.dasar = { period: period!, responden: inPeriod.length, komentar: comments.length };

  const { data: saved, error } = await db.from("pi_survey_insights").upsert({
    tenant_id: s.tenant_id, survey_id: surveyId, period, content, model: GROQ_MODEL, shared_with_owner: false, created_by: me.id, created_at: new Date().toISOString(),
  }, { onConflict: "survey_id,period" }).select("id, survey_id, period, content, model, shared_with_owner, created_at").single();
  if (error) return NextResponse.json({ error: `Insight dibuat tapi gagal disimpan: ${error.message}` }, { status: 500 });
  return NextResponse.json({ insight: saved });
}
