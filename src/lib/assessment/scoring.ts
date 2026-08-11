/* ═══════════════════════════════════════════════════════════════════════════
   PENSKORAN MENTAH — fungsi murni. Jawaban → skor mentah per skala.

   Aturan yang dipakai dan alasannya:

   1. REVERSE KEYING (kepribadian). Item ber-key negatif dibalik dengan
      (6 − nilai) pada skala Likert 1–5. Tanpa ini, item "Saya sering menunda
      pekerjaan" akan menaikkan skor Kehati-hatian — persis kebalikan artinya.

   2. ITEM TIDAK DIJAWAB — diperlakukan berbeda per jenis tes, karena artinya
      memang berbeda:
      - Kognitif: tidak dijawab = TIDAK BENAR. Membiarkan peserta melewati soal
        sulit tanpa konsekuensi akan menghukum peserta yang berani menebak.
      - Kepribadian & SJT: tidak dijawab = TIDAK ADA DATA, bukan skor nol.
        Skor diprorata dari item yang benar-benar dijawab (rata-rata × jumlah
        item). Memberi nilai 0 pada item yang tidak dijawab akan menyeret skor
        turun dan salah dibaca sebagai sifat, padahal itu perilaku pengisian.
        Kelengkapan tetap dilaporkan lewat `answered` supaya prorata yang
        berlebihan bisa terlihat dan diberi flag oleh modul validitas.

   3. Skor mentah TIDAK berarti apa-apa sebelum dibandingkan dengan norma.
      Karena itu semua fungsi di sini berhenti di skor mentah; konversi ke
      sten/persentil ada di norms.ts.
═══════════════════════════════════════════════════════════════════════════ */

import type {
  BigFiveDomain,
  CognitiveSubtest,
  RawScaleScore,
  ResponseMap,
  ScaleId,
  SjtDimension,
} from "./types";
import { PERSONALITY_ITEMS } from "./items-personality";
import { COGNITIVE_ITEMS, COGNITIVE_ITEMS_BY_SUBTEST } from "./items-cognitive";
import { SJT_ITEMS } from "./items-sjt";

const BIG_FIVE: BigFiveDomain[] = ["O", "C", "E", "A", "N"];
const SUBTESTS: CognitiveSubtest[] = ["NUM", "VER", "LOG"];

/** Nilai Likert setelah memperhitungkan arah key. Skala 1–5 → dibalik jadi 5–1. */
export function keyedValue(response: number, keying: 1 | -1): number {
  return keying === 1 ? response : 6 - response;
}

function isAnswered(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Prorata: rata-rata item terjawab dikalikan jumlah item skala.
 *  answered = 0 → raw 0 (tidak ada data sama sekali; ditandai lewat `answered`). */
function prorate(sum: number, answered: number, itemCount: number): number {
  if (answered === 0) return 0;
  return (sum / answered) * itemCount;
}

/* ─── Kepribadian ─── */

export function scorePersonality(responses: ResponseMap): RawScaleScore[] {
  return BIG_FIVE.map((domain) => {
    // Item QC sengaja tidak masuk PERSONALITY_ITEMS — social desirability dan
    // attention check bukan bagian dari sifat yang diukur.
    const items = PERSONALITY_ITEMS.filter((i) => i.scale === domain);
    let sum = 0;
    let answered = 0;
    for (const it of items) {
      const v = responses[it.id];
      if (!isAnswered(v)) continue;
      sum += keyedValue(v, it.keying);
      answered++;
    }
    return {
      scaleId: domain as ScaleId,
      raw: round2(prorate(sum, answered, items.length)),
      answered,
      itemCount: items.length,
      maxPossible: items.length * 5,
    };
  });
}

/* ─── Kognitif ─── */

export function scoreCognitive(responses: ResponseMap): RawScaleScore[] {
  const perSubtest = SUBTESTS.map((sub) => {
    const items = COGNITIVE_ITEMS_BY_SUBTEST[sub];
    let correct = 0;
    let answered = 0;
    for (const it of items) {
      const v = responses[it.id];
      if (!isAnswered(v)) continue; // tidak dijawab = tidak benar (lihat catatan di atas)
      answered++;
      if (v === it.answerIndex) correct++;
    }
    return {
      scaleId: `COG_${sub}` as ScaleId,
      raw: correct,
      answered,
      itemCount: items.length,
      maxPossible: items.length,
    };
  });

  const total: RawScaleScore = {
    scaleId: "COG_TOTAL",
    raw: perSubtest.reduce((s, x) => s + x.raw, 0),
    answered: perSubtest.reduce((s, x) => s + x.answered, 0),
    itemCount: COGNITIVE_ITEMS.length,
    maxPossible: COGNITIVE_ITEMS.length,
  };

  return [...perSubtest, total];
}

/* ─── SJT ─── */

export function scoreSjt(responses: ResponseMap, itemIds?: string[]): RawScaleScore[] {
  // itemIds membatasi penilaian pada item yang benar-benar diberikan ke peserta
  // (baterai per industri memberi subset item). Tanpa ini, item yang tidak
  // pernah ditampilkan akan ikut memperbesar itemCount dan menurunkan skor.
  const pool = itemIds ? SJT_ITEMS.filter((i) => itemIds.includes(i.id)) : SJT_ITEMS;
  const dims = [...new Set(pool.map((i) => i.dimension))] as SjtDimension[];

  const perDim = dims.map((dim) => {
    const items = pool.filter((i) => i.dimension === dim);
    let sum = 0;
    let answered = 0;
    for (const it of items) {
      const v = responses[it.id];
      if (!isAnswered(v)) continue;
      const opt = it.options[v];
      if (!opt) continue; // index di luar jangkauan = data rusak, bukan jawaban
      sum += opt.effectiveness;
      answered++;
    }
    return {
      scaleId: `SJT_${dim}` as ScaleId,
      raw: round2(prorate(sum, answered, items.length)),
      answered,
      itemCount: items.length,
      maxPossible: items.length * 5,
    };
  });

  let totalSum = 0;
  let totalAnswered = 0;
  for (const it of pool) {
    const v = responses[it.id];
    if (!isAnswered(v)) continue;
    const opt = it.options[v];
    if (!opt) continue;
    totalSum += opt.effectiveness;
    totalAnswered++;
  }

  const total: RawScaleScore = {
    scaleId: "SJT_TOTAL",
    raw: round2(prorate(totalSum, totalAnswered, pool.length)),
    answered: totalAnswered,
    itemCount: pool.length,
    maxPossible: pool.length * 5,
  };

  return [...perDim, total];
}

/* ─── Gabungan ─── */

/** Skor mentah seluruh skala yang relevan dengan item yang benar-benar disajikan.
 *  `presentedItemIds` = gabungan itemIds dari section baterai yang dikerjakan. */
export function scoreAll(responses: ResponseMap, presentedItemIds: string[]): RawScaleScore[] {
  const presented = new Set(presentedItemIds);
  const out: RawScaleScore[] = [];

  if (PERSONALITY_ITEMS.some((i) => presented.has(i.id))) out.push(...scorePersonality(responses));
  if (COGNITIVE_ITEMS.some((i) => presented.has(i.id))) out.push(...scoreCognitive(responses));

  const sjtPresented = SJT_ITEMS.filter((i) => presented.has(i.id)).map((i) => i.id);
  if (sjtPresented.length > 0) out.push(...scoreSjt(responses, sjtPresented));

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
