// Identitas pemberi kerja — WAJIB di slip gaji (PP 36/2021 Pasal 53(2), "identitas pemberi kerja").
//
// Instance ini dipakai untuk SATU perusahaan: Lencir Indonesia (tempat kerja pengelola repo).
// Dua tenant demo lama (Valora TV / Zus Textile) beserta ~1.000 karyawan sintetisnya sudah
// dihapus — lihat CLAUDE.md §6. Daftar karyawan TIDAK lagi di-generate di kode; sumbernya
// hanya `pi_employees` di database. Itu disengaja: data karyawan asli (NIK, NPWP, upah,
// rekening) tidak boleh masuk repo maupun ter-deploy publik.

export interface CompanyProfile {
  id: string;
  name: string;
  shortName: string;
  address: string;
  signerName: string; // penanda tangan otorisasi (HR/Finance)
  signerTitle: string;
  tagline: string;
  industry: "wellness";
  industryLabel: string; // label yang dibaca manusia (dipakai UI + Konsultan HR)
  emoji: string;
  headcountTarget: number; // 0 = belum ditetapkan; headcount nyata dibaca dari pi_employees
}

// Badan hukum pemegang merek LENCIR: PT Loe Cantik Kita Cuan.
//
// Terkonfirmasi dari tiga sumber yang saling cocok:
//   1. Registri perseroan (Ditjen AHU, Kemenkumham) — PT. Loe Cantik Kita Cuan,
//      nomor perseroan 1242905, berdiri 21 Maret 2022 (perubahan anggaran dasar
//      9 September 2024), alamat terdaftar Jl. Penerangan Nomor 1-EE, Jakarta Barat.
//   2. Registri BPOM (cekbpom.pom.go.id) — pendaftar produk bermerek LENCIR
//      (Luxurious Shower Scrub NA11250700151, Almond Peptide Hair Mask NA11251000612,
//      Honey Black Lip Capsule NA11251301974) tercatat atas "LOE CANTIK KITA CUAN, PT",
//      Kota Adm Jakarta Barat.
//   3. Profil perusahaan "Lencir Indonesia" di portal karier — alamat operasional
//      Jl. Penerangan No. 1-EE, RT.6/RW.3, Jelambar, Grogol Petamburan, Jakarta Barat 11460.
//
// ⚠️ MASIH HARUS DIKONFIRMASI dari dokumen internal sebelum menerbitkan slip gaji:
//   a. ENTITAS PEMBERI KERJA. Grup Lencir punya beberapa badan hukum — antara lain
//      PT Lencir Kaya Sukses (klinik/wellness, kantor Surabaya), PT Lencir Tubuh Idaman,
//      PT Lencir Idaman Wanita, dan PT Loe Cantik Gue Cuan. Pemegang merek belum tentu
//      entitas yang menandatangani kontrak kerja karyawan. Cek kontrak kerja/slip gaji
//      yang berlaku: nama PT di situlah yang benar untuk slip.
//   b. NPWP perusahaan (belum ada field-nya; tambahkan bila slip mensyaratkan).
//   c. Nama & jabatan penanda tangan slip.
//   d. Kelas risiko JKK BPJS Ketenagakerjaan (menentukan tarif 0,24%–1,74%).
export const COMPANY_LENCIR: CompanyProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "PT Loe Cantik Kita Cuan",
  shortName: "LENCIR INDONESIA",
  address: "Jl. Penerangan No. 1-EE, RT.6/RW.3, Jelambar, Grogol Petamburan, Jakarta Barat 11460",
  signerName: "—",
  signerTitle: "HR & People Operations",
  tagline: "Beauty & Wellness — Minuman Prebiotik, Skincare, & Wellness Center",
  industry: "wellness",
  industryLabel: "Beauty & Wellness (Consumer Goods & Ritel)",
  emoji: "🌿",
  headcountTarget: 0,
};

export const ALL_COMPANIES: CompanyProfile[] = [COMPANY_LENCIR];

// Perusahaan DEFAULT bila tidak dispesifikasikan.
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = COMPANY_LENCIR;

const STORAGE_KEY = "pi_active_company_id";

export function getActiveCompanyId(): string {
  return COMPANY_LENCIR.id;
}

export function setActiveCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, companyId);
    window.dispatchEvent(new Event("pi-company-change"));
  } catch {
    // abaikan error storage
  }
}

export function getActiveCompanyProfile(): CompanyProfile {
  return COMPANY_LENCIR;
}

export function resolveCompanyProfile(companyId?: string): CompanyProfile {
  if (!companyId) return getActiveCompanyProfile();
  const found = ALL_COMPANIES.find((c) => c.id === companyId);
  if (found) return found;

  // Instance privat menimpa identitas lewat env, supaya data perusahaan asli tidak
  // perlu ditulis ke dalam repo (CLAUDE.md §6).
  const name = process.env.PI_COMPANY_NAME;
  if (!name) return COMPANY_LENCIR;
  return {
    ...COMPANY_LENCIR,
    id: "custom",
    name,
    shortName: name,
    address: process.env.PI_COMPANY_ADDRESS ?? COMPANY_LENCIR.address,
    signerName: process.env.PI_COMPANY_SIGNER_NAME ?? COMPANY_LENCIR.signerName,
    signerTitle: process.env.PI_COMPANY_SIGNER_TITLE ?? COMPANY_LENCIR.signerTitle,
  };
}
