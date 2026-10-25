import { describe, expect, it } from "vitest";
import { buildInsightPrompt, collectComments, makeScrubber, parseInsight } from "./pulse-insight";
import type { PeriodSummary, SurveyQuestion } from "./pulse";

describe("makeScrubber", () => {
  const scrub = makeScrubber(["Deni Ramdani", "Ilal Marfudi Agustiawan (Billy)", "Muhammad Iffat", "Sri Ainun Nazilah"]);

  it("menyamarkan nama lengkap, nama depan, dan nama panggilan dalam kurung", () => {
    expect(scrub("Pak Deni ramdani dan Billy sangat membantu")).toBe("Pak [nama] dan [nama] sangat membantu");
    expect(scrub("terima kasih ka ainun")).toBe("terima kasih ka [nama]");
  });

  it("kata umum dalam nama (Muhammad) sendirian tidak dihapus; nama lengkap & bagian khasnya ya", () => {
    expect(scrub("Muhammad SAW")).toBe("Muhammad SAW");
    expect(scrub("muhammad iffat")).toBe("[nama]");
    expect(scrub("mas iffat")).toBe("mas [nama]");
  });

  it("menyamarkan email dan nomor telepon", () => {
    expect(scrub("hubungi saya 0812-3456-7890 atau a.b@gmail.com")).toBe("hubungi saya [kontak] atau [kontak]");
  });

  it("tidak memotong kata yang hanya mengandung nama di tengahnya", () => {
    expect(scrub("pendenian")).toBe("pendenian");
  });
});

const happiness: SurveyQuestion = {
  key: "happiness", label: "Rasa bahagia", type: "choice", favorable: ["Bahagia", "Sangat Bahagia"], kpiLabel: "Indeks bahagia",
  options: [{ value: "Tidak Bahagia" }, { value: "Bahagia" }, { value: "Sangat Bahagia" }],
};
const reason: SurveyQuestion = { key: "reason", label: "Alasan kurang bahagia", type: "text", showIf: { key: "happiness", notIn: ["Bahagia", "Sangat Bahagia"] } };
const feedback: SurveyQuestion = { key: "feedback", label: "Usulan", type: "text" };
const survey = { title: "Pulse Check Bulanan", audience: "Office", questions: [happiness, reason, feedback], headline: ["happiness"] };
const sum = (period: string, counts: Record<string, number>): PeriodSummary =>
  ({ period, n: Object.values(counts).reduce((a, b) => a + b, 0), suppressed: false, questions: { happiness: { answered: Object.values(counts).reduce((a, b) => a + b, 0), counts } } });

describe("buildInsightPrompt", () => {
  const p = buildInsightPrompt({
    survey, period: "2026-09-01",
    summaries: [sum("2026-08-01", { Bahagia: 8, "Tidak Bahagia": 2 }), sum("2026-09-01", { Bahagia: 6, "Tidak Bahagia": 4 })],
    segments: null, openActions: [{ title: "Libur 4x sebulan", theme: "libur", status: "belum", period: "2026-06-01" }],
    comments: [{ question: "Usulan", text: "libur ditambah" }], targetCount: 20,
  });

  it("memuat angka utama, pembanding bulan lalu, dan target", () => {
    expect(p).toContain("Indeks bahagia");
    expect(p).toContain("60% (6/10); bulan sebelumnya 80%");
    expect(p).toContain("Responden: 10 dari target 20");
  });

  it("memuat tindak lanjut terbuka supaya AI tidak mengusulkan butir yang sama", () => {
    expect(p).toContain("[Juni 2026 · libur · belum] Libur 4x sebulan");
  });

  it("memuat konteks pekerjaan nyata dan larangan mengutip/menyebut nama", () => {
    expect(p).toContain("bika ambon");
    expect(p).toMatch(/jangan menyebut nama/);
  });
});

describe("parseInsight", () => {
  it("membuang pagar kode, memaksa tipe, dan membatasi fokus maksimal 3", () => {
    const raw = "```json\n" + JSON.stringify({
      ringkasan: "Bahagia turun.",
      temuan: [{ judul: "Turun", bukti: "60% vs 80%", dampak: "x" }, { judul: "Tanpa bukti" }],
      tema_komentar: [{ tema: "Libur", jumlah: "4", sentimen: "aneh", inti: "ingin libur" }],
      rekomendasi: [1, 2, 3, 4].map((n) => ({ judul: `R${n}`, alasan: "a", langkah: ["l"], pic: "HR", tema: "libur", fokus: true })),
      catatan_data: ["n kecil"],
    }) + "\n```";
    const o = parseInsight(raw);
    expect(o.temuan).toHaveLength(1);
    expect(o.tema_komentar[0]).toEqual({ tema: "Libur", jumlah: 4, sentimen: "campuran", inti: "ingin libur" });
    expect(o.rekomendasi.filter((r) => r.fokus)).toHaveLength(3);
    expect(o.rekomendasi[3].fokus).toBe(false);
  });

  it("menyamarkan ulang hasil AI", () => {
    const o = parseInsight(JSON.stringify({ ringkasan: "Deni dipuji banyak orang", temuan: [] }), makeScrubber(["Deni Ramdani"]));
    expect(o.ringkasan).toBe("[nama] dipuji banyak orang");
  });

  it("menolak jawaban yang bukan JSON atau kosong", () => {
    expect(() => parseInsight("maaf saya tidak bisa")).toThrow();
    expect(() => parseInsight("{}")).toThrow();
  });
});

describe("collectComments", () => {
  it("hanya teks dari pertanyaan yang tampil, sudah disamarkan", () => {
    const out = collectComments(survey, [
      { happiness: "Bahagia", reason: "sisa jawaban lama", feedback: "Deni baik" },
      { happiness: "Tidak Bahagia", reason: "jam kerja panjang" },
    ], makeScrubber(["Deni"]));
    expect(out).toEqual([
      { question: "Usulan", text: "[nama] baik" },
      { question: "Alasan kurang bahagia", text: "jam kerja panjang" },
    ]);
  });
});
