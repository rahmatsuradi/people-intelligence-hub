"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureDemoEmployeesExist, getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyProfile } from "@/lib/payroll/company-profile";
import { getJobReqs, getCandidates, getTalentPool } from "@/lib/store";

const MGMT_TITLE_RE = /Direktur|VP|Kepala|Manajer|Produser|Pemimpin|Redaktur|Supervisor|Lead|Chief/i;

export default function DashboardPage() {
  const router = useRouter();
  const [activeCompany, setActiveCompany] = useState(() => getActiveCompanyProfile());
  const [totalHeadcount, setTotalHeadcount] = useState<number | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [mgmtCount, setMgmtCount] = useState<number>(0);
  const [pkwttCount, setPkwttCount] = useState<number>(0);
  const [pkwtCount, setPkwtCount] = useState<number>(0);
  // Rekrutmen & talent pool — dihitung dari store yang sama dengan halaman ATS
  const [openRoles, setOpenRoles] = useState<number>(0);
  const [inInterview, setInInterview] = useState<number>(0);
  const [activePipeline, setActivePipeline] = useState<number>(0);
  const [talentCount, setTalentCount] = useState<number>(0);
  const [talentAvgPct, setTalentAvgPct] = useState<number>(0);
  const [payrollDone, setPayrollDone] = useState<boolean | null>(null);
  const currentPeriod = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const comp = getActiveCompanyProfile();
    setActiveCompany(comp);

    // KPI rekrutmen dari store lokal (sumber yang sama dengan /candidates & /roles)
    const reqs = getJobReqs();
    const cands = getCandidates();
    setOpenRoles(reqs.filter((r) => r.status === "active").length);
    setInInterview(cands.filter((c) => c.stage === "interviewed").length);
    setActivePipeline(cands.filter((c) => c.stage !== "hired" && c.stage !== "rejected").length);
    const pool = getTalentPool();
    setTalentCount(pool.length);
    const avgRating = pool.length ? pool.reduce((s, t) => s + (t.rating ?? 0), 0) / pool.length : 0;
    setTalentAvgPct(Math.round((avgRating / 5) * 100));

    async function loadDashboardStats() {
      try {
        const applyEmps = (emps: { department?: string | null; position?: string | null; employment_type?: string | null }[]) => {
          setTotalHeadcount(emps.length);
          const mgmt = emps.filter((e) => MGMT_TITLE_RE.test((e.department || "") + " " + (e.position || ""))).length;
          setMgmtCount(mgmt);
          setStaffCount(emps.length - mgmt);
          const tetap = emps.filter((e) => /PKWTT/i.test(e.employment_type || "")).length;
          setPkwttCount(tetap);
          setPkwtCount(emps.length - tetap);
        };
        if (isSupabaseConfigured && supabase) {
          await ensureDemoEmployeesExist(supabase);
          const [{ data: emps }, { data: runs }] = await Promise.all([
            supabase.from("pi_employees").select("id, department, position, employment_type").eq("status", "active").eq("tenant_id", comp.id),
            supabase.from("pi_payroll_runs").select("id").eq("tenant_id", comp.id).eq("period", currentPeriod).limit(1),
          ]);
          setPayrollDone(Boolean(runs && runs.length > 0));
          if (emps && emps.length > 0) {
            applyEmps(emps);
            return;
          }
        }
        // Fallback / offline: data demo lokal
        applyEmps(getActiveCompanyEmployees());
      } catch (err) {
        console.error("Failed loading dashboard stats:", err);
      }
    }
    loadDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      activeNavId="dashboard"
      title="Executive Dashboard"
      subtitle={`${activeCompany.name} — Operations & Human Capital Overview`}
    >
      <div className="mx-auto max-w-6xl space-y-8 pb-12">
        {/* ROW 1: Main Headcount & Talent Pool */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          
          {/* Headcount Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-lg" padding={false}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-blue-100 font-medium text-lg">Total Headcount</h3>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Icon className="text-white"><SvgPath name="users" /></Icon>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight">{totalHeadcount ?? "—"}</span>
                <span className="text-blue-200 text-sm">Active Personnel</span>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                <div>
                  <p className="text-blue-200 text-sm mb-1">Staff & Officer</p>
                  <p className="text-2xl font-semibold">{staffCount}</p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm mb-1">Lead & Management</p>
                  <p className="text-2xl font-semibold">{mgmtCount}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Talent Pool & Peak Season Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-0 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]" padding={false}>
            <div className="p-6 h-full flex flex-col justify-between" onClick={() => router.push('/talent-pool')}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-emerald-100 font-medium text-lg">Talent Pool</h3>
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Icon className="text-white"><SvgPath name="search" /></Icon>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">{talentCount}</span>
                  <span className="text-emerald-200 text-sm">Orang Tersedia</span>
                </div>
              </div>

              <div className="mt-8">
                {talentCount > 0 ? (
                  <>
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-emerald-100 text-sm">Rata-rata Rating Talent</p>
                      <span className="text-xl font-bold">{talentAvgPct}%</span>
                    </div>
                    <div className="w-full bg-black/20 rounded-full h-2">
                      <div className="bg-white rounded-full h-2" style={{ width: `${talentAvgPct}%` }}></div>
                    </div>
                  </>
                ) : (
                  <p className="text-emerald-100 text-sm">Belum ada talent tersimpan — tambahkan dari halaman Candidates.</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 2: Recruitment, Turnover, Operations */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          
          {/* Recruitment Funnel */}
          <Card className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <Icon><SvgPath name="dashboard" /></Icon>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Recruitment</h3>
            </div>
            
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Open Positions</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{openRoles}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">In Interview</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{inInterview}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Hiring Pipeline</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{activePipeline}</span>
              </div>
            </div>
          </Card>

          {/* HR Health (Turnover & Contracts) */}
          <Card className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                <Icon><SvgPath name="chart" /></Icon>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Organizational Health</h3>
            </div>
            
            <div className="grid grid-rows-2 gap-4 flex-1">
              <div className="flex flex-col justify-center items-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <span className="text-slate-500 text-sm font-medium mb-1">Karyawan Tetap (PKWTT)</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {totalHeadcount ? Math.round((pkwttCount / totalHeadcount) * 100) : 0}%
                  </span>
                  <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {pkwttCount} Orang
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                <span className="text-amber-700 dark:text-amber-500 text-sm font-medium mb-1">Karyawan Kontrak (PKWT)</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pkwtCount}</span>
                  <span className="text-amber-600 text-xs">Orang</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Operations & Payroll */}
          <Card className="flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                <Icon><SvgPath name="report" /></Icon>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Payroll & Operations</h3>
            </div>
            
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="text-center">
                <div className={cn("inline-flex items-center justify-center h-16 w-16 rounded-full mb-3",
                  payrollDone ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-amber-100 dark:bg-amber-900/40")}>
                  <Icon className={cn("h-8 w-8", payrollDone ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                    <SvgPath name={payrollDone ? "check" : "clock"} />
                  </Icon>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  {payrollDone === null ? "—" : payrollDone ? "Run Tersimpan" : "Belum Dihitung"}
                </h4>
                <p className="text-sm text-slate-500 mt-1">Status Payroll Periode {currentPeriod}</p>
              </div>
              
              <button 
                onClick={() => router.push('/pay/payroll')}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                Buka Modul Payroll
              </button>
            </div>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}
