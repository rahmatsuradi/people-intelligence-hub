"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import {
  getOrgRelations,
  setReportsTo,
  getJobGrades,
  upsertJobGrade,
  deleteJobGrade,
  getPositionGradeMap,
  setPositionGrade,
  type OrgRelationMap,
  type JobGrade,
  type PositionGradeMap,
} from "@/lib/org-development-store";

interface EmployeeLite {
  id: string;
  full_name: string;
  department: string | null;
  position: string;
  upah_pokok: number;
}

const MAX_TREE_NODES = 200;
const MIN_HEALTHY_SPAN = 3;
const MAX_HEALTHY_SPAN = 8;

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function OrgTreeNode({
  employee,
  childrenMap,
  relations,
  spanCounts,
  onAssign,
  depth,
  renderedCount,
}: {
  employee: EmployeeLite;
  childrenMap: Map<string, EmployeeLite[]>;
  relations: OrgRelationMap;
  spanCounts: Map<string, number>;
  onAssign: (e: EmployeeLite) => void;
  depth: number;
  renderedCount: { n: number };
}) {
  const children = childrenMap.get(employee.id) ?? [];
  const span = spanCounts.get(employee.id) ?? 0;
  renderedCount.n++;
  if (renderedCount.n > MAX_TREE_NODES) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }} className={depth > 0 ? "border-l border-slate-200 pl-4 dark:border-slate-800" : ""}>
      <button
        type="button"
        onClick={() => onAssign(employee)}
        className="my-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span className="text-sm font-medium text-slate-900 dark:text-white">{employee.full_name}</span>
        <span className="text-xs text-slate-400">{employee.position || "—"}</span>
        {span > 0 && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              span > MAX_HEALTHY_SPAN
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : span < MIN_HEALTHY_SPAN
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
            )}
          >
            {span} laporan langsung
          </span>
        )}
      </button>
      {children.map((c) => (
        <OrgTreeNode key={c.id} employee={c} childrenMap={childrenMap} relations={relations} spanCounts={spanCounts} onAssign={onAssign} depth={depth + 1} renderedCount={renderedCount} />
      ))}
    </div>
  );
}

