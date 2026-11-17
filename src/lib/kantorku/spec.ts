/* ═══════════════════════════════════════════════════════════════════════════
   Template impor karyawan HRIS KantorKu — "HRIS KantorKu _ Template Import Karyawan"
   (diunggah HR 17 Nov 2026). Semua nilai di berkas ini disalin dari template itu:
   urutan & judul kolom (sheet "Import Employees Template" baris 3), pilihan dropdown
   (sheet REF, dirujuk data validation baris 6–1002), dan daftar kode bank
   (sheet Instructions G6:H120). Kalau KantorKu memperbarui templatenya, perbarui berkas
   ini dari template baru — jangan menebak nilai baru.

   Catatan dari template yang mudah terlewat:
   - Data mulai baris 6; baris 4 (petunjuk) dan 5 (contoh "John Doe") tidak dihapus.
   - Tanggal DD/MM/YYYY. Nomor HP diawali kode negara (62…). NPWP tanpa titik/tanda hubung.
   - Kolom Bank Name diisi KODE bank (mis. "bca"), bukan nama bank. Contoh di template
     menulis "bank_bca", tapi kode itu tidak ada di daftar banknya — daftar yang dipakai.
   - Branch/Department/Position harus persis salah satu nilai di sheet "Existing Data"
     (unit yang sudah diatur di KantorKu), jadi dibaca dari template saat ekspor.
   - Tax Status dan Taxability tidak bisa diubah di tengah tahun pajak di KantorKu.
   ═══════════════════════════════════════════════════════════════════════════ */

export const KK_SHEET_IMPORT = "Import Employees Template";
export const KK_SHEET_UNITS = "Existing Data";
export const KK_FIRST_DATA_ROW = 6;
export const KK_LAST_DATA_ROW = 1002;

export type KkKey =
  | "fullName" | "companyEmail" | "employeeId" | "employmentType" | "startDate" | "endDate"
  | "taxSubject" | "taxStatus" | "professionalCategory" | "payeeTypeTidakTetap" | "payeeTypeA" | "payeeTypeB"
  | "paymentSchedule" | "currency" | "basicSalary" | "calculatePer" | "taxability"
  | "nationality" | "idType" | "idNumber" | "idExpiration" | "personalEmail" | "mobilePhone" | "address"
  | "birthDate" | "birthPlace" | "religion" | "gender" | "maritalStatus"
  | "emergencyName" | "emergencyPhone" | "emergencyRelation"
  | "bankCode" | "accountNumber" | "accountHolder"
  | "npwp" | "ptkp" | "bupotDocNumber" | "bupotYear"
  | "bpjsTk" | "bpjsKes" | "branch" | "department" | "position";

export interface KkColumn {
  col: string;          // huruf kolom di template
  key: KkKey;
  header: string;       // judul di baris 3 (tanpa penanda *Wajib)
  required: "ya" | "kondisional" | "tidak";
}

