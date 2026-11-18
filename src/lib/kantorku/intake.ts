/* ═══════════════════════════════════════════════════════════════════════════
   Formulir data karyawan (/data-karyawan/<token>) — definisi pertanyaan, validasi,
   dan cara isian diterapkan ke master. Fungsi murni, diuji di intake.test.ts.

   Isi pertanyaan = gabungan Google Form "Employee Database Rica Rico Bakery" (yang
   dipakai sejak 2026) + kolom wajib template impor KantorKu yang belum ada di form
   itu (nama pemilik rekening, NPWP, nomor BPJS, tanggungan untuk PTKP, divisi).

   Divalidasi di formulir DAN di server (validateIntake) — server tidak percaya browser.
   ═══════════════════════════════════════════════════════════════════════════ */

import { KK_BANKS } from "./spec";
import { mapBank, toDigits, toPhone62 } from "./map";

export type IntakeType = "text" | "email" | "tel" | "date" | "choice" | "textarea" | "digits";

export interface IntakeField {
  key: string;
  label: string;
  section: string;
  type: IntakeType;
  required: boolean;
  help?: string;
  options?: readonly string[];
  /** Isian ini disamarkan saat ditampilkan kembali di link pribadi. */
  sensitive?: boolean;
  /** Pilihan diambil dari data server (mis. daftar departemen KantorKu). */
  dynamicOptions?: "departments" | "banks";
  suggest?: "outlets";
  maxLength?: number;
}

export const INTAKE_SECTIONS = ["Data diri", "Kontak & alamat", "Kontak darurat", "Pendidikan", "Pekerjaan", "Rekening, pajak & BPJS", "Dokumen"] as const;

export const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"] as const;
export const GENDERS = ["Laki-laki", "Perempuan"] as const;
export const MARITAL = ["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"] as const;
export const BLOOD = ["A", "B", "AB", "O", "Tidak tahu"] as const;
export const DEPENDENTS = ["0", "1", "2", "3"] as const;
export const EDUCATION = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;
export const RELATIONS = ["Orang tua", "Suami/Istri", "Saudara kandung", "Anak", "Kerabat lain", "Teman"] as const;

