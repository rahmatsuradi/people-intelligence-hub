// Identitas pemberi kerja — WAJIB di slip gaji (PP 36/2021 Pasal 53(2), "identitas pemberi kerja").
//
// Satu PEMASANGAN melayani satu perusahaan; yang dipilih adalah NEXT_PUBLIC_INSTANCE
// (src/lib/instance.ts): Rica Rico Bakery (default) atau Lencir Indonesia. Keduanya memakai
// kode yang sama tetapi database Supabase dan proyek Vercel yang terpisah.
// Sebelumnya satu pemasangan ini pernah berganti dari Lencir ke Rica Rico; saat itu ID tenant
// sengaja diganti (bukan dipakai ulang) supaya data apa pun yang tersimpan atas nama Lencir —
// termasuk cache localStorage yang di-namespace per tenant — tidak terbaca sebagai data Rica Rico.
// Karena itu pemasangan Lencir yang baru juga memakai ID tenant BARU (bukan 3333…).
// Dua tenant demo lama (Valora TV / Zus Textile) beserta ~1.000 karyawan sintetisnya sudah
// dihapus — lihat CLAUDE.md §6. Daftar karyawan TIDAK lagi di-generate di kode; sumbernya
// hanya `pi_employees` di database. Itu disengaja: data karyawan asli (NIK, NPWP, upah,
// rekening) tidak boleh masuk repo maupun ter-deploy publik.

import { INSTANCE, type InstanceKey } from "../instance";

export interface CompanyProfile {
  id: string;
  name: string;
  shortName: string;
  address: string;
  signerName: string; // penanda tangan otorisasi (HR/Finance)
  signerTitle: string;
  tagline: string;
  industry: "bakery" | "wellness";
  industryLabel: string; // label yang dibaca manusia (dipakai UI + Konsultan HR)
  emoji: string;
  headcountTarget: number; // 0 = belum ditetapkan; headcount nyata dibaca dari pi_employees
}

// Rica Rico Bakery — pemberi kerja: PT Valen Persada Nusantara (dinyatakan pengelola repo,
// 24 Oktober 2026).
//
// Yang terverifikasi dari sumber publik (Oktober 2026):
//   - Merk "Rica Rico Bika Ambon" berdiri April 2002 sebagai toko roti, didirikan John Yen;
//     nama "Rica Rico" diambil dari anak pemilik (dua anak di logo). (IDN Times, Agustus 2025)
//   - Produk: bika ambon (original, pandan, cokelat, durian, keju), bolu jadul, brownies,
//     kacang. Berlabel halal. (Instagram resmi @ricarico_bakery, terverifikasi; Hublife)
//   - Jaringan outlet di mal, pasar, dan supermarket: DKI Jakarta, Tangerang/Tangsel,
//     Depok, Bogor, Bekasi, Karawang, Bandung, Cikarang, Semarang, Solo, Yogyakarta,
//     Sidoarjo, Surabaya, Gresik, Malang. (IDN Times, Agustus 2025)
//   - Alamat outlet Daan Mogot: Jl. Penerangan No. 1EE, Jakarta Barat (Pergikuliner) —
//     alamat yang sama dengan pemegang merek LENCIR di registri AHU. Kemungkinan satu
//     grup usaha; belum dikonfirmasi dan tidak dipakai sebagai dasar apa pun di sini.
//
// ⚠️ MASIH HARUS DIKONFIRMASI dari dokumen internal sebelum menerbitkan slip gaji:
//   a. PT VALEN PERSADA NUSANTARA tidak ditemukan di sumber publik mana pun (pencarian web,
//      Oktober 2026). Cocokkan ejaan persisnya dengan akta / kontrak kerja / registri AHU.
//   b. Alamat terdaftar PT (kolom `address` di bawah masih kosong — sengaja tidak diisi
//      alamat outlet, karena slip gaji wajib memuat identitas pemberi kerja yang sah).
//   c. NPWP perusahaan, nama & jabatan penanda tangan slip.
//   d. Kelas risiko JKK. Produksi bakery (oven, mixer) dan ritel outlet bisa jatuh ke
//      kelas berbeda — konfirmasi ke BPJS Ketenagakerjaan.
//   e. UMK per wilayah. Outlet tersebar di 5 provinsi, jadi satu nilai UMK tidak cukup:
//      upah minimum mengikuti lokasi kerja tiap karyawan.
export const COMPANY_RICA_RICO: CompanyProfile = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "PT Valen Persada Nusantara",
  shortName: "RICA RICO BAKERY",
  address: "—",
  signerName: "—",
  signerTitle: "HR & People Operations",
  tagline: "Bika Ambon, Bolu & Brownies — sejak 2002",
  industry: "bakery",
  industryLabel: "Bakery & Ritel Kue (produksi + jaringan outlet)",
  emoji: "🍰",
  headcountTarget: 0,
};

