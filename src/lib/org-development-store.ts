/* ═══════════════════════════════════════════════════════════════════════════
   Organization Development Store — per-tenant reporting lines (for org chart
   + span of control) and job grading bands (for job evaluation + salary band
   benchmarking). All HR-entered; nothing here is auto-generated or inferred.
═══════════════════════════════════════════════════════════════════════════ */

/** reportsToEmployeeId = "" means top of the org (no manager assigned). */
export type OrgRelationMap = Record<string, { reportsToEmployeeId: string; updatedAt: string }>;

export interface JobGrade {
  id: string;
  name: string;
  level: number;
  salaryMin: number;
  salaryMax: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** Keyed by position title (trimmed) -> gradeId. */
export type PositionGradeMap = Record<string, string>;

const RELATIONS_PREFIX = "hi_od_relations_";
const GRADES_PREFIX = "hi_od_grades_";
const POSITION_GRADE_PREFIX = "hi_od_position_grade_";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getOrgRelations(tenantId: string): OrgRelationMap {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(RELATIONS_PREFIX + tenantId);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function setReportsTo(tenantId: string, employeeId: string, reportsToEmployeeId: string): void {
  if (typeof window === "undefined") return;
  const all = getOrgRelations(tenantId);
  if (!reportsToEmployeeId) {
    delete all[employeeId];
  } else {
    all[employeeId] = { reportsToEmployeeId, updatedAt: new Date().toISOString() };
  }
  localStorage.setItem(RELATIONS_PREFIX + tenantId, JSON.stringify(all));
}

export function getJobGrades(tenantId: string): JobGrade[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(GRADES_PREFIX + tenantId);
    const grades: JobGrade[] = data ? JSON.parse(data) : [];
    return grades.sort((a, b) => a.level - b.level);
  } catch {
    return [];
  }
}

function saveJobGrades(tenantId: string, grades: JobGrade[]): void {
  localStorage.setItem(GRADES_PREFIX + tenantId, JSON.stringify(grades));
}

export function upsertJobGrade(tenantId: string, input: Omit<JobGrade, "id" | "createdAt" | "updatedAt"> & { id?: string }): JobGrade {
  const all = getJobGrades(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((g) => g.id === input.id);
    if (idx >= 0) {
      const updated: JobGrade = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveJobGrades(tenantId, all);
      return updated;
    }
  }
  const created: JobGrade = { ...input, id: genId("grade"), createdAt: now, updatedAt: now };
  all.push(created);
  saveJobGrades(tenantId, all);
  return created;
}

export function deleteJobGrade(tenantId: string, id: string): void {
  saveJobGrades(tenantId, getJobGrades(tenantId).filter((g) => g.id !== id));
  const map = getPositionGradeMap(tenantId);
  for (const pos of Object.keys(map)) {
    if (map[pos] === id) delete map[pos];
  }
  savePositionGradeMap(tenantId, map);
}

export function getPositionGradeMap(tenantId: string): PositionGradeMap {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(POSITION_GRADE_PREFIX + tenantId);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function savePositionGradeMap(tenantId: string, map: PositionGradeMap): void {
  localStorage.setItem(POSITION_GRADE_PREFIX + tenantId, JSON.stringify(map));
}

export function setPositionGrade(tenantId: string, position: string, gradeId: string): void {
  if (typeof window === "undefined") return;
  const map = getPositionGradeMap(tenantId);
  if (!gradeId) {
    delete map[position];
  } else {
    map[position] = gradeId;
  }
  savePositionGradeMap(tenantId, map);
}
