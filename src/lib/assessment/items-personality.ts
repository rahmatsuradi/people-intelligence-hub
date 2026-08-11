/* ═══════════════════════════════════════════════════════════════════════════
   Bank item KEPRIBADIAN — adaptasi Bahasa Indonesia IPIP-BFM-50.

   SUMBER ITEM
   Goldberg, L. R. (1992/1999). International Personality Item Pool (IPIP),
   50-item Big-Five Factor Markers. https://ipip.ori.org
   IPIP berada di DOMAIN PUBLIK: itemnya boleh dipakai, diubah, dan
   diterjemahkan untuk tujuan apa pun tanpa izin maupun biaya lisensi.
   Inilah alasan instrumen ini yang dipakai, bukan NEO-PI-R / 16PF / OPQ /
   Hogan / Papikostick / DISC — semuanya berhak cipta dan berlisensi.

   STATUS ADAPTASI — dinyatakan apa adanya, jangan dinaikkan klaimnya:
   teks di bawah adalah adaptasi bahasa yang ditulis untuk repo ini, BUKAN
   versi Indonesia yang sudah melewati back-translation, uji reliabilitas,
   maupun analisis faktor pada sampel Indonesia. Selama itu belum dikerjakan,
   hasilnya sah dipakai sebagai bahan diskusi/probing wawancara, dan TIDAK sah
   dipakai sebagai satu-satunya dasar menolak pelamar.

   STRUKTUR: 10 item per domain (5 keyed +, 5 keyed −). Reverse-keyed item
   dipakai untuk menahan acquiescence bias (kecenderungan menyetujui apa pun).
═══════════════════════════════════════════════════════════════════════════ */

import type { PersonalityItem } from "./types";

const item = (
  id: string,
  text: string,
  scale: PersonalityItem["scale"],
  keying: 1 | -1,
): PersonalityItem => ({ id, format: "likert5", text, scale, keying });

export const LIKERT5_LABELS = [
  "Sangat tidak sesuai",
  "Tidak sesuai",
  "Netral",
  "Sesuai",
  "Sangat sesuai",
] as const;

/* ─── Extraversion (E) ─── */
const EXTRAVERSION: PersonalityItem[] = [
  item("P-E01", "Saya mudah memulai percakapan dengan orang yang baru saya temui.", "E", 1),
  item("P-E02", "Saya merasa nyaman menjadi pusat perhatian di dalam kelompok.", "E", 1),
  item("P-E03", "Saya termasuk orang yang banyak bicara saat rapat.", "E", 1),
  item("P-E04", "Saya cepat akrab dengan rekan kerja baru.", "E", 1),
  item("P-E05", "Saya mendapat energi setelah berinteraksi dengan banyak orang.", "E", 1),
  item("P-E06", "Saya lebih banyak diam ketika berada di antara orang asing.", "E", -1),
  item("P-E07", "Saya cenderung menghindari menarik perhatian pada diri saya.", "E", -1),
  item("P-E08", "Saya lebih suka bekerja sendirian daripada dalam kelompok besar.", "E", -1),
  item("P-E09", "Saya butuh waktu lama untuk merasa nyaman di lingkungan baru.", "E", -1),
  item("P-E10", "Saya merasa lelah setelah acara yang ramai.", "E", -1),
];

/* ─── Agreeableness (A) ─── */
const AGREEABLENESS: PersonalityItem[] = [
  item("P-A01", "Saya peduli pada kesulitan yang dialami orang lain.", "A", 1),
  item("P-A02", "Saya berusaha membuat orang lain merasa nyaman bekerja dengan saya.", "A", 1),
  item("P-A03", "Saya bersedia meluangkan waktu untuk membantu rekan kerja.", "A", 1),
  item("P-A04", "Saya mencoba memahami sudut pandang orang sebelum menilai.", "A", 1),
  item("P-A05", "Saya mudah memaafkan kesalahan orang lain.", "A", 1),
  item("P-A06", "Saya kurang tertarik pada masalah pribadi orang lain.", "A", -1),
  item("P-A07", "Saya sering merasa orang lain terlalu banyak menuntut.", "A", -1),
  item("P-A08", "Saya terbiasa mengatakan pendapat saya tanpa memikirkan perasaan orang.", "A", -1),
  item("P-A09", "Saya sulit percaya pada niat baik orang yang baru dikenal.", "A", -1),
  item("P-A10", "Saya cenderung menyimpan kekesalan pada orang yang mengecewakan saya.", "A", -1),
];

