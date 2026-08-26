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

// ⚠️ BELUM DIKONFIRMASI — wajib diverifikasi sebelum menerbitkan slip gaji sungguhan.
// Nilai di bawah berasal dari sumber publik (profil perusahaan di portal karier + registri
// perseroan), BUKAN dari dokumen resmi perusahaan. Yang harus dicek ke akta/NIB:
//   1. Nama badan hukum pemberi kerja (entitas yang menandatangani kontrak kerja).
//   2. Alamat terdaftar yang dipakai di slip gaji.
//   3. Nama & jabatan penanda tangan slip.
//   4. Kelas risiko JKK BPJS Ketenagakerjaan (menentukan tarif 0,24%–1,74%).
// Selama masih placeholder, slip gaji yang dihasilkan belum sah dipakai.
export const COMPANY_LENCIR: CompanyProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "PT Lencir Tubuh Idaman (LENCIR INDONESIA)",
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