// Badan hukum pemegang merek LENCIR: PT Loe Cantik Kita Cuan.
//
// Terkonfirmasi dari tiga sumber yang saling cocok (Oktober 2026):
//   1. Registri perseroan (Ditjen AHU, Kemenkumham) — PT. Loe Cantik Kita Cuan,
//      nomor perseroan 1242905, berdiri 21 Maret 2022 (perubahan anggaran dasar
//      9 September 2024), alamat terdaftar Jl. Penerangan Nomor 1-EE, Jakarta Barat.
//   2. Registri BPOM (cekbpom.pom.go.id) — pendaftar produk bermerek LENCIR
//      (Luxurious Shower Scrub, Almond Peptide Hair Mask, Honey Black Lip Capsule)
//      tercatat atas "LOE CANTIK KITA CUAN, PT", Kota Adm Jakarta Barat.
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
//   e. UMK/UMP lokasi kerja karyawan Lencir (pi_statutory_config.umk masih kosong).
export const COMPANY_LENCIR: CompanyProfile = {
  // ID baru, BUKAN 3333… (tenant Lencir era Agustus–Oktober 2026 di database lain).
  id: "55555555-5555-4555-8555-555555555555",
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

const COMPANY_BY_INSTANCE: Record<InstanceKey, CompanyProfile> = {
  "rica-rico": COMPANY_RICA_RICO,
  lencir: COMPANY_LENCIR,
};

// Perusahaan milik pemasangan ini. Satu pemasangan = satu perusahaan, jadi daftarnya
// berisi satu entri (pemilih multi-tenant sudah dihapus — CLAUDE.md §8).
export const ACTIVE_COMPANY: CompanyProfile = COMPANY_BY_INSTANCE[INSTANCE.key];

export const ALL_COMPANIES: CompanyProfile[] = [ACTIVE_COMPANY];

// Perusahaan DEFAULT bila tidak dispesifikasikan.
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = ACTIVE_COMPANY;

const STORAGE_KEY = "pi_active_company_id";

export function getActiveCompanyId(): string {
  return ACTIVE_COMPANY.id;
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
  return ACTIVE_COMPANY;
}

export function resolveCompanyProfile(companyId?: string): CompanyProfile {
  if (!companyId) return getActiveCompanyProfile();
  const found = ALL_COMPANIES.find((c) => c.id === companyId);
  if (found) return found;

  // Instance privat menimpa identitas lewat env, supaya data perusahaan asli tidak
  // perlu ditulis ke dalam repo (CLAUDE.md §6).
  const name = process.env.PI_COMPANY_NAME;
  if (!name) return ACTIVE_COMPANY;
  return {
    ...ACTIVE_COMPANY,
    id: "custom",
    name,
    shortName: name,
    address: process.env.PI_COMPANY_ADDRESS ?? ACTIVE_COMPANY.address,
    signerName: process.env.PI_COMPANY_SIGNER_NAME ?? ACTIVE_COMPANY.signerName,
    signerTitle: process.env.PI_COMPANY_SIGNER_TITLE ?? ACTIVE_COMPANY.signerTitle,
  };
}
