import { describe, it, expect } from "vitest";
import { buildAssessmentReport, type BuildReportInput } from "./report";
import { BATTERY_FULL, BATTERY_SCREENING, batteryItemCount } from "./batteries";
import { NORM_DEMO_UMUM } from "./norms";
import { PROFILE_SUPERVISOR } from "./job-profiles";
import { PERSONALITY_SECTION_ITEMS, ATTENTION_CHECK_KEY } from "./items-personality";
import { COGNITIVE_ITEMS } from "./items-cognitive";
import { SJT_ITEMS } from "./items-sjt";
import type { ResponseMap, SectionTiming } from "./types";

const presented = (b: typeof BATTERY_FULL) => b.sections.flatMap((s) => s.itemIds);

const KEYED_TARGET: Record<string, number> = { O: 4, C: 5, E: 4, A: 4, N: 2 };

/** Kandidat yang mengerjakan dengan wajar dan berskor baik. */
function strongResponses(): ResponseMap {
  const r: ResponseMap = {};
  for (const it of PERSONALITY_SECTION_ITEMS) {
    if (it.qc === "attention") { r[it.id] = ATTENTION_CHECK_KEY[it.id]; continue; }
    if (it.qc === "desirability") { r[it.id] = 2; continue; }
    const t = KEYED_TARGET[it.scale];
    r[it.id] = it.keying === 1 ? t : 6 - t;
  }
  for (const it of COGNITIVE_ITEMS) r[it.id] = it.answerIndex;
  for (const it of SJT_ITEMS) {
    r[it.id] = it.options.reduce((bi, o, i, arr) => (o.effectiveness > arr[bi].effectiveness ? i : bi), 0);
  }
  return r;
}

const timings: SectionTiming[] = [
  { sectionId: "sec-personality", startedAt: "2026-08-01T09:00:00Z", submittedAt: "2026-08-01T09:12:00Z", elapsedSec: 720 },
  { sectionId: "sec-cog-num", startedAt: "2026-08-01T08:30:00Z", submittedAt: "2026-08-01T08:40:00Z", elapsedSec: 600 },
];

const baseInput = (over: Partial<BuildReportInput> = {}): BuildReportInput => ({
  sessionId: "AS-TEST-0001",
  candidateName: "Kandidat Uji",
  position: "Supervisor Produksi",
  batteryId: BATTERY_FULL.id,
  completedAt: "2026-08-01T09:12:00.000Z",
  responses: strongResponses(),
  presentedItemIds: presented(BATTERY_FULL),
  timings,
  normGroup: NORM_DEMO_UMUM,
  profile: PROFILE_SUPERVISOR,
  ...over,
});

