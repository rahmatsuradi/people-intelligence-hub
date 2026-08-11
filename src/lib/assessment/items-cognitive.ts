/* ═══════════════════════════════════════════════════════════════════════════
   Bank item KEMAMPUAN KOGNITIF (GMA) — ditulis sendiri untuk repo ini.

   MENGAPA ADA: kemampuan kognitif umum lama dianggap prediktor kinerja kerja
   terkuat (Schmidt & Hunter, 1998, Psychological Bulletin 124(2), 262-274,
   r = .51). Angka itu direvisi TURUN oleh Sackett dkk. (2022, Journal of
   Applied Psychology 107(11), 2040-2068) menjadi r = .31 setelah koreksi
   range-restriction yang sistematis berlebih diperbaiki; pada revisi itu
   wawancara terstruktur (r = .42) justru menjadi prediktor tunggal terkuat.
   Tes kognitif tetap salah satu prediktor terkuat dan tetap dipakai di tahap
   awal seleksi -- tetapi klaim "prediktor terbaik" sudah tidak akurat lagi, dan
   tidak boleh dipakai di repo ini.

   ITEM DITULIS SENDIRI. Tidak ada satu pun item yang disalin dari CFIT, IST,
   TIU/TKD, Raven's APM, Watson-Glaser, SHL Verify, atau bank soal berhak cipta
   lainnya. Menyalin item dari instrumen berlisensi bukan hanya pelanggaran hak
   cipta — item yang bocor juga kehilangan daya bedanya.

   BATASAN YANG HARUS DIAKUI: item ini BELUM melalui analisis butir (tingkat
   kesukaran, daya beda, analisis distraktor) pada sampel nyata. Angka yang
   keluar layak dipakai sebagai penyaring kasar dan bahan wawancara, belum layak
   dipakai sebagai skor tunggal penentu kelulusan.
═══════════════════════════════════════════════════════════════════════════ */

import type { CognitiveItem, CognitiveSubtest } from "./types";

const q = (
  id: string,
  subtest: CognitiveSubtest,
  text: string,
  options: string[],
  answerIndex: number,
  rationale: string,
): CognitiveItem => ({ id, format: "multiple_choice", subtest, text, options, answerIndex, rationale });

/* ─── Penalaran numerik ─── */
const NUMERIC: CognitiveItem[] = [
  q("C-N01", "NUM",
    "Sebuah lini produksi menghasilkan 1.200 potong per hari. Setelah penambahan mesin, kapasitasnya naik 15%. Berapa potong per hari kapasitas barunya?",
    ["1.320", "1.350", "1.380", "1.415"], 2,
    "1.200 × 1,15 = 1.380."),
  q("C-N02", "NUM",
    "Lanjutkan deret: 3, 6, 12, 24, …",
    ["30", "36", "42", "48"], 3,
    "Setiap suku dikalikan 2: 24 × 2 = 48."),
  q("C-N03", "NUM",
    "Target produksi bulan ini 4.500 unit dalam 25 hari kerja. Sampai hari ke-10 baru tercapai 1.800 unit. Berapa rata-rata unit per hari yang harus dicapai pada 15 hari kerja tersisa?",
    ["150", "170", "180", "200"], 2,
    "(4.500 − 1.800) ÷ 15 = 2.700 ÷ 15 = 180."),
  q("C-N04", "NUM",
    "Harga sebuah barang Rp250.000. Diberikan diskon 20%, lalu hasilnya dikenakan PPN 11%. Berapa harga akhir yang dibayar?",
    ["Rp216.000", "Rp220.000", "Rp222.000", "Rp227.500"], 2,
    "250.000 × 0,8 = 200.000; 200.000 × 1,11 = 222.000."),
  q("C-N05", "NUM",
    "Anggaran sebesar Rp320 juta dibagi antara dua divisi dengan perbandingan 3 : 5. Berapa bagian divisi yang lebih kecil?",
    ["Rp96 juta", "Rp112 juta", "Rp120 juta", "Rp128 juta"], 2,
    "Total bagian = 8. 3/8 × 320 juta = 120 juta."),
  q("C-N06", "NUM",
    "Lanjutkan deret: 81, 27, 9, …",
    ["1", "3", "4", "6"], 1,
    "Setiap suku dibagi 3: 9 ÷ 3 = 3."),
  q("C-N07", "NUM",
    "Dari 8.000 unit hasil produksi, tingkat reject 2,5%. Berapa unit yang reject?",
    ["160", "180", "200", "250"], 2,
    "8.000 × 0,025 = 200."),
  q("C-N08", "NUM",
    "Enam mesin menghasilkan 900 unit dalam 3 jam. Dengan laju yang sama, berapa unit yang dihasilkan 10 mesin dalam 2 jam?",
    ["900", "1.000", "1.100", "1.200"], 1,
    "Laju = 900 ÷ (6 × 3) = 50 unit per mesin-jam. 10 × 2 × 50 = 1.000."),
  q("C-N09", "NUM",
    "Lanjutkan deret: 2, 5, 11, 23, …",
    ["35", "41", "46", "47"], 3,
    "Pola: dikali 2 lalu ditambah 1. 23 × 2 + 1 = 47."),
  q("C-N10", "NUM",
    "Rata-rata lima nilai adalah 78. Bila satu nilai sebesar 90 dikeluarkan, berapa rata-rata empat nilai sisanya?",
    ["74", "75", "76", "77"], 1,
    "Total = 5 × 78 = 390. (390 − 90) ÷ 4 = 75."),
];