function AssignManagerModal({
  employee,
  candidates,
  currentManagerId,
  onClose,
  onSave,
}: {
  employee: EmployeeLite;
  candidates: EmployeeLite[];
  currentManagerId: string;
  onClose: () => void;
  onSave: (managerId: string) => void;
}) {
  const [managerId, setManagerId] = useState(currentManagerId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{employee.full_name}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{employee.position || employee.department || "—"}</p>
        <div className="mt-4">
          <Label htmlFor="manager">Melapor kepada</Label>
          <select id="manager" className={inputClass} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Tidak ada (puncak struktur)</option>
            {candidates.filter((c) => c.id !== employee.id).map((c) => (
              <option key={c.id} value={c.id}>{c.full_name} — {c.position || c.department || "—"}</option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={() => onSave(managerId)}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_GRADE_FORM = { name: "", level: 1, salaryMin: 0, salaryMax: 0, description: "" };

function GradeModal({
  initial,
  onClose,
  onSave,
}: {
  initial: JobGrade | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_GRADE_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial ? { name: initial.name, level: initial.level, salaryMin: initial.salaryMin, salaryMax: initial.salaryMax, description: initial.description } : EMPTY_GRADE_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Grade" : "Grade Baru"}</h3>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gradeName">Nama Grade</Label>
              <input id="gradeName" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Grade 5 - Manager" />
            </div>
            <div>
              <Label htmlFor="gradeLevel">Level (urutan)</Label>
              <input id="gradeLevel" type="number" min={1} className={inputClass} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="salaryMin">Upah Pokok Min</Label>
              <input id="salaryMin" type="number" min={0} className={inputClass} value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="salaryMax">Upah Pokok Maks</Label>
              <input id="salaryMax" type="number" min={0} className={inputClass} value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label htmlFor="gradeDesc">Deskripsi</Label>
            <textarea id="gradeDesc" rows={2} className={cn(inputClass, "resize-none")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.name.trim() || form.salaryMax < form.salaryMin) {
                toast("Nama wajib diisi dan rentang gaji harus valid", "error");
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

export default function OrgDevelopmentPage() {
  const [tab, setTab] = useState<"structure" | "grading">("structure");
  const [tenantId, setTenantId] = useState("");
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [relations, setRelations] = useState<OrgRelationMap>({});
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [positionGradeMap, setPositionGradeMapState] = useState<PositionGradeMap>({});
  const [loaded, setLoaded] = useState(false);
  const [department, setDepartment] = useState("all");
  const [assignTarget, setAssignTarget] = useState<EmployeeLite | null>(null);
  const [gradeModal, setGradeModal] = useState<{ data: JobGrade | null } | null>(null);

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    setEmployees(getActiveCompanyEmployees());
    setRelations(getOrgRelations(id));
    setGrades(getJobGrades(id));
    setPositionGradeMapState(getPositionGradeMap(id));
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

  useEffect(() => {
    if (department !== "all" && !departments.includes(department)) setDepartment("all");
  }, [departments, department]);

  const deptEmployees = useMemo(
    () => (department === "all" ? employees : employees.filter((e) => (e.department || "Lainnya") === department)),
    [employees, department],
  );

  const spanCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees) {
      const managerId = relations[e.id]?.reportsToEmployeeId;
      if (managerId) counts.set(managerId, (counts.get(managerId) ?? 0) + 1);
    }
    return counts;
  }, [employees, relations]);

  const tree = useMemo(() => {
    const employeeIds = new Set(deptEmployees.map((e) => e.id));
    const childrenMap = new Map<string, EmployeeLite[]>();
    const roots: EmployeeLite[] = [];
    for (const e of deptEmployees) {
      const managerId = relations[e.id]?.reportsToEmployeeId;
      if (managerId && employeeIds.has(managerId)) {
        if (!childrenMap.has(managerId)) childrenMap.set(managerId, []);
        childrenMap.get(managerId)!.push(e);
      } else {
        roots.push(e);
      }
    }
    return { roots, childrenMap };
  }, [deptEmployees, relations]);

  const structureStats = useMemo(() => {
    const mapped = deptEmployees.filter((e) => relations[e.id]?.reportsToEmployeeId).length;
    const managerIds = new Set(deptEmployees.map((e) => relations[e.id]?.reportsToEmployeeId).filter(Boolean));
    const spans = Array.from(managerIds).map((id) => spanCounts.get(id!) ?? 0);
    const avgSpan = spans.length > 0 ? spans.reduce((s, v) => s + v, 0) / spans.length : 0;
    const tooWide = spans.filter((s) => s > MAX_HEALTHY_SPAN).length;
    const tooNarrow = spans.filter((s) => s > 0 && s < MIN_HEALTHY_SPAN).length;
    return { mapped, total: deptEmployees.length, avgSpan, tooWide, tooNarrow, managerCount: managerIds.size };
  }, [deptEmployees, relations, spanCounts]);

  const positionSummary = useMemo(() => {
    const map = new Map<string, { position: string; count: number; totalSalary: number; minSalary: number; maxSalary: number }>();
    for (const e of employees) {
      const pos = e.position || "—";
      const entry = map.get(pos) ?? { position: pos, count: 0, totalSalary: 0, minSalary: Infinity, maxSalary: -Infinity };
      entry.count++;
      entry.totalSalary += e.upah_pokok || 0;
      entry.minSalary = Math.min(entry.minSalary, e.upah_pokok || 0);
      entry.maxSalary = Math.max(entry.maxSalary, e.upah_pokok || 0);
      map.set(pos, entry);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, avgSalary: e.totalSalary / e.count, gradeId: positionGradeMap[e.position] ?? "" }))
      .sort((a, b) => b.count - a.count);
  }, [employees, positionGradeMap]);

  const handleAssignManager = (managerId: string) => {
    if (!assignTarget) return;
    setReportsTo(tenantId, assignTarget.id, managerId);
    setAssignTarget(null);
    toast("Struktur pelaporan diperbarui");
    refresh();
  };

  const handleSaveGrade = (form: typeof EMPTY_GRADE_FORM & { id?: string }) => {
    upsertJobGrade(tenantId, form);
    setGradeModal(null);
    toast(form.id ? "Grade diperbarui" : "Grade baru ditambahkan");
    refresh();
  };

  const handleAssignGrade = (position: string, gradeId: string) => {
    setPositionGrade(tenantId, position, gradeId);
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="od" title="Organization Development" subtitle="Struktur organisasi & job grading">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="od" title="Organization Development" subtitle="Struktur organisasi, rentang kendali (span of control), dan evaluasi jabatan (job grading)">
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setTab("structure")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "structure" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Struktur Organisasi
          </button>
          <button type="button" onClick={() => setTab("grading")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "grading" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Job Grading
          </button>
        </div>

        {tab === "structure" ? (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="deptFilter">Departemen</Label>
                  <select id="deptFilter" className={cn(inputClass, "mt-1.5 w-56")} value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="all">Semua departemen</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <p className="text-sm text-slate-500">Klik nama karyawan pada pohon organisasi untuk mengatur atasan langsung</p>
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <p className="text-sm font-medium text-slate-500">Sudah Dipetakan</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{structureStats.mapped} / {structureStats.total}</p>
              </Card>
              <Card>
                <p className="text-sm font-medium text-slate-500">Rata-rata Span of Control</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{structureStats.avgSpan.toFixed(1)}</p>
                <p className="mt-1 text-xs text-slate-400">Ideal umum: 5–8 (Urwick, 1956)</p>
              </Card>
              <Card>
                <p className="text-sm font-medium text-slate-500">Terlalu Lebar (&gt;8)</p>
                <p className={cn("mt-2 text-2xl font-bold tabular-nums", structureStats.tooWide > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>{structureStats.tooWide}</p>
              </Card>
              <Card>
                <p className="text-sm font-medium text-slate-500">Terlalu Sempit (&lt;3)</p>
                <p className={cn("mt-2 text-2xl font-bold tabular-nums", structureStats.tooNarrow > 0 ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-white")}>{structureStats.tooNarrow}</p>
              </Card>
            </div>

            <Card padding={false} className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pohon Organisasi</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Karyawan tanpa atasan yang dipetakan ditampilkan sebagai simpul teratas
                  {deptEmployees.length > MAX_TREE_NODES && ` — dibatasi ${MAX_TREE_NODES} simpul pertama, persempit dengan filter departemen`}
                </p>
              </div>
              <div className="max-h-[480px] overflow-y-auto p-5">
                {tree.roots.length === 0 ? (
                  <p className="text-sm text-slate-400">Tidak ada karyawan pada filter ini.</p>
                ) : (
                  (() => {
                    const renderedCount = { n: 0 };
                    return tree.roots.map((r) => (
                      <OrgTreeNode key={r.id} employee={r} childrenMap={tree.childrenMap} relations={relations} spanCounts={spanCounts} onAssign={setAssignTarget} depth={0} renderedCount={renderedCount} />
                    ));
                  })()
                )}
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card padding={false} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Grade Bands</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Rentang upah pokok per grade untuk evaluasi jabatan</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setGradeModal({ data: null })}>
                  <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                  Grade Baru
                </Button>
              </div>
              {grades.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
                  <p className="mt-3 text-sm text-slate-400">Belum ada grade band. Buat grade untuk mulai memetakan jabatan.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                        <th className="px-5 py-2.5 font-medium">Level</th>
                        <th className="px-5 py-2.5 font-medium">Nama Grade</th>
                        <th className="px-5 py-2.5 text-right font-medium">Rentang Upah Pokok</th>
                        <th className="px-5 py-2.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {grades.map((g) => (
                        <tr key={g.id}>
                          <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-400">{g.level}</td>
                          <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{g.name}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{formatRupiah(g.salaryMin)} – {formatRupiah(g.salaryMax)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => setGradeModal({ data: g })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                              </button>
                              <button type="button" onClick={() => { deleteJobGrade(tenantId, g.id); toast("Grade dihapus"); refresh(); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
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

            <Card padding={false} className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pemetaan Jabatan ke Grade</h2>
                <p className="mt-0.5 text-sm text-slate-500">Rata-rata upah pokok aktual dibandingkan rentang grade yang ditetapkan</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-5 py-2.5 font-medium">Jabatan</th>
                      <th className="px-5 py-2.5 text-right font-medium">Jumlah</th>
                      <th className="px-5 py-2.5 text-right font-medium">Rata-rata Upah Pokok</th>
                      <th className="px-5 py-2.5 font-medium">Grade</th>
                      <th className="px-5 py-2.5 font-medium">Kesesuaian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {positionSummary.map((p) => {
                      const grade = grades.find((g) => g.id === p.gradeId);
                      const outOfBand = grade ? p.avgSalary < grade.salaryMin || p.avgSalary > grade.salaryMax : null;
                      return (
                        <tr key={p.position}>
                          <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{p.position}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{p.count}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{formatRupiah(p.avgSalary)}</td>
                          <td className="px-5 py-3">
                            <select
                              className={cn(inputClass, "w-44 py-1 text-xs")}
                              value={p.gradeId}
                              onChange={(e) => handleAssignGrade(p.position, e.target.value)}
                            >
                              <option value="">Belum digrading</option>
                              {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            {grade === undefined ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : outOfBand ? (
                              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Di luar band</span>
                            ) : (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">Sesuai band</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {assignTarget && (
        <AssignManagerModal
          employee={assignTarget}
          candidates={employees}
          currentManagerId={relations[assignTarget.id]?.reportsToEmployeeId ?? ""}
          onClose={() => setAssignTarget(null)}
          onSave={handleAssignManager}
        />
      )}
      {gradeModal && (
        <GradeModal
          initial={gradeModal.data}
          onClose={() => setGradeModal(null)}
          onSave={handleSaveGrade}
        />
      )}
    </AppShell>
  );
}
