/* ═══════════════════════════════════════════════════════════════════════════
   PROFIL JABATAN & PENGHITUNGAN KESESUAIAN (job–person fit) — fungsi murni.

   Inilah bagian "disiapkan sesuai posisi dan permintaan perusahaan": tes yang
   sama menghasilkan kesimpulan yang berbeda tergantung posisi yang dilamar.
   Sten 8 pada Ekstraversi adalah nilai tambah untuk Account Executive dan bisa
   jadi catatan untuk QC Inspector yang harus betah bekerja sendiri dan teliti.

   CARA KERJA
   - Setiap posisi punya daftar `requirements`: skala mana yang relevan, rentang
     sten yang diinginkan, bobot, arah, dan ambang kritis.
   - `computeFit()` membandingkan sten kandidat terhadap rentang target,
     memberi nilai 0–100 per skala, lalu merata-ratakan dengan bobot.
   - Skala yang tidak ada di profil TIDAK ikut menghitung. Ini disengaja:
     memasukkan semua skala ke setiap posisi membuat profil kehilangan makna.

   PENALTI ASIMETRIS. Untuk skala berarah `higher`, sten DI ATAS target tidak
   dihukum — kandidat yang lebih teliti dari yang dibutuhkan bukan masalah.
   Penalti dua arah hanya diberlakukan pada skala berarah `midrange`, di mana
   terlalu tinggi memang menimbulkan risiko tersendiri (mis. Keramahan sangat
   tinggi pada peran yang harus menegakkan aturan).

   PROFIL INI TEMPLATE, BUKAN HASIL JOB ANALYSIS. Rentang di bawah disusun dari
   penalaran praktik, bukan dari studi validasi pada jabatan di perusahaan
   tertentu. Profil yang benar-benar sahih dibangun lewat analisis jabatan
   (menghubungkan skor dengan kinerja pemangku jabatan saat ini). Karena itu
   profil bisa disunting per perusahaan lewat halaman Profil Jabatan.
═══════════════════════════════════════════════════════════════════════════ */

import type {
  FitResult,
  FitScaleDetail,
  FitVerdict,
  JobProfile,
  NormedScaleScore,
  ProfileRequirement,
  ScaleId,
} from "./types";
import { scaleName } from "./scales";

const req = (
  scaleId: ScaleId,
  targetStenMin: number,
  targetStenMax: number,
  weight: number,
  direction: ProfileRequirement["direction"],
  criticalMinSten: number | null,
  rationale: string,
): ProfileRequirement => ({ scaleId, targetStenMin, targetStenMax, weight, direction, criticalMinSten, rationale });

/* ─── Template profil jabatan ─── */

export const PROFILE_OPERATOR_PRODUKSI: JobProfile = {
  id: "JP-OPERATOR",
  name: "Operator / Staf Produksi",
  family: "produksi",
  level: "staff",
  description:
    "Pekerjaan berulang dengan standar mutu dan keselamatan yang ketat. Yang menentukan bukan kecepatan berpikir abstrak, melainkan konsistensi mengikuti prosedur dan ketahanan terhadap rutinitas.",
  requirements: [
    req("C", 6, 10, 3, "higher", 4, "Kepatuhan pada prosedur dan konsistensi mutu adalah inti pekerjaan ini."),
    req("SJT_SAFETY", 6, 10, 3, "higher", 5, "Pelanggaran prosedur keselamatan di lantai produksi berisiko cedera; ini ambang kritis, bukan preferensi."),
    req("N", 1, 6, 2, "lower", null, "Ketahanan terhadap tekanan target dan shift; reaktivitas tinggi mempercepat kelelahan."),
    req("COG_TOTAL", 4, 10, 1, "higher", 3, "Cukup untuk memahami instruksi kerja dan membaca alat ukur sederhana."),
    req("A", 5, 9, 1, "midrange", null, "Bekerja dalam regu; terlalu rendah menyulitkan koordinasi shift."),
  ],
  recommendThreshold: 75,
  considerThreshold: 60,
  source: "template",
};