/* ─── Penalaran verbal ─── */
const VERBAL: CognitiveItem[] = [
  q("C-V01", "VER",
    "Kata yang paling dekat maknanya dengan MITIGASI adalah …",
    ["memperbesar dampak", "mengurangi dampak atau risiko", "menunda keputusan", "mengukur hasil"], 1,
    "Mitigasi = tindakan mengurangi dampak/risiko."),
  q("C-V02", "VER",
    "DOKTER : PASIEN = GURU : …",
    ["sekolah", "murid", "buku pelajaran", "kepala sekolah"], 1,
    "Relasi pemberi layanan → penerima layanan."),
  q("C-V03", "VER",
    "Lawan kata EKSPLISIT adalah …",
    ["tegas", "tersirat", "tertulis", "terperinci"], 1,
    "Eksplisit = dinyatakan terang-terangan; lawannya implisit/tersirat."),
  q("C-V04", "VER",
    "Semua karyawan tetap menerima THR. Sebagian karyawan tetap bekerja di bagian produksi. Kesimpulan yang PASTI benar adalah …",
    [
      "Semua pekerja bagian produksi menerima THR",
      "Sebagian pekerja bagian produksi menerima THR",
      "Tidak ada pekerja bagian produksi yang menerima THR",
      "Semua penerima THR bekerja di bagian produksi",
    ], 1,
    "Karyawan tetap di produksi termasuk 'karyawan tetap', jadi sebagian pekerja produksi pasti menerima THR. Pilihan lain melebihi yang diketahui."),
  q("C-V05", "VER",
    "Kata yang paling dekat maknanya dengan KREDIBEL adalah …",
    ["dapat dipercaya", "dapat diukur", "dapat diubah", "dapat dijangkau"], 0,
    "Kredibel = dapat dipercaya."),
  q("C-V06", "VER",
    "TERMOMETER : SUHU = … : TEKANAN UDARA",
    ["altimeter", "barometer", "higrometer", "anemometer"], 1,
    "Barometer mengukur tekanan udara; termometer mengukur suhu."),
  q("C-V07", "VER",
    "Semua supervisor wajib mengikuti pelatihan K3. Budi mengikuti pelatihan K3. Kesimpulan yang tepat adalah …",
    [
      "Budi pasti seorang supervisor",
      "Budi pasti bukan supervisor",
      "Tidak dapat disimpulkan apakah Budi supervisor",
      "Semua peserta pelatihan K3 adalah supervisor",
    ], 2,
    "Premis hanya menyatakan supervisor → ikut pelatihan, bukan sebaliknya. Menyimpulkan sebaliknya adalah kekeliruan afirmasi konsekuen."),
  q("C-V08", "VER",
    "Manakah kata yang TIDAK sekelompok dengan lainnya?",
    ["nota", "faktur", "kuitansi", "gudang"], 3,
    "Nota, faktur, dan kuitansi adalah dokumen transaksi; gudang adalah tempat."),
  q("C-V09", "VER",
    "Lawan kata SURPLUS adalah …",
    ["laba", "defisit", "stagnan", "kelebihan"], 1,
    "Surplus = kelebihan; lawannya defisit = kekurangan."),
  q("C-V10", "VER",
    "Bacalah: \"Sejak kebijakan kerja hibrida diberlakukan pada Januari, tingkat keterlambatan turun 30% dan jumlah rapat daring naik dua kali lipat. Survei internal menunjukkan kepuasan kerja meningkat, namun karyawan baru melaporkan kesulitan mengenal rekan kerja.\" Pernyataan yang PALING didukung oleh bacaan tersebut adalah …",
    [
      "Rapat daring adalah penyebab turunnya keterlambatan",
      "Kerja hibrida menurunkan produktivitas perusahaan",
      "Setelah kebijakan hibrida, keterlambatan menurun sementara karyawan baru menghadapi hambatan bersosialisasi",
      "Kepuasan kerja meningkat karena jumlah rapat bertambah",
    ], 2,
    "Bacaan hanya melaporkan kejadian yang berbarengan. Pilihan lain menarik hubungan sebab-akibat yang tidak dinyatakan."),
];

