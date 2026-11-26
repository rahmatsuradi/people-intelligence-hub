import { describe, expect, it } from "vitest";
import { canonicalLabel, canonicalSupervisor, type KnownSupervisor } from "./supervisor-name";

// Atasan fiktif (bentuk datanya sama dengan master: nama lengkap + panggilan).
const KNOWN: KnownSupervisor[] = [
  { fullName: "Fikih Alfan Contoh", nickname: "Fikih" },
  { fullName: "Winda Yuniar Contoh", nickname: "Winda" },
  { fullName: "Tedi Yogiyono Contoh", nickname: "Tedi" },
  { fullName: "Rangga Suryawdanta Contoh", nickname: "Rangga" },
  { fullName: "Paulus", nickname: null },
  { fullName: "Irfan", nickname: null },
  { fullName: "Doni", nickname: "DONI" },
  { fullName: "MUHAMAD TRI ROMADHONI", nickname: "DONI" }, // catatan lama dengan nama lengkap berbeda
];

describe("canonicalLabel", () => {
  it("memakai nama panggilan, kalau kosong kata pertama nama lengkap", () => {
    expect(canonicalLabel({ fullName: "Fikih Alfan Contoh", nickname: "Fikih" })).toBe("Fikih");
    expect(canonicalLabel({ fullName: "PAULUS" })).toBe("Paulus");
    expect(canonicalLabel({ fullName: "x", nickname: "DONI" })).toBe("Doni");
  });
});

describe("canonicalSupervisor — ketikan SPG dirapikan ke nama baku", () => {
  it.each([
    ["Pak fikih", "Fikih"], ["FIKIH ALFAN", "Fikih"], ["Fikih Alfan (SPV)", "Fikih"], ["FIKIH", "Fikih"],
    ["Winda yuniar", "Winda"], ["WINDA YUNIAR", "Winda"],
    ["Tedy", "Tedi"], ["Teddy", "Tedi"], ["Pa Tedi", "Tedi"], ["Tedi Yogiyono", "Tedi"], ["Pak Tedy", "Tedi"],
    ["Pak Paul's", "Paulus"], ["paulus", "Paulus"],
    ["Rangga / SPV", "Rangga"], ["SPV RANGGA", "Rangga"], ["Rangga widan", "Rangga"],
    ["Irfan - Jakarta", "Irfan"], ["Pa irfan", "Irfan"], ["Irfan Jakarta", "Irfan"],
    ["Pak doni", "Doni"], ["Muhammad Tri Rhomadhoni", "Doni"],
  ])("%s → %s", (typed, expected) => {
    const r = canonicalSupervisor(typed, KNOWN);
    expect(r.value).toBe(expected);
  });

  it("matched=false bila ketikannya sudah sama dengan nama baku", () => {
    expect(canonicalSupervisor("Fikih", KNOWN)).toEqual({ value: "Fikih", matched: false });
    expect(canonicalSupervisor("Pak fikih", KNOWN)).toEqual({ value: "Fikih", matched: true });
  });

  it("nama yang tidak dikenal TIDAK ditebak — hanya spasinya dirapikan", () => {
    expect(canonicalSupervisor("  Budi   Santoso ", KNOWN)).toEqual({ value: "Budi Santoso", matched: false });
    expect(canonicalSupervisor("Pak Dedi", KNOWN)).toEqual({ value: "Pak Dedi", matched: false });
  });

  it("nama mirip tapi orang lain TIDAK ditarik (Deni ≠ Doni, Dedi ≠ Tedi, Dani, Dewi)", () => {
    for (const t of ["Deni", "Pak Deni", "Deni Ramdani", "Pak Manager Deni", "Deni / Billy", "dani", "dedi", "dewi", "Wina Lain", "Irwan"])
      expect(canonicalSupervisor(t, KNOWN).matched).toBe(false);
  });

  it("ketikan yang cocok ke dua atasan berbeda dibiarkan (ambigu)", () => {
    const dua: KnownSupervisor[] = [{ fullName: "Andi Satu", nickname: "Andi" }, { fullName: "Andika Dua", nickname: "Andika" }];
    expect(canonicalSupervisor("Andi", dua).matched).toBe(false);
    expect(canonicalSupervisor("Andi", dua).value).toBe("Andi");
  });

  it("kosong atau hanya sapaan tidak menghasilkan apa-apa", () => {
    expect(canonicalSupervisor("", KNOWN)).toEqual({ value: "", matched: false });
    expect(canonicalSupervisor("Pak", KNOWN)).toEqual({ value: "Pak", matched: false });
  });

  it("daftar atasan kosong → apa adanya", () => {
    expect(canonicalSupervisor("Pak Fikih", [])).toEqual({ value: "Pak Fikih", matched: false });
  });
});
