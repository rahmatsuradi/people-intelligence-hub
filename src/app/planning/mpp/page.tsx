"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Card, Button } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { getJobReqs } from "@/lib/store";

/*
  Manpower Planning — dihitung dari data nyata:
  - Actual headcount per divisi: pi_employees (tenant aktif; fallback data demo lokal)
  - Open vacancies per divisi: job requisition berstatus "active" (modul Open Roles)
  - Approved plan = actual + lowongan yang disetujui (definisi perencanaan sederhana)
*/

interface DeptRow {
  department: string;
  actual: number;
  openings: number;
}

export default function MPPPage() {
  const router = useRouter();
  const [empDepts, setEmpDepts] = useState<{ department: string | null }[] | null>(null);
  const [openings, setOpenings] = useState<{ department: string; headcount: number }[]>([]);

  useEffect(() => {
    // Lowongan aktif dari store yang sama dengan halaman Open Roles
    const reqs = getJobReqs().filter((r) => r.status === "active");
    setOpenings(reqs.map((r) => ({ department: r.department, headcount: r.headcount || 1 })));

    async function load() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase
            .from("pi_employees")
            .select("department")
            .eq("status", "active")
            .eq("tenant_id", getActiveCompanyId());
          if (data && data.length > 0) {
            setEmpDepts(data);
            return;
          }
        }
        setEmpDepts(getActiveCompanyEmployees().map((e: { department?: string }) => ({ department: e.department ?? null })));
      } catch {
        setEmpDepts(getActiveCompanyEmployees().map((e: { department?: string }) => ({ department: e.department ?? null })));
      }
    }
    load();
  }, []);

  const rows = useMemo<DeptRow[]>(() => {
    const map = new Map<string, DeptRow>();
    for (const e of empDepts ?? []) {
      const dept = e.department || "Lainnya";
      const row = map.get(dept) ?? { department: dept, actual: 0, openings: 0 };
      row.actual += 1;
      map.set(dept, row);
    }
    for (const o of openings) {
      const dept = o.department || "Lainnya";
      const row = map.get(dept) ?? { department: dept, actual: 0, openings: 0 };
      row.openings += o.headcount;
      map.set(dept, row);
    }
    return [...map.values()].sort((a, b) => b.actual - a.actual);
  }, [empDepts, openings]);

  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalOpenings = rows.reduce((s, r) => s + r.openings, 0);
  const totalApproved = totalActual + totalOpenings;
  const fulfillmentPct = totalApproved > 0 ? Math.round((totalActual / totalApproved) * 100) : 0;
  const loading = empDepts === null;

  return (
    <AppShell activeNavId="mpp" title="Manpower Planning (MPP)">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manpower Planning</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gap headcount aktual vs rencana — dihitung dari data karyawan & lowongan aktif.
            </p>
          </div>
          <Button variant="primary" onClick={() => router.push("/roles")}>
            + Ajukan Kebutuhan Baru
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Total Rencana Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : totalApproved}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">aktual + lowongan disetujui</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Current Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{loading ? "—" : totalActual}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">karyawan aktif tenant ini</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Open Vacancies</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">{totalOpenings}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">dari lowongan berstatus aktif</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Fulfillment Rate</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{loading ? "—" : `${fulfillmentPct}%`}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">aktual ÷ rencana</p>
          </Card>
        </div>

        <Card className="overflow-hidden" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-slate-900 dark:bg-slate-800/50 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Department / Divisi</th>
                  <th className="px-6 py-4 font-semibold">Rencana</th>
                  <th className="px-6 py-4 font-semibold">Actual</th>
                  <th className="px-6 py-4 font-semibold">Gap</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">Memuat data karyawan…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      Belum ada data karyawan atau lowongan untuk tenant ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const plan = row.actual + row.openings;
                    const gap = row.actual - plan; // negatif = masih kekurangan orang
                    return (
                      <tr key={row.department}>
                        <td className="px-6 py-4 font-medium">{row.department}</td>
                        <td className="px-6 py-4">{plan}</td>
                        <td className="px-6 py-4">{row.actual}</td>
                        <td className={`px-6 py-4 font-medium ${gap < 0 ? "text-red-500" : "text-slate-400"}`}>
                          {gap === 0 ? "0" : gap}
                        </td>
                        <td className="px-6 py-4">
                          {row.openings > 0 ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                              Hiring in Progress ({row.openings} posisi)
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              Fulfilled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
