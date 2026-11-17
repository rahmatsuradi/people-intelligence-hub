/* ═══════════════════════════════════════════════════════════════════════════
   Master karyawan web → satu baris template impor KantorKu. Fungsi murni (diuji di
   map.test.ts): tidak membaca database, tidak menebak data pribadi.

   Aturannya:
   - Nilai yang sudah ditulis HR di "Data KantorKu" (pi_employee_hris) selalu dipakai.
   - Nilai turunan hanya untuk kolom administratif yang memang bisa diturunkan dari data
     yang ada (agama "Kristen" → "Christian", outlet area Jakarta 1 → Branch "Jakarta 1 - …").
     Kolom yang diturunkan dicatat di `derived` supaya HR bisa melihatnya sebelum impor.
   - Data pribadi yang kosong TIDAK diisi tebakan (nama pemilik rekening ≠ otomatis nama
     karyawan, gaji pokok ≠ 0). Yang wajib tapi kosong menjadi `problems` dan baris itu
     tidak siap diimpor.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  KK_BANKS, KK_CALCULATE_PER, KK_EMPLOYMENT_TYPES, KK_PAYEE_TIDAK_TETAP, KK_PAYMENT_SCHEDULE, KK_PTKP,
  KK_TAXABILITY, KK_TAX_STATUSES_SUPPORTED, KK_TAX_SUBJECT, KK_TYPES_NEED_END_DATE, KK_COLUMNS,
  type KkEmploymentType, type KkKey, type KkTaxStatus,
} from "./spec";

/** Kolom tambahan khusus KantorKu (tabel pi_employee_hris). Semua opsional. */
export interface HrisFields {
  kantorku_employee_id?: string | null;
  company_email?: string | null;
  employment_type?: string | null;     // nilai KantorKu: permanent, contract, …
  contract_end_date?: string | null;   // ISO yyyy-mm-dd
  tax_status?: string | null;
  payee_type?: string | null;
  payment_schedule?: string | null;
  calculate_per?: string | null;
  taxability?: string | null;
  account_holder?: string | null;
  bpjs_tk_number?: string | null;
  bpjs_kes_number?: string | null;
  branch?: string | null;
  department?: string | null;
  position?: string | null;
}

export interface KkSource {
  full_name: string;
  nik: string | null;
  npwp?: string | null;
  ptkp_status?: string | null;
  join_date: string | null;
  employment_type: string | null;   // pi_employees: PKWT | PKWTT | BELUM_DIISI | …
  position: string | null;
  bank_account: string | null;
  profile: {
    work_group?: string | null;
    employment_label?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    birth_date?: string | null;
    birth_place?: string | null;
    religion?: string | null;
    gender?: string | null;
    marital_status?: string | null;
    emergency_name?: string | null;
    emergency_phone?: string | null;
    emergency_relation?: string | null;
    bank_name?: string | null;
  } | null;
  /** Area outlet penempatan (pi_outlets.area), mis. "Jakarta 1". */
  outletArea?: string | null;
  /** Upah pokok terbaru (pi_compensation). null = belum tercatat. */
  basicSalary?: number | null;
  hris?: HrisFields | null;
}

/** Unit perusahaan yang sudah diatur di KantorKu (sheet "Existing Data" template). */
export interface KkUnits { branches: string[]; departments: string[]; positions: string[] }

/** Nilai bawaan perusahaan untuk kolom yang sama bagi hampir semua karyawan. */
export interface KkDefaults { taxability?: string | null }

export type KkValue = string | number | null;
export interface KkProblem { key: KkKey; message: string }
export interface KkRow {
  values: Record<KkKey, KkValue>;
  problems: KkProblem[];
  /** Kolom yang diisi dari turunan (bukan ditulis HR/karyawan langsung). */
  derived: KkKey[];
  /** Info yang bukan penghalang impor, mis. Employee ID akan dibuat KantorKu. */
  notes: string[];
}

/* ─── Normalisasi ─── */

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const lower = (s: string | null | undefined) => clean(s).toLowerCase();
const has = (v: string | null | undefined): v is string => clean(v) !== "";
const pick = <T extends string>(list: readonly T[], v: string | null | undefined): T | null =>
  list.find((x) => x.toLowerCase() === lower(v)) ?? null;

