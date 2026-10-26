import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTANCE, INSTANCES, INSTANCE_KEYS, resolveInstanceKey } from "./instance";
import { ACTIVE_COMPANY, ALL_COMPANIES, COMPANY_LENCIR, COMPANY_RICA_RICO, resolveCompanyProfile } from "./payroll/company-profile";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("resolveInstanceKey", () => {
  it("kosong atau tidak diisi → rica-rico, supaya pemasangan yang sudah berjalan tidak berubah", () => {
    expect(resolveInstanceKey(undefined)).toBe("rica-rico");
    expect(resolveInstanceKey("")).toBe("rica-rico");
    expect(resolveInstanceKey("   ")).toBe("rica-rico");
  });

  it("mengenali kunci yang sah, tidak peduli huruf besar dan spasi", () => {
    expect(resolveInstanceKey("lencir")).toBe("lencir");
    expect(resolveInstanceKey(" Lencir ")).toBe("lencir");
    expect(resolveInstanceKey("RICA-RICO")).toBe("rica-rico");
  });

  it("nilai asing GAGAL KERAS dan menyebut pilihan yang sah — bukan diam-diam jatuh ke rica-rico", () => {
    expect(() => resolveInstanceKey("lencr")).toThrow(/tidak dikenal/);
    expect(() => resolveInstanceKey("lencr")).toThrow(/rica-rico, lencir/);
    expect(() => resolveInstanceKey("ricarico")).toThrow();
  });
});

describe("konfigurasi instance", () => {
  it("setiap kunci menunjuk konfigurasi yang kuncinya sama", () => {
    for (const k of INSTANCE_KEYS) expect(INSTANCES[k].key).toBe(k);
  });

  it("INSTANCE aktif adalah salah satu yang terdaftar", () => {
    expect(INSTANCES[INSTANCE.key]).toBe(INSTANCE);
  });

  it("konfigurasi Lencir tidak memuat nama Rica Rico di teks mana pun (kebocoran merek)", () => {
    expect(JSON.stringify(INSTANCES.lencir)).not.toMatch(/rica[\s-]?rico/i);
  });

  it("konteks AI Lencir tidak mengarang jenis pekerjaan atau jumlah karyawan", () => {
    // Konteks karangan membuat Insight AI yakin tentang hal yang tidak ia ketahui:
    // tidak boleh ada angka sama sekali, dan tidak boleh meminjam istilah kerja Rica Rico.
    const ctx = INSTANCES.lencir.aiBusinessContext;
    expect(ctx).not.toMatch(/\d/);
    expect(ctx).not.toMatch(/\bSPG\b|\bSPV\b|outlet|stasiun|host live/i);
    expect(ctx).toMatch(/belum tercatat/i);
  });

  it("menu yang disembunyikan benar-benar ada di AppShell (id yang diganti nama tidak diam-diam berhenti bekerja)", () => {
    const shell = read("src/components/app-shell.tsx");
    for (const k of INSTANCE_KEYS) {
      for (const id of INSTANCES[k].hiddenNav) {
        expect(shell, `menu "${id}" milik instance ${k}`).toContain(`id: "${id}"`);
      }
    }
  });
});

describe("identitas perusahaan per instance", () => {
  it("ID tenant berbeda, berbentuk UUID v4, dan tidak memakai ulang ID tenant lama", () => {
    expect(COMPANY_RICA_RICO.id).toMatch(UUID_V4);
    expect(COMPANY_LENCIR.id).toMatch(UUID_V4);
    expect(COMPANY_LENCIR.id).not.toBe(COMPANY_RICA_RICO.id);
    // Tenant Lencir era Agustus–Oktober 2026 (3333…) dan tenant demo lama sengaja tidak dipakai ulang.
    const retired = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
    expect(retired).not.toContain(COMPANY_LENCIR.id);
    expect(retired).not.toContain(COMPANY_RICA_RICO.id);
  });

  it("perusahaan aktif mengikuti instance, dan daftar perusahaan hanya berisi itu", () => {
    const expected = INSTANCE.key === "lencir" ? COMPANY_LENCIR : COMPANY_RICA_RICO;
    expect(ACTIVE_COMPANY).toBe(expected);
    expect(ALL_COMPANIES).toEqual([expected]);
    expect(resolveCompanyProfile()).toBe(expected);
  });

  it("badan hukum Lencir: PT Loe Cantik Kita Cuan, dengan alamat terdaftar dari registri AHU", () => {
    expect(COMPANY_LENCIR.name).toBe("PT Loe Cantik Kita Cuan");
    expect(COMPANY_LENCIR.address).toMatch(/Penerangan/);
    expect(COMPANY_LENCIR.industry).toBe("wellness");
  });
});

describe("palet merek", () => {
  const css = read("src/app/globals.css");
  const names = (block: string) => new Set([...block.matchAll(/--color-(?:slate|blue|indigo|amber|red)-\d+(?=\s*:)/g)].map((m) => m[0]));

  it("palet Lencir menimpa SEMUA variabel skala yang dipetakan palet Rica Rico — tidak ada separuh-tema", () => {
    const rica = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? "";
    const lencir = css.match(/html\[data-instance="lencir"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(names(rica).size).toBeGreaterThan(40);
    const missing = [...names(rica)].filter((n) => !names(lencir).has(n));
    expect(missing).toEqual([]);
  });

  it("mode gelap Lencir punya latar sendiri (bukan cokelat kakao Rica Rico)", () => {
    expect(css).toMatch(/html\[data-instance="lencir"\]\s+\.dark\s*\{[^}]*--background:\s*#121010/);
  });

  it("layout menulis data-instance pada <html>", () => {
    expect(read("src/app/layout.tsx")).toContain("data-instance={INSTANCE.key}");
  });
});
