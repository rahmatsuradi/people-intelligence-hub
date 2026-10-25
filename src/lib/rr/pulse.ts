/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Check & Feedback — pi_surveys, pi_survey_responses, pi_survey_actions
   (supabase/pulse-check-schema.sql).

   Kerahasiaan: nama & jawaban tertulis (pi_survey_responses) dan siapa yang
   mengangkat tiap action item (pi_survey_action_raisers) hanya bisa dibaca HR.
   Owner membaca ringkasan lewat RPC pi_survey_summary() — hitungan saja, periode
   < 3 jawaban disembunyikan. Semua angka di layar (HR maupun owner) dihitung dari
   ringkasan yang sama, supaya HR dan owner tidak pernah melihat angka berbeda.

   Fungsi murni diuji di pulse.test.ts. `summarize()` adalah cermin TypeScript
   dari pi_survey_summary(): dipakai untuk rincian yang hanya HR boleh lihat
   (mis. per SPV) dan sebagai spesifikasi perilaku fungsi SQL-nya.
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../supabase";
import { getActiveCompanyId } from "../payroll/company-profile";
import { fetchAll } from "./master";

export type QuestionType = "choice" | "multi" | "scale" | "text";

export interface SurveyOption { value: string; label?: string; score?: number }

export interface SurveyQuestion {
  key: string;
  label: string;
  type: QuestionType;
  section?: string;
  options?: SurveyOption[];
  min?: number;
  max?: number;
  /** true = makin tinggi makin baik; false = makin rendah makin baik (mis. frekuensi stres). */
  higherIsBetter?: boolean;
}

export interface Survey {
  id: string;
  key: string;
  title: string;
  description: string | null;
  audience: string | null;
  cadence: "bulanan" | "sekali" | "tidak_tetap" | null;
  questions: SurveyQuestion[];
  headline: string[];
  source: string | null;
}

export interface QuestionSummary { answered: number; counts: Record<string, number> }

export interface PeriodSummary {
  period: string; // YYYY-MM-01, bulan yang DINILAI
  n: number;
  suppressed: boolean;
  questions: Record<string, QuestionSummary>;
}

export type AnswerValue = string | number | (string | number)[];

export interface SurveyResponse {
  id: string;
  survey_id: string;
  period: string;
  submitted_at: string | null;
  respondent_name: string | null;
  respondent_email: string | null;
  employee_id: string | null;
  answers: Record<string, AnswerValue>;
}

export type ActionStatus = "belum" | "berjalan" | "selesai" | "dibatalkan";

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  belum: "Belum jalan", berjalan: "Sedang berjalan", selesai: "Selesai", dibatalkan: "Dibatalkan",
};

export interface SurveyAction {
  id: string;
  survey_id: string;
  period: string;
  title: string;
  theme: string | null;
  pic: string | null;
  plan: string | null;
  result: string | null;
  status: ActionStatus;
  source: string | null;
  updated_at?: string;
}

