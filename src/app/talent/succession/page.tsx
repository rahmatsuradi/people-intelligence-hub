"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import {
  getNineBoxRatings,
  setNineBoxRating,
  nineBoxLabel,
  getKeyPositions,
  upsertKeyPosition,
  deleteKeyPosition,
  getSuccessors,
  upsertSuccessor,
  deleteSuccessor,
  type NineBoxRating,
  type KeyPosition,
  type Successor,
  type SuccessionReadiness,
} from "@/lib/succession-store";

interface EmployeeLite {
  id: string;
  full_name: string;
  department: string | null;
  position?: string;
}

const READINESS_LABEL: Record<SuccessionReadiness, string> = {
  "ready-now": "Siap Sekarang",
  "ready-1-2y": "Siap 1–2 Tahun",
  "ready-3-5y": "Siap 3–5 Tahun",
  development: "Perlu Pengembangan",
};

const READINESS_COLOR: Record<SuccessionReadiness, string> = {
  "ready-now": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  "ready-1-2y": "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  "ready-3-5y": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  development: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const RISK_COLOR: Record<string, string> = {
  tinggi: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  sedang: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  rendah: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const BOX_STYLE: Record<string, string> = {
  "3-3": "bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30",
  "3-2": "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20",
  "2-3": "bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30",
  "2-2": "bg-blue-50/60 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20",
  "3-1": "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30",
  "1-3": "bg-amber-50/60 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20",
  "2-1": "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700",
  "1-2": "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700",
  "1-1": "bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30",
};

function NineBoxModal({
  employee,
  current,
  onClose,
  onSave,
}: {
  employee: EmployeeLite;
  current: NineBoxRating | undefined;
  onClose: () => void;
  onSave: (performance: 1 | 2 | 3, potential: 1 | 2 | 3, ratedBy: string, notes: string) => void;
}) {
  const [performance, setPerformance] = useState<1 | 2 | 3>(current?.performance ?? 2);
  const [potential, setPotential] = useState<1 | 2 | 3>(current?.potential ?? 2);
  const [ratedBy, setRatedBy] = useState(current?.ratedBy ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{employee.full_name}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{employee.position || employee.department || "—"}</p>

        <div className="mt-4">
          <Label>Kinerja (Performance)</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((v) => (
              <button key={v} type="button" onClick={() => setPerformance(v)} className={cn("rounded-lg border py-2 text-sm font-medium", performance === v ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
                {v === 1 ? "Rendah" : v === 2 ? "Sedang" : "Tinggi"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Label>Potensi (Potential)</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((v) => (
              <button key={v} type="button" onClick={() => setPotential(v)} className={cn("rounded-lg border py-2 text-sm font-medium", potential === v ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
                {v === 1 ? "Rendah" : v === 2 ? "Sedang" : "Tinggi"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Kategori: {nineBoxLabel(performance, potential)}</p>
        </div>

        <div className="mt-4">
          <Label htmlFor="ratedBy">Dinilai oleh</Label>
          <input id="ratedBy" className={cn(inputClass, "mt-1.5")} value={ratedBy} onChange={(e) => setRatedBy(e.target.value)} placeholder="Nama penilai / atasan langsung" />
        </div>

        <div className="mt-4">
          <Label htmlFor="notes">Catatan</Label>
          <textarea id="notes" rows={2} className={cn(inputClass, "mt-1.5 resize-none")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={() => onSave(performance, potential, ratedBy, notes)}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_POSITION_FORM = {
  title: "",
  department: "",
  incumbentEmployeeId: "",
  criticality: "sedang" as KeyPosition["criticality"],
  vacancyRisk: "sedang" as KeyPosition["vacancyRisk"],
  notes: "",
};

function PositionModal({
  employees,
  initial,
  onClose,
  onSave,
}: {
  employees: EmployeeLite[];
  initial: KeyPosition | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_POSITION_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { title: initial.title, department: initial.department, incumbentEmployeeId: initial.incumbentEmployeeId, criticality: initial.criticality, vacancyRisk: initial.vacancyRisk, notes: initial.notes }
      : EMPTY_POSITION_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Posisi Kunci" : "Posisi Kunci Baru"}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="posTitle">Jabatan</Label>
            <input id="posTitle" className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Kepala Produksi" />
          </div>
          <div>
            <Label htmlFor="posDept">Departemen</Label>
            <input id="posDept" className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="incumbent">Pemegang Jabatan Saat Ini</Label>
            <select id="incumbent" className={inputClass} value={form.incumbentEmployeeId} onChange={(e) => setForm({ ...form, incumbentEmployeeId: e.target.value })}>
              <option value="">Pilih karyawan...</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="criticality">Kekritisan Posisi</Label>
              <select id="criticality" className={inputClass} value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as KeyPosition["criticality"] })}>
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="rendah">Rendah</option>
              </select>
            </div>
            <div>
              <Label htmlFor="vacancyRisk">Risiko Kekosongan</Label>
              <select id="vacancyRisk" className={inputClass} value={form.vacancyRisk} onChange={(e) => setForm({ ...form, vacancyRisk: e.target.value as KeyPosition["vacancyRisk"] })}>
                <option value="tinggi">Tinggi</option>
                <option value="sedang">Sedang</option>
                <option value="rendah">Rendah</option>
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="posNotes">Catatan</Label>
            <textarea id="posNotes" rows={2} className={cn(inputClass, "resize-none")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.title.trim() || !form.incumbentEmployeeId) {
                toast("Jabatan dan pemegang jabatan wajib diisi", "error");
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

function SuccessorModal({
  employees,
  positionTitle,
  initial,
  onClose,
  onSave,
}: {
  employees: EmployeeLite[];
  positionTitle: string;
  initial: Successor | null;
  onClose: () => void;
  onSave: (employeeId: string, readiness: SuccessionReadiness, developmentNotes: string) => void;
}) {
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [readiness, setReadiness] = useState<SuccessionReadiness>(initial?.readiness ?? "development");
  const [developmentNotes, setDevelopmentNotes] = useState(initial?.developmentNotes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Kandidat Suksesor</h3>
        <p className="mt-0.5 text-sm text-slate-500">untuk {positionTitle}</p>

        <div className="mt-4">
          <Label htmlFor="succEmployee">Karyawan</Label>
          <select id="succEmployee" className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Pilih karyawan...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.department ? ` — ${e.department}` : ""}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <Label htmlFor="readiness">Tingkat Kesiapan</Label>
          <select id="readiness" className={inputClass} value={readiness} onChange={(e) => setReadiness(e.target.value as SuccessionReadiness)}>
            {Object.entries(READINESS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <Label htmlFor="devNotes">Catatan Pengembangan</Label>
          <textarea id="devNotes" rows={3} className={cn(inputClass, "resize-none")} value={developmentNotes} onChange={(e) => setDevelopmentNotes(e.target.value)} placeholder="Gap kompetensi, rencana development..." />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!employeeId) {
                toast("Pilih karyawan terlebih dahulu", "error");
                return;
              }
              onSave(employeeId, readiness, developmentNotes);
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SuccessionPage() {
  const [tab, setTab] = useState<"ninebox" | "positions">("ninebox");
  const [tenantId, setTenantId] = useState("");
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [ratings, setRatings] = useState<Record<string, NineBoxRating>>({});
  const [positions, setPositions] = useState<KeyPosition[]>([]);
  const [successors, setSuccessors] = useState<Successor[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [department, setDepartment] = useState("all");

  const [boxModalEmployee, setBoxModalEmployee] = useState<EmployeeLite | null>(null);
  const [positionModal, setPositionModal] = useState<{ data: KeyPosition | null } | null>(null);
  const [successorModal, setSuccessorModal] = useState<{ position: KeyPosition; data: Successor | null } | null>(null);

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    setEmployees(getActiveCompanyEmployees());
    setRatings(getNineBoxRatings(id));
    setPositions(getKeyPositions(id));
    setSuccessors(getSuccessors(id));
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

  const grid = useMemo(() => {
    const cells: Record<string, EmployeeLite[]> = {};
    for (let p = 1; p <= 3; p++) {
      for (let q = 1; q <= 3; q++) cells[`${p}-${q}`] = [];
    }
    let ratedCount = 0;
    for (const e of deptEmployees) {
      const r = ratings[e.id];
      if (r) {
        cells[`${r.potential}-${r.performance}`].push(e);
        ratedCount++;
      }
    }
    return { cells, ratedCount };
  }, [deptEmployees, ratings]);

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const positionSuccessors = (positionId: string) => successors.filter((s) => s.positionId === positionId);

  const handleSaveNineBox = (performance: 1 | 2 | 3, potential: 1 | 2 | 3, ratedBy: string, notes: string) => {
    if (!boxModalEmployee) return;
    setNineBoxRating(tenantId, boxModalEmployee.id, boxModalEmployee.full_name, performance, potential, ratedBy, notes);
    setBoxModalEmployee(null);
    toast("Penilaian 9-box disimpan");
    refresh();
  };

  const handleSavePosition = (form: typeof EMPTY_POSITION_FORM & { id?: string }) => {
    upsertKeyPosition(tenantId, { ...form, incumbentName: employeeName(form.incumbentEmployeeId) });
    setPositionModal(null);
    toast(form.id ? "Posisi kunci diperbarui" : "Posisi kunci baru ditambahkan");
    refresh();
  };

  const handleSaveSuccessor = (employeeId: string, readiness: SuccessionReadiness, developmentNotes: string) => {
    if (!successorModal) return;
    upsertSuccessor(tenantId, {
      id: successorModal.data?.id,
      positionId: successorModal.position.id,
      employeeId,
      employeeName: employeeName(employeeId),
      readiness,
      developmentNotes,
    });
    setSuccessorModal(null);
    toast("Kandidat suksesor disimpan");
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="succession" title="Succession Planning" subtitle="9-Box Matrix & perencanaan suksesi">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="succession" title="Succession Planning" subtitle="Pemetaan HIPO (9-Box Matrix) & perencanaan suksesi posisi kunci">
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setTab("ninebox")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "ninebox" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            9-Box Matrix
          </button>
          <button type="button" onClick={() => setTab("positions")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "positions" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Posisi Kunci & Suksesor
          </button>
        </div>

        {tab === "ninebox" ? (
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
                <p className="text-sm text-slate-500">{grid.ratedCount} / {deptEmployees.length} karyawan sudah dinilai</p>
              </div>
            </Card>

            <Card>
              <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-2">
                <div />
                <div className="text-center text-xs font-medium text-slate-500">Kinerja Rendah</div>
                <div className="text-center text-xs font-medium text-slate-500">Kinerja Sedang</div>
                <div className="text-center text-xs font-medium text-slate-500">Kinerja Tinggi</div>
                {([3, 2, 1] as const).map((potential) => (
                  <Fragment key={potential}>
                    <div className="flex items-center justify-center text-xs font-medium text-slate-500 [writing-mode:vertical-rl]">
                      {potential === 3 ? "Potensi Tinggi" : potential === 2 ? "Potensi Sedang" : "Potensi Rendah"}
                    </div>
                    {([1, 2, 3] as const).map((performance) => {
                      const key = `${potential}-${performance}`;
                      const cellEmployees = grid.cells[key] ?? [];
                      return (
                        <div key={key} className={cn("min-h-[110px] rounded-lg border p-2", BOX_STYLE[key])}>
                          <p className="text-[11px] font-semibold text-slate-500">{nineBoxLabel(performance, potential)}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {cellEmployees.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => setBoxModalEmployee(e)}
                                className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm hover:ring-1 hover:ring-blue-400 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {e.full_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </Card>

            <Card padding={false} className="overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Nilai / Ubah Karyawan</h2>
                <p className="mt-0.5 text-sm text-slate-500">Klik karyawan untuk memberi atau mengubah rating kinerja & potensi</p>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {deptEmployees.slice(0, 100).map((e) => {
                  const r = ratings[e.id];
                  return (
                    <button key={e.id} type="button" onClick={() => setBoxModalEmployee(e)} className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{e.full_name}</p>
                        <p className="text-xs text-slate-400">{e.position || e.department || "—"}</p>
                      </div>
                      <span className="text-xs text-slate-500">{r ? nineBoxLabel(r.performance, r.potential) : "Belum dinilai"}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setPositionModal({ data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Posisi Kunci Baru
              </Button>
            </div>

            {positions.length === 0 ? (
              <Card className="flex flex-col items-center justify-center border-dashed py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="arrowTrend" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada posisi kunci terdaftar.</p>
              </Card>
            ) : (
              positions.map((p) => (
                <Card key={p.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-slate-500">{p.department} · Pemegang jabatan: {p.incumbentName}</p>
                      <div className="mt-2 flex gap-2">
                        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", RISK_COLOR[p.criticality])}>Kekritisan: {p.criticality}</span>
                        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", RISK_COLOR[p.vacancyRisk])}>Risiko kosong: {p.vacancyRisk}</span>
                      </div>
                      {p.notes && <p className="mt-2 text-xs text-slate-400">{p.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setPositionModal({ data: p })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                      </button>
                      <button type="button" onClick={() => { deleteKeyPosition(tenantId, p.id); toast("Posisi kunci dihapus"); refresh(); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                        <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Kandidat Suksesor</p>
                      <Button variant="ghost" size="sm" onClick={() => setSuccessorModal({ position: p, data: null })}>
                        <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon>
                        Tambah
                      </Button>
                    </div>
                    {positionSuccessors(p.id).length === 0 ? (
                      <p className="mt-2 text-xs text-slate-400">Belum ada kandidat suksesor.</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {positionSuccessors(p.id).map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{s.employeeName}</p>
                              {s.developmentNotes && <p className="text-xs text-slate-400">{s.developmentNotes}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", READINESS_COLOR[s.readiness])}>{READINESS_LABEL[s.readiness]}</span>
                              <button type="button" onClick={() => setSuccessorModal({ position: p, data: s })} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                                <Icon className="h-3.5 w-3.5"><SvgPath name="pencil" /></Icon>
                              </button>
                              <button type="button" onClick={() => { deleteSuccessor(tenantId, s.id); toast("Kandidat dihapus"); refresh(); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                                <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {boxModalEmployee && (
        <NineBoxModal
          employee={boxModalEmployee}
          current={ratings[boxModalEmployee.id]}
          onClose={() => setBoxModalEmployee(null)}
          onSave={handleSaveNineBox}
        />
      )}
      {positionModal && (
        <PositionModal
          employees={employees}
          initial={positionModal.data}
          onClose={() => setPositionModal(null)}
          onSave={handleSavePosition}
        />
      )}
      {successorModal && (
        <SuccessorModal
          employees={employees}
          positionTitle={successorModal.position.title}
          initial={successorModal.data}
          onClose={() => setSuccessorModal(null)}
          onSave={handleSaveSuccessor}
        />
      )}
    </AppShell>
  );
}
