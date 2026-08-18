/* ═══════════════════════════════════════════════════════════════════════════
   Bank soal wawancara milik perusahaan — fungsi murni.

   Bank soal bawaan berisi pertanyaan yang berlaku umum untuk sebuah klaster
   jabatan. Yang tidak bisa disediakan bawaan adalah pertanyaan yang lahir dari
   pengalaman perusahaan itu sendiri: kejadian yang pernah bikin repot, mesin
   yang cuma ada di pabrik mereka, aturan internal yang sering dilanggar. File
   ini menangani pertanyaan semacam itu.

   Dua aturan yang dipegang:

   1. PERTANYAAN SENDIRI TIDAK MENIMPA BAWAAN. Keduanya hidup berdampingan dan
      sumbernya selalu terlihat. Menimpa diam-diam membuat kit berubah tanpa
      ada yang bisa menjelaskan kenapa.

   2. MENYARING BOLEH, TETAPI TERCATAT. Pewawancara boleh mengeluarkan
      pertanyaan yang tidak relevan — tetapi jumlah yang dikeluarkan ikut
      dilaporkan, karena kit yang disaring habis berhenti menjadi wawancara
      terstruktur tanpa disadari.
═══════════════════════════════════════════════════════════════════════════ */

export type QuestionSource = "builtin" | "custom";

export interface BankQuestion {
  id: string;
  type: string;
  competencyId: string;
  competencyName: string;
  question: string;
  strongAnswer: string;
  redFlags: string[];
  source: QuestionSource;
}

/** Pertanyaan buatan perusahaan sebelum disimpan. */
export interface CustomQuestionDraft {
  competencyId: string;
  competencyName: string;
  type: string;
  question: string;
  strongAnswer: string;
  redFlags: string[];
}

/* ─── Validasi ─── */

export const MIN_QUESTION_CHARS = 15;
export const MAX_QUESTION_CHARS = 500;

/** Memeriksa kelayakan pertanyaan buatan sendiri.
 *  Mengembalikan daftar masalah; kosong berarti lolos. */
export function validateCustomQuestion(draft: CustomQuestionDraft): string[] {
  const problems: string[] = [];
  const q = draft.question.trim();

  if (q.length < MIN_QUESTION_CHARS) {
    problems.push(`Pertanyaan terlalu pendek (minimal ${MIN_QUESTION_CHARS} karakter).`);
  }
  if (q.length > MAX_QUESTION_CHARS) {
    problems.push(`Pertanyaan terlalu panjang (maksimal ${MAX_QUESTION_CHARS} karakter).`);
  }
  if (!draft.competencyId.trim()) {
    problems.push("Pertanyaan harus dikaitkan ke satu kompetensi, supaya nilainya bisa dijumlahkan bersama pertanyaan lain.");
  }
  if (!draft.strongAnswer.trim()) {
    problems.push("Ciri jawaban kuat wajib diisi — tanpa itu, dua pewawancara akan menilai pertanyaan yang sama dengan standar berbeda.");
  }

  /* Pertanyaan yang menyentuh hal-hal ini berisiko diskriminatif dan, pada
     sebagian kasus, melanggar aturan ketenagakerjaan. Ditolak di depan, bukan
     ditegur setelah dipakai mewawancarai orang. */
  const risky: { pattern: RegExp; label: string }[] = [
    { pattern: /\b(hamil|kehamilan|program hamil|menikah|pernikahan|status pernikahan|cerai)\b/i, label: "status pernikahan atau kehamilan" },
    { pattern: /\b(agama|salat|sholat|gereja|jilbab|hijab|kerudung|suku|etnis|ras)\b/i, label: "agama, suku, atau ras" },
    { pattern: /\b(umur|usia) (anda|kamu)\b|\bberapa (umur|usia)\b/i, label: "usia" },
    { pattern: /\b(punya anak|anaknya berapa|rencana punya anak|kb\b)\b/i, label: "rencana memiliki anak" },
    { pattern: /\b(disabilitas|cacat|penyakit|riwayat kesehatan|sakit apa)\b/i, label: "kondisi kesehatan atau disabilitas" },
    { pattern: /\b(orientasi seksual|lgbt)\b/i, label: "orientasi seksual" },
  ];
  for (const r of risky) {
    if (r.pattern.test(q)) {
      problems.push(
        `Pertanyaan menyinggung ${r.label} — berisiko diskriminatif dan tidak boleh dipakai menilai kandidat. Ganti dengan pertanyaan tentang kemampuan atau kesediaan menjalankan tuntutan pekerjaan.`,
      );
      break; // satu peringatan sudah cukup; menumpuk peringatan tidak menambah kejelasan
    }
  }

  return problems;
}

