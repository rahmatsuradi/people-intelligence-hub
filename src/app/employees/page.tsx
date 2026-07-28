"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { maskNik, maskNpwp, maskBankAccount } from "@/lib/payroll/payslip-masking";
import type { PiEmployeeRow, PiCompensationRow } from "@/lib/payroll/pay-data";
import { ensureDemoEmployeesExist, isStatutoryEnabled, setStatutoryToggle, getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { ALL_COMPANIES, getActiveCompanyId, getActiveCompanyProfile } from "@/lib/payroll/company-profile";
import { getCandidate } from "@/lib/store";
import { getReviews } from "@/lib/performance/store";
import type { PerformanceReview } from "@/lib/performance/types";

function rupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

function computeGross(c: { upah_pokok: number; tunjangan_tetap: { amount: number }[]; tunjangan_tidak_tetap: { amount: number }[] }): number {
  const tetap = (c.tunjangan_tetap ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const tidakTetap = (c.tunjangan_tidak_tetap ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
  return c.upah_pokok + tetap + tidakTetap;
}

function latestReviewFor(employeeId: string): PerformanceReview | null {
  const reviews = getReviews().filter((r) => r.employeeId === employeeId);
  if (reviews.length === 0) return null;
  return reviews.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
}

function reviewAverageScore(review: PerformanceReview): number | null {
  const scores = [...review.kpis.map((k) => k.score), ...review.competencies.map((c) => c.score)];
  if (scores.length === 0) return null;
  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

interface EmployeeView extends PiEmployeeRow {
  upahPokok: number;
  gross: number;
}

export default function CoreEmployeesPage() {
  const [rows, setRows] = useState<EmployeeView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglesVersion, setTogglesVersion] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => getActiveCompanyId());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedEmpTypeFilter, setSelectedEmpTypeFilter] = useState<string>("ALL");

  // Add Employee Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNik, setFormNik] = useState("");
  const [formNpwp, setFormNpwp] = useState("");
  const [formDept, setFormDept] = useState("Redaksi");
  const [formEmpType, setFormEmpType] = useState<string>("Kontrak");
  const [formPtkp, setFormPtkp] = useState("TK/0");
  const [formBank, setFormBank] = useState("");
  const [formUpah, setFormUpah] = useState("10000000");
  const [formStatutory, setFormStatutory] = useState(true);

  // Employee Detail Drawer State
  const [selectedEmpDetail, setSelectedEmpDetail] = useState<EmployeeView | null>(null);
  const [activeEmpTab, setActiveEmpTab] = useState<"profile" | "payroll" | "hrbp" | "ats">("profile");

  const fetchEmployees = useCallback(async () => {
    setError(null);
    const activeCompId = getActiveCompanyId();
    try {
      if (isSupabaseConfigured && supabase) {
        await ensureDemoEmployeesExist(supabase);
        const [emp, comp] = await Promise.all([
          supabase.from("pi_employees").select("*").eq("status", "active").eq("tenant_id", activeCompId).order("full_name"),
          supabase.from("pi_compensation").select("*"),
        ]);
        if (!emp.error && !comp.error && (emp.data ?? []).length > 0) {
          const compByEmp = new Map<string, PiCompensationRow>((comp.data ?? []).map((c) => [c.employee_id, c]));
          const view: EmployeeView[] = (emp.data ?? []).map((e: PiEmployeeRow) => {
            const c = compByEmp.get(e.id);
            const compensation = {
              upah_pokok: Number(c?.upah_pokok ?? 0),
              tunjangan_tetap: c?.tunjangan_tetap ?? [],
              tunjangan_tidak_tetap: c?.tunjangan_tidak_tetap ?? [],
            };
            return { ...e, upahPokok: compensation.upah_pokok, gross: computeGross(compensation) };
          });
          setRows(view);
          return;
        }
      }
      // Offline fallback:
      const rawEmps = getActiveCompanyEmployees();
      const view: EmployeeView[] = rawEmps.map((e: any) => ({
        ...e,
        upahPokok: e.upah_pokok,
        gross: e.upah_pokok
      }));
      setRows(view);
    } catch (err: any) {
      console.error(err);
      const rawEmps = getActiveCompanyEmployees();
      setRows(rawEmps.map((e: any) => ({ ...e, upahPokok: e.upah_pokok, gross: e.upah_pokok })));
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const newId = `e1000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
      const tenantId = rows?.[0]?.tenant_id || "11111111-1111-4111-8111-111111111111";

      if (supabase) {
        await supabase.from("pi_employees").insert({
          id: newId,
          tenant_id: tenantId,
          full_name: formName.trim(),
          nik: formNik.trim() || null,
          npwp: formNpwp.trim() || null,
          ptkp_status: formPtkp,
          join_date: new Date().toISOString().slice(0, 10),
          employment_type: formEmpType,
          risk_class: "I",
          department: formDept.trim() || "Umum",
          bank_account: formBank.trim() || null,
          status: "active",
        });

        await supabase.from("pi_compensation").insert({
          employee_id: newId,
          upah_pokok: Number(formUpah) || 0,
          tunjangan_tetap: [],
          tunjangan_tidak_tetap: [],
          effective_date: "2026-01-01",
        });
      }

      setStatutoryToggle(newId, formStatutory);
      setTogglesVersion((v) => v + 1);

      setShowAddModal(false);
      setFormName("");
      setFormNik("");
      setFormNpwp("");
      setFormBank("");
      setFormUpah("10000000");
      await fetchEmployees();
    } catch (err: any) {
      alert("Gagal menambahkan karyawan: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const currentCompany = useMemo(() => {
    return ALL_COMPANIES.find((c) => c.id === selectedCompanyId) || ALL_COMPANIES[0];
  }, [selectedCompanyId]);

  const companyRows = useMemo(() => {
    return rows || [];
  }, [rows]);

  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    companyRows.forEach((r) => { if (r.department) depts.add(r.department); });
    return Array.from(depts);
  }, [companyRows]);

  const filteredRows = useMemo(() => {
    return companyRows.filter((r) => {
      const matchesSearch =
        r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.position && r.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.nik && r.nik.includes(searchQuery));
      const matchesDept = selectedDepartment === "ALL" || r.department === selectedDepartment;
      const matchesEmpType = selectedEmpTypeFilter === "ALL" ||
        (selectedEmpTypeFilter === "PKWTT" && (r.employment_type.includes("Tetap") || r.employment_type === "PKWTT")) ||
        (selectedEmpTypeFilter === "PKWT" && (r.employment_type.includes("Kontrak") || r.employment_type === "PKWT"));
      return matchesSearch && matchesDept && matchesEmpType;
    });
  }, [companyRows, searchQuery, selectedDepartment, selectedEmpTypeFilter]);

  const totalGross = useMemo(() => (filteredRows ?? []).reduce((s, r) => s + r.gross, 0), [filteredRows]);
  const totalKontrak = useMemo(() => (filteredRows ?? []).filter((r) => r.employment_type.includes("Kontrak") || r.employment_type === "PKWT").length, [filteredRows]);
  const totalTetap = useMemo(() => (filteredRows ?? []).filter((r) => r.employment_type.includes("Tetap") || r.employment_type === "PKWTT").length, [filteredRows]);

  return (
    <AppShell
      activeNavId="employees"
      title="Pusat Data Karyawan"
      subtitle="Master Data SDM Utama Perusahaan — Terhubung ke Absensi, Performance & Payroll"
    >
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {!error && (
        <div className="space-y-6">
          {/* Company Info Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentCompany.industry === "broadcast" ? "📺" : "🧵"}</span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white">{currentCompany.name}</h2>
                <p className="text-xs text-slate-400">{currentCompany.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 border border-slate-700/60">
              <span className="font-semibold text-blue-400">{currentCompany.signerTitle}:</span> {currentCompany.signerName}
            </div>
          </div>

          {/* Quick Metrics Header */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-600 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Karyawan Aktif</p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{filteredRows.length} <span className="text-xs font-normal text-slate-500">orang</span></p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Icon className="h-6 w-6"><SvgPath name="users" /></Icon>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Gaji Bruto / Bulan</p>
                  <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">{rupiah(totalGross)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Icon className="h-6 w-6"><SvgPath name="chart" /></Icon>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Status Kepegawaian</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{totalKontrak}</span> Kontrak &bull; <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalTetap}</span> Tetap/Profesional
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Icon className="h-6 w-6"><SvgPath name="document" /></Icon>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-amber-500 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jumlah Divisi / Unit</p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{departmentsList.length} <span className="text-xs font-normal text-slate-500">divisi</span></p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <Icon className="h-6 w-6"><SvgPath name="briefcase" /></Icon>
                </div>
              </div>
            </Card>
          </div>

          {/* Controls Bar & Filter */}
          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative min-w-[240px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, NIK, divisi..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="pointer-events-none absolute left-3 top-2.5 text-slate-400">
                    <Icon className="h-4 w-4"><SvgPath name="search" /></Icon>
                  </div>
                </div>

                {/* Filter Department */}
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Semua Divisi ({departmentsList.length})</option>
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                {/* Filter Status Kepegawaian */}
                <select
                  value={selectedEmpTypeFilter}
                  onChange={(e) => setSelectedEmpTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Semua Status (PKWTT/PKWT)</option>
                  <option value="PKWTT">PKWTT (Tetap)</option>
                  <option value="PKWT">PKWT (Kontrak)</option>
                </select>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => setShowAddModal(true)}
                className="gap-1.5 font-bold shadow-md shadow-blue-500/20"
              >
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                + Tambah Karyawan Baru
              </Button>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-5 py-3.5 font-bold">Nama Karyawan</th>
                    <th className="px-5 py-3.5 font-bold">Jabatan / Posisi</th>
                    <th className="px-5 py-3.5 font-bold">Divisi / Unit Kerja</th>
                    <th className="px-5 py-3.5 font-bold">Status</th>
                    <th className="px-5 py-3.5 font-bold">PTKP</th>
                    <th className="px-5 py-3.5 text-center font-bold">Statutori (Pajak/BPJS)</th>
                    <th className="px-5 py-3.5 font-bold">NPWP</th>
                    <th className="px-5 py-3.5 text-right font-bold">Upah Pokok</th>
                    <th className="px-5 py-3.5 text-right font-bold">Total Bruto</th>
                    <th className="px-5 py-3.5 text-center font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 dark:border-slate-800/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => { setSelectedEmpDetail(r); setActiveEmpTab("profile"); }}
                          className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left"
                        >
                          {r.full_name}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200 font-bold">{r.position ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300 font-medium">{r.department ?? "—"}</td>
                      <td className="px-5 py-4">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-bold",
                          r.employment_type.includes("Tetap") || r.employment_type === "PKWTT"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300")}>
                          {r.employment_type === "PKWTT" || r.employment_type === "PKWT" ? "Kontrak Kerja" : r.employment_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-slate-600 dark:text-slate-400 font-semibold">{r.ptkp_status}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const current = isStatutoryEnabled(r.id, r.full_name);
                            setStatutoryToggle(r.id, !current);
                            setTogglesVersion((v) => v + 1);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-sm",
                            isStatutoryEnabled(r.id, r.full_name)
                              ? "bg-emerald-500 text-white hover:bg-emerald-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                          )}
                          title="Klik untuk mengubah status hitungan BPJS & PPh 21"
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", isStatutoryEnabled(r.id, r.full_name) ? "bg-white" : "bg-slate-400")} />
                          {isStatutoryEnabled(r.id, r.full_name) ? "ON (Dipotong)" : "OFF (Rp 0)"}
                        </button>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{maskNpwp(r.npwp)}</td>
                      <td className="px-5 py-4 text-right tabular-nums text-slate-700 dark:text-slate-300 font-medium">{rupiah(r.upahPokok)}</td>
                      <td className="px-5 py-4 text-right font-black tabular-nums text-slate-900 dark:text-white">{rupiah(r.gross)}</td>
                      <td className="px-5 py-4 text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setSelectedEmpDetail(r); setActiveEmpTab("profile"); }}
                          className="h-8 px-2.5 text-xs"
                        >
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                        <Icon className="mx-auto mb-2 h-8 w-8 opacity-40"><SvgPath name="users" /></Icon>
                        Tidak ditemukan data karyawan sesuai pencarian/filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Detail Employee Modal/Drawer */}
      {selectedEmpDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setSelectedEmpDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{selectedEmpDetail.full_name}</h3>
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedEmpDetail.position || selectedEmpDetail.department} <span className="text-slate-400 font-normal">•</span> <span className="text-slate-600 dark:text-slate-300">{selectedEmpDetail.department}</span></p>
              </div>
              <button type="button" onClick={() => setSelectedEmpDetail(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
              </button>
            </div>

            {/* Navigation Tabs for Individual Talent Profile */}
            <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveEmpTab("profile")}
                className={cn("flex-1 rounded-lg py-2 transition-all", activeEmpTab === "profile" ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
              >
                👤 Profil
              </button>
              <button
                type="button"
                onClick={() => setActiveEmpTab("payroll")}
                className={cn("flex-1 rounded-lg py-2 transition-all", activeEmpTab === "payroll" ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-900 dark:text-emerald-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
              >
                💰 Slip Gaji
              </button>
              <button
                type="button"
                onClick={() => setActiveEmpTab("hrbp")}
                className={cn("flex-1 rounded-lg py-2 transition-all", activeEmpTab === "hrbp" ? "bg-white text-purple-600 shadow-sm dark:bg-slate-900 dark:text-purple-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
              >
                📈 HRBP KPI
              </button>
              <button
                type="button"
                onClick={() => setActiveEmpTab("ats")}
                className={cn("flex-1 rounded-lg py-2 transition-all", activeEmpTab === "ats" ? "bg-white text-amber-600 shadow-sm dark:bg-slate-900 dark:text-amber-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400")}
              >
                🎯 Jejak ATS
              </button>
            </div>

            {activeEmpTab === "profile" && (
              <div className="mt-4 space-y-3 text-xs animate-in fade-in-50 duration-200">
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Nomor Induk (NIK)</span>
                  <span className="font-bold text-slate-900 dark:text-white">{maskNik(selectedEmpDetail.nik)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Nomor NPWP</span>
                  <span className="font-bold text-slate-900 dark:text-white">{maskNpwp(selectedEmpDetail.npwp)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Status Kepegawaian</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedEmpDetail.employment_type}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Status PTKP</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedEmpDetail.ptkp_status}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Rekening Transfer</span>
                  <span className="font-bold text-slate-900 dark:text-white">{maskBankAccount(selectedEmpDetail.bank_account)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="text-slate-500">Upah Pokok</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{rupiah(selectedEmpDetail.upahPokok)}</span>
                </div>
              </div>
            )}

            {activeEmpTab === "payroll" && (
              <div className="mt-4 space-y-3.5 text-xs animate-in fade-in-50 duration-200">
                <div className="rounded-xl bg-emerald-50/60 p-3.5 border border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-bold text-emerald-900 dark:text-emerald-300">Upah Pokok & Tunjangan Tetap</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">{rupiah(selectedEmpDetail.upahPokok)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ini adalah komponen gaji tetap saja. PPh 21, BPJS, dan Take Home Pay yang akurat memerlukan konfigurasi PTKP, lembur, dan tarif statutori penuh — hitung di Payroll Engine, bukan estimasi di sini.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">
                    💡 Slip gaji resmi di-generate oleh mesin payroll berstandar UU HPP / PP 35 dengan integrasi absensi dan lembur.
                  </p>
                  <a
                    href="/pay/payroll"
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 text-xs shadow-md transition-all"
                  >
                    <span>🚀 Buka Portal Payroll Engine Resmi</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            )}

            {activeEmpTab === "hrbp" && (() => {
              const review = latestReviewFor(selectedEmpDetail.id);
              const avgScore = review ? reviewAverageScore(review) : null;
              return (
                <div className="mt-4 space-y-3.5 text-xs animate-in fade-in-50 duration-200">
                  {review ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl bg-purple-50 p-3 border border-purple-200/80 dark:bg-purple-950/20 dark:border-purple-800/60">
                          <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block mb-1">Skor Rata-rata (KPI & Kompetensi)</span>
                          <span className="text-xl font-black text-purple-900 dark:text-purple-200">{avgScore !== null ? avgScore.toFixed(1) : "—"} <span className="text-xs font-normal text-purple-600">/ 5</span></span>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Periode {review.period} · {review.status}</span>
                        </div>
                        <div className="rounded-xl bg-blue-50 p-3 border border-blue-200/80 dark:bg-blue-950/20 dark:border-blue-800/60">
                          <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block mb-1">Skor Potensi (AI Insight)</span>
                          <span className="text-xl font-black text-blue-900 dark:text-blue-200">{review.aiInsight ? review.aiInsight.potentialScore : "—"}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{review.aiInsight ? "Dari analisis insight" : "Belum dianalisis"}</span>
                        </div>
                      </div>
                      {review.aiInsight && (
                        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                          <div className="font-bold text-slate-900 dark:text-white mb-1">Ringkasan Insight:</div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{review.aiInsight.actionPlan}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Belum ada evaluasi kinerja tercatat untuk karyawan ini.</p>
                    </div>
                  )}
                  <a
                    href="/performance"
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 text-xs shadow-md transition-all"
                  >
                    <span>📊 {review ? "Lihat / Perbarui" : "Buat"} Evaluasi di Modul Kinerja</span>
                    <span>→</span>
                  </a>
                </div>
              );
            })()}

            {activeEmpTab === "ats" && (() => {
              const candidate = selectedEmpDetail.hired_candidate_id ? getCandidate(selectedEmpDetail.hired_candidate_id) : null;
              return (
                <div className="mt-4 space-y-3.5 text-xs animate-in fade-in-50 duration-200">
                  {candidate ? (
                    <div className="rounded-xl bg-amber-50/60 p-3.5 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-800/60 space-y-2">
                      <div className="flex justify-between border-b border-amber-200/60 pb-2 dark:border-amber-800/40">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Jalur Rekrutmen</span>
                        <span className="font-bold text-amber-900 dark:text-amber-200">{candidate.source || "Career Site"}</span>
                      </div>
                      <div className="flex justify-between border-b border-amber-200/60 pb-2 dark:border-amber-800/40">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Skor CV Analyzer</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{candidate.cvAnalysis ? `${candidate.cvAnalysis.overallScore}/100 — ${candidate.cvAnalysis.recommendation}` : "Belum dianalisis"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Jumlah Wawancara Tercatat</span>
                        <span className="font-bold text-slate-900 dark:text-white">{candidate.interviewResults?.length ?? 0}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 text-center">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">Karyawan ini tidak tertaut ke kandidat manapun di modul ATS.</p>
                    </div>
                  )}
                  <a
                    href="/candidates"
                    className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 text-xs shadow-md transition-all"
                  >
                    <span>🎯 Kelola Database Kandidat ATS</span>
                    <span>→</span>
                  </a>
                </div>
              );
            })()}

            {/* Connecting the Dots: Quick Module Switcher */}
            <div className="mt-5 rounded-xl bg-slate-50 p-3 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Integrasi Modul HR (Pilih untuk melihat data individu)
                </span>
                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">100% Tersinkron</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveEmpTab("payroll")}
                  className={cn("flex items-center justify-center gap-1 rounded-lg p-2 text-[11px] font-bold border transition-all", activeEmpTab === "payroll" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700")}
                >
                  <span>💰</span>
                  <span>Slip Gaji</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmpTab("hrbp")}
                  className={cn("flex items-center justify-center gap-1 rounded-lg p-2 text-[11px] font-bold border transition-all", activeEmpTab === "hrbp" ? "bg-purple-600 text-white border-purple-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700")}
                >
                  <span>📈</span>
                  <span>HRBP KPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEmpTab("ats")}
                  className={cn("flex items-center justify-center gap-1 rounded-lg p-2 text-[11px] font-bold border transition-all", activeEmpTab === "ats" ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700")}
                >
                  <span>🎯</span>
                  <span>ATS Info</span>
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedEmpDetail(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Karyawan Baru</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Input langsung data karyawan ke Pusat Data SDM</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Kylian Mbappé"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">NIK (KTP)</label>
                  <input
                    type="text"
                    value={formNik}
                    onChange={(e) => setFormNik(e.target.value)}
                    placeholder="16 digit NIK"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">NPWP</label>
                  <input
                    type="text"
                    value={formNpwp}
                    onChange={(e) => setFormNpwp(e.target.value)}
                    placeholder="NPWP Karyawan"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Divisi / Unit Kerja</label>
                  <input
                    type="text"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status Kepegawaian</label>
                  <select
                    value={formEmpType}
                    onChange={(e: any) => setFormEmpType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                  >
                    <option value="Kontrak">Kontrak Profesional</option>
                    <option value="Karyawan Tetap">Karyawan Tetap (PKWTT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status PTKP</label>
                  <select
                    value={formPtkp}
                    onChange={(e) => setFormPtkp(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                  >
                    <option value="TK/0">TK/0 (Tidak Kawin)</option>
                    <option value="K/0">K/0 (Kawin 0 Anak)</option>
                    <option value="K/1">K/1 (Kawin 1 Anak)</option>
                    <option value="K/2">K/2 (Kawin 2 Anak)</option>
                    <option value="K/3">K/3 (Kawin 3 Anak)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Upah Pokok (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={formUpah}
                    onChange={(e) => setFormUpah(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rekening Transfer Bank</label>
                <input
                  type="text"
                  value={formBank}
                  onChange={(e) => setFormBank(e.target.value)}
                  placeholder="Contoh: Bank BNI — 0912345678"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs"
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Hitungan Pajak/BPJS (Statutori)</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Aktifkan untuk memotong BPJS &amp; PPh 21 otomatis</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formStatutory}
                    onChange={(e) => setFormStatutory(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Batal</Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan Karyawan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
