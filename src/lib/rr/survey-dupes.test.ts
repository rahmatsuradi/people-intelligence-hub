import { describe, expect, it } from "vitest";
import { findDuplicates, type NewEntry, type OtherEntry } from "./survey-dupes";

const at = (min: number) => new Date(Date.UTC(2026, 10, 7, 3, min)).toISOString();
const other = (id: string, extra: Partial<OtherEntry> = {}): OtherEntry => ({
  id, respondent_name: "Ani Lestari", respondent_email: "081234567890", submitted_at: at(0), flags: [], store: "Mall A", ...extra,
});
const mine = (extra: Partial<NewEntry> = {}): NewEntry => ({ id: "baru", name: "Ani Lestari", contact: "081234567890", submittedAt: at(5), store: "Mall A", ...extra });

describe("findDuplicates: SPG → SPV", () => {
  it("orang sama, outlet sama, kontak sama: isian lama dikeluarkan", () => {
    const r = findDuplicates("spv_report", mine(), [other("lama", { flags: ["x"] })]);
    expect(r.replaced).toEqual([{ id: "lama", flag: "isian_ganda_outlet_sama" }]);
    expect(r.selfFlags).toEqual(["punya_isian_ganda_outlet_sama"]);
  });

  it("penulisan nama, outlet, dan nomor yang berbeda tetap dianggap sama", () => {
    const r = findDuplicates("spv_report", mine({ name: "ani  lestari", store: "mall-a", contact: "+62 812-3456-7890" }), [other("lama")]);
    expect(r.replaced.map((x) => x.id)).toEqual(["lama"]);
  });

  it("SPG backup: orang sama di outlet berbeda bukan ganda", () => {
    expect(findDuplicates("spv_report", mine({ store: "Mall B" }), [other("lama")])).toEqual({ replaced: [], selfFlags: [] });
  });

  it("nama dan outlet sama tapi kontak beda: tidak dikeluarkan, HR yang memutuskan", () => {
    const r = findDuplicates("spv_report", mine({ contact: "089999999999" }), [other("lama")]);
    expect(r.replaced).toEqual([]);
    expect(r.selfFlags).toEqual(["cek_isian_ganda"]);
  });

  it("dua orang berbeda memakai HP yang sama: keduanya dihitung", () => {
    expect(findDuplicates("spv_report", mine({ name: "Budi" }), [other("lama")])).toEqual({ replaced: [], selfFlags: [] });
  });
});

describe("findDuplicates: 360", () => {
  const rater = (id: string, extra: Partial<OtherEntry> = {}) => other(id, { rater: "Doni", ...extra });

  it("penilai sama: isian lama dikeluarkan", () => {
    expect(findDuplicates("360", mine({ rater: "Doni" }), [rater("lama")]).replaced.map((x) => x.id)).toEqual(["lama"]);
  });

  it("penilai lain tidak tersentuh", () => {
    expect(findDuplicates("360", mine({ rater: "Winda" }), [rater("lama")])).toEqual({ replaced: [], selfFlags: [] });
  });

  it("mengaku penilai yang sudah mengisi, dengan nama dan kontak lain: isian asli tetap, isian baru ditandai", () => {
    const r = findDuplicates("360", mine({ rater: "Doni", name: "Orang Lain", contact: "081111111111" }), [rater("lama")]);
    expect(r.replaced).toEqual([]);
    expect(r.selfFlags).toEqual(["cek_isian_ganda"]);
  });
});

describe("findDuplicates: survei lain", () => {
  it("kontak sama dan nama cocok (kata pertama cukup): isian lama dikeluarkan", () => {
    const r = findDuplicates("pulse", mine({ name: "Ani" }), [other("lama")]);
    expect(r.replaced).toEqual([{ id: "lama", flag: "isian_ganda" }]);
    expect(r.selfFlags).toEqual([]);
  });

  it("kontak sama tapi nama beda (HP dipinjam, kontak asal): keduanya dihitung, isian baru ditandai", () => {
    expect(findDuplicates("pulse", mine({ name: "Budi Santoso" }), [other("lama")])).toEqual({ replaced: [], selfFlags: ["cek_isian_ganda"] });
    expect(findDuplicates("pulse", mine({ name: "Citra", contact: "000000000" }), [other("lama", { respondent_name: "Ani", respondent_email: "000000000" })]))
      .toEqual({ replaced: [], selfFlags: ["cek_isian_ganda"] });
  });

  it("email yang memuat deretan angka tidak dibaca sebagai nomor HP", () => {
    expect(findDuplicates("pulse", mine({ contact: "ani081234567890@contoh.test" }), [other("lama", { respondent_email: "budi081234567890@contoh.test" })]).replaced).toEqual([]);
  });

  it("isian dari link pribadi yang dipakai orang lain tidak mengeluarkan isian siapa pun", () => {
    expect(findDuplicates("pulse", mine({ mayReplace: false }), [other("lama")])).toEqual({ replaced: [], selfFlags: ["cek_isian_ganda"] });
  });

  it("nama sama, kontak beda: ditandai saja", () => {
    const r = findDuplicates("pulse", mine({ contact: "ani@contoh.test" }), [other("lama")]);
    expect(r).toEqual({ replaced: [], selfFlags: ["cek_isian_ganda"] });
  });
});

describe("findDuplicates: kiriman bersamaan", () => {
  it("isian yang lebih baru tidak dikeluarkan, supaya dua kiriman tidak saling menghapus hitungan", () => {
    expect(findDuplicates("pulse", mine({ submittedAt: at(5) }), [other("lebih-baru", { submitted_at: at(9) })]).replaced).toEqual([]);
  });

  it("waktu sama persis: hanya satu sisi yang mengeluarkan", () => {
    const a = findDuplicates("pulse", mine({ id: "a", submittedAt: at(5) }), [other("b", { submitted_at: at(5) })]);
    const b = findDuplicates("pulse", mine({ id: "b", submittedAt: at(5) }), [other("a", { submitted_at: at(5) })]);
    expect([a.replaced.length, b.replaced.length].sort()).toEqual([0, 1]);
  });
});
