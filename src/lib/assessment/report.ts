/* ═══════════════════════════════════════════════════════════════════════════
   PENYUSUN LAPORAN — merangkai penskoran, norma, validitas, interpretasi, dan
   kesesuaian jabatan menjadi satu objek laporan. Fungsi murni.

   Urutan penyusunan sengaja menempatkan KUALITAS JAWABAN sebelum kesimpulan:
   bila pengisian meragukan, ringkasan eksekutif menyatakannya di kalimat
   pertama, bukan menyembunyikannya di catatan kaki halaman terakhir.
═══════════════════════════════════════════════════════════════════════════ */

import type {
  AssessmentReport,
  JobProfile,
  NormGroup,
  ResponseMap,
  SectionTiming,
} from "./types";
import { BATTERY_BY_ID } from "./batteries";
import { scoreAll } from "./scoring";
import { applyNorms, BAND_LABELS } from "./norms";
import { buildValidityReport } from "./validity";
import { interpretAll, interpretSjtTotal } from "./interpretation";
import { computeFit, FIT_VERDICT_LABELS } from "./job-profiles";
import { scaleName } from "./scales";

export interface BuildReportInput {
  sessionId: string;
  candidateName: string;
  position: string;
  batteryId: string;
  completedAt: string;
  responses: ResponseMap;
  /** Item yang benar-benar disajikan ke peserta (gabungan section baterai). */
  presentedItemIds: string[];
  timings: SectionTiming[];
  /** Norma yang berlaku — caller memilihnya lewat pickNormGroupForDate(). */
  normGroup: NormGroup;
  /** Profil jabatan target. null = laporan profil saja tanpa penilaian kesesuaian. */
  profile: JobProfile | null;
}

export function buildAssessmentReport(input: BuildReportInput): AssessmentReport {
  const battery = BATTERY_BY_ID[input.batteryId];
  const rawScores = scoreAll(input.responses, input.presentedItemIds);
  const { scores, missingNorms } = applyNorms(rawScores, input.normGroup);
  const validity = buildValidityReport(input.responses, input.presentedItemIds, input.timings);

  const interpretations = interpretAll(scores);
  const sjtTotal = interpretSjtTotal(scores);
  if (sjtTotal) interpretations.push(sjtTotal);

  const fit = input.profile ? computeFit(scores, input.profile) : null;

  return {
    sessionId: input.sessionId,
    candidateName: input.candidateName,
    position: input.position,
    batteryId: input.batteryId,
    batteryName: battery?.name ?? input.batteryId,
    completedAt: input.completedAt,
    normGroupId: input.normGroup.id,
    normLabel: input.normGroup.label,
    normProvenance: input.normGroup.provenance,
    scores,
    interpretations,
    validity,
    fit,
    executiveSummary: buildExecutiveSummary(input, scores, validity, fit),
    recommendedActions: buildRecommendedActions(validity, fit, scores),
    limitations: buildLimitations(input.normGroup, validity, missingNorms.length),
  };
}

/* ─── Ringkasan eksekutif ─── */

function buildExecutiveSummary(
  input: BuildReportInput,
  scores: AssessmentReport["scores"],
  validity: AssessmentReport["validity"],
  fit: AssessmentReport["fit"],
): string {
  const parts: string[] = [];

  // Kalimat pertama = peringatan kualitas jawaban, kalau ada. Ini yang paling
  // menentukan apakah sisa laporan boleh dibaca sebagai kesimpulan.
  if (validity.overall === "meragukan") {
    parts.push(
      "PERINGATAN: kualitas pengisian meragukan. Angka pada laporan ini belum layak dijadikan dasar keputusan sebelum diverifikasi.",
    );
  } else if (validity.overall === "perhatian") {
    parts.push("Catatan: terdapat indikator kualitas pengisian yang perlu diperhatikan (lihat bagian Kualitas Jawaban).");
  }

  parts.push(
    `${input.candidateName} mengerjakan ${BATTERY_BY_ID[input.batteryId]?.name ?? input.batteryId} untuk posisi ${input.position}.`,
  );

  const cog = scores.find((s) => s.scaleId === "COG_TOTAL");
  if (cog) {
    parts.push(
      `Kemampuan kognitif umum berada pada sten ${cog.sten} (persentil ${cog.percentile}, kategori ${BAND_LABELS[cog.band].toLowerCase()}).`,
    );
  }

  const personality = scores.filter((s) => ["O", "C", "E", "A", "N"].includes(s.scaleId));
  if (personality.length > 0) {
    const notable = personality
      .filter((s) => s.sten >= 8 || s.sten <= 3)
      .map((s) => `${scaleName(s.scaleId)} sten ${s.sten}`);
    parts.push(
      notable.length > 0
        ? `Profil kepribadian kerja paling menonjol pada: ${notable.join("; ")}.`
        : "Profil kepribadian kerja berada pada kisaran rata-rata di kelima domain, tanpa penonjolan yang mencolok.",
    );
  }

  if (fit) {
    parts.push(
      `Kesesuaian terhadap profil ${fit.profileName}: ${fit.fitScore}/100 — ${FIT_VERDICT_LABELS[fit.verdict].toLowerCase()}.`,
    );
    if (fit.criticalFlags.length > 0) {
      parts.push(
        `Terdapat ${fit.criticalFlags.length} skala di bawah ambang kritis posisi ini, yang harus diklarifikasi sebelum melanjutkan.`,
      );
    }
  }

  return parts.join(" ");
}

