import { describe, expect, it } from "vitest";
import { isSurveySlug, prettySlug, slugify, surveyLinkName, surveyLinkPath, surveyLinkSlug } from "./survey-link";

const s = (key: string, title: string, config: object = {}) => ({ key, title, config });

describe("nama link survei", () => {
  it("memakai nama form + perusahaan, berhenti di situ", () => {
    expect(surveyLinkSlug(s("pulse_bulanan", "Pulse Check Bulanan"), "Lencir")).toBe("monthly-pulse-check-lencir");
    expect(surveyLinkSlug(s("pulse_bulanan", "Pulse Check Bulanan"), "Rica Rico")).toBe("monthly-pulse-check-rica-rico");
    expect(surveyLinkSlug(s("feedback_spg_bulanan", "x"), "Rica Rico")).toBe("feedback-spg-to-spv-rica-rico");
    expect(surveyLinkSlug(s("feedback_360", "x"), "Rica Rico")).toBe("feedback-360-spv-rica-rico");
  });
  it("survei lain: config.linkName, lalu judul survei", () => {
    expect(surveyLinkName(s("feedback_spg", "Feedback SPG Maret", { linkName: "Survei SPG Maret" }))).toBe("Survei SPG Maret");
    expect(surveyLinkSlug(s("feedback_spg", "Feedback SPG & Kondisi Kerja"), "Rica Rico")).toBe("feedback-spg-dan-kondisi-kerja-rica-rico");
  });
  it("slugify bersih dari karakter aneh dan tidak kosong", () => {
    expect(slugify("  Évaluasi — Tim!! ")).toBe("evaluasi-tim");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(surveyLinkSlug(s("x", "???"), "")).toBe("survei");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
  it("link pendek tanpa token; token hanya bila diminta", () => {
    expect(surveyLinkPath(s("pulse_bulanan", "t"), "Lencir")).toBe("/survei/monthly-pulse-check-lencir");
    expect(surveyLinkPath(s("pulse_bulanan", "t"), "Lencir", "abc123")).toBe("/survei/monthly-pulse-check-lencir/abc123");
  });
  it("nama form tidak tertukar dengan token", () => {
    expect(isSurveySlug("monthly-pulse-check-lencir")).toBe(true);
    expect(isSurveySlug("abcdefghij0123456789abcdefghij01")).toBe(false);
    expect(isSurveySlug("../etc/passwd")).toBe(false);
  });
  it("prettySlug hanya menerima slug wajar", () => {
    expect(prettySlug("monthly-pulse-check-lencir")).toBe("Monthly Pulse Check Lencir");
    expect(prettySlug("feedback-spg-to-spv-rica-rico-september-2026")).toBe("Feedback SPG To SPV Rica Rico September 2026");
    expect(prettySlug("<script>alert(1)</script>")).toBeNull();
    expect(prettySlug("a".repeat(120))).toBeNull();
  });
});
