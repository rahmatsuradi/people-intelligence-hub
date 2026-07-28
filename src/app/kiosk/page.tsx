"use client";

import { useState, useEffect } from "react";
import { Icon, SvgPath, Button, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { saveAttendance } from "@/lib/attendance/store";
import type { AttendanceRecord } from "@/lib/attendance/types";
import { toast } from "@/components/toast";

export default function KioskPage() {
  const [time, setTime] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<PiEmployeeRow[]>([]);
  const [scanning, setScanning] = useState<"face" | "fingerprint" | null>(null);
  const [scanResult, setScanResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeCompId = getActiveCompanyId();
    if (isSupabaseConfigured && supabase) {
      supabase.from("pi_employees").select("*").eq("status", "active").eq("tenant_id", activeCompId)
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setEmployees(data as PiEmployeeRow[]);
          } else {
            setEmployees(getActiveCompanyEmployees() as unknown as PiEmployeeRow[]);
          }
        });
    } else {
      setEmployees(getActiveCompanyEmployees() as unknown as PiEmployeeRow[]);
    }
  }, []);

  const simulateScan = (type: "face" | "fingerprint") => {
    if (employees.length === 0) {
      toast("Data karyawan tidak tersedia", "error");
      return;
    }
    
    setScanning(type);
    setScanResult(null);

    // Simulate scanning delay
    setTimeout(() => {
      setScanning(null);
      // Pick random employee for demo
      const randomEmp = employees[Math.floor(Math.random() * employees.length)];
      const today = new Date().toISOString().split("T")[0];
      const checkInTime = new Date().toTimeString().slice(0,5);

      const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        employeeId: randomEmp.id,
        date: today,
        status: "present",
        checkIn: checkInTime,
        overtimeHours: 0,
      };
      
      saveAttendance(newRecord);
      setScanResult({
        type: "success",
        message: `Berhasil Check-In!\n${randomEmp.full_name} (${checkInTime})`
      });

      // Clear result after 3 seconds
      setTimeout(() => setScanResult(null), 3000);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      
      {/* Kiosk Header */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
          <Icon className="h-6 w-6 text-white"><SvgPath name="sparkles" /></Icon>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">People Intelligence Hub <span className="font-light text-blue-400">Kiosk</span></span>
      </div>

      <div className="absolute top-8 right-8">
        <a href="/attendance" className="text-sm font-medium text-slate-500 hover:text-white transition-colors">
          Keluar Mode Kiosk &rarr;
        </a>
      </div>

      {/* Clock */}
      <div className="text-center mb-16">
        <h1 className="text-[120px] font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-xl">
          {time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </h1>
        <p className="text-2xl text-slate-400 font-medium mt-4 tracking-wide">
          {time.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Interactive Scan Area */}
      <div className="relative w-full max-w-2xl bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-800 p-12 text-center shadow-2xl overflow-hidden">
        
        {/* Scanning Animation Overlay */}
        {scanning && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-lg">
            <div className={cn("relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-dashed animate-spin-slow", 
              scanning === "face" ? "border-blue-500" : "border-emerald-500"
            )}>
              <Icon className={cn("h-16 w-16 animate-pulse", scanning === "face" ? "text-blue-400" : "text-emerald-400")}>
                <SvgPath name={scanning === "face" ? "users" : "document"} />
              </Icon>
            </div>
            <p className="mt-8 text-xl font-semibold text-white animate-pulse">
              Memindai {scanning === "face" ? "Wajah" : "Sidik Jari"}...
            </p>
            <p className="text-sm text-slate-400 mt-2">Mohon jangan bergerak</p>
          </div>
        )}

        {/* Result Overlay */}
        {scanResult && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-emerald-950/90 backdrop-blur-lg">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.5)]">
              <Icon className="h-12 w-12 text-white"><SvgPath name="check" /></Icon>
            </div>
            <p className="text-3xl font-bold text-white whitespace-pre-line leading-tight">
              {scanResult.message}
            </p>
          </div>
        )}

        {!scanning && !scanResult && (
          <>
            <h2 className="text-2xl font-semibold text-white mb-8">Pilih Metode Presensi</h2>
            <div className="grid grid-cols-2 gap-6">
              <button 
                onClick={() => simulateScan("face")}
                className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-800 bg-slate-800/50 p-8 transition-all hover:border-blue-500 hover:bg-blue-900/20"
              >
                <div className="rounded-full bg-blue-500/10 p-6 text-blue-400 transition-transform group-hover:scale-110 group-hover:text-blue-300">
                  <Icon className="h-16 w-16"><SvgPath name="users" /></Icon>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white">Face ID</h3>
                  <p className="text-sm text-slate-400 mt-1">Pindai wajah Anda</p>
                </div>
              </button>

              <button 
                onClick={() => simulateScan("fingerprint")}
                className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-800 bg-slate-800/50 p-8 transition-all hover:border-emerald-500 hover:bg-emerald-900/20"
              >
                <div className="rounded-full bg-emerald-500/10 p-6 text-emerald-400 transition-transform group-hover:scale-110 group-hover:text-emerald-300">
                  <Icon className="h-16 w-16"><SvgPath name="document" /></Icon>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white">Fingerprint</h3>
                  <p className="text-sm text-slate-400 mt-1">Gunakan sidik jari</p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
