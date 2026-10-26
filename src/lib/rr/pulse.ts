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
  required?: boolean;
  /** Pertanyaan hanya ditampilkan (dan hanya boleh dijawab) bila jawaban `key` memenuhi syarat. */
  showIf?: { key: string; in?: string[]; notIn?: string[] };
  /** Definisi skor KPI "% favorable" (gaya Culture Amp/Peakon): nilai yang dihitung baik… */
  favorable?: string[];
  /** …atau ambang skala (mis. 8 pada skala 1–10). */
  favorableMin?: number;
  /** Kebalikannya: nilai yang dihitung risiko (mis. stres ≥ 2x seminggu). */
  risk?: string[];
  kpiLabel?: string;
  kpiHint?: string;
  /** Diisi sistem/HR (mis. kelompok jabatan, label "major feedback"), tidak ditanyakan di formulir. */
  hidden?: boolean;
}

export interface SurveyConfig {
  /** 'hr' = owner tidak melihat survei ini sama sekali (dijaga RLS). */
  visibility?: "hr" | "all";
  /** Menentukan tampilan ringkasan: pulse (umum), spv_report (rapor SPV), 360 (rapor 360). */
  kind?: "pulse" | "spv_report" | "360";
  order?: number;
  /** 360: Leader SPV yang dinilai di bagian "Penilaian ke Leader". */
  leader?: string;
  /** 360: siapa yang dinilai di tiap blok formulir (b1…b7). null = belum dipastikan. */
  targets?: Record<string, string | null>;
  targetNote?: string;
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
  segments: string[];
  source: string | null;
  config: SurveyConfig;
}

export interface Campaign {
  id: string;
  survey_id: string;
  period: string;
  token: string;
  status: "open" | "closed";
  closes_at: string | null;
  target_count: number | null;
  note: string | null;
  created_at: string;
}

/** Hasil pi_survey_segments(): per periode, kelompok ≥ 3 orang saja. */
export interface SegmentPeriod {
  period: string;
  hidden: number;
  groups: Record<string, { n: number; questions: Record<string, QuestionSummary> }>;
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
  /** Tanda kualitas data, mis. isian_ganda_bulan_sama. */
  flags?: string[];
  /** true = tidak ikut dihitung (mis. isian ganda); datanya tetap disimpan. */
  excluded?: boolean;
}

export const RESPONSE_FLAG_LABEL: Record<string, string> = {
  isian_ganda_bulan_sama: "Isian ganda di bulan yang sama — tidak dihitung, isian terakhir yang dipakai",
  punya_isian_ganda: "Orang ini mengisi lebih dari sekali bulan ini — isian ini yang dihitung",
  baris_kembar_persis: "Baris kembar persis dari Google Form — tidak dihitung",
  bulan_belum_dilabel_hr: "Belum diberi bulan oleh HR di sheet (diisi setelah siklus ditutup) — tidak dihitung ke bulan mana pun",
};

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
  is_focus?: boolean;
  due_date?: string | null;
  told_back?: string | null;
  updated_at?: string;
}

/** Batas fokus per siklus. Culture Amp & Peakon menyarankan 1–3: daftar panjang yang semuanya "prioritas" berakhir tidak ada yang dikerjakan. */
export const MAX_FOCUS = 3;

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

/* ─── KPI "% favorable" ─── */

export interface Kpi { pct: number | null; hits: number; n: number; kind: "favorable" | "risk" }

export function hasKpi(q: SurveyQuestion): boolean {
  return !!(q.favorable?.length || q.risk?.length || q.favorableMin !== undefined);
}

/**
 * Persen penjawab yang masuk kategori baik (favorable) atau risiko. Persen lebih mudah
 * dibaca owner daripada rata-rata "2,8 dari 4", dan tidak berpura-pura jarak antar-pilihan
 * itu sama. Penyebutnya = yang MENJAWAB pertanyaan itu, bukan seluruh responden.
 */
