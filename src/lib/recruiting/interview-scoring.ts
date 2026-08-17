/* ═══════════════════════════════════════════════════════════════════════════
   Penilaian wawancara — fungsi murni. Skor mentah → kesimpulan yang bisa
   dipertanggungjawabkan.

   Empat aturan yang ditegakkan file ini, semuanya memperbaiki cacat nyata pada
   versi sebelumnya:

   1. "TIDAK DITANYA" BUKAN NILAI TERBURUK. Sebelumnya skala 1-5 memakai label
      "No evidence" pada angka 1, sehingga pertanyaan yang tidak sempat
      ditanyakan tercatat seolah kandidat berkinerja paling buruk. Sekarang
      angka 1-5 murni tingkat performa, dan "tidak ditanya" adalah status
      terpisah yang dikeluarkan dari perhitungan.

   2. CAKUPAN SELALU DILAPORKAN. Melewati pertanyaan sulit menaikkan rata-rata
      kalau yang dilewati diam-diam hilang dari pembagi. Setiap kesimpulan
      karena itu membawa berapa pertanyaan yang benar-benar dinilai, dan
      kesimpulan ditahan bila cakupannya terlalu tipis.

   3. KOMPETENSI KRITIS MEMBLOKIR REKOMENDASI. Rata-rata bisa menutupi satu
      kompetensi wajib yang jeblok. Pola ini disamakan dengan modul asesmen
      yang sudah memakai ambang kritis.

   4. PANEL DINILAI INDEPENDEN LEBIH DULU. Perbedaan penilaian antar-pewawancara
      adalah informasi, bukan gangguan — dan hanya muncul kalau setiap orang
      menilai sendiri sebelum berdiskusi.
═══════════════════════════════════════════════════════════════════════════ */

export type Rating = 1 | 2 | 3 | 4 | 5;

/** Label skala performa. Tidak ada lagi "No evidence" di sini — ketiadaan bukti
 *  bukan tingkat performa, dan tempatnya di `notAsked`. */
export const RATING_LABELS: Record<Rating, string> = {
  1: "Jauh di bawah",
  2: "Di bawah ekspektasi",
  3: "Sesuai ekspektasi",
  4: "Di atas ekspektasi",
  5: "Istimewa",
};

export const RATING_HELP: Record<Rating, string> = {
  1: "Tidak mampu memberi contoh relevan, atau jawabannya menunjukkan risiko nyata.",
  2: "Ada contoh tetapi dangkal, tidak spesifik, atau perannya tidak jelas.",
  3: "Contoh nyata, peran sendiri jelas, hasilnya masuk akal untuk level ini.",
  4: "Contoh kuat dengan hasil terukur dan pertimbangan yang matang.",
  5: "Contoh yang mengubah keadaan, bisa diajarkan ke orang lain, jauh di atas level ini.",
};

export interface ScoredQuestion {
  questionId: string;
  competencyId: string;
  competencyName: string;
  type: string;
  /** null = belum dinilai. */
  rating: Rating | null;
  /** true = sengaja tidak ditanyakan (waktu habis / tidak relevan).
   *  Dikeluarkan dari pembagi, dan dilaporkan terpisah. */
  notAsked?: boolean;
  notes?: string;
}

/* ─── Cakupan ─── */

export interface Coverage {
  total: number;
  /** Pertanyaan yang memang dimaksudkan ditanyakan (total dikurangi notAsked). */
  planned: number;
  rated: number;
  notAsked: number;
  /** Direncanakan ditanya tetapi tidak diberi nilai — inilah lubang sebenarnya. */
  missing: number;
  /** % pertanyaan terencana yang benar-benar dinilai. */
  coveragePct: number;
}

export function computeCoverage(scores: ScoredQuestion[]): Coverage {
  const total = scores.length;
  const notAsked = scores.filter((s) => s.notAsked).length;
  const rated = scores.filter((s) => !s.notAsked && s.rating !== null).length;
  const planned = total - notAsked;
  return {
    total,
    planned,
    rated,
    notAsked,
    missing: Math.max(0, planned - rated),
    coveragePct: planned === 0 ? 0 : Math.round((rated / planned) * 100),
  };
}

/* ─── Skor per kompetensi ─── */

