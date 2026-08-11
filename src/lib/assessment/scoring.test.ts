import { describe, it, expect } from "vitest";
import { keyedValue, scorePersonality, scoreCognitive, scoreSjt, scoreAll } from "./scoring";
import { PERSONALITY_ITEMS } from "./items-personality";
import { COGNITIVE_ITEMS, COGNITIVE_ITEMS_BY_SUBTEST } from "./items-cognitive";
import { SJT_ITEMS } from "./items-sjt";
import type { ResponseMap } from "./types";

describe("keyedValue", () => {
  it("meneruskan nilai apa adanya untuk item ber-key positif", () => {
    expect(keyedValue(1, 1)).toBe(1);
    expect(keyedValue(5, 1)).toBe(5);
  });

  it("membalik nilai untuk item ber-key negatif (6 - x)", () => {
    expect(keyedValue(1, -1)).toBe(5);
    expect(keyedValue(3, -1)).toBe(3); // titik tengah tidak berubah
    expect(keyedValue(5, -1)).toBe(1);
  });
});

describe("scorePersonality", () => {
  it("menghasilkan skor maksimum ketika semua item dijawab searah key", () => {
    // Menjawab 5 pada item positif dan 1 pada item negatif = paling 'setuju'
    // dengan sifat tsb pada tiap domain -> raw harus 50 (10 item x 5).
    const responses: ResponseMap = {};
    for (const it of PERSONALITY_ITEMS) responses[it.id] = it.keying === 1 ? 5 : 1;

    for (const s of scorePersonality(responses)) {
      expect(s.raw).toBe(50);
      expect(s.answered).toBe(10);
      expect(s.maxPossible).toBe(50);
    }
  });

  it("menghasilkan skor minimum ketika semua item dijawab berlawanan key", () => {
    const responses: ResponseMap = {};
    for (const it of PERSONALITY_ITEMS) responses[it.id] = it.keying === 1 ? 1 : 5;
    for (const s of scorePersonality(responses)) expect(s.raw).toBe(10);
  });

  it("menjawab semua 3 (netral) menghasilkan titik tengah pada setiap domain", () => {
    const responses: ResponseMap = {};
    for (const it of PERSONALITY_ITEMS) responses[it.id] = 3;
    for (const s of scorePersonality(responses)) expect(s.raw).toBe(30);
  });

  it("memprorata skor ketika sebagian item tidak dijawab, bukan menghitungnya nol", () => {
    // Hanya 5 dari 10 item C dijawab, semuanya bernilai keyed 4.
    const cItems = PERSONALITY_ITEMS.filter((i) => i.scale === "C");
    const responses: ResponseMap = {};
    for (const it of cItems.slice(0, 5)) responses[it.id] = it.keying === 1 ? 4 : 2;

    const c = scorePersonality(responses).find((s) => s.scaleId === "C")!;
    expect(c.answered).toBe(5);
    expect(c.raw).toBe(40); // rata-rata 4 x 10 item, bukan 20
  });

  it("mengembalikan raw 0 dan answered 0 ketika tidak ada jawaban sama sekali", () => {
    const c = scorePersonality({}).find((s) => s.scaleId === "C")!;
    expect(c.raw).toBe(0);
    expect(c.answered).toBe(0);
  });

  it("tidak memasukkan item QC (attention/desirability) ke skor sifat", () => {
    // Menjawab 5 pada seluruh item QC tidak boleh mengubah skor domain mana pun.
    const base: ResponseMap = {};
    for (const it of PERSONALITY_ITEMS) base[it.id] = 3;
    const withQc: ResponseMap = { ...base, "P-QC01": 5, "P-QC02": 5, "P-SD01": 5, "P-SD02": 5, "P-SD03": 5, "P-SD04": 5 };

    expect(scorePersonality(withQc)).toEqual(scorePersonality(base));
  });
});

