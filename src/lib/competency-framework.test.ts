/* Guards the invariants that broke before: competency definitions that existed
   only inside an AI prompt string (so the UI had no rubric to show), and
   question banks referencing competency ids that existed in no framework. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_COMPETENCY_DEFINITIONS,
  CLUSTER_FRAMEWORKS,
  COMPETENCY_BY_ID,
  CV_WEIGHT,
  INTERVIEW_WEIGHT,
  blendScore,
  buildFrameworkPrompt,
  buildReportCompetencyRows,
  type CompetencyCluster,
} from "./competency-framework";

const CLUSTERS = Object.keys(CLUSTER_FRAMEWORKS) as CompetencyCluster[];

describe("competency definitions", () => {
  it("covers all four clusters with no competency left undefined", () => {
    const fromClusters = CLUSTERS.flatMap((c) => CLUSTER_FRAMEWORKS[c].competencies);
    expect(fromClusters).toHaveLength(ALL_COMPETENCY_DEFINITIONS.length);
    expect(ALL_COMPETENCY_DEFINITIONS.length).toBe(54);
  });

  it("has unique ids", () => {
    const ids = ALL_COMPETENCY_DEFINITIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The original defect: SFIA/Lominger/CGMA had labels and badges in the UI but
  // no rubric anywhere, so 25 of 36 competencies rendered an empty rubric table
  // under a heading that claimed "Research-based rubric (1-5)".
  it.each(CLUSTERS)("gives every %s competency a full 1-5 rubric and a benchmark", (cluster) => {
    for (const c of CLUSTER_FRAMEWORKS[cluster].competencies) {
      expect(c.rubric.map((r) => r.score), `${c.id} rubric levels`).toEqual([1, 2, 3, 4, 5]);
      expect(c.rubric.every((r) => r.description.trim().length > 0), `${c.id} descriptions`).toBe(true);
      expect(typeof c.benchmark, `${c.id} benchmark`).toBe("number");
    }
  });

  it("tags each competency with the pillar its cluster expects", () => {
    const expected: Record<CompetencyCluster, string[]> = {
      hr: ["ulrich", "skkni"],
      tech: ["sfia"],
      business: ["lominger"],
      finance: ["cgma"],
      broadcast: ["skkni-broadcast"],
      editorial: ["skkni-editorial"],
      security: ["skkni-security"],
    };
    for (const cluster of CLUSTERS) {
      for (const c of CLUSTER_FRAMEWORKS[cluster].competencies) {
        expect(expected[cluster], `${c.id} pillar`).toContain(c.pillar);
      }
    }
  });
});

describe("buildFrameworkPrompt", () => {
  // The prompt is generated from the definitions so a benchmark shown on screen
  // and one sent to the model cannot drift apart.
  it.each(CLUSTERS)("emits every %s competency with its id and benchmark", (cluster) => {
    const prompt = buildFrameworkPrompt(cluster);
    const fw = CLUSTER_FRAMEWORKS[cluster];
    for (const c of fw.competencies) {
      expect(prompt).toContain(`id:${c.id}`);
      expect(prompt).toContain(`bench:${c.benchmark}`);
    }
    expect(prompt).toContain(`Total: ${fw.competencies.length} kompetensi`);
  });
});

describe("buildReportCompetencyRows (demo reports)", () => {
  // Regression: it used to iterate ALL_COMPETENCY_DEFINITIONS with a
  // `?? {cv:75, interview:74}` fallback, so adding the 25 non-HR definitions
  // grew every demo report by 25 invented rows across 3 extra frameworks.
  it("emits only competencies the demo data actually scores", () => {
    const rows = buildReportCompetencyRows("C-1042");
    expect(rows).toHaveLength(11);
    expect(new Set(rows.map((r) => r.pillar))).toEqual(new Set(["ulrich", "skkni"]));
  });

  it("returns nothing for an id that has no demo data, rather than another candidate's scores", () => {
    expect(buildReportCompetencyRows("C-20260724-K3XZ")).toEqual([]);
  });
});

describe("blendScore", () => {
  it("weights CV and interview by the shared constants", () => {
    expect(CV_WEIGHT + INTERVIEW_WEIGHT).toBe(1);
    expect(blendScore(90, 70)).toBe(Math.round(90 * CV_WEIGHT + 70 * INTERVIEW_WEIGHT));
  });

  it("uses the CV score alone when the competency was never interviewed", () => {
    // Treating "not asked" as 0 would silently penalise the candidate.
    expect(blendScore(88, null)).toBe(88);
  });
});

describe("interview question bank", () => {
  // Guards the defect where tech/business/finance questions used invented ids
  // (tech-collab, biz-execution, fin-risk) that matched no framework, so their
  // rubrics were empty and their pillar badge always read "Ulrich".
  it("references only competency ids that exist in a framework", () => {
    const src = readFileSync(join(process.cwd(), "src/app/interview/page.tsx"), "utf-8");
    const ids = [...src.matchAll(/competencyId: "([^"]+)"/g)].map((m) => m[1]);

    expect(ids.length).toBeGreaterThan(0);
    const unknown = [...new Set(ids)].filter((id) => !COMPETENCY_BY_ID[id]);
    expect(unknown, "question ids missing from COMPETENCY_BY_ID").toEqual([]);
  });

  it("names each question's competency exactly as its framework does", () => {
    const src = readFileSync(join(process.cwd(), "src/app/interview/page.tsx"), "utf-8");
    const pairs = [...src.matchAll(/competencyId: "([^"]+)", competencyName: "([^"]+)"/g)];

    expect(pairs.length).toBeGreaterThan(0);
    for (const [, id, name] of pairs) {
      const def = COMPETENCY_BY_ID[id];
      // HR competencies display their Indonesian label where one exists.
      const canonical = def.pillar === "skkni" && def.nameId ? def.nameId : def.name;
      expect(name, `label for ${id}`).toBe(canonical);
    }
  });
});
