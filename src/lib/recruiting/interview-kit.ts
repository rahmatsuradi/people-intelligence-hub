/* ═══════════════════════════════════════════════════════════════════════════
   Komposisi kit wawancara — fungsi murni.

   Dua persoalan yang diselesaikan di sini:

   1. FORMAT vs DOMAIN. Kategori kit lama mencampur dua hal yang berbeda:
      "Behavioral" adalah FORMAT pertanyaan (menggali kejadian masa lalu),
      sedangkan "Technical" dan "Leadership" adalah DOMAIN yang ditanyakan.
      Akibatnya tidak ada jaminan tiap kompetensi punya pertanyaan berbasis
      bukti masa lalu — padahal itulah yang membedakan wawancara terstruktur
      dari obrolan terarah. File ini memisahkan keduanya dan melaporkan
      kompetensi mana yang belum punya bukti perilaku.

   2. JEMBATAN DARI ASESMEN. Laporan psikotes menghasilkan pertanyaan pendalaman
      per skala; tanpa jembatan, pertanyaan itu berhenti di laporan dan tidak
      pernah sampai ke ruang wawancara. Skor asesmen adalah HIPOTESIS, dan
      wawancara adalah tempat mengujinya — bukan tempat mengonfirmasinya.
═══════════════════════════════════════════════════════════════════════════ */

/** Format pertanyaan — apa yang diminta dari kandidat.
 *  - behavioral : kejadian nyata yang sudah terjadi ("Ceritakan saat…")
 *  - situational: penilaian atas situasi hipotetis ("Bagaimana Anda…")
 *  - probing    : pendalaman atas temuan asesmen/CV, bukan pertanyaan berdiri sendiri */
export type QuestionFormat = "behavioral" | "situational" | "probing";

export const FORMAT_LABELS: Record<QuestionFormat, string> = {
  behavioral: "Perilaku masa lalu",
  situational: "Situasional",
  probing: "Pendalaman",
};

/* Penanda kalimat. Ini HEURISTIK, bukan klasifikasi pasti — bank soal tidak
   menyimpan formatnya secara eksplisit, dan menandai ulang 60+ pertanyaan satu
   per satu justru lebih rawan salah daripada aturan yang bisa diuji. */
const BEHAVIORAL_MARKERS = [
  "ceritakan",
  "berikan contoh",
  "beri contoh",
  "pernahkah",
  "kapan terakhir",
  "jelaskan pengalaman",
  "pengalaman anda",
  "yang pernah anda",
];

const SITUATIONAL_MARKERS = [
  "bagaimana anda akan",
  "apa yang akan anda",
  "jika ",
  "seandainya",
  "misalkan",
  "andaikan",
];

/** Menentukan format sebuah pertanyaan.
 *  Tipe eksplisit menang lebih dulu; sisanya ditebak dari kalimatnya. Bila
 *  keduanya tidak memberi petunjuk, pertanyaan dianggap situasional — itu
 *  asumsi yang lebih aman, karena menganggapnya "berbasis perilaku" akan
 *  membuat laporan cakupan mengaku punya bukti yang sebenarnya tidak ada. */
export function deriveQuestionFormat(type: string, questionText: string): QuestionFormat {
  if (type === "Behavioral") return "behavioral";
  if (type === "Situational") return "situational";

  const t = questionText.toLowerCase();
  if (BEHAVIORAL_MARKERS.some((m) => t.includes(m))) return "behavioral";
  if (SITUATIONAL_MARKERS.some((m) => t.includes(m))) return "situational";
  return "situational";
}

/* ─── Cakupan bukti perilaku per kompetensi ─── */

export interface KitQuestionLike {
  competencyId: string;
  competencyName: string;
  type: string;
  question: string;
}

export interface CompetencyEvidenceRow {
  competencyId: string;
  competencyName: string;
  behavioral: number;
  situational: number;
  total: number;
  /** true = kompetensi ini hanya ditanyakan lewat situasi hipotetis. */
  lacksBehavioralEvidence: boolean;
}

/** Memeriksa apakah tiap kompetensi punya minimal satu pertanyaan berbasis
 *  kejadian nyata. Kompetensi yang hanya digali lewat pertanyaan hipotetis
 *  mengukur apa yang kandidat TAHU sebaiknya dilakukan, bukan apa yang pernah
 *  ia lakukan — dan keduanya sering berbeda jauh. */
