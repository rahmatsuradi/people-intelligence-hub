/* ═══════════════════════════════════════════════════════════════════════════
   NORMA & KONVERSI SKOR — fungsi murni.

   Kenapa norma wajib: skor mentah 34 dari 50 tidak berarti apa-apa. Yang punya
   arti adalah posisi skor itu di antara orang lain yang mengerjakan tes yang
   sama. Semua laporan seleksi di perusahaan besar bekerja dengan skor
   ter-normakan (sten / persentil / T-score), bukan skor mentah.

   NORMA = DATA BER-VERSI, sama seperti tarif di modul Pay. Menambah norma baru
   berarti menambah BARIS baru dengan `effectiveDate` baru — bukan menimpa yang
   lama. Laporan lama harus tetap bisa dihitung ulang dengan norma yang berlaku
   saat itu, kalau tidak angkanya berubah sendiri di kemudian hari.

   KEJUJURAN NORMA — bagian terpenting file ini:
   Norma bawaan di bawah berlabel `synthetic_demo` dan sampleSize = 0. Angkanya
   TIDAK berasal dari sampel pekerja Indonesia mana pun; itu nilai tengah yang
   masuk akal supaya demo bisa berjalan. Selama norma masih sintetis, persentil
   yang keluar TIDAK boleh dipakai untuk menolak pelamar — pakai untuk
   membandingkan antar-kandidat dalam satu lowongan (perbandingan internal tetap
   sah karena semua diukur dengan penggaris yang sama).
   Norma nyata dibangun lewat buildNormGroupFromSample() setelah terkumpul
   minimal MIN_LOCAL_NORM_N peserta pada populasi yang sebanding.
═══════════════════════════════════════════════════════════════════════════ */

import type { NormEntry, NormGroup, NormedScaleScore, RawScaleScore, ScaleId, ScoreBand } from "./types";

/** Jumlah minimum peserta sebelum norma lokal layak dipakai menggantikan norma
 *  sintetis. 100 adalah ambang praktis yang lazim disebut untuk norma lokal
 *  sementara; di bawah itu SD sampel terlalu tidak stabil. */
export const MIN_LOCAL_NORM_N = 100;

/* ─── Konversi statistik ─── */

/** Fungsi distribusi kumulatif normal baku.
 *  Pendekatan Abramowitz & Stegun 7.1.26 (galat < 1,5 × 10⁻⁷) — cukup akurat
 *  untuk persentil yang dibulatkan ke bilangan bulat. */
export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function toZ(raw: number, mean: number, sd: number): number {
  if (!Number.isFinite(sd) || sd <= 0) return 0; // norma rusak → jangan mengarang sebaran
  return (raw - mean) / sd;
}

/** Persentil 1–99. Ujung sengaja dipotong: persentil 0 atau 100 memberi kesan
 *  "tidak ada yang lebih rendah/tinggi", padahal itu artefak ukuran sampel. */
export function toPercentile(z: number): number {
  const p = Math.round(normalCdf(z) * 100);
  return Math.min(99, Math.max(1, p));
}

/** Sten (standard ten): M = 5,5 ; SD = 2 ; rentang 1–10. */
export function toSten(z: number): number {
  return Math.min(10, Math.max(1, Math.round(5.5 + 2 * z)));
}

/** T-score: M = 50 ; SD = 10. */
export function toTScore(z: number): number {
  return Math.round(50 + 10 * z);
}

/** Stanine: M = 5 ; SD = 2 ; rentang 1–9. */
export function toStanine(z: number): number {
  return Math.min(9, Math.max(1, Math.round(5 + 2 * z)));
}

export function stenToBand(sten: number): ScoreBand {
  if (sten <= 2) return "sangat_rendah";
  if (sten <= 4) return "rendah";
  if (sten <= 6) return "rata_rata";
  if (sten <= 8) return "tinggi";
  return "sangat_tinggi";
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  sangat_rendah: "Sangat Rendah",
  rendah: "Di Bawah Rata-rata",
  rata_rata: "Rata-rata",
  tinggi: "Di Atas Rata-rata",
  sangat_tinggi: "Sangat Tinggi",
};

/* ─── Norma bawaan (SINTETIS) ─── */

const entry = (scaleId: ScaleId, mean: number, sd: number): NormEntry => ({ scaleId, mean, sd });

/** Norma demo umum. Nilai mean/SD dipilih agar sebaran skor demo terlihat wajar
 *  (mendekati titik tengah skala dengan SD sekitar 1/5 rentang). Sekali lagi:
 *  ini BUKAN norma empiris. */
