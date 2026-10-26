// Identitas INSTANCE — satu kode, beberapa pemasangan.
//
// Aplikasi ini dipasang terpisah untuk tiap perusahaan: masing-masing punya database
// Supabase, proyek Vercel, dan akun sendiri (data karyawan tidak pernah bercampur).
// Yang membedakan pemasangan hanya satu variabel lingkungan:
//
//     NEXT_PUBLIC_INSTANCE = rica-rico | lencir      (kosong = rica-rico)
//
// Kenapa bukan salinan repo: dua salinan pasti saling menjauh. Pada Juli–Oktober 2026
// kerja dari ponsel dan laptop terpisah tiga bulan dan akhirnya bertabrakan (CLAUDE.md §1b).
// Dengan satu kode, fitur baru — mis. alur rekrutmen otomatis — dibangun sekali dan
// dipakai kedua perusahaan.
//
// Berkas ini HANYA memuat teks dan pilihan tampilan per instance — tidak ada data
// karyawan, kunci, atau angka SDM (CLAUDE.md §6). Identitas badan hukum untuk slip gaji
// ada di payroll/company-profile.ts, dipilih lewat kunci instance di bawah.

export type InstanceKey = "rica-rico" | "lencir";

export const INSTANCE_KEYS: readonly InstanceKey[] = ["rica-rico", "lencir"];

export interface InstanceConfig {
  key: InstanceKey;
  /** Nama merek lengkap — judul tab, halaman login, footer, survei publik. */
  brandName: string;
  /** Nama pendek untuk kalimat, mis. "Halo rekan-rekan {shortName}". */
  shortName: string;
  appTitle: string;
  description: string;
  /** Ikon tab. null = pakai favicon bawaan aplikasi. */
  iconPath: string | null;
  /** Id menu AppShell yang disembunyikan pada instance ini (halamannya tetap ada). */
  hiddenNav: readonly string[];
  employeesSubtitle: string;
  outletsSubtitle: string;
  /** Kalimat penutup di kartu "Kandidat Employee of the Month" (Pulse). */
  employeeOfMonthNote: string;
  /** Konteks perusahaan yang disuntikkan ke prompt Insight AI Pulse. */
  aiBusinessContext: string;
  /** Nilai kolom `source` untuk jawaban survei yang masuk lewat formulir web. */
  surveySource: string;
}

export const INSTANCES: Record<InstanceKey, InstanceConfig> = {
  "rica-rico": {
    key: "rica-rico",
    brandName: "Rica Rico Bakery",
    shortName: "Rica Rico",
    appTitle: "Rica Rico Bakery — People Intelligence",
    description: "Platform HR terpadu Rica Rico Bakery: rekrutmen, payroll & kepatuhan statutori, performance, dan asesmen.",
    iconPath: "/brand/rica-rico-logo.jpg",
    hiddenNav: [],
    employeesSubtitle: "Seluruh karyawan Rica Rico — sumber: rekap gaji September 2026 + Employee Database",
    outletsSubtitle: "Outlet Rica Rico per area dan SPV, dengan jumlah SPG aktif",
    employeeOfMonthNote: "Di Lencir diberi Rp150.000 + poster; di Rica Rico belum diberlakukan.",
    aiBusinessContext:
      "Rica Rico Bakery: produsen bika ambon & kue, jaringan ±110 outlet kecil di stasiun KRL, mal, dan supermarket Jabodetabek, satu dapur produksi, dan kantor pusat (admin operasional, customer service, purchasing, host live streaming). SPG menjaga outlet dengan shift panjang (sering 12 jam), diawasi SPV area yang memegang belasan outlet. Usaha keluarga, bukan korporasi: anggaran terbatas, keputusan ada di owner, HR hanya 1–2 orang. Libur karyawan operasional selama ini 2x per bulan.",
    surveySource: "Formulir web Rica Rico",
  },
  lencir: {
    key: "lencir",
    brandName: "Lencir Indonesia",
    shortName: "Lencir",
    appTitle: "LENCIR — People Intelligence",
    description: "Platform HR terpadu Lencir Indonesia: perencanaan tenaga kerja, rekrutmen, payroll & kepatuhan statutori, performance, dan asesmen.",
    iconPath: null,
    // Menu Outlet dibangun untuk jaringan SPG/SPV Rica Rico (kelompok kerja, SPV area).
    // Lencir belum punya padanannya; menu ini muncul lagi bila nanti dibutuhkan.
    hiddenNav: ["outlet"],
    employeesSubtitle: "Seluruh karyawan Lencir Indonesia",
    outletsSubtitle: "Outlet Lencir per area, dengan jumlah karyawan aktif",
    employeeOfMonthNote: "Di Lencir diberi Rp150.000 + poster.",
    // Sengaja pendek dan jujur. Jenis pekerjaan, jumlah karyawan, pola shift, dan anggaran
    // HR Lencir belum tercatat di sistem; konteks karangan membuat Insight AI terdengar
    // yakin tentang hal yang tidak ia ketahui. Lengkapi dari data nyata, jangan ditebak.
    aiBusinessContext:
      "Lencir Indonesia (PT Loe Cantik Kita Cuan, Jakarta Barat): brand beauty & wellness — minuman prebiotik, skincare, dan wellness center. Jenis pekerjaan, jumlah karyawan, pola shift, dan anggaran HR belum tercatat di sistem ini. Jangan menebaknya: bila suatu temuan butuh konteks pekerjaan yang tidak tertulis di sini, katakan bahwa konteksnya belum cukup dan sarankan HR melengkapinya.",
    surveySource: "Formulir web Lencir",
  },
};

/**
 * Menerjemahkan nilai NEXT_PUBLIC_INSTANCE menjadi kunci instance.
 *
 * Kosong → rica-rico (default, supaya pemasangan yang sudah berjalan tidak berubah).
 * Nilai asing → GAGAL KERAS. Salah ketik di pemasangan Lencir ("lencr") yang diam-diam
 * jatuh ke Rica Rico akan menampilkan merek dan ID tenant perusahaan yang salah di atas
 * data orang lain — lebih baik build berhenti dengan pesan yang jelas.
 */
export function resolveInstanceKey(raw: string | undefined): InstanceKey {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return "rica-rico";
  const found = INSTANCE_KEYS.find((k) => k === v);
  if (!found) {
    throw new Error(
      `NEXT_PUBLIC_INSTANCE tidak dikenal: "${raw}". Pilihan yang sah: ${INSTANCE_KEYS.join(", ")} (atau kosongkan untuk rica-rico).`,
    );
  }
  return found;
}

// Harus ditulis persis `process.env.NEXT_PUBLIC_INSTANCE` — Next hanya mengganti
// referensi literal ini saat build; destructuring atau akses dinamis tidak ikut diganti.
export const INSTANCE: InstanceConfig = INSTANCES[resolveInstanceKey(process.env.NEXT_PUBLIC_INSTANCE)];