/* ─── Penalaran logis / abstrak ─── */
const LOGIC: CognitiveItem[] = [
  q("C-L01", "LOG",
    "Lanjutkan deret huruf: A, C, F, J, …",
    ["M", "N", "O", "P"], 2,
    "Jarak bertambah: +2, +3, +4, lalu +5. J + 5 = O."),
  q("C-L02", "LOG",
    "Lanjutkan deret: 1, 4, 9, 16, …",
    ["20", "22", "25", "36"], 2,
    "Deret kuadrat: 5² = 25."),
  q("C-L03", "LOG",
    "Lanjutkan deret: 2, 3, 5, 8, 13, …",
    ["18", "20", "21", "26"], 2,
    "Setiap suku = jumlah dua suku sebelumnya: 8 + 13 = 21."),
  q("C-L04", "LOG",
    "Ani lebih tinggi dari Budi. Citra lebih pendek dari Budi. Dedi lebih tinggi dari Ani. Siapa yang paling tinggi?",
    ["Ani", "Budi", "Citra", "Dedi"], 3,
    "Urutan: Dedi > Ani > Budi > Citra."),
  q("C-L05", "LOG",
    "Lanjutkan pola: AZ, BY, CX, …",
    ["DV", "DW", "EW", "DX"], 1,
    "Huruf pertama maju (A, B, C, D); huruf kedua mundur (Z, Y, X, W)."),
  q("C-L06", "LOG",
    "Shift operator berputar setiap hari dengan urutan A → B → C → A. Pada hari Senin operator berada di shift B. Ia berada di shift apa pada hari Kamis?",
    ["Shift A", "Shift B", "Shift C", "Tidak dapat ditentukan"], 1,
    "Senin B, Selasa C, Rabu A, Kamis B."),
  q("C-L07", "LOG",
    "\"Tidak benar bahwa semua mesin rusak.\" Pernyataan tersebut berarti …",
    [
      "Semua mesin dalam kondisi baik",
      "Sekurang-kurangnya ada satu mesin yang tidak rusak",
      "Tidak ada mesin yang rusak",
      "Sebagian besar mesin rusak",
    ], 1,
    "Negasi dari 'semua rusak' adalah 'ada minimal satu yang tidak rusak', bukan 'tidak ada yang rusak'."),
  q("C-L08", "LOG",
    "Lengkapi pola pada baris terakhir:\nbaris 1 → 4, 8, 12\nbaris 2 → 5, 10, 15\nbaris 3 → 6, 12, ?",
    ["16", "17", "18", "20"], 2,
    "Setiap baris adalah kelipatan 1×, 2×, 3× dari angka pertama: 6 × 3 = 18."),
  q("C-L09", "LOG",
    "Manakah bilangan yang TIDAK sekelompok dengan lainnya?",
    ["121", "144", "169", "200"], 3,
    "121 = 11², 144 = 12², 169 = 13². 200 bukan bilangan kuadrat."),
  q("C-L10", "LOG",
    "\"Jika laporan selesai sebelum pukul 15.00, pengiriman dilakukan pada hari yang sama.\" Ternyata pengiriman TIDAK dilakukan pada hari itu. Kesimpulan yang pasti benar adalah …",
    [
      "Laporan selesai sebelum pukul 15.00",
      "Laporan tidak selesai sebelum pukul 15.00",
      "Pengiriman ditunda ke lusa",
      "Tidak dapat disimpulkan apa pun",
    ], 1,
    "Modus tollens: jika P → Q dan Q salah, maka P salah."),
];

export const COGNITIVE_ITEMS: CognitiveItem[] = [...NUMERIC, ...VERBAL, ...LOGIC];

export const COGNITIVE_ITEMS_BY_SUBTEST: Record<CognitiveSubtest, CognitiveItem[]> = {
  NUM: NUMERIC,
  VER: VERBAL,
  LOG: LOGIC,
};

export const COGNITIVE_ITEM_BY_ID: Record<string, CognitiveItem> = Object.fromEntries(
  COGNITIVE_ITEMS.map((i) => [i.id, i]),
);

export const SUBTEST_LABELS: Record<CognitiveSubtest, string> = {
  NUM: "Penalaran Numerik",
  VER: "Penalaran Verbal",
  LOG: "Penalaran Logis / Abstrak",
};

/** Batas waktu per sub-tes (detik). Tes kognitif diberi batas waktu karena
 *  kecepatan memang bagian dari konstruk yang diukur; skala kepribadian tidak. */
export const SUBTEST_TIME_LIMIT_SEC: Record<CognitiveSubtest, number> = {
  NUM: 12 * 60,
  VER: 10 * 60,
  LOG: 12 * 60,
};