/** Ambang yang sama dengan pi_survey_summary(): di bawah ini rincian disembunyikan. */
export const MIN_RESPONSES = 3;

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_ID[(m || 1) - 1]} ${y}`;
}

/* ─── Fungsi murni ─── */

function valuesOf(v: AnswerValue | undefined | null): string[] {
  if (v === undefined || v === null || v === "") return [];
  return (Array.isArray(v) ? v : [v]).map(String);
}

/** Cermin pi_survey_summary(): hitungan per pilihan per periode; pertanyaan 'text' dilewati. */
export function summarize(survey: Pick<Survey, "questions">, responses: Pick<SurveyResponse, "period" | "answers">[]): PeriodSummary[] {
  const keys = survey.questions.filter((q) => q.type !== "text").map((q) => q.key);
  const byPeriod = new Map<string, Pick<SurveyResponse, "period" | "answers">[]>();
  for (const r of responses) byPeriod.set(r.period, [...(byPeriod.get(r.period) ?? []), r]);
  return [...byPeriod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, rs]) => {
    const suppressed = rs.length < MIN_RESPONSES;
    const questions: Record<string, QuestionSummary> = {};
    if (!suppressed) {
      for (const key of keys) {
        const counts: Record<string, number> = {};
        let answered = 0;
        for (const r of rs) {
          const vals = valuesOf(r.answers[key]);
          if (vals.length) answered += 1;
          for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
        }
        if (answered) questions[key] = { answered, counts };
      }
    }
    return { period, n: rs.length, suppressed, questions };
  });
}

/**
 * Rata-rata satu pertanyaan. Pilihan memakai `score` di definisi opsinya; skala memakai
 * angkanya. Nilai tanpa skor (mis. jawaban di luar opsi) dikeluarkan dari pembagi —
 * bukan dihitung nol — dan `n` melaporkan berapa yang benar-benar dihitung.
 */
export function questionAverage(q: SurveyQuestion, s: QuestionSummary | undefined): { avg: number | null; n: number } {
  if (!s || (q.type !== "choice" && q.type !== "scale")) return { avg: null, n: 0 };
  const score = (v: string): number | null => {
    if (q.type === "scale") {
      const x = Number(v);
      return Number.isFinite(x) ? x : null;
    }
    return q.options?.find((o) => o.value === v)?.score ?? null;
  };
  let sum = 0, n = 0;
  for (const [v, c] of Object.entries(s.counts)) {
    const x = score(v);
    if (x === null) continue;
    sum += x * c;
    n += c;
  }
  return { avg: n ? sum / n : null, n };
}

export interface TrendPoint { period: string; avg: number | null; n: number; suppressed: boolean }

export function trend(q: SurveyQuestion, summaries: PeriodSummary[]): TrendPoint[] {
  return summaries.map((p) => ({ period: p.period, suppressed: p.suppressed, ...(p.suppressed ? { avg: null, n: 0 } : questionAverage(q, p.questions[q.key])) }));
}

/** Perubahan titik terakhir terhadap titik sebelumnya yang punya angka; `better` memperhitungkan arah pertanyaan. */
export function lastChange(q: SurveyQuestion, points: TrendPoint[]): { current: TrendPoint | null; previous: TrendPoint | null; delta: number | null; better: boolean | null } {
  const withAvg = points.filter((p) => p.avg !== null);
  const current = withAvg.at(-1) ?? null;
  const previous = withAvg.at(-2) ?? null;
  if (!current || !previous) return { current, previous, delta: null, better: null };
  const delta = (current.avg as number) - (previous.avg as number);
  if (delta === 0 || q.higherIsBetter === undefined) return { current, previous, delta, better: null };
  return { current, previous, delta, better: q.higherIsBetter ? delta > 0 : delta < 0 };
}

export interface DistributionRow { value: string; label: string; count: number; pct: number }

/**
 * Sebaran jawaban, urut sesuai opsi; nilai di luar opsi ditaruh di akhir (terbanyak dulu).
 * Persen dihitung terhadap jumlah PENJAWAB — pada pilihan ganda totalnya boleh > 100%.
 */
export function distribution(q: SurveyQuestion, s: QuestionSummary | undefined): DistributionRow[] {
  if (!s) return [];
  const row = (value: string): DistributionRow => {
    const opt = q.options?.find((o) => o.value === value);
    const count = s.counts[value] ?? 0;
    return { value, label: opt?.label ?? value, count, pct: s.answered ? (count / s.answered) * 100 : 0 };
  };
  if (q.type === "scale" && q.min !== undefined && q.max !== undefined) {
    const out: DistributionRow[] = [];
    for (let v = q.min; v <= q.max; v++) out.push(row(String(v)));
    return out;
  }
  const known = (q.options ?? []).map((o) => row(o.value));
  const extra = Object.keys(s.counts).filter((v) => !q.options?.some((o) => o.value === v)).map(row).sort((a, b) => b.count - a.count);
  if (q.type === "multi") return [...known, ...extra].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  return [...known, ...extra];
}

export interface RecurringTheme { theme: string; periods: string[]; open: number; total: number; latest: SurveyAction }

const OPEN: ActionStatus[] = ["belum", "berjalan"];

/**
 * Tema yang muncul di ≥ 2 periode dan masih punya butir terbuka — keluhan yang terus
 * diangkat karyawan tapi belum tuntas. Ditampilkan paling atas, sebelum angka.
 */
export function recurringThemes(actions: SurveyAction[]): RecurringTheme[] {
  const by = new Map<string, SurveyAction[]>();
  for (const a of actions) {
    if (!a.theme || a.theme === "lainnya") continue;
    by.set(a.theme, [...(by.get(a.theme) ?? []), a]);
  }
  return [...by.entries()]
    .map(([theme, list]) => {
      const sorted = [...list].sort((a, b) => b.period.localeCompare(a.period));
      return {
        theme,
        periods: [...new Set(sorted.map((a) => a.period))].sort(),
        open: list.filter((a) => OPEN.includes(a.status)).length,
        total: list.length,
        latest: sorted[0],
      };
    })
    .filter((t) => t.periods.length >= 2 && t.open > 0)
    .sort((a, b) => b.periods.length - a.periods.length || b.open - a.open || a.theme.localeCompare(b.theme));
}

/** Bulan terakhir yang punya action item, dan periode survei setelahnya yang belum punya — action list yang berhenti diperbarui. */
export function periodsWithoutActions(summaries: PeriodSummary[], actions: SurveyAction[]): string[] {
  const has = new Set(actions.map((a) => a.period));
  const last = [...has].sort().at(-1);
  if (!last) return [];
  return summaries.map((p) => p.period).filter((p) => p > last && !has.has(p));
}

export interface GroupAverage { group: string; avg: number | null; n: number }

/** Rata-rata satu pertanyaan per kelompok (mis. per SPV) dari jawaban mentah — khusus HR. */
export function groupAverage(q: SurveyQuestion, responses: Pick<SurveyResponse, "answers">[], groupKey: string): GroupAverage[] {
  const by = new Map<string, Pick<SurveyResponse, "answers">[]>();
  for (const r of responses) {
    const g = valuesOf(r.answers[groupKey])[0] ?? "Tidak diisi";
    by.set(g, [...(by.get(g) ?? []), r]);
  }
  return [...by.entries()]
    .map(([group, rs]) => {
      const counts: Record<string, number> = {};
      let answered = 0;
      for (const r of rs) {
        const vals = valuesOf(r.answers[q.key]);
        if (vals.length) answered += 1;
        for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
      }
      return { group, ...questionAverage(q, { answered, counts }) };
    })
    .sort((a, b) => (a.avg ?? Infinity) - (b.avg ?? Infinity) || a.group.localeCompare(b.group));
}

/* ─── Database ─── */

export async function loadSurveys(): Promise<Survey[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pi_surveys")
    .select("id, key, title, description, audience, cadence, questions, headline, source")
    .eq("tenant_id", getActiveCompanyId()).order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as Survey[];
}

export async function loadSummary(surveyId: string): Promise<PeriodSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("pi_survey_summary", { p_survey_id: surveyId });
  if (error) throw new Error(error.message);
  return (data ?? []) as PeriodSummary[];
}

export async function loadActions(surveyId: string): Promise<SurveyAction[]> {
  if (!supabase) return [];
  const db = supabase;
  return fetchAll<SurveyAction>((a, b) => db.from("pi_survey_actions")
    .select("id, survey_id, period, title, theme, pic, plan, result, status, source, updated_at")
    .eq("survey_id", surveyId).order("period", { ascending: false }).order("id").range(a, b));
}

/** Khusus HR — untuk owner database mengembalikan kosong. */
export async function loadResponses(surveyId: string): Promise<SurveyResponse[]> {
  if (!supabase) return [];
  const db = supabase;
  return fetchAll<SurveyResponse>((a, b) => db.from("pi_survey_responses")
    .select("id, survey_id, period, submitted_at, respondent_name, respondent_email, employee_id, answers")
    .eq("survey_id", surveyId).order("submitted_at", { ascending: false }).order("id").range(a, b));
}

/** Khusus HR — nama karyawan yang mengangkat tiap action item. */
export async function loadRaisers(): Promise<Map<string, string>> {
  if (!supabase) return new Map();
  const db = supabase;
  const rows = await fetchAll<{ action_id: string; raised_by: string }>((a, b) => db.from("pi_survey_action_raisers")
    .select("action_id, raised_by").order("action_id").range(a, b));
  return new Map(rows.map((r) => [r.action_id, r.raised_by]));
}

export async function saveAction(a: Partial<SurveyAction> & { survey_id: string; title: string; period: string }, raisedBy?: string): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const row = { ...a, tenant_id: getActiveCompanyId(), updated_at: new Date().toISOString() };
  const res = a.id
    ? await supabase.from("pi_survey_actions").update(row).eq("id", a.id).select("id").single()
    : await supabase.from("pi_survey_actions").insert({ ...row, source: "Ditambahkan HR di aplikasi" }).select("id").single();
  if (res.error) return res.error.message;
  if (raisedBy === undefined) return null;
  const id = (res.data as { id: string }).id;
  const r = raisedBy.trim()
    ? await supabase.from("pi_survey_action_raisers").upsert({ action_id: id, raised_by: raisedBy.trim() })
    : await supabase.from("pi_survey_action_raisers").delete().eq("action_id", id);
  return r.error ? r.error.message : null;
}

export async function deleteAction(id: string): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_actions").delete().eq("id", id);
  return error ? error.message : null;
}
