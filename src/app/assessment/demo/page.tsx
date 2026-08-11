"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Halaman DEMO — memperlihatkan isi modul asesmen tanpa perlu database.

   Ada tiga hal yang tidak bisa dinilai orang dari kode saja: seperti apa
   soalnya, bagaimana operasinya berjalan, dan seperti apa laporannya keluar.
   Halaman ini menjawab ketiganya.

   Laporan di tab ketiga BUKAN contoh yang ditulis tangan — dihitung langsung
   oleh engine yang sama dengan yang dipakai kandidat sungguhan (scoreAll →
   applyNorms → buildValidityReport → computeFit → interpretAll), dan
   ditampilkan dengan komponen yang sama. Kalau engine-nya berubah, demo ini
   ikut berubah. Demo yang bisa menyimpang dari produknya tidak ada gunanya.

   Kunci jawaban ditampilkan di tab Bank Soal karena halaman ini berada di balik
   login HR. Halaman peserta (/tes/<token>) tidak pernah menerimanya.
═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card, cn } from "@/components/app-shell";
import { AssessmentReportView } from "@/components/assessment-report-view";
import { BATTERY_FULL, batteryItemCount } from "@/lib/assessment/batteries";
import { PERSONALITY_SECTION_ITEMS, LIKERT5_LABELS, ATTENTION_CHECK_KEY } from "@/lib/assessment/items-personality";
import { COGNITIVE_ITEMS_BY_SUBTEST, SUBTEST_LABELS, SUBTEST_TIME_LIMIT_SEC } from "@/lib/assessment/items-cognitive";
import { SJT_ITEMS, SJT_DIMENSION_LABELS } from "@/lib/assessment/items-sjt";
import { NORM_DEMO_UMUM } from "@/lib/assessment/norms";
import { PROFILE_SUPERVISOR } from "@/lib/assessment/job-profiles";
import { buildAssessmentReport } from "@/lib/assessment/report";
import { SCALE_BY_ID } from "@/lib/assessment/scales";
import type { ResponseMap, SectionTiming } from "@/lib/assessment/types";

type Tab = "alur" | "soal" | "laporan";

const TABS: { id: Tab; label: string }[] = [
  { id: "alur", label: "Alur Administrasi" },
  { id: "soal", label: "Bank Soal" },
  { id: "laporan", label: "Contoh Laporan" },
];

export default function AssessmentDemoPage() {
  const [tab, setTab] = useState<Tab>("alur");

  return (
    <AppShell
      activeNavId="assessment"
      title="Demo Modul Asesmen"
      subtitle="Isi soal, cara kerja administrasinya, dan contoh laporan — tanpa perlu database"
      headerActions={<Link href="/assessment"><Button variant="secondary">Ke Konsol</Button></Link>}
    >
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
        <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
          Halaman ini berjalan sepenuhnya di browser dari bank soal dan engine di dalam kode — tidak menyentuh database
          sama sekali. Jadi bisa dipakai memeriksa isi modul sebelum skema SQL dipasang, dan sebagai bahan demo
          portofolio. <span className="font-medium">Kunci jawaban terlihat di sini</span> karena halaman ini di balik
          login HR; halaman peserta tidak pernah menerimanya.
        </p>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "alur" && <AlurTab />}
      {tab === "soal" && <SoalTab />}
      {tab === "laporan" && <LaporanTab />}
    </AppShell>
  );
}

/* ════════════════════ Tab 1 — Alur administrasi ════════════════════ */

