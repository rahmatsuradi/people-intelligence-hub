import { describe, expect, it } from "vitest";
import { detectCluster } from "./cv-analyzer-ai";

describe("detectCluster — operational/broadcast & editorial routing", () => {
  it.each([
    // Broadcast — kamera/studio/MCR/teknis
    ["Cameraman", "Penyiaran", "broadcast"],
    ["Video Editor", "Broadcast", "broadcast"],
    ["Floor Director", "Studio", "broadcast"],
    ["Studio Technician", "Teknis", "broadcast"],
    ["Audio Engineer", "Multimedia", "broadcast"],
    // Broadcast via department saja (posisi generik)
    ["Staff", "Penyiaran", "broadcast"],
    ["Staff", "MCR", "broadcast"],
    // Editorial — redaksi/berita/reporter
    ["Reporter", "Redaksi", "editorial"],
    ["News Producer", "News", "editorial"],
    ["Scriptwriter", "Berita", "editorial"],
    ["News Editor", "Jurnalistik", "editorial"],
    // Security — satpam (BUKAN tech/cybersecurity)
    ["Satpam", "Security", "security"],
    ["Security Guard", "Security", "security"],
    ["Petugas Keamanan", "Keamanan", "security"],
    ["Penjaga Malam", "Security", "security"],
  ] as const)("routes '%s' (%s) → %s", (pos, dept, expected) => {
    expect(detectCluster(pos, dept)).toBe(expected);
  });
});

describe("detectCluster — white-collar routing preserved", () => {
  it.each([
    ["Software Engineer", "Engineering", "tech"],
    ["HR Manager", "HR", "hr"],
    ["CFO", "Finance", "finance"],
    ["Product Manager", "Product", "tech"],
    ["Data Analyst", "Data", "tech"],
    ["UX Designer", "Design", "business"],
    ["Sales Manager", "Sales", "business"],
    ["Cybersecurity Analyst", "Engineering", "tech"],
    // Default: posisi umum tanpa keyword → business
    ["General Manager", "Management", "business"],
  ] as const)("preserves '%s' (%s) → %s", (pos, dept, expected) => {
    expect(detectCluster(pos, dept)).toBe(expected);
  });
});

describe("detectCluster — 'security' disambiguation", () => {
  it("routes 'security' department to security cluster (satpam)", () => {
    expect(detectCluster("Staff", "Security")).toBe("security");
  });

  it("still routes cybersecurity positions to tech via TECH_POS keywords", () => {
    expect(detectCluster("Cybersecurity Analyst", "Security")).toBe("tech");
    expect(detectCluster("Infosec Engineer", "Security")).toBe("tech");
  });
});