export interface CompetencyScoreRow {
  competencyId: string;
  competencyName: string;
  /** null = kompetensi ini tidak punya satu pun pertanyaan yang dinilai. */
  avg: number | null;
  ratedCount: number;
  questionCount: number;
}

export function scoreByCompetency(scores: ScoredQuestion[]): CompetencyScoreRow[] {
  const map = new Map<string, ScoredQuestion[]>();
  for (const s of scores) {
    map.set(s.competencyId, [...(map.get(s.competencyId) ?? []), s]);
  }

  return [...map.entries()]
    .map(([competencyId, list]) => {
      const rated = list.filter((s) => !s.notAsked && s.rating !== null);
      const sum = rated.reduce((acc, s) => acc + (s.rating as number), 0);
      return {
        competencyId,
        competencyName: list[0].competencyName,
        avg: rated.length === 0 ? null : Math.round((sum / rated.length) * 10) / 10,
        ratedCount: rated.length,
        questionCount: list.length,
      };
    })
    .sort((a, b) => a.competencyName.localeCompare(b.competencyName));
}

/** Rata-rata keseluruhan dari pertanyaan yang dinilai. null bila belum ada. */
export function overallAverage(scores: ScoredQuestion[]): number | null {
  const rated = scores.filter((s) => !s.notAsked && s.rating !== null);
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, s) => acc + (s.rating as number), 0);
  return Math.round((sum / rated.length) * 100) / 100;
}

/* ─── Kompetensi kritis ─── */

/** Nilai minimum yang harus dicapai kompetensi wajib. 3 = "sesuai ekspektasi";
 *  di bawah itu berarti kandidat belum memenuhi standar dasar posisi tersebut. */
export const CRITICAL_MIN_RATING = 3;

export interface CriticalGap {
  competencyId: string;
  competencyName: string;
  /** null = kompetensi wajib ini malah tidak sempat dinilai sama sekali. */
  avg: number | null;
  reason: string;
}

/** Kompetensi wajib yang jeblok ATAU yang sama sekali tidak dinilai.
 *  Keduanya sama-sama menghalangi keputusan: yang satu karena buktinya buruk,
 *  yang satu karena buktinya tidak ada. */
export function findCriticalGaps(
  rows: CompetencyScoreRow[],
  criticalIds: string[],
  minRating: number = CRITICAL_MIN_RATING,
): CriticalGap[] {
  const out: CriticalGap[] = [];
  for (const id of criticalIds) {
    const row = rows.find((r) => r.competencyId === id);
    if (!row) continue; // tidak ada di kit ini — bukan urusan sesi wawancara ini
    if (row.avg === null) {
      out.push({
        competencyId: row.competencyId,
        competencyName: row.competencyName,
        avg: null,
        reason: "Kompetensi wajib ini tidak sempat dinilai — keputusan tidak bisa diambil tanpa buktinya.",
      });
    } else if (row.avg < minRating) {
      out.push({
        competencyId: row.competencyId,
        competencyName: row.competencyName,
        avg: row.avg,
        reason: `Kompetensi wajib bernilai ${row.avg} — di bawah batas ${minRating} (sesuai ekspektasi).`,
      });
    }
  }
  return out;
}

/* ─── Kesimpulan ─── */

export type Verdict =
  | "sangat_direkomendasikan"
  | "direkomendasikan"
  | "perlu_pertimbangan"
  | "tidak_direkomendasikan"
  | "data_belum_cukup";

export const VERDICT_LABELS: Record<Verdict, string> = {
  sangat_direkomendasikan: "Sangat Direkomendasikan",
  direkomendasikan: "Direkomendasikan",
  perlu_pertimbangan: "Perlu Pertimbangan",
  tidak_direkomendasikan: "Belum Memenuhi",
  data_belum_cukup: "Data Belum Cukup",
};

/** Cakupan minimum sebelum kesimpulan boleh ditarik. Di bawah ini, wawancara
 *  memang belum selesai — dan menyimpulkan dari separuh pertanyaan hanya
 *  memindahkan tebakan ke dalam angka. */
export const MIN_COVERAGE_PCT = 60;

export interface InterviewOutcome {
  average: number | null;
  coverage: Coverage;
  competencies: CompetencyScoreRow[];
  criticalGaps: CriticalGap[];
  verdict: Verdict;
  /** Alasan verdict, untuk ditampilkan apa adanya ke pewawancara. */
  reason: string;
}

