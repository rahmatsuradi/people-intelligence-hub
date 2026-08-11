/* ═══════════════════════════════════════════════════════════════════════════
   INTERPRETASI — narasi per skala per rentang skor. Fungsi murni.

   ATURAN PENULISAN NARASI yang dipegang di seluruh file ini:

   1. DESKRIPTIF, BUKAN DIAGNOSTIK. Ini alat seleksi kerja, bukan alat klinis.
      Tidak ada kata "gangguan", "patologis", "tidak stabil secara mental", atau
      apa pun yang menyerempet diagnosis. Reaktivitas emosional tinggi ditulis
      sebagai kecenderungan kerja, bukan kondisi kesehatan jiwa.
   2. TIDAK ADA SIFAT YANG "BURUK". Setiap rentang punya konsekuensi kerja yang
      berbeda, dan konsekuensi itu tergantung posisi. Narasi menyebut keduanya:
      apa yang menjadi kekuatan dan apa yang perlu diwaspadai.
   3. SETIAP SKALA MENGHASILKAN PERTANYAAN WAWANCARA. Skor hanya hipotesis; yang
      memutuskan adalah bukti perilaku. Probe di bawah dirancang untuk menguji
      hipotesis itu, bukan mengonfirmasinya.
   4. HANYA TIGA RENTANG (rendah / rata-rata / tinggi). Membedakan narasi sten 7
      dan sten 8 memberi kesan presisi yang tidak dimiliki instrumen ini.
═══════════════════════════════════════════════════════════════════════════ */

import type { NormedScaleScore, ScaleInterpretation, ScaleId } from "./types";
import { scaleName } from "./scales";

type Band3 = "low" | "mid" | "high";

interface BandText {
  narrative: string;
  strengths: string[];
  watchouts: string[];
  probes: string[];
}

const bandOf = (sten: number): Band3 => (sten <= 4 ? "low" : sten <= 6 ? "mid" : "high");

/* ─── Big Five ─── */

