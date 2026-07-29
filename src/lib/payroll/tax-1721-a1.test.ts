import { describe, expect, it } from "vitest";
import { buildForm1721A1 } from "./tax-1721-a1";
import type { PiEmployeeRow, PiPayrollLineRow } from "./pay-data";
import type { StatutoryConfig } from "./run-payroll";
import type { BiayaJabatanConfig, ProgressiveBracket, PtkpConfig } from "./types";

const PTKP: PtkpConfig = { base: 54_000_000, married: 4_500_000, dependent: 4_500_000, max_dependents: 3 };
const BIAYA_JABATAN: BiayaJabatanConfig = { rate: 0.05, monthly_cap: 500_000, annual_cap: 6_000_000 };
const PROGRESSIVE: ProgressiveBracket[] = [
  { upTo: 60_000_000, rate: 0.05 },
  { upTo: 250_000_000, rate: 0.15 },
  { upTo: 500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
];

const CONFIG = {
  ptkpConfig: PTKP,
  biayaJabatanConfig: BIAYA_JABATAN,
  progressiveRates: PROGRESSIVE,
} as StatutoryConfig;

function makeEmployee(overrides: Partial<PiEmployeeRow> = {}): PiEmployeeRow {
  return {
    id: "emp-001",
    tenant_id: "11111111-1111-4111-8111-111111111111",
    full_name: "Budi Santoso",
    nik: "3201012345670001",
    npwp: "09.111.222.3-011.000",
    ptkp_status: "TK/0",
    join_date: "2024-01-01",
    employment_type: "permanent",
    risk_class: "II",
    department: "Technology",
    bank_account: "1234567890",
    status: "active",
    ...overrides,
  };
}

function makeLine(overrides: Partial<PiPayrollLineRow> = {}): PiPayrollLineRow {
  return {
    id: crypto.randomUUID(),
    run_id: "run-001",
    employee_id: "emp-001",
    gross: 0,
    components: null,
    bpjs_employee: 0,
    bpjs_employer: 0,
    taxable_base: 0,
    pph21: 0,
    net: 0,
    other_deductions: null,
    ...overrides,
  };
}

function repeatLines(count: number, overrides: Partial<PiPayrollLineRow> = {}): PiPayrollLineRow[] {
  return Array.from({ length: count }, () => makeLine(overrides));
}

describe("buildForm1721A1", () => {
  it("tanpa payroll line -> semua nol, period 0-0", () => {
    const result = buildForm1721A1(makeEmployee(), [], CONFIG, "2025");

    expect(result.year).toBe("2025");
    expect(result.periodRange).toEqual({ startMonth: 0, endMonth: 0 });
    expect(result.gajiPokokSetahun).toBe(0);
    expect(result.jumlahPenghasilanBruto).toBe(0);
    expect(result.biayaJabatan).toBe(0);
    expect(result.pkp).toBe(0);
    expect(result.pph21Setahun).toBe(0);
    expect(result.pph21Selisih).toBe(0);
  });

  // 12 bulan x Rp 12.000.000 bruto, tanpa THR/lembur/BPJS.
  // Biaya jabatan 5% x 144jt = 7.2jt > cap 6jt -> pakai cap.
  // PKP = 84jt -> 60jt*5% + 24jt*15% = 6.600.000.
  it("pegawai sederhana — biaya jabatan ke-cap, selisih positif (kurang bayar)", () => {
    const lines = repeatLines(12, { gross: 12_000_000, pph21: 500_000 });
    const result = buildForm1721A1(makeEmployee(), lines, CONFIG, "2025");

    expect(result.gajiPokokSetahun).toBe(144_000_000);
    expect(result.tunjanganLainDanLemburSetahun).toBe(0);
    expect(result.thrDanBonusSetahun).toBe(0);
    expect(result.premiAsuransiPemberiKerjaSetahun).toBe(0);
    expect(result.jumlahPenghasilanBruto).toBe(144_000_000);

    expect(result.biayaJabatan).toBe(6_000_000);
    expect(result.iuranPensiunDanJhtPegawaiSetahun).toBe(0);
    expect(result.jumlahPengurang).toBe(6_000_000);

    expect(result.penghasilanNetoSetahun).toBe(138_000_000);
    expect(result.ptkpSetahun).toBe(54_000_000);
    expect(result.pkp).toBe(84_000_000);
    expect(result.pph21Setahun).toBe(6_600_000);
    expect(result.pph21TelahDipotong).toBe(6_000_000);
    expect(result.pph21Selisih).toBe(600_000);

    expect(result.periodRange).toEqual({ startMonth: 1, endMonth: 12 });
  });

  // 12 bulan dengan lembur dan BPJS, status K/2 (PTKP 67.5jt).
  // Premi asuransi pemberi kerja (JKK+JKM+Kes) masuk bruto 1721-A1.
  // Iuran pensiun karyawan (JHT+JP) jadi pengurang.
  it("pegawai dengan lembur dan BPJS — dekomposisi bruto lengkap", () => {
    const lines = repeatLines(12, {
      gross: 15_000_000,
      pph21: 400_000,
      components: {
        overtimePay: 500_000,
        bpjs: {
          employer: { jkk: 36_000, jkm: 45_000, kesehatan: 600_000 },
          employee: { jht: 300_000, jp: 150_000 },
        },
      },
    });

    const result = buildForm1721A1(
      makeEmployee({ ptkp_status: "K/2" }),
      lines,
      CONFIG,
      "2025",
    );

    // Dekomposisi bruto: gaji pokok = gross - THR - lembur
    expect(result.gajiPokokSetahun).toBe(174_000_000); // (15jt - 0 - 500rb) * 12
    expect(result.tunjanganLainDanLemburSetahun).toBe(6_000_000);
    expect(result.thrDanBonusSetahun).toBe(0);
    expect(result.premiAsuransiPemberiKerjaSetahun).toBe(8_172_000); // (36+45+600)*12

    // Bruto = grossTotal + premi asuransi pemberi kerja
    expect(result.jumlahPenghasilanBruto).toBe(188_172_000);

    // Pengurang
    expect(result.biayaJabatan).toBe(6_000_000); // capped
    expect(result.iuranPensiunDanJhtPegawaiSetahun).toBe(5_400_000); // (300+150)*12

    // Neto & PPh 21
    expect(result.penghasilanNetoSetahun).toBe(176_772_000);
    expect(result.ptkpSetahun).toBe(67_500_000);
    expect(result.pkp).toBe(109_272_000);
    // 60jt*5% + 49.272jt*15% = 3jt + 7.390.800 = 10.390.800
    expect(result.pph21Setahun).toBe(10_390_800);
    expect(result.pph21TelahDipotong).toBe(4_800_000);
    expect(result.pph21Selisih).toBe(5_590_800);
  });

  // PPh21 sudah dipotong Jan-Des melebihi pajak terutang setahun ->
  // selisih negatif = kelebihan potong (dikembalikan ke karyawan).
  it("kelebihan potong — selisih negatif", () => {
    const lines = repeatLines(12, { gross: 12_000_000, pph21: 600_000 });
    const result = buildForm1721A1(makeEmployee(), lines, CONFIG, "2025");

    expect(result.pph21Setahun).toBe(6_600_000);
    expect(result.pph21TelahDipotong).toBe(7_200_000);
    expect(result.pph21Selisih).toBe(-600_000);
  });

  // Neto di bawah PTKP -> PKP nol -> pajak nol.
  it("neto di bawah PTKP — PKP nol, pajak nol", () => {
    const lines = repeatLines(12, { gross: 5_000_000, pph21: 50_000 });
    const result = buildForm1721A1(
      makeEmployee({ ptkp_status: "K/3" }), // PTKP = 72jt
      lines,
      CONFIG,
      "2025",
    );

    expect(result.jumlahPenghasilanBruto).toBe(60_000_000);
    expect(result.ptkpSetahun).toBe(72_000_000);
    expect(result.pkp).toBe(0);
    expect(result.pph21Setahun).toBe(0);
    expect(result.pph21Selisih).toBe(-600_000); // overpaid
  });

  it("menyertakan data karyawan & pemberi kerja dari input", () => {
    const emp = makeEmployee({ full_name: "Siti Rahma", nik: "3201999988880001", npwp: "77.888.999.0-111.000" });
    const result = buildForm1721A1(emp, [], CONFIG, "2025", "01.234.567.8-012.000");

    expect(result.employee.full_name).toBe("Siti Rahma");
    expect(result.employee.nik).toBe("3201999988880001");
    expect(result.employee.npwp).toBe("77.888.999.0-111.000");
    expect(result.employer.npwp).toBe("01.234.567.8-012.000");
  });

  // THR masuk Section A7 terpisah dari gaji pokok.
  it("THR dipisahkan dari gaji pokok di Section A", () => {
    const lines = [
      ...repeatLines(11, { gross: 10_000_000, pph21: 200_000 }),
      makeLine({ gross: 20_000_000, pph21: 500_000, components: { thrAmount: 10_000_000 } }),
    ];
    const result = buildForm1721A1(makeEmployee(), lines, CONFIG, "2025");

    expect(result.gajiPokokSetahun).toBe(120_000_000); // 130jt total - 10jt THR
    expect(result.thrDanBonusSetahun).toBe(10_000_000);
    expect(result.jumlahPenghasilanBruto).toBe(130_000_000);
  });
});
