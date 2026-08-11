import { describe, it, expect } from "vitest";
import {
  computeFit,
  DEFAULT_JOB_PROFILES,
  PROFILE_OPERATOR_PRODUKSI,
  PROFILE_SALES_AE,
  PROFILE_SUPERVISOR,
  scaleMatchPct,
  suggestProfileForPosition,
} from "./job-profiles";
import type { NormedScaleScore, ProfileRequirement, ScaleId } from "./types";

const score = (scaleId: string, sten: number): NormedScaleScore => ({
  scaleId: scaleId as ScaleId,
  raw: 0,
  answered: 10,
  itemCount: 10,
  maxPossible: 50,
  z: 0,
  percentile: 50,
  sten,
  tScore: 50,
  stanine: 5,
  band: "rata_rata",
  normId: "N",
  normLabel: "N",
});

const requirement = (over: Partial<ProfileRequirement> = {}): ProfileRequirement => ({
  scaleId: "C",
  targetStenMin: 6,
  targetStenMax: 10,
  weight: 1,
  direction: "higher",
  criticalMinSten: null,
  rationale: "uji",
  ...over,
});

describe("scaleMatchPct", () => {
  it("bernilai 100 di dalam rentang target", () => {
    expect(scaleMatchPct(6, requirement())).toBe(100);
    expect(scaleMatchPct(8, requirement())).toBe(100);
    expect(scaleMatchPct(10, requirement())).toBe(100);
  });

  it("mengurangi 20 poin per sten di bawah target", () => {
    expect(scaleMatchPct(5, requirement())).toBe(80);
    expect(scaleMatchPct(3, requirement())).toBe(40);
    expect(scaleMatchPct(1, requirement())).toBe(0);
  });

  it("tidak menghukum skor di atas target pada skala berarah 'higher'", () => {
    // Lebih teliti dari yang dibutuhkan bukan kekurangan.
    const r = requirement({ targetStenMax: 8 });
    expect(scaleMatchPct(10, r)).toBe(100);
  });

  it("menghukum dua arah pada skala berarah 'midrange'", () => {
    // Keramahan sangat tinggi menyulitkan peran penegak aturan — ini disengaja.
    const r = requirement({ scaleId: "A", targetStenMin: 3, targetStenMax: 7, direction: "midrange" });
    expect(scaleMatchPct(9, r)).toBe(60);
    expect(scaleMatchPct(1, r)).toBe(60);
    expect(scaleMatchPct(5, r)).toBe(100);
  });

  it("tidak menghukum skor di bawah target pada skala berarah 'lower'", () => {
    // Reaktivitas emosional: makin rendah makin sesuai.
    const r = requirement({ scaleId: "N", targetStenMin: 1, targetStenMax: 5, direction: "lower" });
    expect(scaleMatchPct(1, r)).toBe(100);
    expect(scaleMatchPct(8, r)).toBe(40);
  });

  it("tidak pernah menghasilkan nilai negatif", () => {
    expect(scaleMatchPct(1, requirement({ targetStenMin: 10, targetStenMax: 10 }))).toBe(0);
  });
});

