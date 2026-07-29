"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Card, Button, inputClass } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { getHeadcountBudget, setHeadcountBudget } from "@/lib/planning/mpp-store";

interface DeptRow {
  department: string;
  current: number;
  approved: number;
}

export default function MPPPage() {
  const router = useRouter();
  const [currentByDept, setCurrentByDept] = useState<Record<string, number>>({});
  const [budget, setBudget] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const compId = getActiveCompanyId();

    const applyEmps = (emps: { department?: string | null }[]) => {
      const counts: Record<string, number> = {};
      for (const e of emps) {
        const dept = e.department || "Tanpa Departemen";
        counts[dept] = (counts[dept] || 0) + 1;
      }
      setCurrentByDept(counts);
      setBudget(getHeadcountBudget(compId));
      setLoaded(true);
    };

    if (isSupabaseConfigured && supabase) {
      supabase.from("pi_employees").select("department").eq("status", "active").eq("tenant_id", compId)
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            applyEmps(data as { department: string | null }[]);
          } else {
            applyEmps(getActiveCompanyEmployees());
          }
        });
    } else {
      applyEmps(getActiveCompanyEmployees());
    }
  }, []);

  const rows: DeptRow[] = useMemo(() => {
    return Object.entries(currentByDept)
      .map(([department, current]) => ({
        department,
        current,
        approved: budget[department] ?? current,
      }))
      .sort((a, b) => b.current - a.current);
  }, [currentByDept, budget]);

  const totalApproved = rows.reduce((s, r) => s + r.approved, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);
  const totalGap = totalApproved - totalCurrent;
  const deptsNeedingHire = rows.filter((r) => r.approved > r.current).length;

  const handleApprovedChange = (department: string, value: number) => {
    const compId = getActiveCompanyId();
    setHeadcountBudget(compId, department, value);
    setBudget((prev) => ({ ...prev, [department]: value }));
  };

  return (
    <AppShell activeNavId="mpp" title="Manpower Planning (MPP)">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manpower Planning</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Headcount aktual per departemen (data karyawan) vs. target yang Anda tetapkan sendiri.
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push("/roles")}>
            + Ajukan Kebutuhan Baru
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Total Target Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loaded ? totalApproved : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Diedit manual per departemen di tabel</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Current Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loaded ? totalCurrent : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">Karyawan aktif, dari data payroll</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Gap Total</p>
            <p className={`mt-2 text-2xl font-bold ${totalGap > 0 ? "text-blue-600" : totalGap < 0 ? "text-red-500" : "text-slate-900 dark:text-white"}`}>
              {loaded ? (totalGap > 0 ? `+${totalGap}` : totalGap) : "—"}
            </p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Departemen Perlu Rekrutmen</p>
            <p className="mt-2 text-2xl font-bold text-red-500">{loaded ? deptsNeedingHire : "—"}</p>
          </Card>
        </div>

        <Card className="overflow-hidden" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-slate-900 dark:bg-slate-800/50 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Current</th>
                  <th className="px-6 py-4 font-semibold">Target (bisa diedit)</th>
                  <th className="px-6 py-4 font-semibold">Gap</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {!loaded && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Memuat data karyawan...</td></tr>
                )}
                {loaded && rows.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Belum ada data karyawan aktif untuk perusahaan ini.</td></tr>
                )}
                {rows.map((r) => {
                  const gap = r.approved - r.current;
                  return (
                    <tr key={r.department}>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{r.department}</td>
                      <td className="px-6 py-4">{r.current}</td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min={0}
                          value={r.approved}
                          onChange={(e) => handleApprovedChange(r.department, Math.max(0, Number(e.target.value) || 0))}
                          className={`${inputClass} w-24`}
                        />
                      </td>
                      <td className={`px-6 py-4 font-medium ${gap > 0 ? "text-blue-600" : gap < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {gap > 0 ? `+${gap}` : gap}
                      </td>
                      <td className="px-6 py-4">
                        {gap === 0 && (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Sesuai Target</span>
                        )}
                        {gap > 0 && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Perlu Rekrutmen ({gap})</span>
                        )}
                        {gap < 0 && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Melebihi Target ({-gap})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
