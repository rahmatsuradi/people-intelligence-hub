import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { fillTemplate, readFilledRows, readUnits } from "./xlsx";
import { KANTORKU_TEMPLATE_B64 } from "./template-rica-rico";
import { KK_COLUMNS } from "./spec";

const template = () => new Uint8Array(Buffer.from(KANTORKU_TEMPLATE_B64, "base64"));
const sheet = (xlsx: Uint8Array, n: number) => strFromU8(unzipSync(xlsx)[`xl/worksheets/sheet${n}.xml`]);

describe("template KantorKu", () => {
  it("unit perusahaan terbaca dari sheet Existing Data", () => {
    const u = readUnits(template());
    // Template asli akun KantorKu Rica Rico (diunduh 18 Nov 2026): Branch = outlet/lokasi.
    expect(u.branches).toContain("Stasiun Juanda");
    expect(u.branches).toContain("Rica Rico Pusat");
    expect(u.branches).not.toContain("Jakarta 1 - Irfan");
    expect(u.branches.length).toBeGreaterThan(100);
    expect(u.departments).toEqual(expect.arrayContaining(["SPG", "Store Supervisor", "Santen"]));
    expect(u.positions).toEqual(["Manager", "Staff", "Freelance", "Supervisor", "Koordinator SPV", "Kepala Produksi"]);
  });

  it("judul kolom template cocok dengan spesifikasi (urutan A…AR)", () => {
    const files = unzipSync(template());
    const ss = strFromU8(files["xl/sharedStrings.xml"]);
    const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
    const row3 = sheet(template(), 2).match(/<row r="3"[\s\S]*?<\/row>/)![0];
    const headers = [...row3.matchAll(/<c r="([A-Z]+)3"[^>]*t="s"[^>]*><v>(\d+)<\/v>/g)].map((m) => [m[1], strings[+m[2]].replace(/\s+/g, " ")]);
    for (const c of KK_COLUMNS) {
      const h = headers.find(([col]) => col === c.col)?.[1] ?? "";
      expect(h.startsWith(c.header), `${c.col}: "${h}" vs "${c.header}"`).toBe(true);
    }
  });

  it("mengisi mulai baris 6 dan membiarkan sisanya utuh", () => {
    const vals = KK_COLUMNS.map((c) => (c.key === "basicSalary" ? 4900000 : c.key === "fullName" ? "Budi & <Sari>" : c.col === "T" ? "3171234567890001" : null));
    const out = fillTemplate(template(), [vals, vals]);
    const rows = readFilledRows(out);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("Budi & <Sari>");
    expect(rows[0][14]).toBe("4900000");
    expect(rows[0][19]).toBe("3171234567890001"); // NIK sebagai teks, bukan angka 3.17E15
    const s2 = sheet(out, 2);
    // Baris contoh (5), rumus Row Status, dan dropdown tetap ada.
    expect(s2).toContain('<c r="A5" s="60" t="s">');
    expect(s2).toMatch(/<c r="AS6" s="65" t="str"><f>IF\(\$D6=/);
    expect(s2).toContain("REF!$A$1:$J$1");
    expect(s2).toContain('<c r="T6" s="66" t="inlineStr">');
    expect(s2).toContain('<c r="O6" s="68"><v>4900000</v></c>');
    // Sheet lain tidak disentuh.
    for (const n of [1, 3, 4]) expect(sheet(out, n)).toBe(sheet(template(), n));
    expect(strFromU8(unzipSync(out)["xl/workbook.xml"])).toContain('fullCalcOnLoad="1"');
  });

  it("menolak jumlah nilai yang tidak sesuai kolom", () => {
    expect(() => fillTemplate(template(), [["a"]])).toThrow(/seharusnya/);
  });
});
