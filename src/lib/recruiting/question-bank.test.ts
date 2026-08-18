import { describe, it, expect } from "vitest";
import {
  generateCustomQuestionId,
  isKitTooThin,
  mergeQuestionBanks,
  MIN_KIT_QUESTIONS,
  MIN_QUESTION_CHARS,
  summarizeSelection,
  validateCustomQuestion,
  type BankQuestion,
  type CustomQuestionDraft,
} from "./question-bank";

const draft = (over: Partial<CustomQuestionDraft> = {}): CustomQuestionDraft => ({
  competencyId: "skkni-rekrutmen",
  competencyName: "Rekrutmen & Seleksi",
  type: "Behavioral",
  question: "Ceritakan saat Anda harus menolak permintaan atasan karena melanggar prosedur.",
  strongAnswer: "Menyebut prosedur spesifik, cara menyampaikannya, dan hasil akhirnya.",
  redFlags: [],
  ...over,
});

const q = (id: string, type: string, competencyId: string, source: "builtin" | "custom"): BankQuestion => ({
  id,
  type,
  competencyId,
  competencyName: competencyId.toUpperCase(),
  question: `Pertanyaan ${id}`,
  strongAnswer: "",
  redFlags: [],
  source,
});

describe("validateCustomQuestion", () => {
  it("meloloskan pertanyaan yang lengkap dan wajar", () => {
    expect(validateCustomQuestion(draft())).toHaveLength(0);
  });

  it("menolak pertanyaan yang terlalu pendek", () => {
    const problems = validateCustomQuestion(draft({ question: "Kenapa?" }));
    expect(problems.some((p) => p.includes(String(MIN_QUESTION_CHARS)))).toBe(true);
  });

  it("mewajibkan kompetensi agar nilainya bisa dijumlahkan", () => {
    expect(validateCustomQuestion(draft({ competencyId: "  " })).some((p) => /kompetensi/i.test(p))).toBe(true);
  });

  it("mewajibkan ciri jawaban kuat", () => {
    // Tanpa ini dua pewawancara menilai pertanyaan yang sama dengan standar berbeda.
    expect(validateCustomQuestion(draft({ strongAnswer: "" })).some((p) => /jawaban kuat/i.test(p))).toBe(true);
  });
});

describe("penjaga pertanyaan diskriminatif", () => {
  const ditolak = [
    ["kehamilan", "Apakah Anda sedang program hamil dalam waktu dekat?"],
    ["pernikahan", "Apa status pernikahan Anda saat ini dan bagaimana pengaruhnya ke pekerjaan?"],
    ["agama", "Apakah Anda keberatan melepas jilbab saat bertugas di depan kamera?"],
    ["usia", "Berapa usia Anda sekarang dan apakah masih sanggup lembur?"],
    ["anak", "Apakah Anda punya anak kecil yang butuh diurus setiap hari?"],
    ["kesehatan", "Apa riwayat kesehatan Anda dalam lima tahun terakhir?"],
  ] as const;

  for (const [label, question] of ditolak) {
    it(`menolak pertanyaan yang menyinggung ${label}`, () => {
      const problems = validateCustomQuestion(draft({ question }));
      expect(problems.some((p) => /diskriminatif/i.test(p))).toBe(true);
    });
  }

  it("hanya memberi satu peringatan meski beberapa pola cocok", () => {
    const problems = validateCustomQuestion(
      draft({ question: "Berapa usia Anda, sudah menikah, dan apakah sedang hamil?" }),
    );
    expect(problems.filter((p) => /diskriminatif/i.test(p))).toHaveLength(1);
  });

  it("tidak salah menuduh pertanyaan kerja yang sah", () => {
    // Kesediaan menjalankan tuntutan pekerjaan boleh ditanyakan; yang dilarang
    // adalah menanyakan keadaan pribadi di baliknya.
    const problems = validateCustomQuestion(
      draft({ question: "Posisi ini menuntut shift malam bergilir. Apakah Anda bersedia menjalankannya?" }),
    );
    expect(problems.filter((p) => /diskriminatif/i.test(p))).toHaveLength(0);
  });
});

