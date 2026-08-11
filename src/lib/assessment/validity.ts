/* ═══════════════════════════════════════════════════════════════════════════
   INDEKS KUALITAS JAWABAN (response validity) — fungsi murni.

   Kenapa ini ada: tes daring tanpa pengawas selalu menghadapi tiga masalah —
   peserta mengisi asal-asalan, peserta menjawab seperti yang "seharusnya"
   dijawab (impression management), dan peserta tidak menyelesaikan tes. Tanpa
   indeks ini, ketiganya masuk ke laporan sebagai profil kepribadian yang
   terlihat rapi dan sepenuhnya keliru. Semua penyedia asesmen korporat besar
   menyertakan pemeriksaan sejenis.

   YANG TIDAK DILAKUKAN MODUL INI: mengoreksi skor secara otomatis berdasarkan
   indeks ini. Mengurangi skor karena "terlalu sempurna" adalah tebakan yang
   dibungkus angka. Yang dilakukan: memberi status dan menyarankan verifikasi
   (wawancara probing, tes ulang dengan pengawas). Keputusan tetap pada manusia.
═══════════════════════════════════════════════════════════════════════════ */

import type { ResponseMap, SectionTiming, ValidityIndex, ValidityReport, ValidityStatus } from "./types";
import {
  ATTENTION_CHECK_KEY,
  INCONSISTENCY_PAIRS,
  PERSONALITY_ITEM_BY_ID,
  PERSONALITY_QC_ITEMS,
  PERSONALITY_SECTION_ITEMS,
} from "./items-personality";
import { keyedValue } from "./scoring";

/* Ambang batas dikumpulkan di satu tempat supaya bisa disetel tanpa mengubah
   logika, dan supaya terlihat jelas bahwa ini pilihan praktis — bukan konstanta
   universal yang berasal dari suatu standar. */
export const VALIDITY_THRESHOLDS = {
  longString: { warn: 8, fail: 12 },
  inconsistency: { warn: 2.0, fail: 2.8 },   // rata-rata selisih pada skala 0–4
  desirability: { warn: 4.25, fail: 4.75 },  // rata-rata Likert 1–5
  completion: { warn: 0.9, fail: 0.75 },     // proporsi item terjawab
  secPerItem: { warn: 3.0, fail: 2.0 },      // kecepatan mengisi inventori
} as const;

const worse = (a: ValidityStatus, b: ValidityStatus): ValidityStatus => {
  const rank: Record<ValidityStatus, number> = { ok: 0, perhatian: 1, meragukan: 2 };
  return rank[a] >= rank[b] ? a : b;
};

/* ─── Indeks individual ─── */

/** Jumlah attention check yang gagal (jawaban tidak sesuai instruksi di dalam item). */
export function attentionCheckFailures(responses: ResponseMap): { failed: number; total: number } {
  const ids = Object.keys(ATTENTION_CHECK_KEY);
  let failed = 0;
  for (const id of ids) {
    const v = responses[id];
    // Tidak dijawab dihitung gagal: item ini justru menguji apakah teksnya dibaca.
    if (v !== ATTENTION_CHECK_KEY[id]) failed++;
  }
  return { failed, total: ids.length };
}

/** Deret jawaban identik terpanjang pada inventori kepribadian (long-string index).
 *  Menandai pola "lurus ke bawah" — indikasi klasik pengisian tanpa membaca. */
export function longestIdenticalRun(responses: ResponseMap, itemIds: string[]): number {
  let best = 0;
  let run = 0;
  let prev: number | undefined;
  for (const id of itemIds) {
    const v = responses[id];
    if (typeof v !== "number") {
      run = 0;
      prev = undefined;
      continue;
    }
    run = v === prev ? run + 1 : 1;
    prev = v;
    if (run > best) best = run;
  }
  return best;
}

/** Rata-rata selisih pada pasangan item yang isinya berlawanan arah.
 *  Nilai dihitung SETELAH reverse-keying, sehingga dua jawaban yang konsisten
 *  seharusnya berdekatan. Rentang 0 (konsisten sempurna) – 4 (bertolak belakang). */