/* ─── Penggabungan bank soal ─── */

/** Menggabungkan pertanyaan bawaan dan pertanyaan perusahaan.
 *  Pertanyaan perusahaan ditempatkan SETELAH bawaan pada tiap tipe, supaya
 *  urutan pertanyaan bawaan tidak berubah antar-kandidat. */
export function mergeQuestionBanks(builtin: BankQuestion[], custom: BankQuestion[]): BankQuestion[] {
  const byType = new Map<string, BankQuestion[]>();
  for (const q of [...builtin, ...custom]) {
    byType.set(q.type, [...(byType.get(q.type) ?? []), q]);
  }
  // Urutan tipe mengikuti kemunculan pertama pada bank bawaan, lalu tipe baru
  // yang hanya ada di bank perusahaan.
  const typeOrder = [...new Set([...builtin.map((q) => q.type), ...custom.map((q) => q.type)])];
  return typeOrder.flatMap((t) => {
    const list = byType.get(t) ?? [];
    return [...list.filter((q) => q.source === "builtin"), ...list.filter((q) => q.source === "custom")];
  });
}

/* ─── Penyaringan per kit ─── */

export interface SelectionSummary {
  total: number;
  included: number;
  excluded: number;
  /** Kompetensi yang seluruh pertanyaannya dikeluarkan — kompetensi itu jadi
   *  tidak terukur sama sekali, dan itu harus terlihat sebelum wawancara mulai. */
  droppedCompetencies: { competencyId: string; competencyName: string }[];
}

export function summarizeSelection(all: BankQuestion[], excludedIds: string[]): SelectionSummary {
  const excluded = new Set(excludedIds);
  const included = all.filter((q) => !excluded.has(q.id));

  const byComp = new Map<string, { name: string; total: number; kept: number }>();
  for (const q of all) {
    const e = byComp.get(q.competencyId) ?? { name: q.competencyName, total: 0, kept: 0 };
    e.total++;
    if (!excluded.has(q.id)) e.kept++;
    byComp.set(q.competencyId, e);
  }

  const dropped = [...byComp.entries()]
    .filter(([, e]) => e.total > 0 && e.kept === 0)
    .map(([competencyId, e]) => ({ competencyId, competencyName: e.name }));

  return {
    total: all.length,
    included: included.length,
    excluded: all.length - included.length,
    droppedCompetencies: dropped,
  };
}

/** Jumlah pertanyaan minimum agar sebuah kit masih layak disebut terstruktur.
 *  Angka praktis, bukan standar baku: di bawah ini, penilaian bertumpu pada
 *  terlalu sedikit bukti dan rata-ratanya mudah berayun oleh satu jawaban. */
export const MIN_KIT_QUESTIONS = 4;

export function isKitTooThin(summary: SelectionSummary): boolean {
  return summary.included < MIN_KIT_QUESTIONS;
}

/* ─── Id ─── */

/** Id pertanyaan perusahaan. Awalan `CQ-` membuat sumbernya terbaca langsung
 *  dari id, termasuk di dalam hasil wawancara yang sudah tersimpan. */
export function generateCustomQuestionId(now: Date = new Date(), rand: string = Math.random().toString(36).slice(2, 6)): string {
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `CQ-${d}-${rand.toUpperCase()}`;
}
