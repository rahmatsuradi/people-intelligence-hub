/* ═══════════════════════════════════════════════════════════════════════════
   Competency Matrix Store — per-tenant employee competency ratings.
   Follows the same tenantId-prefixed localStorage pattern as mpp-store.ts.

   These are HR-entered assessments (manager/HR rating an employee against a
   competency rubric from competency-framework.ts) — never auto-generated or
   inferred. There is no real assessment data for existing employees anywhere
   in this app (CV/interview scores only exist for hiring-pipeline candidates),
   so this store starts empty for every employee until someone rates them.
═══════════════════════════════════════════════════════════════════════════ */

export interface EmployeeCompetencyRating {
  score: number; // 1-5, matches RubricLevel.score in competency-framework.ts
  ratedBy: string;
  ratedAt: string;
  notes: string;
}

/** Keyed by `${employeeId}::${competencyId}`. */
export type CompetencyRatingMap = Record<string, EmployeeCompetencyRating>;

const STORE_PREFIX = "hi_competency_ratings_";

export function ratingKey(employeeId: string, competencyId: string): string {
  return `${employeeId}::${competencyId}`;
}

export function getCompetencyRatings(tenantId: string): CompetencyRatingMap {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(STORE_PREFIX + tenantId);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function setCompetencyRating(
  tenantId: string,
  employeeId: string,
  competencyId: string,
  score: number,
  ratedBy: string,
  notes = "",
): void {
  if (typeof window === "undefined") return;
  const all = getCompetencyRatings(tenantId);
  all[ratingKey(employeeId, competencyId)] = {
    score,
    ratedBy: ratedBy.trim() || "HR",
    ratedAt: new Date().toISOString(),
    notes: notes.trim(),
  };
  localStorage.setItem(STORE_PREFIX + tenantId, JSON.stringify(all));
}

export function clearCompetencyRating(tenantId: string, employeeId: string, competencyId: string): void {
  if (typeof window === "undefined") return;
  const all = getCompetencyRatings(tenantId);
  delete all[ratingKey(employeeId, competencyId)];
  localStorage.setItem(STORE_PREFIX + tenantId, JSON.stringify(all));
}
