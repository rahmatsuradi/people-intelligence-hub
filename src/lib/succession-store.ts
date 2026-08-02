/* ═══════════════════════════════════════════════════════════════════════════
   Succession Planning Store — per-tenant 9-box (performance × potential)
   ratings, key-position registry, and successor candidates. All HR-entered;
   nothing here is auto-generated or inferred from other modules.
═══════════════════════════════════════════════════════════════════════════ */

/** 1 = rendah, 2 = sedang, 3 = tinggi — standard 9-box grid scale. */
export interface NineBoxRating {
  employeeId: string;
  employeeName: string;
  performance: 1 | 2 | 3;
  potential: 1 | 2 | 3;
  ratedBy: string;
  ratedAt: string;
  notes: string;
}

export type SuccessionReadiness = "ready-now" | "ready-1-2y" | "ready-3-5y" | "development";

export interface KeyPosition {
  id: string;
  title: string;
  department: string;
  incumbentEmployeeId: string;
  incumbentName: string;
  criticality: "tinggi" | "sedang" | "rendah";
  vacancyRisk: "tinggi" | "sedang" | "rendah";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Successor {
  id: string;
  positionId: string;
  employeeId: string;
  employeeName: string;
  readiness: SuccessionReadiness;
  developmentNotes: string;
  createdAt: string;
  updatedAt: string;
}

const NINEBOX_PREFIX = "hi_ninebox_";
const POSITION_PREFIX = "hi_succession_positions_";
const SUCCESSOR_PREFIX = "hi_succession_candidates_";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getNineBoxRatings(tenantId: string): Record<string, NineBoxRating> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(NINEBOX_PREFIX + tenantId);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function setNineBoxRating(
  tenantId: string,
  employeeId: string,
  employeeName: string,
  performance: 1 | 2 | 3,
  potential: 1 | 2 | 3,
  ratedBy: string,
  notes = "",
): void {
  if (typeof window === "undefined") return;
  const all = getNineBoxRatings(tenantId);
  all[employeeId] = {
    employeeId,
    employeeName,
    performance,
    potential,
    ratedBy: ratedBy.trim() || "HR",
    ratedAt: new Date().toISOString(),
    notes: notes.trim(),
  };
  localStorage.setItem(NINEBOX_PREFIX + tenantId, JSON.stringify(all));
}

/** Label standar 9-box grid (Korn Ferry / umum dipakai industri). */
export function nineBoxLabel(performance: 1 | 2 | 3, potential: 1 | 2 | 3): string {
  const key = `${potential}-${performance}`;
  const labels: Record<string, string> = {
    "3-3": "Star (Bintang)",
    "3-2": "Bintang Masa Depan",
    "3-1": "Enigma",
    "2-3": "Kinerja Tinggi",
    "2-2": "Andalan Inti",
    "2-1": "Tidak Konsisten",
    "1-3": "Pekerja Solid",
    "1-2": "Cukup Efektif",
    "1-1": "Berisiko",
  };
  return labels[key] ?? "—";
}

export function getKeyPositions(tenantId: string): KeyPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(POSITION_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveKeyPositions(tenantId: string, positions: KeyPosition[]): void {
  localStorage.setItem(POSITION_PREFIX + tenantId, JSON.stringify(positions));
}

export function upsertKeyPosition(tenantId: string, input: Omit<KeyPosition, "id" | "createdAt" | "updatedAt"> & { id?: string }): KeyPosition {
  const all = getKeyPositions(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      const updated: KeyPosition = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveKeyPositions(tenantId, all);
      return updated;
    }
  }
  const created: KeyPosition = { ...input, id: genId("pos"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveKeyPositions(tenantId, all);
  return created;
}

export function deleteKeyPosition(tenantId: string, id: string): void {
  saveKeyPositions(tenantId, getKeyPositions(tenantId).filter((p) => p.id !== id));
  saveSuccessors(tenantId, getSuccessors(tenantId).filter((s) => s.positionId !== id));
}

export function getSuccessors(tenantId: string): Successor[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(SUCCESSOR_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSuccessors(tenantId: string, successors: Successor[]): void {
  localStorage.setItem(SUCCESSOR_PREFIX + tenantId, JSON.stringify(successors));
}

export function upsertSuccessor(tenantId: string, input: Omit<Successor, "id" | "createdAt" | "updatedAt"> & { id?: string }): Successor {
  const all = getSuccessors(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((s) => s.id === input.id);
    if (idx >= 0) {
      const updated: Successor = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveSuccessors(tenantId, all);
      return updated;
    }
  }
  const created: Successor = { ...input, id: genId("succ"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveSuccessors(tenantId, all);
  return created;
}

export function deleteSuccessor(tenantId: string, id: string): void {
  saveSuccessors(tenantId, getSuccessors(tenantId).filter((s) => s.id !== id));
}