describe("computeFit", () => {
  it("memberi fit 100 dan verdict direkomendasikan ketika semua skala di rentang target", () => {
    const scores = PROFILE_SUPERVISOR.requirements.map((r) => score(r.scaleId, r.targetStenMin));
    const fit = computeFit(scores, PROFILE_SUPERVISOR);
    expect(fit.fitScore).toBe(100);
    expect(fit.criticalFlags).toHaveLength(0);
    expect(fit.verdict).toBe("direkomendasikan");
  });

  it("menurunkan verdict menjadi belum_sesuai ketika ada skala di bawah ambang kritis", () => {
    // Meski skala lain sempurna, satu ambang kritis yang jebol tetap memblokir.
    const scores = PROFILE_OPERATOR_PRODUKSI.requirements.map((r) =>
      r.scaleId === "SJT_SAFETY" ? score(r.scaleId, 2) : score(r.scaleId, r.targetStenMax),
    );
    const fit = computeFit(scores, PROFILE_OPERATOR_PRODUKSI);
    expect(fit.criticalFlags).toHaveLength(1);
    expect(fit.criticalFlags[0]).toMatch(/Kesadaran Keselamatan/);
    expect(fit.verdict).toBe("belum_sesuai");
  });

  it("memberi bobot lebih besar pada skala yang lebih penting untuk posisi tsb", () => {
    // Di profil Sales, Ekstraversi (bobot 3) lebih menentukan daripada
    // SJT Kolaborasi (bobot 1). Menjatuhkan yang berbobot besar harus lebih terasa.
    const base = PROFILE_SALES_AE.requirements.map((r) => score(r.scaleId, r.targetStenMin));

    const dropHeavy = base.map((s) => (s.scaleId === "E" ? score("E", 3) : s));
    const dropLight = base.map((s) => (s.scaleId === "SJT_COLLAB" ? score("SJT_COLLAB", 3) : s));

    const heavy = computeFit(dropHeavy, PROFILE_SALES_AE).fitScore;
    const light = computeFit(dropLight, PROFILE_SALES_AE).fitScore;
    expect(heavy).toBeLessThan(light);
  });

  it("melewati skala yang tidak diukur oleh baterai, bukan menghitungnya nol", () => {
    // Baterai penyaringan hanya mengukur kognitif — kepribadian tidak boleh
    // ikut menyeret fit ke bawah seolah kandidat berskor nol.
    const cogOnly = [score("COG_TOTAL", 8)];
    const fit = computeFit(cogOnly, PROFILE_SUPERVISOR);
    expect(fit.details).toHaveLength(1);
    expect(fit.details[0].scaleId).toBe("COG_TOTAL");
    expect(fit.fitScore).toBe(100);
  });

  it("mengembalikan verdict belum_sesuai ketika tidak ada satu pun skala profil yang terukur", () => {
    // Tanpa data yang relevan, tidak ada dasar merekomendasikan siapa pun.
    const fit = computeFit([score("O", 9)], PROFILE_OPERATOR_PRODUKSI);
    expect(fit.details).toHaveLength(0);
    expect(fit.fitScore).toBe(0);
    expect(fit.verdict).toBe("belum_sesuai");
  });

  it("mencatat arah kesenjangan pada gapNote", () => {
    const scores = [score("A", 10)]; // profil QC menginginkan A di rentang 3-7
    const qc = DEFAULT_JOB_PROFILES.find((p) => p.id === "JP-QC")!;
    const fit = computeFit(scores, qc);
    expect(fit.details[0].gapNote).toMatch(/di atas rentang target/);
  });
});

describe("suggestProfileForPosition", () => {
  it("mencocokkan judul lowongan yang umum dipakai di lapangan", () => {
    expect(suggestProfileForPosition("Supervisor Produksi")!.id).toBe("JP-SUPERVISOR");
    expect(suggestProfileForPosition("Staff QC Garment")!.id).toBe("JP-QC");
    expect(suggestProfileForPosition("Account Executive")!.id).toBe("JP-SALES");
    expect(suggestProfileForPosition("Reporter Berita")!.id).toBe("JP-JURNALIS");
    expect(suggestProfileForPosition("Operator Jahit")!.id).toBe("JP-OPERATOR");
    expect(suggestProfileForPosition("HR Generalist")!.id).toBe("JP-HR");
  });

  it("mendahulukan penyeliaan ketika judulnya mengandung dua kata kunci", () => {
    // "Supervisor QC" adalah peran penyeliaan lebih dulu, baru QC.
    expect(suggestProfileForPosition("Supervisor QC")!.id).toBe("JP-SUPERVISOR");
  });

  it("mengembalikan null bila judul tidak dikenali — HR memilih manual", () => {
    expect(suggestProfileForPosition("Astronot")).toBeNull();
    expect(suggestProfileForPosition("")).toBeNull();
  });
});

describe("integritas template profil", () => {
  it("setiap profil punya rentang target yang valid dan bobot positif", () => {
    for (const p of DEFAULT_JOB_PROFILES) {
      expect(p.requirements.length).toBeGreaterThan(0);
      for (const r of p.requirements) {
        expect(r.targetStenMin).toBeGreaterThanOrEqual(1);
        expect(r.targetStenMax).toBeLessThanOrEqual(10);
        expect(r.targetStenMin).toBeLessThanOrEqual(r.targetStenMax);
        expect(r.weight).toBeGreaterThan(0);
        expect(r.rationale.length).toBeGreaterThan(10); // setiap syarat harus bisa diaudit
        if (r.criticalMinSten !== null) {
          expect(r.criticalMinSten).toBeLessThanOrEqual(r.targetStenMax);
        }
      }
      expect(p.recommendThreshold).toBeGreaterThan(p.considerThreshold);
    }
  });

  it("ambang kritis tidak pernah melebihi batas atas target (mustahil dipenuhi)", () => {
    for (const p of DEFAULT_JOB_PROFILES) {
      for (const r of p.requirements) {
        if (r.criticalMinSten === null) continue;
        // Kandidat yang tepat di rentang target tidak boleh langsung kena flag kritis.
        expect(r.criticalMinSten).toBeLessThanOrEqual(r.targetStenMin + 1);
      }
    }
  });
});
