"use client";

import { AppShell, Icon, SvgPath, Card, cn } from "@/components/app-shell";
import {
  getCandidates,
  getJobReqs,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type CandidateRecord,
  type PipelineStage,
} from "@/lib/store";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyProfile, type CompanyProfile } from "@/lib/payroll/company-profile";
import { computeOvertimeLoad } from "@/lib/overtime-load";
import { getHrbpAction, recordHrbpAction, clearHrbpAction, type HrbpActionKey, type HrbpActionRecord } from "@/lib/hrbp-action-store";

interface DemoEmployee {
  full_name: string;
  employment_type: string;
  department: string | null;
  position?: string;
  upah_pokok: number | string;
  overtime_hours_monthly?: number;
  employment_status?: string;
}
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STAGE_COLORS: Record<PipelineStage, { bar: string; text: string }> = {
  applied:    { bar: "bg-slate-400",   text: "text-slate-600 dark:text-slate-400" },
  screened:   { bar: "bg-blue-500",    text: "text-blue-700 dark:text-blue-400" },
  work_sample:{ bar: "bg-cyan-500",    text: "text-cyan-700 dark:text-cyan-400" },
  interviewed:{ bar: "bg-violet-500",  text: "text-violet-700 dark:text-violet-400" },
  offered:    { bar: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400" },
  hired:      { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  rejected:   { bar: "bg-red-400",     text: "text-red-600 dark:text-red-400" },
};

const REC_COLORS: Record<string, string> = {
  "Strong Hire": "bg-emerald-500",
  "Hire":        "bg-blue-500",
  "Review":      "bg-amber-500",
  "Reject":      "bg-red-500",
};

const DEPT_COLORS: { dot: string; bar: string }[] = [
  { dot: "bg-red-600", bar: "bg-red-600" },
  { dot: "bg-rose-500", bar: "bg-rose-500" },
  { dot: "bg-amber-500", bar: "bg-amber-500" },
  { dot: "bg-blue-500", bar: "bg-blue-500" },
  { dot: "bg-emerald-500", bar: "bg-emerald-500" },
  { dot: "bg-violet-500", bar: "bg-violet-500" },
  { dot: "bg-cyan-500", bar: "bg-cyan-500" },
  { dot: "bg-slate-500", bar: "bg-slate-500" },
];

const REC_TEXT: Record<string, string> = {
  "Strong Hire": "text-emerald-700 dark:text-emerald-400",
  "Hire":        "text-blue-700 dark:text-blue-400",
  "Review":      "text-amber-700 dark:text-amber-400",
  "Reject":      "text-red-700 dark:text-red-400",
};

const BADGE_TONE: Record<"success" | "warning" | "danger", string> = {
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function StatCard({ label, value, sub, colorClass = "text-slate-900 dark:text-white", badge }: {
  label: string; value: string | number; sub?: string; colorClass?: string;
  badge?: { text: string; tone: "success" | "warning" | "danger" };
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {badge && (
          <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold", BADGE_TONE[badge.tone])}>
            {badge.text}
          </span>
        )}
      </div>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums", colorClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

function RoiBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
      {text}
    </span>
  );
}

function ActionButton({ label, executedLabel, record, onClick }: {
  label: string; executedLabel: string; record: HrbpActionRecord | null; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
        record
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          : "bg-red-600 text-white hover:bg-red-700"
      )}
    >
      {record
        ? `✓ ${executedLabel} · ${new Date(record.executedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`
        : label}
    </button>
  );
}

function BarRow({ label, sub, count, pct, barClass }: {
  label: string; sub?: string; count: number; pct: number; barClass: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="w-28 shrink-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <div className="flex-1">
        <div className="h-8 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
          <div
            className={cn("h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2", barClass)}
            style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
          >
            {count > 0 && pct > 15 && (
              <span className="text-xs font-bold text-white">{count}</span>
            )}
          </div>
        </div>
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-slate-700 dark:text-slate-300">{count}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [employees, setEmployees] = useState<DemoEmployee[]>([]);
  const [openRoles, setOpenRoles] = useState<number>(0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"workforce" | "simulator" | "recruitment">("workforce");

  // Simulator state
  const [breakingNewsHours, setBreakingNewsHours] = useState<number>(8); // 0 to 24 hours
  const [selectedDivisionSim, setSelectedDivisionSim] = useState<string>("Redaksi & Pemberitaan");
  const [hrbpActions, setHrbpActions] = useState<Record<HrbpActionKey, HrbpActionRecord | null>>({
    deploy_magang: null,
    jadwalkan_health_talk: null,
    eksplorasi_ai_vendor: null,
  });

  useEffect(() => {
    const refresh = () => {
      setCandidates(getCandidates());
      setEmployees(getActiveCompanyEmployees());
      setOpenRoles(getJobReqs().filter((r) => r.status === "active").length);
      const comp = getActiveCompanyProfile();
      setCompanyProfile(comp);
      setHrbpActions({
        deploy_magang: getHrbpAction(comp.id, "deploy_magang"),
        jadwalkan_health_talk: getHrbpAction(comp.id, "jadwalkan_health_talk"),
        eksplorasi_ai_vendor: getHrbpAction(comp.id, "eksplorasi_ai_vendor"),
      });
      setLoaded(true);
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  function toggleHrbpAction(key: HrbpActionKey) {
    if (!companyProfile) return;
    if (hrbpActions[key]) {
      clearHrbpAction(companyProfile.id, key);
      setHrbpActions((prev) => ({ ...prev, [key]: null }));
    } else {
      const record = recordHrbpAction(companyProfile.id, key, breakingNewsHours);
      setHrbpActions((prev) => ({ ...prev, [key]: record }));
    }
  }

  const isBroadcast = companyProfile?.industry === "broadcast";

  const workforce = useMemo(() => {
    const total = employees.length;
    const permanentCount = employees.filter((e) => /PKWTT|Tetap/i.test(e.employment_type)).length;
    const contractCount = total - permanentCount;
    const permanentPct = total > 0 ? Math.round((permanentCount / total) * 1000) / 10 : 0;

    const deptMap = new Map<string, number>();
    for (const e of employees) {
      const d = e.department || "Lainnya";
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1);
    }
    const departments = Array.from(deptMap.entries())
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.count - a.count);

    const totalBaseSalary = employees.reduce((s, e) => s + (Number(e.upah_pokok) || 0), 0);
    const avgBaseSalary = total > 0 ? Math.round(totalBaseSalary / total) : 0;

    // Formasi organisasi = karyawan aktif + posisi yang masih dibuka (bukan
    // headcountTarget statis, yang kebetulan sama persis dengan jumlah
    // karyawan yang di-seed sehingga selalu tampak 100% terisi).
    const orgStructureTarget = total + openRoles;
    const fulfillmentPct = orgStructureTarget > 0 ? Math.round((total / orgStructureTarget) * 1000) / 10 : 100;

    return { total, permanentCount, contractCount, permanentPct, departments, totalBaseSalary, avgBaseSalary, orgStructureTarget, fulfillmentPct };
  }, [employees, openRoles]);

  const overtimeLoad = useMemo(
    () =>
      computeOvertimeLoad(
        employees.map((e) => ({ ...e, upah_pokok: Number(e.upah_pokok) || 0 })),
        companyProfile?.id ?? ""
      ),
    [employees, companyProfile]
  );

  const stats = useMemo(() => {
    const total = candidates.length;
    const withCv = candidates.filter((c) => c.cvAnalysis);
    const hired = candidates.filter((c) => c.stage === "hired").length;
    const offered = candidates.filter((c) => c.stage === "offered" || c.stage === "hired").length;

    const avgScore = withCv.length > 0
      ? Math.round(withCv.reduce((s, c) => s + (c.cvAnalysis?.overallScore ?? 0), 0) / withCv.length)
      : 0;
    const offerAccept = offered > 0 ? Math.round((hired / offered) * 100) : 0;

    const stageCounts: Record<PipelineStage, number> = {
      applied: 0, screened: 0, work_sample: 0, interviewed: 0, offered: 0, hired: 0, rejected: 0,
    };
    for (const c of candidates) stageCounts[c.stage]++;

    // Cumulative counts
    const cumulative: Record<PipelineStage, number> = { ...stageCounts };
    for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
      const stage = PIPELINE_STAGES[i];
      if (i < PIPELINE_STAGES.length - 1) {
        cumulative[stage] += cumulative[PIPELINE_STAGES[i + 1]];
      }
    }

    const conversionRates = PIPELINE_STAGES.slice(1).map((stage, i) => {
      const fromStage = PIPELINE_STAGES[i];
      const from = cumulative[fromStage];
      const to = cumulative[stage];
      return { stage, from: STAGE_LABELS[fromStage], rate: from > 0 ? Math.round((to / from) * 100) : 0 };
    });

    const maxStage = Math.max(...PIPELINE_STAGES.map((s) => cumulative[s]), 1);

    // Sources
    const sourceMap = new Map<string, number>();
    for (const c of candidates) {
      const s = c.source || "Manual";
      sourceMap.set(s, (sourceMap.get(s) ?? 0) + 1);
    }
    const sources = Array.from(sourceMap.entries())
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Recommendation mix
    const recMap = new Map<string, number>();
    for (const c of withCv) {
      const r = c.cvAnalysis?.recommendation ?? "Unknown";
      recMap.set(r, (recMap.get(r) ?? 0) + 1);
    }
    const recOrder = ["Strong Hire", "Hire", "Review", "Reject"];
    const recs = Array.from(recMap.entries())
      .map(([name, count]) => ({ name, count, pct: withCv.length > 0 ? Math.round((count / withCv.length) * 100) : 0 }))
      .sort((a, b) => recOrder.indexOf(a.name) - recOrder.indexOf(b.name));

    // Score histogram
    const bins = [
      { label: "<50",   min: 0,  max: 50,  count: 0, color: "bg-red-400" },
      { label: "50–59", min: 50, max: 60,  count: 0, color: "bg-amber-400" },
      { label: "60–69", min: 60, max: 70,  count: 0, color: "bg-amber-500" },
      { label: "70–79", min: 70, max: 80,  count: 0, color: "bg-blue-500" },
      { label: "80–89", min: 80, max: 90,  count: 0, color: "bg-emerald-500" },
      { label: "90+",   min: 90, max: 101, count: 0, color: "bg-emerald-600" },
    ];
    for (const c of withCv) {
      const score = c.cvAnalysis?.overallScore ?? 0;
      const bin = bins.find((b) => score >= b.min && score < b.max);
      if (bin) bin.count++;
    }
    const maxBin = Math.max(...bins.map((b) => b.count), 1);

    // Departments
    const deptMap = new Map<string, { candidates: number; hired: number; scoreSum: number; scoreCount: number }>();
    for (const c of candidates) {
      const d = c.department || "Other";
      const e = deptMap.get(d) ?? { candidates: 0, hired: 0, scoreSum: 0, scoreCount: 0 };
      e.candidates++;
      if (c.stage === "hired") e.hired++;
      if (c.cvAnalysis) { e.scoreSum += c.cvAnalysis.overallScore; e.scoreCount++; }
      deptMap.set(d, e);
    }
    const departments = Array.from(deptMap.entries())
      .map(([name, d]) => ({
        name,
        candidates: d.candidates,
        hired: d.hired,
        avgScore: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : 0,
        hireRate: d.candidates > 0 ? Math.round((d.hired / d.candidates) * 100) : 0,
      }))
      .sort((a, b) => b.candidates - a.candidates);

    return { total, hired, avgScore, offerAccept, withCv: withCv.length, stageCounts, cumulative, maxStage, conversionRates, sources, recs, bins, maxBin, departments };
  }, [candidates]);

  if (!loaded) {
    return (
      <AppShell activeNavId="analytics" title="Analytics" subtitle="HRBP & Workforce Intelligence Hub">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  // Nilai simulator what-if (koefisien ILUSTRATIF untuk demo — bukan model AI/aktuaria)
  const baseMonthlySalaryBill = 21_929_210_000; // Rp 21,93 miliar/bln (kalibrasi: beban SDM tahunan ~Rp 263,15 M / 12)
  const overtimeMultiplier = 1 + ((breakingNewsHours - 8) * 0.045); // asumsi demo: +4,5% per jam ekstra
  const simulatedMonthlyBill = Math.round(baseMonthlySalaryBill * Math.max(1, overtimeMultiplier));
  const burnoutRiskPct = Math.min(98, Math.round(22 + (breakingNewsHours - 8) * 4.8)); // kurva ilustratif

  // Dampak (ROI) rekomendasi HRBP — sama seperti nilai simulator di atas: koefisien
  // ILUSTRATIF untuk demo, tapi tetap dihitung dari state (bukan angka statis di JSX)
  // sehingga ikut bergerak saat slider intensitas siaran digeser.
  const MAGANG_TOTAL = 100;
  const MAGANG_REDAKSI_PCT = 52;
  const magangDiRedaksi = Math.round(MAGANG_TOTAL * (MAGANG_REDAKSI_PCT / 100));
  const redaksiHeadcount = workforce.departments.find((d) => /Redaksi/i.test(d.name))?.count ?? 0;
  const reporterWorkloadReductionPct = redaksiHeadcount > 0 ? Math.round((magangDiRedaksi / redaksiHeadcount) * 1000) / 10 : 0;
  const magangDeployRecommended = Math.min(magangDiRedaksi, Math.round(10 + (breakingNewsHours - 8) * 2.6));
  const overtimeSavingsFromMagang = Math.round(Math.max(0, simulatedMonthlyBill - baseMonthlySalaryBill) * 0.15); // asumsi demo: magang offset 15% kenaikan lembur
  const sickLeaveReductionPct = Math.min(12, Math.round(burnoutRiskPct * 0.12)); // asumsi demo: intervensi K3 proporsional thd risiko burnout
  const aiEfficiencyGainPct = Math.min(45, Math.round(20 + (breakingNewsHours - 8) * 1.5)); // asumsi demo: adopsi AI makin bernilai saat beban tinggi

  return (
    <AppShell activeNavId="analytics" title="Pusat Analitik & Strategi HRBP" subtitle={`Demo sintetis — data ${companyProfile?.shortName ?? "entitas aktif"}`}>
      
      {/* Top Tab Navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("workforce")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all shadow-sm",
            activeTab === "workforce"
              ? "bg-red-600 text-white shadow-red-500/20"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
        >
          <span>🏛️</span>
          <span>Workforce & Headcount</span>
        </button>

        {isBroadcast && (
          <button
            onClick={() => setActiveTab("simulator")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all shadow-sm",
              activeTab === "simulator"
                ? "bg-red-600 text-white shadow-red-500/20"
                : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span>🚀</span>
            <span>Simulator Beban Siaran (What-If)</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("recruitment")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all shadow-sm",
            activeTab === "recruitment"
              ? "bg-red-600 text-white shadow-red-500/20"
              : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          )}
        >
          <span>📊</span>
          <span>Recruitment Pipeline (ATS)</span>
        </button>
      </div>

      {/* TAB 1: WORKFORCE & HEADCOUNT — computed live from the active tenant's employee dataset */}
      {activeTab === "workforce" && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Company banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-700 to-amber-600 p-6 text-white shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md mb-3">
                  Data Sintetis — Dihitung Langsung dari Dataset Demo
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{companyProfile?.name ?? "—"}</h1>
                <p className="mt-1 text-sm md:text-base text-red-100 max-w-2xl">{companyProfile?.tagline ?? ""}</p>
              </div>
              <div className="shrink-0 flex flex-col items-start md:items-end bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                <span className="text-xs font-semibold text-red-200">Rasio Karyawan Tetap (PKWTT)</span>
                <span className="text-2xl font-black text-white">
                  {workforce.permanentPct.toLocaleString("id-ID")}% <span className="text-xs font-normal text-emerald-300">● {workforce.permanentCount} Org</span>
                </span>
                <span className="text-xs text-red-200 mt-1">
                  vs Kontrak: {(100 - workforce.permanentPct).toLocaleString("id-ID")}% ({workforce.contractCount} Org)
                </span>
              </div>
            </div>
          </div>

          {/* KPI Cards — computed from the active tenant's employee dataset */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total Headcount (Aktif)"
              value={`${workforce.total} Org`}
              sub={`Formasi (aktif + ${openRoles} lowongan terbuka): ${workforce.orgStructureTarget} Org`}
              colorClass="text-slate-900 dark:text-white"
              badge={{
                text: `Fulfillment ${workforce.fulfillmentPct.toLocaleString("id-ID")}%`,
                tone: workforce.fulfillmentPct >= 98 ? "success" : workforce.fulfillmentPct >= 90 ? "warning" : "danger",
              }}
            />
            <StatCard
              label="Total Biaya Tenaga Kerja (Bulanan)"
              value={`Rp ${((workforce.totalBaseSalary + overtimeLoad.monthlyCost) / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`}
              sub={
                overtimeLoad.available
                  ? `Tetap (gaji pokok): Rp ${(workforce.totalBaseSalary / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M · Variabel (lembur): Rp ${(overtimeLoad.monthlyCost / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt`
                  : "Jumlah upah_pokok seluruh karyawan (belum termasuk tunjangan)"
              }
              colorClass="text-red-600 dark:text-red-400"
              badge={
                overtimeLoad.available
                  ? {
                      text: `${overtimeLoad.variancePct > 0 ? "+" : ""}${overtimeLoad.variancePct.toLocaleString("id-ID")}% vs Budget Lembur`,
                      tone: overtimeLoad.variancePct > 10 ? "danger" : overtimeLoad.variancePct > 0 ? "warning" : "success",
                    }
                  : undefined
              }
            />
            <StatCard
              label="Rata-Rata Gaji Pokok"
              value={`Rp ${(workforce.avgBaseSalary / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`}
              sub="Per karyawan, dihitung dari dataset aktif"
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {/* Division/Department Composition — real counts from the active tenant */}
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Komposisi Departemen</h2>
                <p className="text-xs text-slate-500">Distribusi headcount per departemen — {companyProfile?.shortName ?? ""}</p>
              </div>
              <span className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {workforce.total} Karyawan
              </span>
            </div>

            {workforce.departments.length === 0 ? (
              <p className="mt-5 text-sm text-slate-400">Belum ada data karyawan untuk entitas ini.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {workforce.departments.map((dept, i) => {
                  const dotColor = DEPT_COLORS[i % DEPT_COLORS.length];
                  return (
                    <div key={dept.name}>
                      <div className="mb-1 flex items-center justify-between text-sm font-medium">
                        <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", dotColor.dot)} />
                          {dept.name}
                        </span>
                        <span className="tabular-nums text-slate-600 dark:text-slate-400 font-bold">
                          {dept.count} Org · {dept.pct.toLocaleString("id-ID")}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={cn("h-full rounded-full transition-all duration-700", dotColor.bar)} style={{ width: `${Math.max(dept.pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Methodology / provenance note */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span className="font-bold text-slate-800 dark:text-slate-200">📖 Metodologi:</span>{" "}
            Seluruh entitas, nama, dan angka pada dasbor ini adalah <strong>data demo sintetis</strong>, dihitung langsung
            dari dataset karyawan aktif ({companyProfile?.shortName ?? "entitas aktif"}) — bukan data resmi perusahaan mana pun
            dan tidak boleh dikutip sebagai fakta. Beralih perusahaan di header untuk melihat dataset entitas lain.
          </div>
        </div>
      )}

      {/* TAB 2: AI HRBP & BREAKING NEWS SIMULATOR */}
      {activeTab === "simulator" && isBroadcast && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 p-6 text-white shadow-xl border border-slate-800">
            <h1 className="text-2xl font-extrabold flex items-center gap-3">
              <span>⚡</span>
              <span>Simulator What-If: Breaking News 24/7 & Beban SDM</span>
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Stasiun TV berita nasional menghadapi dinamika liputan langsung 24 jam non-stop saat terjadi peristiwa luar biasa (Pilkada, Bencana Alam, Isbat). Simulasi ini memproyeksikan lonjakan anggaran lembur (*overtime burn rate*), risiko *burnout*, dan kesiapan talenta magang — memakai koefisien ilustratif untuk keperluan demo.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Control Panel */}
            <Card className="lg:col-span-1 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 border-2 border-red-500/20">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🎛️</span>
                  <span>Parameter Intensitas Siaran</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Atur durasi liputan langsung per hari untuk melihat dampak pada SDM</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Jam Siaran / Liputan per Hari</span>
                    <span className="text-red-600 dark:text-red-400 font-black text-lg">{breakingNewsHours} Jam</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    step="1"
                    value={breakingNewsHours}
                    onChange={(e) => setBreakingNewsHours(parseInt(e.target.value))}
                    className="w-full accent-red-600 cursor-pointer h-2 bg-slate-200 rounded-lg dark:bg-slate-700"
                  />
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                    <span>8 Jam (Normal / Siaran Rutin)</span>
                    <span>16 Jam (Siaga 2)</span>
                    <span>24 Jam (Siaga 1 Non-Stop)</span>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fokus Divisi Analisis</label>
                  <select
                    value={selectedDivisionSim}
                    onChange={(e) => setSelectedDivisionSim(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Redaksi & Pemberitaan">Divisi Redaksi & Pemberitaan (41,9%)</option>
                    <option value="Operasional Studio & Broadcast">Divisi Operasional Studio & Broadcast (22,0%)</option>
                    <option value="Teknik Penyiaran & IT">Divisi Teknik Penyiaran & IT (11,9%)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status Kondisi Liputan</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-full animate-ping", 
                    breakingNewsHours > 16 ? "bg-red-600" : breakingNewsHours > 12 ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {breakingNewsHours > 18 ? "🚨 SIAGA 1: BREAKING NEWS DARURAT" : breakingNewsHours > 12 ? "⚠️ SIAGA 2: LIPUTAN KHUSUS EXTENDED" : "✅ NORMAL: JADWAL SIARAN REGULER"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {breakingNewsHours > 18 
                    ? "Kru lapangan dan MCR bekerja sistem 3-shift rotasi cepat. Anggaran lembur melonjak untuk menjaga kecepatan & verifikasi berita realtime."
                    : breakingNewsHours > 12 
                    ? "Penambahan slot siaran langsung untuk event nasional. Efisiensi jam kerja dipantau ketat oleh HRBP."
                    : "Seluruh tim bekerja sesuai standar jam kerja 8 jam dengan sistem cuti reguler berjalan normal."}
                </p>
              </div>
            </Card>

            {/* Simulation Results & AI Analytics */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Dynamic Budget Projection */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-l-4 border-l-red-600 bg-gradient-to-br from-white to-red-50/30 dark:from-slate-900 dark:to-red-950/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Proyeksi Beban Gaji & Lembur (Per Bulan)</p>
                  <p className="mt-2 text-3xl font-black tabular-nums text-red-600 dark:text-red-400">
                    Rp {(simulatedMonthlyBill / 1000000000).toFixed(2)} Miliar
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Baseline Normal: Rp 21,93 M/bln</span>
                    <span className={cn("font-bold", breakingNewsHours > 8 ? "text-red-600" : "text-emerald-600")}>
                      +{Math.round((overtimeMultiplier - 1) * 100)}% Lembur
                    </span>
                  </div>
                </Card>

                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimasi Risiko Burnout (Model Ilustratif)</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className={cn("text-3xl font-black tabular-nums", 
                      burnoutRiskPct > 65 ? "text-red-600 dark:text-red-400" : burnoutRiskPct > 40 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      {burnoutRiskPct}%
                    </p>
                    <span className="text-xs font-bold text-slate-500">
                      {burnoutRiskPct > 65 ? "(Risiko Tinggi - Butuh Rotasi)" : burnoutRiskPct > 40 ? "(Risiko Moderat)" : "(Stabil / Aman)"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div 
                      className={cn("h-full transition-all duration-500", burnoutRiskPct > 65 ? "bg-red-600" : burnoutRiskPct > 40 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${burnoutRiskPct}%` }}
                    />
                  </div>
                </Card>
              </div>

              {/* Campus One & HRBP Actionable Insights */}
              <Card>
                <div className="border-b border-slate-100 pb-3 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Rekomendasi Strategis HRBP & Kaderisasi Magang</h2>
                    <p className="text-xs text-slate-500">Rekomendasi live terhadap intensitas liputan {breakingNewsHours} jam/hari — geser slider di panel kiri untuk melihat rekomendasi berubah</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                    100 Peserta Magang Aktif
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  📖 Badge dampak (ROI) di bawah adalah estimasi ilustratif untuk demo — koefisien yang sama dengan proyeksi lembur &amp; risiko burnout di atas, bukan model AI/aktuaria.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">🎓</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Aktivasi Talent Pool Magang Nasional (Program Magang Valora 2025)</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Dalam skenario demo ini terdapat <strong className="text-red-600 dark:text-red-400">100 mahasiswa magang terpilih</strong> dari PTN/PTS ({magangDiRedaksi}% ditempatkan di Divisi News/Redaksi). Pada intensitas siaran saat ini, HRBP merekomendasikan pengerahan{" "}
                          <strong className="text-red-600 dark:text-red-400">{magangDeployRecommended} dari {magangDiRedaksi} magang Redaksi</strong>{" "}
                          untuk mendukung riset naskah berita, pengindeksan materi newsroom, dan asisten liputan lapangan guna meringankan beban reporter senior.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <RoiBadge text={`Prediksi Penghematan Lembur: Rp ${(overtimeSavingsFromMagang / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} Jt/bln`} />
                          <RoiBadge text={`Beban Kerja Reporter Redaksi: -${reporterWorkloadReductionPct.toLocaleString("id-ID")}%`} />
                        </div>
                        <div className="mt-3">
                          <ActionButton
                            label="Deploy Magang ke Newsroom"
                            executedLabel="Dieksekusi"
                            record={hrbpActions.deploy_magang}
                            onClick={() => toggleHrbpAction("deploy_magang")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">🩺</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Intervensi Kesehatan & K3 (Klinik On-Site Valora Tower)</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {breakingNewsHours > 16
                            ? "🚨 INSTRUKSI KRUSIAL HRBP: Dengan risiko burnout mencapai " + burnoutRiskPct + "%, aktifkan dokter jaga 24 jam di Klinik On-Site studio Valora dan fasilitas medis kantor pusat Valora Tower. Wajibkan pemeriksaan tekanan darah bagi kamerawan ENG dan anchor sebelum bertugas."
                            : "Tim HRBP secara berkala menjalankan sesi 'Health Talk' (pencegahan kelelahan mata buram & ergonomi studio) serta pelatihan kesiapsiagaan darurat APAR sesuai standar Kemnaker RI."}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <RoiBadge text={`Estimasi Penurunan Risiko Sick Leave: -${sickLeaveReductionPct.toLocaleString("id-ID")}%`} />
                        </div>
                        <div className="mt-3">
                          <ActionButton
                            label="Jadwalkan Health Talk"
                            executedLabel="Terjadwal"
                            record={hrbpActions.jadwalkan_health_talk}
                            onClick={() => toggleHrbpAction("jadwalkan_health_talk")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">🤖</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Implementasi "Agentic AI" dalam Alur Kerja Redaksi</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          Untuk menjaga efisiensi biaya operasional, HRBP mendorong adopsi *AI Practical Tools* untuk transkripsi wawancara otomatis, *prompter indexing*, dan *vocal training analysis*, sehingga reporter dapat fokus pada investigasi dan verifikasi kebenaran berita di lapangan.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <RoiBadge text={`Peningkatan Efisiensi Produksi Berita: +${aiEfficiencyGainPct.toLocaleString("id-ID")}%`} />
                        </div>
                        <div className="mt-3">
                          <ActionButton
                            label="Eksplorasi Vendor AI"
                            executedLabel="Dijadwalkan"
                            record={hrbpActions.eksplorasi_ai_vendor}
                            onClick={() => toggleHrbpAction("eksplorasi_ai_vendor")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RECRUITMENT PIPELINE (ORIGINAL ATS ANALYTICS) */}
      {activeTab === "recruitment" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {stats.total === 0 ? (
            <Card className="flex flex-col items-center justify-center border-dashed py-20 text-center">
              <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
              <p className="mt-4 font-medium text-slate-900 dark:text-white">No recruitment pipeline data yet</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Add candidates via the{" "}
                <Link href="/candidates" className="text-blue-600 hover:underline dark:text-blue-400">Candidates</Link> board
                {" "}or run a{" "}
                <Link href="/cv-analyzer" className="text-blue-600 hover:underline dark:text-blue-400">CV Analysis</Link>{" "}
                to start building pipeline data.
              </p>
            </Card>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Candidates" value={stats.total} sub="All time ATS records" />
                <StatCard
                  label="Avg CV Score" value={stats.avgScore || "—"}
                  sub={`${stats.withCv} analyzed by AI`}
                  colorClass="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Hired" value={stats.hired}
                  sub={`of ${stats.total} total`}
                  colorClass="text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                  label="Offer Accept Rate" value={`${stats.offerAccept}%`}
                  sub="Offered → Hired"
                  colorClass="text-violet-600 dark:text-violet-400"
                />
              </div>

              {/* Pipeline Funnel */}
              <Card padding={false} className="overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recruitment Pipeline Funnel</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Cumulative reach per stage · funnel narrows as candidates advance</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const conv = stats.conversionRates[i - 1];
                    const count = stats.cumulative[stage];
                    const pct = Math.round((count / stats.maxStage) * 100);
                    const colors = STAGE_COLORS[stage];
                    return (
                      <BarRow
                        key={stage}
                        label={STAGE_LABELS[stage]}
                        sub={conv ? `${conv.rate}% from ${conv.from}` : "Top of funnel"}
                        count={count}
                        pct={pct}
                        barClass={colors.bar}
                      />
                    );
                  })}
                </div>
                {stats.stageCounts.rejected > 0 && (
                  <div className="border-t border-slate-100 opacity-60 dark:border-slate-800">
                    <BarRow
                      label="Rejected"
                      count={stats.stageCounts.rejected}
                      pct={Math.round((stats.stageCounts.rejected / stats.maxStage) * 100)}
                      barClass="bg-red-400"
                    />
                  </div>
                )}
              </Card>

              {/* Source + Recommendation */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Candidate Sources</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Where candidates entered the pipeline</p>
                  {stats.sources.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">No source data available</p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {stats.sources.map((src) => (
                        <div key={src.name}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{src.name}</span>
                            <span className="tabular-nums text-slate-500">{src.count} · {src.pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${src.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">AI Recommendation Mix</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {stats.withCv > 0 ? `From ${stats.withCv} CV analyses` : "Run CV Analyzer to see data here"}
                  </p>
                  {stats.recs.length === 0 ? (
                    <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
                      <Icon className="h-8 w-8 text-slate-300 dark:text-slate-600"><SvgPath name="scan" /></Icon>
                      <p className="text-sm text-slate-400">No analyses yet</p>
                      <Link href="/cv-analyzer" className="text-xs text-blue-600 hover:underline dark:text-blue-400">Go to CV Analyzer →</Link>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {stats.recs.map((rec) => (
                        <div key={rec.name}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className={cn("font-semibold", REC_TEXT[rec.name] ?? "text-slate-700 dark:text-slate-300")}>{rec.name}</span>
                            <span className="tabular-nums text-slate-500">{rec.count} · {rec.pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", REC_COLORS[rec.name] ?? "bg-slate-400")}
                              style={{ width: `${rec.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Score Distribution */}
              {stats.withCv > 0 && (
                <Card>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">CV Score Distribution</h2>
                  <p className="mt-0.5 text-sm text-slate-500">Score spread across {stats.withCv} analyzed candidates</p>
                  <div className="mt-6 flex items-end gap-3" style={{ height: "120px" }}>
                    {stats.bins.map((bin) => {
                      const heightPct = stats.maxBin > 0 ? (bin.count / stats.maxBin) * 100 : 0;
                      return (
                        <div key={bin.label} className="flex flex-1 flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 h-4">
                            {bin.count > 0 ? bin.count : ""}
                          </span>
                          <div className="relative w-full flex-1 overflow-hidden rounded-t-md bg-slate-100 dark:bg-slate-800">
                            <div
                              className={cn("absolute bottom-0 w-full rounded-t-md transition-all duration-700", bin.color)}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 whitespace-nowrap">{bin.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Department Table */}
              {stats.departments.length > 0 && (
                <Card padding={false} className="overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Department Breakdown</h2>
                    <p className="mt-0.5 text-sm text-slate-500">Hiring activity and quality by department</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Candidates</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Hired</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Hire Rate</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats.departments.map((dept) => (
                          <tr key={dept.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{dept.name}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{dept.candidates}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{dept.hired}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={cn("text-xs font-semibold tabular-nums",
                                dept.hireRate >= 30 ? "text-emerald-600 dark:text-emerald-400" :
                                dept.hireRate > 0  ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                              )}>
                                {dept.hireRate > 0 ? `${dept.hireRate}%` : "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={cn("tabular-nums font-medium",
                                dept.avgScore >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                                dept.avgScore >= 70 ? "text-blue-600 dark:text-blue-400" :
                                dept.avgScore >  0  ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                              )}>
                                {dept.avgScore > 0 ? dept.avgScore : "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

        </div>
      )}

    </AppShell>
  );
}
