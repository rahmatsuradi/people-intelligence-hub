/* ═══════════════════════════════════════════════════════════════════════════
   Bank item SITUATIONAL JUDGEMENT TEST (SJT) — ditulis sendiri untuk repo ini.

   MENGAPA SJT: mengukur penilaian situasional di konteks kerja nyata. Meta-
   analisis McDaniel dkk. (2001, Journal of Applied Psychology 86(4)) melaporkan
   validitas prediktif SJT terhadap kinerja pada kisaran r ≈ .26, dan yang lebih
   penting — SJT memberi tambahan prediksi DI ATAS tes kognitif dan kepribadian
   (incremental validity), sekaligus cenderung menghasilkan perbedaan antar-
   kelompok yang lebih kecil dibanding tes kognitif murni. Itu sebabnya SJT jadi
   komponen standar seleksi di perusahaan multinasional besar.

   PENSKORAN: format "effectiveness-keyed". Setiap opsi diberi nilai 1–5 oleh
   kunci ahli; skor peserta = nilai opsi yang dipilih. Format ini dipilih
   ketimbang "pilih yang terbaik/terburuk" karena memberi gradasi — memilih
   opsi lumayan tidak disamakan dengan memilih opsi terburuk.

   KUNCI = PENILAIAN PRAKTISI, BUKAN HASIL EMPIRIS. Kunci di bawah disusun dari
   prinsip praktik HR/IR Indonesia dan belum divalidasi terhadap data kinerja.
   Skor SJT karenanya dipakai sebagai bahan diskusi terstruktur, bukan angka
   kelulusan mutlak.
═══════════════════════════════════════════════════════════════════════════ */

import type { SjtItem, SjtDimension } from "./types";

const sjt = (
  id: string,
  dimension: SjtDimension,
  context: SjtItem["context"],
  scenario: string,
  options: [string, 1 | 2 | 3 | 4 | 5][],
  rationale: string,
): SjtItem => ({
  id,
  format: "sjt_effectiveness",
  dimension,
  context,
  scenario,
  options: options.map(([text, effectiveness]) => ({ text, effectiveness })),
  rationale,
});

