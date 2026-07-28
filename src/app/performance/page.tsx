"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Icon, SvgPath, Button, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { getReviews, getReview, saveReview } from "@/lib/performance/store";
import type { PerformanceReview } from "@/lib/performance/types";
import ReviewModal from "./review-modal"; // I will create this next

export default function PerformancePage() {
  const [employees, setEmployees] = useState<PiEmployeeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [activeReviewFor, setActiveReviewFor] = useState<PiEmployeeRow | null>(null);

  const period = "2026-H1"; // Hardcoded for demo

  const fetchEmployees = async () => {
    setError(null);
    const activeCompId = getActiveCompanyId();
    let emps: PiEmployeeRow[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error: err } = await supabase.from("pi_employees").select("*").eq("status", "active").eq("tenant_id", activeCompId).order("full_name");
      if (!err && data && data.length > 0) {
        emps = data as PiEmployeeRow[];
      }
    }
    if (emps.length === 0) {
      emps = getActiveCompanyEmployees() as unknown as PiEmployeeRow[];
    }
    setEmployees(emps);
    setReviews(getReviews());
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSaveReview = (review: PerformanceReview) => {
    saveReview(review);
    setReviews(getReviews()); // refresh
    setActiveReviewFor(null);
  };

  // 9-box computation
  const nineBox = useMemo(() => {
    if (!employees) return [];
    return employees.map(emp => {
      const rev = reviews.find(r => r.employeeId === emp.id && r.period === period);
      // 0 means unreviewed / not yet assessed
      let x = 0, y = 0; 
      if (rev?.aiInsight) {
        const perf = rev.aiInsight.performanceScore;
        const pot = rev.aiInsight.potentialScore;
        x = perf > 75 ? 3 : perf > 40 ? 2 : 1;
        y = pot > 75 ? 3 : pot > 40 ? 2 : 1;
      } else if (rev?.status === "submitted" || rev?.status === "analyzed") {
        const avg = rev.kpis.reduce((a, b) => a + b.score, 0) / (rev.kpis.length || 1);
        x = avg > 3.5 ? 3 : avg >= 2.5 ? 2 : 1;
        y = 2; // assume medium potential without AI
      }
      return { ...emp, x, y, rev };
    });
  }, [employees, reviews, period]);

  // Group into the 9 boxes
  const matrix = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => [] as typeof nineBox));
  const unreviewedCount = nineBox.filter(item => item.x === 0 || item.y === 0).length;
  const reviewedCount = nineBox.length - unreviewedCount;

  nineBox.forEach(item => {
    if (item.x === 0 || item.y === 0) return; // Do not place unreviewed employees in the 9-box!
    const row = 3 - item.y;
    const col = item.x - 1;
    if (row >= 0 && row <= 2 && col >= 0 && col <= 2) {
      matrix[row][col].push(item);
    }
  });

  const getBoxColor = (r: number, c: number) => {
    if (r === 0 && c === 2) return "bg-emerald-100/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"; // Star
    if (r === 2 && c === 0) return "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900"; // Underperformer
    if (r + (2 - c) <= 2) return "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30"; // Good
    return "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800"; // Average
  };

  const getBoxLabel = (r: number, c: number) => {
    if (r===0 && c===0) return "Enigma (High Pot, Low Perf)";
    if (r===0 && c===1) return "Growth Employee (High Pot, Med Perf)";
    if (r===0 && c===2) return "Future Leader (High Pot, High Perf)";
    if (r===1 && c===0) return "Dilemma (Med Pot, Low Perf)";
    if (r===1 && c===1) return "Core Employee (Med Pot, Med Perf)";
    if (r===1 && c===2) return "High Performer (Med Pot, High Perf)";
    if (r===2 && c===0) return "Underperformer (Low Pot, Low Perf)";
    if (r===2 && c===1) return "Effective (Low Pot, Med Perf)";
    if (r===2 && c===2) return "Trusted Pro (Low Pot, High Perf)";
    return "";
  };

  return (
    <AppShell activeNavId="performance" title="Performance & Competency Review" subtitle={`Periode: ${period}`}>
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {!error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Status Evaluasi Periode {period}: {reviewedCount} Karyawan Dipetakan | <span className="text-amber-600 dark:text-amber-400 font-bold">{unreviewedCount} Belum Dinilai</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500">Klik tombol Review di tabel kanan atau klik ikon karyawan di dalam kotak matrix.</span>
            </div>

            <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">9-Box Talent Matrix (SKKNI & KPI Mapping)</h2>
            <div className="grid grid-cols-3 gap-3">
              {matrix.map((row, r) => 
                row.map((cell, c) => (
                  <div key={`${r}-${c}`} className={cn("min-h-[120px] rounded-xl border p-3 flex flex-col transition-all hover:shadow-md", getBoxColor(r, c))}>
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mb-2">{getBoxLabel(r, c)}</p>
                    <div className="flex-1 flex flex-wrap gap-1.5 content-start">
                      {cell.map(emp => (
                        <div 
                          key={emp.id} 
                          onClick={() => setActiveReviewFor(emp)}
                          title={`${emp.full_name} — Klik untuk lihat evaluasi`} 
                          className="h-7 w-7 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 text-xs font-bold ring-2 ring-white dark:ring-slate-950 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                        >
                          {emp.full_name.substring(0,2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400 px-2 mt-1">
              <span>Low Performance (KPI &lt; 40%)</span>
              <span>Medium Performance (40% - 75%)</span>
              <span>High Performance (&gt; 75%)</span>
            </div>
          </div>

          <Card padding={false} className="flex flex-col h-[520px] shadow-lg border-slate-200/80 dark:border-slate-800">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Daftar Karyawan ({employees?.length || 0})</h3>
              <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">Pilih untuk Dinilai</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {!employees ? (
                <p className="p-3 text-sm text-slate-500">Memuat...</p>
              ) : employees.map(emp => {
                const rev = reviews.find(r => r.employeeId === emp.id && r.period === period);
                const isAnalyzed = rev?.status === "analyzed" || rev?.status === "submitted";
                return (
                  <div key={emp.id} className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg group transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{emp.full_name}</p>
                        {isAnalyzed ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Dipetakan
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-400">
                            Belum Review
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{emp.department ?? "No Dept"}</p>
                    </div>
                    <Button size="sm" variant={isAnalyzed ? "secondary" : "primary"} onClick={() => setActiveReviewFor(emp)}>
                      {isAnalyzed ? "Lihat Hasil" : "Mulai Review"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {activeReviewFor && (
        <ReviewModal
          employee={activeReviewFor}
          period={period}
          existingReview={reviews.find(r => r.employeeId === activeReviewFor.id && r.period === period)}
          onSave={handleSaveReview}
          onClose={() => setActiveReviewFor(null)}
        />
      )}
    </AppShell>
  );
}