export function kpi(q: SurveyQuestion, s: QuestionSummary | undefined): Kpi | null {
  if (!hasKpi(q)) return null;
  const kind = q.risk?.length ? "risk" : "favorable";
  if (!s || !s.answered) return { pct: null, hits: 0, n: 0, kind };
  let hits = 0;
  for (const [v, c] of Object.entries(s.counts)) {
    const hit = q.risk?.length ? q.risk.includes(v)
      : q.favorable?.length ? q.favorable.includes(v)
      : Number(v) >= (q.favorableMin as number);
    if (hit) hits += c;
  }
  return { pct: (hits / s.answered) * 100, hits, n: s.answered, kind };
}

export interface KpiPoint { period: string; pct: number | null; n: number; suppressed: boolean }

export function kpiTrend(q: SurveyQuestion, summaries: PeriodSummary[]): KpiPoint[] {
  return summaries.map((p) => {
    const k = p.suppressed ? null : kpi(q, p.questions[q.key]);
    return { period: p.period, suppressed: p.suppressed, pct: k?.pct ?? null, n: k?.n ?? 0 };
  });
}

/** Apakah perubahan KPI ini kabar baik? favorable naik = baik; risiko naik = buruk. */
export function kpiBetter(q: SurveyQuestion, delta: number): boolean | null {
  if (!delta) return null;
  return q.risk?.length ? delta < 0 : delta > 0;
}

/* ─── Formulir publik ─── */

export function isVisible(q: SurveyQuestion, answers: Record<string, AnswerValue | undefined>): boolean {
  if (q.hidden) return false;
  if (!q.showIf) return true;
  const v = valuesOf(answers[q.showIf.key] ?? null);
  if (!v.length) return false;
  if (q.showIf.in && !v.some((x) => q.showIf!.in!.includes(x))) return false;
  if (q.showIf.notIn && v.every((x) => q.showIf!.notIn!.includes(x))) return false;
  return true;
}

export const MAX_TEXT = 2000;

/**
 * Validasi jawaban dari formulir publik. Hanya key yang ada di definisi survei yang
 * disimpan, pilihan harus salah satu opsi, skala harus di rentangnya, dan jawaban untuk
 * pertanyaan yang tidak tampil (syarat showIf tak terpenuhi) dibuang — bukan disimpan
 * diam-diam. Pertanyaan wajib yang tampil tapi kosong = galat.
 */
export function validateSubmission(survey: Pick<Survey, "questions">, raw: Record<string, unknown>): { answers: Record<string, AnswerValue>; errors: string[] } {
  const answers: Record<string, AnswerValue> = {};
  const errors: string[] = [];
  const clean = (q: SurveyQuestion, v: unknown): AnswerValue | null => {
    if (v === undefined || v === null || v === "") return null;
    if (q.type === "text") {
      const s = String(v).trim().slice(0, MAX_TEXT);
      return s || null;
    }
    if (q.type === "scale") {
      const n = Number(v);
      if (!Number.isInteger(n) || (q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max)) { errors.push(`${q.label}: nilai di luar rentang`); return null; }
      return n;
    }
    const allowed = q.options?.map((o) => o.value);
    if (q.type === "multi") {
      const arr = (Array.isArray(v) ? v : [v]).map(String).filter((x) => !allowed || allowed.includes(x));
      return arr.length ? [...new Set(arr)] : null;
    }
    const s = String(v);
    if (allowed && !allowed.includes(s)) { errors.push(`${q.label}: pilihan tidak dikenal`); return null; }
    return s;
  };
  for (const q of survey.questions) {
    const visible = isVisible(q, answers);
    const v = visible ? clean(q, raw[q.key]) : null;
    if (v !== null) answers[q.key] = v;
    else if (visible && q.required) errors.push(`${q.label} wajib diisi`);
  }
  return { answers, errors };
}

/* ─── Sinyal otomatis ─── */

export interface Signal { id: string; severity: "tinggi" | "sedang" | "info"; title: string; detail: string }

const KPI_SHIFT = 10;   // poin persentase — di bawah ini dianggap gerak biasa antar-bulan
const SEGMENT_GAP = 15; // poin persentase kelompok vs keseluruhan

