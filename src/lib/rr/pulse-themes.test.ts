import { describe, expect, it } from "vitest";
import { conclusionCategories, type SurveyQuestion } from "./pulse";
import { buildInsightPrompt, parseMasalahNarration } from "./pulse-insight";
import {
  BATCH_CHARS, MAX_THEMES, NON_OPINION_KEYS, buildClassifyPrompt, buildPeta, buildProblemUnits, composeMasalah, conclusionDraft, defaultKategori,
  isPositiveQuestion, isTrivialComment, masalahAsText, masalahPromptBlock, mergeClassification, planBatches, questionLegend, sanitizeState,
  tallyThemes, themeSamples, waitBeforeNext, type ProblemUnit, type ThemeState,
} from "./pulse-themes";

// Nama fiktif (aturan repo: data uji tidak memakai nama karyawan asli).
const Q: SurveyQuestion[] = [
  { key: "spv", label: "Nama SPV Area", type: "text" },
  { key: "reported", label: "Ada kendala dilaporkan?", type: "choice", options: [{ value: "Ya" }, { value: "Tidak" }] },
  { key: "unsolved", label: "Jika ada, jelaskan secara singkat.", type: "text", showIf: { key: "reported", in: ["Ya"] } },
  { key: "good", label: "Apa yang sudah dilakukan SPV dengan baik?", type: "text" },
  { key: "improve", label: "Apa yang perlu ditingkatkan oleh SPV?", type: "text" },
  { key: "company", label: "Masukan lain untuk perusahaan?", type: "text" },
];
const survey = { questions: Q };
const id = (s: string) => s;
const CATS = conclusionCategories({ config: { kind: "spv_report" } });

describe("isTrivialComment", () => {
  it("membuang jawaban kosong makna", () => {
    for (const t of ["tidak ada", "Tdk ada kak", "-", ".", "sudah baik", "Sudah sangat baik 🙏", "Ga ada pak", "sejauh ini aman", "nihil", "Ok", "terima kasih", "cukup baik selama ini"]) {
      expect(isTrivialComment(t), t).toBe(true);
    }
  });
  it("mempertahankan komentar yang berisi masalah", () => {
    for (const t of ["libur 4x sebulan", "Tidak ada shift, kerja 12 jam", "stok sering kosong", "SPV jarang balas chat", "gaji telat"]) {
      expect(isTrivialComment(t), t).toBe(false);
    }
  });
});

describe("NON_OPINION_KEYS", () => {
  it("nama penilai 360 dan SPV/outlet tidak pernah dianggap komentar", () => {
    expect(NON_OPINION_KEYS).toEqual(expect.arrayContaining(["spv", "store", "rater"]));
  });
});

describe("questionLegend & isPositiveQuestion", () => {
  it("hanya pertanyaan teks yang bukan identitas dan bukan pertanyaan hal baik", () => {
    expect(isPositiveQuestion("Apa yang sudah dilakukan SPV dengan baik?")).toBe(true);
    expect(isPositiveQuestion("Apa yang perlu ditingkatkan oleh SPV?")).toBe(false);
    expect(questionLegend(survey, ["spv"]).map((l) => `${l.tag}:${l.key}`)).toEqual(["A:unsolved", "B:improve", "C:company"]);
  });
});

const responses = [
  { id: "r3", answers: { spv: "Budi", reported: "Tidak", unsolved: "harusnya tidak terbaca", improve: "Balas chat lebih cepat", company: "Libur 4x sebulan" } },
  { id: "r1", answers: { spv: "Budi", reported: "Ya", unsolved: "AC outlet rusak, hubungi 0812-1111-2222", good: "ramah", improve: "tidak ada" } },
  { id: "r2", answers: { spv: "Citra", reported: "Ya", unsolved: "-", improve: "sudah baik", company: "." } },
  { id: "r4", answers: { spv: "", company: "Gaji naik dong, kerja 12 jam" } },
];
const scrub = (s: string) => s.replace(/0812[-\d]+/g, "[kontak]");

describe("buildProblemUnits", () => {
  const units = buildProblemUnits(survey, responses, scrub, ["spv"], "spv");
  it("satu unit per pengisi, urut id; pengisi tanpa komentar berisi tidak ikut", () => {
    expect(units.map((u) => u.rid)).toEqual(["r1", "r3", "r4"]);
  });
  it("menghormati showIf, membuang hal baik & isian kosong makna, menyamarkan kontak", () => {
    expect(units[0].parts).toEqual([{ tag: "A", key: "unsolved", text: "AC outlet rusak, hubungi [kontak]" }]);
    expect(units[1].parts.map((p) => p.tag)).toEqual(["B", "C"]);
  });
  it("kelompok kosong menjadi 'Tidak diisi'", () => {
    expect(units[2].group).toBe("Tidak diisi");
  });
});

