/* ═══════════════════════════════════════════════════════════════════════════
   Modul ASSESSMENT (psikotes) — tipe inti.

   Prinsip yang dipegang modul ini (sejajar dengan modul Pay):
   1. Engine = fungsi MURNI. Input (jawaban + norma + profil jabatan) → output
      (skor, interpretasi). Tidak ada efek samping, semuanya bisa diuji.
   2. Norma dan profil jabatan adalah DATA ber-versi (`effective_date`), bukan
      angka yang di-hardcode di logika. Norma baru = baris data baru.
   3. HANYA memakai instrumen yang boleh dipakai bebas:
      - Kepribadian: adaptasi item IPIP-BFM-50 (Goldberg, 1999 — public domain).
      - Kognitif & SJT: item ditulis sendiri untuk repo ini.
      Instrumen berhak cipta (MBTI, DISC, 16PF, Papikostick, CFIT, IST, Hogan,
      SHL/OPQ, Watson-Glaser) TIDAK direproduksi di sini — memakai/menyalin
      itemnya tanpa lisensi melanggar hak cipta sekaligus etika tes.
   4. Klaim psikometrik ditulis apa adanya. Norma demo = sintetis dan diberi
      label sintetis. Reliabilitas/validitas lokal belum diuji dan dinyatakan
      belum diuji, bukan diklaim.
═══════════════════════════════════════════════════════════════════════════ */

/* ─── Skala ─── */

/** Lima domain Big Five (kode internasional O-C-E-A-N). */
export type BigFiveDomain = "O" | "C" | "E" | "A" | "N";

/** Sub-tes kognitif. */
export type CognitiveSubtest = "NUM" | "VER" | "LOG";

/** Dimensi Situational Judgement Test. */
export type SjtDimension = "LEAD" | "INTEG" | "COLLAB" | "PROBSOLV" | "ADAPT" | "SAFETY";

/** Id skala apa pun yang bisa diberi skor & dinormakan. */
export type ScaleId =
  | BigFiveDomain
  | `COG_${CognitiveSubtest}`
  | "COG_TOTAL"
  | `SJT_${SjtDimension}`
  | "SJT_TOTAL";

export type ScaleKind = "personality" | "cognitive" | "sjt";

export interface ScaleDefinition {
  id: ScaleId;
  kind: ScaleKind;
  /** Nama tampil (Indonesia). */
  name: string;
  /** Nama akademik / istilah internasional, supaya bisa ditelusuri. */
  academicName: string;
  description: string;
  /** true = skor tinggi umumnya diinginkan di dunia kerja. Untuk Neuroticism
   *  ini false — dipakai UI supaya tidak salah mewarnai skor tinggi = bagus. */
  higherIsGenerallyBetter: boolean;
}

/* ─── Item ─── */

export type ItemFormat = "likert5" | "multiple_choice" | "sjt_effectiveness";

/** Item kepribadian: pernyataan Likert 1–5, di-key positif (+) atau negatif (−). */
export interface PersonalityItem {
  id: string;
  format: "likert5";
  text: string;
  scale: BigFiveDomain;
  /** +1 = searah skala, −1 = item dibalik (reverse-keyed) saat diskor. */
  keying: 1 | -1;
  /** Item hanya untuk kontrol kualitas jawaban, tidak masuk skor sifat. */
  qc?: "attention" | "desirability";
}

/** Item kognitif: satu jawaban benar. */
export interface CognitiveItem {
  id: string;
  format: "multiple_choice";
  subtest: CognitiveSubtest;
  text: string;
  options: string[];
  /** Index jawaban benar pada `options`. */
  answerIndex: number;
  /** Penjelasan kunci — ditampilkan di panel HR, tidak pernah ke peserta. */
  rationale: string;
}

/** Opsi SJT: setiap opsi punya nilai efektivitas 1–5 dari kunci ahli. */
export interface SjtOption {
  text: string;
  /** 1 = sangat tidak efektif … 5 = sangat efektif. */
  effectiveness: 1 | 2 | 3 | 4 | 5;
}

export interface SjtItem {
  id: string;
  format: "sjt_effectiveness";
  dimension: SjtDimension;
  /** Konteks industri; dipakai memilih set item yang relevan per perusahaan. */
  context: "umum" | "manufaktur" | "media";
  scenario: string;
  options: SjtOption[];
  rationale: string;
}

export type AssessmentItem = PersonalityItem | CognitiveItem | SjtItem;

/* ─── Baterai & sesi ─── */

export interface BatterySection {
  id: string;
  title: string;
  instruction: string;
  itemIds: string[];
  /** Batas waktu detik. null = tanpa batas (lazim untuk skala kepribadian —
   *  memberi batas waktu pada inventori sifat tidak punya dasar psikometrik). */
  timeLimitSec: number | null;
  kind: ScaleKind;
}

export interface BatteryDefinition {
  id: string;
  name: string;
  description: string;
  sections: BatterySection[];
  /** Estimasi durasi total menit — dipakai di undangan ke peserta. */
  estimatedMinutes: number;
}

/** Jawaban mentah: itemId → nilai.
 *  - likert5          : 1..5
 *  - multiple_choice  : index opsi yang dipilih
 *  - sjt_effectiveness: index opsi yang dipilih */
export type ResponseMap = Record<string, number>;

/** Metadata pengerjaan per section — bahan indeks kualitas jawaban. */
export interface SectionTiming {
  sectionId: string;
  startedAt: string;
  submittedAt: string;
  elapsedSec: number;
}