export const PROFILE_QC_INSPECTOR: JobProfile = {
  id: "JP-QC",
  name: "QC Inspector / Quality Control",
  family: "quality",
  level: "staff",
  description:
    "Menemukan cacat yang mudah terlewat dan berani menahan barang meskipun ditekan target pengiriman.",
  requirements: [
    req("C", 7, 10, 3, "higher", 5, "Ketelitian pada detail kecil adalah pekerjaannya, bukan pelengkapnya."),
    req("SJT_INTEG", 7, 10, 3, "higher", 6, "Harus tahan menolak meloloskan barang saat ditekan; ini ambang kritis."),
    req("A", 3, 7, 2, "midrange", null, "Terlalu ramah menyulitkan menolak barang rekan sendiri; terlalu rendah memicu konflik dengan produksi."),
    req("COG_NUM", 5, 10, 1, "higher", null, "Membaca sampling plan, toleransi ukuran, dan persentase reject."),
    req("SJT_SAFETY", 6, 10, 1, "higher", null, "Bekerja di area produksi dengan aturan K3 yang sama."),
  ],
  recommendThreshold: 78,
  considerThreshold: 62,
  source: "template",
};

export const PROFILE_SUPERVISOR: JobProfile = {
  id: "JP-SUPERVISOR",
  name: "Supervisor / Leader Lini",
  family: "penyeliaan",
  level: "supervisor",
  description:
    "Menjembatani target manajemen dan kondisi nyata di lapangan. Sebagian besar kegagalan supervisor bukan soal teknis, melainkan cara menangani orang dan keputusan cepat.",
  requirements: [
    req("SJT_LEAD", 7, 10, 3, "higher", 5, "Menegur, menyepakati target, dan menjaga akuntabilitas tanpa merusak hubungan kerja."),
    req("C", 6, 10, 3, "higher", 4, "Menjaga jadwal, catatan shift, dan tindak lanjut yang tidak boleh terlewat."),
    req("E", 5, 9, 2, "midrange", null, "Perlu nyaman berbicara di depan regu; sangat tinggi bisa mengurangi porsi mendengarkan."),
    req("N", 1, 5, 2, "lower", 1, "Emosi supervisor menular ke seluruh shift."),
    req("SJT_COLLAB", 6, 10, 2, "higher", null, "Sebagian besar hambatan produksi diselesaikan lintas bagian."),
    req("COG_TOTAL", 5, 10, 2, "higher", 4, "Membaca data output, reject, dan menghitung penyesuaian beban shift."),
  ],
  recommendThreshold: 76,
  considerThreshold: 62,
  source: "template",
};

export const PROFILE_STAF_ADMIN: JobProfile = {
  id: "JP-ADMIN",
  name: "Staf Administrasi & Keuangan",
  family: "administrasi",
  level: "staff",
  description:
    "Pekerjaan berbasis dokumen dan angka, di mana satu salah ketik bisa berlanjut jauh ke laporan dan pembayaran.",
  requirements: [
    req("C", 7, 10, 3, "higher", 5, "Ketelitian dan keteraturan dokumen adalah inti pekerjaan."),
    req("COG_NUM", 6, 10, 3, "higher", 4, "Bekerja dengan angka, persentase, dan rekonsiliasi setiap hari."),
    req("SJT_INTEG", 7, 10, 2, "higher", 6, "Akses ke dokumen keuangan menuntut integritas; ini ambang kritis."),
    req("COG_VER", 5, 10, 1, "higher", null, "Memahami surat, kontrak, dan instruksi tertulis."),
    req("N", 1, 6, 1, "lower", null, "Tenggat pelaporan yang berulang membutuhkan ketahanan yang stabil."),
  ],
  recommendThreshold: 78,
  considerThreshold: 64,
  source: "template",
};