export function inconsistencyIndex(responses: ResponseMap): { value: number; pairsUsed: number } {
  let sum = 0;
  let used = 0;
  for (const [aId, bId] of INCONSISTENCY_PAIRS) {
    const a = responses[aId];
    const b = responses[bId];
    const itemA = PERSONALITY_ITEM_BY_ID[aId];
    const itemB = PERSONALITY_ITEM_BY_ID[bId];
    if (typeof a !== "number" || typeof b !== "number" || !itemA || !itemB) continue;
    sum += Math.abs(keyedValue(a, itemA.keying) - keyedValue(b, itemB.keying));
    used++;
  }
  return { value: used === 0 ? 0 : Math.round((sum / used) * 100) / 100, pairsUsed: used };
}

/** Rata-rata jawaban pada skala impression management buatan sendiri (1–5).
 *  Skor tinggi = peserta menyetujui pernyataan yang hampir mustahil benar bagi
 *  siapa pun ("tidak pernah sekali pun terlambat"). */
export function desirabilityScore(responses: ResponseMap): { value: number; itemsUsed: number } {
  const items = PERSONALITY_QC_ITEMS.filter((i) => i.qc === "desirability");
  let sum = 0;
  let used = 0;
  for (const it of items) {
    const v = responses[it.id];
    if (typeof v !== "number") continue;
    sum += v;
    used++;
  }
  return { value: used === 0 ? 0 : Math.round((sum / used) * 100) / 100, itemsUsed: used };
}

/** Proporsi item yang dijawab dari seluruh item yang disajikan. */
export function completionRate(responses: ResponseMap, presentedItemIds: string[]): number {
  if (presentedItemIds.length === 0) return 0;
  const answered = presentedItemIds.filter((id) => typeof responses[id] === "number").length;
  return Math.round((answered / presentedItemIds.length) * 1000) / 1000;
}

/** Detik rata-rata per item pada section inventori kepribadian.
 *  Terlalu cepat = tidak mungkin membaca pernyataannya. */
export function secondsPerItem(timings: SectionTiming[], sectionId: string, itemsAnswered: number): number {
  const t = timings.find((x) => x.sectionId === sectionId);
  if (!t || itemsAnswered === 0 || !Number.isFinite(t.elapsedSec)) return 0;
  return Math.round((t.elapsedSec / itemsAnswered) * 100) / 100;
}

/* ─── Laporan gabungan ─── */