/** 44 kolom isian (A–AR). Kolom AS "Row Status" berisi rumus template dan tidak diisi. */
export const KK_COLUMNS: readonly KkColumn[] = [
  { col: "A", key: "fullName", header: "Full Name", required: "ya" },
  { col: "B", key: "companyEmail", header: "Company Email", required: "ya" },
  { col: "C", key: "employeeId", header: "Employee ID", required: "ya" },
  { col: "D", key: "employmentType", header: "Employment Type", required: "ya" },
  { col: "E", key: "startDate", header: "Start Date", required: "ya" },
  { col: "F", key: "endDate", header: "End Date", required: "kondisional" },
  { col: "G", key: "taxSubject", header: "Tax Subject", required: "ya" },
  { col: "H", key: "taxStatus", header: "Tax Status", required: "ya" },
  { col: "I", key: "professionalCategory", header: "Professional Category", required: "kondisional" },
  { col: "J", key: "payeeTypeTidakTetap", header: "Payee Type (Tidak Tetap)", required: "kondisional" },
  { col: "K", key: "payeeTypeA", header: "Payee Type (Group A)", required: "kondisional" },
  { col: "L", key: "payeeTypeB", header: "Payee Type (Group B)", required: "kondisional" },
  { col: "M", key: "paymentSchedule", header: "Payment Schedule", required: "ya" },
  { col: "N", key: "currency", header: "Currency", required: "ya" },
  { col: "O", key: "basicSalary", header: "Basic Salary", required: "ya" },
  { col: "P", key: "calculatePer", header: "Calculate Per", required: "ya" },
  { col: "Q", key: "taxability", header: "Taxability", required: "ya" },
  { col: "R", key: "nationality", header: "Nationality (Personal Data)", required: "tidak" },
  { col: "S", key: "idType", header: "ID Type", required: "ya" },
  { col: "T", key: "idNumber", header: "ID Number", required: "ya" },
  { col: "U", key: "idExpiration", header: "ID Expiration", required: "tidak" },
  { col: "V", key: "personalEmail", header: "Personal Email", required: "tidak" },
  { col: "W", key: "mobilePhone", header: "Mobile Phone", required: "ya" },
  { col: "X", key: "address", header: "Residential Address", required: "tidak" },
  { col: "Y", key: "birthDate", header: "Birth Date", required: "tidak" },
  { col: "Z", key: "birthPlace", header: "Birth Place", required: "tidak" },
  { col: "AA", key: "religion", header: "Religion", required: "tidak" },
  { col: "AB", key: "gender", header: "Gender", required: "tidak" },
  { col: "AC", key: "maritalStatus", header: "Marital Status", required: "tidak" },
  { col: "AD", key: "emergencyName", header: "Emergency Contact Name", required: "tidak" },
  { col: "AE", key: "emergencyPhone", header: "Emergency Contact Number", required: "tidak" },
  { col: "AF", key: "emergencyRelation", header: "Relationship to Emergency Contact", required: "tidak" },
  { col: "AG", key: "bankCode", header: "Bank Name", required: "ya" },
  { col: "AH", key: "accountNumber", header: "Account Number", required: "ya" },
  { col: "AI", key: "accountHolder", header: "Bank Account Holder", required: "ya" },
  { col: "AJ", key: "npwp", header: "NPWP", required: "tidak" },
  { col: "AK", key: "ptkp", header: "PTKP Status", required: "kondisional" },
  { col: "AL", key: "bupotDocNumber", header: "Document Number for Bupot", required: "kondisional" },
  { col: "AM", key: "bupotYear", header: "Effective Year", required: "kondisional" },
  { col: "AN", key: "bpjsTk", header: "BPJS Ketenagakerjaan", required: "tidak" },
  { col: "AO", key: "bpjsKes", header: "BPJS Kesehatan", required: "tidak" },
  { col: "AP", key: "branch", header: "Branch", required: "ya" },
  { col: "AQ", key: "department", header: "Department", required: "ya" },
  { col: "AR", key: "position", header: "Position", required: "ya" },
];

/* ─── Pilihan dropdown (sheet REF) ─── */

export const KK_EMPLOYMENT_TYPES = ["permanent", "contract", "probation", "intern", "freelance", "borongan", "tenaga_ahli", "bukan_pegawai", "komisaris"] as const;
export type KkEmploymentType = (typeof KK_EMPLOYMENT_TYPES)[number];
/** Type yang wajib punya End Date (Instructions baris 11). */
export const KK_TYPES_NEED_END_DATE: readonly KkEmploymentType[] = ["contract", "probation", "intern"];

export const KK_TAX_STATUSES = [
  "Pegawai Tetap", "Pegawai Tidak Tetap",
  "Tenaga Ahli (Tidak Berkesinambungan)", "Tenaga Ahli (Berkesinambungan - Eksklusif)", "Tenaga Ahli (Berkesinambungan - Non-Eksklusif)",
  "Bukan Pegawai A (Tidak Berkesinambungan)", "Bukan Pegawai A (Berkesinambungan - Eksklusif)", "Bukan Pegawai A (Berkesinambungan - Non-Eksklusif)",
  "Bukan Pegawai B (Peserta Kegiatan)", "Bukan Pegawai C (Komisaris)",
] as const;
/** Pilihan tax status yang dipakai web ini. Tenaga Ahli/Bukan Pegawai butuh kolom kondisional
    lain (Professional Category, Payee Type A/B) yang tidak dikelola di sini — isi langsung di KantorKu. */
export const KK_TAX_STATUSES_SUPPORTED = ["Pegawai Tetap", "Pegawai Tidak Tetap"] as const;
export type KkTaxStatus = (typeof KK_TAX_STATUSES_SUPPORTED)[number];