/**
 * Aturan tetap (bukan AI) untuk "yang perlu diperhatikan" — bisa diaudit dan tidak
 * berubah tiap kali dibuka. Ambang sengaja longgar: dengan 20-an responden per bulan,
 * selisih 1–2 orang sudah menggeser persen 5–10 poin.
 */
export function signals(input: {
  survey: Pick<Survey, "questions" | "headline">;
  summaries: PeriodSummary[];
  period: string;
  actions: SurveyAction[];
  segments?: SegmentPeriod | null;
  segmentLabel?: string;
  targetCount?: number | null;
}): Signal[] {
  const out: Signal[] = [];
  const qs = input.survey.headline.map((k) => input.survey.questions.find((q) => q.key === k)).filter((q): q is SurveyQuestion => !!q && hasKpi(q));
  const idx = input.summaries.findIndex((p) => p.period === input.period);
  const cur = input.summaries[idx];
  const prev = input.summaries.slice(0, Math.max(0, idx)).reverse().find((p) => !p.suppressed);
  const pct = (x: number) => `${Math.round(x)}%`;

  if (cur && !cur.suppressed) {
    for (const q of qs) {
      const a = kpi(q, cur.questions[q.key]);
      const b = prev ? kpi(q, prev.questions[q.key]) : null;
      if (a?.pct == null || b?.pct == null) continue;
      const d = a.pct - b.pct;
      if (Math.abs(d) < KPI_SHIFT) continue;
      const better = kpiBetter(q, d);
      out.push({
        id: `shift-${q.key}`, severity: better ? "info" : "tinggi",
        title: `${q.kpiLabel ?? q.label} ${d > 0 ? "naik" : "turun"} ${Math.round(Math.abs(d))} poin`,
        detail: `${pct(b.pct)} di ${periodLabel(prev!.period)} → ${pct(a.pct)} di ${periodLabel(cur.period)}${better ? " — membaik" : " — memburuk"}.`,
      });
    }
    if (input.segments) {
      for (const q of qs) {
        const all = kpi(q, cur.questions[q.key]);
        if (all?.pct == null) continue;
        for (const [g, data] of Object.entries(input.segments.groups)) {
          const k = kpi(q, data.questions[q.key]);
          if (k?.pct == null) continue;
          const worse = all.kind === "risk" ? k.pct - all.pct : all.pct - k.pct;
          if (worse >= SEGMENT_GAP) {
            out.push({
              id: `seg-${q.key}-${g}`, severity: "sedang",
              title: `${input.segmentLabel ?? "Kelompok"} ${g}: ${q.kpiLabel ?? q.label} ${pct(k.pct)}`,
              detail: `Dibanding ${pct(all.pct)} keseluruhan (${data.n} orang di kelompok ini).`,
            });
          }
        }
      }
    }
    if (input.targetCount && input.targetCount > 0) {
      const rate = (cur.n / input.targetCount) * 100;
      if (rate < 70) out.push({ id: "participation", severity: "sedang", title: `Partisipasi ${pct(rate)}`, detail: `${cur.n} dari ${input.targetCount} orang mengisi. Di bawah 70%, hasilnya mungkin hanya mewakili yang paling puas atau paling kesal.` });
    }
  }

  const open = input.actions.filter((a) => OPEN.includes(a.status));
  const focus = open.filter((a) => a.is_focus);
  if (open.length > 10 && focus.length === 0) {
    out.push({ id: "no-focus", severity: "sedang", title: `${open.length} tindak lanjut terbuka, belum ada yang dijadikan fokus`, detail: `Pilih maksimal ${MAX_FOCUS} untuk dikerjakan bulan ini. Daftar panjang tanpa prioritas cenderung tidak ada yang selesai.` });
  }
  if (cur && !input.actions.some((a) => a.period === cur.period)) {
    out.push({ id: "no-action", severity: "info", title: `Belum ada tindak lanjut untuk ${periodLabel(cur.period)}`, detail: "Baca hasil dan komentar, lalu tetapkan 1–3 fokus. Insight AI bisa membantu menyusun usulannya." });
  }
  const recurring = recurringThemes(input.actions).filter((t) => t.periods.length >= 3);
  if (recurring.length) {
    out.push({ id: "recurring", severity: "tinggi", title: `${recurring.length} keluhan muncul ≥ 3 bulan dan belum tuntas`, detail: recurring.slice(0, 5).map((t) => t.theme).join(", ") + (recurring.length > 5 ? `, dan ${recurring.length - 5} lainnya` : "") + "." });
  }
  const order = { tinggi: 0, sedang: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ─── Apresiasi ─── */

const normName = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Rekan yang paling sering diapresiasi, dihitung pasti (bukan AI) dari isian bebas
 * "Billy setiawan, Deni ramdani". Nama disamakan ke master karyawan bila cocok tepat ke
 * satu orang (nama lengkap atau kata pertama yang unik); selain itu dipakai apa adanya.
 */
export function appreciationCounts(texts: string[], employeeNames: string[], limit = 5): { name: string; count: number }[] {
  const full = new Map<string, string>();
  const first = new Map<string, string[]>();
  for (const n of employeeNames) {
    const k = normName(n.replace(/\(.*?\)/g, ""));
    if (!k) continue;
    full.set(k, n);
    // Nama depan dan nama panggilan dalam kurung, mis. "Ilal Marfudi Agustiawan (Billy)".
    const keys = new Set([k.split(" ")[0], ...[...n.matchAll(/\(([^)]+)\)/g)].map((m) => normName(m[1]).split(" ")[0])]);
    for (const f of keys) if (f) first.set(f, [...(first.get(f) ?? []), n]);
  }
  const counts = new Map<string, number>();
  // Bukan nama orang: "semua tim", "SPG", "anak-anak outlet".
  const skip = /^(semua|semuanya|tim|team|seluruh|rekan|teman|all|spg|spv|anak|para|tidak|belum)\b/;
  for (const t of texts) {
    const seen = new Set<string>();
    for (const part of t.split(/,|&|\/|\bdan\b|\n/i)) {
      const k = normName(part.replace(/\(.*?\)/g, ""));
      if (k.length < 3 || skip.test(k)) continue;
      const hit = full.get(k) ?? (first.get(k)?.length === 1 ? first.get(k)![0] : undefined) ?? (first.get(k.split(" ")[0])?.length === 1 ? first.get(k.split(" ")[0])![0] : undefined);
      const name = hit ?? k.replace(/\b\w/g, (c) => c.toUpperCase());
      if (seen.has(name)) continue;
      seen.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

/* ─── Kelompok jabatan (Pulse Office) ─── */

export const JABATAN_GROUPS = ["Manajemen", "Supervisor", "Admin & CS", "Produksi & teknik", "Host live", "Marketing, VM & HR", "Tidak tercatat"] as const;

/** Jabatan bebas di master karyawan → kelompok yang cukup besar untuk dibandingkan (≥ 3 orang). */
export function jabatanGroup(position: string | null | undefined): (typeof JABATAN_GROUPS)[number] {
  const p = (position ?? "").toLowerCase();
  if (!p.trim()) return "Tidak tercatat";
  if (/manager|manajer|direktur|ceo/.test(p)) return "Manajemen";
  if (/supervisor|\bspv\b|koordinator/.test(p)) return "Supervisor";
  if (/admin|customer service|\bcs\b|purchasing|finance|kasir/.test(p)) return "Admin & CS";
  if (/produksi|baker|kitchen|maintenance|mekanik|mechanical|teknisi|\bmep\b|gudang/.test(p)) return "Produksi & teknik";
  if (/host|live/.test(p)) return "Host live";
  if (/marketing|desain|design|visual|merchandis|\bvm\b|\bhr\b|people|konten|content/.test(p)) return "Marketing, VM & HR";
  return "Tidak tercatat";
}

/* ─── Rapor SPV (Feedback SPG → SPV) ─── */

export interface SpvRow {
  spv: string;
  n: number;
  /** Jumlah SPG aktif di master karyawan dengan atasan SPV ini; null bila tidak ada. */
  roster: number | null;
  participation: number | null;
  /** Rata-rata dari keenam skala 1–5. */
  score: number | null;
  scorePrev: number | null;
  /** % SPG yang memberi nilai 4–5, per skala. */
  scales: Record<string, number | null>;
  /** % SPG yang memberi setidaknya satu nilai ≤ 3 tidak bisa dihitung dari ringkasan; diganti % terendah antar-skala. */
  weakest: { key: string; pct: number } | null;
  followed: number | null;
  unresolved: number | null;
}

/**
 * Rapor per SPV untuk satu siklus, dari pi_survey_segments() (kelompok ≥ 3 SPG).
 * Skor = rata-rata keenam skala. Partisipasi dibandingkan jumlah SPG aktif di master —
 * bisa > 100% bila master belum diperbarui atau SPG area lain memilih SPV ini; itu
 * ditampilkan apa adanya sebagai tanda data, bukan dipotong ke 100%.
 */
export function spvScorecard(
  survey: Pick<Survey, "questions">, current: SegmentPeriod | null, previous: SegmentPeriod | null,
  roster: Record<string, number>, scaleKeys: string[],
): SpvRow[] {
  if (!current) return [];
  const qs = new Map(survey.questions.map((q) => [q.key, q]));
  const scoreOf = (qsum: Record<string, QuestionSummary> | undefined): number | null => {
    if (!qsum) return null;
    const avgs = scaleKeys.map((k) => qs.get(k) && questionAverage(qs.get(k)!, qsum[k]).avg).filter((x): x is number => typeof x === "number");
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  };
  const pctOf = (key: string, qsum: Record<string, QuestionSummary>) => {
    const q = qs.get(key);
    return q ? kpi(q, qsum[key])?.pct ?? null : null;
  };
  return Object.entries(current.groups).map(([spv, g]) => {
    const scales: Record<string, number | null> = {};
    let weakest: SpvRow["weakest"] = null;
    for (const k of scaleKeys) {
      const p = pctOf(k, g.questions);
      scales[k] = p;
      if (p !== null && (!weakest || p < weakest.pct)) weakest = { key: k, pct: p };
    }
    const r = roster[spv] ?? null;
    return {
      spv, n: g.n, roster: r, participation: r ? (g.n / r) * 100 : null,
      score: scoreOf(g.questions), scorePrev: scoreOf(previous?.groups[spv]?.questions),
      scales, weakest, followed: pctOf("followed", g.questions), unresolved: pctOf("unresolved", g.questions),
    };
  }).sort((a, b) => (a.score ?? 9) - (b.score ?? 9) || a.spv.localeCompare(b.spv));
}

/* ─── Rapor 360 SPV ─── */

export interface Score360 { avg: number | null; raters: number; items: Record<string, number | null> }

export interface Target360 {
  block: string;
  name: string | null;
  periods: Record<string, Score360 & { self: number | null; strengths: { rater: string; text: string }[]; improvements: { rater: string; text: string }[] }>;
}

export interface Leader360 {
  name: string | null;
  periods: Record<string, Score360 & { byRater: { rater: string; avg: number | null }[]; strengths: { rater: string; text: string }[]; improvements: { rater: string; text: string }[] }>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Rapor 360 dari jawaban mentah (khusus HR). Penilaian diri (penilai = orang yang dinilai)
 * DIPISAH dari rata-rata rekan — kalau ikut dirata-ratakan, orang yang menilai dirinya 5
 * menaikkan skornya sendiri. Blok tanpa nama (belum dipastikan) tetap ditampilkan dengan
 * label bloknya supaya datanya tidak hilang.
 */
export function build360(config: SurveyConfig, responses: Pick<SurveyResponse, "period" | "answers" | "respondent_name">[], peerItems: string[], leaderItems: string[]): { leader: Leader360; targets: Target360[] } {
  const num = (v: AnswerValue | undefined) => (typeof v === "number" ? v : null);
  const txt = (v: AnswerValue | undefined) => (typeof v === "string" && v.trim() && !/^[-.\s]*$/.test(v) ? v.trim() : null);
  const leader: Leader360 = { name: config.leader ?? null, periods: {} };
  for (const r of responses) {
    const rater = String(r.answers.rater ?? r.respondent_name ?? "?");
    const vals = leaderItems.map((k) => num(r.answers[k])).filter((x): x is number => x !== null);
    if (!vals.length) continue;
    const p = (leader.periods[r.period] ??= { avg: null, raters: 0, items: {}, byRater: [], strengths: [], improvements: [] });
    p.byRater.push({ rater, avg: mean(vals) });
    const s = txt(r.answers.leader_strength), im = txt(r.answers.leader_improve);
    if (s) p.strengths.push({ rater, text: s });
    if (im) p.improvements.push({ rater, text: im });
  }
  for (const [period, p] of Object.entries(leader.periods)) {
    const rs = responses.filter((r) => r.period === period);
    for (const k of leaderItems) p.items[k] = mean(rs.map((r) => num(r.answers[k])).filter((x): x is number => x !== null));
    p.raters = p.byRater.length;
    p.avg = mean(p.byRater.map((b) => b.avg).filter((x): x is number => x !== null));
  }

  const blocks = Object.keys(config.targets ?? {}).sort();
  const targets: Target360[] = [];
  for (const b of blocks) {
    const name = config.targets?.[b] ?? null;
    const t: Target360 = { block: b, name, periods: {} };
    for (const r of responses) {
      const rater = String(r.answers.rater ?? r.respondent_name ?? "?");
      const vals = peerItems.map((k) => num(r.answers[`p${b.slice(1)}_${k}`]));
      const got = vals.filter((x): x is number => x !== null);
      if (!got.length) continue;
      const p = (t.periods[r.period] ??= { avg: null, raters: 0, items: {}, self: null, strengths: [], improvements: [] });
      if (name && rater === name) { p.self = mean(got); continue; }
      const s = txt(r.answers[`p${b.slice(1)}_strength`]), im = txt(r.answers[`p${b.slice(1)}_improve`]);
      if (s) p.strengths.push({ rater, text: s });
      if (im) p.improvements.push({ rater, text: im });
    }
    for (const [period, p] of Object.entries(t.periods)) {
      const rs = responses.filter((r) => r.period === period && !(name && String(r.answers.rater ?? r.respondent_name) === name));
      const per = rs.map((r) => peerItems.map((k) => num(r.answers[`p${b.slice(1)}_${k}`])).filter((x): x is number => x !== null)).filter((v) => v.length);
      p.raters = per.length;
      p.avg = mean(per.map((v) => mean(v)!));
      for (const k of peerItems) p.items[k] = mean(rs.map((r) => num(r.answers[`p${b.slice(1)}_${k}`])).filter((x): x is number => x !== null));
    }
    if (Object.keys(t.periods).length) targets.push(t);
  }
  return { leader, targets };
}

/* ─── Tren per orang (khusus HR) ─── */

export interface PersonTrend {
  key: string;
  name: string;
  employeeId: string | null;
  jabatan: string | null;
  points: { period: string; values: Record<string, number | null> }[];
  /** Tanda risiko: KPI risiko ≥ 2 bulan berturut-turut, atau tidak favorable ≥ 2 bulan berturut-turut. */
  alerts: string[];
}

/**
 * Riwayat satu orang lintas bulan — pengganti pilihan "Employee Name" di dashboard sheet.
 * Orang dikenali dari employee_id, lalu email, lalu nama yang dinormalkan. Jawaban yang
 * dikeluarkan (isian ganda) tidak dipakai.
 */
export function personTrends(survey: Pick<Survey, "questions" | "headline">, responses: SurveyResponse[]): PersonTrend[] {
  const kq = survey.headline.map((k) => survey.questions.find((q) => q.key === k)).filter((q): q is SurveyQuestion => !!q && hasKpi(q));
  const by = new Map<string, SurveyResponse[]>();
  for (const r of responses) {
    if (r.excluded) continue;
    const key = r.employee_id ?? r.respondent_email ?? normName(r.respondent_name ?? "");
    if (!key) continue;
    by.set(key, [...(by.get(key) ?? []), r]);
  }
  const scoreOf = (q: SurveyQuestion, v: AnswerValue | undefined): number | null => {
    const s = valuesOf(v ?? null)[0];
    if (s === undefined) return null;
    const hit = q.risk?.length ? q.risk.includes(s) : q.favorable?.length ? q.favorable.includes(s) : Number(s) >= (q.favorableMin as number);
    return hit ? 1 : 0;
  };
  return [...by.entries()].map(([key, rs]) => {
    const sorted = [...rs].sort((a, b) => a.period.localeCompare(b.period));
    const points = sorted.map((r) => ({ period: r.period, values: Object.fromEntries(kq.map((q) => [q.key, scoreOf(q, r.answers[q.key])])) }));
    const alerts: string[] = [];
    for (const q of kq) {
      let run = 0, best = 0;
      for (const p of points) {
        const bad = q.risk?.length ? p.values[q.key] === 1 : p.values[q.key] === 0;
        run = bad ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best >= 2) alerts.push(q.risk?.length ? `${q.kpiLabel ?? q.label} ${best} bulan berturut-turut` : `Tidak ${(q.kpiLabel ?? q.label).toLowerCase()} ${best} bulan berturut-turut`);
    }
    const last = sorted.at(-1)!;
    return { key, name: last.respondent_name ?? "Tanpa nama", employeeId: last.employee_id, jabatan: typeof last.answers.jabatan === "string" ? last.answers.jabatan : null, points, alerts };
  }).sort((a, b) => b.alerts.length - a.alerts.length || b.points.length - a.points.length || a.name.localeCompare(b.name));
}

/* ─── Database ─── */

export interface Conclusion { id: string; survey_id: string; period: string; category: string; body: string; source: string | null }

export const CONCLUSION_CATEGORIES = ["Company Benefit", "Work Environment", "Technical Issue", "Personal Issue"] as const;

/** Khusus HR (isinya sering menyebut nama pengangkat). */
export async function loadConclusions(surveyId: string): Promise<Conclusion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pi_survey_conclusions").select("id, survey_id, period, category, body, source")
    .eq("survey_id", surveyId).order("period").order("category");
  if (error) throw new Error(error.message);
  return (data ?? []) as Conclusion[];
}

export async function saveConclusion(c: { survey_id: string; period: string; category: string; body: string }): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = c.body.trim()
    ? await supabase.from("pi_survey_conclusions").upsert({ ...c, body: c.body.trim(), tenant_id: getActiveCompanyId(), updated_at: new Date().toISOString(), source: "Diisi HR di aplikasi" }, { onConflict: "survey_id,period,category" })
    : await supabase.from("pi_survey_conclusions").delete().eq("survey_id", c.survey_id).eq("period", c.period).eq("category", c.category);
  return error ? error.message : null;
}

export async function saveSurveyConfig(surveyId: string, config: SurveyConfig): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_surveys").update({ config, updated_at: new Date().toISOString() }).eq("id", surveyId);
  return error ? error.message : null;
}

/** Nama seluruh karyawan — untuk menyamakan ejaan nama di isian apresiasi. */
export async function loadEmployeeNames(): Promise<string[]> {
  if (!supabase) return [];
  const db = supabase;
  const rows = await fetchAll<{ full_name: string }>((a, b) => db.from("pi_employees").select("full_name").eq("tenant_id", getActiveCompanyId()).order("id").range(a, b));
  return rows.map((r) => r.full_name);
}

/** Jumlah SPG aktif per atasan di master karyawan — penyebut partisipasi rapor SPV. */
export async function loadSpgCountBySpv(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const db = supabase;
  const rows = await fetchAll<{ supervisor_name: string | null; pi_employees: { status: string } | null }>((a, b) => db.from("pi_employee_profiles")
    .select("supervisor_name, pi_employees!inner(status)").eq("work_group", "spg").eq("pi_employees.status", "active").order("employee_id").range(a, b));
  const out: Record<string, number> = {};
  for (const r of rows) if (r.supervisor_name) out[r.supervisor_name] = (out[r.supervisor_name] ?? 0) + 1;
  return out;
}

export async function loadSurveys(): Promise<Survey[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pi_surveys")
    .select("id, key, title, description, audience, cadence, questions, headline, segments, source, config")
    .eq("tenant_id", getActiveCompanyId()).order("key");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Survey[]).map((s) => ({ ...s, config: s.config ?? {} })).sort((a, b) => (a.config.order ?? 99) - (b.config.order ?? 99));
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
    .select("id, survey_id, period, title, theme, pic, plan, result, status, source, is_focus, due_date, told_back, updated_at")
    .eq("survey_id", surveyId).order("period", { ascending: false }).order("id").range(a, b));
}

