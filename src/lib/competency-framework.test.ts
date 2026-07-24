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
  buildFrameworkPrompt,
  type CompetencyCluster,
} from "./competency-framework";

const CLUSTERS = Object.keys(CLUSTER_FRAMEWORKS) as CompetencyCluster[];

describe("competency definitions", () => {
  it("covers all four clusters with no competency left undefined", () => {
    const fromClusters = CLUSTERS.flatMap((c) => CLUSTER_FRAMEWORKS[c].competencies);
    expect(fromClusters).toHaveLength(ALL_COMPETENCY_DEFINITIONS.length);
    expect(ALL_COMPETENCY_DEFINITIONS.length).toBe(36);
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
