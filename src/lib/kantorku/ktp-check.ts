/* ═══════════════════════════════════════════════════════════════════════════
   Pencocokan isian formulir data karyawan dengan KTP. Fungsi murni, diuji di ktp-check.test.ts.

   Kenapa ada: 21 Nov 2026 seorang SPG mengunggah KTP orang lain (NIK, nama, dan tanggal lahir
   berbeda dari isiannya), dan nama pemilik rekening yang salah ketik ("Siti Rianti" padahal KTP
   "SITI RIYANTI") membuat KantorKu menolak impor karena bank membalas "name mismatch".
   KTP = sumber nama yang benar; nama pemilik rekening dicocokkan ke nama di KTP.

   Dua lapis pemeriksaan:
   1. Tanpa AI, selalu jalan: tanggal lahir & jenis kelamin yang tersandi di NIK (digit 7–12,
      DDMMYY; perempuan = tanggal + 40) dibandingkan dengan isian.
   2. Dengan hasil baca foto KTP (ktp-ocr.ts): NIK, nama, tanggal lahir di foto dibandingkan
      dengan isian, dan nama pemilik rekening dengan nama di KTP.

   Hasilnya hanya TANDA untuk HR dan peringatan untuk pengisi — tidak pernah mengubah isian
   otomatis dan tidak pernah menolak kiriman (pengisi boleh "Kirim tetap"): hasil baca foto
   bisa keliru, dan karyawan tidak boleh tertahan karena foto buram.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Hasil baca foto KTP. `null` = tidak terbaca di foto. */
export interface KtpReading {
  /** false = foto bukan KTP / tidak terbaca sama sekali. */
  readable: boolean;
  nik: string | null;
  name: string | null;
  birthDate: string | null; // YYYY-MM-DD
  checkedAt: string;        // ISO
  model?: string;
}

/** Disimpan di `pi_employee_data_submissions.files.ktp_check` (jsonb; tanpa kolom baru). */
export interface KtpCheckRecord {
  reading: KtpReading | null;
  /** Alasan bila tidak dibaca: berkas PDF, layanan AI sibuk/galat, tidak ada foto KTP. */
  skipped?: "pdf" | "ai_sibuk" | "ai_galat" | "tanpa_ktp";
  issues: KtpIssue[];
}

export interface KtpIssue {
  flag: KtpFlag;
  /** Field isian yang bermasalah — dipakai formulir untuk membuka bagian yang tepat. */
  field: "nik" | "full_name" | "account_holder" | "birth_date" | "gender" | "ktp";
  /** Kalimat untuk pengisi (karyawan) dan HR. Tidak memuat nilai rahasia selain milik pengisi sendiri. */
  message: string;
}

export type KtpFlag =
  | "nik_tanggal_lahir_beda" | "nik_jenis_kelamin_beda"
  | "ktp_tidak_terbaca" | "ktp_nik_beda" | "ktp_nik_beda_satu_digit" | "ktp_nama_beda" | "ktp_tanggal_lahir_beda"
  | "rekening_nama_beda_ktp" | "ktp_belum_dicek";

/** Semua tanda yang berasal dari modul ini — dibuang dulu sebelum hasil pemeriksaan baru ditulis. */
export const KTP_FLAGS: readonly KtpFlag[] = [
  "nik_tanggal_lahir_beda", "nik_jenis_kelamin_beda", "ktp_tidak_terbaca", "ktp_nik_beda", "ktp_nik_beda_satu_digit",
  "ktp_nama_beda", "ktp_tanggal_lahir_beda", "rekening_nama_beda_ktp", "ktp_belum_dicek",
];

export const KTP_FLAG_LABEL: Record<KtpFlag, string> = {
  nik_tanggal_lahir_beda: "Tanggal lahir di NIK tidak sama dengan tanggal lahir yang diisi",
  nik_jenis_kelamin_beda: "Jenis kelamin di NIK tidak sama dengan yang diisi",
  ktp_tidak_terbaca: "Foto KTP tidak terbaca / bukan KTP — buka fotonya",
  ktp_nik_beda: "NIK di foto KTP berbeda dari NIK yang diisi — mungkin KTP orang lain",
  ktp_nik_beda_satu_digit: "NIK di foto KTP beda 1 angka dari isian — cek fotonya (salah ketik atau foto buram)",
  ktp_nama_beda: "Nama di foto KTP berbeda dari nama lengkap yang diisi",
  ktp_tanggal_lahir_beda: "Tanggal lahir di foto KTP berbeda dari isian",
  rekening_nama_beda_ktp: "Nama pemilik rekening tidak sama dengan nama di KTP — KantorKu bisa menolak (name mismatch)",
  ktp_belum_dicek: "Foto KTP belum dibaca otomatis — tekan \"Cek KTP\"",
};

