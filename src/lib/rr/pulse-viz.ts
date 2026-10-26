/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Check — pembentuk data untuk grafik (fungsi murni, diuji di pulse-viz.test.ts).

   Semua grafik di dashboard membaca hasil fungsi-fungsi ini, bukan menghitung sendiri di
   komponen, supaya angka di grafik, tabel pendamping, dan tooltip selalu sama.
   ═══════════════════════════════════════════════════════════════════════════ */

import { kpi, periodLabel, questionAverage, spvScorecard, type PeriodSummary, type QuestionSummary, type SegmentPeriod, type Survey, type SurveyQuestion, type ThemeDef, type ThemePeriod } from "./pulse";

/* ─── Sebaran jawaban per bulan (diverging / ordinal bars) ─── */

export interface ShareRow { period: string; n: number; suppressed: boolean; parts: { value: string; label: string; count: number; pct: number }[] }

/**
 * Persen tiap pilihan per bulan, urut sesuai opsi di definisi pertanyaan. Penyebut = yang MENJAWAB
 * pertanyaan itu (bukan seluruh responden); bulan yang disembunyikan (< 3 jawaban) tetap muncul
 * sebagai baris kosong supaya sumbu waktunya tidak melompat.
 */
export function optionShares(q: SurveyQuestion, summaries: PeriodSummary[]): ShareRow[] {
  return summaries.map((p) => {
    const s: QuestionSummary | undefined = p.suppressed ? undefined : p.questions[q.key];
    const answered = s?.answered ?? 0;
    const parts = (q.options ?? []).map((o) => {
      const count = s?.counts[o.value] ?? 0;
      return { value: o.value, label: o.label ?? o.value, count, pct: answered ? (count / answered) * 100 : 0 };
    });
    return { period: p.period, n: answered, suppressed: !!p.suppressed || !answered, parts };
  });
}

/* ─── Peta tema keluhan (heatmap) ─── */

export interface ThemeCell { period: string; count: number | null; pct: number | null; n: number }
export interface ThemeRow {
  key: string;
  label: string;
  group?: string;
  cells: ThemeCell[];
  latest: number | null;
  previous: number | null;
  /** Selisih persen responden (poin) bulan terakhir vs sebelumnya; null bila salah satunya tidak ada. */
  deltaPct: number | null;
  peak: number;
}

/**
 * Tema × bulan. Nilai sel = jumlah orang yang menyebut tema itu; warna memakai PERSEN dari responden
 * bulan itu, karena n tiap bulan berbeda (105 vs 150 SPG) — membandingkan jumlah mentah menyesatkan.
 * Baris diurut dari yang paling banyak disebut di bulan terakhir.
 */
export function themeMatrix(defs: ThemeDef[], data: ThemePeriod[], periods: string[]): ThemeRow[] {
  const by = new Map(data.map((d) => [d.period, d]));
  const rows = defs.map((d): ThemeRow => {
    const cells = periods.map((period): ThemeCell => {
      const t = by.get(period);
      if (!t || t.n < 3) return { period, count: null, pct: null, n: t?.n ?? 0 };
      const count = t.themes[d.key] ?? 0;
      return { period, count, pct: (count / t.n) * 100, n: t.n };
    });
    const withData = cells.filter((c) => c.count !== null);
    const last = withData.at(-1) ?? null;
    const prev = withData.at(-2) ?? null;
    return {
      key: d.key, label: d.label, group: d.group, cells,
      latest: last?.count ?? null, previous: prev?.count ?? null,
      deltaPct: last && prev ? (last.pct as number) - (prev.pct as number) : null,
      peak: Math.max(0, ...cells.map((c) => c.pct ?? 0)),
    };
  });
  return rows.sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1) || a.label.localeCompare(b.label, "id"));
}

/** Tema yang disebut ≥ 1 orang di bulan terakhir, paling banyak dulu. */
export function topThemes(rows: ThemeRow[], limit = 6): ThemeRow[] {
  return rows.filter((r) => (r.latest ?? 0) > 0).slice(0, limit);
}