const STEPS: { title: string; who: string; detail: string; where: string }[] = [
  {
    title: "Pilih kandidat & tentukan yang mau diukur",
    who: "HR",
    where: "/assessment → tombol Undang Kandidat",
    detail:
      "Kandidat ditarik dari pipeline Hire (nama, email, posisi terisi otomatis) atau diketik manual untuk pelamar di luar pipeline. Lalu pilih baterai tes dan profil jabatan target. Profil disarankan otomatis dari judul posisi — 'Supervisor Produksi' menyarankan profil penyeliaan — tapi HR tetap yang memutuskan, karena judul jabatan di lapangan sering tidak konsisten.",
  },
  {
    title: "Sistem membuat tautan tes",
    who: "Sistem",
    where: "otomatis saat sesi disimpan",
    detail:
      "Satu baris sesi dibuat berisi token acak 165-bit. Tautannya berbentuk /tes/<token> — tanpa nama, tanpa email, tanpa id kandidat di URL. Berlaku 14 hari. Tautan disalin ke clipboard; pengirimannya masih manual lewat WhatsApp/email karena modul email belum ada, dan tombol 'kirim' yang tidak benar-benar mengirim lebih buruk daripada tombol salin yang bekerja.",
  },
  {
    title: "Kandidat mengerjakan",
    who: "Kandidat",
    where: "/tes/<token> — publik, tanpa login",
    detail:
      "Satu bagian per layar. Bagian kognitif berbatas waktu dengan hitung mundur; kalau waktu habis, jawaban yang sudah diisi tetap terkirim, tidak dihanguskan. Jawaban tersimpan setiap kali satu bagian selesai, jadi koneksi yang putus di tengah jalan tidak menghapus pekerjaan sebelumnya. Kandidat tidak pernah melihat skor apa pun.",
  },
  {
    title: "Skor dihitung di server",
    who: "Sistem",
    where: "/api/assessment/session (service-role)",
    detail:
      "Begitu bagian terakhir dikirim: skor mentah dihitung, dibandingkan ke norma yang berlaku pada tanggal itu (sten/persentil/T/stanine), diperiksa kualitas pengisiannya, diinterpretasikan per skala, lalu dicocokkan ke profil jabatan. Hasilnya disimpan sebagai snapshot — norma atau soal yang diperbarui besok tidak mengubah laporan yang sudah terbit.",
  },
  {
    title: "HR membaca laporan & menindaklanjuti",
    who: "HR",
    where: "/assessment/<id sesi>",
    detail:
      "Laporan dibaca dari atas: kualitas jawaban dulu (boleh tidaknya angka dipercaya), baru skor kesesuaian, baru profil per skala. Setiap skala membawa pertanyaan probing untuk dipakai di wawancara. Kalau ada skala di bawah ambang kritis posisi, sistem memblokir rekomendasi dan menuliskan apa yang wajib diklarifikasi.",
  },
  {
    title: "Norma diperbarui setelah data terkumpul",
    who: "HR / teknis",
    where: "scripts/build-assessment-norms.ts",
    detail:
      "Setelah ≥100 peserta valid terkumpul, norma lokal dibangun dari data pelamar Anda sendiri dan dimasukkan sebagai baris baru — bukan menimpa yang lama, supaya laporan lama tetap bisa dihitung ulang dengan angka yang sama. Sesi berkualitas jawaban meragukan dibuang dari perhitungan norma.",
  },
];