export function analyzeEvidenceCoverage(questions: KitQuestionLike[]): CompetencyEvidenceRow[] {
  const map = new Map<string, { name: string; behavioral: number; situational: number }>();

  for (const q of questions) {
    const fmt = deriveQuestionFormat(q.type, q.question);
    const entry = map.get(q.competencyId) ?? { name: q.competencyName, behavioral: 0, situational: 0 };
    if (fmt === "behavioral") entry.behavioral++;
    else if (fmt === "situational") entry.situational++;
    map.set(q.competencyId, entry);
  }

  return [...map.entries()]
    .map(([competencyId, e]) => {
      // `total` dihitung di sini lebih dulu, bukan dirujuk dari akumulator —
      // akumulator tidak punya field itu, dan merujuknya menghasilkan undefined
      // yang membuat penandaan diam-diam selalu bernilai false.
      const total = e.behavioral + e.situational;
      return {
        competencyId,
        competencyName: e.name,
        behavioral: e.behavioral,
        situational: e.situational,
        total,
        lacksBehavioralEvidence: e.behavioral === 0 && total > 0,
      };
    })
    .sort((a, b) => a.competencyName.localeCompare(b.competencyName));
}

/* ─── Jembatan asesmen → wawancara ─── */

/** Satu pertanyaan pendalaman yang berasal dari laporan asesmen. */
export interface AssessmentProbe {
  scaleId: string;
  scaleName: string;
  sten: number;
  question: string;
  /** Alasan pertanyaan ini muncul — ditampilkan ke pewawancara agar ia tahu
   *  hipotesis apa yang sedang diuji, bukan sekadar membacakan pertanyaan. */
  rationale: string;
}

export interface AssessmentHandoff {
  sessionId: string;
  candidateName: string;
  position: string;
  /** Label norma pembanding, supaya pewawancara tahu angkanya relatif terhadap apa. */
  normLabel: string;
  probes: AssessmentProbe[];
}

/** Skala yang paling layak didalami: yang menonjol ke atas maupun ke bawah.
 *  Skala di kisaran rata-rata tidak menghasilkan hipotesis yang tajam, dan
 *  memasukkan semuanya hanya membuat wawancara membengkak tanpa menambah bukti. */
export const PROBE_LOW_STEN = 4;
export const PROBE_HIGH_STEN = 8;
export const MAX_PROBES = 6;

export interface InterpretationLike {
  scaleId: string;
  scaleName: string;
  sten: number;
  interviewProbes: string[];
}

/** Memilih pertanyaan pendalaman dari hasil asesmen.
 *  Diurutkan dari yang paling ekstrem (paling jauh dari rata-rata sten 5,5),
 *  karena itulah yang paling menentukan dan paling perlu diverifikasi. */
export function selectProbes(
  interpretations: InterpretationLike[],
  max: number = MAX_PROBES,
): AssessmentProbe[] {
  const notable = interpretations
    .filter((i) => i.interviewProbes.length > 0 && (i.sten <= PROBE_LOW_STEN || i.sten >= PROBE_HIGH_STEN))
    .sort((a, b) => Math.abs(b.sten - 5.5) - Math.abs(a.sten - 5.5));

  const out: AssessmentProbe[] = [];
  for (const i of notable) {
    if (out.length >= max) break;
    out.push({
      scaleId: i.scaleId,
      scaleName: i.scaleName,
      sten: i.sten,
      question: i.interviewProbes[0],
      rationale:
        i.sten <= PROBE_LOW_STEN
          ? `Hasil asesmen rendah pada ${i.scaleName} (sten ${i.sten}). Cari bukti apakah ini benar-benar terlihat di pekerjaan nyata.`
          : `Hasil asesmen tinggi pada ${i.scaleName} (sten ${i.sten}). Pastikan kekuatan ini nyata dan tidak menimbulkan sisi lain yang perlu diwaspadai.`,
    });
  }
  return out;
}

/** Kunci penyimpanan sementara antar-halaman. Memakai sessionStorage mengikuti
 *  pola yang sudah dipakai CV Analyzer → Interview, supaya tidak ada mekanisme
 *  perpindahan data kedua yang harus dipelihara terpisah. */
export const ASSESSMENT_HANDOFF_KEY = "interview_assessment_probes";
