"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Icon, SvgPath, inputClass } from "@/components/app-shell";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PiEmployeeRow, PiPayrollLineRow, PiPayrollRunRow, PiStatutoryConfigRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyEmployees, toStatutoryConfig, pickStatutoryConfigForPeriod } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import { buildForm1721A1 } from "@/lib/payroll/tax-1721-a1";
import type { Form1721A1Result } from "@/lib/payroll/tax-1721-a1";
import { maskNik, maskNpwp } from "@/lib/payroll/payslip-masking";

function rupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

type LoadState = "idle" | "loading" | "done" | "error";

export default function Form1721A1Page() {
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [employees, setEmployees] = useState<PiEmployeeRow[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [formResult, setFormResult] = useState<Form1721A1Result | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const compId = getActiveCompanyId();
    if (isSupabaseConfigured && supabase) {
      supabase.from("pi_employees").select("*").eq("tenant_id", compId)
        .then(({ data, error: err }) => {
          if (!err && data && data.length > 0) {
            setEmployees(data as PiEmployeeRow[]);
          } else {
            setEmployees(getActiveCompanyEmployees() as unknown as PiEmployeeRow[]);
          }
        });
    } else {
      setEmployees(getActiveCompanyEmployees() as unknown as PiEmployeeRow[]);
    }
  }, []);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(current - i));
  }, []);

  const generate = useCallback(async () => {
    if (!selectedEmpId) return;
    setLoadState("loading");
    setError(null);
    setFormResult(null);

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) { setError("Karyawan tidak ditemukan."); setLoadState("error"); return; }

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase belum dikonfigurasi. Formulir 1721-A1 memerlukan data payroll tersimpan.");
      setLoadState("error");
      return;
    }

    const compId = getActiveCompanyId();

    const [runsRes, configRes] = await Promise.all([
      supabase.from("pi_payroll_runs").select("*").eq("tenant_id", compId).like("period", `${year}-%`),
      supabase.from("pi_statutory_config").select("*").eq("tenant_id", compId),
    ]);

    if (runsRes.error) { setError(runsRes.error.message); setLoadState("error"); return; }
    if (configRes.error) { setError(configRes.error.message); setLoadState("error"); return; }

    const runs = (runsRes.data ?? []) as PiPayrollRunRow[];
    if (runs.length === 0) {
      setError(`Tidak ada data payroll untuk tahun ${year}. Jalankan payroll di halaman Payroll dulu.`);
      setLoadState("error");
      return;
    }

    const configs = (configRes.data ?? []) as PiStatutoryConfigRow[];
    const lastPeriod = runs.map((r) => r.period).sort().pop()!;
    const pickedConfig = pickStatutoryConfigForPeriod(configs, lastPeriod);
    if (!pickedConfig) {
      setError("Statutory config tidak ditemukan untuk periode ini.");
      setLoadState("error");
      return;
    }
    const statutoryConfig = toStatutoryConfig(pickedConfig);

    const linesRes = await supabase
      .from("pi_payroll_lines")
      .select("*")
      .in("run_id", runs.map((r) => r.id))
      .eq("employee_id", emp.id);

    if (linesRes.error) { setError(linesRes.error.message); setLoadState("error"); return; }
    const lines = (linesRes.data ?? []) as PiPayrollLineRow[];

    if (lines.length === 0) {
      setError(`Tidak ada data payroll untuk ${emp.full_name} di tahun ${year}.`);
      setLoadState("error");
      return;
    }

    const result = buildForm1721A1(emp, lines, statutoryConfig, year);
    setFormResult(result);
    setLoadState("done");
  }, [selectedEmpId, year, employees]);

  return (
    <AppShell activeNavId="form-1721-a1" title="Formulir 1721-A1">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Formulir 1721-A1</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bukti Pemotongan PPh Pasal 21 (Formulir 1721-A1) per karyawan per tahun pajak.
          </p>
        </div>

        {/* Selector */}
        <Card padding={false} className="p-5 print:hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tahun Pajak
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={`${inputClass} w-full`}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex-[2]">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Karyawan
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className={`${inputClass} w-full`}
              >
                <option value="">— Pilih karyawan —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} — {emp.department ?? "Tanpa Departemen"}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              onClick={generate}
              disabled={!selectedEmpId || loadState === "loading"}
            >
              {loadState === "loading" ? "Memuat..." : "Generate"}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 print:hidden">
            <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>
          </Card>
        )}

        {formResult && <FormView data={formResult} />}
      </div>
    </AppShell>
  );
}