export function buildValidityReport(
  responses: ResponseMap,
  presentedItemIds: string[],
  timings: SectionTiming[],
): ValidityReport {
  const indices: ValidityIndex[] = [];

  /* 1. Attention check */
  const att = attentionCheckFailures(responses);
  const attStatus: ValidityStatus = att.failed === 0 ? "ok" : att.failed === 1 ? "perhatian" : "meragukan";
  const attentionPresented = Object.keys(ATTENTION_CHECK_KEY).some((id) => presentedItemIds.includes(id));
  if (attentionPresented) {
    indices.push({
      id: "attention",
      label: "Pemeriksaan ketelitian membaca",
      value: att.failed,
      unit: "count",
      status: attStatus,
      explanation:
        att.failed === 0
          ? `Lolos ${att.total} dari ${att.total} item pemeriksaan — instruksi di dalam item dibaca dan diikuti.`
          : `Gagal pada ${att.failed} dari ${att.total} item pemeriksaan. Ada indikasi item tidak dibaca satu per satu.`,
    });
  }

  /* 2. Long-string */
  const personalityIds = PERSONALITY_SECTION_ITEMS.map((i) => i.id).filter((id) =>
    presentedItemIds.includes(id),
  );
  if (personalityIds.length > 0) {
    const run = longestIdenticalRun(responses, personalityIds);
    const st: ValidityStatus =
      run >= VALIDITY_THRESHOLDS.longString.fail
        ? "meragukan"
        : run >= VALIDITY_THRESHOLDS.longString.warn
          ? "perhatian"
          : "ok";
    indices.push({
      id: "long_string",
      label: "Deret jawaban identik terpanjang",
      value: run,
      unit: "count",
      status: st,
      explanation:
        st === "ok"
          ? `Jawaban bervariasi wajar (deret identik terpanjang ${run} item).`
          : `Terdapat ${run} item berurutan dengan jawaban sama persis — pola khas pengisian tanpa membaca.`,
    });

    /* 3. Konsistensi */
    const inc = inconsistencyIndex(responses);
    if (inc.pairsUsed > 0) {
      const st2: ValidityStatus =
        inc.value >= VALIDITY_THRESHOLDS.inconsistency.fail
          ? "meragukan"
          : inc.value >= VALIDITY_THRESHOLDS.inconsistency.warn
            ? "perhatian"
            : "ok";
      indices.push({
        id: "inconsistency",
        label: "Indeks inkonsistensi jawaban",
        value: inc.value,
        unit: "ratio",
        status: st2,
        explanation:
          st2 === "ok"
            ? `Jawaban pada ${inc.pairsUsed} pasang pernyataan berlawanan saling konsisten (rata-rata selisih ${inc.value} dari maksimum 4).`
            : `Rata-rata selisih ${inc.value} dari maksimum 4 pada ${inc.pairsUsed} pasang pernyataan berlawanan — jawaban saling bertentangan.`,
      });
    }

    /* 4. Impression management */
    const sd = desirabilityScore(responses);
    if (sd.itemsUsed > 0) {
      const st3: ValidityStatus =
        sd.value >= VALIDITY_THRESHOLDS.desirability.fail
          ? "meragukan"
          : sd.value >= VALIDITY_THRESHOLDS.desirability.warn
            ? "perhatian"
            : "ok";
      indices.push({
        id: "desirability",
        label: "Kecenderungan menampilkan diri ideal",
        value: sd.value,
        unit: "score",
        status: st3,
        explanation:
          st3 === "ok"
            ? `Peserta bersedia mengakui hal yang tidak ideal (rata-rata ${sd.value} dari 5).`
            : `Peserta menyetujui pernyataan yang hampir mustahil benar bagi siapa pun (rata-rata ${sd.value} dari 5). Profil kepribadian berpotensi lebih positif dari keadaan sebenarnya — verifikasi lewat contoh perilaku konkret saat wawancara.`,
      });
    }

    /* 6. Kecepatan pengisian */
    const answeredPersonality = personalityIds.filter((id) => typeof responses[id] === "number").length;
    const spi = secondsPerItem(timings, "sec-personality", answeredPersonality);
    if (spi > 0) {
      const st5: ValidityStatus =
        spi <= VALIDITY_THRESHOLDS.secPerItem.fail
          ? "meragukan"
          : spi <= VALIDITY_THRESHOLDS.secPerItem.warn
            ? "perhatian"
            : "ok";
      indices.push({
        id: "speed",
        label: "Kecepatan mengisi inventori",
        value: spi,
        unit: "sec",
        status: st5,
        explanation:
          st5 === "ok"
            ? `Rata-rata ${spi} detik per pernyataan — wajar untuk membaca dan menimbang.`
            : `Rata-rata hanya ${spi} detik per pernyataan. Terlalu cepat untuk membaca isi pernyataannya.`,
      });
    }
  }

  /* 5. Kelengkapan */
  const comp = completionRate(responses, presentedItemIds);
  const st4: ValidityStatus =
    comp < VALIDITY_THRESHOLDS.completion.fail
      ? "meragukan"
      : comp < VALIDITY_THRESHOLDS.completion.warn
        ? "perhatian"
        : "ok";
  indices.push({
    id: "completion",
    label: "Kelengkapan pengerjaan",
    value: comp,
    unit: "ratio",
    status: st4,
    explanation: `${Math.round(comp * 100)}% item dijawab dari ${presentedItemIds.length} item yang disajikan.${
      st4 === "ok" ? "" : " Skala dengan item terlewat banyak menjadi kurang dapat diandalkan."
    }`,
  });

  /* Status keseluruhan: satu indikator 'meragukan' cukup untuk menandai seluruh
     hasil; dua 'perhatian' juga dinaikkan jadi 'meragukan' karena masalah
     kualitas jawaban jarang datang sendirian. */
  let overall: ValidityStatus = "ok";
  for (const ix of indices) overall = worse(overall, ix.status);
  const warnCount = indices.filter((i) => i.status === "perhatian").length;
  if (overall === "perhatian" && warnCount >= 2) overall = "meragukan";

  const summary =
    overall === "ok"
      ? "Kualitas pengisian baik. Skor dapat dibaca sebagaimana adanya, dengan batasan instrumen yang berlaku."
      : overall === "perhatian"
        ? "Ada satu indikator kualitas pengisian yang perlu diperhatikan. Skor tetap dapat dipakai, tetapi konfirmasikan lewat wawancara berbasis contoh perilaku."
        : "Kualitas pengisian meragukan. Jangan menarik kesimpulan dari profil ini sebelum dilakukan tes ulang dengan pengawasan atau verifikasi mendalam saat wawancara.";

  return { overall, indices, summary };
}
