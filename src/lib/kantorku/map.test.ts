import { describe, expect, it } from "vitest";
import {
  branchForArea, mapBank, mapEmploymentType, mapGender, mapMarital, mapReligion, rowCells, toDmy, toKantorkuRow, toPhone62,
  type KkSource, type KkUnits,
} from "./map";
import { KK_BANKS, KK_COLUMNS } from "./spec";

// Unit = isi sheet "Existing Data" template Rica Rico (bukan data karyawan).
const UNITS: KkUnits = {
  branches: ["Jakarta 1 - Irfan", "Jakarta 2 - Rangga", "Rica Rico Pusat", "Jakarta 3 -", "Tangerang - Doni", "Bekasi - Winda"],
  departments: ["People & Culture", "Marketing", "Store Supervisor", "SPG", "Produksi", "Santen", "Driver/Delivery", "Host Live"],
  positions: ["Manager", "Staff", "Freelance", "Supervisor", "Koordinator SPV", "Kepala Produksi"],
};

// Karyawan fiktif.
const base = (over: Partial<KkSource> = {}): KkSource => ({
  full_name: "Sinta Maharani",
  nik: "3171234567890001",
  npwp: null,
  ptkp_status: "TK/0",
  join_date: "2026-03-02",
  employment_type: "PKWT",
  position: "SPG",
  bank_account: "123-456-7890",
  profile: {
    work_group: "spg", employment_label: "Pegawai Kontrak", email: "sinta.fiktif@example.com", phone: "0812-3456-7890",
    address: "Jl. Contoh No. 1", birth_date: "2001-07-09", birth_place: "Bogor", religion: "Kristen Protestan",
    gender: "Perempuan", marital_status: "Belum Kawin", emergency_name: "Rina", emergency_phone: "+62 (0)813 1111 2222",
    emergency_relation: "Kakak", bank_name: "Bank Central Asia (BCA)",
  },
  outletArea: "Jakarta 2",
  basicSalary: 4_900_000.4,
  hris: { account_holder: "SINTA MAHARANI", contract_end_date: "2027-03-01", taxability: "Gross" },
  ...over,
});

describe("normalisasi nilai ke pilihan KantorKu", () => {
  it("tanggal DD/MM/YYYY dan menolak tanggal mustahil", () => {
    expect(toDmy("2026-03-02")).toBe("02/03/2026");
    expect(toDmy("2026-02-30")).toBeNull();
    expect(toDmy("")).toBeNull();
  });
  it("nomor HP berawalan 62", () => {
    expect(toPhone62("0812-3456-7890")).toBe("6281234567890");
    expect(toPhone62("+62 (0)813 1111 2222")).toBe("6281311112222");
    expect(toPhone62("81311112222")).toBe("6281311112222");
    expect(toPhone62("12345")).toBeNull();
  });
  it("agama, jenis kelamin, status kawin", () => {
    expect(mapReligion("Kristen Protestan")).toBe("Christian");
    expect(mapReligion("Katholik")).toBe("Catholic");
    expect(mapReligion("Konghucu")).toBe("Confucious");
    expect(mapReligion("Budha")).toBe("Buddha");
    expect(mapReligion("Kepercayaan")).toBeNull();
    expect(mapGender("Laki-laki")).toBe("Male");
    expect(mapGender("P")).toBe("Female");
    expect(mapMarital("Belum Kawin")).toBe("Single");
    expect(mapMarital("Cerai Hidup")).toBe("Single");
    expect(mapMarital("Kawin")).toBe("Married");
  });
  it("bank ke KODE KantorKu, bukan nama", () => {
    expect(mapBank("Bank Central Asia (BCA)")).toBe("bca");
    expect(mapBank("BCA")).toBe("bca");
    expect(mapBank("BRI")).toBe("bri");
    expect(mapBank("Mandiri")).toBe("bank_mandiri");
    expect(mapBank("bank_bni")).toBe("bank_bni");
    expect(mapBank("SeaBank")).toBe("bank_seabank");
    expect(mapBank("Bank Mayapada")).toBe("bank_mayapada");
    expect(mapBank("Bank Antah Berantah")).toBeNull();
    // Kode contoh di template ("bank_bca") tidak ada di daftar bank — jangan dipakai.
    expect(KK_BANKS.some(([, c]) => c === "bank_bca")).toBe(false);
  });
  it("status kerja", () => {
    expect(mapEmploymentType("PKWTT", null)).toBe("permanent");
    expect(mapEmploymentType("PKWT", "Pegawai Kontrak")).toBe("contract");
    expect(mapEmploymentType("PKWT", "Freelance")).toBe("freelance");
    expect(mapEmploymentType("BELUM_DIISI", null)).toBeNull();
  });
  it("branch dari area outlet hanya bila cocok tepat satu", () => {
    expect(branchForArea("Jakarta 2", UNITS.branches)).toBe("Jakarta 2 - Rangga");
    expect(branchForArea("Jakarta 3", UNITS.branches)).toBe("Jakarta 3 -");
    expect(branchForArea("Jakarta", UNITS.branches)).toBeNull();
    expect(branchForArea(null, UNITS.branches)).toBeNull();
  });
});

