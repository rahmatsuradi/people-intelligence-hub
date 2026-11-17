import { describe, expect, it } from "vitest";
import { bankOptions, buildApplyPatch, diffWithMaster, INTAKE_FIELDS, matchOutlet, maskTail, suggestPtkp, validateIntake } from "./intake";

const CTX = { departments: ["SPG", "Produksi", "Admin Finance"] };
const NOW = new Date("2026-11-17T03:00:00Z");

// Karyawan fiktif.
const full = (): Record<string, string> => ({
  full_name: "  Dewi   Lestari ", nickname: "Dewi", nik: "3171 2345 6789 0001", birth_place: "Depok", birth_date: "2002-04-05",
  gender: "Perempuan", religion: "Islam", marital_status: "Belum Kawin", dependents: "0", mother_name: "Siti",
  phone: "0812-1111-2222", email: "Dewi.Fiktif@Example.com", address: "Jl. Contoh 2",
  emergency_name: "Budi", emergency_phone: "0813 3333 4444", emergency_relation: "Orang tua",
  education_level: "SMA/SMK", education_institution: "SMA Contoh", join_date: "2026-10-01", position: "SPG", department: "SPG",
  outlet: "Mall Contoh", supervisor_name: "Rangga", bank_code: "bca", bank_account: "123 456 7890", account_holder: "DEWI LESTARI",
});

describe("validateIntake", () => {
  it("isian lengkap dirapikan ke format master", () => {
    const { clean, errors } = validateIntake({ ...full(), unknown_key: "x" }, CTX, new Set(), NOW);
    expect(errors).toEqual({});
    expect(clean).toMatchObject({ full_name: "Dewi Lestari", nik: "3171234567890001", phone: "6281211112222", email: "dewi.fiktif@example.com", bank_account: "1234567890" });
    expect(clean).not.toHaveProperty("unknown_key");
  });
  it("menolak isian yang salah dengan pesan untuk pengisi", () => {
    const { errors } = validateIntake({ ...full(), nik: "12345", religion: "Lainnya", department: "Gudang", birth_date: "2020-01-01", emergency_phone: "081211112222", phone: "081211112222", bank_code: "bank_xyz" }, CTX, new Set(), NOW);
    expect(errors.nik).toMatch(/16 digit/);
    expect(errors.religion).toMatch(/Pilih/);
    expect(errors.department).toMatch(/Pilih/);
    expect(errors.birth_date).toMatch(/tahun lahir/);
    expect(errors.emergency_phone).toMatch(/orang lain/);
    expect(errors.bank_code).toBeDefined();
  });
  it("wajib kosong ditolak, kecuali field sensitif yang dipertahankan dari master", () => {
    const a = full(); delete a.nik; delete a.bank_account;
    expect(Object.keys(validateIntake(a, CTX, new Set(), NOW).errors)).toEqual(["nik", "bank_account"]);
    expect(validateIntake(a, CTX, new Set(["nik", "bank_account"]), NOW).errors).toEqual({});
  });
  it("setiap field punya section yang dikenal", () => {
    expect(INTAKE_FIELDS.every((f) => f.section)).toBe(true);
    expect(new Set(INTAKE_FIELDS.map((f) => f.key)).size).toBe(INTAKE_FIELDS.length);
  });
});

describe("suggestPtkp", () => {
  it("TK/K + tanggungan, karyawati kawin TK/0", () => {
    expect(suggestPtkp({ marital_status: "Belum Kawin", dependents: "0", gender: "Laki-laki" }).ptkp).toBe("TK/0");
    expect(suggestPtkp({ marital_status: "Kawin", dependents: "2", gender: "Laki-laki" }).ptkp).toBe("K/2");
    expect(suggestPtkp({ marital_status: "Cerai Hidup", dependents: "1", gender: "Laki-laki" }).ptkp).toBe("TK/1");
    const w = suggestPtkp({ marital_status: "Kawin", dependents: "2", gender: "Perempuan" });
    expect(w.ptkp).toBe("TK/0");
    expect(w.note).toMatch(/Pasal 9/);
    expect(suggestPtkp({}).ptkp).toBeNull();
  });
});

describe("penerapan ke master", () => {
  it("patch hanya membawa field yang diisi", () => {
    const { clean } = validateIntake(full(), CTX, new Set(), NOW);
    delete clean.nik;
    const p = buildApplyPatch(clean, { ktp: "t/s/ktp.jpg" });
    expect(p.core).not.toHaveProperty("nik");
    expect(p.core.bank_account).toBe("1234567890");
    expect(p.profile.bank_name).toBe("BCA");
    expect(p.profile.ktp_url).toBe("storage:pi-employee-docs/t/s/ktp.jpg");
    expect(p.profile).not.toHaveProperty("kk_url");
    expect(p.hris).toMatchObject({ account_holder: "DEWI LESTARI", department: "SPG" });
    expect(p.outletName).toBe("Mall Contoh");
  });
  it("diff mengabaikan beda format, menandai yang benar-benar berubah", () => {
    const { clean } = validateIntake(full(), CTX, new Set(), NOW);
    const d = diffWithMaster(clean, { full_name: "DEWI LESTARI", phone: "+62 812 1111 2222", bank_code: "Bank Central Asia", nik: null, position: "Kasir" });
    const keys = d.map((x) => x.key);
    expect(keys).not.toContain("full_name");
    expect(keys).not.toContain("phone");
    expect(keys).not.toContain("bank_code");
    expect(d.find((x) => x.key === "nik")).toMatchObject({ before: null, sensitive: true });
    expect(d.find((x) => x.key === "position")).toMatchObject({ before: "Kasir", after: "SPG" });
  });
  it("cocok outlet & samaran", () => {
    expect(matchOutlet(" mall  contoh ", [{ id: "1", name: "Mall Contoh" }])?.id).toBe("1");
    expect(matchOutlet("Mall Lain", [{ id: "1", name: "Mall Contoh" }])).toBeNull();
    expect(maskTail("3171234567890001")).toBe("•••• 0001");
    expect(maskTail("")).toBeNull();
  });
  it("bank populer di depan", () => {
    expect(bankOptions().slice(0, 2).map((b) => b.code)).toEqual(["bca", "bri"]);
  });
});
