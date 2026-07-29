"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { runPayroll } from "@/lib/payroll/run-payroll";
import type { Compensation, OvertimeInput, PayrollLineResult, PieceRateInput } from "@/lib/payroll/run-payroll";
import { buildPayslip } from "@/lib/payroll/payslip";
import type { PayslipLine } from "@/lib/payroll/payslip";
import { renderPayslipHTML } from "@/lib/payroll/payslip-html";
import { resolveCompanyProfile, getActiveCompanyId } from "@/lib/payroll/company-profile";
import { aggregateDecemberContext, pickStatutoryConfigForPeriod, toStatutoryConfig, ensureDemoEmployeesExist, isStatutoryEnabled, setStatutoryToggle } from "@/lib/payroll/pay-data";
import type {
  DecemberAggregate, PiCompensationRow, PiEmployeeRow, PiPayrollLineRow, PiPayrollRunRow, PiStatutoryConfigRow,
} from "@/lib/payroll/pay-data";
import type { PtkpStatus, RiskClass } from "@/lib/payroll/types";

function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

interface OtherDeduction {
  name: string;
  amount: number;
}

interface ComputedLine {
  employee: PiEmployeeRow;
  compensation: Compensation;
  result: PayrollLineResult;
}

const DEFAULT_PERIOD = "2026-07";

// Modal in-page (iframe srcDoc), BUKAN window.open(blob) — window.open dari klik
// terprogram/otomasi kerap diam-diam diblokir popup blocker tanpa pesan error apa pun.
function PayslipModal({ html, employeeName, employeePhone, onClose }: { html: string; employeeName: string; employeePhone?: string; onClose: () => void }) {
  const download = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slip-gaji-${employeeName.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printAsPDF = () => {
    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
      }, 350);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400"><SvgPath name="document" /></Icon>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Slip Gaji — {employeeName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {employeePhone && (
              <Button size="sm" variant="secondary" onClick={() => {
                const text = encodeURIComponent(`Halo ${employeeName},\nBerikut tautan slip gaji Anda untuk periode ini. Silakan periksa di aplikasi portal HR.`);
                window.open(`https://wa.me/${employeePhone}?text=${text}`, '_blank');
              }} className="text-emerald-600 dark:text-emerald-500 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                <Icon className="h-3.5 w-3.5"><SvgPath name="envelope" /></Icon> Kirim WA
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={printAsPDF} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
              <Icon className="h-3.5 w-3.5"><SvgPath name="document" /></Icon> Cetak / Simpan PDF
            </Button>
            <Button size="sm" variant="secondary" onClick={download} title="Unduh file web HTML">
              <Icon className="h-3.5 w-3.5"><SvgPath name="download" /></Icon> HTML
            </Button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
              <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
            </button>
          </div>
        </div>
        <iframe srcDoc={html} title={`Slip Gaji ${employeeName}`} className="flex-1 rounded-b-xl border-0 bg-slate-100 dark:bg-slate-950" />
      </div>
    </div>
  );
}

