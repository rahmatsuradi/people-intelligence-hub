"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, Button, Card, Icon, SvgPath } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow, PiPayrollLineRow, PiPayrollRunRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";

function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

interface PeriodSummary {
  period: string;
  employees: number;
  gross: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  pph21: number;
  net: number;
}

interface BpjsDetailRow {
  employeeName: string;
  department: string;
  bpjsWageBase: number | null; // null = baris lama, tersimpan sebelum field ini ada -- jangan menebak
  jhtEmployee: number;
  jhtEmployer: number;
  jpEmployee: number;
  jpEmployer: number;
  jkkEmployer: number;
  jkmEmployer: number;
  kesehatanEmployee: number;
  kesehatanEmployer: number;
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function LaporanPage() {
  const [summaries, setSummaries] = useState<PeriodSummary[] | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<BpjsDetailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setError("Supabase belum dikonfigurasi."); return; }
    setError(null);

    const runsRes = await supabase.from("pi_payroll_runs").select("*").eq("tenant_id", getActiveCompanyId()).order("period", { ascending: false });
    if (runsRes.error) { setError(runsRes.error.message); return; }
    const runs = (runsRes.data ?? []) as PiPayrollRunRow[];
    if (!runs.length) { setSummaries([]); return; }

    const linesRes = await supabase.from("pi_payroll_lines").select("*").in("run_id", runs.map((r) => r.id));
    if (linesRes.error) { setError(linesRes.error.message); return; }
    const lines = (linesRes.data ?? []) as PiPayrollLineRow[];