/** ISO yyyy-mm-dd → DD/MM/YYYY. Nilai yang bukan tanggal sah → null. */
export function toDmy(iso: string | null | undefined): string | null {
  const m = clean(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return null;
  return `${d}/${mo}/${y}`;
}

/** Nomor HP Indonesia → 62xxxxxxxxx (format yang diminta template). Tidak dikenali → null. */
export function toPhone62(raw: string | null | undefined): string | null {
  let s = clean(raw).replace(/\(0\)/g, "");
  if (!s) return null;
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/\D/g, "");
  if (s.startsWith("0")) s = "62" + s.slice(1);
  else if (s.startsWith("8")) s = "62" + s;
  if (!/^62\d{8,13}$/.test(s)) return null;
  return s;
}

export function toDigits(raw: string | null | undefined): string | null {
  const d = clean(raw).replace(/\D/g, "");
  return d || null;
}

export function mapReligion(v: string | null | undefined): string | null {
  const s = lower(v);
  if (!s) return null;
  if (/islam|muslim/.test(s)) return "Islam";
  if (/kat(h)?oli|catholic/.test(s)) return "Catholic";
  if (/kristen|protestan|christian/.test(s)) return "Christian";
  if (/bud(d)?h/.test(s)) return "Buddha";
  if (/hindu/.test(s)) return "Hindu";
  if (/k(h)?onghucu|confuci/.test(s)) return "Confucious";
  if (/undisclosed|tidak (ingin|mau) (menyebut|disebut)/.test(s)) return "Undisclosed";
  return null;
}

export function mapGender(v: string | null | undefined): string | null {
  const s = lower(v);
  if (!s) return null;
  if (/^(l|lk|m)$|laki|pria|^male/.test(s)) return "Male";
  if (/^(p|pr|f|w)$|perempuan|wanita|female/.test(s)) return "Female";
  return null;
}

/** KantorKu hanya mengenal Single/Married: cerai (hidup/mati) = Single. */
export function mapMarital(v: string | null | undefined): string | null {
  const s = lower(v);
  if (!s) return null;
  if (/belum|lajang|single|cerai|janda|duda|divorce|widow/.test(s)) return "Single";
  if (/kawin|menikah|married|nikah/.test(s)) return "Married";
  return null;
}

/* Nama bank yang lazim ditulis karyawan → kode KantorKu. Pencocokan lain lewat nama resmi
   di daftar KK_BANKS (tanpa kata "bank"). */
const BANK_ALIASES: [RegExp, string][] = [
  [/^(bank )?(bca|central asia)$/, "bca"],
  [/^(bank )?(bca|central asia) syariah$/, "bank_bca_syariah"],
  [/^(bank )?(bri|rakyat indonesia)$/, "bri"],
  [/^(bank )?(bni|negara indonesia)( 46)?$/, "bank_bni"],
  [/^(bank )?mandiri$/, "bank_mandiri"],
  [/^(bank )?(bsi|syariah indonesia)$/, "bank_bsi"],
  [/^(bank )?btn$|tabungan negara/, "btn"],
  [/cimb/, "bank_cimb"],
  [/^(bank )?ocbc( nisp)?$/, "bank_ocbc_nisp"],
  [/^(bank )?panin$/, "panin_bank"],
  [/^(bank )?(bjb|jabar|jawa barat)$/, "bank_bjb"],
  [/^(bank )?dki$/, "bank_dki"],
  [/^(bank )?jatim$/, "bank_jatim"],
  [/^(bank )?jateng$/, "bank_jateng"],
  [/sea ?bank/, "bank_seabank"],
  [/^(bank )?jago$/, "bank_jago"],
  [/^blu|bca digital|digital bca/, "bank_digital_bca"],
  [/neo( commerce)?$/, "bank_neo_commerce"],
  [/^(bank )?allo$/, "bank_allo"],
  [/line ?bank|hibank|hi bank/, "bank_hibank"],
  [/^(bank )?raya$/, "bank_raya"],
  [/^(bank )?(btpn|jenius|smbc)/, "btpn"],
  [/^(bank )?mega$/, "bank_mega"],
  [/^(bank )?permata$/, "bank_permata"],
  [/^(bank )?danamon$/, "bank_danamon"],
  [/^(bank )?muamalat$/, "bank_muamalat"],
  [/^(bank )?(bpd )?bali$/, "bpd_bali"],
  [/^(bank )?(bpd )?banten$/, "bpd_banten"],
  [/^(bank )?(bpd )?diy$|^bpd jogja|^bank jogja/, "bank_bpd_diy"],
];