function FormRow({ no, label, value, bold }: { no: string; label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
      <td className="w-12 px-4 py-2.5 text-right text-xs text-slate-400 tabular-nums">{no}</td>
      <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">{label}</td>
      <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${bold ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
        {value}
      </td>
    </tr>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="bg-slate-50 dark:bg-slate-800/50">
      <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </td>
    </tr>
  );
}

function FormView({ data }: { data: Form1721A1Result }) {
  const selisihLabel = data.pph21Selisih > 0
    ? "PPh 21 Kurang Dipotong"
    : data.pph21Selisih < 0
      ? "PPh 21 Lebih Dipotong"
      : "PPh 21 Nihil";

  return (
    <div className="space-y-4">
      {/* Print Header + Print Button */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Hasil formulir untuk <span className="font-semibold text-slate-900 dark:text-white">{data.employee.full_name}</span> — Tahun Pajak {data.year}
        </p>
        <Button size="sm" variant="primary" onClick={() => window.print()}>
          <Icon className="h-3.5 w-3.5"><SvgPath name="document" /></Icon> Cetak
        </Button>
      </div>

      {/* Identitas */}
      <Card padding={false} className="print:shadow-none print:border-none">
        <div className="hidden print:block px-5 pt-5 pb-2">
          <h1 className="text-xl font-bold text-slate-900">FORMULIR 1721-A1</h1>
          <p className="text-sm text-slate-600">Bukti Pemotongan Pajak Penghasilan Pasal 21 — Tahun Pajak {data.year}</p>
        </div>

        <div className="grid gap-px bg-slate-200 dark:bg-slate-800 sm:grid-cols-2 print:grid-cols-2">
          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Penerima Penghasilan</p>
            <p className="font-semibold text-slate-900 dark:text-white">{data.employee.full_name}</p>
            <p className="text-sm text-slate-500">NIK: {maskNik(data.employee.nik)}</p>
            <p className="text-sm text-slate-500">NPWP: {maskNpwp(data.employee.npwp)}</p>
            <p className="text-sm text-slate-500">Status PTKP: {data.employee.ptkp_status}</p>
            <p className="text-sm text-slate-500">Masa Perolehan: {data.periodRange.startMonth}–{data.periodRange.endMonth}</p>
          </div>
          <div className="bg-white p-4 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Pemotong Pajak</p>
            <p className="font-semibold text-slate-900 dark:text-white">{data.employer.name}</p>
            <p className="text-sm text-slate-500">NPWP: {maskNpwp(data.employer.npwp)}</p>
            <p className="text-sm text-slate-500 mt-2">Penandatangan:</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{data.employer.signerName}</p>
            <p className="text-sm text-slate-500">{data.employer.signerTitle}</p>
          </div>
        </div>
      </Card>

      {/* Perhitungan */}
      <Card padding={false} className="print:shadow-none print:border-none print:break-inside-avoid overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              <SectionHeader title="A. Penghasilan Bruto" />
              <FormRow no="1" label="Gaji/Pensiun atau THT/JHT" value={rupiah(data.gajiPokokSetahun)} />
              <FormRow no="2" label="Tunjangan PPh" value={rupiah(data.tunjanganPPh)} />
              <FormRow no="3" label="Tunjangan Lainnya, Uang Lembur, dsb." value={rupiah(data.tunjanganLainDanLemburSetahun)} />
              <FormRow no="4" label="Honorarium dan Imbalan Lain Sejenisnya" value={rupiah(data.honorariumSetahun)} />
              <FormRow no="5" label="Premi Asuransi yang Dibayar Pemberi Kerja" value={rupiah(data.premiAsuransiPemberiKerjaSetahun)} />
              <FormRow no="6" label="Penerimaan dalam Bentuk Natura/Kenikmatan" value={rupiah(data.naturaSetahun)} />
              <FormRow no="7" label="Tantiem, Bonus, Gratifikasi, Jasa Produksi, THR" value={rupiah(data.thrDanBonusSetahun)} />
              <FormRow no="8" label="JUMLAH PENGHASILAN BRUTO (1 s.d. 7)" value={rupiah(data.jumlahPenghasilanBruto)} bold />

              <SectionHeader title="B. Pengurang" />
              <FormRow no="9" label="Biaya Jabatan (5% x Bruto, maks Rp 6.000.000/th)" value={rupiah(data.biayaJabatan)} />
              <FormRow no="10" label="Iuran Pensiun/JHT/THT yang Dibayar Sendiri" value={rupiah(data.iuranPensiunDanJhtPegawaiSetahun)} />
              <FormRow no="11" label="JUMLAH PENGURANG (9 s.d. 10)" value={rupiah(data.jumlahPengurang)} bold />

              <SectionHeader title="C. Perhitungan PPh Pasal 21" />
              <FormRow no="12" label="Penghasilan Neto (8 - 11)" value={rupiah(data.penghasilanNetoSetahun)} />
              <FormRow no="13" label="Penghasilan Neto Masa Pajak Sebelumnya" value={rupiah(data.penghasilanNetoMasaSebelumnya)} />
              <FormRow no="14" label="JUMLAH PENGHASILAN NETO (12 + 13)" value={rupiah(data.jumlahPenghasilanNeto)} bold />
              <FormRow no="15" label="PTKP Setahun" value={rupiah(data.ptkpSetahun)} />
              <FormRow no="16" label="Penghasilan Kena Pajak (14 - 15)" value={rupiah(data.pkp)} bold />
              <FormRow no="17" label="PPh Pasal 21 Terutang Setahun" value={rupiah(data.pph21Setahun)} />
              <FormRow no="18" label="PPh Pasal 21 Ditanggung Pemerintah (DTP)" value={rupiah(data.pph21Dtp)} />
              <FormRow no="19" label="PPh Pasal 21 Masa Pajak Sebelumnya" value={rupiah(data.pph21MasaSebelumnya)} />
              <FormRow no="20" label="PPh Pasal 21 Terutang (17 - 18 - 19)" value={rupiah(data.pph21Terutang)} bold />
              <FormRow no="21" label="PPh Pasal 21 Telah Dipotong" value={rupiah(data.pph21TelahDipotong)} />
              <FormRow no="22" label={selisihLabel} value={rupiah(Math.abs(data.pph21Selisih))} bold />
            </tbody>
          </table>
        </div>
      </Card>

      {/* Selisih Summary */}
      <Card padding={false} className="p-5 print:shadow-none print:border-none">
        <div className="flex items-center gap-3">
          {data.pph21Selisih > 0 && (
            <>
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Kurang Bayar
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                PPh 21 kurang dipotong sebesar <strong className="text-slate-900 dark:text-white">{rupiah(data.pph21Selisih)}</strong> — selisih ini dipotong pada perhitungan masa pajak terakhir (Desember).
              </p>
            </>
          )}
          {data.pph21Selisih < 0 && (
            <>
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Lebih Bayar
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                PPh 21 lebih dipotong sebesar <strong className="text-slate-900 dark:text-white">{rupiah(Math.abs(data.pph21Selisih))}</strong> — selisih ini dikembalikan ke karyawan pada masa pajak terakhir.
              </p>
            </>
          )}
          {data.pph21Selisih === 0 && (
            <>
              <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Nihil
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                PPh 21 yang telah dipotong sesuai dengan pajak terutang — tidak ada selisih.
              </p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
