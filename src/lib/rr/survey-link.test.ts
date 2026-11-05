import { describe, expect, it } from "vitest";
import { prettySlug, slugify, surveyLinkName, surveyLinkPath, surveyLinkSlug } from "./survey-link";

const s = (key: string, title: string, config: object = {}) => ({ key, title, config });

describe("nama link survei", () => {
  it("memakai nama form + perusahaan + bulan", () => {
    expect(surveyLinkSlug(s("pulse_bulanan", "Pulse Check Bulanan"), "Lencir", "Oktober 2026")).toBe("monthly-pulse-check-lencir-oktober-2026");
    expect(surveyLinkSlug(s("pulse_bulanan", "Pulse Check Bulanan"), "Rica Rico", "Oktober 2026")).toBe("monthly-pulse-check-rica-rico-oktober-2026");
    expect(surveyLinkSlug(s("feedback_spg_bulanan", "x"), "Rica Rico", "September 2026")).toBe("feedback-spg-to-spv-rica-rico-september-2026");
    expect(surveyLinkSlug(s("feedback_360", "x"), "Rica Rico", "Oktober 2026")).toBe("feedback-360-spv-rica-rico-oktober-2026");
  });
  it("survei lain: config.linkName, lalu judul survei", () => {
    expect(surveyLinkName(s("feedback_spg", "Feedback SPG Maret", { linkName: "Survei SPG Maret" }))).toBe("Survei SPG Maret");
    expect(surveyLinkSlug(s("feedback_spg", "Feedback SPG & Kondisi Kerja"), "Rica Rico", "Maret 2026")).toBe("feedback-spg-dan-kondisi-kerja-rica-rico-maret-2026");
  });
  it("slugify bersih dari karakter aneh dan tidak kosong", () => {
    expect(slugify("  Évaluasi — Tim!! ")).toBe("evaluasi-tim");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(surveyLinkSlug(s("x", "???"), "", "")).toBe("survei");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it("path memuat token di belakang slug", () => {
    expect(surveyLinkPath(s("pulse_bulanan", "t"), "Lencir", "Oktober 2026", "abc123")).toBe("/survei/monthly-pulse-check-lencir-oktober-2026/abc123");
  });
  it("prettySlug hanya menerima slug wajar", () => {
    expect(prettySlug("monthly-pulse-check-lencir-oktober-2026")).toBe("Monthly Pulse Check Lencir Oktober 2026");
    expect(prettySlug("feedback-spg-to-spv-rica-rico-september-2026")).toBe("Feedback SPG To SPV Rica Rico September 2026");
    expect(prettySlug("<script>alert(1)</script>")).toBeNull();
    expect(prettySlug("a".repeat(120))).toBeNull();
  });
});
