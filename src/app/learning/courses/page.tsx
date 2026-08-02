"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import {
  getCourses,
  upsertCourse,
  deleteCourse,
  getEnrollments,
  upsertEnrollment,
  deleteEnrollment,
  getDepartmentBudgets,
  upsertDepartmentBudget,
  deleteDepartmentBudget,
  certificateStatus,
  type Course,
  type CourseProvider,
  type Enrollment,
  type EnrollmentStatus,
  type DepartmentBudget,
} from "@/lib/training-store";

interface EmployeeLite {
  id: string;
  full_name: string;
  department: string | null;
}

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  terdaftar: "Terdaftar",
  berlangsung: "Berlangsung",
  selesai: "Selesai",
  "tidak-lulus": "Tidak Lulus",
};

const STATUS_COLOR: Record<EnrollmentStatus, string> = {
  terdaftar: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  berlangsung: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  selesai: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  "tidak-lulus": "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const CERT_STATUS_LABEL: Record<string, string> = {
  aktif: "Sertifikat Aktif",
  "menuju-kadaluarsa": "Menuju Kadaluarsa",
  kadaluarsa: "Kadaluarsa",
};

const CERT_STATUS_COLOR: Record<string, string> = {
  aktif: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  "menuju-kadaluarsa": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  kadaluarsa: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

const EMPTY_COURSE_FORM = {
  title: "",
  provider: "internal" as CourseProvider,
  category: "",
  durationHours: 8,
  cost: 0,
  isCertification: false,
  description: "",
};

function CourseModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Course | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_COURSE_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { title: initial.title, provider: initial.provider, category: initial.category, durationHours: initial.durationHours, cost: initial.cost, isCertification: initial.isCertification, description: initial.description }
      : EMPTY_COURSE_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Pelatihan" : "Pelatihan Baru"}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="courseTitle">Judul Pelatihan</Label>
            <input id="courseTitle" className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. K3 Dasar untuk Operator Produksi" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="provider">Penyelenggara</Label>
              <select id="provider" className={inputClass} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as CourseProvider })}>
                <option value="internal">Internal</option>
                <option value="eksternal">Eksternal</option>
              </select>
            </div>
            <div>
              <Label htmlFor="category">Kategori</Label>
              <input id="category" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="mis. K3, Teknis, Soft Skill" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="durationHours">Durasi (jam)</Label>
              <input id="durationHours" type="number" min={0} className={inputClass} value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="cost">Biaya per Peserta</Label>
              <input id="cost" type="number" min={0} className={inputClass} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={form.isCertification} onChange={(e) => setForm({ ...form, isCertification: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Menghasilkan sertifikat (memiliki masa berlaku)
          </label>
          <div>
            <Label htmlFor="courseDesc">Deskripsi</Label>
            <textarea id="courseDesc" rows={2} className={cn(inputClass, "resize-none")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.title.trim()) {
                toast("Judul pelatihan wajib diisi", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_ENROLLMENT_FORM = {
  courseId: "",
  employeeId: "",
  status: "terdaftar" as EnrollmentStatus,
  startDate: new Date().toISOString().slice(0, 10),
  completionDate: "",
  certificateExpiryDate: "",
  notes: "",
};

function EnrollmentModal({
  courses,
  employees,
  initial,
  onClose,
  onSave,
}: {
  courses: Course[];
  employees: EmployeeLite[];
  initial: Enrollment | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_ENROLLMENT_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { courseId: initial.courseId, employeeId: initial.employeeId, status: initial.status, startDate: initial.startDate, completionDate: initial.completionDate, certificateExpiryDate: initial.certificateExpiryDate, notes: initial.notes }
      : EMPTY_ENROLLMENT_FORM,
  );
  const selectedCourse = courses.find((c) => c.id === form.courseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Pendaftaran" : "Daftarkan Karyawan"}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="enrollCourse">Pelatihan</Label>
            <select id="enrollCourse" className={inputClass} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Pilih pelatihan...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="enrollEmployee">Karyawan</Label>
            <select id="enrollEmployee" className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Pilih karyawan...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.department ? ` — ${e.department}` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="enrollStatus">Status</Label>
              <select id="enrollStatus" className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EnrollmentStatus })}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <input id="startDate" type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="completionDate">Tanggal Selesai</Label>
              <input id="completionDate" type="date" className={inputClass} value={form.completionDate} onChange={(e) => setForm({ ...form, completionDate: e.target.value })} />
            </div>
            {selectedCourse?.isCertification && (
              <div>
                <Label htmlFor="certExpiry">Sertifikat Berlaku Sampai</Label>
                <input id="certExpiry" type="date" className={inputClass} value={form.certificateExpiryDate} onChange={(e) => setForm({ ...form, certificateExpiryDate: e.target.value })} />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="enrollNotes">Catatan</Label>
            <textarea id="enrollNotes" rows={2} className={cn(inputClass, "resize-none")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.courseId || !form.employeeId) {
                toast("Pelatihan dan karyawan wajib dipilih", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_BUDGET_FORM = { department: "", year: new Date().getFullYear(), allocated: 0 };

function BudgetModal({
  departments,
  initial,
  onClose,
  onSave,
}: {
  departments: string[];
  initial: DepartmentBudget | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_BUDGET_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial ? { department: initial.department, year: initial.year, allocated: initial.allocated } : EMPTY_BUDGET_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Budget" : "Budget Baru"}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="budgetDept">Departemen</Label>
            <select id="budgetDept" className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Pilih departemen...</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="budgetYear">Tahun</Label>
              <input id="budgetYear" type="number" className={inputClass} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="allocated">Budget Dialokasikan</Label>
              <input id="allocated" type="number" min={0} className={inputClass} value={form.allocated} onChange={(e) => setForm({ ...form, allocated: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.department) {
                toast("Departemen wajib dipilih", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingCoursesPage() {
  const [tab, setTab] = useState<"catalog" | "progress" | "budget">("catalog");
  const [tenantId, setTenantId] = useState("");
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [budgets, setBudgets] = useState<DepartmentBudget[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [courseModal, setCourseModal] = useState<{ data: Course | null } | null>(null);
  const [enrollModal, setEnrollModal] = useState<{ data: Enrollment | null } | null>(null);
  const [budgetModal, setBudgetModal] = useState<{ data: DepartmentBudget | null } | null>(null);

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    setEmployees(getActiveCompanyEmployees());
    setCourses(getCourses(id));
    setEnrollments(getEnrollments(id));
    setBudgets(getDepartmentBudgets(id));
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pi-company-change", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pi-company-change", refresh);
    };
  }, []);

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department || "Lainnya"))).sort(), [employees]);
  const employeeDept = (id: string) => employees.find((e) => e.id === id)?.department || "Lainnya";
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? "—";

  const certAlerts = useMemo(() => {
    const withStatus = enrollments
      .map((e) => ({ e, status: certificateStatus(e.certificateExpiryDate) }))
      .filter((x) => x.status === "menuju-kadaluarsa" || x.status === "kadaluarsa");
    return withStatus;
  }, [enrollments]);

  const budgetRows = useMemo(() => {
    return budgets.map((b) => {
      const spent = enrollments
        .filter((e) => e.status !== "tidak-lulus" && employeeDept(e.employeeId) === b.department && new Date(e.startDate).getFullYear() === b.year)
        .reduce((sum, e) => sum + (courses.find((c) => c.id === e.courseId)?.cost ?? 0), 0);
      return { ...b, spent, remaining: b.allocated - spent, pct: b.allocated > 0 ? Math.min((spent / b.allocated) * 100, 100) : 0 };
    });
  }, [budgets, enrollments, courses, employees]);

  const handleSaveCourse = (form: typeof EMPTY_COURSE_FORM & { id?: string }) => {
    upsertCourse(tenantId, form);
    setCourseModal(null);
    toast(form.id ? "Pelatihan diperbarui" : "Pelatihan baru ditambahkan");
    refresh();
  };

  const handleSaveEnrollment = (form: typeof EMPTY_ENROLLMENT_FORM & { id?: string }) => {
    upsertEnrollment(tenantId, { ...form, employeeName: employees.find((e) => e.id === form.employeeId)?.full_name ?? "—" });
    setEnrollModal(null);
    toast(form.id ? "Pendaftaran diperbarui" : "Karyawan berhasil didaftarkan");
    refresh();
  };

  const handleSaveBudget = (form: typeof EMPTY_BUDGET_FORM & { id?: string }) => {
    upsertDepartmentBudget(tenantId, form);
    setBudgetModal(null);
    toast(form.id ? "Budget diperbarui" : "Budget baru ditambahkan");
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="courses" title="Training & Courses" subtitle="Katalog, progress, dan budget pelatihan">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="courses" title="Training & Courses" subtitle="Katalog pelatihan, progress sertifikasi karyawan, dan budget pelatihan divisi">
      <div className="space-y-6">
        {certAlerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{certAlerts.length} sertifikat perlu perhatian</p>
            <div className="mt-2 space-y-1">
              {certAlerts.slice(0, 5).map(({ e, status }) => (
                <p key={e.id} className="text-xs text-amber-700 dark:text-amber-400">
                  {e.employeeName} — {courseTitle(e.courseId)} — {CERT_STATUS_LABEL[status!]} ({e.certificateExpiryDate})
                </p>
              ))}
            </div>
          </Card>
        )}

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setTab("catalog")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "catalog" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Katalog Pelatihan
          </button>
          <button type="button" onClick={() => setTab("progress")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "progress" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Progress Karyawan
          </button>
          <button type="button" onClick={() => setTab("budget")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "budget" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Budget Divisi
          </button>
        </div>

        {tab === "catalog" && (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Katalog Pelatihan</h2>
                <p className="mt-0.5 text-sm text-slate-500">Internal & eksternal</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setCourseModal({ data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Pelatihan Baru
              </Button>
            </div>
            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="book" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada pelatihan di katalog.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-5 py-2.5 font-medium">Pelatihan</th>
                      <th className="px-5 py-2.5 font-medium">Penyelenggara</th>
                      <th className="px-5 py-2.5 font-medium">Kategori</th>
                      <th className="px-5 py-2.5 text-right font-medium">Durasi</th>
                      <th className="px-5 py-2.5 text-right font-medium">Biaya</th>
                      <th className="px-5 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {courses.map((c) => (
                      <tr key={c.id}>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                          {c.title}
                          {c.isCertification && <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">Sertifikasi</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.provider === "internal" ? "Internal" : "Eksternal"}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.category || "—"}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{c.durationHours} jam</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{formatRupiah(c.cost)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setCourseModal({ data: c })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                              <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                            </button>
                            <button type="button" onClick={() => { deleteCourse(tenantId, c.id); toast("Pelatihan dihapus"); refresh(); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                              <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "progress" && (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Progress Pelatihan Karyawan</h2>
                <p className="mt-0.5 text-sm text-slate-500">Status pendaftaran & masa berlaku sertifikat</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setEnrollModal({ data: null })} disabled={courses.length === 0}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Daftarkan Karyawan
              </Button>
            </div>
            {enrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="users" /></Icon>
                <p className="mt-3 text-sm text-slate-400">
                  {courses.length === 0 ? "Buat pelatihan di katalog terlebih dahulu." : "Belum ada karyawan terdaftar."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-5 py-2.5 font-medium">Karyawan</th>
                      <th className="px-5 py-2.5 font-medium">Pelatihan</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Sertifikat</th>
                      <th className="px-5 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {enrollments.map((e) => {
                      const cs = certificateStatus(e.certificateExpiryDate);
                      return (
                        <tr key={e.id}>
                          <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{e.employeeName}</td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{courseTitle(e.courseId)}</td>
                          <td className="px-5 py-3">
                            <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", STATUS_COLOR[e.status])}>{STATUS_LABEL[e.status]}</span>
                          </td>
                          <td className="px-5 py-3">
                            {cs ? (
                              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", CERT_STATUS_COLOR[cs])}>{CERT_STATUS_LABEL[cs]}</span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => setEnrollModal({ data: e })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                              </button>
                              <button type="button" onClick={() => { deleteEnrollment(tenantId, e.id); toast("Pendaftaran dihapus"); refresh(); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                                <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "budget" && (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Budget Pelatihan per Divisi</h2>
                <p className="mt-0.5 text-sm text-slate-500">Terpakai dihitung dari biaya pelatihan karyawan yang terdaftar (status bukan "tidak lulus") pada tahun berjalan</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setBudgetModal({ data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Budget Baru
              </Button>
            </div>
            {budgetRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada budget pelatihan dialokasikan.</p>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                {budgetRows.map((b) => (
                  <div key={b.id} className="group">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{b.department} <span className="text-xs text-slate-400">({b.year})</span></span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-slate-500">{formatRupiah(b.spent)} / {formatRupiah(b.allocated)}</span>
                        <button type="button" onClick={() => setBudgetModal({ data: b })} className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800">
                          <Icon className="h-3.5 w-3.5"><SvgPath name="pencil" /></Icon>
                        </button>
                        <button type="button" onClick={() => { deleteDepartmentBudget(tenantId, b.id); toast("Budget dihapus"); refresh(); }} className="rounded p-1 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/10">
                          <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
                        </button>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", b.pct >= 100 ? "bg-red-500" : b.pct >= 80 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${Math.max(b.pct, 3)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Sisa {formatRupiah(b.remaining)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {courseModal && (
        <CourseModal
          initial={courseModal.data}
          onClose={() => setCourseModal(null)}
          onSave={handleSaveCourse}
        />
      )}
      {enrollModal && (
        <EnrollmentModal
          courses={courses}
          employees={employees}
          initial={enrollModal.data}
          onClose={() => setEnrollModal(null)}
          onSave={handleSaveEnrollment}
        />
      )}
      {budgetModal && (
        <BudgetModal
          departments={departments}
          initial={budgetModal.data}
          onClose={() => setBudgetModal(null)}
          onSave={handleSaveBudget}
        />
      )}
    </AppShell>
  );
}
