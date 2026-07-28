"use client";

import { useState } from "react";
import { Icon, SvgPath, Button, inputClass } from "@/components/app-shell";
import type { PiEmployeeRow } from "@/lib/payroll/pay-data";
import type { LeaveRequest } from "@/lib/attendance/types";

export default function LeaveModal({
  employees,
  onSave,
  onClose,
}: {
  employees: PiEmployeeRow[];
  onSave: (req: LeaveRequest) => void;
  onClose: () => void;
}) {
  const [empId, setEmpId] = useState(employees[0]?.id || "");
  const [type, setType] = useState<LeaveRequest["type"]>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSave = () => {
    if (!empId || !startDate || !endDate) return;
    onSave({
      id: crypto.randomUUID(),
      employeeId: empId,
      type,
      startDate,
      endDate,
      reason,
      status: "pending", // normally pending, but we'll auto-approve for demo if annual
      appliedAt: new Date().toISOString().split("T")[0]
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Form Pengajuan Cuti</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Karyawan</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)} className={inputClass}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jenis Cuti</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className={inputClass}>
              <option value="annual">Cuti Tahunan</option>
              <option value="sick">Cuti Sakit</option>
              <option value="maternity">Cuti Melahirkan</option>
              <option value="unpaid">Cuti di Luar Tanggungan</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Selesai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Keterangan / Alasan</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className={inputClass} rows={3} placeholder="Contoh: Acara keluarga di luar kota" />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={handleSave}>Ajukan Cuti</Button>
        </div>
      </div>
    </div>
  );
}