describe("scoreCognitive", () => {
  it("menghitung jawaban benar per sub-tes dan total", () => {
    const responses: ResponseMap = {};
    for (const it of COGNITIVE_ITEMS) responses[it.id] = it.answerIndex;

    const scores = scoreCognitive(responses);
    expect(scores.find((s) => s.scaleId === "COG_NUM")!.raw).toBe(10);
    expect(scores.find((s) => s.scaleId === "COG_VER")!.raw).toBe(10);
    expect(scores.find((s) => s.scaleId === "COG_LOG")!.raw).toBe(10);
    expect(scores.find((s) => s.scaleId === "COG_TOTAL")!.raw).toBe(30);
  });

  it("memperlakukan item yang tidak dijawab sebagai tidak benar (bukan diprorata)", () => {
    // Hanya 3 item numerik dijawab, semuanya benar. Skor harus 3, bukan 10.
    const responses: ResponseMap = {};
    for (const it of COGNITIVE_ITEMS_BY_SUBTEST.NUM.slice(0, 3)) responses[it.id] = it.answerIndex;

    const num = scoreCognitive(responses).find((s) => s.scaleId === "COG_NUM")!;
    expect(num.raw).toBe(3);
    expect(num.answered).toBe(3);
    expect(num.itemCount).toBe(10);
  });

  it("jawaban salah tidak menambah skor", () => {
    const responses: ResponseMap = {};
    for (const it of COGNITIVE_ITEMS) {
      responses[it.id] = (it.answerIndex + 1) % it.options.length; // selalu salah
    }
    expect(scoreCognitive(responses).find((s) => s.scaleId === "COG_TOTAL")!.raw).toBe(0);
  });

  it("setiap item kognitif punya answerIndex yang valid", () => {
    for (const it of COGNITIVE_ITEMS) {
      expect(it.options.length).toBeGreaterThanOrEqual(3);
      expect(it.answerIndex).toBeGreaterThanOrEqual(0);
      expect(it.answerIndex).toBeLessThan(it.options.length);
    }
  });
});

describe("scoreSjt", () => {
  it("menjumlahkan nilai efektivitas opsi yang dipilih", () => {
    // Memilih opsi paling efektif di setiap skenario.
    const responses: ResponseMap = {};
    for (const it of SJT_ITEMS) {
      const best = it.options.reduce((bi, o, i, arr) => (o.effectiveness > arr[bi].effectiveness ? i : bi), 0);
      responses[it.id] = best;
    }
    const total = scoreSjt(responses).find((s) => s.scaleId === "SJT_TOTAL")!;
    expect(total.raw).toBe(SJT_ITEMS.length * 5);
    expect(total.maxPossible).toBe(SJT_ITEMS.length * 5);
  });

  it("membatasi itemCount pada item yang benar-benar disajikan", () => {
    const subset = SJT_ITEMS.slice(0, 4).map((i) => i.id);
    const responses: ResponseMap = {};
    for (const id of subset) responses[id] = 0;

    const total = scoreSjt(responses, subset).find((s) => s.scaleId === "SJT_TOTAL")!;
    expect(total.itemCount).toBe(4);
    expect(total.maxPossible).toBe(20);
  });

  it("mengabaikan index opsi yang di luar jangkauan, bukan menganggapnya jawaban", () => {
    const it = SJT_ITEMS[0];
    const total = scoreSjt({ [it.id]: 99 }, [it.id]).find((s) => s.scaleId === "SJT_TOTAL")!;
    expect(total.answered).toBe(0);
    expect(total.raw).toBe(0);
  });

  it("setiap opsi SJT punya nilai efektivitas 1-5 dan setiap skenario punya opsi terbaik", () => {
    for (const it of SJT_ITEMS) {
      expect(it.options.length).toBeGreaterThanOrEqual(3);
      for (const o of it.options) {
        expect(o.effectiveness).toBeGreaterThanOrEqual(1);
        expect(o.effectiveness).toBeLessThanOrEqual(5);
      }
      // Tanpa satu opsi yang jelas terbaik, item tidak membedakan apa pun.
      const max = Math.max(...it.options.map((o) => o.effectiveness));
      expect(it.options.filter((o) => o.effectiveness === max)).toHaveLength(1);
      expect(max).toBe(5);
    }
  });
});

describe("scoreAll", () => {
  it("hanya menskor jenis tes yang itemnya benar-benar disajikan", () => {
    const cogOnly = COGNITIVE_ITEMS.map((i) => i.id);
    const responses: ResponseMap = {};
    for (const it of COGNITIVE_ITEMS) responses[it.id] = it.answerIndex;

    const ids = scoreAll(responses, cogOnly).map((s) => s.scaleId);
    expect(ids).toContain("COG_TOTAL");
    expect(ids).not.toContain("C");       // kepribadian tidak disajikan
    expect(ids).not.toContain("SJT_TOTAL"); // SJT tidak disajikan
  });
});