export const PROFILE_HR_PEOPLE_OPS: JobProfile = {
  id: "JP-HR",
  name: "Staf HR / People Operations",
  family: "hr",
  level: "staff",
  description:
    "Menangani data karyawan yang sensitif sekaligus berhadapan langsung dengan orang dalam situasi yang sering emosional.",
  requirements: [
    req("SJT_INTEG", 7, 10, 3, "higher", 6, "Memegang data pribadi karyawan (UU PDP 27/2022) dan informasi upah; ambang kritis."),
    req("A", 6, 9, 2, "midrange", null, "Harus mudah didekati, tetapi tetap sanggup menyampaikan keputusan yang tidak disukai."),
    req("C", 6, 10, 2, "higher", 4, "Kepatuhan tenggat statutori (BPJS, PPh 21) tidak mentolerir kelalaian."),
    req("SJT_COLLAB", 6, 10, 2, "higher", null, "Bekerja lintas fungsi hampir setiap hari."),
    req("COG_VER", 6, 10, 2, "higher", 4, "Membaca peraturan, kontrak kerja, dan menyusun komunikasi tertulis."),
    req("N", 1, 6, 1, "lower", null, "Sering menjadi tempat keluhan; perlu batas emosional yang stabil."),
  ],
  recommendThreshold: 76,
  considerThreshold: 62,
  source: "template",
};

export const PROFILE_SALES_AE: JobProfile = {
  id: "JP-SALES",
  name: "Sales / Account Executive",
  family: "sales",
  level: "staff",
  description:
    "Pekerjaan dengan penolakan sebagai kejadian harian. Yang membedakan bukan keramahan, melainkan ketahanan setelah ditolak dan kedisiplinan menindaklanjuti.",
  requirements: [
    req("E", 7, 10, 3, "higher", 5, "Memulai kontak dengan orang asing berulang kali setiap hari."),
    req("N", 1, 5, 3, "lower", 1, "Ketahanan terhadap penolakan; ini pembeda utama di peran ini."),
    req("C", 6, 10, 2, "higher", 4, "Tindak lanjut yang tertib menentukan konversi, bukan pertemuan pertamanya."),
    req("SJT_COLLAB", 5, 10, 1, "higher", null, "Koordinasi dengan tim operasional untuk memenuhi janji ke klien."),
    req("SJT_INTEG", 6, 10, 2, "higher", 5, "Menjanjikan yang tidak bisa dipenuhi merusak akun jangka panjang."),
  ],
  recommendThreshold: 74,
  considerThreshold: 60,
  source: "template",
};

export const PROFILE_JURNALIS: JobProfile = {
  id: "JP-JURNALIS",
  name: "Reporter / Produser Berita",
  family: "media",
  level: "staff",
  description:
    "Tenggat harian yang tidak bisa digeser, narasumber yang berubah mendadak, dan tanggung jawab akurasi ke publik.",
  requirements: [
    req("COG_VER", 7, 10, 3, "higher", 5, "Memahami dokumen, menyusun narasi akurat, dan menangkap kesimpulan yang tidak didukung fakta."),
    req("SJT_ADAPT", 7, 10, 3, "higher", 5, "Rencana liputan berubah menjelang tayang hampir setiap hari."),
    req("SJT_INTEG", 7, 10, 3, "higher", 6, "Akurasi dan independensi redaksi; ambang kritis, bukan preferensi."),
    req("O", 6, 10, 2, "higher", null, "Rasa ingin tahu pada topik baru adalah bahan bakar pekerjaan ini."),
    req("N", 1, 5, 2, "lower", null, "Tekanan tenggat tayang bersifat harian dan berulang."),
    req("E", 5, 10, 1, "higher", null, "Mendekati narasumber yang belum dikenal."),
  ],
  recommendThreshold: 76,
  considerThreshold: 62,
  source: "template",
};