/* ─── Skor ─── */

export interface RawScaleScore {
  scaleId: ScaleId;
  raw: number;
  /** Jumlah item yang benar-benar dijawab (bahan flag kelengkapan). */
  answered: number;
  itemCount: number;
  /** Skor maksimum teoretis bila semua item dijawab. */
  maxPossible: number;
}

/** Skor yang sudah dibandingkan ke kelompok norma. */
export interface NormedScaleScore extends RawScaleScore {
  z: number;
  /** Persentil 1–99 (dibulatkan, dipotong di ujung — persentil 0/100 menyesatkan). */
  percentile: number;
  /** Sten 1–10, skala standar yang lazim dipakai laporan seleksi korporat. */
  sten: number;
  /** T-score (M=50, SD=10). */
  tScore: number;
  /** Stanine 1–9. */
  stanine: number;
  band: ScoreBand;
  normId: string;
  normLabel: string;
}

export type ScoreBand = "sangat_rendah" | "rendah" | "rata_rata" | "tinggi" | "sangat_tinggi";

/* ─── Norma ─── */

export interface NormEntry {
  scaleId: ScaleId;
  mean: number;
  sd: number;
}

export interface NormGroup {
  id: string;
  label: string;
  /** Sumber & sifat norma — WAJIB jujur (sintetis vs sampel nyata). */
  provenance: "synthetic_demo" | "local_sample";
  /** Ukuran sampel norma. Untuk sintetis = 0. */
  sampleSize: number;
  effectiveDate: string; // YYYY-MM-DD
  entries: NormEntry[];
  notes?: string;
}

/* ─── Profil jabatan (kebutuhan posisi) ─── */

export type FitDirection = "higher" | "lower" | "midrange";

export interface ProfileRequirement {
  scaleId: ScaleId;
  /** Rentang sten yang diinginkan untuk posisi ini (1–10, inklusif). */
  targetStenMin: number;
  targetStenMax: number;
  /** Bobot relatif; dinormalisasi saat menghitung fit. */
  weight: number;
  direction: FitDirection;
  /** Sten minimum yang masih dapat diterima. Di bawah ini → flag kritis.
   *  null = tidak ada batas bawah keras untuk skala ini. */
  criticalMinSten: number | null;
  /** Alasan skala ini dipakai untuk posisi tsb — supaya keputusan bisa diaudit. */
  rationale: string;
}

export interface JobProfile {
  id: string;
  name: string;
  /** Rumpun jabatan; dipakai untuk mencocokkan otomatis dari judul lowongan. */
  family: string;
  level: "staff" | "supervisor" | "manager" | "specialist";
  description: string;
  requirements: ProfileRequirement[];
  /** Ambang fit yang dianggap "direkomendasikan" oleh perusahaan (0–100). */
  recommendThreshold: number;
  considerThreshold: number;
  source: "template" | "custom";
}

/* ─── Kualitas jawaban ─── */

export type ValidityStatus = "ok" | "perhatian" | "meragukan";

export interface ValidityIndex {
  id: string;
  label: string;
  value: number;
  /** Satuan/format untuk render: 'count' | 'ratio' | 'sec' | 'sten'. */
  unit: "count" | "ratio" | "sec" | "score";
  status: ValidityStatus;
  explanation: string;
}

export interface ValidityReport {
  overall: ValidityStatus;
  indices: ValidityIndex[];
  /** Kalimat siap pakai untuk laporan HR. */
  summary: string;
}

/* ─── Hasil akhir ─── */

export interface ScaleInterpretation {
  scaleId: ScaleId;
  scaleName: string;
  sten: number;
  band: ScoreBand;
  /** Narasi deskriptif (bukan diagnostik) untuk band tsb. */
  narrative: string;
  strengths: string[];
  watchouts: string[];
  /** Pertanyaan probing untuk wawancara — jembatan ke Interview Workspace. */
  interviewProbes: string[];
}

export interface FitScaleDetail {
  scaleId: ScaleId;
  scaleName: string;
  sten: number;
  targetStenMin: number;
  targetStenMax: number;
  weight: number;
  /** 0–100, seberapa dekat sten ke rentang target. */
  matchPct: number;
  /** true bila skala kritis dan sten di bawah `criticalMinSten`. */
  belowCritical: boolean;
  gapNote: string;
}

export type FitVerdict = "direkomendasikan" | "dipertimbangkan" | "belum_sesuai";

export interface FitResult {
  profileId: string;
  profileName: string;
  /** Indeks kesesuaian 0–100 (rata-rata tertimbang matchPct). */
  fitScore: number;
  verdict: FitVerdict;
  details: FitScaleDetail[];
  criticalFlags: string[];
}

export interface AssessmentReport {
  sessionId: string;
  candidateName: string;
  position: string;
  batteryId: string;
  batteryName: string;
  completedAt: string;
  normGroupId: string;
  normLabel: string;
  normProvenance: NormGroup["provenance"];
  scores: NormedScaleScore[];
  interpretations: ScaleInterpretation[];
  validity: ValidityReport;
  fit: FitResult | null;
  /** Ringkasan eksekutif 3–5 kalimat untuk halaman pertama laporan. */
  executiveSummary: string;
  /** Rekomendasi tindak lanjut yang boleh diambil HR. */
  recommendedActions: string[];
  /** Batasan penggunaan — selalu ikut tercetak di laporan. */
  limitations: string[];
}
