import { describe, it, expect } from "vitest";
import {
  aggregatePanel,
  computeCoverage,
  computeInterviewOutcome,
  CRITICAL_MIN_RATING,
  DISAGREEMENT_THRESHOLD,
  findCriticalGaps,
  MIN_COVERAGE_PCT,
  overallAverage,
  RATING_LABELS,
  scoreByCompetency,
  type Rating,
  type ScoredQuestion,
} from "./interview-scoring";

const q = (
  id: string,
  competencyId: string,
  rating: Rating | null,
  notAsked = false,
): ScoredQuestion => ({
  questionId: id,
  competencyId,
  competencyName: competencyId.toUpperCase(),
  type: "Behavioral",
  rating,
  notAsked,
});

/** Set 10 pertanyaan bernilai penuh — dasar untuk menguji cakupan. */
const tenGood = (): ScoredQuestion[] =>
  Array.from({ length: 10 }, (_, i) => q(`q${i}`, i < 5 ? "comm" : "lead", 4));

describe("skala penilaian", () => {
  it("tidak lagi memuat label ketiadaan bukti pada skala performa", () => {
    // Cacat versi lama: angka 1 berlabel "No evidence", sehingga pertanyaan
    // yang tidak sempat ditanyakan tercatat sebagai performa terburuk.
    const labels = Object.values(RATING_LABELS).join(" ").toLowerCase();
    expect(labels).not.toMatch(/no evidence|tidak ada bukti|tidak ditanya/);
    expect(RATING_LABELS[3]).toMatch(/sesuai ekspektasi/i);
  });
});

describe("computeCoverage", () => {
  it("mengeluarkan pertanyaan yang sengaja tidak ditanyakan dari pembagi", () => {
    const scores = [q("a", "comm", 4), q("b", "comm", 3), q("c", "comm", null, true)];
    const cov = computeCoverage(scores);
    expect(cov.total).toBe(3);
    expect(cov.planned).toBe(2);
    expect(cov.notAsked).toBe(1);
    expect(cov.coveragePct).toBe(100); // 2 dari 2 yang direncanakan
  });

  it("menghitung pertanyaan terencana yang terlewat sebagai lubang, bukan diabaikan", () => {
    const scores = [q("a", "comm", 4), q("b", "comm", null), q("c", "comm", null)];
    const cov = computeCoverage(scores);
    expect(cov.missing).toBe(2);
    expect(cov.coveragePct).toBe(33);
  });

  it("tidak menghasilkan NaN ketika semua pertanyaan tidak ditanyakan", () => {
    const cov = computeCoverage([q("a", "comm", null, true)]);
    expect(cov.coveragePct).toBe(0);
    expect(Number.isNaN(cov.coveragePct)).toBe(false);
  });
});

describe("overallAverage & scoreByCompetency", () => {
  it("hanya menghitung pertanyaan yang dinilai", () => {
    const scores = [q("a", "comm", 4), q("b", "comm", 2), q("c", "comm", null), q("d", "comm", null, true)];
    expect(overallAverage(scores)).toBe(3);
  });

  it("mengembalikan null bila belum ada yang dinilai, bukan nol", () => {
    expect(overallAverage([q("a", "comm", null)])).toBeNull();
  });

  it("melaporkan kompetensi tanpa penilaian sebagai null, bukan nol", () => {
    const rows = scoreByCompetency([q("a", "comm", 4), q("b", "lead", null)]);
    expect(rows.find((r) => r.competencyId === "comm")!.avg).toBe(4);
    expect(rows.find((r) => r.competencyId === "lead")!.avg).toBeNull();
  });
});