export function mapBank(v: string | null | undefined): string | null {
  const s = lower(v).replace(/[.,]/g, "").replace(/\s*\(.*\)\s*/g, " ").trim();
  if (!s) return null;
  const codes = new Set(KK_BANKS.map(([, c]) => c));
  if (codes.has(s)) return s; // sudah berupa kode
  for (const [re, code] of BANK_ALIASES) if (re.test(s)) return code;
  const bare = (x: string) => x.toLowerCase().replace(/^bank /, "").replace(/[.,]/g, "").trim();
  const hit = KK_BANKS.find(([name]) => bare(name) === s.replace(/^bank /, ""));
  return hit ? hit[1] : null;
}

/** Status kerja di web (PKWT/PKWTT + label rekap gaji) → Employment Type KantorKu. */
export function mapEmploymentType(core: string | null | undefined, label: string | null | undefined): KkEmploymentType | null {
  const l = lower(label);
  if (/freelance|harian lepas|lepas/.test(l)) return "freelance";
  if (/borongan/.test(l)) return "borongan";
  if (/magang|intern/.test(l)) return "intern";
  if (/probation|percobaan|training/.test(l)) return "probation";
  const c = lower(core);
  if (c === "pkwtt" || /tetap|permanent/.test(c) || /tetap|permanent/.test(l)) return "permanent";
  if (c === "pkwt" || /kontrak|contract/.test(c) || /kontrak|contract/.test(l)) return "contract";
  return pick(KK_EMPLOYMENT_TYPES, core);
}

/** Tax status bawaan: freelance/borongan dibayar tidak tetap; lainnya pegawai tetap
    (PKWT yang bekerja penuh waktu tetap "pegawai tetap" untuk PPh 21). */
export function defaultTaxStatus(t: KkEmploymentType | null): KkTaxStatus | null {
  if (!t) return null;
  if (t === "freelance" || t === "borongan") return "Pegawai Tidak Tetap";
  if (t === "permanent" || t === "contract" || t === "probation" || t === "intern") return "Pegawai Tetap";
  return null;
}

/* Kelompok kerja web → Department KantorKu (nama departemen di "Existing Data"). Office
   tidak bisa diturunkan — divisinya bermacam-macam, HR atau karyawan yang memilih. */
const DEPT_BY_GROUP: Record<string, string> = {
  spg: "SPG", spv: "Store Supervisor", produksi: "Produksi", santan: "Santen",
  sopir: "Driver/Delivery", host_live: "Host Live",
};

/* Position di KantorKu Rica Rico = tingkat (Staff/Supervisor/…), bukan nama jabatan. Manager,
   Koordinator SPV, dan Kepala Produksi tidak diturunkan — HR yang memilih. */
function defaultPosition(group: string | null | undefined, type: KkEmploymentType | null): string | null {
  if (group === "spv") return "Supervisor";
  if (type === "freelance") return "Freelance";
  return group ? "Staff" : null;
}

const inUnits = (list: string[], v: string | null | undefined) => list.find((x) => x.toLowerCase() === lower(v)) ?? null;

/** Branch dari area outlet: "Jakarta 1" → "Jakarta 1 - Irfan". Area tanpa pasangan tunggal → null. */
export function branchForArea(area: string | null | undefined, branches: string[]): string | null {
  const a = lower(area);
  if (!a) return null;
  const hits = branches.filter((b) => {
    const head = b.toLowerCase().split(/\s+-(\s|$)/)[0].trim();
    return head === a;
  });
  return hits.length === 1 ? hits[0] : null;
}

