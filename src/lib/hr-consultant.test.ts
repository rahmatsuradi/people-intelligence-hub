import { describe, it, expect } from "vitest";
import {
  buildContextBlock,
  buildRewriteInstruction,
  findGenericPhrases,
  HR_CONSULTANT_SYSTEM_PROMPT,
  SUGGESTED_QUESTIONS,
  type CompanySnapshot,
} from "./hr-consultant";

const snapshot = (over: Partial<CompanySnapshot> = {}): CompanySnapshot => ({
  companyName: "PT Contoh",
  industry: "Manufaktur Garmen",
  headcount: null,
  pipeline: {
    totalCandidates: 40,
    activePipeline: 12,
    hired: 5,
    openReqs: 3,
    medianTimeToHireDays: 22,
    offerAcceptRatePct: 80,
    stalledCount: 4,
  },
  openPositions: [{ title: "Operator Jahit", department: "Sewing", headcount: 10, activePipeline: 6 }],
  topSources: [{ source: "Referral", candidates: 12, hired: 4 }],
  ...over,
});

describe("findGenericPhrases", () => {
  it("menangkap frasa yang bisa ditempel ke pekerjaan apa pun", () => {
    const reply = "Penyebabnya adalah kurangnya pelatihan dan lingkungan kerja yang tidak kondusif.";
    expect(findGenericPhrases(reply)).toContain("kurangnya pelatihan");
    expect(findGenericPhrases(reply)).toContain("lingkungan kerja yang tidak kondusif");
  });

  it("tidak peduli huruf besar-kecil", () => {
    expect(findGenericPhrases("KURANGNYA PELATIHAN pada tim ini")).toHaveLength(1);
  });

  it("meloloskan jawaban yang menyebut mekanisme konkret", () => {
    const reply =
      "Target 80 paket per hari disusun untuk rute kota, sementara kurir pinggiran menempuh jarak dua kali lipat untuk target sama.";
    expect(findGenericPhrases(reply)).toHaveLength(0);
  });

  it("mengembalikan daftar kosong untuk teks kosong", () => {
    expect(findGenericPhrases("")).toHaveLength(0);
  });
});

describe("buildRewriteInstruction", () => {
  it("menyebutkan frasa yang ketahuan agar perbaikannya terarah", () => {
    const instr = buildRewriteInstruction(["kurangnya pelatihan"]);
    expect(instr).toContain('"kurangnya pelatihan"');
    // Perbaikan harus terarah, bukan menulis ulang dari nol.
    expect(instr).toMatch(/Pertahankan bagian yang sudah konkret/i);
  });
});

describe("buildContextBlock", () => {
  it("memuat nama perusahaan dan angka pipeline yang diberikan", () => {
    const block = buildContextBlock(snapshot());
    expect(block).toContain("PT Contoh");
    expect(block).toContain("22 hari");
    expect(block).toContain("Operator Jahit");
  });

  it("menyatakan apa adanya ketika angka belum bisa dihitung, bukan menulis nol", () => {
    const block = buildContextBlock(
      snapshot({ pipeline: { ...snapshot().pipeline!, medianTimeToHireDays: null, offerAcceptRatePct: null } }),
    );
    expect(block).toMatch(/belum bisa dihitung/i);
    expect(block).toMatch(/belum ada penawaran/i);
  });

  it("selalu menutup dengan larangan menebak data di luar konteks", () => {
    // Ini pagar utama terhadap konsultan yang mengarang angka perusahaan.
    expect(buildContextBlock(snapshot())).toMatch(/jangan menebaknya/i);
  });

  it("menghilangkan baris jumlah karyawan bila datanya tidak ada", () => {
    expect(buildContextBlock(snapshot({ headcount: null }))).not.toMatch(/Jumlah karyawan aktif/);
    expect(buildContextBlock(snapshot({ headcount: 70 }))).toMatch(/Jumlah karyawan aktif tercatat: 70/);
  });

  it("membatasi jumlah lowongan yang dikirim agar konteks tidak membengkak", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Posisi ${i}`, department: "Ops", headcount: 1, activePipeline: 0,
    }));
    const block = buildContextBlock(snapshot({ openPositions: many }));
    expect(block).toContain("Posisi 11");
    expect(block).not.toContain("Posisi 12");
  });
});

describe("persona konsultan", () => {
  it("melarang mengarang angka perusahaan dan nomor peraturan", () => {
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/JANGAN MENGARANG ANGKA PERUSAHAAN/);
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/JANGAN MENGARANG PASAL/);
  });

  it("mewajibkan rujukan ke pendampingan hukum untuk perkara hubungan industrial", () => {
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/Disnaker/);
  });

  it("melarang saran yang mengarah ke diskriminasi", () => {
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/DISKRIMINASI/);
  });

  it("mewajibkan bagian realitas pekerjaan ditulis lebih dulu", () => {
    // Inilah yang menahan jawaban jatuh ke nasihat generik.
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/Realitas pekerjaan ini/);
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/WAJIB DITULIS PERTAMA/);
  });

  it("contoh kedalaman diberi peringatan agar tidak disalin mentah", () => {
    // Versi pertama persona ini membuat model menyalin contohnya sebagai jawaban.
    expect(HR_CONSULTANT_SYSTEM_PROMPT).toMatch(/JANGAN menyalin isinya/);
  });
});

describe("pertanyaan yang disarankan", () => {
  it("setiap saran punya label, tag, dan pertanyaan yang cukup rinci", () => {
    for (const s of SUGGESTED_QUESTIONS) {
      expect(s.label.length).toBeGreaterThan(5);
      expect(s.tag.length).toBeGreaterThan(2);
      // Pertanyaan pendek menghasilkan jawaban generik; saran bawaan harus
      // mencontohkan cara bertanya yang memberi konteks.
      expect(s.question.length).toBeGreaterThan(60);
    }
  });

  it("mencakup persoalan di luar data yang ada di sistem", () => {
    const tags = SUGGESTED_QUESTIONS.map((s) => s.tag);
    expect(tags).toContain("Retensi");
    expect(tags).toContain("Hubungan Industrial");
  });
});
