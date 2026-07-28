import { describe, expect, it } from "vitest";
import { buildPayslip } from "./payslip";
import type { EmployeeRecord } from "./payslip";
import type { CompanyProfile } from "./company-profile";
import type { Compensation, PayrollLineResult } from "./run-payroll";

const COMPANY: CompanyProfile = {
  id: "test_company",
  name: "PT Sintetis Nusantara Demo",
  shortName: "Sintetis Demo",
  address: "Jl. Portofolio No. 1, Jakarta",
  signerName: "Arsène Wenger",
  signerTitle: "HRGA",
  tagline: "Demo TV & Garment",
  industry: "broadcast",
  headcountTarget: 100,
};

const EKO: EmployeeRecord = {
  full_name: "Eko Nugroho",
  nik: "3201010507850005",
  npwp: "09.111.222.3-011.003",
  ptkp_status: "K/0",
  employment_type: "PKWTT",
  department: "Divisi Kreatif & Program Siaran TV",
  bank_account: null,
};

// Eko Nugroho: upah pokok 8.5jt + Tunjangan Jabatan 1.5jt = gross 10jt (angka nyata seed,
// cocok dengan output run-seed-payroll: BPJS Kry 400.000, PPh21 200.000, net 9.400.000).
const EKO_COMP: Compensation = {
  upah_pokok: 8_500_000,
  tunjangan_tetap: [{ name: "Tunjangan Jabatan", amount: 1_500_000 }],
  tunjangan_tidak_tetap: [],
};

const EKO_RESULT: PayrollLineResult = {
  gross: 10_000_000,
  bpjsWageBase: 10_000_000,
  overtimePay: 0,
  thrAmount: 0,
  pieceRatePay: 0,
  bpjs: {
    employee: { jht: 200_000, jp: 100_000, kesehatan: 100_000, total: 400_000 },
    employer: { jht: 370_000, jp: 200_000, jkk: 54_000, jkm: 30_000, kesehatan: 400_000, total: 1_054_000 },
  },
  pph21: 200_000,
  net: 9_400_000,
  isDecemberReconciliation: false,
};

describe("buildPayslip", () => {
  it("meng-itemisasi pendapatan: upah pokok + tunjangan tetap, cocok dengan gross", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY);
    expect(slip.earnings).toEqual([
      { label: "Upah Pokok", amount: 8_500_000 },
      { label: "Tunjangan Jabatan", amount: 1_500_000 },
    ]);
    expect(slip.grossTotal).toBe(10_000_000);
  });

  it("meng-itemisasi potongan BPJS karyawan + PPh21, dan net = gross - potongan", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY);
    expect(slip.deductions.map((d) => d.amount)).toEqual([200_000, 100_000, 100_000, 200_000]);
    expect(slip.deductionsTotal).toBe(600_000);
    expect(slip.net).toBe(9_400_000);
  });

  it("menampilkan kontribusi pemberi kerja terpisah (informasi, bukan potongan)", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY);
    expect(slip.employerContributions).toHaveLength(5);
    expect(slip.employerContributionsTotal).toBe(1_054_000);
  });

  it("mem-mask NPWP dan menandai NIK/rekening sesuai PDP", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY);
    expect(slip.employee.npwpMasked).toBe("09.***.***.*-***.003");
    expect(slip.employee.nikMasked).toBe("3201********0005");
    expect(slip.employee.bankAccountMasked).toBe("—"); // seed tanpa rekening
  });

  it("menyertakan baris lembur & THR hanya bila > 0", () => {
    const withExtras: PayrollLineResult = {
      ...EKO_RESULT,
      gross: 10_775_000, // 10jt + 275.000 lembur + 500.000 THR
      overtimePay: 275_000,
      thrAmount: 500_000,
      pieceRatePay: 0,
      net: 10_175_000, // 10.775.000 - 600.000
    };
    const slip = buildPayslip(EKO, EKO_COMP, withExtras, "2026-04", COMPANY);
    const labels = slip.earnings.map((e) => e.label);
    expect(labels).toContain("Upah Lembur");
    expect(labels).toContain("THR Keagamaan");
  });

  it("melempar error bila jumlah pendapatan tidak cocok dengan gross engine (deteksi drift)", () => {
    const broken: PayrollLineResult = { ...EKO_RESULT, gross: 9_999_999 };
    expect(() => buildPayslip(EKO, EKO_COMP, broken, "2026-01", COMPANY)).toThrow(/Integritas/);
  });

  it("melempar error bila gross - potongan tidak sama dengan net engine", () => {
    const broken: PayrollLineResult = { ...EKO_RESULT, net: 1 };
    expect(() => buildPayslip(EKO, EKO_COMP, broken, "2026-01", COMPANY)).toThrow(/Integritas/);
  });

  it("tanpa otherDeductions: hasOtherDeductions false, net = net engine (perilaku lama utuh)", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY);
    expect(slip.hasOtherDeductions).toBe(false);
    expect(slip.net).toBe(9_400_000);
  });

  it("dengan otherDeductions (kasbon): ikut di-itemisasi dan mengurangi net final", () => {
    const slip = buildPayslip(EKO, EKO_COMP, EKO_RESULT, "2026-01", COMPANY, [
      { label: "Kasbon", amount: 300_000 },
      { label: "Denda Keterlambatan", amount: 50_000 },
    ]);
    expect(slip.hasOtherDeductions).toBe(true);
    expect(slip.deductions.map((d) => d.label)).toEqual([
      "BPJS JHT (Jaminan Hari Tua)", "BPJS JP (Jaminan Pensiun)", "BPJS Kesehatan", "PPh 21",
      "Kasbon", "Denda Keterlambatan",
    ]);
    expect(slip.deductionsTotal).toBe(950_000); // 600.000 statutori + 350.000 kasbon/denda
    expect(slip.net).toBe(9_050_000); // 9.400.000 - 350.000
  });
});