export const KK_PAYEE_TIDAK_TETAP = [
  "Pegawai Tidak Tetap — Dibayarkan Bulanan (21-100-35)",
  "PTT Bulanan — Fasilitas Daerah Tertentu (21-100-27)",
  "PTT Harian/Mingguan/Borongan dengan Bruto > Rp2.500.000/hari (21-100-30)",
  "PTT Harian/Borongan > Rp2.500.000/hari — Fasilitas Daerah Tertentu (21-100-31)",
  "PTT Harian/Mingguan/Borongan dengan Bruto <= Rp2.500.000/hari (21-100-24)",
  "PTT Harian <= Rp2.500.000/hari — Fasilitas Daerah Tertentu (21-100-29)",
] as const;

export const KK_TAXABILITY = ["Gross", "Gross Up", "Nett"] as const;
export const KK_CALCULATE_PER = ["Month", "Shift", "Project"] as const;
export const KK_PAYMENT_SCHEDULE = ["Monthly", "Weekly", "Daily", "Project"] as const;
export const KK_TAX_SUBJECT = "SPDN (Domestic Tax Subject)";
export const KK_ID_TYPES = ["KTP", "Passport", "KITAS"] as const;
/** Ejaan "Confucious" memang begitu di template KantorKu — jangan "dibetulkan". */
export const KK_RELIGIONS = ["Islam", "Catholic", "Christian", "Buddha", "Hindu", "Confucious", "Undisclosed"] as const;
export const KK_GENDERS = ["Male", "Female"] as const;
export const KK_MARITAL = ["Single", "Married"] as const;
export const KK_PTKP = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"] as const;