describe("findCriticalGaps", () => {
  it("menandai kompetensi wajib yang di bawah ambang", () => {
    const rows = scoreByCompetency([q("a", "safety", 2), q("b", "comm", 5)]);
    const gaps = findCriticalGaps(rows, ["safety"]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].avg).toBe(2);
    expect(gaps[0].reason).toContain(String(CRITICAL_MIN_RATING));
  });

  it("menandai kompetensi wajib yang sama sekali tidak dinilai", () => {
    // Tidak ada bukti sama menghalanginya dengan bukti buruk.
    const rows = scoreByCompetency([q("a", "safety", null), q("b", "comm", 5)]);
    const gaps = findCriticalGaps(rows, ["safety"]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].avg).toBeNull();
    expect(gaps[0].reason).toMatch(/tidak sempat dinilai/i);
  });

  it("meloloskan kompetensi wajib yang memenuhi ambang", () => {
    expect(findCriticalGaps(scoreByCompetency([q("a", "safety", 3)]), ["safety"])).toHaveLength(0);
  });

  it("mengabaikan kompetensi wajib yang tidak ada di kit ini", () => {
    expect(findCriticalGaps(scoreByCompetency([q("a", "comm", 4)]), ["tidak-ada"])).toHaveLength(0);
  });
});

describe("computeInterviewOutcome", () => {
  it("menahan kesimpulan ketika cakupan terlalu tipis", () => {
    // 3 dari 10 dinilai = 30%, di bawah ambang.
    const scores = tenGood().map((s, i) => (i < 3 ? s : { ...s, rating: null }));
    const out = computeInterviewOutcome(scores);
    expect(out.coverage.coveragePct).toBeLessThan(MIN_COVERAGE_PCT);
    expect(out.verdict).toBe("data_belum_cukup");
    expect(out.reason).toMatch(/Lengkapi dulu/i);
  });

  it("melewatkan pertanyaan sulit tidak menaikkan kesimpulan", () => {
    // Inti cacat lama: skip pertanyaan yang akan bernilai rendah lalu dapat
    // rata-rata tinggi. Sekarang cakupannya jatuh dan kesimpulan ditahan.
    const semua = [...Array.from({ length: 5 }, (_, i) => q(`g${i}`, "comm", 5)),
                   ...Array.from({ length: 5 }, (_, i) => q(`b${i}`, "lead", null))];
    const out = computeInterviewOutcome(semua);
    expect(out.average).toBe(5);
    expect(out.verdict).toBe("data_belum_cukup");
  });

  it("kompetensi wajib yang jeblok memblokir rekomendasi meski rata-rata tinggi", () => {
    const scores = [
      ...Array.from({ length: 8 }, (_, i) => q(`g${i}`, "comm", 5)),
      q("s1", "safety", 2),
      q("s2", "safety", 2),
    ];
    const out = computeInterviewOutcome(scores, ["safety"]);
    expect(out.average).toBeGreaterThan(4);
    expect(out.verdict).toBe("tidak_direkomendasikan");
    expect(out.criticalGaps).toHaveLength(1);
    expect(out.reason).toMatch(/kompetensi wajib/i);
  });

  it("memberi rekomendasi tertinggi ketika cakupan penuh dan kompetensi wajib terpenuhi", () => {
    const scores = Array.from({ length: 10 }, (_, i) => q(`q${i}`, i < 5 ? "comm" : "safety", 5));
    const out = computeInterviewOutcome(scores, ["safety"]);
    expect(out.verdict).toBe("sangat_direkomendasikan");
    expect(out.criticalGaps).toHaveLength(0);
  });

  it("pertanyaan yang ditandai tidak ditanya tidak menurunkan cakupan", () => {
    const scores = [
      ...Array.from({ length: 6 }, (_, i) => q(`a${i}`, "comm", 4)),
      ...Array.from({ length: 4 }, (_, i) => q(`n${i}`, "lead", null, true)),
    ];
    const out = computeInterviewOutcome(scores);
    expect(out.coverage.coveragePct).toBe(100);
    expect(out.verdict).toBe("direkomendasikan");
  });

  it("menyatakan data belum cukup ketika belum ada penilaian sama sekali", () => {
    const out = computeInterviewOutcome([q("a", "comm", null)]);
    expect(out.verdict).toBe("data_belum_cukup");
    expect(out.average).toBeNull();
  });
});

