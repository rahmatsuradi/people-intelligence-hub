import { describe, expect, it } from "vitest";
import { HR_KINDS, diffEntries, rebuildCollection, toEntries } from "./hr-records";

describe("toEntries", () => {
  it("list → [id, item], item tanpa id dilewati", () => {
    const list = [{ id: "a", n: 1 }, { n: 2 }, { id: "", n: 3 }, { id: "b", n: 4 }];
    expect(toEntries("list", list)).toEqual([
      ["a", { id: "a", n: 1 }],
      ["b", { id: "b", n: 4 }],
    ]);
  });

  it("map → [kunci, nilai], termasuk nilai string (pemetaan jabatan → grade)", () => {
    expect(toEntries("map", { "Kepala Outlet": "grade-3", Baker: "grade-1" })).toEqual([
      ["Kepala Outlet", "grade-3"],
      ["Baker", "grade-1"],
    ]);
  });

  it("cache kosong/rusak tidak melempar error", () => {
    expect(toEntries("list", null)).toEqual([]);
    expect(toEntries("map", null)).toEqual([]);
    expect(toEntries("map", [1, 2])).toEqual([]);
    expect(toEntries("list", { id: "x" })).toEqual([]);
  });
});

describe("diffEntries", () => {
  const a = { id: "a", nama: "Pelatihan Halal", createdAt: "2026-10-01" };
  const b = { id: "b", nama: "K3 Oven", createdAt: "2026-10-02" };

  it("item baru di depan list hanya mengirim item itu — bukan seluruh list", () => {
    const prev = toEntries("list", [a]);
    const next = toEntries("list", [b, a]);
    expect(diffEntries(prev, next)).toEqual({ upserts: [["b", b]], deletes: [] });
  });

  it("item yang diubah dikirim ulang, yang tidak berubah tidak", () => {
    const prev = toEntries("list", [a, b]);
    const next = toEntries("list", [{ ...a, nama: "Pelatihan Halal MUI" }, b]);
    const d = diffEntries(prev, next);
    expect(d.upserts.map(([id]) => id)).toEqual(["a"]);
    expect(d.deletes).toEqual([]);
  });

  it("item yang hilang dari list dihapus di cloud", () => {
    expect(diffEntries(toEntries("list", [a, b]), toEntries("list", [b]))).toEqual({ upserts: [], deletes: ["a"] });
  });

  it("menghapus satu kunci map hanya menghapus kunci itu", () => {
    const prev = toEntries("map", { "e1::k1": { level: 3 }, "e1::k2": { level: 2 } });
    const next = toEntries("map", { "e1::k2": { level: 2 } });
    expect(diffEntries(prev, next)).toEqual({ upserts: [], deletes: ["e1::k1"] });
  });

  it("tanpa perubahan apa pun → tidak ada yang dikirim", () => {
    const e = toEntries("list", [a, b]);
    expect(diffEntries(e, e)).toEqual({ upserts: [], deletes: [] });
  });

  it("cache awal kosong → semua item di-upsert, tidak ada yang dihapus", () => {
    expect(diffEntries([], toEntries("list", [a, b])).upserts).toHaveLength(2);
  });
});

describe("rebuildCollection", () => {
  it("list disusun terbaru dulu menurut createdAt, seperti unshift di store", () => {
    const rows = [
      { record_id: "lama", data: { id: "lama", createdAt: "2026-01-01T00:00:00Z" } },
      { record_id: "baru", data: { id: "baru", createdAt: "2026-10-01T00:00:00Z" } },
    ];
    expect((rebuildCollection("list", rows) as { id: string }[]).map((r) => r.id)).toEqual(["baru", "lama"]);
  });

  it("map disusun ulang dari record_id", () => {
    const rows = [{ record_id: "Baker", data: "grade-1" }];
    expect(rebuildCollection("map", rows)).toEqual({ Baker: "grade-1" });
  });

  it("cloud kosong → koleksi kosong (cloud menang, cache lama tidak dipertahankan)", () => {
    expect(rebuildCollection("list", [])).toEqual([]);
    expect(rebuildCollection("map", [])).toEqual({});
  });

  it("bolak-balik toEntries → rebuildCollection tidak mengubah isi", () => {
    const original = { e1: { performance: 3, potential: 2, updatedAt: "2026-10-24" } };
    const rows = toEntries("map", original).map(([record_id, data]) => ({ record_id, data }));
    expect(rebuildCollection("map", rows)).toEqual(original);
  });
});

describe("HR_KINDS", () => {
  it("awalan kunci unik — dua koleksi tidak boleh berbagi cache", () => {
    const prefixes = Object.values(HR_KINDS).map((k) => k.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("tidak ada awalan yang merupakan awalan dari awalan lain (startsWith di Settings)", () => {
    const prefixes = Object.values(HR_KINDS).map((k) => k.prefix);
    for (const p of prefixes) {
      expect(prefixes.filter((q) => q !== p && q.startsWith(p))).toEqual([]);
    }
  });
});