/** Tanda yang cukup serius untuk menahan kiriman sampai pengisi menekan "Kirim tetap". */
export const KTP_CONFIRM_FLAGS: ReadonlySet<KtpFlag> = new Set([
  "nik_tanggal_lahir_beda", "nik_jenis_kelamin_beda", "ktp_nik_beda", "ktp_nik_beda_satu_digit", "ktp_nama_beda", "rekening_nama_beda_ktp", "ktp_tidak_terbaca",
]);

/* ─── NIK ─── */

/**
 * Tanggal lahir & jenis kelamin yang tersandi di NIK. Digit 7–12 = DDMMYY; untuk perempuan
 * tanggalnya ditambah 40 (Permendagri tentang NIK; pola yang dipakai Dukcapil sejak e-KTP).
 * Tahun hanya 2 digit, jadi abad tidak bisa dipastikan dari NIK — yang dibandingkan yy-nya saja.
 */
export function nikBirth(nik: string | null | undefined): { day: number; month: number; yy: number; female: boolean } | null {
  const d = (nik ?? "").replace(/\D/g, "");
  if (d.length !== 16) return null;
  let day = +d.slice(6, 8);
  const month = +d.slice(8, 10);
  const yy = +d.slice(10, 12);
  const female = day > 40;
  if (female) day -= 40;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, yy, female };
}

/** Banyak digit yang berbeda pada posisi yang sama (NIK sama panjang). */
export function digitDiff(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/* ─── Nama ─── */

/** Huruf besar, tanpa tanda baca/gelar umum, spasi tunggal. "Siti  Riyanti," → "SITI RIYANTI". */
export function normName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normName(a), y = normName(b);
  return !!x && x === y;
}

/** Jarak Levenshtein (dipakai untuk membedakan "salah ketik" dari "orang lain"). */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/**
 * Apakah nama pemilik rekening sesuai nama di KTP. Bank memotong nama panjang dan kadang
 * menyingkat kata tengah, jadi yang dianggap sesuai:
 *   - kata demi kata sama, berurutan;
 *   - kata terakhir rekening boleh potongan awal kata KTP ("SITI SYARIFATUNNISA M");
 *   - kata selain yang pertama boleh berupa inisial satu huruf ("PUTRI N AMRI");
 *   - rekening boleh lebih pendek dari KTP (sisa kata terpotong), tidak boleh lebih panjang.
 * "Aini" untuk KTP "AINI RISTIANA" dianggap sesuai (terpotong) — bank yang memutuskan.
 */
export function holderMatchesKtpName(holder: string | null | undefined, ktpName: string | null | undefined): boolean {
  const h = normName(holder).split(" ").filter(Boolean);
  const k = normName(ktpName).split(" ").filter(Boolean);
  if (!h.length || !k.length || h.length > k.length) return false;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = k[i];
    if (a === b) continue;
    if (i > 0 && a.length === 1 && b.startsWith(a)) continue;              // inisial
    if (i === h.length - 1 && a.length >= 2 && b.startsWith(a)) continue;  // terpotong di akhir
    return false;
  }
  return true;
}

/** "Riyanti" vs "Rianti" = beda tipis (salah ketik), bukan orang lain. */
export function nearName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  return editDistance(x, y) <= Math.max(2, Math.floor(Math.max(x.length, y.length) * 0.15));
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

/* ─── Pemeriksaan ─── */

/**
 * Bandingkan isian dengan NIK-nya sendiri dan (bila ada) dengan hasil baca foto KTP.
 * `answers` = isian yang sudah divalidasi (nik 16 digit, birth_date YYYY-MM-DD, gender "Laki-laki"|"Perempuan").
 */
