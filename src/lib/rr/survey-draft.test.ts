import { describe, expect, it } from "vitest";
import { clearDraft, DRAFT_MAX_AGE_MS, draftKey, loadDraft, saveDraft } from "./survey-draft";
import { maxChoicesOf, validateSubmission, type SurveyQuestion } from "./pulse";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const draft = { step: 3, name: "Ani", contact: "", answers: { happiness: "Bahagia", tags: ["a", "b"] } };

describe("draf formulir", () => {
  it("tersimpan dan pulih utuh setelah halaman dimuat ulang", () => {
    const s = memory();
    saveDraft(s, "k", draft, 1000);
    expect(loadDraft(s, "k", 2000)).toEqual(draft);
  });
  it("link grup dan link pribadi punya draf sendiri", () => {
    expect(draftKey("tok")).not.toBe(draftKey("tok", "inv"));
  });
  it("kedaluwarsa dan terhapus setelah 3 hari", () => {
    const s = memory();
    saveDraft(s, "k", draft, 0);
    expect(loadDraft(s, "k", DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(s.getItem("k")).toBeNull();
  });
  it("hilang setelah terkirim", () => {
    const s = memory();
    saveDraft(s, "k", draft);
    clearDraft(s, "k");
    expect(loadDraft(s, "k")).toBeNull();
  });
  it("isi rusak atau penyimpanan ditolak browser tidak merusak formulir", () => {
    const s = memory();
    s.setItem("k", "{bukan json");
    expect(loadDraft(s, "k")).toBeNull();
    const ditolak = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(() => saveDraft(ditolak, "k", draft)).not.toThrow();
    expect(loadDraft(ditolak, "k")).toBeNull();
    expect(() => clearDraft(ditolak, "k")).not.toThrow();
  });
});

describe("batas pilihan", () => {
  const q: SurveyQuestion = { key: "aktivitas", label: "Aktivitas favorit? (pilih maksimal 3)", type: "multi", options: ["a", "b", "c", "d"].map((value) => ({ value })) };
  it("dibaca dari tulisan pertanyaan", () => {
    expect(maxChoicesOf(q)).toBe(3);
    expect(maxChoicesOf({ ...q, label: "Alasan senang?" })).toBeNull();
    expect(maxChoicesOf({ ...q, type: "choice" })).toBeNull();
  });
  it("kiriman yang melewati batas ditolak, yang pas diterima", () => {
    expect(validateSubmission({ questions: [q] }, { aktivitas: ["a", "b", "c", "d"] }).errors).toEqual(["Aktivitas favorit? (pilih maksimal 3): pilih maksimal 3"]);
    expect(validateSubmission({ questions: [q] }, { aktivitas: ["a", "b", "c"] })).toEqual({ answers: { aktivitas: ["a", "b", "c"] }, errors: [] });
  });
});
