/* ═══════════════════════════════════════════════════════════════════════════
   Registri SKALA — satu sumber kebenaran untuk nama, deskripsi, dan arah skala.
   Dipakai bersama oleh engine penskoran, interpretasi, profil jabatan, dan UI,
   supaya nama skala tidak pernah berbeda antara laporan dan layar.
═══════════════════════════════════════════════════════════════════════════ */

import type { ScaleDefinition, ScaleId } from "./types";
import { SUBTEST_LABELS } from "./items-cognitive";
import { SJT_DIMENSION_LABELS } from "./items-sjt";

export const BIG_FIVE_SCALES: ScaleDefinition[] = [
  {
    id: "O",
    kind: "personality",
    name: "Keterbukaan terhadap Pengalaman",
    academicName: "Openness to Experience",
    description:
      "Ketertarikan pada gagasan baru, cara kerja baru, dan hal yang belum familiar. Skor tinggi cocok untuk pekerjaan yang menuntut pembaruan; skor rendah cocok untuk pekerjaan yang menuntut konsistensi prosedur.",
    higherIsGenerallyBetter: false,
  },
  {
    id: "C",
    kind: "personality",
    name: "Kehati-hatian & Keteraturan",
    academicName: "Conscientiousness",
    description:
      "Keteraturan, ketelitian, kedisiplinan pada tenggat dan prosedur. Satu-satunya sifat Big Five yang memprediksi kinerja pada hampir semua jenis pekerjaan (Barrick & Mount, 1991).",
    higherIsGenerallyBetter: true,
  },
  {
    id: "E",
    kind: "personality",
    name: "Ekstraversi",
    academicName: "Extraversion",
    description:
      "Kecenderungan mencari interaksi, berbicara di depan orang, dan mendapat energi dari keramaian. Relevan untuk peran penjualan, layanan, dan penyeliaan; bukan keunggulan universal.",
    higherIsGenerallyBetter: false,
  },
  {
    id: "A",
    kind: "personality",
    name: "Keramahan & Kerja Sama",
    academicName: "Agreeableness",
    description:
      "Kecenderungan bekerja sama, mempertimbangkan orang lain, dan menghindari konflik. Skor sangat tinggi dapat menyulitkan peran yang menuntut negosiasi keras atau penegakan aturan.",
    higherIsGenerallyBetter: false,
  },
  {
    id: "N",
    kind: "personality",
    name: "Reaktivitas Emosional",
    academicName: "Neuroticism (kebalikan dari Emotional Stability)",
    description:
      "Kepekaan terhadap tekanan dan kecepatan pulih setelah masalah. PERHATIAN ARAH: skor TINGGI berarti reaktivitas tinggi / stabilitas emosional lebih rendah — bukan hasil yang lebih baik.",
    higherIsGenerallyBetter: false,
  },
];

export const COGNITIVE_SCALES: ScaleDefinition[] = [
  {
    id: "COG_NUM",
    kind: "cognitive",
    name: SUBTEST_LABELS.NUM,
    academicName: "Numerical Reasoning",
    description: "Kemampuan bekerja dengan angka, proporsi, persentase, dan pola bilangan dalam konteks kerja.",
    higherIsGenerallyBetter: true,
  },
  {
    id: "COG_VER",
    kind: "cognitive",
    name: SUBTEST_LABELS.VER,
    academicName: "Verbal Reasoning",
    description: "Pemahaman makna kata, hubungan antar-konsep, dan penarikan kesimpulan dari teks.",
    higherIsGenerallyBetter: true,
  },
  {
    id: "COG_LOG",
    kind: "cognitive",
    name: SUBTEST_LABELS.LOG,
    academicName: "Logical / Abstract Reasoning",
    description: "Mengenali pola, aturan, dan konsistensi logis tanpa bergantung pada pengetahuan sebelumnya.",
    higherIsGenerallyBetter: true,
  },
  {
    id: "COG_TOTAL",
    kind: "cognitive",
    name: "Kemampuan Kognitif Umum",
    academicName: "General Mental Ability (GMA)",
    description:
      "Gabungan tiga sub-tes. Prediktor tunggal terkuat untuk kinerja kerja dan kecepatan belajar pekerjaan baru.",
    higherIsGenerallyBetter: true,
  },
];

export const SJT_SCALES: ScaleDefinition[] = [
  ...(Object.entries(SJT_DIMENSION_LABELS) as [keyof typeof SJT_DIMENSION_LABELS, string][]).map(
    ([dim, label]): ScaleDefinition => ({
      id: `SJT_${dim}` as ScaleId,
      kind: "sjt",
      name: label,
      academicName: `Situational Judgement — ${label}`,
      description: `Ketepatan penilaian situasi kerja pada aspek ${label.toLowerCase()}.`,
      higherIsGenerallyBetter: true,
    }),
  ),
  {
    id: "SJT_TOTAL",
    kind: "sjt",
    name: "Penilaian Situasional (Total)",
    academicName: "Situational Judgement Test — Total",
    description: "Rata-rata ketepatan penilaian di seluruh skenario kerja.",
    higherIsGenerallyBetter: true,
  },
];

export const ALL_SCALES: ScaleDefinition[] = [...BIG_FIVE_SCALES, ...COGNITIVE_SCALES, ...SJT_SCALES];

export const SCALE_BY_ID: Record<string, ScaleDefinition> = Object.fromEntries(
  ALL_SCALES.map((s) => [s.id, s]),
);

export function scaleName(id: ScaleId): string {
  return SCALE_BY_ID[id]?.name ?? id;
}