export function checkAgainstKtp(answers: Record<string, string | undefined>, reading: KtpReading | null): KtpIssue[] {
  const out: KtpIssue[] = [];
  const nik = (answers.nik ?? "").replace(/\D/g, "");

  // 1. Tanpa AI: isi NIK vs tanggal lahir & jenis kelamin yang diisi.
  const nb = nikBirth(nik);
  if (nb && answers.birth_date) {
    const [y, m, d] = answers.birth_date.split("-").map(Number);
    if (nb.day !== d || nb.month !== m || nb.yy !== y % 100)
      out.push({ flag: "nik_tanggal_lahir_beda", field: "nik",
        message: `Angka ke-7 sampai ke-12 NIK menunjukkan tanggal lahir ${String(nb.day).padStart(2, "0")}-${String(nb.month).padStart(2, "0")}-..${String(nb.yy).padStart(2, "0")}, sedangkan tanggal lahir yang diisi ${fmtDate(answers.birth_date)}. Periksa NIK atau tanggal lahir.` });
  }
  if (nb && answers.gender && (answers.gender === "Perempuan") !== nb.female)
    out.push({ flag: "nik_jenis_kelamin_beda", field: "gender",
      message: `NIK ini milik ${nb.female ? "perempuan" : "laki-laki"}, sedangkan jenis kelamin yang diisi ${answers.gender.toLowerCase()}. Periksa NIK.` });

  if (!reading) return out;

  // 2. Hasil baca foto KTP.
  if (!reading.readable || (!reading.nik && !reading.name)) {
    out.push({ flag: "ktp_tidak_terbaca", field: "ktp", message: "Foto KTP tidak terbaca. Pastikan yang difoto KTP Anda sendiri, utuh, tidak buram, dan tidak silau." });
    return out;
  }
  const kNik = (reading.nik ?? "").replace(/\D/g, "");
  if (kNik.length === 16 && nik.length === 16 && kNik !== nik) {
    const diff = digitDiff(kNik, nik);
    out.push(diff === 1
      ? { flag: "ktp_nik_beda_satu_digit", field: "nik", message: `NIK di foto KTP terbaca ${kNik}, beda satu angka dari yang Anda ketik (${nik}). Periksa lagi NIK Anda.` }
      : { flag: "ktp_nik_beda", field: "ktp", message: `NIK di foto KTP (${kNik}) berbeda dari NIK yang Anda ketik (${nik}). Pastikan foto yang diunggah KTP Anda sendiri.` });
  }
  if (reading.name && answers.full_name && !sameName(reading.name, answers.full_name))
    out.push({ flag: "ktp_nama_beda", field: "full_name",
      message: nearName(reading.name, answers.full_name)
        ? `Nama di KTP tertulis "${normName(reading.name)}", sedikit berbeda dari "${answers.full_name}". Tulis nama lengkap persis seperti di KTP.`
        : `Nama di foto KTP ("${normName(reading.name)}") berbeda dari nama yang Anda isi ("${answers.full_name}"). Pastikan foto yang diunggah KTP Anda sendiri.` });
  if (reading.birthDate && answers.birth_date && reading.birthDate !== answers.birth_date)
    out.push({ flag: "ktp_tanggal_lahir_beda", field: "birth_date",
      message: `Tanggal lahir di KTP ${fmtDate(reading.birthDate)}, yang diisi ${fmtDate(answers.birth_date)}.` });
  if (reading.name && answers.account_holder && !holderMatchesKtpName(answers.account_holder, reading.name))
    out.push({ flag: "rekening_nama_beda_ktp", field: "account_holder",
      message: `Nama pemilik rekening "${answers.account_holder}" tidak sama dengan nama di KTP ("${normName(reading.name)}"). Gaji hanya bisa dikirim ke rekening atas nama Anda sendiri — tulis persis seperti di buku tabungan.` });
  return out;
}

/** Ganti tanda lama hasil modul ini dengan tanda hasil pemeriksaan baru; tanda lain tetap. */
export function mergeKtpFlags(flags: readonly string[], issues: readonly KtpIssue[], unchecked = false): string[] {
  const keep = flags.filter((f) => !(KTP_FLAGS as readonly string[]).includes(f));
  const add = [...new Set(issues.map((i) => i.flag))];
  if (unchecked) add.push("ktp_belum_dicek");
  return [...keep, ...add];
}

/** Ada masalah yang perlu dikonfirmasi pengisi sebelum kiriman disimpan? */
export function needsConfirmation(issues: readonly KtpIssue[]): boolean {
  return issues.some((i) => KTP_CONFIRM_FLAGS.has(i.flag));
}

/**
 * Rapikan jawaban AI pembaca KTP. Model diminta JSON {nik, nama, tanggal_lahir, adalah_ktp};
 * apa pun yang tidak sesuai bentuknya dianggap tidak terbaca (null), tidak ditebak.
 */
export function parseKtpReading(raw: unknown, checkedAt: string, model?: string): KtpReading {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
  const nikRaw = str(o.nik).replace(/\D/g, "");
  const nik = nikRaw.length === 16 ? nikRaw : null;
  const nameRaw = normName(str(o.nama ?? o.name));
  const name = nameRaw.length >= 2 ? nameRaw : null;
  let birthDate: string | null = null;
  const b = str(o.tanggal_lahir ?? o.birth_date);
  const m = b.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/) ?? null;
  const iso = b.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) birthDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  else if (iso) birthDate = b;
  if (birthDate) {
    const [y, mo, d] = birthDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1930) birthDate = null;
  }
  const isKtp = o.adalah_ktp !== false && o.is_ktp !== false;
  return { readable: isKtp && !!(nik || name), nik, name, birthDate, checkedAt, ...(model ? { model } : {}) };
}
