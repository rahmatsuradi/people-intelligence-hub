"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Panduan Asesmen — halaman rujukan untuk tim rekrutmen.

   Ditulis untuk pembaca yang TIDAK punya latar psikometrik: tanpa istilah
   teknis basis data, tanpa nama file, tanpa jalur API. Empat pertanyaan yang
   dijawab berurutan: bagaimana prosesnya berjalan, apa isi tesnya, atas dasar
   apa tes ini bisa dipercaya, dan seperti apa hasil akhirnya.

   Contoh laporan di tab terakhir dihitung oleh mesin penilaian yang sama dengan
   yang dipakai kandidat sungguhan, bukan contoh yang ditulis tangan — supaya
   halaman ini tidak bisa perlahan menyimpang dari produknya.
═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card, cn } from "@/components/app-shell";
import { AssessmentReportView } from "@/components/assessment-report-view";
import { BATTERY_FULL, batteryItemCount } from "@/lib/assessment/batteries";
import { PERSONALITY_SECTION_ITEMS, ATTENTION_CHECK_KEY, LIKERT5_LABELS } from "@/lib/assessment/items-personality";
import { COGNITIVE_ITEMS_BY_SUBTEST, SUBTEST_LABELS, SUBTEST_TIME_LIMIT_SEC } from "@/lib/assessment/items-cognitive";
import { SJT_ITEMS, SJT_DIMENSION_LABELS } from "@/lib/assessment/items-sjt";
import { NORM_DEMO_UMUM, MIN_LOCAL_NORM_N } from "@/lib/assessment/norms";
import { PROFILE_SUPERVISOR } from "@/lib/assessment/job-profiles";
import { buildAssessmentReport } from "@/lib/assessment/report";
import { SCALE_BY_ID } from "@/lib/assessment/scales";
import type { ResponseMap, SectionTiming } from "@/lib/assessment/types";

type Tab = "cara" | "isi" | "dasar" | "contoh";

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: "cara", label: "Cara Kerja", sub: "Alur dari undangan sampai keputusan" },
  { id: "isi", label: "Isi Tes", sub: "Apa yang diukur dan soalnya seperti apa" },
  { id: "dasar", label: "Dasar Ilmiah", sub: "Dari mana soal ini berasal dan seberapa terbukti" },
  { id: "contoh", label: "Contoh Hasil", sub: "Bentuk laporan yang Anda terima" },
];

export default function PanduanAsesmenPage() {
  const [tab, setTab] = useState<Tab>("cara");

  return (
    <AppShell
      activeNavId="assessment"
      title="Panduan Asesmen Psikologi"
      subtitle="Cara kerjanya, isi tesnya, dasar ilmiahnya, dan bentuk hasilnya"
      headerActions={<Link href="/assessment"><Button variant="secondary">Ke Konsol</Button></Link>}
    >
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-left transition-colors",
              tab === t.id
                ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <span className="block text-sm font-medium">{t.label}</span>
            <span className="hidden text-[11px] opacity-70 sm:block">{t.sub}</span>
          </button>
        ))}
      </div>

      {tab === "cara" && <CaraKerjaTab />}
      {tab === "isi" && <IsiTesTab />}
      {tab === "dasar" && <DasarIlmiahTab />}
      {tab === "contoh" && <ContohTab />}
    </AppShell>
  );
}

/* ════════════════════ Tab 1 — Cara kerja ════════════════════ */