const PERSONALITY_TEXT: Partial<Record<ScaleId, Record<Band3, BandText>>> = {
  C: {
    high: {
      narrative:
        "Cenderung terencana, teliti, dan menepati tenggat. Mengikuti prosedur meski tidak diawasi, dan terbiasa memeriksa ulang hasil kerjanya sendiri.",
      strengths: ["Konsisten pada tenggat dan standar mutu", "Dokumentasi dan pencatatan kerja rapi", "Dapat diandalkan tanpa pengawasan ketat"],
      watchouts: ["Bisa terlalu lama menyempurnakan hal yang sudah cukup baik", "Berpotensi kaku saat prioritas berubah mendadak"],
      probes: [
        "Ceritakan satu situasi ketika standar kerja Anda harus diturunkan karena keterbatasan waktu. Bagaimana Anda memutuskannya?",
        "Kapan terakhir Anda menyerahkan pekerjaan yang menurut Anda belum sempurna? Apa pertimbangannya?",
      ],
    },
    mid: {
      narrative:
        "Cukup teratur untuk pekerjaan dengan struktur yang jelas. Ketelitian dan kedisiplinan tenggatnya bergantung pada seberapa jelas ekspektasi yang diberikan.",
      strengths: ["Fleksibel antara mengikuti prosedur dan menyesuaikan keadaan", "Dapat bekerja baik bila target dan tenggat dinyatakan eksplisit"],
      watchouts: ["Kualitas bisa turun pada pekerjaan yang tidak terstruktur atau tanpa tenggat jelas"],
      probes: [
        "Bagaimana Anda mengatur beberapa pekerjaan dengan tenggat yang berdekatan? Beri contoh nyata.",
        "Ceritakan pekerjaan yang pernah terlewat tenggatnya. Apa yang berubah setelah itu?",
      ],
    },
    low: {
      narrative:
        "Cenderung bekerja secara spontan dan menyesuaikan di jalan. Bisa produktif pada pekerjaan yang menuntut kelincahan, tetapi berisiko pada pekerjaan yang bergantung pada ketelitian dan tenggat.",
      strengths: ["Tidak terhambat oleh prosedur saat situasi menuntut kecepatan", "Nyaman bekerja tanpa struktur yang kaku"],
      watchouts: ["Risiko keterlambatan dan kesalahan detail pada pekerjaan administratif", "Perlu sistem pengingat dan pengecekan dari luar dirinya"],
      probes: [
        "Sistem apa yang Anda pakai untuk memastikan tidak ada pekerjaan yang terlewat? Tunjukkan contoh konkretnya.",
        "Ceritakan kesalahan detail yang pernah berdampak ke pekerjaan orang lain. Bagaimana Anda menanganinya?",
      ],
    },
  },
  N: {
    high: {
      narrative:
        "Peka terhadap tekanan kerja dan cenderung memikirkan kembali masalah yang belum selesai. Kepekaan ini sering datang bersama kewaspadaan terhadap risiko, tetapi pemulihannya setelah kejadian sulit membutuhkan waktu lebih lama.",
      strengths: ["Waspada pada risiko dan konsekuensi yang belum terpikirkan", "Menanggapi serius umpan balik dan keluhan"],
      watchouts: ["Beban tinggi berkelanjutan dapat menurunkan performa lebih cepat", "Kritik langsung berpotensi mengganggu lebih lama dari yang terlihat"],
      probes: [
        "Ceritakan periode kerja paling menekan yang pernah Anda alami. Apa yang Anda lakukan untuk tetap berjalan?",
        "Bagaimana Anda biasanya menerima kritik dari atasan? Beri satu contoh nyata beserta tindak lanjutnya.",
      ],
    },
    mid: {
      narrative:
        "Reaksi terhadap tekanan berada pada kisaran umum. Dapat menghadapi situasi menekan sesekali, dengan pemulihan yang wajar.",
      strengths: ["Cukup peka untuk menanggapi masalah serius tanpa panik berlebihan"],
      watchouts: ["Tekanan tinggi yang berkepanjangan tetap perlu dikelola melalui beban kerja, bukan hanya ketahanan pribadi"],
      probes: ["Situasi kerja seperti apa yang paling menguras Anda? Bagaimana Anda mengelolanya?"],
    },
    low: {
      narrative:
        "Cenderung tenang di bawah tekanan dan pulih cepat setelah masalah. Tidak mudah terganggu oleh kritik maupun situasi mendadak.",
      strengths: ["Stabil pada situasi krisis dan tenggat ketat", "Tidak membawa persoalan kerja menjadi konflik pribadi"],
      watchouts: ["Bisa kurang menangkap urgensi yang dirasakan orang lain", "Berpotensi menganggap enteng risiko yang perlu diwaspadai"],
      probes: [
        "Ceritakan situasi ketika rekan Anda panik sementara Anda tidak. Bagaimana Anda menyikapinya?",
        "Kapan Anda menyadari bahwa Anda kurang cepat menanggapi suatu masalah?",
      ],
    },
  },
  E: {
    high: {
      narrative:
        "Mudah memulai kontak, nyaman berbicara di depan kelompok, dan mendapat energi dari interaksi. Cocok untuk peran yang menuntut kehadiran sosial berulang.",
      strengths: ["Cepat membangun jaringan dan hubungan kerja", "Nyaman menyampaikan pesan di depan banyak orang"],
      watchouts: ["Porsi mendengarkan bisa lebih kecil dari porsi berbicara", "Pekerjaan menyendiri yang panjang terasa melelahkan"],
      probes: [
        "Ceritakan situasi ketika Anda memutuskan untuk lebih banyak mendengarkan daripada berbicara. Apa hasilnya?",
        "Bagaimana Anda menangani pekerjaan yang harus dikerjakan sendirian berhari-hari?",
      ],
    },
    mid: {
      narrative:
        "Dapat menyesuaikan antara bekerja sendiri dan berinteraksi. Tidak menghindari forum, tetapi juga tidak mencarinya.",
      strengths: ["Fleksibel pada peran yang mencampur kerja mandiri dan kerja tim"],
      watchouts: ["Pada peran yang menuntut inisiatif kontak terus-menerus, perlu dorongan target yang jelas"],
      probes: ["Dalam rapat, kapan Anda memilih bicara dan kapan memilih diam? Beri contoh."],
    },
    low: {
      narrative:
        "Lebih nyaman bekerja mandiri dan dalam kelompok kecil. Butuh waktu untuk merasa nyaman di lingkungan baru, dan cenderung berbicara ketika merasa perlu saja.",
      strengths: ["Fokus panjang pada pekerjaan mandiri", "Cenderung berbicara setelah berpikir"],
      watchouts: ["Kontribusinya bisa kurang terlihat di forum besar", "Peran yang menuntut kontak dengan orang asing setiap hari akan menguras"],
      probes: [
        "Bagaimana Anda memastikan pendapat Anda tetap sampai ketika rapat didominasi orang lain?",
        "Ceritakan pengalaman Anda menghadapi orang yang baru dikenal dalam konteks kerja.",
      ],
    },
  },
  A: {
    high: {
      narrative:
        "Mengutamakan hubungan kerja yang harmonis, mempertimbangkan dampak pada orang lain, dan cenderung menghindari konfrontasi.",
      strengths: ["Mudah bekerja sama dan dipercaya rekan", "Meredam konflik sebelum membesar"],
      watchouts: ["Berpotensi sungkan menyampaikan penolakan atau kabar buruk", "Bisa menanggung beban kerja orang lain karena tidak enak menolak"],
      probes: [
        "Ceritakan saat Anda harus menyampaikan keputusan yang tidak disukai rekan kerja. Bagaimana Anda melakukannya?",
        "Kapan terakhir Anda menolak permintaan rekan kerja? Apa alasannya?",
      ],
    },
    mid: {
      narrative:
        "Kooperatif namun tetap sanggup mempertahankan posisi ketika diperlukan. Keseimbangan yang umumnya sesuai untuk sebagian besar peran.",
      strengths: ["Dapat bekerja sama tanpa kehilangan kemampuan bernegosiasi"],
      watchouts: ["Pada peran penegakan aturan, perlu dipastikan konsistensinya saat ditekan"],
      probes: ["Ceritakan perbedaan pendapat dengan rekan kerja yang berhasil Anda selesaikan."],
    },
    low: {
      narrative:
        "Cenderung langsung menyatakan pendapat dan tidak mudah terpengaruh tekanan sosial. Menilai berdasarkan isi persoalan lebih dulu dibanding hubungan.",
      strengths: ["Berani menyampaikan hal yang tidak populer", "Kuat dalam negosiasi dan penegakan standar"],
      watchouts: ["Cara penyampaian dapat dinilai keras oleh rekan kerja", "Perlu perhatian ekstra pada dampak relasional keputusan"],
      probes: [
        "Pernahkah cara Anda menyampaikan pendapat menimbulkan salah paham? Apa yang Anda lakukan setelahnya?",
        "Bagaimana Anda membangun kepercayaan dengan rekan yang berbeda pendapat dengan Anda?",
      ],
    },
  },
  O: {
    high: {
      narrative:
        "Tertarik pada gagasan dan cara kerja baru, nyaman dengan pekerjaan yang belum punya pola baku, dan aktif mencari tahu di luar bidangnya.",
      strengths: ["Cepat menyesuaikan diri dengan sistem atau metode baru", "Sumber usulan perbaikan proses"],
      watchouts: ["Bisa bosan pada pekerjaan yang sangat berulang", "Perlu dipastikan gagasannya diselesaikan sampai tuntas"],
      probes: [
        "Ceritakan perubahan cara kerja yang pernah Anda usulkan. Sejauh mana berhasil dijalankan?",
        "Bagaimana Anda bertahan pada pekerjaan rutin yang tidak berubah selama berbulan-bulan?",
      ],
    },
    mid: {
      narrative:
        "Terbuka pada hal baru bila alasannya jelas, sambil tetap menghargai cara kerja yang sudah terbukti.",
      strengths: ["Menerima perubahan tanpa menolak lebih dulu, dan tanpa mengejar perubahan tanpa alasan"],
      watchouts: ["Perlu penjelasan manfaat sebelum mengadopsi metode baru"],
      probes: ["Ceritakan pengalaman Anda menghadapi perubahan sistem kerja di tempat kerja sebelumnya."],
    },
    low: {
      narrative:
        "Lebih nyaman dengan cara kerja yang sudah mapan dan terbukti. Fokus pada penerapan yang benar dibanding eksplorasi cara baru.",
      strengths: ["Konsisten menjalankan standar yang sudah ditetapkan", "Tidak mudah terpengaruh tren yang belum terbukti"],
      watchouts: ["Perubahan sistem perlu didampingi dan dijelaskan manfaat praktisnya", "Kurang menjadi sumber usulan pembaruan"],
      probes: [
        "Bagaimana perasaan dan tindakan Anda ketika perusahaan mengganti sistem kerja yang sudah Anda kuasai?",
        "Kapan terakhir Anda belajar keterampilan baru di luar tuntutan pekerjaan?",
      ],
    },
  },
};