// Kasbon/denda/dll — non-statutori, di luar cakupan runPayroll murni (UU Ketenagakerjaan/
// BPJS/pajak). Diedit per karyawan per periode, disimpan di pi_payroll_lines.other_deductions,
// diterapkan SETELAH engine (lihat buildPayslip) — bukan bagian perhitungan pajak/BPJS.
function OtherDeductionsModal({
  employeeName, initial, onSave, onClose,
}: {
  employeeName: string;
  initial: OtherDeduction[];
  onSave: (items: OtherDeduction[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<OtherDeduction[]>(initial.length ? initial : [{ name: "", amount: 0 }]);

  const update = (i: number, patch: Partial<OtherDeduction>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setItems((prev) => [...prev, { name: "", amount: 0 }]);
  const save = () => {
    onSave(items.filter((it) => it.name.trim() && it.amount > 0));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Potongan Lain — {employeeName}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kasbon, denda keterlambatan, cicilan koperasi, dll — di luar BPJS/PPh 21. Mengurangi Gaji Bersih.
          </p>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={it.name} onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Nama potongan (mis. Kasbon)"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="number" min={0} value={it.amount || ""} onChange={(e) => update(i, { amount: Number(e.target.value) })}
                placeholder="Rp"
                className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button type="button" onClick={() => removeRow(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hapus baris">
                <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={addRow}>
            <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon> Tambah baris
          </Button>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={save}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

const DAY_TYPE_LABEL: Record<OvertimeInput["dayType"], string> = {
  weekday: "Hari kerja biasa (1,5x jam-1, 2x jam berikutnya)",
  restday_6day_week: "Hari istirahat — pola 6 hari kerja/minggu",
  restday_5day_week: "Hari istirahat — pola 5 hari kerja/minggu",
};

// Upah lembur (PP 35/2021) — MEMPENGARUHI gross/BPJS/PPh21 lewat runPayroll (beda dengan
// Potongan Lain yang diterapkan setelah engine), jadi disimpan sebagai input, bukan hasil.
function OvertimeModal({
  employeeName, initial, onSave, onClose,
}: {
  employeeName: string;
  initial: OvertimeInput;
  onSave: (value: OvertimeInput) => void;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(initial.hours);
  const [dayType, setDayType] = useState<OvertimeInput["dayType"]>(initial.dayType);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Lembur — {employeeName}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Jam lembur</label>
            <input
              type="number" min={0} value={hours || ""} onChange={(e) => setHours(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Jenis hari</label>
            <select
              value={dayType} onChange={(e) => setDayType(e.target.value as OvertimeInput["dayType"])}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {Object.entries(DAY_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tabel multiplier PP 35/2021 (menggantikan Kepmenaker 102/2004) — memengaruhi gross, BPJS, dan PPh 21.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={() => { onSave({ hours, dayType }); onClose(); }}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

function PieceRateModal({
  employeeName, initial, onSave, onClose,
}: {
  employeeName: string;
  initial: PieceRateInput[];
  onSave: (items: PieceRateInput[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<PieceRateInput[]>(initial.length ? initial : [{ label: "", quantity: 0, rate: 0 }]);

  const update = (i: number, patch: Partial<PieceRateInput>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const removeRow = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () => setItems((prev) => [...prev, { label: "", quantity: 0, rate: 0 }]);
  const save = () => {
    onSave(items.filter((it) => it.label.trim() && it.quantity > 0 && it.rate > 0));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Honor Siaran &amp; Liputan — {employeeName}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Masukkan rekap honorarium kreatif & program (siaran, liputan, atau dubbing) periode ini. Memengaruhi gross income dan PPh 21, namun tidak memengaruhi BPJS.
          </p>
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={it.label} onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Jenis Honor (mis. Honor Liputan Live / Dubbing)"
                className="flex-1 min-w-[150px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="number" min={0} value={it.quantity || ""} onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                placeholder="Qty"
                className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-sm text-slate-400">x</span>
              <input
                type="number" min={0} value={it.rate || ""} onChange={(e) => update(i, { rate: Number(e.target.value) })}
                placeholder="Rp/pcs"
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button type="button" onClick={() => removeRow(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hapus baris">
                <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={addRow}>
            <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon> Tambah baris
          </Button>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={save}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [lines, setLines] = useState<ComputedLine[] | null>(null);
  const [incompleteEmployees, setIncompleteEmployees] = useState<{ name: string; monthsFound: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedPeriod, setSavedPeriod] = useState<string | null>(null);
  const [payslipModal, setPayslipModal] = useState<{ html: string; employeeName: string; employeePhone?: string } | null>(null);
  const [deductionsModalFor, setDeductionsModalFor] = useState<PiEmployeeRow | null>(null);
  const [otherDeductions, setOtherDeductions] = useState<Record<string, OtherDeduction[]>>({});
  const [overtimeModalFor, setOvertimeModalFor] = useState<PiEmployeeRow | null>(null);
  const [overtimeByEmployee, setOvertimeByEmployee] = useState<Record<string, OvertimeInput>>({});
  const [pieceRateModalFor, setPieceRateModalFor] = useState<PiEmployeeRow | null>(null);
  const [pieceRatesByEmployee, setPieceRatesByEmployee] = useState<Record<string, PieceRateInput[]>>({});
  const [includeThr, setIncludeThr] = useState(false);
  const [thrReferenceDate, setThrReferenceDate] = useState(`${DEFAULT_PERIOD}-01`);
  const [togglesVersion, setTogglesVersion] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => getActiveCompanyId());
  const activeCompany = resolveCompanyProfile(selectedCompanyId);

  const isDecember = /^\d{4}-12$/.test(period);

  const compute = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setError("Supabase belum dikonfigurasi."); return; }
    setError(null);
    setLines(null);
    setIncompleteEmployees([]);

    await ensureDemoEmployeesExist(supabase);

    const [emp, comp, cfg] = await Promise.all([
      supabase.from("pi_employees").select("*").eq("status", "active").eq("tenant_id", getActiveCompanyId()).order("full_name"),
      supabase.from("pi_compensation").select("*"),
      supabase.from("pi_statutory_config").select("*").order("effective_date", { ascending: false }),
    ]);
    if (emp.error) { setError(emp.error.message); return; }
    if (comp.error) { setError(comp.error.message); return; }
    if (cfg.error) { setError(cfg.error.message); return; }
    if (!cfg.data?.length) { setError("pi_statutory_config kosong — jalankan seed."); return; }
    if (!emp.data?.length) { setError("Tidak ada karyawan aktif."); return; }

    const configRow = pickStatutoryConfigForPeriod(cfg.data as PiStatutoryConfigRow[], period);
    if (!configRow) { setError(`Tidak ada config statutori yang berlaku untuk periode ${period}.`); return; }
    const statutoryConfig = toStatutoryConfig(configRow);
    const compByEmp = new Map<string, PiCompensationRow>((comp.data ?? []).map((c) => [c.employee_id, c]));
    const employees = (emp.data as PiEmployeeRow[]) || [];

    let decemberContext: Map<string, DecemberAggregate> | null = null;
    if (isDecember) {
      const tenantId = employees[0].tenant_id;
      const year = period.slice(0, 4);
      const janNovPeriods = Array.from({ length: 11 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
      const runsRes = await supabase.from("pi_payroll_runs").select("*").eq("tenant_id", tenantId).in("period", janNovPeriods);
      if (runsRes.error) { setError(runsRes.error.message); return; }
      const runIds = (runsRes.data as PiPayrollRunRow[] ?? []).map((r) => r.id);
      const linesRes = runIds.length
        ? await supabase.from("pi_payroll_lines").select("*").in("run_id", runIds)
        : { data: [] as PiPayrollLineRow[], error: null };
      if (linesRes.error) { setError(linesRes.error.message); return; }
      decemberContext = aggregateDecemberContext(
        (runsRes.data as PiPayrollRunRow[]) ?? [],
        (linesRes.data as PiPayrollLineRow[]) ?? [],
        year,
      );
    }

    const computed: ComputedLine[] = [];
    const incomplete: { name: string; monthsFound: number }[] = [];

    for (const e of employees) {
      const c = compByEmp.get(e.id);
      if (!c) continue;
      const compensation: Compensation = {
        upah_pokok: Number(c.upah_pokok),
        tunjangan_tetap: c.tunjangan_tetap ?? [],
        tunjangan_tidak_tetap: c.tunjangan_tidak_tetap ?? [],
      };

      const overtime = overtimeByEmployee[e.id]?.hours > 0 ? overtimeByEmployee[e.id] : undefined;
      const pieceRates = pieceRatesByEmployee[e.id]?.length > 0 ? pieceRatesByEmployee[e.id] : undefined;
      const thr = includeThr ? { joinDate: e.join_date, referenceDate: thrReferenceDate } : undefined;

      if (isDecember) {
        const agg = decemberContext?.get(e.id);
        if (!agg || agg.monthsFound < 11) {
          incomplete.push({ name: e.full_name, monthsFound: agg?.monthsFound ?? 0 });
          continue; // JANGAN hitung Desember dengan data Jan-Nov yang tidak lengkap (diam-diam salah)
        }
        const result = runPayroll({
          employeeName: e.full_name,
          statutoryEnabled: isStatutoryEnabled(e.id, e.full_name),
          compensation,
          ptkpStatus: e.ptkp_status as PtkpStatus,
          riskClass: e.risk_class as RiskClass,
          period,
          statutoryConfig,
          overtime,
          thr,
          pieceRates,
          decemberReconciliation: {
            grossJanNov: agg.grossJanNov,
            iuranPensiunKaryawanJanNov: agg.iuranPensiunKaryawanJanNov,
            pph21JanNov: agg.pph21JanNov,
          },
        });
        computed.push({ employee: e, compensation, result });
      } else {
        const result = runPayroll({
          employeeName: e.full_name,
          statutoryEnabled: isStatutoryEnabled(e.id, e.full_name),
          compensation,
          ptkpStatus: e.ptkp_status as PtkpStatus,
          riskClass: e.risk_class as RiskClass,
          period,
          statutoryConfig,
          overtime,
          thr,
          pieceRates,
        });
        computed.push({ employee: e, compensation, result });
      }
    }
    setLines(computed);
    setIncompleteEmployees(incomplete);
  }, [period, includeThr, thrReferenceDate, isDecember, togglesVersion, selectedCompanyId]);

  useEffect(() => { compute(); }, [compute]);

  const netFor = useCallback((line: ComputedLine) => {
    const deductions = otherDeductions[line.employee.id] ?? [];
    return line.result.net - deductions.reduce((s, d) => s + d.amount, 0);
  }, [otherDeductions]);

  const totals = useMemo(() => {
    const l = lines ?? [];
    return {
      gross: l.reduce((s, x) => s + x.result.gross, 0),
      bpjs: l.reduce((s, x) => s + x.result.bpjs.employee.total, 0),
      pph21: l.reduce((s, x) => s + x.result.pph21, 0),
      net: l.reduce((s, x) => s + netFor(x), 0),
    };
  }, [lines, netFor]);

  const openPayslip = useCallback((line: ComputedLine) => {
    const company = resolveCompanyProfile(selectedCompanyId);
    const deductions: PayslipLine[] = (otherDeductions[line.employee.id] ?? []).map((d) => ({ label: d.name, amount: d.amount }));
    const pr = pieceRatesByEmployee[line.employee.id] ?? [];
    const slip = buildPayslip(line.employee, line.compensation, line.result, period, company, deductions, pr);
    const html = renderPayslipHTML(slip);
    // pi_employees belum punya kolom nomor telepon — tombol WA disembunyikan
    // (bukan diisi angka palsu) sampai data itu benar-benar tersedia.
    setPayslipModal({ html, employeeName: line.employee.full_name, employeePhone: undefined });
  }, [period, otherDeductions, pieceRatesByEmployee]);

  const saveRun = useCallback(async () => {
    if (!supabase || !lines?.length) return;
    setSaving(true);
    try {
      const tenantId = lines[0].employee.tenant_id;
      const { data: run, error: runErr } = await supabase
        .from("pi_payroll_runs")
        .upsert({ tenant_id: tenantId, period, status: "draft", run_date: new Date().toISOString() }, { onConflict: "tenant_id,period" })
        .select()
        .single();
      if (runErr) throw runErr;
      const rows = lines.map((l) => {
        const deductions = otherDeductions[l.employee.id] ?? [];
        return {
          run_id: run.id,
          employee_id: l.employee.id,
          gross: l.result.gross,
          components: {
            bpjs: l.result.bpjs,
            bpjsWageBase: l.result.bpjsWageBase,
            overtimePay: l.result.overtimePay,
            thrAmount: l.result.thrAmount,
            pieceRates: pieceRatesByEmployee[l.employee.id] ?? [],
          },
          bpjs_employee: l.result.bpjs.employee.total,
          bpjs_employer: l.result.bpjs.employer.total,
          taxable_base: l.result.gross,
          pph21: l.result.pph21,
          other_deductions: deductions,
          net: netFor(l),
        };
      });
      const { error: linesErr } = await supabase.from("pi_payroll_lines").upsert(rows, { onConflict: "run_id,employee_id" });
      if (linesErr) throw linesErr;
      setSavedPeriod(period);
      toast(`Payroll ${period} tersimpan — ${rows.length} baris.`);
    } catch (e) {
      toast(`Gagal menyimpan: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setSaving(false);
    }
  }, [lines, period, otherDeductions, netFor, pieceRatesByEmployee]);

  return (
    <AppShell
      activeNavId="payroll"
      title="Payroll"
      subtitle="Hitung gaji, BPJS & PPh 21 — lalu terbitkan slip"
      headerActions={
        <Button variant="primary" onClick={saveRun} disabled={saving || !lines?.length}>
          <Icon className="h-4 w-4"><SvgPath name="check" /></Icon>
          {saving ? "Menyimpan…" : "Simpan Run"}
        </Button>
      }
    >
      {/* Company Info Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white shadow-xl mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{activeCompany.industry === "broadcast" ? "📺" : "🧵"}</span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">{activeCompany.name}</h2>
            <p className="text-xs text-slate-400">{activeCompany.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 border border-slate-700/60">
          <span className="font-semibold text-blue-400">{activeCompany.signerTitle}:</span> {activeCompany.signerName}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="period" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Periode</label>
          <input
            id="period" type="month" value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={includeThr} onChange={(e) => setIncludeThr(e.target.checked)} className="rounded border-slate-300" />
            Sertakan THR periode ini
          </label>
          {includeThr && (
            <input
              type="date" value={thrReferenceDate} onChange={(e) => setThrReferenceDate(e.target.value)}
              title="Tanggal acuan perhitungan masa kerja THR"
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          )}
        </div>
        {savedPeriod === period && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Icon className="h-3.5 w-3.5"><SvgPath name="check" /></Icon> Tersimpan
          </span>
        )}
        {isDecember && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <Icon className="h-3.5 w-3.5"><SvgPath name="warning" /></Icon> Masa Desember — rekonsiliasi tahunan (Pasal 17)
          </span>
        )}
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>
        </Card>
      )}

      {isDecember && incompleteEmployees.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {incompleteEmployees.length} karyawan dilewati — data Jan–Nov belum lengkap (butuh 11 bulan tersimpan via &quot;Simpan Run&quot;):
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-amber-700 dark:text-amber-400">
            {incompleteEmployees.map((x) => (
              <li key={x.name}>• {x.name} — {x.monthsFound}/11 bulan tercatat</li>
            ))}
          </ul>
        </Card>
      )}

      {!error && lines && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Bruto" value={rupiah(totals.gross)} />
          <StatTile label="BPJS Karyawan" value={rupiah(totals.bpjs)} />
          <StatTile label="PPh 21" value={rupiah(totals.pph21)} />
          <StatTile label="Total Gaji Bersih" value={rupiah(totals.net)} highlight />
        </div>
      )}

      {!error && (
        <Card padding={false}>
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {lines ? `${lines.length} karyawan · periode ${period}` : "Menghitung…"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">PTKP</th>
                  <th className="px-5 py-3 text-right font-medium">Bruto</th>
                  <th className="px-5 py-3 text-center font-medium">Pajak/BPJS</th>
                  <th className="px-5 py-3 text-right font-medium">BPJS Kry</th>
                  <th className="px-5 py-3 text-right font-medium">PPh 21</th>
                  <th className="px-5 py-3 text-right font-medium">Honor Siaran</th>
                  <th className="px-5 py-3 text-right font-medium">Lembur</th>
                  <th className="px-5 py-3 text-right font-medium">Potongan Lain</th>
                  <th className="px-5 py-3 text-right font-medium">Gaji Bersih</th>
                  <th className="px-5 py-3 text-right font-medium">Slip</th>
                </tr>
              </thead>
              <tbody>
                {(lines ?? []).map((l) => {
                  const deductions = otherDeductions[l.employee.id] ?? [];
                  const deductionsSum = deductions.reduce((s, d) => s + d.amount, 0);
                  return (
                    <tr key={l.employee.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{l.employee.full_name}</td>
                      <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-400">{l.employee.ptkp_status}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(l.result.gross)}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const current = isStatutoryEnabled(l.employee.id, l.employee.full_name);
                            setStatutoryToggle(l.employee.id, !current);
                            setTogglesVersion((v) => v + 1);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                            isStatutoryEnabled(l.employee.id, l.employee.full_name)
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400"
                          )}
                          title="Klik untuk mengaktifkan / menonaktifkan hitungan BPJS dan PPh 21 untuk karyawan ini"
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", isStatutoryEnabled(l.employee.id, l.employee.full_name) ? "bg-emerald-500" : "bg-slate-400")} />
                          {isStatutoryEnabled(l.employee.id, l.employee.full_name) ? "ON (Dipotong)" : "OFF (Rp 0)"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(l.result.bpjs.employee.total)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{rupiah(l.result.pph21)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button" onClick={() => setPieceRateModalFor(l.employee)}
                          className={cn("tabular-nums underline decoration-dotted underline-offset-2",
                            l.result.pieceRatePay > 0 ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}
                        >
                          {l.result.pieceRatePay > 0 ? rupiah(l.result.pieceRatePay) : "+ Tambah"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button" onClick={() => setOvertimeModalFor(l.employee)}
                          className={cn("tabular-nums underline decoration-dotted underline-offset-2",
                            l.result.overtimePay > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}
                        >
                          {l.result.overtimePay > 0 ? rupiah(l.result.overtimePay) : "+ Tambah"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button" onClick={() => setDeductionsModalFor(l.employee)}
                          className={cn("tabular-nums underline decoration-dotted underline-offset-2",
                            deductionsSum > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}
                        >
                          {deductionsSum > 0 ? rupiah(deductionsSum) : "+ Tambah"}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{rupiah(netFor(l))}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="secondary" onClick={() => openPayslip(l)}>
                          <Icon className="h-3.5 w-3.5"><SvgPath name="document" /></Icon> Lihat
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {payslipModal && (
        <PayslipModal
          html={payslipModal.html}
          employeeName={payslipModal.employeeName}
          employeePhone={payslipModal.employeePhone}
          onClose={() => setPayslipModal(null)}
        />
      )}

      {deductionsModalFor && (
        <OtherDeductionsModal
          employeeName={deductionsModalFor.full_name}
          initial={otherDeductions[deductionsModalFor.id] ?? []}
          onSave={(items) => setOtherDeductions((prev) => ({ ...prev, [deductionsModalFor.id]: items }))}
          onClose={() => setDeductionsModalFor(null)}
        />
      )}

      {overtimeModalFor && (
        <OvertimeModal
          employeeName={overtimeModalFor.full_name}
          initial={overtimeByEmployee[overtimeModalFor.id] ?? { hours: 0, dayType: "weekday" }}
          onSave={(value) => setOvertimeByEmployee((prev) => ({ ...prev, [overtimeModalFor.id]: value }))}
          onClose={() => setOvertimeModalFor(null)}
        />
      )}

      {pieceRateModalFor && (
        <PieceRateModal
          employeeName={pieceRateModalFor.full_name}
          initial={pieceRatesByEmployee[pieceRateModalFor.id] ?? []}
          onSave={(value) => setPieceRatesByEmployee((prev) => ({ ...prev, [pieceRateModalFor.id]: value }))}
          onClose={() => setPieceRateModalFor(null)}
        />
      )}
    </AppShell>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4",
      highlight
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900")}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums",
        highlight ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-white")}>{value}</p>
    </div>
  );
}