export const PROFILE_MANAJER: JobProfile = {
  id: "JP-MANAJER",
  name: "Manajer / Kepala Departemen",
  family: "manajemen",
  level: "manager",
  description:
    "Keputusan yang diambil berdampak pada banyak orang dan sulit dibatalkan. Bobot terbesar ada pada penilaian situasional dan kemampuan menalar, bukan pada sifat tertentu.",
  requirements: [
    req("COG_TOTAL", 7, 10, 3, "higher", 5, "Kompleksitas keputusan naik tajam di level ini; kemampuan menalar adalah prediktor terkuat."),
    req("SJT_LEAD", 7, 10, 3, "higher", 5, "Mengembangkan dan menuntut akuntabilitas orang lain."),
    req("SJT_PROBSOLV", 7, 10, 2, "higher", 5, "Masalah yang naik ke meja manajer adalah yang tidak selesai di bawah."),
    req("C", 6, 10, 2, "higher", 4, "Tindak lanjut dan konsistensi standar di seluruh tim."),
    req("N", 1, 5, 2, "lower", 1, "Stabilitas emosional atasan menentukan rasa aman psikologis tim."),
    req("O", 5, 10, 1, "higher", null, "Bersedia meninjau ulang cara kerja yang sudah mapan."),
  ],
  recommendThreshold: 78,
  considerThreshold: 64,
  source: "template",
};

export const PROFILE_TEKNISI: JobProfile = {
  id: "JP-TEKNISI",
  name: "Teknisi / Maintenance",
  family: "teknik",
  level: "specialist",
  description:
    "Mendiagnosis kerusakan di bawah tekanan waktu henti mesin, dengan risiko keselamatan yang nyata.",
  requirements: [
    req("COG_LOG", 7, 10, 3, "higher", 5, "Diagnosis kerusakan adalah penalaran sebab-akibat yang berlapis."),
    req("SJT_SAFETY", 7, 10, 3, "higher", 6, "Bekerja pada mesin bertenaga; ambang kritis."),
    req("SJT_PROBSOLV", 6, 10, 2, "higher", 4, "Mencari akar masalah, bukan sekadar menghidupkan kembali mesin."),
    req("C", 6, 10, 2, "higher", 4, "Pencatatan riwayat perbaikan dan jadwal preventif."),
    req("N", 1, 6, 1, "lower", null, "Tekanan saat lini berhenti sangat tinggi."),
  ],
  recommendThreshold: 76,
  considerThreshold: 62,
  source: "template",
};

export const DEFAULT_JOB_PROFILES: JobProfile[] = [
  PROFILE_OPERATOR_PRODUKSI,
  PROFILE_QC_INSPECTOR,
  PROFILE_SUPERVISOR,
  PROFILE_STAF_ADMIN,
  PROFILE_HR_PEOPLE_OPS,
  PROFILE_SALES_AE,
  PROFILE_JURNALIS,
  PROFILE_MANAJER,
  PROFILE_TEKNISI,
];

export const JOB_PROFILE_BY_ID: Record<string, JobProfile> = Object.fromEntries(
  DEFAULT_JOB_PROFILES.map((p) => [p.id, p]),
);

/* ─── Pencocokan profil dari judul lowongan ─── */

const TITLE_KEYWORDS: [RegExp, string][] = [
  [/supervisor|spv|leader|kepala regu|foreman|koordinator/i, "JP-SUPERVISOR"],
  [/manager|manajer|kepala (departemen|bagian|divisi)|head of|gm\b/i, "JP-MANAJER"],
  [/qc|quality|inspek/i, "JP-QC"],
  [/teknisi|maintenance|mekanik|engineer|utility/i, "JP-TEKNISI"],
  [/sales|account executive|marketing|business development|bd\b/i, "JP-SALES"],
  [/hr|human resource|people|rekrut|personalia|payroll/i, "JP-HR"],
  [/reporter|jurnalis|produser|redaksi|editor|kameraman|news/i, "JP-JURNALIS"],
  [/admin|keuangan|finance|akun|staf kantor|purchasing|gudang/i, "JP-ADMIN"],
  [/operator|produksi|jahit|cutting|packing|helper|buruh/i, "JP-OPERATOR"],
];

/** Menebak profil jabatan dari judul lowongan. Hanya SARAN — HR tetap memilih
 *  sendiri di UI, karena judul jabatan di lapangan sering tidak konsisten. */
export function suggestProfileForPosition(position: string, profiles: JobProfile[] = DEFAULT_JOB_PROFILES): JobProfile | null {
  if (!position) return null;
  for (const [re, id] of TITLE_KEYWORDS) {
    if (re.test(position)) {
      const found = profiles.find((p) => p.id === id);
      if (found) return found;
    }
  }
  return null;
}