const mk = (n: number, len: number): ProblemUnit[] => Array.from({ length: n }, (_, i) => ({ rid: `r${String(i).padStart(3, "0")}`, group: i % 2 ? "Budi" : "Citra", parts: [{ tag: "A", key: "a", text: "x".repeat(len) }, { tag: "B", key: "b", text: "y".repeat(10) }] }));

describe("planBatches", () => {
  it("tidak memecah unit, tidak melewati anggaran, dan mencakup semua unit sekali", () => {
    const units = mk(300, 80);
    const b = planBatches(units);
    expect(b.flat()).toEqual(units.map((_, i) => i));
    expect(b.length).toBeGreaterThan(1);
    for (const part of b) expect(part.reduce((a, i) => a + units[i].parts.reduce((x, p) => x + p.text.length + 6, 6), 0)).toBeLessThanOrEqual(BATCH_CHARS);
  });
  it("unit yang lebih besar dari anggaran tetap masuk sendirian", () => {
    expect(planBatches(mk(2, 50), 10)).toEqual([[0], [1]]);
  });
});

describe("buildClassifyPrompt", () => {
  const units = mk(4, 20);
  it("menomori pengisi menurut posisi di daftar penuh dan memuat tema lama untuk dipakai ulang", () => {
    const p = buildClassifyPrompt({ surveyTitle: "Feedback SPG", audience: "SPG", legend: [{ tag: "A", label: "Kendala" }], units, batch: [2, 3], batchNo: 2, batches: 2, themes: [{ id: "T1", nama: "Libur", definisi: "minta libur", pemilik: "perusahaan", kategori: "Company Benefit" }], openActions: [], categories: CATS });
    expect(p).toContain("#3 [A]");
    expect(p).toContain("#4 [A]");
    expect(p).not.toContain("#1 [A]");
    expect(p).toContain("T1 | perusahaan | Company Benefit | Libur");
    expect(p).toContain("bagian 2 dari 2");
    expect(p).toContain('"Kinerja SPV"');
    expect(p).toMatch(/masuk kategori SPV/);
  });
  it("tanpa kategori SPV untuk survei Pulse biasa", () => {
    const p = buildClassifyPrompt({ surveyTitle: "Pulse", audience: null, legend: [], units, batch: [0], batchNo: 1, batches: 1, themes: [], openActions: [], categories: conclusionCategories({ config: { kind: "pulse" } }) });
    expect(p).not.toContain("Kinerja SPV");
  });
});

describe("mergeClassification", () => {
  const units = mk(4, 20);
  const base: ThemeState = { themes: [{ id: "T1", nama: "Libur 4x sebulan", definisi: "", pemilik: "perusahaan", kategori: "Company Benefit" }], tags: { "r000:a": ["T1"] } };

  it("menandai PER KOMENTAR, memberi id tetap ke tema baru, dan membuang tanda di luar bagian ini", () => {
    const raw = JSON.stringify({
      tema_baru: [{ id: "B1", nama: "SPV jarang balas chat", definisi: "chat lambat", pemilik: "spv", kategori: "Kinerja SPV" }, { id: "B2", nama: "libur 4x sebulan", pemilik: "perusahaan" }],
      tag: { "#3A": ["B1", "T1"], "4b": ["B2", "T9"], "#1A": ["B1"], "#4": ["B1"] },
    });
    const s = mergeClassification("```json\n" + raw + "\n```", base, units, [2, 3], CATS);
    expect(s.themes.map((t) => `${t.id}:${t.nama}:${t.pemilik}:${t.kategori}`)).toEqual(["T1:Libur 4x sebulan:perusahaan:Company Benefit", "T2:SPV jarang balas chat:spv:Kinerja SPV"]);
    // "#4" tanpa kode pertanyaan = semua komentar pengisi itu.
    expect(s.tags).toEqual({ "r000:a": ["T1"], "r002:a": ["T2", "T1"], "r003:b": ["T1", "T2"], "r003:a": ["T2"] });
  });

  it("kategori di luar daftar diganti dari pemiliknya; jumlah tema dibatasi", () => {
    const many = { tema_baru: Array.from({ length: 15 }, (_, i) => ({ id: `B${i}`, nama: `Tema ${i}`, pemilik: i ? "entah" : "spv", kategori: "Ngawur" })), tag: {} };
    const s = mergeClassification(JSON.stringify(many), { themes: [], tags: {} }, units, [0], CATS);
    expect(s.themes).toHaveLength(MAX_THEMES);
    expect(s.themes[0]).toMatchObject({ pemilik: "spv", kategori: "Kinerja SPV" });
    expect(s.themes[1]).toMatchObject({ pemilik: "perusahaan", kategori: "Company Benefit" });
    expect(defaultKategori("operasional", CATS)).toBe("Technical Issue");
    expect(defaultKategori("spv", conclusionCategories({ config: { kind: "pulse" } }))).toBe("Company Benefit");
  });

  it("menyelamatkan jawaban yang terpotong di tengah daftar tanda", () => {
    const cut = '{"tema_baru":[{"id":"B1","nama":"Stok kurang","pemilik":"operasional"}],"tag":{"#1A":["B1"],"#2A":["B';
    const s = mergeClassification(cut, { themes: [], tags: {} }, units, [0, 1], CATS);
    expect(s.tags).toEqual({ "r000:a": ["T1"] });
  });

  it("menolak jawaban yang bukan JSON", () => {
    expect(() => mergeClassification("maaf saya tidak bisa", base, units, [0], CATS)).toThrow();
  });
});