describe("mergeQuestionBanks", () => {
  it("menempatkan pertanyaan perusahaan setelah bawaan pada tiap tipe", () => {
    const merged = mergeQuestionBanks(
      [q("B1", "Behavioral", "a", "builtin"), q("T1", "Technical", "b", "builtin")],
      [q("C1", "Behavioral", "a", "custom")],
    );
    expect(merged.map((x) => x.id)).toEqual(["B1", "C1", "T1"]);
  });

  it("tidak membuang pertanyaan bawaan meski kompetensinya sama", () => {
    // Pertanyaan perusahaan MELENGKAPI, bukan menimpa.
    const merged = mergeQuestionBanks([q("B1", "Behavioral", "a", "builtin")], [q("C1", "Behavioral", "a", "custom")]);
    expect(merged).toHaveLength(2);
  });

  it("memunculkan tipe yang hanya ada di bank perusahaan", () => {
    const merged = mergeQuestionBanks([q("B1", "Behavioral", "a", "builtin")], [q("C1", "Situational", "a", "custom")]);
    expect(merged.map((x) => x.type)).toEqual(["Behavioral", "Situational"]);
  });

  it("menangani bank kosong di kedua sisi", () => {
    expect(mergeQuestionBanks([], [])).toHaveLength(0);
  });
});

describe("summarizeSelection", () => {
  const all = [
    q("B1", "Behavioral", "comm", "builtin"),
    q("B2", "Behavioral", "comm", "builtin"),
    q("T1", "Technical", "tech", "builtin"),
  ];

  it("menghitung jumlah yang disertakan dan dikeluarkan", () => {
    const s = summarizeSelection(all, ["B2"]);
    expect(s.total).toBe(3);
    expect(s.included).toBe(2);
    expect(s.excluded).toBe(1);
  });

  it("menandai kompetensi yang seluruh pertanyaannya dikeluarkan", () => {
    // Kompetensi tanpa satu pun pertanyaan menjadi tidak terukur sama sekali —
    // dan itu harus terlihat SEBELUM wawancara dimulai.
    const s = summarizeSelection(all, ["B1", "B2"]);
    expect(s.droppedCompetencies).toHaveLength(1);
    expect(s.droppedCompetencies[0].competencyId).toBe("comm");
  });

  it("tidak menandai kompetensi yang masih menyisakan satu pertanyaan", () => {
    expect(summarizeSelection(all, ["B1"]).droppedCompetencies).toHaveLength(0);
  });

  it("mengabaikan id yang tidak ada di daftar", () => {
    expect(summarizeSelection(all, ["TIDAK-ADA"]).included).toBe(3);
  });
});

describe("isKitTooThin", () => {
  const many = Array.from({ length: 8 }, (_, i) => q(`B${i}`, "Behavioral", "comm", "builtin"));

  it("menandai kit yang tersisa terlalu sedikit pertanyaan", () => {
    const s = summarizeSelection(many, many.slice(0, 6).map((x) => x.id)); // sisa 2
    expect(isKitTooThin(s)).toBe(true);
  });

  it("meloloskan kit yang masih memenuhi jumlah minimum", () => {
    const s = summarizeSelection(many, many.slice(0, 4).map((x) => x.id)); // sisa 4
    expect(s.included).toBe(MIN_KIT_QUESTIONS);
    expect(isKitTooThin(s)).toBe(false);
  });
});

describe("generateCustomQuestionId", () => {
  it("memakai awalan yang menandakan sumbernya", () => {
    const id = generateCustomQuestionId(new Date("2026-08-19T00:00:00Z"), "ab12");
    expect(id).toBe("CQ-20260819-AB12");
  });
});