export const INTAKE_FIELDS: readonly IntakeField[] = [
  { key: "full_name", label: "Nama lengkap (sesuai KTP)", section: "Data diri", type: "text", required: true, maxLength: 120 },
  { key: "nickname", label: "Nama panggilan", section: "Data diri", type: "text", required: false, maxLength: 40 },
  { key: "nik", label: "NIK (16 digit di KTP)", section: "Data diri", type: "digits", required: true, sensitive: true, maxLength: 16 },
  { key: "birth_place", label: "Tempat lahir", section: "Data diri", type: "text", required: true, maxLength: 80 },
  { key: "birth_date", label: "Tanggal lahir", section: "Data diri", type: "date", required: true },
  { key: "gender", label: "Jenis kelamin", section: "Data diri", type: "choice", required: true, options: GENDERS },
  { key: "religion", label: "Agama", section: "Data diri", type: "choice", required: true, options: RELIGIONS },
  { key: "blood_type", label: "Golongan darah", section: "Data diri", type: "choice", required: false, options: BLOOD },
  { key: "marital_status", label: "Status perkawinan", section: "Data diri", type: "choice", required: true, options: MARITAL },
  { key: "dependents", label: "Jumlah tanggungan", section: "Data diri", type: "choice", required: true, options: DEPENDENTS,
    help: "Anak, anak angkat, orang tua, atau mertua yang sepenuhnya Anda tanggung biaya hidupnya, maksimal 3. Dipakai untuk status pajak (PTKP)." },
  { key: "mother_name", label: "Nama ibu kandung", section: "Data diri", type: "text", required: true, maxLength: 120, help: "Dibutuhkan untuk pendaftaran BPJS." },

  { key: "phone", label: "Nomor HP / WhatsApp", section: "Kontak & alamat", type: "tel", required: true, sensitive: true },
  { key: "email", label: "Email", section: "Kontak & alamat", type: "email", required: true, maxLength: 120, help: "Dipakai untuk masuk ke aplikasi absensi & slip gaji (KantorKu)." },
  { key: "address", label: "Alamat lengkap domisili saat ini", section: "Kontak & alamat", type: "textarea", required: true, sensitive: true, maxLength: 400,
    help: "Jalan, nomor, RT/RW, kelurahan, kecamatan, kota." },

  { key: "emergency_name", label: "Nama kontak darurat", section: "Kontak darurat", type: "text", required: true, maxLength: 120 },
  { key: "emergency_phone", label: "Nomor HP kontak darurat", section: "Kontak darurat", type: "tel", required: true, sensitive: true },
  { key: "emergency_relation", label: "Hubungan Anda dengan kontak darurat", section: "Kontak darurat", type: "choice", required: true, options: RELATIONS },

  { key: "education_level", label: "Pendidikan formal terakhir", section: "Pendidikan", type: "choice", required: true, options: EDUCATION },
  { key: "education_institution", label: "Nama sekolah / kampus terakhir", section: "Pendidikan", type: "text", required: true, maxLength: 120 },
  { key: "education_major", label: "Jurusan", section: "Pendidikan", type: "text", required: false, maxLength: 120 },

  { key: "join_date", label: "Tanggal mulai bekerja", section: "Pekerjaan", type: "date", required: true },
  { key: "position", label: "Posisi / jabatan saat ini", section: "Pekerjaan", type: "text", required: true, maxLength: 80, help: "Contoh: SPG, Baker, Admin Finance." },
  { key: "department", label: "Divisi", section: "Pekerjaan", type: "choice", required: true, dynamicOptions: "departments" },
  { key: "outlet", label: "Lokasi kerja saat ini", section: "Pekerjaan", type: "text", required: true, suggest: "outlets", maxLength: 120,
    help: "Ketuk kolom ini lalu pilih dari daftar. SPG: pilih nama outlet. Office: Kantor Pusat. Produksi/Santan: Dapur Produksi. SPV: Mobile / Keliling. Sopir: Gudang / Pengiriman." },
  { key: "supervisor_name", label: "Nama atasan langsung (SPV / Manager)", section: "Pekerjaan", type: "text", required: true, maxLength: 80 },

  { key: "bank_code", label: "Bank", section: "Rekening, pajak & BPJS", type: "choice", required: true, dynamicOptions: "banks", help: "Rekening untuk menerima gaji." },
  { key: "bank_account", label: "Nomor rekening", section: "Rekening, pajak & BPJS", type: "digits", required: true, sensitive: true, maxLength: 20 },
  { key: "account_holder", label: "Nama pemilik rekening", section: "Rekening, pajak & BPJS", type: "text", required: true, maxLength: 120,
    help: "Tulis persis seperti di buku tabungan / aplikasi bank." },
  { key: "npwp", label: "NPWP (kalau punya)", section: "Rekening, pajak & BPJS", type: "digits", required: false, sensitive: true, maxLength: 16,
    help: "Angka saja. Kosongkan kalau belum punya — NIK dipakai sebagai nomor pajak." },
  { key: "bpjs_tk_number", label: "Nomor BPJS Ketenagakerjaan (kalau sudah punya)", section: "Rekening, pajak & BPJS", type: "digits", required: false, maxLength: 20 },
  { key: "bpjs_kes_number", label: "Nomor BPJS Kesehatan / KIS (kalau sudah punya)", section: "Rekening, pajak & BPJS", type: "digits", required: false, maxLength: 20 },
];

export const DOC_KINDS = [
  { key: "ktp", label: "Foto KTP" },
  { key: "kk", label: "Foto Kartu Keluarga (KK)" },
  { key: "photo", label: "Pas foto terbaru" },
] as const;
export type DocKind = (typeof DOC_KINDS)[number]["key"];
/** Pilihan lokasi selain outlet, supaya karyawan Office, Produksi, SPV, dan Sopir tidak bingung mengisi. */
export const GENERAL_LOCATIONS = ["Kantor Pusat (Office)", "Dapur Produksi", "Mobile / Keliling (SPV)", "Gudang / Pengiriman (Sopir)"] as const;
/** Batas yang ditampilkan ke karyawan: foto boleh sebesar apa pun (dikecilkan otomatis di HP), PDF dibatasi. */
export const PDF_LIMIT_LABEL = "1,3 MB (1.300 KB)";
export const DOC_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
/** Batas per berkas setelah dikecilkan di HP. Total 3 berkas harus muat di batas body Vercel (4,5 MB). */
export const DOC_MAX_BYTES = 1_400_000;

export const FIELD_BY_KEY = new Map(INTAKE_FIELDS.map((f) => [f.key, f]));