/** Instructions G6:H120 — [nama bank di KantorKu, kode yang diisikan ke kolom Bank Name]. */
export const KK_BANKS: readonly (readonly [string, string])[] = [
  ["Bank Raya (BRI Agro)", "bank_raya"],
  ["ANZ Indonesia", "anz_indonesia"],
  ["Bank Artha Graha Internasional", "bag_internasional"],
  ["Bank Aceh", "bank_aceh"],
  ["Bank IBK", "bank_ibk"],
  ["Bank Jago", "bank_jago"],
  ["Bank BCA Syariah", "bank_bca_syariah"],
  ["Bank Bengkulu", "bank_bengkulu"],
  ["Bank BNI", "bank_bni"],
  ["Bank BPD DIY", "bank_bpd_diy"],
  ["Bank BPD DIY UUS", "bank_bpd_diy_uus"],
  ["Bank BTPN Syariah", "bank_btpn_syariah"],
  ["Bank Capital", "bank_capital"],
  ["Bank CIMB", "bank_cimb"],
  ["Bank CIMB Niaga UUS", "bank_cimb_niaga_uus"],
  ["Bank Commonwealth", "bank_commonwealth"],
  ["Bank Danamon", "bank_danamon"],
  ["Bank Danamon UUS", "bank_danamon_uus"],
  ["Bank Oke", "bank_oke"],
  ["Bank DKI", "bank_dki"],
  ["Bank DKI UUS", "bank_dki_uus"],
  ["Bank Ganesha", "bank_ganesha"],
  ["Bank Allo", "bank_allo"],
  ["Bank HSBC Indonesia", "bank_hsbc_indonesia"],
  ["Bank ICBC", "bank_icbc"],
  ["Bank Ina", "bank_ina"],
  ["Bank Index", "bank_index"],
  ["Bank BJB", "bank_bjb"],
  ["Bank BJB Syariah", "bank_bjb_syariah"],
  ["Bank Jasa Jakarta", "bank_jasa_jakarta"],
  ["Bank Jateng", "bank_jateng"],
  ["Bank Jateng UUS", "bank_jateng_uus"],
  ["Bank Jatim", "bank_jatim"],
  ["Bank Jatim UUS", "bank_jatim_uus"],
  ["Bank JTrust", "bank_jtrust"],
  ["Bank KEB Hana", "bank_keb_hana"],
  ["Bank Seabank", "bank_seabank"],
  ["Bank Lampung", "bank_lampung"],
  ["Bank Maluku", "bank_maluku"],
  ["Bank Mandiri", "bank_mandiri"],
  ["Bank Mandiri Taspen", "bank_mandiri_taspen"],
  ["Bank MAS", "bank_mas"],
  ["Bank Maspion", "bank_maspion"],
  ["Bank Mayapada", "bank_mayapada"],
  ["Bank Maybank", "bank_maybank"],
  ["Bank Maybank UUS", "bank_maybank_uus"],
  ["Bank Hibank", "bank_hibank"],
  ["Bank Mega", "bank_mega"],
  ["Bank Mega Syariah", "bank_mega_syariah"],
  ["Bank Mestika", "bank_mestika"],
  ["Bank Muamalat", "bank_muamalat"],
  ["Bank Nagari UUS", "bank_nagari_uus"],
  ["Bank Nationalnobu", "bank_nationalnobu"],
  ["BPD NTB Syariah", "bpd_ntb_syariah"],
  ["Bank OCBC NISP", "bank_ocbc_nisp"],
  ["Bank OCBC NISP UUS", "bank_ocbc_nisp_uus"],
  ["Bank Of India Indonesia", "bank_of_india_indonesia"],
  ["Bank Panin Dubai Syariah", "bank_panin_dubai_syariah"],
  ["Bank Permata", "bank_permata"],
  ["Bank Permata UUS", "bank_permata_uus"],
  ["Bank QNB", "bank_qnb"],
  ["BPD Riau Kepri Syariah", "bpd_riau_kepri_syariah"],
  ["Bank Digital BCA", "bank_digital_bca"],
  ["Bank Sampoerna", "bank_sampoerna"],
  ["Bank SBI", "bank_sbi"],
  ["Bank Shinhan Indonesia", "bank_shinhan_indonesia"],
  ["Bank Sinarmas", "bank_sinarmas"],
  ["Bank Sinarmas UUS", "bank_sinarmas_uus"],
  ["Bank Sulselbar", "bank_sulselbar"],
  ["Bank Sulselbar UUS", "bank_sulselbar_uus"],
  ["Bank Sumut", "bank_sumut"],
  ["Bank KB Bukopin Syariah", "bank_kb_bukopin_syariah"],
  ["Bank Victoria", "bank_victoria"],
  ["Bank Victoria Syariah", "bank_victoria_syariah"],
  ["Bank Woori Saudara", "bank_woori_saudara"],
  ["Bank Neo Commerce", "bank_neo_commerce"],
  ["Bank Bumi Arta", "bba"],
  ["BCA", "bca"],
  ["Bank of China (Hong Kong)", "boc_limited"],
  ["BPD Bali", "bpd_bali"],
  ["BPD Banten", "bpd_banten"],
  ["BPD Jambi", "bpd_jambi"],
  ["BPD Jambi UUS", "bpd_jambi_uus"],
  ["BPD Kalbar", "bpd_kalbar"],
  ["BPD Kalbar UUS", "bpd_kalbar_uus"],
  ["BPD Kalsel", "bpd_kalsel"],
  ["BPD Kalsel UUS", "bpd_kalsel_uus"],
  ["BPD Kalteng", "bpd_kalteng"],
  ["BPD Kaltimtara", "bpd_kaltimtara"],
  ["BPD Kaltimtara UUS", "bpd_kaltimtara_uus"],
  ["BPD NTT", "bpd_ntt"],
  ["BPD Papua", "bpd_papua"],
  ["BPD Sulteng", "bpd_sulteng"],
  ["BPD Sultra", "bpd_sultra"],
  ["BPD Sulut", "bpd_sulut"],
  ["Bank Nagari", "bank_nagari"],
  ["BPD Sumsel Babel", "bpd_sumsel_babel"],
  ["BPD Sumsel Babel UUS", "bpd_sumsel_babel_uus"],
  ["BPD Sumut UUS", "bpd_sumut_uus"],
  ["BRI", "bri"],
  ["Bank BSI", "bank_bsi"],
  ["Bank MUFG", "mufg"],
  ["BTN", "btn"],
  ["BTN UUS", "btn_uus"],
  ["BTPN", "btpn"],
  ["Bukopin", "bukopin"],
  ["China Construction Bank", "china_construction_bank"],
  ["Citibank", "citibank"],
  ["CTBC Indonesia", "ctbc_indonesia"],
  ["DBS", "dbs"],
  ["MNC Bank", "mnc_bank"],
  ["Panin Bank", "panin_bank"],
  ["Stanchart", "stanchart"],
  ["UOB Indonesia", "uob_indonesia"]
];
