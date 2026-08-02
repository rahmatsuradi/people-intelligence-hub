/* ═══════════════════════════════════════════════════════════════════════════
   Training & Courses (LMS-lite) Store — per-tenant training catalog,
   employee enrollment/certification progress, and division training budget.
   All HR-entered; nothing here is auto-generated or inferred.
═══════════════════════════════════════════════════════════════════════════ */

export type CourseProvider = "internal" | "eksternal";

export interface Course {
  id: string;
  title: string;
  provider: CourseProvider;
  category: string;
  durationHours: number;
  cost: number;
  isCertification: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus = "terdaftar" | "berlangsung" | "selesai" | "tidak-lulus";

export interface Enrollment {
  id: string;
  courseId: string;
  employeeId: string;
  employeeName: string;
  status: EnrollmentStatus;
  startDate: string; // yyyy-mm-dd
  completionDate: string; // yyyy-mm-dd, kosong jika belum selesai
  certificateExpiryDate: string; // yyyy-mm-dd, kosong jika sertifikat tidak ada masa berlaku
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentBudget {
  id: string;
  department: string;
  year: number;
  allocated: number;
  createdAt: string;
  updatedAt: string;
}

const COURSE_PREFIX = "hi_training_courses_";
const ENROLLMENT_PREFIX = "hi_training_enrollments_";
const BUDGET_PREFIX = "hi_training_budgets_";

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getCourses(tenantId: string): Course[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(COURSE_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCourses(tenantId: string, courses: Course[]): void {
  localStorage.setItem(COURSE_PREFIX + tenantId, JSON.stringify(courses));
}

export function upsertCourse(tenantId: string, input: Omit<Course, "id" | "createdAt" | "updatedAt"> & { id?: string }): Course {
  const all = getCourses(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      const updated: Course = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveCourses(tenantId, all);
      return updated;
    }
  }
  const created: Course = { ...input, id: genId("course"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveCourses(tenantId, all);
  return created;
}

export function deleteCourse(tenantId: string, id: string): void {
  saveCourses(tenantId, getCourses(tenantId).filter((c) => c.id !== id));
  saveEnrollments(tenantId, getEnrollments(tenantId).filter((e) => e.courseId !== id));
}

export function getEnrollments(tenantId: string): Enrollment[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(ENROLLMENT_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveEnrollments(tenantId: string, enrollments: Enrollment[]): void {
  localStorage.setItem(ENROLLMENT_PREFIX + tenantId, JSON.stringify(enrollments));
}

export function upsertEnrollment(tenantId: string, input: Omit<Enrollment, "id" | "createdAt" | "updatedAt"> & { id?: string }): Enrollment {
  const all = getEnrollments(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((e) => e.id === input.id);
    if (idx >= 0) {
      const updated: Enrollment = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveEnrollments(tenantId, all);
      return updated;
    }
  }
  const created: Enrollment = { ...input, id: genId("enroll"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveEnrollments(tenantId, all);
  return created;
}

export function deleteEnrollment(tenantId: string, id: string): void {
  saveEnrollments(tenantId, getEnrollments(tenantId).filter((e) => e.id !== id));
}

export function getDepartmentBudgets(tenantId: string): DepartmentBudget[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(BUDGET_PREFIX + tenantId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveDepartmentBudgets(tenantId: string, budgets: DepartmentBudget[]): void {
  localStorage.setItem(BUDGET_PREFIX + tenantId, JSON.stringify(budgets));
}

export function upsertDepartmentBudget(tenantId: string, input: Omit<DepartmentBudget, "id" | "createdAt" | "updatedAt"> & { id?: string }): DepartmentBudget {
  const all = getDepartmentBudgets(tenantId);
  const now = new Date().toISOString();
  if (input.id) {
    const idx = all.findIndex((b) => b.id === input.id);
    if (idx >= 0) {
      const updated: DepartmentBudget = { ...all[idx], ...input, id: input.id, updatedAt: now };
      all[idx] = updated;
      saveDepartmentBudgets(tenantId, all);
      return updated;
    }
  }
  const created: DepartmentBudget = { ...input, id: genId("budget"), createdAt: now, updatedAt: now };
  all.unshift(created);
  saveDepartmentBudgets(tenantId, all);
  return created;
}

export function deleteDepartmentBudget(tenantId: string, id: string): void {
  saveDepartmentBudgets(tenantId, getDepartmentBudgets(tenantId).filter((b) => b.id !== id));
}

/** Sertifikat dianggap "menuju kadaluarsa" jika <= 60 hari lagi, "kadaluarsa" jika sudah lewat. */
export function certificateStatus(expiryDate: string): "aktif" | "menuju-kadaluarsa" | "kadaluarsa" | null {
  if (!expiryDate) return null;
  const days = Math.round((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "kadaluarsa";
  if (days <= 60) return "menuju-kadaluarsa";
  return "aktif";
}
