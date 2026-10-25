/* ═══════════════════════════════════════════════════════════════════════════
   /api/pulse-insight — buat insight AI untuk satu siklus Pulse Check (KHUSUS HR).

   Alur: muat jawaban (service-role) → hitung ringkasan dengan summarize() (cermin
   pi_survey_summary) → kumpulkan komentar tertulis & SAMARKAN nama/kontak → prompt
   (pulse-insight.ts) → Groq mode JSON → parseInsight (samarkan ulang) → simpan ke
   pi_survey_insights dengan shared_with_owner = false. HR yang memutuskan kapan
   insight dibagikan ke owner.

   Rekan yang paling sering diapresiasi dihitung PASTI di server (appreciationCounts)
   dan tidak pernah dikirim ke AI.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHr } from "@/lib/require-hr";
import { callGroq, GROQ_MODEL } from "@/lib/cv-groq";
import { appreciationCounts, summarize, type SegmentPeriod, type Survey, type SurveyAction, type SurveyResponse } from "@/lib/rr/pulse";
import { buildInsightPrompt, collectComments, makeScrubber, parseInsight } from "@/lib/rr/pulse-insight";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEGMENT_LABEL: Record<string, string> = { tenure: "Lama kerja", spv: "SPV area" };
/** Teks yang isinya identitas (outlet, SPV, nama rekan), bukan pendapat — tidak dikirim ke AI. */
const IDENTITY_TEXT = ["store", "joined_since", "spv", "work_hours", "appreciated_names"];

export async function POST(request: NextRequest) {
  const me = await requireHr(request);
  if (me instanceof NextResponse) return me;
  const db = supabaseAdmin!;
  const { surveyId, period } = (await request.json().catch(() => ({}))) as { surveyId?: string; period?: string };
  if (!surveyId || !/^\d{4}-\d{2}-01$/.test(period ?? "")) return NextResponse.json({ error: "Survei dan periode wajib diisi." }, { status: 400 });

  const [{ data: survey }, { data: responses }, { data: actions }, { data: campaign }] = await Promise.all([
    db.from("pi_surveys").select("id, tenant_id, key, title, audience, questions, headline, segments").eq("id", surveyId).maybeSingle(),
    db.from("pi_survey_responses").select("period, respondent_name, answers").eq("survey_id", surveyId).range(0, 9999),
    db.from("pi_survey_actions").select("title, theme, status, period").eq("survey_id", surveyId).in("status", ["belum", "berjalan"]).order("period", { ascending: false }),
    db.from("pi_survey_campaigns").select("target_count").eq("survey_id", surveyId).eq("period", period!).maybeSingle(),
  ]);
  if (!survey) return NextResponse.json({ error: "Survei tidak ditemukan." }, { status: 404 });
  const s = survey as unknown as Survey & { tenant_id: string };
  const rs = (responses ?? []) as Pick<SurveyResponse, "period" | "respondent_name" | "answers">[];
  const inPeriod = rs.filter((r) => r.period === period);
  if (inPeriod.length < 3) return NextResponse.json({ error: "Insight butuh minimal 3 jawaban di periode ini." }, { status: 400 });

  const { data: emps } = await db.from("pi_employees").select("full_name").eq("tenant_id", s.tenant_id).range(0, 9999);
  const staff = (emps ?? []).map((e) => e.full_name as string);
  const scrub = makeScrubber([...staff, ...inPeriod.map((r) => r.respondent_name ?? "").filter(Boolean)]);

  // Rincian kelompok: cermin pi_survey_segments() — kelompok < 3 orang tidak ikut.
  const segKey = s.segments?.[0];
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
  const prompt = buildInsightPrompt({
    survey: s, period: period!, summaries: summarize(s, rs),
    segments: segKey ? { label: SEGMENT_LABEL[segKey] ?? segKey, data: segData } : null,
    openActions: (actions ?? []) as Pick<SurveyAction, "title" | "theme" | "status" | "period">[],
    comments, targetCount: (campaign?.target_count as number | null) ?? null,
  });

  let content;
  try {
    const out = await callGroq(prompt, 2);
    content = parseInsight(out.content, scrub);
  } catch (e) {
    return NextResponse.json({ error: `AI gagal membuat insight: ${(e as Error).message}` }, { status: 502 });
  }
  const praised = inPeriod.map((r) => r.answers.appreciated_names).filter((v): v is string => typeof v === "string");
  if (praised.length) content.apresiasi = appreciationCounts(praised, staff);
  content.dasar = { period: period!, responden: inPeriod.length, komentar: comments.length };

  const { data: saved, error } = await db.from("pi_survey_insights").upsert({
    tenant_id: s.tenant_id, survey_id: surveyId, period, content, model: GROQ_MODEL, shared_with_owner: false, created_by: me.id, created_at: new Date().toISOString(),
  }, { onConflict: "survey_id,period" }).select("id, survey_id, period, content, model, shared_with_owner, created_at").single();
  if (error) return NextResponse.json({ error: `Insight dibuat tapi gagal disimpan: ${error.message}` }, { status: 500 });
  return NextResponse.json({ insight: saved });
}
