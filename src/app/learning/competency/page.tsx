"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { CLUSTER_FRAMEWORKS, type CompetencyCluster, type CompetencyDefinition } from "@/lib/competency-framework";
import {
  getCompetencyRatings,
  setCompetencyRating,
  ratingKey,
  type CompetencyRatingMap,
} from "@/lib/competency-matrix-store";

interface EmployeeLite {
  id: string;
  full_name: string;
  department: string | null;
  position?: string;
}

const CLUSTER_OPTIONS: { value: CompetencyCluster; label: string }[] = [
  { value: "hr", label: "HR (Ulrich + SKKNI)" },
  { value: "tech", label: "Teknologi (SFIA v8)" },
  { value: "business", label: "Bisnis & Leadership (Lominger)" },
  { value: "finance", label: "Finance (CGMA)" },
  { value: "broadcast", label: "Penyiaran (SKKNI Broadcast)" },
  { value: "editorial", label: "Jurnalistik & Redaksi (SKKNI Editorial)" },
  { value: "security", label: "Satuan Pengamanan (SKKNI Security)" },
];

const SCORE_COLOR: Record<number, string> = {
  1: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30",
  2: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
  3: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
  4: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
  5: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30",
};

const MAX_ROWS = 60;

function competencyLabel(c: CompetencyDefinition): string {
  return c.nameId || c.name;
}