const STEPS: { title: string; who: string; time: string; detail: string }[] = [
  {
    title: "Tentukan posisi dan apa yang perlu diukur",
    who: "Tim rekrutmen",
    time: "2 menit",
    detail:
      "Pilih kandidat dari daftar pelamar yang sudah ada, atau masukkan namanya secara manual. Tentukan rangkaian tes yang dipakai dan profil jabatan yang menjadi patokan penilaian. Profil jabatan disarankan otomatis dari nama posisinya — misalnya \"Supervisor Produksi\" akan menyarankan profil penyeliaan — dan Anda tetap bisa menggantinya.",
  },
  {
    title: "Sistem menyiapkan tautan tes pribadi",
    who: "Otomatis",
    time: "seketika",
    detail:
      "Setiap kandidat mendapat satu tautan yang hanya berlaku untuk dirinya dan aktif selama 14 hari. Tautan itu tidak memuat nama maupun identitas apa pun, sehingga aman meski tidak sengaja diteruskan. Tautan disalin ke papan klip, lalu Anda kirimkan lewat WhatsApp atau email.",
  },
  {
    title: "Kandidat mengerjakan dari perangkatnya sendiri",
    who: "Kandidat",
    time: "35–75 menit",
    detail:
      "Kandidat tidak perlu mendaftar atau membuat akun. Tes disajikan satu bagian per layar. Bagian kemampuan berpikir memiliki batas waktu dan hitung mundur; jika waktu habis, jawaban yang sudah diisi tetap tersimpan dan tidak hangus. Setiap kali satu bagian selesai, jawabannya langsung tersimpan — jika koneksi terputus, kandidat cukup membuka tautan yang sama dan melanjutkan dari bagian berikutnya.",
  },
  {
    title: "Penilaian dan penafsiran berjalan otomatis",
    who: "Otomatis",
    time: "seketika",
    detail:
      "Begitu bagian terakhir dikirim, jawaban dinilai, dibandingkan dengan kelompok pembanding, diperiksa kesungguhan pengisiannya, lalu dicocokkan dengan tuntutan posisi yang dilamar. Hasil itu dikunci sebagai arsip — kalau soal atau kelompok pembanding diperbarui di kemudian hari, laporan yang sudah terbit tidak ikut berubah.",
  },
  {
    title: "Anda membaca laporan dan menindaklanjuti",
    who: "Tim rekrutmen",
    time: "5–10 menit",
    detail:
      "Laporan dibaca dari atas ke bawah: kesungguhan pengisian lebih dulu (menentukan boleh atau tidaknya angka di bawahnya dipercaya), lalu kecocokan dengan posisi, lalu profil per aspek. Setiap aspek dilengkapi pertanyaan siap pakai untuk wawancara. Bila ada aspek yang jatuh di bawah batas wajib posisi tersebut, sistem menahan rekomendasi dan menuliskan apa yang harus diklarifikasi lebih dulu.",
  },
  {
    title: "Kelompok pembanding diperbarui seiring data bertambah",
    who: "Berkala",
    time: "setelah ±100 peserta",
    detail:
      "Semakin banyak pelamar yang mengerjakan, semakin akurat perbandingannya. Setelah terkumpul cukup peserta, kelompok pembanding dibangun ulang dari data pelamar perusahaan Anda sendiri. Pembanding lama tetap disimpan agar laporan-laporan terdahulu masih bisa ditelusuri dengan angka yang sama.",
  },
];

