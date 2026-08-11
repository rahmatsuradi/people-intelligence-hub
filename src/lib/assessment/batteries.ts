/* ═══════════════════════════════════════════════════════════════════════════
   BATERAI TES — susunan section yang dikerjakan peserta.

   Tiga baterai standar, mengikuti pola yang lazim dipakai perusahaan
   multinasional: penyaringan cepat di tahap awal (kognitif saja), baterai penuh
   untuk kandidat yang lolos wawancara awal, dan baterai kepemimpinan untuk
   posisi penyeliaan/manajerial.

   Urutan section disengaja: kognitif dulu selagi peserta masih segar (sub-tes
   berbatas waktu paling terpengaruh kelelahan), kepribadian terakhir karena
   tidak berbatas waktu.
═══════════════════════════════════════════════════════════════════════════ */

import type { BatteryDefinition, BatterySection } from "./types";
import {
  COGNITIVE_ITEMS_BY_SUBTEST,
  SUBTEST_LABELS,
  SUBTEST_TIME_LIMIT_SEC,
} from "./items-cognitive";
import { PERSONALITY_SECTION_ITEMS } from "./items-personality";
import { SJT_ITEMS, selectSjtItems } from "./items-sjt";

const cogSection = (sub: "NUM" | "VER" | "LOG"): BatterySection => ({
  id: `sec-cog-${sub.toLowerCase()}`,
  title: SUBTEST_LABELS[sub],
  instruction:
    "Pilih satu jawaban yang paling tepat. Bagian ini berbatas waktu — kerjakan secepat mungkin tanpa mengorbankan ketelitian. Jawaban yang dilewati dihitung sebagai tidak benar.",
  itemIds: COGNITIVE_ITEMS_BY_SUBTEST[sub].map((i) => i.id),
  timeLimitSec: SUBTEST_TIME_LIMIT_SEC[sub],
  kind: "cognitive",
});

const personalitySection: BatterySection = {
  id: "sec-personality",
  title: "Inventori Kepribadian Kerja",
  instruction:
    "Tidak ada jawaban benar atau salah, dan bagian ini tidak berbatas waktu. Jawablah sesuai keadaan Anda yang sebenarnya, bukan yang Anda anggap paling disukai perusahaan — terdapat pemeriksaan konsistensi jawaban di dalamnya.",
  itemIds: PERSONALITY_SECTION_ITEMS.map((i) => i.id),
  timeLimitSec: null,
  kind: "personality",
};

const sjtSection = (context: "manufaktur" | "media" | "all"): BatterySection => ({
  id: "sec-sjt",
  title: "Penilaian Situasi Kerja",
  instruction:
    "Setiap skenario menggambarkan situasi kerja nyata. Pilih tindakan yang menurut Anda paling efektif untuk dilakukan pada situasi tersebut.",
  itemIds: (context === "all" ? SJT_ITEMS : selectSjtItems(context)).map((i) => i.id),
  timeLimitSec: 20 * 60,
  kind: "sjt",
});

/** Baterai penuh — dipakai untuk mayoritas posisi setelah wawancara awal. */
export const BATTERY_FULL: BatteryDefinition = {
  id: "BAT-FULL",
  name: "Baterai Lengkap (Kognitif + Kepribadian + SJT)",
  description:
    "Tiga sumber bukti yang saling melengkapi: kemampuan kognitif (bisa/tidak bisa), kepribadian kerja (cara bekerja), dan penilaian situasional (keputusan di situasi nyata). Kombinasi ini yang memberi prediksi paling baik dibanding salah satunya saja.",
  sections: [cogSection("NUM"), cogSection("VER"), cogSection("LOG"), sjtSection("all"), personalitySection],
  estimatedMinutes: 75,
};

/** Penyaringan cepat — tahap awal untuk volume pelamar besar. */
export const BATTERY_SCREENING: BatteryDefinition = {
  id: "BAT-SCREEN",
  name: "Penyaringan Awal (Kognitif)",
  description:
    "Hanya tiga sub-tes kognitif berbatas waktu. Dipakai pada tahap awal ketika jumlah pelamar besar dan yang dibutuhkan adalah penyaringan kasar yang cepat, bukan profil lengkap.",
  sections: [cogSection("NUM"), cogSection("VER"), cogSection("LOG")],
  estimatedMinutes: 35,
};

/** Baterai kepemimpinan — posisi supervisor ke atas. */
export const BATTERY_LEADERSHIP: BatteryDefinition = {
  id: "BAT-LEAD",
  name: "Baterai Kepemimpinan (Supervisor ke atas)",
  description:
    "Menekankan penilaian situasional dan kepribadian kerja karena pada posisi penyeliaan, cara mengambil keputusan dan mengelola orang lebih menentukan dibanding kecepatan berhitung.",
  sections: [cogSection("VER"), cogSection("LOG"), sjtSection("all"), personalitySection],
  estimatedMinutes: 60,
};

export const ALL_BATTERIES: BatteryDefinition[] = [
  BATTERY_FULL,
  BATTERY_SCREENING,
  BATTERY_LEADERSHIP,
];

export const BATTERY_BY_ID: Record<string, BatteryDefinition> = Object.fromEntries(
  ALL_BATTERIES.map((b) => [b.id, b]),
);

/** Total item pada sebuah baterai — dipakai untuk progress bar dan estimasi. */
export function batteryItemCount(b: BatteryDefinition): number {
  return b.sections.reduce((sum, s) => sum + s.itemIds.length, 0);
}