export const NORM_DEMO_UMUM: NormGroup = {
  id: "NORM-DEMO-UMUM-2026",
  label: "Norma demo — umum (sintetis)",
  provenance: "synthetic_demo",
  sampleSize: 0,
  effectiveDate: "2026-01-01",
  notes:
    "Nilai sintetis untuk keperluan demo/portofolio. Bukan hasil pengambilan sampel. Jangan dipakai sebagai dasar keputusan penerimaan.",
  entries: [
    // Kepribadian: skor terprorata 10 item × 1–5 → rentang 10–50.
    entry("O", 34, 5.5),
    entry("C", 36, 5.5),
    entry("E", 32, 6.0),
    entry("A", 37, 5.0),
    entry("N", 28, 6.5),
    // Kognitif: jumlah jawaban benar per sub-tes (0–10) dan total (0–30).
    entry("COG_NUM", 6.0, 2.0),
    entry("COG_VER", 6.5, 1.9),
    entry("COG_LOG", 6.0, 2.1),
    entry("COG_TOTAL", 18.5, 5.0),
    // SJT: 2 item per dimensi (maks 10) ; total 12 item (maks 60).
    entry("SJT_LEAD", 8.0, 1.5),
    entry("SJT_INTEG", 8.4, 1.4),
    entry("SJT_COLLAB", 8.0, 1.5),
    entry("SJT_PROBSOLV", 8.0, 1.6),
    entry("SJT_ADAPT", 8.0, 1.6),
    entry("SJT_SAFETY", 8.4, 1.5),
    entry("SJT_TOTAL", 48.8, 6.0),
  ],
};

export const DEFAULT_NORM_GROUPS: NormGroup[] = [NORM_DEMO_UMUM];

/** Memilih norma yang BERLAKU pada tanggal tertentu: effectiveDate terbaru yang
 *  ≤ tanggal asesmen. Pola identik dengan pickStatutoryConfigForPeriod() di
 *  modul Pay, dan alasannya sama — hasil lama harus tetap reproducible. */
export function pickNormGroupForDate(groups: NormGroup[], isoDate: string, groupId?: string): NormGroup | null {
  const pool = groupId ? groups.filter((g) => g.id === groupId) : groups;
  const day = isoDate.slice(0, 10);
  const eligible = pool
    .filter((g) => g.effectiveDate <= day)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
  return eligible[0] ?? null;
}

/* ─── Penerapan norma ─── */

export interface NormApplication {
  scores: NormedScaleScore[];
  /** Skala yang tidak punya baris norma. Sengaja TIDAK diberi skor tebakan —
   *  lebih baik hilang dari laporan daripada muncul dengan angka karangan. */
  missingNorms: ScaleId[];
}

export function applyNorms(rawScores: RawScaleScore[], group: NormGroup): NormApplication {
  const byScale = new Map(group.entries.map((e) => [e.scaleId, e]));
  const scores: NormedScaleScore[] = [];
  const missingNorms: ScaleId[] = [];

  for (const raw of rawScores) {
    const norm = byScale.get(raw.scaleId);
    if (!norm) {
      missingNorms.push(raw.scaleId);
      continue;
    }
    const z = toZ(raw.raw, norm.mean, norm.sd);
    const sten = toSten(z);
    scores.push({
      ...raw,
      z: Math.round(z * 100) / 100,
      percentile: toPercentile(z),
      sten,
      tScore: toTScore(z),
      stanine: toStanine(z),
      band: stenToBand(sten),
      normId: group.id,
      normLabel: group.label,
    });
  }

  return { scores, missingNorms };
}

/* ─── Membangun norma lokal dari data nyata ─── */

export interface NormSampleRow {
  scaleId: ScaleId;
  raw: number;
}

/** Menghitung norma lokal dari kumpulan skor mentah peserta nyata.
 *  Memakai SD sampel (pembagi n − 1), bukan SD populasi: data yang terkumpul
 *  adalah sampel dari pelamar yang akan datang, bukan seluruh populasinya.
 *  Mengembalikan null bila jumlah peserta di bawah MIN_LOCAL_NORM_N — norma
 *  dari 12 orang lebih menyesatkan daripada tidak punya norma sama sekali. */
export function buildNormGroupFromSample(
  rows: NormSampleRow[],
  meta: { id: string; label: string; effectiveDate: string; notes?: string },
  minN: number = MIN_LOCAL_NORM_N,
): NormGroup | null {
  const grouped = new Map<ScaleId, number[]>();
  for (const r of rows) {
    if (!Number.isFinite(r.raw)) continue;
    const list = grouped.get(r.scaleId) ?? [];
    list.push(r.raw);
    grouped.set(r.scaleId, list);
  }

  const nPerScale = [...grouped.values()].map((v) => v.length);
  const n = nPerScale.length ? Math.min(...nPerScale) : 0;
  if (n < minN) return null;

  const entries: NormEntry[] = [];
  for (const [scaleId, values] of grouped) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
    const sd = Math.sqrt(variance);
    // SD nol (semua peserta identik) → skala tidak membedakan siapa pun.
    // Dilewati, bukan dipaksakan; toZ() akan tetap aman bila lolos.
    if (!Number.isFinite(sd) || sd <= 0) continue;
    entries.push({ scaleId, mean: round2(mean), sd: round2(sd) });
  }

  if (entries.length === 0) return null;

  return {
    id: meta.id,
    label: meta.label,
    provenance: "local_sample",
    sampleSize: n,
    effectiveDate: meta.effectiveDate,
    entries,
    notes: meta.notes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