function RatingModal({
  employee,
  competency,
  current,
  onClose,
  onSave,
}: {
  employee: EmployeeLite;
  competency: CompetencyDefinition;
  current: { score: number; ratedBy: string; notes: string } | undefined;
  onClose: () => void;
  onSave: (score: number, notes: string, ratedBy: string) => void;
}) {
  const [score, setScore] = useState(current?.score ?? 3);
  const [ratedBy, setRatedBy] = useState(current?.ratedBy ?? "");
  const [notes, setNotes] = useState(current?.notes ?? "");

  const levelDesc = competency.rubric.find((r) => r.score === score)?.description ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{employee.full_name}</h3>
        <p className="mt-0.5 text-sm text-slate-500">{competencyLabel(competency)}</p>
        {competency.crossRef && (
          <p className="mt-0.5 text-xs text-slate-400">{competency.crossRef}</p>
        )}

        <div className="mt-4">
          <Label>Skor (1–5)</Label>
          <div className="mt-1.5 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScore(s)}
                className={cn(
                  "rounded-lg border py-2 text-sm font-semibold transition-colors",
                  score === s ? SCORE_COLOR[s] : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {levelDesc && <p className="mt-2 text-xs leading-relaxed text-slate-500">{levelDesc}</p>}
        </div>

        <div className="mt-4">
          <Label htmlFor="ratedBy">Dinilai oleh</Label>
          <input
            id="ratedBy"
            className={cn(inputClass, "mt-1.5")}
            value={ratedBy}
            onChange={(e) => setRatedBy(e.target.value)}
            placeholder="Nama penilai / atasan langsung"
          />
        </div>

        <div className="mt-4">
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <textarea
            id="notes"
            rows={3}
            className={cn(inputClass, "mt-1.5 resize-none")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Bukti/observasi yang mendasari skor ini..."
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={() => onSave(score, notes, ratedBy)}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

export default function CompetencyMatrixPage() {
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [ratings, setRatings] = useState<CompetencyRatingMap>({});
  const [tenantId, setTenantId] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [cluster, setCluster] = useState<CompetencyCluster>("hr");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [modalTarget, setModalTarget] = useState<{ employee: EmployeeLite; competency: CompetencyDefinition } | null>(null);

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    setEmployees(getActiveCompanyEmployees());
    setRatings(getCompetencyRatings(id));
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

  const departments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department || "Lainnya"));
    return Array.from(set).sort();
  }, [employees]);

  useEffect(() => {
    if (department !== "all" && !departments.includes(department)) {
      setDepartment("all");
    }
  }, [departments, department]);

  const deptEmployees = useMemo(
    () => (department === "all" ? employees : employees.filter((e) => (e.department || "Lainnya") === department)),
    [employees, department],
  );

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? deptEmployees.filter((e) => e.full_name.toLowerCase().includes(q)) : deptEmployees;
    return list.slice(0, MAX_ROWS);
  }, [deptEmployees, search]);

  const competencies = CLUSTER_FRAMEWORKS[cluster].competencies;

  const gapSummary = useMemo(() => {
    return competencies.map((c) => {
      const scores: number[] = [];
      for (const e of deptEmployees) {
        const r = ratings[ratingKey(e.id, c.id)];
        if (r) scores.push(r.score);
      }
      const benchmarkOn5 = (c.benchmark ?? 60) / 20; // benchmark is 0-100, rubric is 1-5
      const belowCount = scores.filter((s) => s < benchmarkOn5).length;
      const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
      return { competency: c, ratedCount: scores.length, belowCount, avgScore };
    });
  }, [competencies, deptEmployees, ratings]);

  const handleSaveRating = (score: number, notes: string, ratedBy: string) => {
    if (!modalTarget) return;
    setCompetencyRating(tenantId, modalTarget.employee.id, modalTarget.competency.id, score, ratedBy, notes);
    setModalTarget(null);
    toast("Skor kompetensi disimpan");
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="competency" title="Competency Matrix" subtitle="Pemetaan kompetensi karyawan lintas framework">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activeNavId="competency"
      title="Competency Matrix"
      subtitle="Penilaian kompetensi karyawan per framework — HR yang mengisi, bukan skor otomatis"
    >
      <div className="space-y-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="cluster">Framework</Label>
              <select
                id="cluster"
                className={cn(inputClass, "mt-1.5")}
                value={cluster}
                onChange={(e) => setCluster(e.target.value as CompetencyCluster)}
              >
                {CLUSTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="department">Departemen</Label>
              <select
                id="department"
                className={cn(inputClass, "mt-1.5")}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="all">Semua departemen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="search">Cari karyawan</Label>
              <input
                id="search"
                className={cn(inputClass, "mt-1.5")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama karyawan..."
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {CLUSTER_FRAMEWORKS[cluster].reference}
            {deptEmployees.length > MAX_ROWS && ` — menampilkan ${MAX_ROWS} dari ${deptEmployees.length} karyawan, persempit dengan filter departemen/pencarian`}
          </p>
        </Card>

        <Card padding={false} className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Rekap Gap Kompetensi</h2>
            <p className="mt-0.5 text-sm text-slate-500">Rata-rata skor vs benchmark, dari karyawan yang sudah dinilai pada filter saat ini</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                  <th className="px-5 py-2.5 font-medium">Kompetensi</th>
                  <th className="px-5 py-2.5 text-right font-medium">Sudah Dinilai</th>
                  <th className="px-5 py-2.5 text-right font-medium">Rata-rata</th>
                  <th className="px-5 py-2.5 text-right font-medium">Di Bawah Benchmark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gapSummary.map(({ competency: c, ratedCount, belowCount, avgScore }) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{competencyLabel(c)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {ratedCount} / {deptEmployees.length}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {avgScore !== null ? avgScore.toFixed(1) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {ratedCount === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
                            belowCount > 0
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                          )}
                        >
                          {belowCount}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding={false} className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Matriks Penilaian</h2>
            <p className="mt-0.5 text-sm text-slate-500">Klik sel untuk memberi atau mengubah skor</p>
          </div>
          {filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="users" /></Icon>
              <p className="mt-3 text-sm text-slate-400">Tidak ada karyawan yang cocok dengan filter ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                    <th className="sticky left-0 z-10 min-w-[200px] bg-white px-5 py-2.5 font-medium dark:bg-slate-900">Karyawan</th>
                    {competencies.map((c) => (
                      <th key={c.id} className="min-w-[140px] px-3 py-2.5 text-center font-medium">
                        {competencyLabel(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmployees.map((e) => (
                    <tr key={e.id}>
                      <td className="sticky left-0 z-10 min-w-[200px] bg-white px-5 py-2.5 dark:bg-slate-900">
                        <p className="font-medium text-slate-900 dark:text-white">{e.full_name}</p>
                        <p className="text-xs text-slate-400">{e.position || e.department || "—"}</p>
                      </td>
                      {competencies.map((c) => {
                        const r = ratings[ratingKey(e.id, c.id)];
                        return (
                          <td key={c.id} className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setModalTarget({ employee: e, competency: c })}
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                                r ? SCORE_COLOR[r.score] : "border-dashed border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400 dark:border-slate-700 dark:text-slate-600",
                              )}
                              title={r ? `${r.ratedBy} · ${new Date(r.ratedAt).toLocaleDateString("id-ID")}` : "Belum dinilai"}
                            >
                              {r ? r.score : "–"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Catatan metodologi:</span>{" "}
          Skor pada matriks ini murni hasil input manual HR/atasan langsung — tidak ada skor yang dihasilkan otomatis
          oleh sistem. Benchmark per kompetensi (skala 0–100 pada framework, dikonversi ke skala 1–5) mengikuti
          definisi di masing-masing kerangka kerja (Ulrich, SKKNI, SFIA, Lominger, CGMA); lihat rujukan di atas tabel.
        </div>
      </div>

      {modalTarget && (
        <RatingModal
          employee={modalTarget.employee}
          competency={modalTarget.competency}
          current={ratings[ratingKey(modalTarget.employee.id, modalTarget.competency.id)]}
          onClose={() => setModalTarget(null)}
          onSave={handleSaveRating}
        />
      )}
    </AppShell>
  );
}