export function computeInterviewOutcome(
  scores: ScoredQuestion[],
  criticalCompetencyIds: string[] = [],
): InterviewOutcome {
  const coverage = computeCoverage(scores);
  const competencies = scoreByCompetency(scores);
  const criticalGaps = findCriticalGaps(competencies, criticalCompetencyIds);
  const average = overallAverage(scores);

  let verdict: Verdict;
  let reason: string;

  if (average === null || coverage.rated === 0) {
    verdict = "data_belum_cukup";
    reason = "Belum ada satu pun pertanyaan yang dinilai.";
  } else if (coverage.coveragePct < MIN_COVERAGE_PCT) {
    verdict = "data_belum_cukup";
    reason = `Baru ${coverage.coveragePct}% pertanyaan terencana yang dinilai (${coverage.rated} dari ${coverage.planned}). Lengkapi dulu sebelum menyimpulkan.`;
  } else if (criticalGaps.length > 0) {
    // Kompetensi wajib mengunci kesimpulan, berapa pun rata-ratanya. Inilah
    // yang mencegah satu kelemahan menentukan tertutup oleh nilai bagus di
    // kompetensi yang tidak menentukan.
    verdict = "tidak_direkomendasikan";
    reason = `${criticalGaps.length} kompetensi wajib belum terpenuhi, meski rata-rata keseluruhan ${average.toFixed(1)}.`;
  } else if (average >= 4.2) {
    verdict = "sangat_direkomendasikan";
    reason = `Rata-rata ${average.toFixed(1)} dari ${coverage.rated} pertanyaan, seluruh kompetensi wajib terpenuhi.`;
  } else if (average >= 3.4) {
    verdict = "direkomendasikan";
    reason = `Rata-rata ${average.toFixed(1)} dari ${coverage.rated} pertanyaan, seluruh kompetensi wajib terpenuhi.`;
  } else if (average >= 2.5) {
    verdict = "perlu_pertimbangan";
    reason = `Rata-rata ${average.toFixed(1)} — di kisaran batas. Bandingkan dengan kandidat lain sebelum memutuskan.`;
  } else {
    verdict = "tidak_direkomendasikan";
    reason = `Rata-rata ${average.toFixed(1)} — di bawah ekspektasi pada mayoritas kompetensi.`;
  }

  return { average, coverage, competencies, criticalGaps, verdict, reason };
}

/* ─── Panel: beberapa pewawancara ─── */

export interface RaterResult {
  interviewer: string;
  completedAt: string;
  scores: ScoredQuestion[];
}

export interface CompetencyDisagreement {
  competencyId: string;
  competencyName: string;
  /** Nilai per pewawancara yang menilai kompetensi ini. */
  perRater: { interviewer: string; avg: number }[];
  spread: number;
  note: string;
}

export interface PanelOutcome {
  raterCount: number;
  /** Rata-rata dari rata-rata tiap pewawancara — bukan rata-rata seluruh butir.
   *  Kalau butir digabung mentah, pewawancara yang menilai lebih banyak
   *  pertanyaan otomatis punya suara lebih besar. */
  panelAverage: number | null;
  perRater: { interviewer: string; average: number | null; coverage: Coverage; verdict: Verdict }[];
  disagreements: CompetencyDisagreement[];
  criticalGaps: CriticalGap[];
  verdict: Verdict;
  reason: string;
}

/** Selisih nilai antar-pewawancara yang dianggap perlu dibicarakan.
 *  Selisih 2 tingkat berarti satu menilai "di bawah ekspektasi" dan yang lain
 *  "di atas ekspektasi" untuk kompetensi yang sama — itu bukan variasi wajar,
 *  melainkan tanda mereka menilai hal yang berbeda. */
export const DISAGREEMENT_THRESHOLD = 2;