/* ─── Conscientiousness (C) ─── */
const CONSCIENTIOUSNESS: PersonalityItem[] = [
  item("P-C01", "Saya menyelesaikan pekerjaan sesuai tenggat yang dijanjikan.", "C", 1),
  item("P-C02", "Saya memeriksa ulang hasil kerja saya sebelum diserahkan.", "C", 1),
  item("P-C03", "Saya menjaga catatan dan dokumen kerja tetap rapi.", "C", 1),
  item("P-C04", "Saya membuat rencana sebelum mulai mengerjakan sesuatu.", "C", 1),
  item("P-C05", "Saya mengikuti prosedur kerja meskipun tidak ada yang mengawasi.", "C", 1),
  item("P-C06", "Saya sering menunda pekerjaan sampai mendekati tenggat.", "C", -1),
  item("P-C07", "Saya kurang teliti pada detail kecil.", "C", -1),
  item("P-C08", "Meja dan file kerja saya sering berantakan.", "C", -1),
  item("P-C09", "Saya mudah teralihkan dari tugas yang sedang dikerjakan.", "C", -1),
  item("P-C10", "Saya lebih suka langsung mengerjakan tanpa membuat rencana.", "C", -1),
];

/* ─── Neuroticism / Emotional stability (N) ───
   Skala ini di-key ke arah NEUROTICISM (skor tinggi = reaktivitas emosional
   tinggi), sesuai konvensi Big Five. UI wajib menampilkannya dengan arah yang
   benar: sten tinggi di sini BUKAN kabar baik. */
const NEUROTICISM: PersonalityItem[] = [
  item("P-N01", "Saya mudah merasa cemas saat pekerjaan menumpuk.", "N", 1),
  item("P-N02", "Suasana hati saya berubah cukup cepat.", "N", 1),
  item("P-N03", "Saya sering mengkhawatirkan hal-hal yang belum tentu terjadi.", "N", 1),
  item("P-N04", "Kritik dari atasan cukup lama mengganggu pikiran saya.", "N", 1),
  item("P-N05", "Saya mudah merasa tertekan ketika ada banyak tuntutan sekaligus.", "N", 1),
  item("P-N06", "Saya tetap tenang dalam situasi yang menegangkan.", "N", -1),
  item("P-N07", "Saya jarang merasa terganggu oleh masalah pekerjaan.", "N", -1),
  item("P-N08", "Saya bisa mengendalikan emosi saat sedang kesal.", "N", -1),
  item("P-N09", "Saya pulih dengan cepat setelah mengalami kegagalan.", "N", -1),
  item("P-N10", "Saya merasa santai hampir sepanjang waktu.", "N", -1),
];

/* ─── Openness to experience (O) ─── */
const OPENNESS: PersonalityItem[] = [
  item("P-O01", "Saya tertarik mempelajari cara kerja hal-hal baru.", "O", 1),
  item("P-O02", "Saya senang memikirkan ide dan konsep yang abstrak.", "O", 1),
  item("P-O03", "Saya sering mengusulkan cara baru dalam menyelesaikan pekerjaan.", "O", 1),
  item("P-O04", "Saya menikmati pekerjaan yang menuntut imajinasi.", "O", 1),
  item("P-O05", "Saya suka membaca atau mencari tahu topik di luar bidang saya.", "O", 1),
  item("P-O06", "Saya kurang tertarik pada pembahasan yang bersifat teoretis.", "O", -1),
  item("P-O07", "Saya lebih nyaman dengan cara kerja yang sudah biasa dipakai.", "O", -1),
  item("P-O08", "Saya menghindari pekerjaan yang menuntut banyak improvisasi.", "O", -1),
  item("P-O09", "Saya jarang tertarik pada gagasan yang belum terbukti.", "O", -1),
  item("P-O10", "Saya kesulitan memahami gagasan yang rumit dan berlapis.", "O", -1),
];

/* ─── Item kontrol kualitas jawaban (tidak masuk skor sifat) ───
   ATTENTION CHECK: item dengan jawaban yang sudah ditentukan di dalam teksnya.
   Jawaban yang meleset = indikasi item tidak dibaca. Praktik standar pada
   asesmen daring tanpa pengawas.

   DESIRABILITY: skala indikatif buatan sendiri untuk mendeteksi kecenderungan
   menampilkan diri terlalu sempurna. Ini BUKAN BIDR maupun MC-SDS (keduanya
   berhak cipta). Fungsinya hanya memicu verifikasi tambahan, bukan menolak. */