    const runById = new Map(runs.map((r) => [r.id, r]));
    const acc = new Map<string, PeriodSummary>();
    for (const line of lines) {
      const run = runById.get(line.run_id);
      if (!run) continue;
      const s = acc.get(run.period) ?? { period: run.period, employees: 0, gross: 0, bpjsEmployee: 0, bpjsEmployer: 0, pph21: 0, net: 0 };
      s.employees += 1;
      s.gross += Number(line.gross);
      s.bpjsEmployee += Number(line.bpjs_employee);
      s.bpjsEmployer += Number(line.bpjs_employer);
      s.pph21 += Number(line.pph21);
      s.net += Number(line.net);
      acc.set(run.period, s);
    }
    const list = Array.from(acc.values()).sort((a, b) => b.period.localeCompare(a.period));
    setSummaries(list);
    setSelectedPeriod((prev) => prev ?? list[0]?.period ?? null);
  }, []);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  const loadDetail = useCallback(async (period: string) => {
    if (!supabase) return;
    setDetailRows(null);

    const runRes = await supabase.from("pi_payroll_runs").select("*").eq("period", period).eq("tenant_id", getActiveCompanyId()).maybeSingle();
    if (runRes.error || !runRes.data) { setDetailRows([]); return; }

    const [linesRes, empRes] = await Promise.all([
      supabase.from("pi_payroll_lines").select("*").eq("run_id", runRes.data.id),
      supabase.from("pi_employees").select("*").eq("tenant_id", getActiveCompanyId()),
    ]);
    if (linesRes.error) { setError(linesRes.error.message); return; }
    if (empRes.error) { setError(empRes.error.message); return; }

    const empById = new Map((empRes.data as PiEmployeeRow[]).map((e) => [e.id, e]));
    const rows: BpjsDetailRow[] = (linesRes.data as PiPayrollLineRow[])
      .map((line) => {
        const emp = empById.get(line.employee_id);
        const bpjs = line.components?.bpjs;
        return {
          employeeName: emp?.full_name ?? line.employee_id,
          department: emp?.department ?? "—",
          bpjsWageBase: line.components?.bpjsWageBase ?? null,
          jhtEmployee: bpjs?.employee?.jht ?? 0,
          jhtEmployer: bpjs?.employer?.jht ?? 0,
          jpEmployee: bpjs?.employee?.jp ?? 0,
          jpEmployer: bpjs?.employer?.jp ?? 0,
          jkkEmployer: bpjs?.employer?.jkk ?? 0,
          jkmEmployer: bpjs?.employer?.jkm ?? 0,
          kesehatanEmployee: bpjs?.employee?.kesehatan ?? 0,
          kesehatanEmployer: bpjs?.employer?.kesehatan ?? 0,
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    setDetailRows(rows);
  }, []);

  useEffect(() => {
    if (selectedPeriod) loadDetail(selectedPeriod);
  }, [selectedPeriod, loadDetail]);

  const downloadCsv = useCallback(() => {
    if (!detailRows?.length || !selectedPeriod) return;
    const header = [
      "Nama", "Departemen", "Upah (basis BPJS)",
      "JHT Karyawan", "JHT Perusahaan", "JP Karyawan", "JP Perusahaan",
      "JKK Perusahaan", "JKM Perusahaan", "Kesehatan Karyawan", "Kesehatan Perusahaan",
    ];
    const rows = detailRows.map((r) => [
      r.employeeName, r.department, r.bpjsWageBase ?? "-",
      r.jhtEmployee, r.jhtEmployer, r.jpEmployee, r.jpEmployer,
      r.jkkEmployer, r.jkmEmployer, r.kesehatanEmployee, r.kesehatanEmployer,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }); // BOM agar Excel baca UTF-8 benar
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pelaporan-bpjs-${selectedPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [detailRows, selectedPeriod]);

  const missingWageBaseCount = (detailRows ?? []).filter((r) => r.bpjsWageBase === null).length;

  return (
    <AppShell
      activeNavId="laporan"
      title="Laporan Operasional"
      subtitle="Ringkasan payroll lintas periode, ekspor pelaporan BPJS & Cetak PDF"
    >
      {error && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 print:hidden">
          <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>
        </Card>
      )}

      {!error && (
        <Card padding={false} className="print:shadow-none print:border-none print:break-inside-avoid">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800 print:hidden">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Ringkasan per periode {summaries ? `(${summaries.length} periode tersimpan)` : ""}
            </p>
            <Button size="sm" variant="primary" onClick={() => window.print()}>
              <Icon className="h-3.5 w-3.5"><SvgPath name="document" /></Icon> Cetak Laporan
            </Button>
          </div>
          <div className="hidden print:block mb-4 px-5 pt-4">
            <h1 className="text-2xl font-bold text-slate-900">Laporan Pengeluaran Payroll</h1>
            <p className="text-sm text-slate-500">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Periode</th>
                  <th className="px-5 py-3 text-right font-medium">Karyawan</th>
                  <th className="px-5 py-3 text-right font-medium">Total Bruto</th>
                  <th className="px-5 py-3 text-right font-medium">BPJS Karyawan</th>
                  <th className="px-5 py-3 text-right font-medium">BPJS Perusahaan</th>
                  <th className="px-5 py-3 text-right font-medium">PPh 21</th>
                  <th className="px-5 py-3 text-right font-medium">Total Gaji Bersih</th>
                </tr>
              </thead>
              <tbody>
                {(summaries ?? []).map((s) => (
                  <tr
                    key={s.period}
                    onClick={() => setSelectedPeriod(s.period)}
                    className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40 ${
                      s.period === selectedPeriod ? "bg-blue-50/60 dark:bg-blue-500/10" : ""
                    }`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{s.period}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{s.employees}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(s.gross)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(s.bpjsEmployee)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(s.bpjsEmployer)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(s.pph21)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{rupiah(s.net)}</td>
                  </tr>
                ))}
                {summaries && summaries.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    Belum ada payroll tersimpan. Simpan run di halaman Payroll dulu.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!error && selectedPeriod && (
        <Card padding={false} className="print:shadow-none print:border-none print:break-before-page">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800 print:hidden">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Pelaporan BPJS — periode {selectedPeriod}
            </p>
            <Button size="sm" variant="secondary" onClick={downloadCsv} disabled={!detailRows?.length}>
              <Icon className="h-3.5 w-3.5"><SvgPath name="download" /></Icon> Unduh CSV
            </Button>
          </div>
          <div className="hidden print:block mb-4 px-5 pt-4">
            <h1 className="text-2xl font-bold text-slate-900">Laporan Rincian BPJS</h1>
            <p className="text-sm text-slate-500">Periode: {selectedPeriod}</p>
          </div>
          {missingWageBaseCount > 0 && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300 print:hidden">
              {missingWageBaseCount} baris tidak punya basis upah BPJS tercatat (tersimpan sebelum field ini ditambahkan) — kolom &quot;Upah&quot; tampil &quot;-&quot;, bukan ditebak.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Departemen</th>
                  <th className="px-5 py-3 text-right font-medium">Upah (basis)</th>
                  <th className="px-5 py-3 text-right font-medium">JHT Kry</th>
                  <th className="px-5 py-3 text-right font-medium">JHT Prsh</th>
                  <th className="px-5 py-3 text-right font-medium">JP Kry</th>
                  <th className="px-5 py-3 text-right font-medium">JP Prsh</th>
                  <th className="px-5 py-3 text-right font-medium">JKK Prsh</th>
                  <th className="px-5 py-3 text-right font-medium">JKM Prsh</th>
                  <th className="px-5 py-3 text-right font-medium">Kesehatan Kry</th>
                  <th className="px-5 py-3 text-right font-medium">Kesehatan Prsh</th>
                </tr>
              </thead>
              <tbody>
                {(detailRows ?? []).map((r) => (
                  <tr key={r.employeeName} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{r.employeeName}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{r.department}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{r.bpjsWageBase !== null ? rupiah(r.bpjsWageBase) : "-"}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jhtEmployee)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jhtEmployer)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jpEmployee)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jpEmployer)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jkkEmployer)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.jkmEmployer)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.kesehatanEmployee)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(r.kesehatanEmployer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