export const SJT_ITEMS: SjtItem[] = [
  /* ─── Kepemimpinan ─── */
  sjt("S-L01", "LEAD", "umum",
    "Salah satu anggota tim Anda dua kali terlambat menyerahkan laporan bulan ini. Kualitas kerjanya selama ini baik dan ia tidak menjelaskan alasan keterlambatan.",
    [
      ["Menegur di forum rapat tim agar yang lain ikut belajar dari kejadian ini.", 1],
      ["Mengambil alih laporannya bulan depan supaya tenggat aman.", 2],
      ["Berbicara empat mata untuk mencari penyebabnya, lalu menyepakati target waktu berikutnya secara tertulis.", 5],
      ["Menunggu satu bulan lagi; bila terulang baru dibicarakan.", 3],
    ],
    "Klarifikasi privat + kesepakatan terukur menangani sebab sekaligus menjaga akuntabilitas. Menegur di depan umum merusak hubungan tanpa menyelesaikan sebab; mengambil alih menghapus akuntabilitas."),

  sjt("S-L02", "LEAD", "manufaktur",
    "Anda supervisor shift. Target output hari ini tinggi, tetapi satu operator terlihat kelelahan dan mulai membuat kesalahan berulang pada mesin potong.",
    [
      ["Meminta operator terus bekerja sampai target tercapai, kesalahan diperbaiki di akhir shift.", 1],
      ["Merotasi operator tersebut ke tugas yang risikonya lebih rendah dan mengatur ulang pembagian beban shift.", 5],
      ["Memulangkan operator tanpa mengatur penggantinya.", 2],
      ["Melaporkan ke manajer produksi dan menunggu keputusan sebelum mengambil tindakan apa pun.", 3],
    ],
    "Kelelahan pada mesin potong adalah risiko keselamatan yang harus ditangani sekarang. Rotasi + penyesuaian beban mengatasi risiko tanpa mengorbankan output."),

  /* ─── Integritas ─── */
  sjt("S-I01", "INTEG", "umum",
    "Seorang vendor yang sedang mengikuti proses tender mengirimkan hadiah pribadi ke rumah Anda menjelang keputusan pemenang.",
    [
      ["Menerima hadiah tetapi berjanji dalam hati untuk tetap menilai secara objektif.", 1],
      ["Mengembalikan hadiah dan melaporkannya kepada atasan atau fungsi kepatuhan sesuai kebijakan perusahaan.", 5],
      ["Menerima hadiah lalu membagikannya ke rekan satu tim.", 1],
      ["Menolak hadiah secara pribadi tanpa melaporkannya ke siapa pun.", 3],
    ],
    "Menolak saja belum cukup: pelaporan melindungi integritas proses tender dan diri sendiri bila hal serupa terulang."),

  sjt("S-I02", "INTEG", "umum",
    "Anda menemukan kesalahan hitung pada laporan yang sudah Anda kirim ke manajemen kemarin. Dampaknya kecil dan kemungkinan besar tidak akan ada yang menyadarinya.",
    [
      ["Diamkan saja karena dampaknya kecil.", 1],
      ["Memperbaiki diam-diam pada laporan bulan berikutnya tanpa memberi tahu siapa pun.", 2],
      ["Segera memberi tahu penerima laporan, mengirim koreksi, dan menjelaskan penyebabnya.", 5],
      ["Memberi tahu rekan kerja untuk meminta pendapat, lalu memutuskan nanti.", 3],
    ],
    "Koreksi proaktif menjaga keandalan data yang dipakai untuk mengambil keputusan; menunda atau menyembunyikan justru memperbesar risiko."),

  /* ─── Kolaborasi ─── */
  sjt("S-C01", "COLLAB", "media",
    "Dua rekan di tim produksi berselisih soal urutan tayang dan mulai saling menahan informasi. Deadline siaran tinggal tiga jam.",
    [
      ["Memihak salah satu agar keputusan cepat diambil.", 2],
      ["Membiarkan mereka menyelesaikan sendiri karena bukan urusan Anda.", 1],
      ["Mengumpulkan keduanya sebentar, menyepakati keputusan untuk tayang hari ini, dan menjadwalkan pembahasan akar masalah setelah siaran.", 5],
      ["Melaporkan keduanya ke atasan dan menunggu instruksi.", 3],
    ],
    "Memisahkan keputusan operasional yang mendesak dari penyelesaian konflik jangka panjang menjaga tayangan sekaligus tidak menguburkan masalahnya."),

  sjt("S-C02", "COLLAB", "umum",
    "Anda membutuhkan data dari divisi lain untuk menyelesaikan pekerjaan, tetapi permintaan Anda sudah dua kali tidak dibalas.",
    [
      ["Mengirim email ke seluruh manajemen untuk menekan divisi tersebut agar merespons.", 1],
      ["Menghubungi langsung penanggung jawabnya, menjelaskan kebutuhan dan tenggatnya, serta menanyakan kendala di sisi mereka.", 5],
      ["Menyelesaikan pekerjaan dengan menebak angkanya.", 1],
      ["Menunggu sampai mereka membalas dan memberi tahu atasan bahwa pekerjaan tertunda karena divisi lain.", 3],
    ],
    "Kontak langsung + konteks tenggat menyelesaikan hambatan tanpa mengeskalasi konflik antar-divisi."),

  /* ─── Pemecahan masalah ─── */
  sjt("S-P01", "PROBSOLV", "manufaktur",
    "Tingkat reject di satu lini naik dari 2% ke 7% dalam seminggu. Belum ada yang tahu penyebabnya.",
    [
      ["Menambah jumlah pemeriksa akhir agar produk reject tidak lolos ke pengiriman.", 3],
      ["Mengumpulkan data reject per shift, per mesin, dan per jenis cacat untuk mempersempit kemungkinan penyebab.", 5],
      ["Mengganti seluruh operator lini tersebut.", 1],
      ["Menunggu satu minggu lagi untuk memastikan kenaikannya bukan kebetulan.", 2],
    ],
    "Stratifikasi data adalah langkah pertama yang benar; menambah pemeriksa hanya menutupi gejala dan menambah biaya."),

  sjt("S-P02", "PROBSOLV", "umum",
    "Atasan meminta Anda menyiapkan analisis dalam dua hari, sementara data yang tersedia baru separuh dan sisanya butuh seminggu untuk dikumpulkan.",
    [
      ["Menyerahkan analisis dari data separuh tanpa menyebutkan keterbatasannya.", 1],
      ["Menolak mengerjakan sampai seluruh data tersedia.", 2],
      ["Menyerahkan analisis awal dua hari lagi dengan cakupan dan keterbatasan data dinyatakan jelas, disertai jadwal versi lengkapnya.", 5],
      ["Meminta perpanjangan tenggat menjadi satu minggu tanpa memberi hasil sementara.", 3],
    ],
    "Memberi hasil sementara yang jujur tentang batasannya memenuhi kebutuhan keputusan tanpa menyesatkan."),

  /* ─── Adaptabilitas ─── */
  sjt("S-A01", "ADAPT", "media",
    "Satu jam sebelum tayang, narasumber utama membatalkan kehadirannya.",
    [
      ["Tetap menayangkan segmen dengan kursi kosong dan menjelaskan pembatalannya saat siaran.", 2],
      ["Menghubungi narasumber cadangan, dan bila tidak ada, menyiapkan format pengganti dari materi yang sudah tersedia.", 5],
      ["Membatalkan segmen dan memperpanjang segmen lain tanpa berkoordinasi dengan tim.", 2],
      ["Meminta produser memutuskan sendiri sambil menunggu instruksi.", 3],
    ],
    "Menyiapkan rencana cadangan berlapis lebih baik daripada satu langkah tunggal atau melempar keputusan."),

  sjt("S-A02", "ADAPT", "umum",
    "Perusahaan mengganti sistem HRIS. Cara kerja Anda selama lima tahun harus berubah dan sistem baru terasa lebih lambat di awal.",
    [
      ["Tetap memakai cara lama secara paralel sampai sistem baru dirasa siap.", 2],
      ["Mengikuti pelatihan, mencatat kendala konkret yang ditemui, dan menyampaikannya ke tim implementasi.", 5],
      ["Mengeluh ke rekan kerja bahwa sistem baru menyulitkan.", 1],
      ["Mengikuti sistem baru tanpa menyampaikan kendala apa pun.", 3],
    ],
    "Adaptasi yang produktif = ikut berubah sekaligus memberi umpan balik yang bisa ditindaklanjuti."),

  /* ─── Kepatuhan & keselamatan ─── */
  sjt("S-S01", "SAFETY", "manufaktur",
    "Anda melihat rekan kerja melepas pelindung mesin agar pekerjaan lebih cepat, dan target hari itu memang sedang ketat.",
    [
      ["Membiarkannya karena target hari itu memang mendesak.", 1],
      ["Menghentikan praktik tersebut saat itu juga, memasang kembali pelindung, dan melaporkan ke supervisor/P2K3.", 5],
      ["Mengingatkan secara lisan tetapi tidak melaporkannya.", 3],
      ["Ikut melakukan hal yang sama agar target tercapai.", 1],
    ],
    "Pelindung mesin adalah pengendalian risiko wajib (UU No. 1/1970 tentang Keselamatan Kerja). Menghentikan + melaporkan mencegah terulang."),

  sjt("S-S02", "SAFETY", "umum",
    "Anda diminta menandatangani berita acara pemeriksaan alat yang sebenarnya belum Anda periksa, karena auditor akan datang besok.",
    [
      ["Menandatangani karena diminta atasan dan pemeriksaannya bisa menyusul.", 1],
      ["Menolak menandatangani, dan menawarkan melakukan pemeriksaan hari itu juga agar berita acaranya sah.", 5],
      ["Menandatangani dengan catatan kecil bahwa pemeriksaan belum dilakukan.", 3],
      ["Meminta orang lain yang menandatangani.", 1],
    ],
    "Menolak sambil menawarkan jalan keluar yang sah menyelesaikan kebutuhan audit tanpa memalsukan dokumen."),
];

export const SJT_ITEM_BY_ID: Record<string, SjtItem> = Object.fromEntries(
  SJT_ITEMS.map((i) => [i.id, i]),
);

export const SJT_DIMENSION_LABELS: Record<SjtDimension, string> = {
  LEAD: "Kepemimpinan & Akuntabilitas",
  INTEG: "Integritas & Kepatuhan Etika",
  COLLAB: "Kolaborasi & Pengelolaan Relasi",
  PROBSOLV: "Pemecahan Masalah",
  ADAPT: "Adaptabilitas",
  SAFETY: "Kesadaran Keselamatan & Prosedur",
};

/** Memilih item SJT yang relevan untuk konteks industri perusahaan aktif.
 *  Item 'umum' selalu ikut; item spesifik industri hanya ikut bila cocok. */
export function selectSjtItems(context: "manufaktur" | "media" | "all"): SjtItem[] {
  if (context === "all") return SJT_ITEMS;
  return SJT_ITEMS.filter((i) => i.context === "umum" || i.context === context);
}
