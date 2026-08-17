import { describe, it, expect } from "vitest";
import {
  analyzeEvidenceCoverage,
  deriveQuestionFormat,
  MAX_PROBES,
  PROBE_HIGH_STEN,
  PROBE_LOW_STEN,
  selectProbes,
  type InterpretationLike,
  type KitQuestionLike,
} from "./interview-kit";

describe("deriveQuestionFormat", () => {
  it("mengikuti tipe eksplisit lebih dulu", () => {
    expect(deriveQuestionFormat("Behavioral", "Bagaimana Anda akan menangani ini?")).toBe("behavioral");
    expect(deriveQuestionFormat("Situational", "Ceritakan pengalaman Anda")).toBe("situational");
  });

  it("mengenali pertanyaan perilaku dari kalimatnya", () => {
    expect(deriveQuestionFormat("Leadership", "Ceritakan saat Anda memimpin tim yang menolak perubahan.")).toBe("behavioral");
    expect(deriveQuestionFormat("Technical", "Berikan contoh nyata analisis yang pernah Anda buat.")).toBe("behavioral");
    expect(deriveQuestionFormat("Cultural Fit", "Kapan terakhir Anda menolak permintaan atasan?")).toBe("behavioral");
  });

  it("mengenali pertanyaan situasional dari kalimatnya", () => {
    expect(deriveQuestionFormat("Leadership", "Bagaimana Anda akan menangani dua anak buah yang berkonflik?")).toBe("situational");
    expect(deriveQuestionFormat("Technical", "Jika sistem tiba-tiba mati saat siaran, apa langkah Anda?")).toBe("situational");
  });

  it("menganggap situasional ketika tidak ada petunjuk sama sekali", () => {
    // Asumsi yang lebih aman: mengaku punya bukti perilaku yang sebenarnya
    // tidak ada jauh lebih berbahaya daripada sebaliknya.
    expect(deriveQuestionFormat("Technical", "Apa pendapat Anda tentang people analytics?")).toBe("situational");
  });

  it("tidak peduli huruf besar-kecil", () => {
    expect(deriveQuestionFormat("Leadership", "CERITAKAN pengalaman tersulit Anda")).toBe("behavioral");
  });
});

describe("analyzeEvidenceCoverage", () => {
  const q = (competencyId: string, type: string, question: string): KitQuestionLike => ({
    competencyId,
    competencyName: competencyId.toUpperCase(),
    type,
    question,
  });

  it("menandai kompetensi yang hanya digali lewat situasi hipotetis", () => {
    const rows = analyzeEvidenceCoverage([
      q("lead", "Leadership", "Bagaimana Anda akan menangani konflik tim?"),
      q("lead", "Leadership", "Jika target tidak tercapai, apa langkah Anda?"),
      q("comm", "Behavioral", "Ceritakan saat Anda menyampaikan kabar buruk."),
    ]);

    const lead = rows.find((r) => r.competencyId === "lead")!;
    expect(lead.behavioral).toBe(0);
    expect(lead.situational).toBe(2);
    expect(lead.lacksBehavioralEvidence).toBe(true);

    const comm = rows.find((r) => r.competencyId === "comm")!;
    expect(comm.behavioral).toBe(1);
    expect(comm.lacksBehavioralEvidence).toBe(false);
  });

  it("satu pertanyaan perilaku sudah cukup menutup kekurangan", () => {
    const rows = analyzeEvidenceCoverage([
      q("lead", "Leadership", "Bagaimana Anda akan menangani konflik tim?"),
      q("lead", "Behavioral", "Ceritakan konflik tim yang pernah Anda tangani."),
    ]);
    expect(rows[0].lacksBehavioralEvidence).toBe(false);
    expect(rows[0].total).toBe(2);
  });

  it("mengembalikan daftar kosong untuk kit kosong, bukan menandai apa pun", () => {
    expect(analyzeEvidenceCoverage([])).toHaveLength(0);
  });
});

describe("selectProbes", () => {
  const interp = (scaleId: string, sten: number, probes: string[] = ["Ceritakan contoh nyatanya."]): InterpretationLike => ({
    scaleId,
    scaleName: scaleId.toUpperCase(),
    sten,
    interviewProbes: probes,
  });

  it("hanya mengambil skala yang menonjol ke atas atau ke bawah", () => {
    const probes = selectProbes([interp("A", 5), interp("B", 6), interp("C", 9), interp("D", 2)]);
    const ids = probes.map((p) => p.scaleId);
    expect(ids).toContain("C");
    expect(ids).toContain("D");
    // Skala di kisaran rata-rata tidak menghasilkan hipotesis yang tajam.
    expect(ids).not.toContain("A");
    expect(ids).not.toContain("B");
  });

  it("mendahulukan yang paling jauh dari rata-rata", () => {
    const probes = selectProbes([interp("agak", PROBE_HIGH_STEN), interp("ekstrem", 10)]);
    expect(probes[0].scaleId).toBe("ekstrem");
  });

  it("menjelaskan hipotesis yang sedang diuji, bukan sekadar memberi pertanyaan", () => {
    const [rendah] = selectProbes([interp("teliti", 2)]);
    expect(rendah.rationale).toMatch(/rendah/i);
    expect(rendah.rationale).toMatch(/pekerjaan nyata/i);

    const [tinggi] = selectProbes([interp("teliti", 10)]);
    expect(tinggi.rationale).toMatch(/tinggi/i);
    expect(tinggi.rationale).toMatch(/diwaspadai/i);
  });

  it("membatasi jumlah agar wawancara tidak membengkak", () => {
    const many = Array.from({ length: 20 }, (_, i) => interp(`s${i}`, 10));
    expect(selectProbes(many)).toHaveLength(MAX_PROBES);
    expect(selectProbes(many, 3)).toHaveLength(3);
  });

  it("melewati skala yang tidak punya pertanyaan pendalaman", () => {
    expect(selectProbes([interp("kosong", 10, [])])).toHaveLength(0);
  });

  it("ambang rendah dan tinggi berada di luar kisaran rata-rata sten 5-6", () => {
    expect(PROBE_LOW_STEN).toBeLessThan(5);
    expect(PROBE_HIGH_STEN).toBeGreaterThan(6);
  });
});
