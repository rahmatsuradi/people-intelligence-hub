import { describe, expect, it } from "vitest";
import { summarizeRejects, type RejectRow } from "./store";
import { normName } from "./ktp-check";

const row = (o: Partial<RejectRow>): RejectRow => ({ id: crypto.randomUUID(), link_id: "L", status_code: 409, reason: "beda_ktp", fields: ["ktp"], name: "Dewi Fiktif", outlet: "Mall A", contact: null, created_at: "2026-11-25T10:00:00Z", ...o });

describe("summarizeRejects", () => {
  it("menggabungkan percobaan orang yang sama (nama + outlet), menghitung kali coba dan field", () => {
    const r = summarizeRejects([
      row({ created_at: "2026-11-25T10:00:00Z", fields: ["ktp"] }),
      row({ created_at: "2026-11-25T10:05:00Z", reason: "isian_tidak_valid", status_code: 400, fields: ["nik"], contact: "0812" }),
      row({ name: "DEWI  FIKTIF", created_at: "2026-11-25T10:09:00Z", fields: ["ktp"] }),
    ], [], normName);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tries: 3, contact: "0812", resolved: false });
    expect(r[0].fields.sort()).toEqual(["ktp", "nik"]);
    expect(r[0].last.created_at).toBe("2026-11-25T10:00:00Z"); // baris pertama dalam urutan masuk = terbaru (data diurut turun)
  });
  it("yang sesudahnya berhasil kirim ditandai selesai dan ditaruh di bawah", () => {
    const r = summarizeRejects([
      row({ name: "Sudah Beres", created_at: "2026-11-25T10:00:00Z" }),
      row({ name: "Belum Beres", created_at: "2026-11-24T10:00:00Z" }),
    ], [{ answers: { full_name: "sudah beres" }, submitted_at: "2026-11-25T11:00:00Z" }], normName);
    expect(r.map((x) => [x.name, x.resolved])).toEqual([["Belum Beres", false], ["Sudah Beres", true]]);
  });
  it("isian yang masuk SEBELUM penolakan tidak menyelesaikannya", () => {
    const r = summarizeRejects([row({ created_at: "2026-11-25T10:00:00Z" })], [{ answers: { full_name: "Dewi Fiktif" }, submitted_at: "2026-11-20T10:00:00Z" }], normName);
    expect(r[0].resolved).toBe(false);
  });
  it("outlet berbeda = orang berbeda (SPG backup)", () => {
    expect(summarizeRejects([row({ outlet: "Mall A" }), row({ outlet: "Mall B" })], [], normName)).toHaveLength(2);
  });
});