function AlurTab() {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Enam langkah, dari undangan sampai keputusan</p>
        <div className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {s.who}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">{s.where}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Tiga baterai, dipakai di tahap berbeda</p>
        <div className="mt-3 space-y-2">
          {[
            { name: "Penyaringan Awal (Kognitif)", when: "Pelamar masih banyak", detail: "Tiga sub-tes kognitif berbatas waktu, ± 35 menit. Menyaring kasar dan cepat." },
            { name: "Baterai Lengkap", when: "Setelah wawancara awal", detail: "Kognitif + SJT + kepribadian, ± 75 menit. Tiga sumber bukti yang saling melengkapi." },
            { name: "Baterai Kepemimpinan", when: "Posisi supervisor ke atas", detail: "Menekankan penilaian situasional dan kepribadian, ± 60 menit — di posisi penyeliaan, cara mengambil keputusan lebih menentukan daripada kecepatan berhitung." },
          ].map((b) => (
            <div key={b.name} className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{b.name}</p>
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

/* ════════════════════ Tab 2 — Bank soal ════════════════════ */

function SoalTab() {
  const totalItems = batteryItemCount(BATTERY_FULL);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Total soal (baterai lengkap)" value={String(totalItems)} />
          <Metric label="Kepribadian" value={`${PERSONALITY_SECTION_ITEMS.length} pernyataan`} />
          <Metric label="Kognitif" value="30 soal" />
          <Metric label="SJT" value={`${SJT_ITEMS.length} skenario`} />
        </div>
      </Card>

      {/* Kognitif */}
      {(["NUM", "VER", "LOG"] as const).map((sub) => (
        <Card key={sub} padding={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{SUBTEST_LABELS[sub]}</p>
            <p className="text-xs text-slate-500">
              {COGNITIVE_ITEMS_BY_SUBTEST[sub].length} soal · batas waktu {SUBTEST_TIME_LIMIT_SEC[sub] / 60} menit
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
                <p className="mt-2 pl-6 text-xs italic text-slate-500 dark:text-slate-400">Kunci: {it.rationale}</p>
              </li>
            ))}
          </ol>
        </Card>
      ))}

      {/* SJT */}
      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Penilaian Situasi Kerja (SJT)</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Setiap opsi diberi nilai efektivitas 1–5 oleh kunci ahli. Skor peserta = nilai opsi yang ia pilih — memilih
            opsi lumayan tidak disamakan dengan memilih opsi terburuk.
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
                <span className="text-[10px] uppercase tracking-wide text-slate-400">konteks: {it.context}</span>
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
              <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">Dasar kunci: {it.rationale}</p>
            </li>
          ))}
        </ol>
      </Card>

      {/* Kepribadian */}
      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Inventori Kepribadian Kerja</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Adaptasi IPIP-BFM-50 (Goldberg 1999, domain publik). Skala Likert 1–5, tanpa batas waktu. Tanda{" "}
            <span className="font-semibold text-amber-600 dark:text-amber-400">R</span> = item dibalik saat diskor
            (reverse-keyed) untuk menahan kecenderungan menyetujui apa pun. Item berlabel QC tidak masuk skor sifat.
          </p>
        </div>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {PERSONALITY_SECTION_ITEMS.map((it, i) => (
            <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5">
              <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-slate-400">{i + 1}.</span>
              <p className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-200">{it.text}</p>
              {it.qc ? (
                <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  QC · {it.qc === "attention" ? `harus "${LIKERT5_LABELS[ATTENTION_CHECK_KEY[it.id] - 1]}"` : "impression mgmt"}
                </span>
              ) : (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {SCALE_BY_ID[it.scale]?.academicName.split(" ")[0] ?? it.scale}
                  {it.keying === -1 && <span className="ml-1 text-amber-600 dark:text-amber-400">R</span>}
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
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/* ════════════════════ Tab 3 — Contoh laporan ════════════════════ */

type PersonaId = "kuat" | "rata" | "asal" | "pencitraan";

const PERSONAS: { id: PersonaId; name: string; label: string; note: string }[] = [
  { id: "kuat", name: "Bagas Prakoso", label: "Kandidat kuat", note: "Mengerjakan sungguh-sungguh, kognitif tinggi, teliti, tenang di bawah tekanan." },
  { id: "rata", name: "Sari Wulandari", label: "Kandidat rata-rata", note: "Skor di kisaran umum — kasus yang paling sering ditemui, dan paling butuh wawancara." },
  { id: "asal", name: "Rudi Hartawan", label: "Mengisi asal-asalan", note: "Menjawab lurus ke bawah dengan cepat. Perhatikan bagaimana laporan menolak menyimpulkan." },
  { id: "pencitraan", name: "Dewi Anggraini", label: "Ingin terlihat sempurna", note: "Menyetujui pernyataan yang hampir mustahil benar. Skor TIDAK dikoreksi — hanya ditandai." },
];

/** Membangun jawaban tiruan per persona. Deterministik: tidak memakai
 *  Math.random, supaya laporan demo tidak berubah setiap kali halaman dibuka. */
function buildResponses(persona: PersonaId): { responses: ResponseMap; timings: SectionTiming[] } {
  const r: ResponseMap = {};

  // Nilai keyed yang dituju per domain (1-5). Nilai keyed = arah sifat, bukan
  // angka mentah yang diketik peserta; item reverse dibalik di bawah.
  const KEYED: Record<PersonaId, Record<string, number>> = {
    kuat: { O: 4, C: 5, E: 4, A: 4, N: 2 },
    rata: { O: 3, C: 3, E: 3, A: 4, N: 3 },
    asal: { O: 3, C: 3, E: 3, A: 3, N: 3 },
    pencitraan: { O: 4, C: 5, E: 5, A: 5, N: 1 },
  };

  for (const it of PERSONALITY_SECTION_ITEMS) {
    if (it.qc === "attention") {
      // Yang mengisi asal-asalan gagal attention check; yang lain lolos.
      r[it.id] = persona === "asal" ? 3 : ATTENTION_CHECK_KEY[it.id];
      continue;
    }
    if (it.qc === "desirability") {
      r[it.id] = persona === "pencitraan" ? 5 : persona === "asal" ? 3 : 2;
      continue;
    }
    if (persona === "asal") {
      r[it.id] = 3; // lurus ke bawah — inilah yang ditangkap indeks long-string
      continue;
    }
    const target = KEYED[persona][it.scale];
    r[it.id] = it.keying === 1 ? target : 6 - target;
  }

  // Kognitif: berapa soal pertama yang dijawab benar per sub-tes.
  const CORRECT: Record<PersonaId, number> = { kuat: 9, rata: 6, asal: 2, pencitraan: 7 };
  for (const sub of ["NUM", "VER", "LOG"] as const) {
    COGNITIVE_ITEMS_BY_SUBTEST[sub].forEach((it, i) => {
      r[it.id] = i < CORRECT[persona] ? it.answerIndex : (it.answerIndex + 1) % it.options.length;
    });
  }

  // SJT: peringkat opsi yang dipilih (0 = paling efektif).
  const RANK: Record<PersonaId, number> = { kuat: 0, rata: 1, asal: 3, pencitraan: 0 };
  for (const it of SJT_ITEMS) {
    const order = it.options
      .map((o, i) => ({ i, e: o.effectiveness }))
      .sort((a, b) => b.e - a.e);
    r[it.id] = order[Math.min(RANK[persona], order.length - 1)].i;
  }

  // Durasi pengerjaan — yang mengisi asal-asalan selesai jauh terlalu cepat.
  const personalitySec = persona === "asal" ? 55 : 700;
  const timings: SectionTiming[] = BATTERY_FULL.sections.map((s) => ({
    sectionId: s.id,
    startedAt: "2026-08-11T08:00:00.000Z",
    submittedAt: "2026-08-11T08:10:00.000Z",
    elapsedSec: s.id === "sec-personality" ? personalitySec : 480,
  }));

  return { responses: r, timings };
}

function LaporanTab() {
  const [persona, setPersona] = useState<PersonaId>("kuat");

  const report = useMemo(() => {
    const p = PERSONAS.find((x) => x.id === persona)!;
    const { responses, timings } = buildResponses(persona);
    return buildAssessmentReport({
      sessionId: `AS-DEMO-${persona.toUpperCase()}`,
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
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Pilih pola pengisian kandidat</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Semuanya dilamar untuk posisi yang sama (Supervisor Produksi, baterai lengkap), dengan norma dan profil
          jabatan yang sama. Yang berbeda hanya cara mereka mengisi.
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
