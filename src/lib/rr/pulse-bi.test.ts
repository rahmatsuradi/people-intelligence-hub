import { describe, expect, it } from "vitest";
import { ceilingItems, compileThemes, crossTab, favorableOf, gap, issueFunnel, personKey, personScore, spanOfControl, themeBySegment, themeGroups, themesOf } from "./pulse-bi";
import type { AnswerValue, SurveyQuestion, ThemeDef } from "./pulse";

const R = (answers: Record<string, AnswerValue>, excluded = false) => ({ answers, excluded });

describe("favorableOf & personScore", () => {
  it("skala ≥ 4 = favorable; tidak dijawab = null (bukan false)", () => {
    expect(favorableOf(R({ comfort: 4 }), "comfort")).toBe(true);
    expect(favorableOf(R({ comfort: 3 }), "comfort")).toBe(false);
    expect(favorableOf(R({}), "comfort")).toBeNull();
  });
  it("rata-rata hanya dari skala yang dijawab", () => {
    expect(personScore(R({ a: 5, b: 3 }), ["a", "b", "c"])).toBe(4);
    expect(personScore(R({}), ["a"])).toBeNull();
  });
});

describe("crossTab", () => {
  const rs = [
    ...Array.from({ length: 4 }, () => R({ visit: "Lebih dari 3 kali", comfort: 5 })),
    R({ visit: "2 kali", comfort: 3 }), R({ visit: "1 kali", comfort: 4 }), R({ visit: "2 kali", comfort: 2 }),
    R({ visit: "3 kali", comfort: 5 }),
    R({ visit: "2 kali", comfort: 1 }, true), // dikeluarkan: tidak dihitung
    R({ visit: "2 kali" }), // tidak menjawab hasil: dilewati
  ];
  const fav = (r: { answers: Record<string, AnswerValue> }) => favorableOf(r, "comfort");
  it("menggabungkan pilihan ke bucket dan memakai urutan bucket", () => {
    const rows = crossTab(rs, "visit", fav, { buckets: { "> 3 kali": ["Lebih dari 3 kali"], "3 kali": ["3 kali"], "≤ 2 kali": ["Tidak Pernah", "1 kali", "2 kali"] } });
    expect(rows.map((r) => [r.value, r.n, r.hits])).toEqual([["> 3 kali", 4, 4], ["3 kali", 1, 1], ["≤ 2 kali", 3, 1]]);
  });
  it("kelompok di bawah 3 orang tidak diberi persen", () => {
    const rows = crossTab(rs, "visit", fav, { buckets: { a: ["Lebih dari 3 kali"], b: ["3 kali"], c: ["1 kali", "2 kali"] } });
    expect(rows[1].pct).toBeNull();
    expect(rows[2].pct).toBeCloseTo(33.33, 1);
    expect(gap(rows)).toBeCloseTo(66.67, 1);
  });
  it("gap null bila kurang dari dua kelompok berpersen", () => {
    expect(gap([{ value: "a", n: 1, hits: 1, pct: null }])).toBeNull();
  });
});

describe("spanOfControl", () => {
  const order = ["Tidak Pernah", "1 kali", "2 kali", "3 kali", "Lebih dari 3 kali"];
  const rs = [
    ...Array.from({ length: 6 }, (_, i) => R({ spv: "A", visit: i < 3 ? "Lebih dari 3 kali" : "2 kali" })),
    ...Array.from({ length: 2 }, () => R({ spv: "B", visit: "Lebih dari 3 kali" })),
  ];
  const rows = spanOfControl(rs, "spv", "visit", order, ["Tidak Pernah", "1 kali", "2 kali"]);
  it("diurut dari SPG terbanyak; porsi terhadap semua SPG", () => {
    expect(rows.map((r) => [r.spv, r.n, r.share])).toEqual([["A", 6, 75], ["B", 2, 25]]);
  });
  it("% kunjungan tertinggi & kurang; SPV < 3 SPG tidak diberi persen", () => {
    expect(rows[0]).toMatchObject({ top: 50, low: 50 });
    expect(rows[0].dist["2 kali"]).toBe(50);
    expect(rows[1].top).toBeNull();
  });
});

