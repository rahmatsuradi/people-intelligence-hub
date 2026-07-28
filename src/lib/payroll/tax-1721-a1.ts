import type { PiEmployeeRow, PiPayrollLineRow } from "./pay-data";
import type { StatutoryConfig } from "./run-payroll";
import { computePTKPAnnual, computeProgressiveTax } from "./pph21-annual";
import { resolveCompanyProfile } from "./company-profile";
import type { PtkpStatus } from "./types";

export interface Form1721A1Result {
  year: string;
  employee: {
    id: string;
    full_name: string;
    nik: string | null;
    npwp: string | null;
    ptkp_status: string;
    join_date: string;
    employment_type: string;
    department: string | null;
  };
  employer: {
    name: string;
    npwp: string;
    signerName: string;
    signerTitle: string;
  };
  periodRange: {
    startMonth: number;
    endMonth: number;
  };

  // Section A: Penghasilan Bruto (1 s.d. 7)
  gajiPokokSetahun: number;
  tunjanganPPh: number;
  tunjanganLainDanLemburSetahun: number;
  honorariumSetahun: number;
  premiAsuransiPemberiKerjaSetahun: number;
  naturaSetahun: number;
  thrDanBonusSetahun: number;
  jumlahPenghasilanBruto: number;

  // Section B: Pengurang (9 s.d. 11)
  biayaJabatan: number;
  iuranPensiunDanJhtPegawaiSetahun: number;
  jumlahPengurang: number;

  // Section C: Perhitungan PPh Pasal 21 (12 s.d. 22)
  penghasilanNetoSetahun: number;
  penghasilanNetoMasaSebelumnya: number;
  jumlahPenghasilanNeto: number;
  ptkpSetahun: number;
  pkp: number;
  pph21Setahun: number;
  pph21Dtp: number;
  pph21MasaSebelumnya: number;
  pph21Terutang: number;
  pph21TelahDipotong: number;
  pph21Selisih: number;
}

export function buildForm1721A1(
  employee: PiEmployeeRow,
  lines: PiPayrollLineRow[],
  statutoryConfig: StatutoryConfig,
  year: string,
  employerNpwp: string = "01.234.567.8-012.000"
): Form1721A1Result {
  const companyProfile = resolveCompanyProfile();

  let grossTotal = 0;
  let thrTotal = 0;
  let overtimeTotal = 0;
  let employerInsuranceTotal = 0;
  let employeePensiunTotal = 0;
  let pph21DipotongTotal = 0;

  for (const line of lines) {
    const gross = Number(line.gross) || 0;
    const pph21 = Number(line.pph21) || 0;
    grossTotal += gross;
    pph21DipotongTotal += pph21;

    if (line.components) {
      if (line.components.thrAmount) {
        thrTotal += Number(line.components.thrAmount) || 0;
      }
      if (line.components.overtimePay) {
        overtimeTotal += Number(line.components.overtimePay) || 0;
      }
      if (line.components.bpjs?.employer) {
        const emp = line.components.bpjs.employer;
        // JKK + JKM + BPJS Kesehatan (employer) are taxable insurance premiums included in 1721-A1 Gross
        const insurance = (Number(emp.jkk) || 0) + (Number(emp.jkm) || 0) + (Number(emp.kesehatan) || 0);
        employerInsuranceTotal += insurance;
      }
      if (line.components.bpjs?.employee) {
        const emp = line.components.bpjs.employee;
        // JHT + JP paid by employee
        const pensiunJht = (Number(emp.jht) || 0) + (Number(emp.jp) || 0);
        employeePensiunTotal += pensiunJht;
      }
    }
  }

  const gajiPokokSetahun = Math.max(0, grossTotal - thrTotal - overtimeTotal);
  const tunjanganLainDanLemburSetahun = overtimeTotal;
  const thrDanBonusSetahun = thrTotal;
  const premiAsuransiPemberiKerjaSetahun = Math.round(employerInsuranceTotal);

  const jumlahPenghasilanBruto = Math.round(grossTotal + premiAsuransiPemberiKerjaSetahun);

  const biayaJabatan = Math.round(
    Math.min(jumlahPenghasilanBruto * statutoryConfig.biayaJabatanConfig.rate, statutoryConfig.biayaJabatanConfig.annual_cap)
  );

  const iuranPensiunDanJhtPegawaiSetahun = Math.round(employeePensiunTotal);
  const jumlahPengurang = biayaJabatan + iuranPensiunDanJhtPegawaiSetahun;

  const penghasilanNetoSetahun = jumlahPenghasilanBruto - jumlahPengurang;
  const jumlahPenghasilanNeto = penghasilanNetoSetahun;

  const ptkpStatus = (employee.ptkp_status || "TK/0") as PtkpStatus;
  const ptkpSetahun = computePTKPAnnual(ptkpStatus, statutoryConfig.ptkpConfig);

  const pkp = Math.max(0, Math.floor((jumlahPenghasilanNeto - ptkpSetahun) / 1000) * 1000);

  const pph21Setahun = computeProgressiveTax(pkp, statutoryConfig.progressiveRates);

  const pph21Terutang = pph21Setahun;
  const pph21TelahDipotong = Math.round(pph21DipotongTotal);
  const pph21Selisih = pph21Terutang - pph21TelahDipotong;

  return {
    year,
    employee: {
      id: employee.id,
      full_name: employee.full_name,
      nik: employee.nik,
      npwp: employee.npwp,
      ptkp_status: employee.ptkp_status,
      join_date: employee.join_date,
      employment_type: employee.employment_type,
      department: employee.department,
    },
    employer: {
      name: companyProfile.name,
      npwp: employerNpwp,
      signerName: companyProfile.signerName,
      signerTitle: companyProfile.signerTitle,
    },
    periodRange: {
      startMonth: lines.length > 0 ? 1 : 0,
      endMonth: lines.length,
    },
    gajiPokokSetahun: Math.round(gajiPokokSetahun),
    tunjanganPPh: 0,
    tunjanganLainDanLemburSetahun: Math.round(tunjanganLainDanLemburSetahun),
    honorariumSetahun: 0,
    premiAsuransiPemberiKerjaSetahun,
    naturaSetahun: 0,
    thrDanBonusSetahun: Math.round(thrDanBonusSetahun),
    jumlahPenghasilanBruto,
    biayaJabatan,
    iuranPensiunDanJhtPegawaiSetahun,
    jumlahPengurang,
    penghasilanNetoSetahun: Math.round(penghasilanNetoSetahun),
    penghasilanNetoMasaSebelumnya: 0,
    jumlahPenghasilanNeto: Math.round(jumlahPenghasilanNeto),
    ptkpSetahun,
    pkp,
    pph21Setahun,
    pph21Dtp: 0,
    pph21MasaSebelumnya: 0,
    pph21Terutang,
    pph21TelahDipotong,
    pph21Selisih,
  };
}