function CaraKerjaTab() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Enam langkah, dari undangan sampai keputusan</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Total keterlibatan tim rekrutmen sekitar 10 menit per kandidat. Sisanya berjalan sendiri.
        </p>
        <div className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {s.who}
                  </span>
                  <span className="text-[11px] text-slate-400">± {s.time}</span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Siapa melihat apa</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Pemisahan ini bukan sekadar pengaturan tampilan — kandidat memang tidak pernah menerima datanya.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Kandidat melihat</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              <li>Pertanyaan dan pilihan jawaban</li>
              <li>Sisa waktu pada bagian yang berbatas waktu</li>
              <li>Konfirmasi bahwa jawabannya sudah diterima</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Kandidat tidak pernah melihat</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              <li>Kunci jawaban maupun nilai tiap pilihan</li>
              <li>Skor, peringkat, atau kecocokan dengan posisi</li>
              <li>Aspek apa yang sedang diukur oleh tiap pernyataan</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          Kandidat berhak meminta umpan balik atas hasil asesmennya. Sampaikan lewat percakapan, bukan dengan mengirim
          laporan mentah — angka tanpa penjelasan mudah disalahartikan, dan itu tanggung jawab pemberi tes.
        </p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Tiga pilihan rangkaian tes</p>
        <p className="mt-0.5 text-xs text-slate-500">Dipilih sesuai tahap seleksi dan jumlah pelamar yang harus ditangani.</p>
        <div className="mt-3 space-y-2">
          {[
            { name: "Penyaringan Awal", dur: "± 35 menit", when: "Pelamar masih banyak", detail: "Hanya bagian kemampuan berpikir. Untuk mempersempit daftar panjang dengan cepat sebelum wawancara." },
            { name: "Rangkaian Lengkap", dur: "± 75 menit", when: "Setelah wawancara awal", detail: "Kemampuan berpikir, cara bekerja, dan penilaian situasi kerja. Memberi gambaran paling utuh." },
            { name: "Rangkaian Kepemimpinan", dur: "± 60 menit", when: "Posisi supervisor ke atas", detail: "Menitikberatkan penilaian situasi dan cara bekerja — pada posisi penyeliaan, cara mengambil keputusan lebih menentukan daripada kecepatan berhitung." },
          ].map((b) => (
            <div key={b.name} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{b.name} <span className="font-normal text-slate-400">· {b.dur}</span></p>
                <span className="text-xs text-slate-500">{b.when}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{b.detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════ Tab 2 — Isi tes ════════════════════ */

const PARTS = [
  {
    title: "Kemampuan Berpikir",
    subtitle: "30 soal · 3 bagian · berbatas waktu",
    measures: "Seberapa cepat seseorang memahami hal baru, bekerja dengan angka, menangkap maksud bacaan, dan menjaga logika tetap runtut.",
    why: "Paling menentukan pada pekerjaan yang situasinya sering berubah atau yang materinya harus dipelajari dari nol.",
    scored: "Satu jawaban benar bernilai satu poin. Soal yang dilewati dihitung tidak benar — supaya kandidat yang berani menebak tidak dirugikan dibanding yang melewati soal sulit.",
  },
  {
    title: "Cara Bekerja (Kepribadian Kerja)",
    subtitle: "56 pernyataan · tanpa batas waktu",
    measures: "Kecenderungan cara seseorang bekerja: ketelitian dan kedisiplinan, ketenangan menghadapi tekanan, keterbukaan pada hal baru, cara berinteraksi, dan kecenderungan bekerja sama.",
    why: "Menjelaskan bagaimana seseorang bekerja, bukan seberapa mampu. Dua kandidat dengan kemampuan setara bisa sangat berbeda hasilnya tergantung kecocokan cara kerja dengan tuntutan posisi.",
    scored: "Tidak ada jawaban benar atau salah. Sebagian pernyataan sengaja dibalik arahnya, dan beberapa pernyataan lain dipakai memeriksa apakah tes dibaca dengan sungguh-sungguh.",
  },
  {
    title: "Penilaian Situasi Kerja",
    subtitle: "12 skenario · berbatas waktu",
    measures: "Apa yang akan dilakukan seseorang pada situasi kerja nyata: menegur bawahan yang terlambat, menolak barang cacat saat ditekan target, menghadapi narasumber yang batal mendadak.",
    why: "Paling dekat dengan pekerjaan sehari-hari, dan menangkap hal yang tidak tertangkap dua bagian lain — yaitu pertimbangan praktis dalam situasi berisiko.",
    scored: "Setiap pilihan diberi nilai keefektifan 1 sampai 5. Memilih tindakan yang lumayan tidak disamakan dengan memilih tindakan terburuk.",
  },
];

function IsiTesTab() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Tiga hal yang diukur, dan alasannya</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Ketiganya dipakai bersama karena masing-masing menjawab pertanyaan yang berbeda. Satu bagian saja tidak cukup.
        </p>
        <div className="mt-4 space-y-3">
          {PARTS.map((p) => (
            <div key={p.title} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
                <span className="text-xs text-slate-400">{p.subtitle}</span>
              </div>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div><dt className="inline font-medium text-slate-700 dark:text-slate-300">Yang diukur: </dt><dd className="inline text-slate-600 dark:text-slate-400">{p.measures}</dd></div>
                <div><dt className="inline font-medium text-slate-700 dark:text-slate-300">Kenapa penting: </dt><dd className="inline text-slate-600 dark:text-slate-400">{p.why}</dd></div>
                <div><dt className="inline font-medium text-slate-700 dark:text-slate-300">Cara dinilai: </dt><dd className="inline text-slate-600 dark:text-slate-400">{p.scored}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Seluruh soal ditampilkan di bawah ini</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Beserta kunci jawaban dan alasan di balik tiap kunci, supaya isi tes dapat ditelaah dan diperdebatkan — bukan
          diterima begitu saja. Halaman ini hanya untuk tim rekrutmen; kandidat tidak pernah menerima kunci jawaban
          maupun keterangan aspek yang sedang diukur. Bila ada soal yang menurut Anda tidak pas dengan konteks
          perusahaan, soal itu memang dimaksudkan untuk diganti.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <Metric label="Total soal" value={String(batteryItemCount(BATTERY_FULL))} />
          <Metric label="Kemampuan berpikir" value="30 soal" />
          <Metric label="Cara bekerja" value={`${PERSONALITY_SECTION_ITEMS.length} pernyataan`} />
          <Metric label="Situasi kerja" value={`${SJT_ITEMS.length} skenario`} />
        </div>
      </Card>

      {(["NUM", "VER", "LOG"] as const).map((sub) => (
        <Card key={sub} padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{SUBTEST_LABELS[sub]}</p>
            <p className="text-xs text-slate-500">
              {COGNITIVE_ITEMS_BY_SUBTEST[sub].length} soal · {SUBTEST_TIME_LIMIT_SEC[sub] / 60} menit
            </p>
          </div>
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {COGNITIVE_ITEMS_BY_SUBTEST[sub].map((it, i) => (
              <li key={it.id} className="px-5 py-4">
                <div className="flex gap-2">
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-400">{i + 1}.</span>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-900 dark:text-slate-100">{it.text}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {it.options.map((o, oi) => (
                    <span
                      key={oi}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        oi === it.answerIndex
                          ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400",
                      )}
                    >
                      {o}
                      {oi === it.answerIndex && " ✓"}
                    </span>
                  ))}
                </div>
                <p className="mt-2 pl-6 text-xs italic text-slate-500 dark:text-slate-400">{it.rationale}</p>
              </li>
            ))}
          </ol>
        </Card>
      ))}

      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Penilaian Situasi Kerja</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Angka di depan tiap pilihan adalah nilai keefektifannya: 5 paling efektif, 1 paling merugikan.
          </p>
        </div>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {SJT_ITEMS.map((it, i) => (
            <li key={it.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-slate-400">{i + 1}.</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {SJT_DIMENSION_LABELS[it.dimension]}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100">{it.scenario}</p>
              <div className="mt-2 space-y-1.5">
                {it.options.map((o, oi) => (
                  <div key={oi} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold",
                        o.effectiveness >= 4
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : o.effectiveness === 3
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
                      )}
                    >
                      {o.effectiveness}
                    </span>
                    <p className="text-sm leading-snug text-slate-700 dark:text-slate-300">{o.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{it.rationale}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Cara Bekerja (Kepribadian Kerja)</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Dijawab pada skala <span className="italic">{LIKERT5_LABELS[0].toLowerCase()}</span> sampai{" "}
            <span className="italic">{LIKERT5_LABELS[4].toLowerCase()}</span>. Tanda{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">dibalik</span> berarti pernyataan itu
            dinilai terbalik — menyetujuinya menurunkan, bukan menaikkan, aspek yang bersangkutan. Pernyataan bertanda{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">pemeriksa</span> tidak ikut dinilai; fungsinya
            memeriksa kesungguhan pengisian.
          </p>
        </div>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {PERSONALITY_SECTION_ITEMS.map((it, i) => (
            <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
              <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{i + 1}.</span>
              <p className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-200">{it.text}</p>
              {it.qc ? (
                <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  pemeriksa{it.qc === "attention" ? ` · jawaban benar "${LIKERT5_LABELS[ATTENTION_CHECK_KEY[it.id] - 1]}"` : " · kejujuran"}
                </span>
              ) : (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {SCALE_BY_ID[it.scale]?.name}
                  {it.keying === -1 && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· dibalik</span>}
                </span>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/* ════════════════════ Tab 3 — Dasar ilmiah ════════════════════ */

const SOURCES = [
  {
    part: "Cara Bekerja (Kepribadian Kerja)",
    origin: "IPIP-BFM-50 — International Personality Item Pool, Goldberg (1999)",
    status: "diadaptasi ke Bahasa Indonesia untuk sistem ini",
    body:
      "Kumpulan pernyataan milik umum (domain publik) yang boleh dipakai siapa pun tanpa lisensi, dan sudah dipakai di ribuan penelitian selama lebih dari dua dekade. Kerangka yang diukurnya — Lima Faktor Besar / Big Five — adalah kerangka kepribadian yang paling banyak diuji di dunia kerja, dan menjadi tulang punggung alat ukur komersial besar seperti Hogan dan SHL OPQ.",
    honest:
      "Terjemahan ke Bahasa Indonesia di sini belum melalui uji ulang bahasa maupun uji keajekan pada sampel Indonesia. Kerangkanya kuat, versi bahasanya belum diuji.",
  },
  {
    part: "Kemampuan Berpikir",
    origin: "Ditulis sendiri untuk sistem ini",
    status: "belum melalui analisis butir",
    body:
      "Tidak ada satu pun soal yang disalin dari CFIT, IST, Raven's, TIU/TKD, Watson-Glaser, atau bank soal berlisensi lainnya. Menyalin soal berlisensi bukan hanya pelanggaran hak cipta — soal yang bocor juga kehilangan daya bedanya, sehingga tesnya berhenti mengukur apa pun. Jenis soalnya mengikuti bentuk yang lazim dan sudah lama terbukti: penalaran angka, penalaran bacaan, dan pengenalan pola.",
    honest:
      "Karena ditulis sendiri, soal-soal ini belum diperiksa tingkat kesukaran dan daya bedanya pada peserta nyata. Soal yang terlalu mudah, terlalu sulit, atau tidak membedakan siapa pun perlu diganti setelah ada data.",
  },
  {
    part: "Penilaian Situasi Kerja",
    origin: "Skenario dan kunci ditulis sendiri",
    status: "kunci berdasarkan penalaran praktik, belum divalidasi ke data kinerja",
    body:
      "Skenario disusun dari situasi yang benar-benar terjadi di lantai produksi, ruang redaksi, dan pekerjaan administrasi, mengacu pada praktik hubungan industrial dan keselamatan kerja di Indonesia. Kunci keefektifannya disusun dari prinsip praktik, bukan dari perbandingan dengan kinerja nyata pemegang jabatan.",
    honest:
      "Kunci semacam ini disebut kunci rasional. Kunci yang lebih kuat dibangun dari data: membandingkan pilihan karyawan berkinerja tinggi dengan yang berkinerja rendah. Itu belum dikerjakan di sini.",
  },
];

const EVIDENCE = [
  { method: "Wawancara terstruktur", old: ".51", now: ".42", note: "Prediktor tunggal terkuat menurut revisi 2022 — melampaui tes kemampuan berpikir." },
  { method: "Kemampuan berpikir umum", old: ".51", now: ".31", note: "Turun cukup jauh setelah koreksi statistik diperbaiki, namun tetap salah satu yang terkuat." },
  { method: "Penilaian situasi kerja (SJT)", old: "—", now: ".34", note: "Dari meta-analisis McDaniel dkk. (2001) atas 102 koefisien, 10.640 peserta." },
  { method: "Ketelitian & kedisiplinan", old: ".31", now: "±.20", note: "Satu-satunya aspek kepribadian yang memprediksi kinerja di hampir semua jenis pekerjaan." },
];

function DasarIlmiahTab() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Dari mana soal-soal ini berasal</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Satu-satunya cara menilai kredibilitas sebuah tes adalah mengetahui asal-usul soalnya dan apa yang sudah
          maupun belum diuji. Keduanya ditulis apa adanya di bawah ini.
        </p>
        <div className="mt-4 space-y-3">
          {SOURCES.map((s) => (
            <div key={s.part} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.part}</p>
              <p className="mt-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">{s.origin}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.body}</p>
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Yang belum diuji
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-amber-900 dark:text-amber-100">{s.honest}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Seberapa terbukti metode seperti ini memprediksi kinerja
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Angka di bawah adalah koefisien korelasi dengan kinerja kerja dari dua meta-analisis besar — penelitian yang
          merangkum ratusan studi sekaligus. Nilai 0 berarti tidak memprediksi sama sekali, 1 berarti memprediksi
          sempurna. Dalam seleksi karyawan, angka .30 sudah tergolong berguna dan .40 tergolong tinggi; tidak ada satu
          pun metode seleksi yang mendekati .60.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2 pr-3 font-medium">Metode</th>
                <th className="py-2 pr-3 font-medium">Schmidt &amp; Hunter 1998</th>
                <th className="py-2 pr-3 font-medium">Estimasi terbaru</th>
                <th className="py-2 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {EVIDENCE.map((e) => (
                <tr key={e.method}>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{e.method}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-500">{e.old}</td>
                  <td className="py-2 pr-3 font-semibold tabular-nums text-slate-900 dark:text-white">{e.now}</td>
                  <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            Angka di atas milik JENIS metodenya, bukan milik tes ini
          </p>
          <p className="mt-1 text-sm leading-relaxed text-red-800 dark:text-red-200">
            Bahwa tes kemampuan berpikir sebagai satu kelompok metode memprediksi kinerja pada .31 tidak berarti
            30 soal di halaman ini juga demikian. Untuk mengetahuinya, skor kandidat harus dibandingkan dengan
            kinerja mereka setelah bekerja — dan itu baru bisa dilakukan setelah cukup banyak orang direkrut lewat
            tes ini. Tabel di atas menjelaskan mengapa <em>pendekatannya</em> dipilih, bukan membuktikan mutu soalnya.
          </p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Sumber: Schmidt, F. L. &amp; Hunter, J. E. (1998), <em>Psychological Bulletin</em> 124(2), 262–274 ·
          Sackett, P. R., Zhang, C., Berry, C. M. &amp; Lievens, F. (2022), <em>Journal of Applied Psychology</em>{" "}
          107(11), 2040–2068 · McDaniel, M. A., Morgeson, F. P., Finnegan, E. B., Campion, M. A. &amp; Braverman, E. P.
          (2001), <em>Journal of Applied Psychology</em> 86(4), 730–740 · Barrick, M. R. &amp; Mount, M. K. (1991),{" "}
          <em>Personnel Psychology</em> 44(1), 1–26 · Goldberg, L. R. (1999), International Personality Item Pool.
        </p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Aturan main yang diikuti</p>
        <div className="mt-3 space-y-2">
          {[
            { t: "Tes bukan penentu tunggal", d: "Hasil asesmen digabung dengan CV, wawancara terstruktur, dan uji kerja. Tidak ada kandidat yang ditolak hanya karena skor tes." },
            { t: "Hanya instrumen yang boleh dipakai", d: "Alat ukur berlisensi tidak direproduksi tanpa izin. Yang dipakai adalah instrumen milik umum dan soal yang ditulis sendiri." },
            { t: "Setiap syarat posisi harus punya alasan tertulis", d: "Sistem menolak menyimpan profil jabatan yang tidak menyertakan alasan mengapa suatu aspek dinilai — supaya keputusan seleksi bisa ditelusuri bila dipertanyakan." },
            { t: "Kesungguhan pengisian ditandai, bukan dihukum", d: "Bila ada indikasi tes tidak dikerjakan sungguh-sungguh, sistem memberi peringatan dan meminta verifikasi. Skornya tidak pernah dipotong diam-diam." },
            { t: "Data kandidat adalah data pribadi", d: "Diperlakukan sesuai UU Perlindungan Data Pribadi No. 27 Tahun 2022. Akses dibatasi pada yang berkepentingan, dan kandidat berhak memperoleh umpan balik." },
            { t: "Hasil punya masa berlaku", d: "Gambaran seseorang bisa berubah. Hasil asesmen wajar dipakai ulang paling lama 12 bulan." },
          ].map((r) => (
            <div key={r.t} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{r.t}</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{r.d}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Peta jalan menuju tes yang benar-benar tervalidasi</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Urutan ini tidak bisa dilompati — setiap langkah butuh data yang dihasilkan langkah sebelumnya.
        </p>
        <ol className="mt-3 space-y-2">
          {[
            { n: "Sekarang", t: "Pembanding sementara", d: `Skor dibandingkan dengan kelompok pembanding buatan. Sah untuk mengurutkan kandidat dalam satu lowongan, belum sah sebagai batas kelulusan.`, done: true },
            { n: `± ${MIN_LOCAL_NORM_N} peserta`, t: "Pembanding dari pelamar sendiri", d: "Kelompok pembanding dibangun ulang dari data pelamar perusahaan. Mulai dari sini persentil punya arti nyata.", done: false },
            { n: "± 200 peserta", t: "Pembenahan soal", d: "Soal diperiksa satu per satu: mana yang terlalu mudah, terlalu sulit, atau tidak membedakan. Yang lemah diganti.", done: false },
            { n: "Setelah ada data kinerja", t: "Pembuktian daya prediksi", d: "Skor kandidat yang diterima dibandingkan dengan penilaian kinerja mereka. Di titik ini profil jabatan berhenti menjadi perkiraan dan menjadi temuan.", done: false },
          ].map((s) => (
            <li key={s.t} className={cn(
              "rounded-lg border px-4 py-3",
              s.done ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10" : "border-slate-200 dark:border-slate-800",
            )}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                  {s.n}
                </span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{s.t}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.d}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ════════════════════ Tab 4 — Contoh hasil ════════════════════ */

type PersonaId = "kuat" | "rata" | "asal" | "pencitraan";

const PERSONAS: { id: PersonaId; name: string; label: string; note: string }[] = [
  { id: "kuat", name: "Bagas Prakoso", label: "Mengerjakan sungguh-sungguh", note: "Hasil kuat di ketiga bagian. Perhatikan bahwa laporan tetap memberi pertanyaan pendalaman, bukan sekadar meloloskan." },
  { id: "rata", name: "Sari Wulandari", label: "Hasil rata-rata", note: "Kasus yang paling sering ditemui — dan yang paling menentukan pentingnya wawancara, karena angkanya sendiri tidak memutuskan apa pun." },
  { id: "asal", name: "Rudi Hartawan", label: "Mengisi asal-asalan", note: "Menjawab lurus ke bawah dengan sangat cepat. Perhatikan bagaimana laporan menolak menyimpulkan dan meminta tes ulang." },
  { id: "pencitraan", name: "Dewi Anggraini", label: "Ingin terlihat sempurna", note: "Menyetujui pernyataan yang hampir mustahil benar bagi siapa pun. Skornya tidak dipotong — hanya ditandai untuk diverifikasi saat wawancara." },
];

function buildResponses(persona: PersonaId): { responses: ResponseMap; timings: SectionTiming[] } {
  const r: ResponseMap = {};
  const KEYED: Record<PersonaId, Record<string, number>> = {
    kuat: { O: 4, C: 5, E: 4, A: 4, N: 2 },
    rata: { O: 3, C: 3, E: 3, A: 4, N: 3 },
    asal: { O: 3, C: 3, E: 3, A: 3, N: 3 },
    pencitraan: { O: 4, C: 5, E: 5, A: 5, N: 1 },
  };

  for (const it of PERSONALITY_SECTION_ITEMS) {
    if (it.qc === "attention") { r[it.id] = persona === "asal" ? 3 : ATTENTION_CHECK_KEY[it.id]; continue; }
    if (it.qc === "desirability") { r[it.id] = persona === "pencitraan" ? 5 : persona === "asal" ? 3 : 2; continue; }
    if (persona === "asal") { r[it.id] = 3; continue; }
    const target = KEYED[persona][it.scale];
    r[it.id] = it.keying === 1 ? target : 6 - target;
  }

  const CORRECT: Record<PersonaId, number> = { kuat: 9, rata: 6, asal: 2, pencitraan: 7 };
  for (const sub of ["NUM", "VER", "LOG"] as const) {
    COGNITIVE_ITEMS_BY_SUBTEST[sub].forEach((it, i) => {
      r[it.id] = i < CORRECT[persona] ? it.answerIndex : (it.answerIndex + 1) % it.options.length;
    });
  }

  const RANK: Record<PersonaId, number> = { kuat: 0, rata: 1, asal: 3, pencitraan: 0 };
  for (const it of SJT_ITEMS) {
    const order = it.options.map((o, i) => ({ i, e: o.effectiveness })).sort((a, b) => b.e - a.e);
    r[it.id] = order[Math.min(RANK[persona], order.length - 1)].i;
  }

  const personalitySec = persona === "asal" ? 55 : 700;
  const timings: SectionTiming[] = BATTERY_FULL.sections.map((s) => ({
    sectionId: s.id,
    startedAt: "2026-08-11T08:00:00.000Z",
    submittedAt: "2026-08-11T08:10:00.000Z",
    elapsedSec: s.id === "sec-personality" ? personalitySec : 480,
  }));

  return { responses: r, timings };
}

function ContohTab() {
  const [persona, setPersona] = useState<PersonaId>("kuat");

  const report = useMemo(() => {
    const p = PERSONAS.find((x) => x.id === persona)!;
    const { responses, timings } = buildResponses(persona);
    return buildAssessmentReport({
      sessionId: `CONTOH-${persona.toUpperCase()}`,
      candidateName: p.name,
      position: "Supervisor Produksi",
      batteryId: BATTERY_FULL.id,
      completedAt: "2026-08-11T08:40:00.000Z",
      responses,
      presentedItemIds: BATTERY_FULL.sections.flatMap((s) => s.itemIds),
      timings,
      normGroup: NORM_DEMO_UMUM,
      profile: PROFILE_SUPERVISOR,
    });
  }, [persona]);

  const active = PERSONAS.find((x) => x.id === persona)!;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Cara membaca angkanya</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Sten (1–10)</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Posisi seseorang dibanding kelompok pembanding. <span className="font-medium">5–6 berarti rata-rata</span>,
              7 ke atas di atas rata-rata, 4 ke bawah di bawah rata-rata.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Persentil</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Persentil 86 berarti hasilnya lebih tinggi daripada 86 dari 100 orang pembanding. Bukan nilai ujian, bukan
              persentase jawaban benar.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Kecocokan (0–100)</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Seberapa dekat profil kandidat dengan tuntutan posisi yang dilamar. Kandidat yang sama bisa mendapat angka
              berbeda untuk posisi yang berbeda.
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          Satu aspek dengan skor tinggi tidak selalu kabar baik. Contohnya <span className="font-medium">Reaktivitas
          Emosional</span>: makin tinggi angkanya, makin peka seseorang terhadap tekanan — dan untuk posisi penyeliaan
          itu justru catatan, bukan keunggulan. Karena itu laporan selalu membandingkan skor dengan rentang yang
          dibutuhkan posisi, bukan sekadar menampilkan tinggi-rendahnya.
        </p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Empat pola pengisian yang sering ditemui</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Keempatnya melamar posisi yang sama dengan patokan yang sama. Yang membedakan hanya cara mereka mengisi tes.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersona(p.id)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                persona === p.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
              )}
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.label}</p>
              <p className="text-xs text-slate-500">{p.name}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          {active.note}
        </p>
      </Card>

      <AssessmentReportView report={report} />
    </div>
  );
}