/* ─── Kognitif ─── */

const cognitiveText = (label: string, focus: string): Record<Band3, BandText> => ({
  high: {
    narrative: `Hasil ${label} berada di atas kelompok pembanding. Menunjukkan kemudahan dalam ${focus}, dan umumnya berkorelasi dengan kecepatan mempelajari pekerjaan baru.`,
    strengths: [`Cepat memahami pekerjaan dan materi baru`, `Nyaman pada tugas yang menuntut ${focus}`],
    watchouts: ["Bisa kurang sabar pada pekerjaan yang berulang dan sederhana"],
    probes: [`Berikan contoh pekerjaan yang menuntut ${focus} dan jelaskan bagaimana Anda menyelesaikannya.`],
  },
  mid: {
    narrative: `Hasil ${label} berada pada kisaran kelompok pembanding. Memadai untuk pekerjaan yang menuntut ${focus} pada tingkat wajar, dengan waktu belajar yang normal.`,
    strengths: [`Mampu menangani tugas ${focus} dengan tingkat kesulitan menengah`],
    watchouts: ["Tugas yang sangat kompleks membutuhkan waktu dan pendampingan lebih"],
    probes: [`Bagian mana dari pekerjaan yang menuntut ${focus} yang paling Anda rasa menantang?`],
  },
  low: {
    narrative: `Hasil ${label} berada di bawah kelompok pembanding. Perlu diperiksa apakah ini menggambarkan kemampuan atau dipengaruhi kondisi pengerjaan (waktu habis, gangguan, keterbatasan perangkat).`,
    strengths: [],
    watchouts: [
      `Tugas yang berat pada ${focus} berpotensi memerlukan waktu, pendampingan, atau alat bantu tambahan`,
      "Hasil satu tes tidak cukup untuk menyimpulkan kemampuan — periksa kelengkapan dan kondisi pengerjaan lebih dulu",
    ],
    probes: [
      `Bagaimana kondisi Anda saat mengerjakan tes ini (perangkat, tempat, waktu)?`,
      `Ceritakan pekerjaan yang menuntut ${focus} yang pernah Anda selesaikan dengan baik.`,
    ],
  },
});

