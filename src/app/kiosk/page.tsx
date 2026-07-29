"use client";

import { useState, useEffect, useMemo } from "react";
import { Icon, SvgPath, cn } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { getAttendance, saveAttendance } from "@/lib/attendance/store";
import type { AttendanceRecord } from "@/lib/attendance/types";

/*
  Kiosk Presensi Mandiri — karyawan memilih namanya sendiri lalu check-in.
  Integrasi biometrik (Face ID / fingerprint) butuh perangkat keras khusus dan
  sengaja TIDAK disimulasikan di sini agar demo tidak mengklaim kemampuan palsu.
*/
export default function KioskPage() {
  const [time, setTime] = useState<Date>(new Date());
  const [employees, setEmployees] = useState<PiEmployeeRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PiEmployeeRow | null>(null);
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return employees
      .filter((e) => e.full_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, employees]);

  const handleCheckIn = () => {
    if (!selected) return;
    const today = new Date().toISOString().split("T")[0];
    const checkInTime = new Date().toTimeString().slice(0, 5);

    // Cegah check-in ganda pada hari yang sama
    const existing = getAttendance().find((a) => a.employeeId === selected.id && a.date === today);
    if (existing) {
      setScanResult({
        type: "error",
        message: `${selected.full_name}\nsudah check-in hari ini (${existing.checkIn ?? "—"})`,
      });
      setTimeout(() => setScanResult(null), 3000);
      setSelected(null);
      setQuery("");
      return;
    }

    const newRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      employeeId: selected.id,
      date: today,
      status: "present",
      checkIn: checkInTime,
      overtimeHours: 0,
    };
    saveAttendance(newRecord);
    setScanResult({
      type: "success",
      message: `Berhasil Check-In!\n${selected.full_name} (${checkInTime})`,
    });
    setTimeout(() => setScanResult(null), 3000);
    setSelected(null);
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">

      {/* Kiosk Header */}
      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
          <Icon className="h-6 w-6 text-white"><SvgPath name="clock" /></Icon>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">People Intelligence Hub <span className="font-light text-blue-400">Kiosk</span></span>
      </div>

      <div className="absolute top-8 right-8">
        <a href="/attendance" className="text-sm font-medium text-slate-500 hover:text-white transition-colors">
          Keluar Mode Kiosk &rarr;
        </a>
      </div>

      {/* Clock */}
      <div className="text-center mb-12">
        <h1 className="text-[120px] font-bold leading-none tracking-tighter text-white tabular-nums drop-shadow-xl">
          {time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </h1>
        <p className="text-2xl text-slate-400 font-medium mt-4 tracking-wide">
          {time.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Self-Service Check-In Area */}
      <div className="relative w-full max-w-2xl bg-slate-900/50 backdrop-blur-md rounded-3xl border border-slate-800 p-10 text-center shadow-2xl overflow-hidden">

        {/* Result Overlay */}
        {scanResult && (
          <div className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-lg",
            scanResult.type === "success" ? "bg-emerald-950/90" : "bg-amber-950/90")}>
            <div className={cn("flex h-24 w-24 items-center justify-center rounded-full mb-6",
              scanResult.type === "success"
                ? "bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.5)]"
                : "bg-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.5)]")}>
              <Icon className="h-12 w-12 text-white"><SvgPath name={scanResult.type === "success" ? "check" : "warning"} /></Icon>
            </div>
            <p className="text-3xl font-bold text-white whitespace-pre-line leading-tight">
              {scanResult.message}
            </p>
          </div>
        )}

        {!selected ? (
          <>
            <h2 className="text-2xl font-semibold text-white mb-2">Presensi Mandiri</h2>
            <p className="text-sm text-slate-400 mb-6">Ketik nama Anda untuk check-in hari ini</p>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik minimal 2 huruf nama Anda..."
              autoFocus
              className="w-full rounded-2xl border-2 border-slate-700 bg-slate-800/70 px-6 py-4 text-xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            {matches.length > 0 && (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto text-left">
                {matches.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => setSelected(emp)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-5 py-3.5 transition-all hover:border-blue-500 hover:bg-blue-900/20"
                  >
                    <span className="text-base font-semibold text-white">{emp.full_name}</span>
                    <span className="text-xs text-slate-400">{emp.department}</span>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && matches.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">Nama tidak ditemukan di daftar karyawan aktif.</p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-slate-300 mb-1">Konfirmasi Presensi</h2>
            <p className="text-3xl font-bold text-white">{selected.full_name}</p>
            <p className="mt-1 text-sm text-slate-400">{selected.position || selected.department} · {selected.department}</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-2xl border-2 border-slate-700 bg-slate-800/50 py-4 text-lg font-semibold text-slate-300 transition-all hover:border-slate-500"
              >
                Bukan Saya
              </button>
              <button
                type="button"
                onClick={handleCheckIn}
                className="rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-500"
              >
                ✓ Check-In Sekarang
              </button>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 max-w-xl text-center text-xs text-slate-600">
        Verifikasi biometrik (Face ID / sidik jari) memerlukan perangkat keras khusus dan ada di roadmap —
        demo ini memakai presensi mandiri berbasis nama.
      </p>

    </div>
  );
}
