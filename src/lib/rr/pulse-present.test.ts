import { describe, expect, it } from "vitest";
import { leaderView, maskNames, spvHighlights } from "./pulse-present";
import type { Leader360, SpvRow } from "./pulse";

const row = (spv: string, score: number | null, scorePrev: number | null, scales: Record<string, number | null> = {}): SpvRow => ({
  spv, n: 10, roster: 10, participation: 100, score, scorePrev, scales, weakest: null, followed: null, unresolved: null,
});
const label = (k: string) => `Skala ${k}`;

describe("spvHighlights", () => {
  const rows = [
    row("Fikih", 4.06, 4.4, { a: 79, b: 64 }),
    row("Winda", 4.5, 4.55, { a: 90, b: 88 }),
    row("Irfan", 4.67, 4.45, { a: 95, b: 96 }),
    row("Rangga", 4.95, 4.95, { a: 100, b: 100 }),
  ];
  const h = spvHighlights(rows, ["a", "b"], label);

  it("terendah dan tertinggi mengikuti urutan skor", () => {
    expect(h.lowest?.spv).toBe("Fikih");
    expect(h.highest?.spv).toBe("Rangga");
  });
  it("sel terlemah = persen 4–5 paling kecil beserta nama skalanya", () => {
    expect(h.weakestCell).toEqual({ spv: "Fikih", scale: "Skala b", pct: 64 });
  });
  it("penurunan dan kenaikan terbesar; perubahan di bawah ambang dianggap sama", () => {
    expect(h.biggestDrop?.spv).toBe("Fikih");
    expect(h.biggestDrop?.delta).toBeCloseTo(-0.34, 2);
    expect(h.biggestRise?.spv).toBe("Irfan");
    expect(h).toMatchObject({ down: 1, up: 1, flat: 2 });
  });
  it("tanpa bulan pembanding tidak ada klaim naik/turun", () => {
    const x = spvHighlights([row("A", 4.5, null), row("B", 4.7, null)], [], label);
    expect(x.biggestDrop).toBeNull();
    expect(x.biggestRise).toBeNull();
    expect(x).toMatchObject({ down: 0, up: 0, flat: 0 });
  });
  it("SPV tanpa skor tidak jadi terendah dan data kosong tidak melempar", () => {
    expect(spvHighlights([row("A", null, null, { a: null })], ["a"], label)).toMatchObject({ lowest: null, highest: null, weakestCell: null });
    expect(spvHighlights([], [], label).lowest).toBeNull();
  });
});

describe("maskNames", () => {
  it("urut abjad, stabil, dan nama ganda dipetakan sekali", () => {
    expect(maskNames(["Winda", "Fikih", "Fikih", "Doni"])).toEqual({ Doni: "SPV A", Fikih: "SPV B", Winda: "SPV C" });
  });
});

describe("leaderView", () => {
  const period = (avg: number, items: Record<string, number>, byRater: number[], raters = byRater.length) => ({
    avg, raters, items, byRater: byRater.map((a, i) => ({ rater: `P${i}`, avg: a })),
    strengths: [{ rater: "Rahasia", text: "Cepat tanggap" }], improvements: [{ rater: "Rahasia", text: "Lebih sering turun ke lapangan" }],
  });
  const leader: Leader360 = {
    name: "Irfan",
    periods: {
      "2026-08-01": period(2.9, { x: 3.0, y: 2.8 }, [2.5, 3.3, 3.0, 2.8]),
      "2026-09-01": period(3.2, { x: 2.8, y: 3.6 }, [2.4, 4.0, 3.2, 3.0, 3.4, 3.2]),
    },
  };
  const v = leaderView(leader, "2026-09-01", ["x", "y"], label)!;

  it("membandingkan dengan putaran sebelumnya dan mencatat jumlah penilai kedua putaran", () => {
    expect(v).toMatchObject({ previousPeriod: "2026-08-01", raters: 6, previousRaters: 4, avg: 3.2, previousAvg: 2.9 });
    expect(v.aspects[0]).toEqual({ key: "x", label: "Skala x", current: 2.8, previous: 3.0 });
  });
  it("aspek terlemah dan terkuat", () => {
    expect(v.weakest?.key).toBe("x");
    expect(v.strongest?.key).toBe("y");
  });
  it("sebaran antar-penilai tanpa nama; kutipan tidak membawa nama penilai", () => {
    expect(v.spread).toEqual({ min: 2.4, max: 4 });
    expect(v.strengths).toEqual(["Cepat tanggap"]);
    expect(JSON.stringify(v)).not.toContain("Rahasia");
    expect(JSON.stringify(v)).not.toContain("P0");
  });
  it("putaran pertama tidak punya pembanding; putaran tanpa data = null", () => {
    expect(leaderView(leader, "2026-08-01", ["x"], label)).toMatchObject({ previousPeriod: null, previousAvg: null });
    expect(leaderView(leader, "2026-07-01", ["x"], label)).toBeNull();
  });
});