describe("sanitizeState", () => {
  it("membuang id tema aneh dan kode komentar yang bukan milik siklus ini", () => {
    const units = mk(2, 10);
    const s = sanitizeState({ themes: [{ id: "T1", nama: "A", pemilik: "spv", kategori: "Kinerja SPV" }, { id: "<x>", nama: "B" }, { id: "T1", nama: "dobel" }], tags: { "r000:a": ["T1", "T7"], "r000:zz": ["T1"], hacker: ["T1"], "r001:a": "T1" } }, units, CATS);
    expect(s).toEqual({ themes: [{ id: "T1", nama: "A", definisi: "", pemilik: "spv", kategori: "Kinerja SPV" }], tags: { "r000:a": ["T1"] } });
    expect(sanitizeState(null, units, CATS)).toEqual({ themes: [], tags: {} });
  });
});

describe("tallyThemes", () => {
  const units: ProblemUnit[] = [
    { rid: "a", group: "Budi", parts: [{ tag: "A", key: "x", text: "libur" }] },
    { rid: "b", group: "Budi", parts: [{ tag: "A", key: "x", text: "libur dan chat" }, { tag: "B", key: "y", text: "libur lagi" }] },
    { rid: "c", group: "Citra", parts: [{ tag: "A", key: "x", text: "libur" }] },
    { rid: "d", group: "Dina", parts: [{ tag: "A", key: "x", text: "stok" }] },
    { rid: "e", group: "Citra", parts: [{ tag: "A", key: "x", text: "pujian saja" }] },
  ];
  const state: ThemeState = {
    themes: [
      { id: "T1", nama: "Libur", definisi: "", pemilik: "perusahaan", kategori: "Company Benefit" },
      { id: "T2", nama: "Chat", definisi: "", pemilik: "spv", kategori: "Kinerja SPV" },
      { id: "T3", nama: "Stok", definisi: "", pemilik: "operasional", kategori: "Technical Issue" },
      { id: "T4", nama: "Lambat", definisi: "", pemilik: "spv", kategori: "Kinerja SPV" },
    ],
    // b menyebut libur di dua komentar — tetap dihitung SATU orang.
    tags: { "a:x": ["T1"], "b:x": ["T1", "T2"], "b:y": ["T1"], "c:x": ["T1"], "d:x": ["T3", "T4"], "ghost:x": ["T2"] },
  };
  const groupN = new Map([["Budi", 10], ["Citra", 4], ["Dina", 2]]);
  const { tally, dasar } = tallyThemes(state, units, 20, groupN);

  it("menghitung orang (bukan komentar) dan persen dari SELURUH pengisi", () => {
    expect(tally.map((t) => [t.theme.id, t.jumlah, t.persen])).toEqual([["T1", 3, 15]]);
  });
  it("tema yang disebut < 2 orang tidak jadi 'utama'; tanda untuk jawaban yang tidak ada diabaikan", () => {
    expect(tally.find((t) => t.theme.id === "T2")).toBeUndefined();
  });
  it("sebaran per kelompok hanya kelompok ≥ 3 pengisi, urut persen", () => {
    expect(tally[0].per_kelompok).toEqual([{ grup: "Citra", jumlah: 1, n: 4, persen: 25 }, { grup: "Budi", jumlah: 2, n: 10, persen: 20 }]);
  });
  it("dasar melaporkan yang berkomentar tapi tidak masuk tema", () => {
    expect(dasar).toEqual({ responden: 20, responden_berkomentar: 5, komentar: 6, tanpa_tema: 1 });
  });

  it("blok prompt memuat angka pasti dan contoh", () => {
    const block = masalahPromptBlock(tally, state, units, dasar, "SPV area");
    expect(block).toContain("T1 | perusahaan | Company Benefit | Libur — 3 orang (15%); terbanyak di SPV area: Citra 1/4, Budi 2/10");
    expect(block).toContain("contoh: libur dan chat");
    expect(block).toContain("1 pengisi berkomentar tapi tidak masuk tema");
    expect(themeSamples(state, units, "T1")).toEqual(["libur dan chat", "libur"]);
    // Contoh hanya dari komentar yang ditandai tema itu, bukan semua komentar pengisinya.
    expect(themeSamples(state, units, "T2")).toEqual(["libur dan chat"]);
  });

  it("narasi AI digabung per id; angka tetap dari server", () => {
    const narr = parseMasalahNarration(JSON.stringify({ masalah_utama: [{ id: "T1", judul: "SPG minta libur 4x", inti: "x", contoh: ["a", "b", "c"], usulan: "HR kaji", berulang: true, jumlah: 99 }] }));
    const m = composeMasalah(tally, narr);
    expect(m[0]).toMatchObject({ id: "T1", judul: "SPG minta libur 4x", kategori: "Company Benefit", jumlah: 3, persen: 15, berulang: true, contoh: ["a", "b"] });
    const fallback = composeMasalah(tally, []);
    expect(fallback[0]).toMatchObject({ judul: "Libur", usulan: "", berulang: false });
    const txt = masalahAsText("Oktober 2026", m, { ...dasar, kelompok_label: "SPV area" });
    expect(txt).toContain("1. SPG minta libur 4x — 3 orang (15%) · Kebijakan perusahaan / HR · keluhan berulang");
    expect(txt).toContain("Terbanyak di SPV area: Citra 25% (1/4), Budi 20% (2/10)");
  });

  it("peta untuk tab Komentar memuat semua tema (termasuk 1 orang) dan usulan kesimpulan per kategori", () => {
    const peta = buildPeta(state, units);
    expect(peta.tema.map((t) => [t.id, t.kategori, t.jumlah])).toEqual([["T1", "Company Benefit", 3], ["T2", "Kinerja SPV", 1], ["T3", "Technical Issue", 1], ["T4", "Kinerja SPV", 1]]);
    expect(peta.tags["ghost:x"]).toBeUndefined();
    const m = composeMasalah(tally, [{ id: "T1", judul: "SPG minta libur 4x", inti: "Libur 2x kurang.", contoh: [], usulan: "HR kaji jadwal.", berulang: false }]);
    expect(conclusionDraft("Company Benefit", peta, m, 20, "SPV area")).toBe("• SPG minta libur 4x — 3 orang (15%)\n  Terbanyak di SPV area: Citra 25%, Budi 20%\n  Libur 2x kurang.\n  Usulan: HR kaji jadwal.");
    expect(conclusionDraft("Kinerja SPV", peta, m, 20, "SPV area")).toBe("• Chat — 1 orang (5%)\n• Lambat — 1 orang (5%)");
    expect(conclusionDraft("Personal Issue", peta, m, 20, null)).toBe("");
  });
});

