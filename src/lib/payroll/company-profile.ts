// Identitas pemberi kerja — WAJIB di slip gaji (PP 36/2021 Pasal 53(2), "identitas pemberi kerja").
//
// Instance ini dipakai untuk SATU perusahaan: Rica Rico Bakery (tempat kerja pengelola repo).
// Sebelumnya instance ini melayani Lencir Indonesia; saat pindah, ID tenant sengaja diganti
// (bukan dipakai ulang) supaya data apa pun yang tersimpan atas nama Lencir — termasuk cache
// localStorage yang di-namespace per tenant — tidak terbaca sebagai data Rica Rico.
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
  industry: "bakery";
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

export const ALL_COMPANIES: CompanyProfile[] = [COMPANY_RICA_RICO];

// Perusahaan DEFAULT bila tidak dispesifikasikan.
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = COMPANY_RICA_RICO;

const STORAGE_KEY = "pi_active_company_id";

export function getActiveCompanyId(): string {
  return COMPANY_RICA_RICO.id;
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
  return COMPANY_RICA_RICO;
}

export function resolveCompanyProfile(companyId?: string): CompanyProfile {
  if (!companyId) return getActiveCompanyProfile();
  const found = ALL_COMPANIES.find((c) => c.id === companyId);
  if (found) return found;

  // Instance privat menimpa identitas lewat env, supaya data perusahaan asli tidak
  // perlu ditulis ke dalam repo (CLAUDE.md §6).
  const name = process.env.PI_COMPANY_NAME;
  if (!name) return COMPANY_RICA_RICO;
  return {
    ...COMPANY_RICA_RICO,
    id: "custom",
    name,
    shortName: name,
    address: process.env.PI_COMPANY_ADDRESS ?? COMPANY_RICA_RICO.address,
    signerName: process.env.PI_COMPANY_SIGNER_NAME ?? COMPANY_RICA_RICO.signerName,
    signerTitle: process.env.PI_COMPANY_SIGNER_TITLE ?? COMPANY_RICA_RICO.signerTitle,
  };
}