export function aggregatePanel(
  raters: RaterResult[],
  criticalCompetencyIds: string[] = [],
): PanelOutcome {
  const perRater = raters.map((r) => {
    const outcome = computeInterviewOutcome(r.scores, criticalCompetencyIds);
    return {
      interviewer: r.interviewer,
      average: outcome.average,
      coverage: outcome.coverage,
      verdict: outcome.verdict,
    };
  });

  const usable = perRater.filter((r) => r.average !== null);
  const panelAverage =
    usable.length === 0
      ? null
      : Math.round((usable.reduce((s, r) => s + (r.average as number), 0) / usable.length) * 100) / 100;

  /* Ketidaksepakatan per kompetensi */
  const byComp = new Map<string, { name: string; perRater: { interviewer: string; avg: number }[] }>();
  for (const r of raters) {
    for (const row of scoreByCompetency(r.scores)) {
      if (row.avg === null) continue;
      const entry = byComp.get(row.competencyId) ?? { name: row.competencyName, perRater: [] };
      entry.perRater.push({ interviewer: r.interviewer, avg: row.avg });
      byComp.set(row.competencyId, entry);
    }
  }

  const disagreements: CompetencyDisagreement[] = [];
  for (const [competencyId, entry] of byComp) {
    if (entry.perRater.length < 2) continue; // butuh minimal dua penilai
    const values = entry.perRater.map((p) => p.avg);
    const spread = Math.round((Math.max(...values) - Math.min(...values)) * 10) / 10;
    if (spread < DISAGREEMENT_THRESHOLD) continue;
    const highest = entry.perRater.reduce((a, b) => (b.avg > a.avg ? b : a));
    const lowest = entry.perRater.reduce((a, b) => (b.avg < a.avg ? b : a));
    disagreements.push({
      competencyId,
      competencyName: entry.name,
      perRater: entry.perRater,
      spread,
      note: `${highest.interviewer} menilai ${highest.avg}, ${lowest.interviewer} menilai ${lowest.avg}. Bahas bukti yang mereka dengar sebelum memutuskan.`,
    });
  }
  disagreements.sort((a, b) => b.spread - a.spread);

  /* Kompetensi kritis dinilai dari gabungan seluruh butir panel: satu
     pewawancara yang tidak sempat menanyakan kompetensi wajib tidak boleh
     membuat seluruh panel dianggap kekurangan bukti bila rekannya menanyakan. */
  const allScores = raters.flatMap((r) => r.scores);
  const criticalGaps = findCriticalGaps(scoreByCompetency(allScores), criticalCompetencyIds);

  let verdict: Verdict;
  let reason: string;

  if (panelAverage === null) {
    verdict = "data_belum_cukup";
    reason = "Belum ada pewawancara yang menyelesaikan penilaian.";
  } else if (perRater.every((r) => r.verdict === "data_belum_cukup")) {
    verdict = "data_belum_cukup";
    reason = "Seluruh pewawancara belum mencapai cakupan pertanyaan yang memadai.";
  } else if (criticalGaps.length > 0) {
    verdict = "tidak_direkomendasikan";
    reason = `${criticalGaps.length} kompetensi wajib belum terpenuhi menurut gabungan penilaian panel.`;
  } else if (disagreements.length > 0) {
    // Panel yang berselisih tajam belum boleh dianggap sepakat, betapapun
    // bagusnya rata-rata gabungan. Angka rata-rata justru menyembunyikan
    // perselisihan itu.
    verdict = "perlu_pertimbangan";
    reason = `Rata-rata panel ${panelAverage.toFixed(1)}, tetapi ada ${disagreements.length} kompetensi yang dinilai jauh berbeda antar-pewawancara. Selesaikan di debrief.`;
  } else if (panelAverage >= 4.2) {
    verdict = "sangat_direkomendasikan";
    reason = `Rata-rata panel ${panelAverage.toFixed(1)} dari ${usable.length} pewawancara, tanpa perbedaan penilaian yang tajam.`;
  } else if (panelAverage >= 3.4) {
    verdict = "direkomendasikan";
    reason = `Rata-rata panel ${panelAverage.toFixed(1)} dari ${usable.length} pewawancara, tanpa perbedaan penilaian yang tajam.`;
  } else if (panelAverage >= 2.5) {
    verdict = "perlu_pertimbangan";
    reason = `Rata-rata panel ${panelAverage.toFixed(1)} — di kisaran batas.`;
  } else {
    verdict = "tidak_direkomendasikan";
    reason = `Rata-rata panel ${panelAverage.toFixed(1)} — di bawah ekspektasi.`;
  }

  return { raterCount: raters.length, panelAverage, perRater, disagreements, criticalGaps, verdict, reason };
}
