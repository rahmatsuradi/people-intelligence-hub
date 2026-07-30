"use client";

import { AppShell, Icon, SvgPath, Card, cn } from "@/components/app-shell";
import { getCandidates, getJobReqs, type CandidateRecord, type JobRequisition } from "@/lib/store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function StatCard({ label, value, sub, colorClass = "text-slate-900 dark:text-white" }: {
  label: string; value: string | number; sub?: string; colorClass?: string;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums", colorClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export default function HiringAnalyticsPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [jobReqs, setJobReqs] = useState<JobRequisition[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setCandidates(getCandidates());
      setJobReqs(getJobReqs());
      setLoaded(true);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pi-company-change", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pi-company-change", refresh);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date().toISOString();

    // Time-to-hire: createdAt (applied) -> updatedAt (last touched, i.e. when
    // marked hired) for candidates currently in the "hired" stage. There's no
    // per-stage timestamp history in the data model, so this is an
    // application-to-hire proxy, not a stage-by-stage breakdown.
    const hired = candidates.filter((c) => c.stage === "hired");
    const timeToHireDays = hired.map((c) => daysBetween(c.createdAt, c.updatedAt));
    const avgTimeToHire = timeToHireDays.length > 0
      ? Math.round(timeToHireDays.reduce((s, d) => s + d, 0) / timeToHireDays.length)
      : 0;

    const activeReqs = jobReqs.filter((r) => r.status === "active");
    const totalHeadcountNeeded = activeReqs.reduce((s, r) => s + r.headcount, 0);
    const totalFilled = hired.length;
    const fillRate = totalHeadcountNeeded > 0 ? Math.round((totalFilled / (totalFilled + totalHeadcountNeeded)) * 100) : 0;

    // Requisition aging — how long each active req has been open, and how
    // many hires have landed against it so far.
    const reqAging = activeReqs
      .map((r) => {
        const filledForReq = candidates.filter((c) => c.jobReqId === r.id && c.stage === "hired").length;
        return {
          id: r.id,
          title: r.title,
          department: r.department || "—",
          hiringManager: r.hiringManager || "—",
          headcount: r.headcount,
          filled: filledForReq,
          daysOpen: daysBetween(r.createdAt, now),
        };
      })
      .sort((a, b) => b.daysOpen - a.daysOpen);

    // Time-to-hire by department (only departments with at least 1 hire)
    const deptMap = new Map<string, number[]>();
    for (const c of hired) {
      const d = c.department || "Lainnya";
      const arr = deptMap.get(d) ?? [];
      arr.push(daysBetween(c.createdAt, c.updatedAt));
      deptMap.set(d, arr);
    }
    const byDepartment = Array.from(deptMap.entries())
      .map(([name, days]) => ({
        name,
        avgDays: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        count: days.length,
      }))
      .sort((a, b) => b.avgDays - a.avgDays);
    const maxDeptDays = Math.max(...byDepartment.map((d) => d.avgDays), 1);

    return {
      totalCandidates: candidates.length,
      activeReqCount: activeReqs.length,
      totalHeadcountNeeded,
      totalFilled,
      fillRate,
      avgTimeToHire,
      hiredCount: hired.length,
      reqAging,
      byDepartment,
      maxDeptDays,
    };
  }, [candidates, jobReqs]);

  if (!loaded) {
    return (
      <AppShell activeNavId="hiring-analytics" title="Hiring Analytics" subtitle="Efisiensi & kecepatan proses rekrutmen">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (stats.activeReqCount === 0 && stats.totalCandidates === 0) {
    return (
      <AppShell activeNavId="hiring-analytics" title="Hiring Analytics" subtitle="Efisiensi & kecepatan proses rekrutmen">
        <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
          <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
          <p className="mt-4 font-medium text-slate-900 dark:text-white">Belum ada data rekrutmen</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Buat requisition di <Link href="/roles" className="text-blue-600 hover:underline dark:text-blue-400">Open Roles</Link> dan
            {" "}tambah kandidat di <Link href="/candidates" className="text-blue-600 hover:underline dark:text-blue-400">Candidates</Link> untuk mulai melihat metrik di sini.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="hiring-analytics" title="Hiring Analytics" subtitle="Efisiensi & kecepatan proses rekrutmen — dihitung dari data requisition & kandidat aktif">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Posisi Terbuka" value={stats.activeReqCount} sub={`${stats.totalHeadcountNeeded} headcount dibutuhkan`} />
          <StatCard
            label="Rata-rata Time-to-Hire"
            value={stats.avgTimeToHire > 0 ? `${stats.avgTimeToHire} hari` : "—"}
            sub={stats.hiredCount > 0 ? `Dari ${stats.hiredCount} kandidat yang sudah di-hire` : "Belum ada kandidat hired"}
            colorClass="text-blue-600 dark:text-blue-400"
          />
          <StatCard label="Total Hired" value={stats.hiredCount} sub="Sepanjang waktu" colorClass="text-emerald-600 dark:text-emerald-400" />
          <StatCard
            label="Fill Rate"
            value={`${stats.fillRate}%`}
            sub="Hired vs (hired + kebutuhan headcount terbuka)"
            colorClass="text-violet-600 dark:text-violet-400"
          />
        </div>

        {/* Requisition Aging */}
        <Card padding={false} className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Usia Requisition Terbuka</h2>
            <p className="mt-0.5 text-sm text-slate-500">Sudah berapa lama posisi ini dibuka, diurutkan dari yang paling lama</p>
          </div>
          {stats.reqAging.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Tidak ada requisition aktif.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                    <th className="px-5 py-2.5 font-medium">Posisi</th>
                    <th className="px-5 py-2.5 font-medium">Departemen</th>
                    <th className="px-5 py-2.5 font-medium">Hiring Manager</th>
                    <th className="px-5 py-2.5 text-right font-medium">Terisi / Dibutuhkan</th>
                    <th className="px-5 py-2.5 text-right font-medium">Usia (hari)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.reqAging.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{r.title}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{r.department}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{r.hiringManager.replace(/^Demo:/, "")}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{r.filled} / {r.headcount}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn(
                          "rounded px-2 py-0.5 text-xs font-semibold tabular-nums",
                          r.daysOpen > 45 ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                            : r.daysOpen > 21 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                        )}>
                          {r.daysOpen} hari
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Time-to-hire by department */}
        <Card>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Time-to-Hire per Departemen</h2>
          <p className="mt-0.5 text-sm text-slate-500">Rata-rata hari dari kandidat dibuat sampai berstatus hired</p>
          {stats.byDepartment.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Belum ada kandidat yang hired untuk dihitung.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {stats.byDepartment.map((d) => (
                <div key={d.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{d.name}</span>
                    <span className="tabular-nums text-slate-500">{d.avgDays} hari · {d.count} hire</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.max((d.avgDays / stats.maxDeptDays) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Catatan metodologi:</span>{" "}
          Time-to-hire dihitung dari selisih <em>createdAt</em> (kandidat masuk pipeline) ke <em>updatedAt</em> (terakhir
          diubah) pada kandidat berstatus hired — proxy aplikasi-ke-hire, bukan breakdown per tahap karena data tidak
          menyimpan riwayat waktu per tahap. Cost-per-hire belum ditampilkan karena platform belum melacak biaya
          rekrutmen per posisi.
        </div>
      </div>
    </AppShell>
  );
}
