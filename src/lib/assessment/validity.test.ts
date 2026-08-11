import { describe, it, expect } from "vitest";
import {
  attentionCheckFailures,
  buildValidityReport,
  completionRate,
  desirabilityScore,
  inconsistencyIndex,
  longestIdenticalRun,
  secondsPerItem,
} from "./validity";
import {
  ATTENTION_CHECK_KEY,
  INCONSISTENCY_PAIRS,
  PERSONALITY_ITEM_BY_ID,
  PERSONALITY_SECTION_ITEMS,
} from "./items-personality";
import type { ResponseMap, SectionTiming } from "./types";

const PERSONALITY_IDS = PERSONALITY_SECTION_ITEMS.map((i) => i.id);

/** Peserta "baik": jawaban konsisten antar pasangan berlawanan, bervariasi antar
 *  domain (sehingga tidak memicu long-string), dan lolos attention check.
 *  Nilai keyed dibuat berbeda per domain supaya urutan jawaban tidak seragam. */
const KEYED_TARGET: Record<string, number> = { O: 4, C: 5, E: 3, A: 4, N: 2 };

function goodResponses(): ResponseMap {
  const r: ResponseMap = {};
  for (const it of PERSONALITY_SECTION_ITEMS) {
    if (it.qc === "attention") {
      r[it.id] = ATTENTION_CHECK_KEY[it.id];
      continue;
    }
    if (it.qc === "desirability") {
      r[it.id] = 2; // mengakui hal yang tidak ideal
      continue;
    }
    const target = KEYED_TARGET[it.scale];
    r[it.id] = it.keying === 1 ? target : 6 - target;
  }
  return r;
}

const timings = (elapsedSec: number): SectionTiming[] => [
  {
    sectionId: "sec-personality",
    startedAt: "2026-08-01T09:00:00.000Z",
    submittedAt: "2026-08-01T09:10:00.000Z",
    elapsedSec,
  },
];

describe("attentionCheckFailures", () => {
  it("lolos ketika jawaban sesuai instruksi di dalam item", () => {
    expect(attentionCheckFailures({ "P-QC01": 2, "P-QC02": 4 })).toEqual({ failed: 0, total: 2 });
  });

  it("menghitung jawaban salah sebagai gagal", () => {
    expect(attentionCheckFailures({ "P-QC01": 5, "P-QC02": 4 }).failed).toBe(1);
  });

  it("menghitung item yang tidak dijawab sebagai gagal — item ini justru menguji apakah teksnya dibaca", () => {
    expect(attentionCheckFailures({}).failed).toBe(2);
  });
});

describe("longestIdenticalRun", () => {
  it("mendeteksi jawaban lurus ke bawah", () => {
    const r: ResponseMap = {};
    for (const id of PERSONALITY_IDS) r[id] = 3;
    expect(longestIdenticalRun(r, PERSONALITY_IDS)).toBe(PERSONALITY_IDS.length);
  });

  it("terputus oleh jawaban yang berbeda", () => {
    const ids = ["a", "b", "c", "d", "e"];
    expect(longestIdenticalRun({ a: 1, b: 1, c: 2, d: 2, e: 2 }, ids)).toBe(3);
  });

  it("item yang tidak dijawab memutus deret, tidak menyambungnya", () => {
    const ids = ["a", "b", "c", "d"];
    expect(longestIdenticalRun({ a: 4, b: 4, d: 4 }, ids)).toBe(2);
  });
});

describe("inconsistencyIndex", () => {
  it("bernilai 0 ketika pasangan pernyataan berlawanan dijawab konsisten", () => {
    const r: ResponseMap = {};
    for (const [a, b] of INCONSISTENCY_PAIRS) {
      // Nilai keyed sama untuk keduanya = konsisten sempurna.
      r[a] = PERSONALITY_ITEM_BY_ID[a].keying === 1 ? 4 : 2;
      r[b] = PERSONALITY_ITEM_BY_ID[b].keying === 1 ? 4 : 2;
    }
    expect(inconsistencyIndex(r).value).toBe(0);
  });

  it("mencapai maksimum 4 ketika jawaban saling bertolak belakang", () => {
    const r: ResponseMap = {};
    for (const [a, b] of INCONSISTENCY_PAIRS) {
      r[a] = PERSONALITY_ITEM_BY_ID[a].keying === 1 ? 5 : 1; // keyed 5
      r[b] = PERSONALITY_ITEM_BY_ID[b].keying === 1 ? 1 : 5; // keyed 1
    }
    expect(inconsistencyIndex(r).value).toBe(4);
  });

  it("melewati pasangan yang tidak lengkap dijawab", () => {
    const [a] = INCONSISTENCY_PAIRS[0];
    expect(inconsistencyIndex({ [a]: 5 }).pairsUsed).toBe(0);
  });
});