const COGNITIVE_TEXT: Partial<Record<ScaleId, Record<Band3, BandText>>> = {
  COG_NUM: cognitiveText("penalaran numerik", "bekerja dengan angka, proporsi, dan data kuantitatif"),
  COG_VER: cognitiveText("penalaran verbal", "memahami teks dan menarik kesimpulan yang tepat"),
  COG_LOG: cognitiveText("penalaran logis", "mengenali pola dan menjaga konsistensi logika"),
  COG_TOTAL: cognitiveText("kemampuan kognitif umum", "memecahkan masalah baru dan mempelajari pekerjaan baru"),
};

/* ─── SJT ─── */

const sjtText = (label: string, hint: string): Record<Band3, BandText> => ({
  high: {
    narrative: `Pilihan tindakan pada skenario ${label.toLowerCase()} umumnya sejalan dengan praktik yang dianggap efektif: ${hint}`,
    strengths: [`Penilaian situasi ${label.toLowerCase()} sejalan dengan standar praktik`],
    watchouts: ["Pilihan pada tes menunjukkan pengetahuan tindakan yang tepat; belum tentu sama dengan perilaku di bawah tekanan nyata"],
    probes: [`Ceritakan situasi nyata terkait ${label.toLowerCase()} yang pernah Anda hadapi, dan apa yang benar-benar Anda lakukan saat itu.`],
  },
  mid: {
    narrative: `Pilihan tindakan pada skenario ${label.toLowerCase()} sebagian sejalan dengan praktik yang dianggap efektif, sebagian memilih jalan aman seperti menunggu instruksi atau menunda.`,
    strengths: ["Tidak memilih tindakan yang jelas merugikan"],
    watchouts: ["Kecenderungan menunggu arahan pada situasi yang sebenarnya menuntut inisiatif"],
    probes: [`Pada situasi ${label.toLowerCase()} yang belum ada aturannya, bagaimana Anda memutuskan? Beri contoh nyata.`],
  },
  low: {
    narrative: `Beberapa pilihan tindakan pada skenario ${label.toLowerCase()} menyimpang dari praktik yang dianggap efektif. Perlu dieksplorasi apakah ini soal pemahaman standar, pengalaman, atau perbedaan konteks tempat kerja sebelumnya.`,
    strengths: [],
    watchouts: [`Berpotensi memerlukan pembekalan eksplisit mengenai standar ${label.toLowerCase()} sebelum ditempatkan`],
    probes: [
      `Menurut Anda, apa yang seharusnya dilakukan pada situasi ${label.toLowerCase()} seperti ini? Jelaskan alasannya.`,
      "Aturan atau kebijakan apa yang berlaku di tempat kerja Anda sebelumnya terkait hal ini?",
    ],
  },
});