/** Khusus HR — untuk owner database mengembalikan kosong. */
export async function loadResponses(surveyId: string): Promise<SurveyResponse[]> {
  if (!supabase) return [];
  const db = supabase;
  return fetchAll<SurveyResponse>((a, b) => db.from("pi_survey_responses")
    .select("id, survey_id, period, submitted_at, respondent_name, respondent_email, employee_id, answers, flags, excluded")
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

export async function loadSegments(surveyId: string, segment: string): Promise<SegmentPeriod[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("pi_survey_segments", { p_survey_id: surveyId, p_segment: segment });
  if (error) throw new Error(error.message);
  return (data ?? []) as SegmentPeriod[];
}

export async function loadCampaigns(surveyId: string): Promise<Campaign[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("pi_survey_campaigns")
    .select("id, survey_id, period, token, status, closes_at, target_count, note, created_at")
    .eq("survey_id", surveyId).order("period", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Campaign[];
}

/** Token link formulir: 24 byte acak (≈ 190 bit) — satu-satunya yang melindungi link dari ditebak. */
export function generateSurveyToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export async function createCampaign(c: { survey_id: string; period: string; closes_at: string | null; target_count: number | null; note?: string | null }): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_campaigns").insert({ ...c, tenant_id: getActiveCompanyId(), token: generateSurveyToken() });
  if (error?.code === "23505") return "Link untuk bulan itu sudah ada.";
  return error ? error.message : null;
}

export async function updateCampaign(id: string, patch: Partial<Pick<Campaign, "status" | "closes_at" | "target_count" | "note">>): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_campaigns").update(patch).eq("id", id);
  return error ? error.message : null;
}

export interface StoredInsight { id: string; survey_id: string; period: string; content: import("./pulse-insight").InsightContent; model: string | null; shared_with_owner: boolean; created_at: string }

/** HR melihat semua; owner hanya yang sudah dibagikan (dijaga database). */
export async function loadInsight(surveyId: string, period: string): Promise<StoredInsight | null> {
  if (!supabase || !period) return null;
  const { data, error } = await supabase.from("pi_survey_insights")
    .select("id, survey_id, period, content, model, shared_with_owner, created_at")
    .eq("survey_id", surveyId).eq("period", period).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredInsight | null) ?? null;
}

export async function shareInsight(id: string, shared: boolean): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_insights").update({ shared_with_owner: shared }).eq("id", id);
  return error ? error.message : null;
}

/** Minta insight AI lewat server (khusus HR). Nama disamarkan di server sebelum dikirim ke AI. */
export async function requestInsight(surveyId: string, period: string): Promise<{ insight?: StoredInsight; error?: string }> {
  if (!supabase) return { error: "Belum terhubung ke penyimpanan cloud." };
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/pulse-insight", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ surveyId, period }),
  });
  const json = await res.json().catch(() => ({}));
  return res.ok ? { insight: json.insight } : { error: json.error ?? `HTTP ${res.status}` };
}

export async function deleteAction(id: string): Promise<string | null> {
  if (!supabase) return "Belum terhubung ke penyimpanan cloud.";
  const { error } = await supabase.from("pi_survey_actions").delete().eq("id", id);
  return error ? error.message : null;
}