/* ─── Penghitungan kesesuaian ─── */

/** Nilai kecocokan satu skala terhadap rentang targetnya (0–100).
 *  Setiap 1 sten di luar rentang = −20 poin. Selisih 5 sten (setengah skala)
 *  karenanya jatuh ke 0 — cukup curam untuk membedakan, tidak sampai membuat
 *  satu skala meniadakan seluruh profil. */
export function scaleMatchPct(sten: number, r: ProfileRequirement): number {
  const PENALTY_PER_STEN = 20;
  if (sten >= r.targetStenMin && sten <= r.targetStenMax) return 100;

  if (sten < r.targetStenMin) {
    // Di bawah target selalu dihukum, apa pun arahnya — kecuali arah 'lower',
    // di mana lebih rendah dari target justru sesuai keinginan.
    if (r.direction === "lower") return 100;
    return Math.max(0, 100 - (r.targetStenMin - sten) * PENALTY_PER_STEN);
  }

  // sten > targetStenMax
  if (r.direction === "higher") return 100; // melebihi kebutuhan bukan kekurangan
  return Math.max(0, 100 - (sten - r.targetStenMax) * PENALTY_PER_STEN);
}

export function computeFit(scores: NormedScaleScore[], profile: JobProfile): FitResult {
  const stenByScale = new Map(scores.map((s) => [s.scaleId, s.sten]));
  const details: FitScaleDetail[] = [];
  const criticalFlags: string[] = [];

  let weightedSum = 0;
  let weightTotal = 0;

  for (const r of profile.requirements) {
    const sten = stenByScale.get(r.scaleId);
    // Skala yang tidak diukur oleh baterai yang dikerjakan dilewati, bukan
    // dianggap nol. Baterai penyaringan tidak mengukur kepribadian sama sekali.
    if (sten === undefined) continue;

    const matchPct = scaleMatchPct(sten, r);
    const belowCritical = r.criticalMinSten !== null && sten < r.criticalMinSten;
    if (belowCritical) {
      criticalFlags.push(
        `${scaleName(r.scaleId)}: sten ${sten} di bawah ambang kritis ${r.criticalMinSten} untuk posisi ini — ${r.rationale}`,
      );
    }

    details.push({
      scaleId: r.scaleId,
      scaleName: scaleName(r.scaleId),
      sten,
      targetStenMin: r.targetStenMin,
      targetStenMax: r.targetStenMax,
      weight: r.weight,
      matchPct,
      belowCritical,
      gapNote:
        matchPct === 100
          ? "Sesuai rentang yang dibutuhkan posisi ini."
          : sten < r.targetStenMin
            ? `${r.targetStenMin - sten} sten di bawah rentang target (${r.targetStenMin}–${r.targetStenMax}).`
            : `${sten - r.targetStenMax} sten di atas rentang target (${r.targetStenMin}–${r.targetStenMax}) — pada skala ini terlalu tinggi juga menimbulkan risiko.`,
    });

    weightedSum += matchPct * r.weight;
    weightTotal += r.weight;
  }

  const fitScore = weightTotal === 0 ? 0 : Math.round(weightedSum / weightTotal);

  let verdict: FitVerdict;
  if (weightTotal === 0) {
    // Tidak ada satu pun skala profil yang terukur → tidak ada dasar menilai.
    verdict = "belum_sesuai";
  } else if (criticalFlags.length > 0) {
    verdict = "belum_sesuai";
  } else if (fitScore >= profile.recommendThreshold) {
    verdict = "direkomendasikan";
  } else if (fitScore >= profile.considerThreshold) {
    verdict = "dipertimbangkan";
  } else {
    verdict = "belum_sesuai";
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    fitScore,
    verdict,
    details,
    criticalFlags,
  };
}

export const FIT_VERDICT_LABELS: Record<FitVerdict, string> = {
  direkomendasikan: "Direkomendasikan lanjut",
  dipertimbangkan: "Dapat dipertimbangkan",
  belum_sesuai: "Belum sesuai profil",
};