describe("desirabilityScore", () => {
  it("tinggi ketika peserta menyetujui pernyataan yang hampir mustahil benar", () => {
    expect(desirabilityScore({ "P-SD01": 5, "P-SD02": 5, "P-SD03": 5, "P-SD04": 5 }).value).toBe(5);
  });

  it("rendah ketika peserta mengakui hal yang tidak ideal", () => {
    expect(desirabilityScore({ "P-SD01": 2, "P-SD02": 2, "P-SD03": 2, "P-SD04": 2 }).value).toBe(2);
  });
});

describe("completionRate", () => {
  it("menghitung proporsi item yang dijawab", () => {
    expect(completionRate({ a: 1, b: 2 }, ["a", "b", "c", "d"])).toBe(0.5);
  });

  it("mengembalikan 0 untuk daftar item kosong, bukan NaN", () => {
    expect(completionRate({}, [])).toBe(0);
  });
});

describe("secondsPerItem", () => {
  it("membagi durasi section dengan jumlah item terjawab", () => {
    expect(secondsPerItem(timings(300), "sec-personality", 60)).toBe(5);
  });

  it("mengembalikan 0 bila tidak ada item terjawab, bukan membagi nol", () => {
    expect(secondsPerItem(timings(300), "sec-personality", 0)).toBe(0);
  });
});

describe("buildValidityReport", () => {
  it("memberi status ok untuk pengisian yang wajar", () => {
    const rep = buildValidityReport(goodResponses(), PERSONALITY_IDS, timings(60 * 8));
    expect(rep.overall).toBe("ok");
    expect(rep.indices.find((i) => i.id === "attention")!.status).toBe("ok");
    expect(rep.indices.find((i) => i.id === "completion")!.status).toBe("ok");
  });

  it("menandai meragukan ketika seluruh item dijawab sama persis", () => {
    // Kasus paling umum: peserta klik kolom yang sama dari atas ke bawah.
    const r: ResponseMap = {};
    for (const id of PERSONALITY_IDS) r[id] = 3;

    const rep = buildValidityReport(r, PERSONALITY_IDS, timings(60));
    expect(rep.indices.find((i) => i.id === "long_string")!.status).toBe("meragukan");
    expect(rep.overall).toBe("meragukan");
  });

  it("menandai kecenderungan menampilkan diri ideal tanpa mengubah skornya", () => {
    const r = goodResponses();
    for (const id of ["P-SD01", "P-SD02", "P-SD03", "P-SD04"]) r[id] = 5;

    const rep = buildValidityReport(r, PERSONALITY_IDS, timings(60 * 8));
    const sd = rep.indices.find((i) => i.id === "desirability")!;
    expect(sd.status).toBe("meragukan");
    expect(sd.explanation).toMatch(/wawancara/i); // menyarankan verifikasi, bukan koreksi otomatis
  });

  it("menandai pengisian yang terlalu cepat untuk dibaca", () => {
    const rep = buildValidityReport(goodResponses(), PERSONALITY_IDS, timings(60));
    expect(rep.indices.find((i) => i.id === "speed")!.status).toBe("meragukan");
  });

  it("menandai pengerjaan yang jauh dari lengkap", () => {
    const r = goodResponses();
    for (const id of PERSONALITY_IDS.slice(30)) delete r[id];

    const rep = buildValidityReport(r, PERSONALITY_IDS, timings(60 * 5));
    expect(rep.indices.find((i) => i.id === "completion")!.status).toBe("meragukan");
    expect(rep.overall).toBe("meragukan");
  });

  it("dua indikator berstatus perhatian dinaikkan menjadi meragukan", () => {
    // Masalah kualitas jawaban jarang datang sendirian.
    const r = goodResponses();
    r["P-QC01"] = 5;                              // 1 attention check gagal -> perhatian
    for (const id of ["P-SD01", "P-SD02", "P-SD03", "P-SD04"]) r[id] = 4.5; // desirability -> perhatian

    const rep = buildValidityReport(r, PERSONALITY_IDS, timings(60 * 8));
    expect(rep.overall).toBe("meragukan");
  });

  it("melewati indeks kepribadian ketika baterai tidak memuat inventori", () => {
    const cogIds = ["C-N01", "C-N02", "C-N03"];
    const rep = buildValidityReport({ "C-N01": 2, "C-N02": 3, "C-N03": 1 }, cogIds, []);
    expect(rep.indices.map((i) => i.id)).toEqual(["completion"]);
    expect(rep.overall).toBe("ok");
  });
});