/* ─── Rekomendasi tindak lanjut ─── */

function buildRecommendedActions(
  validity: AssessmentReport["validity"],
  fit: AssessmentReport["fit"],
  scores: AssessmentReport["scores"],
): string[] {
  const actions: string[] = [];

  if (validity.overall === "meragukan") {
    actions.push("Jadwalkan tes ulang dengan pengawasan sebelum hasil ini dipakai untuk keputusan apa pun.");
  }
  if (validity.indices.some((i) => i.id === "desirability" && i.status !== "ok")) {
    actions.push(
      "Gunakan wawancara berbasis perilaku (STAR) untuk memverifikasi profil kepribadian — minta contoh nyata, bukan pendapat tentang diri sendiri.",
    );
  }
  if (validity.indices.some((i) => i.id === "completion" && i.status !== "ok")) {
    actions.push("Konfirmasi kendala teknis saat pengerjaan; beri kesempatan menyelesaikan bagian yang terlewat bila kendalanya di luar kendali peserta.");
  }

  if (fit) {
    for (const flag of fit.criticalFlags) {
      actions.push(`Klarifikasi wajib sebelum menawarkan posisi — ${flag}`);
    }
    const gaps = fit.details.filter((d) => d.matchPct < 100 && !d.belowCritical);
    for (const g of gaps.slice(0, 3)) {
      actions.push(`Dalami saat wawancara: ${g.scaleName} (sten ${g.sten}, target ${g.targetStenMin}–${g.targetStenMax}).`);
    }
    if (fit.verdict === "direkomendasikan" && fit.criticalFlags.length === 0) {
      actions.push("Lanjutkan ke tahap wawancara berikutnya; gunakan pertanyaan probing pada laporan ini sebagai panduan.");
    }
  }

  const lowCog = scores.find((s) => s.scaleId === "COG_TOTAL" && s.sten <= 3);
  if (lowCog) {
    actions.push(
      "Periksa kondisi pengerjaan tes kognitif (perangkat, koneksi, waktu habis) sebelum menyimpulkan kemampuan — satu skor rendah bukan bukti yang cukup.",
    );
  }

  if (actions.length === 0) {
    actions.push("Tidak ada tindak lanjut khusus. Lanjutkan proses sesuai alur seleksi yang berlaku.");
  }
  return actions;
}

/* ─── Batasan penggunaan ─── */

function buildLimitations(
  norm: NormGroup,
  validity: AssessmentReport["validity"],
  missingNormCount: number,
): string[] {
  const out: string[] = [];

  if (norm.provenance === "synthetic_demo") {
    out.push(
      `Norma pembanding yang dipakai (${norm.label}) bersifat SINTETIS — bukan hasil pengambilan sampel pekerja Indonesia. Persentil dan sten pada laporan ini sah untuk membandingkan kandidat satu sama lain, TIDAK sah sebagai ambang kelulusan absolut.`,
    );
  } else {
    out.push(
      `Norma pembanding: ${norm.label} (n = ${norm.sampleSize}, berlaku sejak ${norm.effectiveDate}). Norma perlu diperbarui bila populasi pelamar berubah.`,
    );
  }

  out.push(
    "Instrumen kepribadian merupakan adaptasi Bahasa Indonesia dari IPIP-BFM-50 (domain publik) yang BELUM melalui uji reliabilitas dan analisis faktor pada sampel Indonesia.",
  );
  out.push(
    "Item kognitif dan SJT ditulis sendiri dan belum melalui analisis butir maupun studi validitas prediktif terhadap kinerja.",
  );
  out.push(
    "Hasil asesmen adalah SATU sumber bukti. Keputusan seleksi harus menggabungkannya dengan CV, wawancara terstruktur, dan sampel kerja — tidak boleh diambil dari skor tes semata.",
  );
  out.push(
    "Hasil bersifat gambaran pada saat pengerjaan, bukan sifat permanen. Masa berlaku yang wajar untuk dipakai kembali: 12 bulan.",
  );
  out.push(
    "Data hasil asesmen adalah data pribadi (UU PDP No. 27/2022). Akses dibatasi pada pihak yang berkepentingan dalam proses seleksi, dan peserta berhak memperoleh umpan balik atas hasilnya.",
  );

  if (missingNormCount > 0) {
    out.push(
      `${missingNormCount} skala tidak memiliki baris norma sehingga tidak ditampilkan. Skala tersebut sengaja dihilangkan, bukan diberi nilai perkiraan.`,
    );
  }
  if (validity.overall !== "ok") {
    out.push("Terdapat catatan kualitas pengisian — lihat bagian Kualitas Jawaban sebelum membaca skor.");
  }

  return out;
}
