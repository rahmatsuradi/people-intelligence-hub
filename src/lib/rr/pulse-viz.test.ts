import { describe, expect, it } from "vitest";
import { coverage, headlineKpis, optionShares, spvSeries, themeMatrix, topThemes } from "./pulse-viz";
import type { PeriodSummary, SegmentPeriod, SurveyQuestion, ThemeDef, ThemePeriod } from "./pulse";

const happiness: SurveyQuestion = {
  key: "happiness", label: "Bahagia", type: "choice", favorable: ["Bahagia", "Sangat Bahagia"], kpiLabel: "Indeks bahagia",
  options: [{ value: "Tidak Bahagia" }, { value: "Bahagia" }, { value: "Sangat Bahagia", label: "Sangat bahagia" }],
};
const stress: SurveyQuestion = { key: "stress", label: "Stres", type: "choice", risk: ["Setiap hari"], kpiLabel: "Stres tinggi", options: [{ value: "Tidak sama sekali" }, { value: "Setiap hari" }] };
const P = (period: string, h: Record<string, number>, st: Record<string, number> = {}, over: Partial<PeriodSummary> = {}): PeriodSummary => {
  const n = Object.values(h).reduce((a, b) => a + b, 0);
  return { period, n, suppressed: n < 3, questions: n < 3 ? {} : { happiness: { answered: n, counts: h }, stress: { answered: n, counts: st } }, ...over };
};

describe("optionShares", () => {
  const rows = optionShares(happiness, [P("2026-08-01", { Bahagia: 6, "Tidak Bahagia": 2 }), P("2026-09-01", { Bahagia: 1 })]);
  it("persen per opsi urut sesuai definisi, label opsi dipakai", () => {
    expect(rows[0].parts.map((x) => [x.label, x.pct])).toEqual([["Tidak Bahagia", 25], ["Bahagia", 75], ["Sangat bahagia", 0]]);
  });
  it("bulan yang disembunyikan tetap jadi baris kosong", () => {
    expect(rows[1]).toMatchObject({ suppressed: true, n: 0 });
    expect(rows[1].parts.every((x) => x.pct === 0)).toBe(true);
  });
});

describe("themeMatrix", () => {
  const defs: ThemeDef[] = [{ key: "libur", label: "Libur", pattern: "", fields: [] }, { key: "gaji", label: "Gaji", pattern: "", fields: [] }, { key: "bpjs", label: "BPJS", pattern: "", fields: [] }];
  const data: ThemePeriod[] = [
    { period: "2026-08-01", n: 100, themes: { libur: 30, gaji: 40 } },
    { period: "2026-09-01", n: 200, themes: { libur: 60, gaji: 40 } },
    { period: "2026-10-01", n: 2, themes: {} },
  ];
  const m = themeMatrix(defs, data, ["2026-08-01", "2026-09-01", "2026-10-01"]);

  it("diurut dari yang terbanyak di bulan terakhir yang punya data; periode < 3 orang = tanpa angka", () => {
    expect(m.map((r) => r.key)).toEqual(["libur", "gaji", "bpjs"]);
    expect(m[0].cells[2]).toEqual({ period: "2026-10-01", count: null, pct: null, n: 2 });
  });
  it("perubahan memakai persen responden, bukan jumlah mentah", () => {
    expect(m[0].latest).toBe(60);
    expect(m[0].deltaPct).toBe(0);     // 30% → 30%
    expect(m[1].deltaPct).toBe(-20);   // 40% → 20%
  });
  it("tema yang tidak disebut siapa pun tetap 0, bukan hilang", () => {
    expect(m[2].cells[1].count).toBe(0);
    expect(topThemes(m).map((r) => r.key)).toEqual(["libur", "gaji"]);
  });
});

describe("spvSeries", () => {
  const scale = (key: string): SurveyQuestion => ({ key, label: key, type: "scale", min: 1, max: 5 });
  const survey = { questions: [scale("a"), scale("b")] };
  const seg = (period: string, groups: SegmentPeriod["groups"]): SegmentPeriod => ({ period, hidden: 0, groups });
  const g = (n: number, a: number, b: number) => ({ n, questions: { a: { answered: n, counts: { [a]: n } }, b: { answered: n, counts: { [b]: n } } } });
  const out = spvSeries(survey, [seg("2026-08-01", { Winda: g(5, 4, 4), Doni: g(4, 5, 5) }), seg("2026-09-01", { Winda: g(5, 3, 4) })], ["a", "b"]);

  it("terendah dulu; bulan tanpa data = null", () => {
    expect(out.map((s) => s.spv)).toEqual(["Winda", "Doni"]);
    expect(out[0].points.map((p) => p.score)).toEqual([4, 3.5]);
    expect(out[1].points.map((p) => p.score)).toEqual([5, null]);
  });
  it("skor terbaru & sebelumnya memakai bulan yang punya data", () => {
    expect(out[0]).toMatchObject({ latest: 3.5, previous: 4 });
    expect(out[1]).toMatchObject({ latest: 5, previous: null });
  });
});

describe("coverage", () => {
  it("melaporkan masuk / dihitung / dikeluarkan / orang unik", () => {
    expect(coverage([P("2026-09-01", { Bahagia: 5 }, {}, { n_total: 8, n_excluded: 3, n_people: 6 })])).toEqual([
      { period: "2026-09-01", label: "September 2026", total: 8, counted: 5, excluded: 3, people: 6 },
    ]);
  });
  it("tanpa data total (survei lama) = sama dengan yang dihitung", () => {
    expect(coverage([P("2026-09-01", { Bahagia: 5 })])[0]).toMatchObject({ total: 5, excluded: 0, people: 5 });
  });
});

describe("headlineKpis", () => {
  const survey = { questions: [happiness, stress], headline: ["happiness", "stress"] };
  const sm = [P("2026-08-01", { Bahagia: 9, "Tidak Bahagia": 1 }, { "Setiap hari": 1, "Tidak sama sekali": 9 }), P("2026-09-01", { Bahagia: 6, "Tidak Bahagia": 4 }, { "Setiap hari": 3, "Tidak sama sekali": 7 })];
  const out = headlineKpis(survey, sm, "2026-09-01");
  it("persen, perubahan, dan arah baik/buruk (risiko naik = buruk)", () => {
    expect(out[0]).toMatchObject({ label: "Indeks bahagia", pct: 60, delta: -30, better: false, risk: false });
    expect(out[1]).toMatchObject({ label: "Stres tinggi", pct: 30, delta: 20, better: false, risk: true });
  });
  it("tren memuat titik sampai bulan terpilih; bulan tak dikenal = kosong", () => {
    expect(out[0].series).toEqual([90, 60]);
    expect(headlineKpis(survey, sm, "2027-01-01")).toEqual([]);
  });
});
