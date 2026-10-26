import { describe, expect, it } from "vitest";
import { NO_EVIDENCE, RETAIL_SCREENING_RULES, buildAnalysisPrompt, verifyEvidenceQuotes, type AiAnalysisResult } from "./cv-analyzer-ai";

const CV = `Sari Wulandari. SPG - Toko Roti Contoh, Mal Taman Anggrek (Maret 2026 - April 2026, 2 bulan).
Melayani rata-rata 80 pelanggan per hari. Mencatat stok masuk dan keluar serta merekap kas penjualan pada akhir shift.`;

const base = (quotes: string[]): AiAnalysisResult => ({
  candidateName: "Sari", overallScore: 70, matchScore: 70, confidence: 80, recommendation: "Hire", summary: "", recommendationDetail: "", processingNote: "",
  cluster: "retail", frameworkLabel: "x", risks: [], questions: [],
  competencies: quotes.map((q, i) => ({ id: `c${i}`, name: `K${i}`, pillar: "retail-frontline", score: 60, rawLevel: 3, benchmark: 65, insight: "", evidenceQuote: q, gap: "meets" })),
});

describe("verifyEvidenceQuotes", () => {
  it("mempertahankan kutipan yang benar-benar ada di CV (toleran huruf besar & tanda baca)", () => {
    const r = verifyEvidenceQuotes(base(["Melayani rata-rata 80 pelanggan per hari", "mencatat STOK masuk dan keluar"]), CV);
    expect(r.removed).toBe(0);
    expect(r.result.competencies.map((c) => c.evidenceQuote)).toEqual(["Melayani rata-rata 80 pelanggan per hari", "mencatat STOK masuk dan keluar"]);
  });

  it("mengosongkan kutipan yang disalin dari rubrik, mencatatnya, dan tidak mengubah skor", () => {
    const r = verifyEvidenceQuotes(base(["Bekerja dalam tim minimal 1–2 bulan", "Melayani rata-rata 80 pelanggan per hari"]), CV);
    expect(r.removed).toBe(1);
    expect(r.result.competencies[0].evidenceQuote).toBe(NO_EVIDENCE);
    expect(r.result.competencies[1].evidenceQuote).not.toBe(NO_EVIDENCE);
    expect(r.result.competencies.every((c) => c.score === 60)).toBe(true);
    expect(r.result.processingNote).toContain("1 kutipan bukti tidak ditemukan");
  });

  it("tidak menyentuh 'Tidak ditemukan bukti eksplisit' dan tidak menambah catatan bila semua benar", () => {
    const r = verifyEvidenceQuotes(base([NO_EVIDENCE]), CV);
    expect(r.removed).toBe(0);
    expect(r.result.processingNote).toBe("");
  });

  it("kutipan sangat pendek harus muncul utuh", () => {
    expect(verifyEvidenceQuotes(base(["SPG"]), CV).removed).toBe(0);
    expect(verifyEvidenceQuotes(base(["kasir"]), CV).removed).toBe(1);
  });
});

describe("aturan seleksi garis depan", () => {
  it("masuk ke prompt hanya untuk kerangka ritel", () => {
    const retail = buildAnalysisPrompt(CV, "", "SPG Outlet", "Retail & Outlet");
    expect(retail).toContain(RETAIL_SCREENING_RULES.slice(0, 40));
    expect(retail).toContain("1–2 bulan");
    expect(retail).toContain("id:ret-customer-service");
    const other = buildAnalysisPrompt(CV, "", "Software Engineer", "Engineering");
    expect(other).not.toContain("ATURAN SELEKSI GARIS DEPAN");
  });

  it("melarang pendidikan, usia, status pernikahan, agama, dan penampilan sebagai alasan menurunkan skor", () => {
    for (const k of ["pendidikan", "usia", "status pernikahan", "agama", "penampilan"]) expect(RETAIL_SCREENING_RULES).toContain(k);
  });
});