describe("issueFunnel", () => {
  it("melapor → nasib laporan → masih ada kendala; isian dikeluarkan tidak dihitung", () => {
    const f = issueFunnel([
      R({ reported: "Ya", followed: "Ya, diselesaikan", unresolved: "Tidak" }),
      R({ reported: "Ya", followed: "Belum ada tindak lanjut", unresolved: "Ya" }),
      R({ reported: "Ya", followed: "Ya, sedang diproses" }),
      R({ reported: "Tidak", unresolved: "Ya" }),
      R({ reported: "Ya", followed: "Ya, diselesaikan" }, true),
    ]);
    expect(f).toEqual({ total: 4, reported: 3, solved: 1, inProgress: 1, notFollowed: 1, unresolved: 2 });
  });
});

describe("ceilingItems", () => {
  const qs: SurveyQuestion[] = [
    { key: "coaching", label: "Coaching", type: "choice" },
    { key: "reported", label: "Melapor", type: "choice" },
    { key: "hid", label: "Label HR", type: "choice", hidden: true },
  ];
  it("pertanyaan pilihan dengan ≥ 95% jawaban sama ditandai; pertanyaan tersembunyi dilewati", () => {
    const rs = Array.from({ length: 20 }, (_, i) => R({ coaching: i === 0 ? "Tidak" : "Ya", reported: i % 2 ? "Ya" : "Tidak", hid: "x" }));
    expect(ceilingItems({ questions: qs }, rs).map((c) => [c.key, c.value, c.pct])).toEqual([["coaching", "Ya", 95]]);
  });
  it("kurang dari 10 jawaban tidak dinilai", () => {
    expect(ceilingItems({ questions: qs }, [R({ coaching: "Ya" })])).toEqual([]);
  });
});

describe("tema per responden", () => {
  const defs: ThemeDef[] = [
    { key: "libur", label: "Libur", pattern: "libur|\\yoff\\y", fields: ["c"], group: "Hak" },
    { key: "gaji", label: "Gaji", pattern: "gaji|\\yumr\\y", fields: ["c", "d"], group: "Hak" },
    { key: "stok", label: "Stok", pattern: "stok", fields: ["c"], group: "Operasional" },
    { key: "rusak", label: "Rusak", pattern: "(", fields: ["c"] },
  ];
  const themes = compileThemes(defs);
  it("\\y PostgreSQL → batas kata JavaScript, tanpa beda huruf besar/kecil; pola rusak dilewati", () => {
    expect(themesOf(R({ c: "Minta LIBUR seminggu sekali" }), themes)).toEqual(["libur"]);
    expect(themesOf(R({ c: "kantor office" }), themes)).toEqual([]); // "off" di dalam kata tidak cocok
    expect(themesOf(R({ c: "hari off" }), themes)).toEqual(["libur"]);
    expect(themes.find((t) => t.key === "rusak")?.re).toBeNull();
    expect(themes.find((t) => t.key === "rusak")?.group).toBe("Lainnya");
  });
  it("orang dihitung sekali per kelompok walau menyebut dua tema di kelompok itu", () => {
    const g = themeGroups([R({ c: "libur dan gaji" }), R({ d: "gaji" }), R({ c: "stok kosong" }), R({ c: "aman" })], themes);
    expect(g.total).toBe(4);
    expect(g.any).toBe(3);
    expect(g.groups[0]).toMatchObject({ group: "Hak", n: 2, pct: 50 });
    expect(g.groups[0].themes).toEqual([{ key: "gaji", label: "Gaji", n: 2 }, { key: "libur", label: "Libur", n: 1 }]);
  });
  it("tema × kelompok; kelompok kecil tanpa persen", () => {
    const rows = themeBySegment([R({ spv: "A", c: "libur" }), R({ spv: "A", c: "aman" }), R({ spv: "A", c: "libur" }), R({ spv: "B", c: "libur" })], themes, "spv", ["libur"]);
    expect(rows[0].segment).toBe("A");
    expect(rows[0].values.libur).toBeCloseTo(66.67, 1);
    expect(rows[1].values.libur).toBeNull();
  });
});

describe("personKey", () => {
  it("nama huruf saja + outlet; tanpa nama = null", () => {
    expect(personKey({ respondent_name: "Siti A.", answers: { store: "Mall X - 2" } })).toBe("sitia|mallx2");
    expect(personKey({ respondent_name: null, answers: {} })).toBeNull();
  });
});