function emptyValues(): Record<KkKey, KkValue> {
  return Object.fromEntries(KK_COLUMNS.map((c) => [c.key, null])) as Record<KkKey, KkValue>;
}

/* ─── Baris template ─── */

export function toKantorkuRow(src: KkSource, units: KkUnits, defaults: KkDefaults = {}): KkRow {
  const v = emptyValues();
  const problems: KkProblem[] = [];
  const derived: KkKey[] = [];
  const notes: string[] = [];
  const h = src.hris ?? {};
  const p = src.profile ?? {};
  const need = (key: KkKey, message: string) => problems.push({ key, message });

  v.fullName = clean(src.full_name) || null;
  if (!v.fullName) need("fullName", "Nama lengkap kosong");

  const email = clean(h.company_email) || clean(p.email);
  v.companyEmail = email || null;
  if (!email) need("companyEmail", "Email untuk login KantorKu belum ada");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) need("companyEmail", `Email tidak valid: ${email}`);
  v.personalEmail = has(p.email) ? clean(p.email) : null;

  v.employeeId = clean(h.kantorku_employee_id) || null;
  if (!v.employeeId) notes.push("Employee ID kosong — KantorKu akan membuatkan otomatis. Catat ID-nya di web setelah impor supaya ekspor berikutnya tidak membuat karyawan ganda.");

  let type = pick(KK_EMPLOYMENT_TYPES, h.employment_type);
  if (!type) {
    type = mapEmploymentType(src.employment_type, p.employment_label);
    if (type) derived.push("employmentType");
  }
  v.employmentType = type;
  if (!type) need("employmentType", "Status kerja belum diisi (permanent/contract/…)");

  v.startDate = toDmy(src.join_date);
  if (!v.startDate) need("startDate", "Tanggal masuk kosong");
  v.endDate = toDmy(h.contract_end_date);
  if (type && KK_TYPES_NEED_END_DATE.includes(type) && !v.endDate) need("endDate", `Tanggal akhir kontrak wajib untuk ${type}`);

  v.taxSubject = KK_TAX_SUBJECT;
  let tax = pick(KK_TAX_STATUSES_SUPPORTED, h.tax_status);
  if (!tax) {
    tax = defaultTaxStatus(type);
    if (tax) derived.push("taxStatus");
  }
  v.taxStatus = tax;
  if (!tax) need("taxStatus", "Tax Status belum bisa ditentukan");

  if (tax === "Pegawai Tidak Tetap") {
    v.payeeTypeTidakTetap = pick(KK_PAYEE_TIDAK_TETAP, h.payee_type);
    if (!v.payeeTypeTidakTetap) need("payeeTypeTidakTetap", "Pegawai Tidak Tetap wajib punya Payee Type");
  }

  const sched = pick(KK_PAYMENT_SCHEDULE, h.payment_schedule) ?? "Monthly";
  if (!has(h.payment_schedule)) derived.push("paymentSchedule");
  v.paymentSchedule = sched;
  if ((sched === "Daily" || sched === "Weekly") && !(type === "freelance" || type === "borongan" || type === "contract" || type === "intern"))
    need("paymentSchedule", "Daily/Weekly hanya untuk Pegawai Tidak Tetap");
  if (sched === "Project") need("paymentSchedule", "Project hanya untuk Tenaga Ahli/Bukan Pegawai");

  v.currency = "IDR";
  if (src.basicSalary == null || !(src.basicSalary > 0)) need("basicSalary", "Gaji pokok belum tercatat");
  else v.basicSalary = Math.round(src.basicSalary);

  v.calculatePer = pick(KK_CALCULATE_PER, h.calculate_per) ?? "Month";
  if (!has(h.calculate_per)) derived.push("calculatePer");

  v.taxability = pick(KK_TAXABILITY, h.taxability) ?? pick(KK_TAXABILITY, defaults.taxability);
  if (!v.taxability) need("taxability", "Taxability (Gross/Gross Up/Nett) belum dipilih");
  else if (!has(h.taxability)) derived.push("taxability");

  v.nationality = "Indonesia";
  v.idType = "KTP";
  const nik = toDigits(src.nik);
  v.idNumber = nik;
  if (!nik) need("idNumber", "NIK kosong");
  else if (nik.length !== 16) need("idNumber", `NIK ${nik.length} digit (seharusnya 16)`);

  v.mobilePhone = toPhone62(p.phone);
  if (!v.mobilePhone) need("mobilePhone", has(p.phone) ? `Nomor HP tidak dikenali: ${clean(p.phone)}` : "Nomor HP kosong");

  v.address = clean(p.address) || null;
  v.birthDate = toDmy(p.birth_date);
  v.birthPlace = clean(p.birth_place) || null;
  v.religion = mapReligion(p.religion);
  if (has(p.religion) && !v.religion) notes.push(`Agama "${clean(p.religion)}" tidak ada di pilihan KantorKu — dikosongkan.`);
  v.gender = mapGender(p.gender);
  v.maritalStatus = mapMarital(p.marital_status);
  v.emergencyName = clean(p.emergency_name) || null;
  v.emergencyPhone = toPhone62(p.emergency_phone);
  if (has(p.emergency_phone) && !v.emergencyPhone) notes.push(`Nomor kontak darurat tidak dikenali: ${clean(p.emergency_phone)} — dikosongkan.`);
  v.emergencyRelation = clean(p.emergency_relation) || null;

  v.bankCode = mapBank(p.bank_name);
  if (!v.bankCode) need("bankCode", has(p.bank_name) ? `Bank "${clean(p.bank_name)}" tidak ada di daftar KantorKu` : "Nama bank kosong");
  v.accountNumber = toDigits(src.bank_account);
  if (!v.accountNumber) need("accountNumber", "Nomor rekening kosong");
  v.accountHolder = clean(h.account_holder) || null;
  if (!v.accountHolder) need("accountHolder", "Nama pemilik rekening belum diisi");

  v.npwp = toDigits(src.npwp);
  const isPtkpTax = tax === "Pegawai Tetap" || tax === "Pegawai Tidak Tetap";
  if (isPtkpTax) {
    v.ptkp = pick(KK_PTKP, src.ptkp_status);
    if (!v.ptkp) need("ptkp", "Status PTKP belum diisi");
  }

  v.bpjsTk = toDigits(h.bpjs_tk_number);
  v.bpjsKes = toDigits(h.bpjs_kes_number);

  // Unit perusahaan — harus persis nilai di "Existing Data".
  let branch = inUnits(units.branches, h.branch);
  if (!branch && !has(h.branch)) { branch = branchForArea(src.outletArea, units.branches); if (branch) derived.push("branch"); }
  v.branch = branch;
  if (!branch) need("branch", has(h.branch) ? `Branch "${clean(h.branch)}" tidak ada di KantorKu` : "Branch belum dipilih");

  let dept = inUnits(units.departments, h.department);
  if (!dept && !has(h.department)) { dept = inUnits(units.departments, DEPT_BY_GROUP[p.work_group ?? ""]); if (dept) derived.push("department"); }
  v.department = dept;
  if (!dept) need("department", has(h.department) ? `Department "${clean(h.department)}" tidak ada di KantorKu` : "Department belum dipilih");

  let pos = inUnits(units.positions, h.position);
  if (!pos && !has(h.position)) {
    pos = inUnits(units.positions, src.position) ?? inUnits(units.positions, defaultPosition(p.work_group, type));
    if (pos) derived.push("position");
  }
  v.position = pos;
  if (!pos) need("position", has(h.position) ? `Position "${clean(h.position)}" tidak ada di KantorKu` : "Position belum dipilih");

  return { values: v, problems, derived, notes };
}

/** Urutan nilai sesuai kolom template (A…AR). */
export function rowCells(row: KkRow): KkValue[] {
  return KK_COLUMNS.map((c) => row.values[c.key]);
}

export const KK_LABEL: Record<KkKey, string> = Object.fromEntries(KK_COLUMNS.map((c) => [c.key, c.header])) as Record<KkKey, string>;