describe("waitBeforeNext", () => {
  it("menunggu hanya bila sisa jatah token kurang", () => {
    expect(waitBeforeNext(7500, 5)).toBe(0);
    expect(waitBeforeNext(1200, 41.3)).toBe(44);
    expect(waitBeforeNext(1200, null)).toBe(62);
    expect(waitBeforeNext(null, null)).toBe(0);
  });
});

describe("buildInsightPrompt dengan tema masalah", () => {
  const base = {
    survey: { title: "Feedback SPG", audience: "SPG", questions: Q, headline: [] as string[] }, period: "2026-10-01",
    summaries: [{ period: "2026-10-01", n: 20, suppressed: false, questions: {} }], segments: null, openActions: [], targetCount: null,
    comments: [{ question: "Masukan", text: "komentar mentah yang tidak boleh ikut" }],
  };
  it("tanpa tema: perilaku lama (komentar mentah dikirim)", () => {
    expect(buildInsightPrompt(base)).toContain("komentar mentah yang tidak boleh ikut");
  });
  it("dengan tema: komentar mentah tidak dikirim, tabel tema & tugas masalah_utama dikirim", () => {
    const p = buildInsightPrompt({ ...base, masalah: "TEMA MASALAH DARI SEMUA KOMENTAR …", positives: ["SPV ramah dan cepat datang"] });
    expect(p).not.toContain("komentar mentah yang tidak boleh ikut");
    expect(p).toContain("TEMA MASALAH DARI SEMUA KOMENTAR");
    expect(p).toContain("SPV ramah dan cepat datang");
    expect(p).toContain('"masalah_utama"');
    expect(id(p)).toMatch(/jangan menghitung ulang/);
  });
});
