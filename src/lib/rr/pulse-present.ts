/* ═══════════════════════════════════════════════════════════════════════════
   Mode Presentasi Pulse Check — rumusan temuan untuk judul slide (fungsi murni, diuji di pulse-present.test.ts).

   Judul tiap slide adalah KESIMPULAN yang dihitung dari data, bukan tulisan tetap, supaya
   angka di slide selalu sama dengan angka di dashboard dan tidak basi saat bulan berganti.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { Leader360, SpvRow } from "./pulse";

/** Selisih yang dianggap bergerak (skala 1–5). Di bawah ini dianggap sama. */
export const MOVE_EPS = 0.05;

export interface SpvHighlights {
  lowest: SpvRow | null;
  highest: SpvRow | null;
  /** SPV × penilaian dengan % nilai 4–5 paling rendah. */
  weakestCell: { spv: string; scale: string; pct: number } | null;
  /** Penurunan / kenaikan skor terbesar dibanding bulan lalu (null bila tidak ada yang bergerak ≥ MOVE_EPS). */
  biggestDrop: { spv: string; delta: number } | null;
  biggestRise: { spv: string; delta: number } | null;
  /** Jumlah SPV yang skornya turun ≥ MOVE_EPS, naik ≥ MOVE_EPS, atau tidak bergerak. */
  down: number; up: number; flat: number;
}

/** Ringkasan rapor SPV. `rows` = hasil spvScorecard (sudah terurut dari skor terendah). */
export function spvHighlights(rows: SpvRow[], scaleKeys: string[], label: (key: string) => string): SpvHighlights {
  const scored = rows.filter((r) => r.score !== null);
  let weakestCell: SpvHighlights["weakestCell"] = null;
  for (const r of rows) for (const k of scaleKeys) {
    const v = r.scales[k];
    if (v !== null && v !== undefined && (!weakestCell || v < weakestCell.pct)) weakestCell = { spv: r.spv, scale: label(k), pct: v };
  }
  const moves = rows
    .filter((r) => r.score !== null && r.scorePrev !== null)
    .map((r) => ({ spv: r.spv, delta: (r.score as number) - (r.scorePrev as number) }));
  const drop = [...moves].sort((a, b) => a.delta - b.delta)[0];
  const rise = [...moves].sort((a, b) => b.delta - a.delta)[0];
  return {
    lowest: scored[0] ?? null,
    highest: scored.at(-1) ?? null,
    weakestCell,
    biggestDrop: drop && drop.delta <= -MOVE_EPS ? drop : null,
    biggestRise: rise && rise.delta >= MOVE_EPS ? rise : null,
    down: moves.filter((m) => m.delta <= -MOVE_EPS).length,
    up: moves.filter((m) => m.delta >= MOVE_EPS).length,
    flat: moves.filter((m) => Math.abs(m.delta) < MOVE_EPS).length,
  };
}

/** Nama SPV → "SPV A", "SPV B", … menurut urutan abjad, supaya stabil antar-slide dan antar-muat. */
export function maskNames(names: string[], prefix = "SPV"): Record<string, string> {
  const uniq = [...new Set(names)].sort((a, b) => a.localeCompare(b, "id"));
  return Object.fromEntries(uniq.map((n, i) => [n, `${prefix} ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`]));
}

export interface LeaderAspect { key: string; label: string; current: number | null; previous: number | null }

export interface LeaderView {
  period: string;
  previousPeriod: string | null;
  raters: number;
  previousRaters: number | null;
  avg: number | null;
  previousAvg: number | null;
  aspects: LeaderAspect[];
  /** Rata-rata terendah dan tertinggi antar-penilai (tanpa nama). null bila < 2 penilai. */
  spread: { min: number; max: number } | null;
  weakest: LeaderAspect | null;
  strongest: LeaderAspect | null;
  strengths: string[];
  improvements: string[];
}

/** Rapor Koordinator SPV untuk satu putaran, dibanding putaran sebelumnya. Kutipan dikembalikan TANPA nama penilai. */
export function leaderView(leader: Leader360, period: string, keys: string[], label: (key: string) => string): LeaderView | null {
  const cur = leader.periods[period];
  if (!cur) return null;
  const earlier = Object.keys(leader.periods).filter((p) => p < period).sort();
  const previousPeriod = earlier.at(-1) ?? null;
  const prev = previousPeriod ? leader.periods[previousPeriod] : null;
  const aspects: LeaderAspect[] = keys.map((k) => ({ key: k, label: label(k), current: cur.items[k] ?? null, previous: prev?.items[k] ?? null }));
  const withScore = aspects.filter((a) => a.current !== null);
  const sorted = [...withScore].sort((a, b) => (a.current as number) - (b.current as number));
  const per = cur.byRater.map((b) => b.avg).filter((x): x is number => x !== null);
  return {
    period, previousPeriod, raters: cur.raters, previousRaters: prev?.raters ?? null, avg: cur.avg, previousAvg: prev?.avg ?? null,
    aspects,
    spread: per.length >= 2 ? { min: Math.min(...per), max: Math.max(...per) } : null,
    weakest: sorted[0] ?? null,
    strongest: sorted.at(-1) ?? null,
    strengths: cur.strengths.map((s) => s.text),
    improvements: cur.improvements.map((s) => s.text),
  };
}
