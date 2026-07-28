"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureDemoEmployeesExist, getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyProfile } from "@/lib/payroll/company-profile";

export default function DashboardPage() {
  const router = useRouter();
  const [activeCompany, setActiveCompany] = useState(() => getActiveCompanyProfile());
  const [totalHeadcount, setTotalHeadcount] = useState<number>(activeCompany.headcountTarget);
  const [staffCount, setStaffCount] = useState<number>(Math.round(activeCompany.headcountTarget * 0.82));
  const [mgmtCount, setMgmtCount] = useState<number>(Math.round(activeCompany.headcountTarget * 0.18));

  useEffect(() => {
    const comp = getActiveCompanyProfile();
    setActiveCompany(comp);
    
    async function loadDashboardStats() {
      try {
        if (isSupabaseConfigured && supabase) {
          await ensureDemoEmployeesExist(supabase);
          const { data: emps } = await supabase.from("pi_employees").select("id, department, position").eq("status", "active").eq("tenant_id", comp.id);
          if (emps && emps.length > 0) {
            setTotalHeadcount(emps.length);
            const mgmt = emps.filter(e => /Direktur|VP|Kepala|Manajer|Produser|Pemimpin|Redaktur|Supervisor|Lead|Chief/i.test((e.department || "") + " " + (e.position || ""))).length;
            setMgmtCount(mgmt || Math.round(emps.length * 0.18));
            setStaffCount(emps.length - (mgmt || Math.round(emps.length * 0.18)));
            return;
          }
        }
        // Fallback or offline mode:
        const emps = getActiveCompanyEmployees();
        setTotalHeadcount(emps.length);
        const mgmt = emps.filter(e => /Direktur|VP|Kepala|Manajer|Produser|Pemimpin|Redaktur|Supervisor|Lead|Chief/i.test((e.department || "") + " " + (e.position || ""))).length;
        setMgmtCount(mgmt);
        setStaffCount(emps.length - mgmt);
      } catch (err) {
        console.error("Failed loading dashboard stats:", err);
      }
    }
    loadDashboardStats();
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
                <span className="text-5xl font-bold tracking-tight">{totalHeadcount}</span>
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
                  <h3 className="text-emerald-100 font-medium text-lg">Broadcasting Talent Pool</h3>
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Icon className="text-white"><SvgPath name="search" /></Icon>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">48</span>
                  <span className="text-emerald-200 text-sm">Orang Tersedia</span>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-emerald-100 text-sm">Kesiapan Siaran & Liputan (Live Coverage)</p>
                  <span className="text-xl font-bold">96%</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2">
                  <div className="bg-white rounded-full h-2 w-[96%]"></div>
                </div>
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
                <span className="text-lg font-bold text-slate-900 dark:text-white">4</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">In Interview</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">9</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Hiring Pipeline</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">5</span>
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
                <span className="text-slate-500 text-sm font-medium mb-1">Turnover Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">7%</span>
                  <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Healthy
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                <span className="text-amber-700 dark:text-amber-500 text-sm font-medium mb-1">Kontrak Berakhir (30 hr)</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">4</span>
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
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 mb-3">
                  <Icon className="h-8 w-8 text-emerald-600 dark:text-emerald-400"><SvgPath name="check" /></Icon>
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Completed</h4>
                <p className="text-sm text-slate-500 mt-1">Status Payroll Minggu Ini</p>
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
