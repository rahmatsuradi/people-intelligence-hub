"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Icon, SvgPath, Button, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { getAttendance, getLeaves, saveAttendance, saveLeave } from "@/lib/attendance/store";
import type { AttendanceRecord, LeaveRequest, BurnoutRisk } from "@/lib/attendance/types";
import LeaveModal from "./leave-modal";

function getTodayString() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export default function AttendancePage() {
  const [employees, setEmployees] = useState<PiEmployeeRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [burnoutRisks, setBurnoutRisks] = useState<BurnoutRisk[]>([]);

  const today = getTodayString();

  const fetchAll = async () => {
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
    
    let att = getAttendance();
    let lvs = getLeaves();

    // Auto-seed some mock data for Burnout Demo if empty
    if (att.length === 0 && emps.length > 0) {
      emps.slice(0, 3).forEach((e, i) => {
        // Person 0: Burnout (Lots of overtime, sick leave)
        if (i === 0) {
          saveAttendance({ id: crypto.randomUUID(), employeeId: e.id, date: "2026-07-20", status: "present", overtimeHours: 4 });
          saveAttendance({ id: crypto.randomUUID(), employeeId: e.id, date: "2026-07-21", status: "present", overtimeHours: 5 });
          saveAttendance({ id: crypto.randomUUID(), employeeId: e.id, date: "2026-07-22", status: "present", overtimeHours: 4 });
          saveLeave({ id: crypto.randomUUID(), employeeId: e.id, type: "sick", startDate: "2026-07-23", endDate: "2026-07-24", reason: "Sakit tipes", status: "approved", appliedAt: "2026-07-23" });
        }
        // Person 1: Normal
        if (i === 1) {
          saveAttendance({ id: crypto.randomUUID(), employeeId: e.id, date: "2026-07-20", status: "present", overtimeHours: 0 });
          saveAttendance({ id: crypto.randomUUID(), employeeId: e.id, date: "2026-07-21", status: "present", overtimeHours: 1 });
        }
      });
      att = getAttendance();
      lvs = getLeaves();
    }
    
    setAttendance(att);
    setLeaves(lvs);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCheckIn = (empId: string) => {
    const existing = attendance.find(a => a.employeeId === empId && a.date === today);
    if (existing) return; // already checked in
    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      employeeId: empId,
      date: today,
      status: "present",
      checkIn: new Date().toTimeString().slice(0,5),
      overtimeHours: 0,
    };
    saveAttendance(newRecord);
    setAttendance(getAttendance());
  };

  const handleRunBurnoutAI = async () => {
    setAnalyzing(true);
    try {
      await new Promise(r => setTimeout(r, 1500)); // mock network
      if (!employees) return;

      const risks: BurnoutRisk[] = [];
      employees.forEach(emp => {
        const empAtt = attendance.filter(a => a.employeeId === emp.id);
        const empLvs = leaves.filter(l => l.employeeId === emp.id && l.type === "sick");
        
        const totalOvertime = empAtt.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
        const sickDays = empLvs.length; // simplified

        if (totalOvertime > 10 && sickDays > 0) {
          risks.push({
            employeeId: emp.id,
            level: "High",
            factors: [`Lembur tinggi (${totalOvertime} jam) minggu ini`, "Riwayat cuti sakit terdeteksi (Indikasi kelelahan fisik)"],
            recommendation: "Segera kurangi beban kerja & wajibkan cuti pemulihan 2 hari."
          });
        } else if (totalOvertime > 5) {
          risks.push({
            employeeId: emp.id,
            level: "Medium",
            factors: [`Mulai sering lembur (${totalOvertime} jam)`],
            recommendation: "Pantau beban tugas, pastikan kompensasi lembur sesuai."
          });
        }
      });
      setBurnoutRisks(risks);
    } finally {
      setAnalyzing(false);
    }
  };

  // Status for today
  const getStatusToday = (empId: string) => {
    // check leaves first
    const onLeave = leaves.find(l => l.employeeId === empId && l.status === "approved" && l.startDate <= today && l.endDate >= today);
    if (onLeave) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Cuti: {onLeave.type}</span>;
    }
    const att = attendance.find(a => a.employeeId === empId && a.date === today);
    if (att) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Hadir ({att.checkIn})</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">Belum Hadir</span>;
  };

  return (
    <AppShell activeNavId="attendance" title="Time & Attendance" subtitle="Presensi, Cuti, & AI Burnout Detection">
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {!error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card padding={false}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-white">Status Hari Ini ({today})</h3>
                <Button size="sm" variant="primary" onClick={() => setLeaveModalOpen(true)}>
                  <Icon className="h-4 w-4 mr-1"><SvgPath name="calendar" /></Icon> Pengajuan Cuti
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-5 py-3 font-medium">Nama Karyawan</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employees ?? []).map(emp => (
                      <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{emp.full_name}</td>
                        <td className="px-5 py-3">{getStatusToday(emp.id)}</td>
                        <td className="px-5 py-3 text-right">
                          {!attendance.find(a => a.employeeId === emp.id && a.date === today) && (
                            <Button size="sm" variant="ghost" onClick={() => handleCheckIn(emp.id)}>
                              Check-In Manual
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Daftar Pengajuan Cuti</h3>
              <div className="space-y-3">
                {leaves.length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada pengajuan cuti.</p>
                ) : leaves.map(l => {
                  const empName = employees?.find(e => e.id === l.employeeId)?.full_name || "Unknown";
                  return (
                    <div key={l.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{empName} — <span className="uppercase text-xs text-slate-500">{l.type}</span></p>
                        <p className="text-xs text-slate-500">{l.startDate} s/d {l.endDate} ({l.reason})</p>
                      </div>
                      <span className={cn("px-2 py-1 text-xs font-semibold rounded", 
                        l.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                        l.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}>
                        {l.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={cn("border-2 transition-colors", burnoutRisks.length > 0 ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]" : "border-slate-200 dark:border-slate-800")}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-5 w-5", burnoutRisks.length > 0 ? "text-red-500" : "text-blue-500")}>
                    <SvgPath name="sparkles" />
                  </Icon>
                  <h3 className="font-semibold text-slate-900 dark:text-white">AI Burnout Risk</h3>
                </div>
                <Button size="sm" variant={burnoutRisks.length > 0 ? "secondary" : "primary"} onClick={handleRunBurnoutAI} disabled={analyzing}>
                  {analyzing ? "Menganalisis..." : "Scan Karyawan"}
                </Button>
              </div>
              
              <p className="text-xs text-slate-500 mb-4">
                Menganalisis tren lembur (overtime) berlebih dan riwayat cuti sakit berdekatan untuk memprediksi kelelahan mental/fisik.
              </p>

              <div className="space-y-3">
                {burnoutRisks.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center text-sm text-slate-500">
                    Tidak ada risiko tinggi yang terdeteksi, atau Anda belum melakukan Scan.
                  </div>
                ) : burnoutRisks.map((risk, i) => {
                  const empName = employees?.find(e => e.id === risk.employeeId)?.full_name || "Unknown";
                  return (
                    <div key={i} className={cn("p-3 rounded-lg border", 
                      risk.level === "High" ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/50" : "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/50"
                    )}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{empName}</p>
                        <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", 
                          risk.level === "High" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                        )}>{risk.level} RISK</span>
                      </div>
                      <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 mb-2 space-y-1">
                        {risk.factors.map((f, idx) => <li key={idx}>{f}</li>)}
                      </ul>
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 p-2 rounded">
                        <span className="text-blue-600">💡 AI Rec:</span> {risk.recommendation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {leaveModalOpen && employees && (
        <LeaveModal 
          employees={employees}
          onClose={() => setLeaveModalOpen(false)} 
          onSave={(req) => {
            saveLeave(req);
            setLeaves(getLeaves());
            setLeaveModalOpen(false);
          }} 
        />
      )}
    </AppShell>
  );
}