/** Bank untuk pilihan formulir: yang paling sering dipakai karyawan lebih dulu. */
export function bankOptions(): { code: string; name: string }[] {
  const top = ["bca", "bri", "bank_mandiri", "bank_bni", "bank_bsi", "btn", "bank_cimb", "bank_seabank", "bank_jago", "bank_digital_bca", "bank_dki", "bank_bjb"];
  const all = KK_BANKS.map(([name, code]) => ({ code, name }));
  const head = top.map((c) => all.find((b) => b.code === c)).filter((b): b is { code: string; name: string } => !!b);
  const rest = all.filter((b) => !top.includes(b.code)).sort((a, b) => a.name.localeCompare(b.name, "id"));
  return [...head, ...rest];
}
export const bankName = (code: string | null | undefined) => KK_BANKS.find(([, c]) => c === code)?.[0] ?? null;

export interface IntakeContext { departments: string[] }

export interface IntakeResult { clean: Record<string, string>; errors: Record<string, string> }

const isoDate = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

/**
 * Validasi + rapikan jawaban. Key asing dibuang. `keep` = field sensitif yang dibiarkan kosong
 * di link pribadi karena nilainya sudah ada di master (karyawan memilih "tidak berubah").
 */
export function validateIntake(raw: Record<string, unknown>, ctx: IntakeContext, keep: ReadonlySet<string> = new Set(), now = new Date()): IntakeResult {
  const clean: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const f of INTAKE_FIELDS) {
    const v0 = raw[f.key];
    let v = typeof v0 === "string" ? v0.replace(/\s+/g, f.type === "textarea" ? " " : " ").trim() : "";
    if (f.maxLength && v.length > (f.type === "digits" ? 40 : f.maxLength)) v = v.slice(0, f.maxLength);
    if (!v) {
      if (f.required && !keep.has(f.key)) errors[f.key] = "Wajib diisi";
      continue;
    }
    switch (f.type) {
      case "digits": {
        const d = toDigits(v) ?? "";
        if (f.key === "nik" && d.length !== 16) { errors[f.key] = `NIK harus 16 digit (terisi ${d.length})`; continue; }
        if (f.key === "npwp" && d.length !== 15 && d.length !== 16) { errors[f.key] = "NPWP 15 atau 16 digit"; continue; }
        if (f.key === "bank_account" && (d.length < 6 || d.length > 20)) { errors[f.key] = "Nomor rekening tidak wajar"; continue; }
        if (!d) { errors[f.key] = "Isi dengan angka"; continue; }
        v = d;
        break;
      }
      case "tel": {
        const p = toPhone62(v);
        if (!p) { errors[f.key] = "Nomor HP tidak dikenali (contoh 0812xxxx)"; continue; }
        v = p;
        break;
      }
      case "email":
        v = v.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { errors[f.key] = "Email tidak valid"; continue; }
        break;
      case "date": {
        if (!isoDate(v)) { errors[f.key] = "Tanggal tidak valid"; continue; }
        const year = +v.slice(0, 4);
        if (f.key === "birth_date") {
          const age = now.getUTCFullYear() - year;
          if (age < 15 || age > 80) { errors[f.key] = "Periksa tahun lahir"; continue; }
        }
        if (f.key === "join_date") {
          if (year < 2000 || new Date(v + "T00:00:00Z").getTime() > now.getTime() + 90 * 86_400_000) { errors[f.key] = "Periksa tanggal mulai bekerja"; continue; }
        }
        break;
      }
      case "choice": {
        const opts = f.dynamicOptions === "departments" ? ctx.departments
          : f.dynamicOptions === "banks" ? KK_BANKS.map(([, c]) => c) : f.options ?? [];
        // Tanpa template KantorKu (instance lain), divisi diisi bebas.
        if (f.dynamicOptions === "departments" && !opts.length) { v = v.slice(0, 80); break; }
        if (!opts.includes(v)) { errors[f.key] = "Pilih salah satu pilihan"; continue; }
        break;
      }
    }
    clean[f.key] = v;
  }
  if (clean.phone && clean.emergency_phone && clean.phone === clean.emergency_phone) errors.emergency_phone = "Kontak darurat harus nomor orang lain";
  if (clean.bank_code && !mapBank(clean.bank_code)) errors.bank_code = "Bank tidak dikenal";
  for (const k of Object.keys(errors)) delete clean[k];
  return { clean, errors };
}

/**
 * Saran status PTKP dari jawaban (HR tetap yang menetapkan).
 * Tanggungan = anggota keluarga sedarah/semenda garis keturunan lurus + anak angkat yang
 * menjadi tanggungan sepenuhnya, maks. 3 (UU PPh Pasal 7).
 * Pegawai perempuan kawin hanya mendapat PTKP untuk dirinya sendiri (TK/0) — PMK 168/2023
 * Pasal 9 ayat (2) huruf a; lebih besar hanya dengan keterangan tertulis minimal dari kecamatan
 * bahwa suami tidak berpenghasilan (ayat 3). Sumber: pajak.go.id SP-2/2024, DDTC News
 * ("Begini ketentuan PTKP bagi karyawati kawin dan tidak kawin"), dicek 17 Nov 2026.
 */