const QC_ITEMS: PersonalityItem[] = [
  { id: "P-QC01", format: "likert5", text: "Untuk memastikan Anda membaca setiap pernyataan, pilih \"Tidak sesuai\" pada pernyataan ini.", scale: "C", keying: 1, qc: "attention" },
  { id: "P-QC02", format: "likert5", text: "Untuk memeriksa ketelitian, pilih \"Sesuai\" pada pernyataan ini.", scale: "C", keying: 1, qc: "attention" },
  { id: "P-SD01", format: "likert5", text: "Saya tidak pernah sekalipun terlambat masuk kerja.", scale: "C", keying: 1, qc: "desirability" },
  { id: "P-SD02", format: "likert5", text: "Saya tidak pernah merasa kesal kepada siapa pun.", scale: "A", keying: 1, qc: "desirability" },
  { id: "P-SD03", format: "likert5", text: "Semua janji yang pernah saya buat selalu saya tepati.", scale: "C", keying: 1, qc: "desirability" },
  { id: "P-SD04", format: "likert5", text: "Saya tidak pernah berbicara buruk tentang orang lain.", scale: "A", keying: 1, qc: "desirability" },
];

/** Jawaban yang seharusnya diberikan pada tiap attention check. */
export const ATTENTION_CHECK_KEY: Record<string, number> = {
  "P-QC01": 2, // "Tidak sesuai"
  "P-QC02": 4, // "Sesuai"
};

/** Pasangan item yang isinya sangat berdekatan namun arah key-nya berlawanan.
 *  Selisih besar yang konsisten = jawaban tidak konsisten (asal isi / tidak
 *  membaca), bukan sekadar variasi wajar. */
export const INCONSISTENCY_PAIRS: [string, string][] = [
  ["P-C01", "P-C06"], // tepat waktu vs suka menunda
  ["P-C02", "P-C07"], // memeriksa ulang vs kurang teliti
  ["P-E01", "P-E06"], // mudah memulai obrolan vs diam di antara orang asing
  ["P-N01", "P-N06"], // mudah cemas vs tetap tenang
  ["P-O03", "P-O07"], // mengusulkan cara baru vs nyaman cara lama
];

/** Item kepribadian yang masuk skor sifat (tanpa item QC). */
export const PERSONALITY_ITEMS: PersonalityItem[] = [
  ...EXTRAVERSION,
  ...AGREEABLENESS,
  ...CONSCIENTIOUSNESS,
  ...NEUROTICISM,
  ...OPENNESS,
];

/** Semua item yang ditampilkan di section kepribadian (skor + QC), diselang-seling
 *  supaya item satu domain tidak muncul berurutan (menekan efek halo per blok). */
export const PERSONALITY_SECTION_ITEMS: PersonalityItem[] = interleave(
  [EXTRAVERSION, AGREEABLENESS, CONSCIENTIOUSNESS, NEUROTICISM, OPENNESS],
  QC_ITEMS,
);

export const PERSONALITY_QC_ITEMS = QC_ITEMS;

/** Ambil item per id (untuk render & penilaian). */
export const PERSONALITY_ITEM_BY_ID: Record<string, PersonalityItem> = Object.fromEntries(
  PERSONALITY_SECTION_ITEMS.map((i) => [i.id, i]),
);

/** Menyusun item bergantian antar domain, lalu menyisipkan item QC pada posisi
 *  yang tersebar. Urutan bersifat deterministik (bukan acak) supaya nomor item
 *  pada laporan lama tetap merujuk item yang sama. */
function interleave(groups: PersonalityItem[][], qc: PersonalityItem[]): PersonalityItem[] {
  const out: PersonalityItem[] = [];
  const maxLen = Math.max(...groups.map((g) => g.length));
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) if (g[i]) out.push(g[i]);
  }
  // Sisipkan item QC merata: setelah tiap (total/qc.length) item.
  const step = Math.floor(out.length / (qc.length + 1)) || 1;
  const withQc: PersonalityItem[] = [];
  let qcIdx = 0;
  out.forEach((it, idx) => {
    withQc.push(it);
    if (qcIdx < qc.length && (idx + 1) % step === 0) withQc.push(qc[qcIdx++]);
  });
  while (qcIdx < qc.length) withQc.push(qc[qcIdx++]);
  return withQc;
}