const SJT_TEXT: Partial<Record<ScaleId, Record<Band3, BandText>>> = {
  SJT_LEAD: sjtText("Kepemimpinan & Akuntabilitas", "menangani sebab masalah secara langsung tanpa mempermalukan orang."),
  SJT_INTEG: sjtText("Integritas & Kepatuhan Etika", "menolak sekaligus melaporkan, bukan sekadar menghindar."),
  SJT_COLLAB: sjtText("Kolaborasi", "menyelesaikan hambatan lewat kontak langsung sebelum mengeskalasi."),
  SJT_PROBSOLV: sjtText("Pemecahan Masalah", "mencari akar masalah dengan data sebelum mengambil tindakan besar."),
  SJT_ADAPT: sjtText("Adaptabilitas", "menyiapkan rencana cadangan sambil tetap memberi umpan balik."),
  SJT_SAFETY: sjtText("Kesadaran Keselamatan & Prosedur", "menghentikan praktik berisiko saat itu juga, lalu melaporkannya."),
};

const ALL_TEXT: Partial<Record<ScaleId, Record<Band3, BandText>>> = {
  ...PERSONALITY_TEXT,
  ...COGNITIVE_TEXT,
  ...SJT_TEXT,
};

/** Interpretasi satu skala. Mengembalikan null bila skala belum punya teks —
 *  lebih baik tidak muncul daripada muncul dengan narasi generik yang bisa
 *  dibaca sebagai kesimpulan. */
export function interpretScale(score: NormedScaleScore): ScaleInterpretation | null {
  const table = ALL_TEXT[score.scaleId];
  if (!table) return null;
  const text = table[bandOf(score.sten)];
  return {
    scaleId: score.scaleId,
    scaleName: scaleName(score.scaleId),
    sten: score.sten,
    band: score.band,
    narrative: text.narrative,
    strengths: text.strengths,
    watchouts: text.watchouts,
    interviewProbes: text.probes,
  };
}

export function interpretAll(scores: NormedScaleScore[]): ScaleInterpretation[] {
  // Dimensi SJT per-dimensi hanya 2 item; terlalu pendek untuk dinarasikan
  // sendiri-sendiri secara meyakinkan. Yang dinarasikan adalah totalnya, dan
  // dimensi per-dimensi tetap ditampilkan sebagai angka di tabel skor.
  const skip = new Set<ScaleId>(["SJT_LEAD", "SJT_INTEG", "SJT_COLLAB", "SJT_PROBSOLV", "SJT_ADAPT", "SJT_SAFETY"]);
  return scores
    .filter((s) => !skip.has(s.scaleId))
    .map(interpretScale)
    .filter((x): x is ScaleInterpretation => x !== null);
}

/** Narasi total SJT dibuat terpisah karena tidak ada di ALL_TEXT: totalnya
 *  merangkum enam dimensi, jadi teksnya menunjuk dimensi terlemah. */
export function interpretSjtTotal(scores: NormedScaleScore[]): ScaleInterpretation | null {
  const total = scores.find((s) => s.scaleId === "SJT_TOTAL");
  if (!total) return null;
  const dims = scores.filter((s) => s.scaleId.startsWith("SJT_") && s.scaleId !== "SJT_TOTAL");
  const weakest = [...dims].sort((a, b) => a.sten - b.sten)[0];
  const strongest = [...dims].sort((a, b) => b.sten - a.sten)[0];
  const band = bandOf(total.sten);

  const narrative =
    band === "high"
      ? "Secara keseluruhan, pilihan tindakan pada skenario kerja sejalan dengan praktik yang dianggap efektif."
      : band === "mid"
        ? "Secara keseluruhan, pilihan tindakan pada skenario kerja berada pada kisaran umum: sebagian tepat, sebagian memilih menunggu arahan."
        : "Secara keseluruhan, beberapa pilihan tindakan pada skenario kerja menyimpang dari praktik yang dianggap efektif.";

  return {
    scaleId: "SJT_TOTAL",
    scaleName: scaleName("SJT_TOTAL"),
    sten: total.sten,
    band: total.band,
    narrative:
      narrative +
      (strongest && weakest && strongest.scaleId !== weakest.scaleId
        ? ` Paling kuat pada ${scaleName(strongest.scaleId)} (sten ${strongest.sten}); paling perlu didalami pada ${scaleName(weakest.scaleId)} (sten ${weakest.sten}).`
        : ""),
    strengths: strongest ? [`${scaleName(strongest.scaleId)} — sten ${strongest.sten}`] : [],
    watchouts: weakest ? [`${scaleName(weakest.scaleId)} — sten ${weakest.sten}, dalami saat wawancara`] : [],
    interviewProbes: weakest
      ? [`Ceritakan situasi nyata terkait ${scaleName(weakest.scaleId).toLowerCase()} dan apa yang Anda lakukan saat itu.`]
      : [],
  };
}