describe("buildAssessmentReport", () => {
  it("menghasilkan laporan lengkap untuk baterai penuh", () => {
    const rep = buildAssessmentReport(baseInput());

    expect(rep.sessionId).toBe("AS-TEST-0001");
    expect(rep.batteryName).toBe(BATTERY_FULL.name);
    expect(rep.scores.length).toBeGreaterThan(10);
    expect(rep.interpretations.length).toBeGreaterThan(0);
    expect(rep.fit).not.toBeNull();
    expect(rep.limitations.length).toBeGreaterThan(3);
  });

  it("kandidat yang menjawab seluruh soal kognitif dengan benar berada di sten tertinggi", () => {
    const rep = buildAssessmentReport(baseInput());
    const cog = rep.scores.find((s) => s.scaleId === "COG_TOTAL")!;
    expect(cog.raw).toBe(30);
    expect(cog.sten).toBe(10);
    expect(cog.percentile).toBe(99);
  });

  it("selalu mencantumkan batasan bahwa norma demo bersifat sintetis", () => {
    // Ini pagar utama modul: selama norma masih sintetis, laporan tidak boleh
    // terbaca seolah persentilnya berasal dari sampel nyata.
    const rep = buildAssessmentReport(baseInput());
    expect(rep.normProvenance).toBe("synthetic_demo");
    expect(rep.limitations.some((l) => /SINTETIS/i.test(l))).toBe(true);
  });

  it("selalu mencantumkan batasan bahwa tes bukan satu-satunya dasar keputusan", () => {
    const rep = buildAssessmentReport(baseInput());
    expect(rep.limitations.some((l) => /satu sumber bukti/i.test(l))).toBe(true);
  });

  it("menempatkan peringatan kualitas jawaban di kalimat pertama ringkasan", () => {
    // Semua item dijawab '3' -> long-string ekstrem.
    const flat: ResponseMap = {};
    for (const id of presented(BATTERY_FULL)) flat[id] = 3;

    const rep = buildAssessmentReport(baseInput({ responses: flat }));
    expect(rep.validity.overall).toBe("meragukan");
    expect(rep.executiveSummary.startsWith("PERINGATAN")).toBe(true);
    expect(rep.recommendedActions[0]).toMatch(/tes ulang/i);
  });

  it("tidak menghitung kesesuaian jabatan ketika profil tidak dipilih", () => {
    const rep = buildAssessmentReport(baseInput({ profile: null }));
    expect(rep.fit).toBeNull();
    expect(rep.executiveSummary).not.toMatch(/Kesesuaian terhadap profil/);
  });

  it("baterai penyaringan hanya menghasilkan skor kognitif", () => {
    const r: ResponseMap = {};
    for (const it of COGNITIVE_ITEMS) r[it.id] = it.answerIndex;

    const rep = buildAssessmentReport(
      baseInput({
        batteryId: BATTERY_SCREENING.id,
        presentedItemIds: presented(BATTERY_SCREENING),
        responses: r,
      }),
    );
    const ids = rep.scores.map((s) => s.scaleId);
    expect(ids).toContain("COG_TOTAL");
    expect(ids).not.toContain("C");
    expect(ids).not.toContain("SJT_TOTAL");
    // Fit tetap dihitung, tetapi hanya dari skala yang benar-benar diukur.
    expect(rep.fit!.details.every((d) => d.scaleId.startsWith("COG_"))).toBe(true);
  });

  it("mencantumkan tindakan klarifikasi wajib untuk setiap skala di bawah ambang kritis", () => {
    const r = strongResponses();
    // Menjatuhkan Kehati-hatian ke titik terendah (ambang kritis supervisor = 4).
    for (const it of PERSONALITY_SECTION_ITEMS) {
      if (it.scale !== "C" || it.qc) continue;
      r[it.id] = it.keying === 1 ? 1 : 5;
    }
    const rep = buildAssessmentReport(baseInput({ responses: r }));
    expect(rep.fit!.criticalFlags.length).toBeGreaterThan(0);
    expect(rep.fit!.verdict).toBe("belum_sesuai");
    expect(rep.recommendedActions.some((a) => /Klarifikasi wajib/i.test(a))).toBe(true);
  });

  it("ringkasan menyebut skor kognitif dan hasil kesesuaian jabatan", () => {
    const rep = buildAssessmentReport(baseInput());
    expect(rep.executiveSummary).toMatch(/Kemampuan kognitif umum berada pada sten/);
    expect(rep.executiveSummary).toMatch(/Kesesuaian terhadap profil/);
  });
});

describe("definisi baterai", () => {
  it("setiap baterai punya item unik tanpa duplikasi antar-section", () => {
    for (const b of [BATTERY_FULL, BATTERY_SCREENING]) {
      const ids = presented(b);
      expect(new Set(ids).size).toBe(ids.length);
      expect(batteryItemCount(b)).toBe(ids.length);
    }
  });

  it("hanya section kognitif dan SJT yang berbatas waktu; inventori kepribadian tidak", () => {
    const personality = BATTERY_FULL.sections.find((s) => s.kind === "personality")!;
    expect(personality.timeLimitSec).toBeNull();
    for (const s of BATTERY_FULL.sections.filter((x) => x.kind === "cognitive")) {
      expect(s.timeLimitSec).toBeGreaterThan(0);
    }
  });
});