describe("aggregatePanel", () => {
  const rater = (name: string, ratings: Record<string, Rating>): {
    interviewer: string; completedAt: string; scores: ScoredQuestion[];
  } => ({
    interviewer: name,
    completedAt: "2026-08-17T00:00:00.000Z",
    scores: Object.entries(ratings).flatMap(([comp, r]) =>
      Array.from({ length: 5 }, (_, i) => q(`${comp}-${i}`, comp, r)),
    ),
  });

  it("merata-ratakan antar-pewawancara, bukan antar-butir", () => {
    // Pewawancara yang menilai lebih banyak butir tidak boleh punya suara
    // lebih besar hanya karena jumlah pertanyaannya.
    const panel = aggregatePanel([
      { interviewer: "A", completedAt: "x", scores: Array.from({ length: 20 }, (_, i) => q(`a${i}`, "comm", 5)) },
      { interviewer: "B", completedAt: "x", scores: Array.from({ length: 4 }, (_, i) => q(`b${i}`, "comm", 3)) },
    ]);
    expect(panel.panelAverage).toBe(4); // (5 + 3) / 2, bukan tertarik ke 5
  });

  it("menandai kompetensi yang dinilai jauh berbeda antar-pewawancara", () => {
    const panel = aggregatePanel([rater("Andi", { comm: 5 }), rater("Budi", { comm: 2 })]);
    expect(panel.disagreements).toHaveLength(1);
    expect(panel.disagreements[0].spread).toBe(3);
    expect(panel.disagreements[0].note).toContain("Andi");
    expect(panel.disagreements[0].note).toContain("Budi");
  });

  it("perbedaan tajam menahan kesimpulan meski rata-rata panel bagus", () => {
    // 5 dan 2 menghasilkan rata-rata 3,5 yang terdengar aman — padahal kedua
    // pewawancara melihat kandidat yang sama sekali berbeda.
    const panel = aggregatePanel([rater("Andi", { comm: 5 }), rater("Budi", { comm: 2 })]);
    expect(panel.verdict).toBe("perlu_pertimbangan");
    expect(panel.reason).toMatch(/dinilai jauh berbeda/i);
  });

  it("tidak menandai perbedaan yang masih wajar", () => {
    const panel = aggregatePanel([rater("Andi", { comm: 4 }), rater("Budi", { comm: 3 })]);
    expect(panel.disagreements).toHaveLength(0);
    expect(panel.verdict).toBe("direkomendasikan");
  });

  it("butuh minimal dua penilai sebelum bicara ketidaksepakatan", () => {
    const panel = aggregatePanel([rater("Andi", { comm: 5 })]);
    expect(panel.disagreements).toHaveLength(0);
    expect(panel.raterCount).toBe(1);
  });

  it("kompetensi wajib dinilai dari gabungan panel, bukan per pewawancara", () => {
    // Andi tidak menanyakan safety; Budi menanyakan dan hasilnya baik.
    // Panel tidak boleh dianggap kekurangan bukti.
    const panel = aggregatePanel(
      [rater("Andi", { comm: 4 }), rater("Budi", { comm: 4, safety: 4 })],
      ["safety"],
    );
    expect(panel.criticalGaps).toHaveLength(0);
    expect(panel.verdict).toBe("direkomendasikan");
  });

  it("kompetensi wajib yang jeblok memblokir panel", () => {
    const panel = aggregatePanel([rater("Andi", { comm: 5, safety: 2 })], ["safety"]);
    expect(panel.verdict).toBe("tidak_direkomendasikan");
  });

  it("ambang ketidaksepakatan sebesar dua tingkat penilaian", () => {
    expect(DISAGREEMENT_THRESHOLD).toBe(2);
  });

  it("panel tanpa penilaian apa pun dinyatakan belum cukup", () => {
    expect(aggregatePanel([]).verdict).toBe("data_belum_cukup");
    expect(aggregatePanel([]).panelAverage).toBeNull();
  });
});