/* ─── Riwayat skor per SPV (small multiples / dot plot) ─── */

export interface SpvSeries { spv: string; points: { period: string; score: number | null; n: number }[]; latest: number | null; previous: number | null }

/** Skor rata-rata (6 skala) tiap SPV tiap bulan; bulan tanpa data (< 3 SPG menjawab) = null, bukan 0. */
export function spvSeries(survey: Pick<Survey, "questions">, segments: SegmentPeriod[], scaleKeys: string[]): SpvSeries[] {
  const names = new Set<string>();
  for (const s of segments) for (const k of Object.keys(s.groups)) names.add(k);
  const perPeriod = segments.map((seg, i) => ({ period: seg.period, rows: new Map(spvScorecard(survey, seg, i > 0 ? segments[i - 1] : null, {}, scaleKeys).map((r) => [r.spv, r])) }));
  return [...names].map((spv) => {
    const points = perPeriod.map((p) => ({ period: p.period, score: p.rows.get(spv)?.score ?? null, n: p.rows.get(spv)?.n ?? 0 }));
    const withScore = points.filter((p) => p.score !== null);
    return { spv, points, latest: withScore.at(-1)?.score ?? null, previous: withScore.at(-2)?.score ?? null };
  }).sort((a, b) => (a.latest ?? 9) - (b.latest ?? 9) || a.spv.localeCompare(b.spv));
}

/* ─── Kelengkapan data (jawab pertanyaan "apakah cuma segini?") ─── */

export interface CoverageRow { period: string; label: string; total: number; counted: number; excluded: number; people: number }

export function coverage(summaries: PeriodSummary[]): CoverageRow[] {
  return summaries.map((p) => ({
    period: p.period, label: periodLabel(p.period), counted: p.n,
    total: p.n_total ?? p.n, excluded: p.n_excluded ?? 0, people: p.n_people ?? p.n,
  }));
}

/* ─── Skor ringkas satu survei untuk halaman Ikhtisar ─── */

export interface HeadlineKpi { key: string; label: string; hint: string; pct: number | null; delta: number | null; better: boolean | null; risk: boolean; n: number; series: (number | null)[] }

/** Angka utama survei pada `period` beserta perubahannya dan 8 titik tren terakhir. */
export function headlineKpis(survey: Pick<Survey, "questions" | "headline">, summaries: PeriodSummary[], period: string, maxPoints = 8): HeadlineKpi[] {
  const idx = summaries.findIndex((p) => p.period === period);
  if (idx < 0) return [];
  const cur = summaries[idx];
  const prev = summaries.slice(0, idx).reverse().find((p) => !p.suppressed);
  const window = summaries.slice(Math.max(0, idx - maxPoints + 1), idx + 1);
  const out: HeadlineKpi[] = [];
  for (const k of survey.headline) {
    const q = survey.questions.find((x) => x.key === k);
    if (!q || !(q.favorable?.length || q.risk?.length || q.favorableMin !== undefined)) continue;
    const a = cur.suppressed ? null : kpi(q, cur.questions[q.key]);
    const b = prev ? kpi(q, prev.questions[q.key]) : null;
    const delta = a?.pct != null && b?.pct != null ? a.pct - b.pct : null;
    const risk = !!q.risk?.length;
    out.push({
      key: q.key, label: q.kpiLabel ?? q.label, hint: q.kpiHint ?? "", pct: a?.pct ?? null, delta,
      better: delta === null || Math.round(delta) === 0 ? null : risk ? delta < 0 : delta > 0, risk, n: a?.n ?? 0,
      series: window.map((p) => (p.suppressed ? null : kpi(q, p.questions[q.key])?.pct ?? null)),
    });
  }
  return out;
}

/** Skor rata-rata satu pertanyaan skala per bulan — dipakai tooltip & tabel pendamping. */
export function scaleAverages(q: SurveyQuestion, summaries: PeriodSummary[]): { period: string; avg: number | null; n: number }[] {
  return summaries.map((p) => ({ period: p.period, ...(p.suppressed ? { avg: null, n: 0 } : questionAverage(q, p.questions[q.key])) }));
}
