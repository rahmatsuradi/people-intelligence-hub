import type { CompanyProfile } from "./company-profile";
import { maskBankAccount, maskNik, maskNpwp } from "./payslip-masking";
import type { Compensation, PayrollLineResult, PieceRateInput } from "./run-payroll";

export interface PayslipLine {
  label: string;
  amount: number;
}

export interface PayslipEmployeeInfo {
  name: string;
  department: string;
  employmentType: string;
  ptkpStatus: string;
  npwpMasked: string;
  nikMasked: string;
  bankAccountMasked: string;
}

export interface PayslipData {
  company: CompanyProfile;
  period: string; // 'YYYY-MM'
  employee: PayslipEmployeeInfo;
  earnings: PayslipLine[];
  grossTotal: number;
  deductions: PayslipLine[];
  deductionsTotal: number;
  bpjsTotal: number;
  pph21: number;
  net: number;
  hasOtherDeductions: boolean; // true bila ada potongan non-statutori (kasbon/denda) diterapkan
  // Blok informasi (BUKAN potongan gaji karyawan): kontribusi/beban pemberi kerja.
  employerContributions: PayslipLine[];
  employerContributionsTotal: number;
  isDecemberReconciliation: boolean;
}

export interface EmployeeRecord {
  full_name: string;
  nik: string | null;
  npwp: string | null;
  ptkp_status: string;
  employment_type: string;
  department?: string | null;
  bank_account?: string | null;
}

export function buildPayslip(
  employee: EmployeeRecord,
  compensation: Compensation,
  result: PayrollLineResult,
  period: string,
  company: CompanyProfile,
  otherDeductions: PayslipLine[] = [],
  pieceRates: PieceRateInput[] = []
): PayslipData {

  const earnings: PayslipLine[] = [{ label: "Upah Pokok", amount: compensation.upah_pokok }];
  for (const t of compensation.tunjangan_tetap) {
    earnings.push({ label: t.name, amount: t.amount });
  }
  for (const t of compensation.tunjangan_tidak_tetap) {
    earnings.push({ label: t.name, amount: t.amount });
  }
  for (const p of pieceRates) {
    earnings.push({ label: `Honor Siaran & Kreatif: ${p.label} (${p.quantity} x ${p.rate})`, amount: p.quantity * p.rate });
  }
  if (result.overtimePay > 0) earnings.push({ label: "Upah Lembur", amount: result.overtimePay });
  if (result.thrAmount > 0) earnings.push({ label: "THR Keagamaan", amount: result.thrAmount });

  const earningsSum = earnings.reduce((sum, e) => sum + e.amount, 0);
  if (earningsSum !== result.gross) {
    throw new Error(
      `Integritas slip: jumlah pendapatan (${earningsSum}) != gross engine (${result.gross}) untuk ${employee.full_name}`,
    );
  }

  const statutoryDeductions: PayslipLine[] = [
    { label: "BPJS JHT (Jaminan Hari Tua)", amount: result.bpjs.employee.jht },
    { label: "BPJS JP (Jaminan Pensiun)", amount: result.bpjs.employee.jp },
    { label: "BPJS Kesehatan", amount: result.bpjs.employee.kesehatan },
    { label: "PPh 21", amount: result.pph21 },
  ];
  const statutoryDeductionsTotal = result.bpjs.employee.total + result.pph21;
  if (result.gross - statutoryDeductionsTotal !== result.net) {
    throw new Error(
      `Integritas slip: gross - potongan (${result.gross - statutoryDeductionsTotal}) != net engine (${result.net}) untuk ${employee.full_name}`,
    );
  }

  const otherDeductionsTotal = otherDeductions.reduce((sum, d) => sum + d.amount, 0);
  const deductions = [...statutoryDeductions, ...otherDeductions];
  const deductionsTotal = statutoryDeductionsTotal + otherDeductionsTotal;
  const net = result.net - otherDeductionsTotal;

  const employerContributions: PayslipLine[] = [
    { label: "BPJS JHT", amount: result.bpjs.employer.jht },
    { label: "BPJS JP", amount: result.bpjs.employer.jp },
    { label: "BPJS JKK (Kecelakaan Kerja)", amount: result.bpjs.employer.jkk },
    { label: "BPJS JKM (Kematian)", amount: result.bpjs.employer.jkm },
    { label: "BPJS Kesehatan", amount: result.bpjs.employer.kesehatan },
  ];

  return {
    company,
    period,
    employee: {
      name: employee.full_name,
      department: employee.department ?? "—",
      employmentType: employee.employment_type,
      ptkpStatus: employee.ptkp_status,
      npwpMasked: maskNpwp(employee.npwp),
      nikMasked: maskNik(employee.nik),
      bankAccountMasked: maskBankAccount(employee.bank_account ?? null),
    },
    earnings,
    grossTotal: result.gross,
    deductions,
    deductionsTotal,
    bpjsTotal: result.bpjs.employee.total,
    pph21: result.pph21,
    net,
    hasOtherDeductions: otherDeductions.length > 0,
    employerContributions,
    employerContributionsTotal: result.bpjs.employer.total,
    isDecemberReconciliation: result.isDecemberReconciliation,
  };
}