export function suggestPtkp(a: Record<string, string>): { ptkp: string | null; note: string | null } {
  const n = Math.min(3, Math.max(0, Number.parseInt(a.dependents ?? "", 10)));
  if (!a.marital_status || Number.isNaN(n)) return { ptkp: null, note: null };
  const married = a.marital_status === "Kawin";
  if (married && a.gender === "Perempuan") return { ptkp: "TK/0", note: "Karyawati kawin: TK/0, kecuali ada keterangan kecamatan bahwa suami tidak berpenghasilan (PMK 168/2023 Pasal 9)." };
  return { ptkp: `${married ? "K" : "TK"}/${n}`, note: null };
}

/* ─── Penerapan ke master ─── */

export interface ApplyPatch {
  core: Record<string, string | null>;      // pi_employees
  profile: Record<string, string | null>;   // pi_employee_profiles
  hris: Record<string, string | null>;      // pi_employee_hris
  outletName: string | null;                // dicocokkan HR ke pi_outlets
}

/** Isian → kolom master. Field yang tidak diisi (atau "tidak berubah") tidak ikut — master lama tetap. */
export function buildApplyPatch(a: Record<string, string>, files: Partial<Record<DocKind, string>> = {}): ApplyPatch {
  const pickKeys = (keys: string[]) => Object.fromEntries(keys.filter((k) => a[k]).map((k) => [k, a[k]]));
  const core = pickKeys(["full_name", "nik", "npwp", "join_date", "position", "bank_account"]);
  const profile: Record<string, string | null> = pickKeys([
    "nickname", "birth_place", "birth_date", "gender", "religion", "blood_type", "marital_status", "mother_name", "phone", "email", "address",
    "emergency_name", "emergency_phone", "emergency_relation", "education_level", "education_institution", "education_major", "supervisor_name",
  ]);
  if (a.bank_code) profile.bank_name = bankName(a.bank_code);
  for (const d of DOC_KINDS) if (files[d.key]) profile[d.key === "photo" ? "photo_url" : `${d.key}_url`] = `storage:pi-employee-docs/${files[d.key]}`;
  const hris = pickKeys(["account_holder", "bpjs_tk_number", "bpjs_kes_number", "department"]);
  return { core, profile, hris, outletName: a.outlet || null };
}

export interface DiffRow { key: string; label: string; before: string | null; after: string; sensitive: boolean }

const norm = (s: string | null | undefined) => (s ?? "").toString().replace(/\s+/g, " ").trim().toLowerCase();

/** Field yang berbeda dari master saat ini. Nilai lama yang kosong = "baru diisi". */
export function diffWithMaster(a: Record<string, string>, current: Record<string, string | null | undefined>): DiffRow[] {
  const out: DiffRow[] = [];
  for (const f of INTAKE_FIELDS) {
    const after = a[f.key];
    if (!after) continue;
    const beforeRaw = current[f.key] ?? null;
    const comparable = f.type === "tel" ? toPhone62(beforeRaw) : f.type === "digits" ? toDigits(beforeRaw) : beforeRaw;
    const shown = f.key === "bank_code" ? bankName(after) ?? after : after;
    const beforeShown = f.key === "bank_code" ? (beforeRaw ? bankName(mapBank(beforeRaw)) ?? beforeRaw : null) : beforeRaw;
    const same = f.key === "bank_code" ? mapBank(beforeRaw) === after : norm(comparable) === norm(after);
    if (!same) out.push({ key: f.key, label: f.label, before: beforeShown || null, after: shown, sensitive: !!f.sensitive });
  }
  return out;
}

/** Cocokkan isian outlet ke daftar outlet master (persis, abaikan huruf besar-kecil & spasi). */
export function matchOutlet(name: string | null | undefined, outlets: { id: string; name: string }[]): { id: string; name: string } | null {
  const n = norm(name);
  if (!n) return null;
  return outlets.find((o) => norm(o.name) === n) ?? null;
}

/** Tampilkan kembali nilai sensitif tanpa membukanya: 4 karakter terakhir saja. */
export function maskTail(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return s.length <= 4 ? "••••" : `•••• ${s.slice(-4)}`;
}