describe("toKantorkuRow", () => {
  it("karyawan lengkap → siap impor, nilai persis format template", () => {
    const row = toKantorkuRow(base(), UNITS);
    expect(row.problems).toEqual([]);
    const v = row.values;
    expect(v).toMatchObject({
      fullName: "Sinta Maharani", companyEmail: "sinta.fiktif@example.com", employeeId: null,
      employmentType: "contract", startDate: "02/03/2026", endDate: "01/03/2027",
      taxSubject: "SPDN (Domestic Tax Subject)", taxStatus: "Pegawai Tetap", payeeTypeTidakTetap: null,
      paymentSchedule: "Monthly", currency: "IDR", basicSalary: 4_900_000, calculatePer: "Month", taxability: "Gross",
      nationality: "Indonesia", idType: "KTP", idNumber: "3171234567890001", mobilePhone: "6281234567890",
      birthDate: "09/07/2001", religion: "Christian", gender: "Female", maritalStatus: "Single",
      emergencyPhone: "6281311112222", bankCode: "bca", accountNumber: "1234567890", accountHolder: "SINTA MAHARANI",
      ptkp: "TK/0", branch: "Jakarta 2 - Rangga", department: "SPG", position: "Staff",
    });
    expect(row.derived).toEqual(expect.arrayContaining(["employmentType", "taxStatus", "branch", "department", "position"]));
    expect(row.derived).not.toContain("taxability"); // ditulis HR, bukan turunan
    expect(row.notes.join(" ")).toMatch(/Employee ID kosong/);
    expect(rowCells(row)).toHaveLength(KK_COLUMNS.length);
  });

  it("data pribadi yang kosong tidak ditebak", () => {
    const row = toKantorkuRow(base({ basicSalary: null, hris: { contract_end_date: "2027-03-01" }, ptkp_status: "BELUM_DIISI" }), UNITS);
    const keys = row.problems.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["basicSalary", "accountHolder", "taxability", "ptkp"]));
    expect(row.values.accountHolder).toBeNull(); // bukan otomatis nama karyawan
    expect(row.values.basicSalary).toBeNull();   // bukan 0
  });

  it("taxability bawaan perusahaan dipakai bila per karyawan kosong", () => {
    const row = toKantorkuRow(base({ hris: { account_holder: "X", contract_end_date: "2027-03-01" } }), UNITS, { taxability: "Gross Up" });
    expect(row.values.taxability).toBe("Gross Up");
    expect(row.derived).toContain("taxability");
  });

  it("kontrak tanpa tanggal akhir ditahan", () => {
    const row = toKantorkuRow(base({ hris: { account_holder: "X", taxability: "Gross" } }), UNITS);
    expect(row.problems.map((p) => p.key)).toContain("endDate");
  });

  it("freelance = Pegawai Tidak Tetap dan wajib Payee Type", () => {
    const src = base({ profile: { ...base().profile!, employment_label: "Freelance" } });
    const row = toKantorkuRow(src, UNITS);
    expect(row.values.employmentType).toBe("freelance");
    expect(row.values.taxStatus).toBe("Pegawai Tidak Tetap");
    expect(row.values.position).toBe("Freelance");
    expect(row.problems.map((p) => p.key)).toContain("payeeTypeTidakTetap");
    const ok = toKantorkuRow({ ...src, hris: { ...src.hris, payee_type: "Pegawai Tidak Tetap — Dibayarkan Bulanan (21-100-35)" } }, UNITS);
    expect(ok.problems).toEqual([]);
  });

  it("unit yang ditulis HR harus ada di KantorKu; tidak diganti turunan diam-diam", () => {
    const row = toKantorkuRow(base({ hris: { ...base().hris, branch: "Surabaya - Budi", department: "spg" } }), UNITS);
    expect(row.values.branch).toBeNull();
    expect(row.problems.find((p) => p.key === "branch")?.message).toMatch(/Surabaya - Budi/);
    expect(row.values.department).toBe("SPG"); // beda huruf besar-kecil saja = cocok
  });

  it("office tanpa department → ditahan (divisi tidak bisa diturunkan)", () => {
    const row = toKantorkuRow(base({ outletArea: null, profile: { ...base().profile!, work_group: "office" } }), UNITS);
    expect(row.problems.map((p) => p.key)).toEqual(expect.arrayContaining(["branch", "department"]));
  });

  it("NIK bukan 16 digit dan bank tak dikenal jadi masalah yang terbaca", () => {
    const row = toKantorkuRow(base({ nik: "31712345", profile: { ...base().profile!, bank_name: "Bank Antah" } }), UNITS);
    expect(row.problems.find((p) => p.key === "idNumber")?.message).toMatch(/8 digit/);
    expect(row.problems.find((p) => p.key === "bankCode")?.message).toMatch(/Bank Antah/);
  });
});
