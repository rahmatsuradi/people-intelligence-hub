"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Mode Presentasi Pulse Check — satu langkah per layar, dari lapangan ke atas:
     Pembuka → SPG menilai SPV → SPV menilai Koordinator SPV → Keputusan.
   Semua angka dan grafik memakai fungsi & komponen yang sama dengan dashboard, jadi tidak mungkin
   berbeda. Judul tiap layar = kesimpulan yang dihitung dari data (pulse-present.ts), bukan tulisan tetap.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, inputClass } from "@/components/app-shell";
import {
  ACTION_STATUS_LABEL, periodLabel, spvScorecard, build360,
  type Campaign, type PeriodSummary, type SegmentPeriod, type Survey, type SurveyAction, type SurveyResponse, type ThemePeriod,
} from "@/lib/rr/pulse";
import { leaderView, maskNames, spvHighlights, MOVE_EPS } from "@/lib/rr/pulse-present";
import { headlineKpis, themeMatrix, topThemes } from "@/lib/rr/pulse-viz";
import { KpiRow } from "./dash-common";
import { CoverageCard, FOLLOWED_LEVELS, LikertCard, PRIOR_LEVELS, ThemeCard, TrendCard } from "./dashboards";
import { SPV_SCALES, cell, pct } from "./spv-report";
import { ChartCard, Legend, VizStyle, fmtNum } from "./viz/base";
import { DotPlot, type DotRow } from "./viz/dot-plot";

const LEADER_KEYS = ["leader_direction", "leader_problem", "leader_mentoring", "leader_openness", "leader_fairness"];

export interface DeckData {
  spg: { survey: Survey; summary: PeriodSummary[]; segments: SegmentPeriod[]; themes: ThemePeriod[]; actions: SurveyAction[]; roster: Record<string, number>; campaigns: Campaign[] } | null;
  koor: { survey: Survey; responses: SurveyResponse[] } | null;
  isHr: boolean;
}

type Group = "buka" | "spg" | "koor" | "putus";
const GROUPS: { id: Group; label: string }[] = [
  { id: "buka", label: "Pembuka" }, { id: "spg", label: "SPG → SPV" }, { id: "koor", label: "SPV → Koordinator" }, { id: "putus", label: "Keputusan" },
];
const KICKER: Record<Group, string> = { buka: "Pembuka", spg: "Bagian 1 · SPG menilai SPV", koor: "Bagian 2 · SPV menilai Koordinator SPV", putus: "Penutup" };

interface Slide { id: string; group: Group; title: string; sub?: string; body: React.ReactNode; notes: string[] }

const signed = (d: number) => `${d > 0 ? "▲" : "▼"} ${fmtNum(Math.abs(d))}`;

export function PresentDeck({ data }: { data: DeckData }) {
  const { spg, koor, isHr } = data;
  const periods = useMemo(() => {
    const fromSpg = spg ? spg.summary.map((p) => p.period) : [];
    const from360 = koor ? [...new Set(koor.responses.map((r) => r.period))] : [];
    return [...new Set([...fromSpg, ...from360])].sort().reverse();
  }, [spg, koor]);
  const [period, setPeriod] = useState(() => (spg ? [...spg.summary].reverse().find((p) => !p.suppressed)?.period : undefined) ?? periods[0] ?? "");
  const [idx, setIdx] = useState(0);
  const [notes, setNotes] = useState(true);
  const [hideNames, setHideNames] = useState(false);
  const [quotes, setQuotes] = useState(false);
  const [full, setFull] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const mon = period ? periodLabel(period) : "";
  const survey = spg?.survey;
  const label = useCallback((k: string) => survey?.questions.find((q) => q.key === k)?.kpiLabel ?? k, [survey]);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    if (!period) return out;

    /* ─── Data bagian 1 ─── */
    const cur = spg?.summary.find((p) => p.period === period);
    const segIdx = spg ? spg.segments.findIndex((s) => s.period === period) : -1;
    const segCur = spg && segIdx >= 0 ? spg.segments[segIdx] : null;
    const segPrev = spg && segIdx > 0 ? spg.segments[segIdx - 1] : null;
    const rows = spg && survey ? spvScorecard(survey, segCur, segPrev, spg.roster, SPV_SCALES) : [];
    const hi = spvHighlights(rows, SPV_SCALES, label);
    const mask = hideNames ? maskNames([...rows.map((r) => r.spv), ...Object.keys(spg?.roster ?? {})]) : {};
    const nm = (s: string) => mask[s] ?? s;
    const kpis = spg && survey ? headlineKpis(survey, spg.summary, period) : [];
    const prevSummary = spg && cur ? spg.summary.slice(0, spg.summary.indexOf(cur)).reverse().find((p) => !p.suppressed) : undefined;
    const spgOk = !!(spg && survey && cur && !cur.suppressed);

    /* ─── Data bagian 2 ─── */
    const lv = (() => {
      if (!koor) return null;
      const { leader } = build360(koor.survey.config, koor.responses.filter((r) => !r.excluded), [], LEADER_KEYS);
      const l = (k: string) => koor.survey.questions.find((q) => q.key === k)?.label.split(":")[0] ?? k;
      return leaderView(leader, period, LEADER_KEYS, l);
    })();
    const leaderName = hideNames ? "Koordinator SPV" : `Koordinator SPV${koor?.survey.config.leader ? ` (${koor.survey.config.leader})` : ""}`;
    const raters360 = lv?.raters ?? 0;

    /* ═══ Pembuka ═══ */
    out.push({
      id: "buka", group: "buka", title: "Suara dari lapangan, naik satu tingkat demi satu tingkat",
      sub: `Pulse Check & Feedback · ${mon}`,
      body: (
        <div className="space-y-6">
          <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <FlowBox who="SPG" does="menilai SPV-nya" value={spgOk ? `${cur!.n} jawaban` : "belum ada data"} />
            <Arrow />
            <FlowBox who="SPV" does="menilai Koordinator SPV" value={lv ? `${raters360} penilai` : isHr ? "belum ada data" : "khusus HR"} />
            <Arrow />
            <FlowBox who="Koordinator SPV" does="membina para SPV" value={lv?.avg != null ? `skor ${fmtNum(lv.avg)}` : "—"} />
          </div>
          <ol className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
            {["Cara data dikumpulkan dan dibaca", "Bagian 1 — SPG menilai SPV: gambaran, peringkat, titik lemah, isu lama, suara SPG", "Bagian 2 — SPV menilai Koordinator SPV", "Keputusan dan tindak lanjut"].map((t, i) => (
              <li key={t} className="flex gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"><span className="font-semibold text-blue-600">{i + 1}</span><span>{t}</span></li>
            ))}
          </ol>
        </div>
      ),
      notes: [
        "Tujuan sesi: memastikan masalah di lapangan sampai ke atasan lewat data, bukan lewat gosip — lalu ada yang memutuskan dan ada yang dikabari balik.",
        "Rantainya tiga tingkat. SPG menilai SPV; SPV menilai Koordinator SPV. Kita baca dari bawah ke atas.",
        "Sebut dulu bahwa semua yang tampil adalah angka dan ringkasan, bukan siapa menjawab apa.",
      ],
    });

    /* ═══ Bagian 1 ═══ */
    if (!spgOk) {
      out.push({
        id: "spg-kosong", group: "spg", title: `Belum ada data SPG → SPV untuk ${mon}`, sub: "Pilih bulan lain di bagian atas.",
        body: <p className="text-sm text-slate-500">Bulan ini belum punya jawaban yang cukup (minimal 3) untuk ditampilkan.</p>, notes: [],
      });
    } else {
      const c = cur!;
      const total = c.n_total ?? c.n;
      out.push({
        id: "spg-cara", group: "spg", title: `${c.n} jawaban dihitung dari ${c.n_people ?? c.n} orang — ini dasar semua angka`,
        sub: survey!.config.who,
        body: (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard t="Bulan yang dinilai" d={`Formulir diisi awal bulan berikutnya untuk menilai bulan sebelumnya. Jadi "${mon}" = penilaian atas ${mon}.`} />
              <InfoCard t="Isian ganda tidak dihitung dua kali" d={`Orang yang sama di outlet yang sama pada bulan yang sama dihitung sekali (isian terakhir). ${total !== c.n ? `Dari ${total} baris masuk, ${total - c.n} dikeluarkan.` : "Bulan ini tidak ada yang dikeluarkan."} SPG yang berpindah outlet tetap dihitung.`} />
              <InfoCard t="Privasi" d="Yang tampil adalah angka per kelompok. Kelompok kurang dari 3 orang disembunyikan, dan nama SPG tidak pernah muncul di layar ini." />
            </div>
            <CoverageCard summary={spg!.summary} />
          </div>
        ),
        notes: [
          `Jawaban yang dihitung bulan ini: ${c.n}. Yang masuk ${total}, dari ${c.n_people ?? c.n} orang berbeda.`,
          "Bagian ini sengaja ditaruh di depan supaya tidak ada yang bertanya 'ini datanya lengkap atau tidak' di tengah presentasi.",
          "Kalau ada yang bertanya kenapa jawaban September terus bertambah: sebagian diisi di bulan Oktober, karena formulir untuk bulan yang dinilai diisi bulan berikutnya.",
        ],
      });

      const lead = kpis.filter((k) => k.pct !== null).map((k) => `${k.label} ${Math.round(k.pct as number)}%`).join(" · ");
      const moves = kpis.filter((k) => k.delta !== null && Math.round(k.delta) !== 0)
        .map((k) => `${k.label} ${(k.delta as number) > 0 ? "▲" : "▼"} ${Math.abs(Math.round(k.delta as number))} poin (${k.better ? "membaik" : "memburuk"})`).join(" · ");
      out.push({
        id: "spg-gambaran", group: "spg", title: lead || `Gambaran ${mon}`, sub: moves ? `Dibanding ${prevSummary ? periodLabel(prevSummary.period) : "bulan lalu"}: ${moves}` : undefined,
        body: <KpiRow survey={survey!} summaries={spg!.summary} period={period} targetCount={spg!.campaigns.find((x) => x.period === period)?.target_count ?? null} />,
        notes: [
          "Mulai dari angka besar, jangan langsung ke detail. Tiga angka ini adalah ringkasan 'apakah SPG merasa didengar dan masalahnya ditangani'.",
          ...kpis.map((k) => `${k.label}: ${k.pct === null ? "—" : `${Math.round(k.pct)}%`}${k.delta !== null && Math.round(k.delta) !== 0 ? `, ${k.delta > 0 ? "naik" : "turun"} ${Math.abs(Math.round(k.delta))} poin` : ", sama seperti bulan lalu"}. ${k.hint}`),
          "Satu SPG = beberapa poin persen. Jangan terlalu serius pada pergeseran kecil; yang dilihat arah beberapa bulan, bukan satu bulan.",
        ],
      });

      out.push({
        id: "spg-tren", group: "spg", title: "Arah beberapa bulan terakhir — naik, turun, atau datar?", sub: "Klik titik atau bulan untuk berpindah bulan.",
        body: <TrendCard survey={survey!} summary={spg!.summary} period={period} setPeriod={setPeriod} title="Indikator utama dari bulan ke bulan" subtitle="Persen SPG per bulan." />,
        notes: ["Satu bulan bisa kebetulan; arah beberapa bulan yang bermakna.", "Tanyakan ke peserta: apakah ada kejadian di bulan yang turun (promo, pergantian SPV, perubahan jadwal) yang menjelaskannya?"],
      });

      if (rows.length) {
        const lowest = hi.lowest!, highest = hi.highest!;
        const dots: DotRow[] = rows.map((r) => ({ key: r.spv, label: nm(r.spv), sub: `${r.n} SPG`, current: r.score, previous: r.scorePrev, n: r.n,
          note: r.weakest ? `Terlemah: ${label(r.weakest.key)} (${Math.round(r.weakest.pct)}%)` : undefined }));
        const prevLabel = segPrev && rows.some((r) => r.scorePrev !== null) ? periodLabel(segPrev.period) : null;
        out.push({
          id: "spg-rapor", group: "spg",
          title: `${nm(lowest.spv)} skor terendah (${fmtNum(lowest.score)}), ${nm(highest.spv)} tertinggi (${fmtNum(highest.score)})`,
          sub: hi.biggestDrop || hi.biggestRise
            ? [hi.biggestDrop && `Turun terbesar: ${nm(hi.biggestDrop.spv)} (${signed(hi.biggestDrop.delta)})`, hi.biggestRise && `Naik terbesar: ${nm(hi.biggestRise.spv)} (${signed(hi.biggestRise.delta)})`].filter(Boolean).join(" · ")
            : "Rata-rata enam penilaian SPG (skala 1–5).",
          body: (
            <ChartCard title="Skor tiap SPV" subtitle={`Rata-rata 6 penilaian SPG (skala 1–5), ${mon}${prevLabel ? ` dibanding ${prevLabel}` : ""}.${segCur?.hidden ? ` ${segCur.hidden} SPV dengan kurang dari 3 SPG menjawab tidak ditampilkan.` : ""}`}
              legend={<Legend items={[{ label: mon, color: "var(--v-s1)" }, ...(prevLabel ? [{ label: prevLabel, color: "var(--v-muted)", kind: "ring" as const }] : []), { label: "terendah", color: "var(--v-s2)" }]} />}
              table={{ head: ["SPV", "SPG menjawab", "Skor", "Bulan lalu"], rows: rows.map((r) => [nm(r.spv), r.n, fmtNum(r.score), fmtNum(r.scorePrev)]) }}>
              <DotPlot rows={dots} domain={[3.5, 5]} ticks={[3.5, 4, 4.5, 5]} currentLabel={mon.split(" ")[0]} previousLabel={prevLabel ?? "Bulan lalu"} highlight={lowest.spv} />
            </ChartCard>
          ),
          notes: [
            "Ini inti Bagian 1. Skor tinggi bukan berarti sempurna — nilai 5 mendominasi, jadi bedakan SPV dari porsi nilai rendah, bukan hanya rata-rata.",
            `Dibanding bulan lalu: ${hi.down} SPV turun, ${hi.up} naik, ${hi.flat} relatif sama.`,
            "Sampaikan sebagai bahan pembinaan, bukan peringkat untuk dipermalukan. Selisih 0,1–0,2 pada ±10 SPG masih bisa kebetulan.",
            hideNames ? "Nama SPV sedang disamarkan (SPV A, B, …)." : "Nama SPV tampil. Kalau forum terbuka untuk para SPV, aktifkan 'Samarkan nama' di atas.",
          ],
        });

        out.push({
          id: "spg-lemah", group: "spg",
          title: hi.weakestCell ? `Titik terlemah: ${nm(hi.weakestCell.spv)} pada "${hi.weakestCell.scale}" — hanya ${Math.round(hi.weakestCell.pct)}% SPG memberi nilai 4–5` : "Enam penilaian per SPV",
          sub: "Persen SPG yang memberi nilai 4–5. Hijau tua = baik, merah muda = perlu perhatian.",
          body: (
            <ChartCard title="Enam penilaian + penanganan kendala" subtitle={`Per SPV, ${mon}.`}
              table={{ head: ["SPV", ...SPV_SCALES.map(label), "Kendala dituntaskan", "Kendala belum terjawab"], rows: rows.map((r) => [nm(r.spv), ...SPV_SCALES.map((k) => pct(r.scales[k])), pct(r.followed), pct(r.unresolved)]) }}>
              <div className="overflow-x-auto">
                <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
                  <thead><tr className="text-slate-500">
                    <th className="min-w-[80px] text-left font-medium">SPV</th>
                    {SPV_SCALES.map((k) => <th key={k} className="px-1 pb-1 text-center font-medium leading-tight">{label(k)}</th>)}
                    <th className="px-1 pb-1 text-center font-medium leading-tight">Kendala dituntaskan</th>
                    <th className="px-1 pb-1 text-center font-medium leading-tight">Kendala belum terjawab</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.spv}>
                        <td className="py-0.5 text-sm font-medium">{nm(r.spv)}</td>
                        {SPV_SCALES.map((k) => <td key={k} className="h-9 rounded-[4px] text-center text-sm tabular-nums" style={cell(r.scales[k], false)}>{pct(r.scales[k])}</td>)}
                        <td className="h-9 rounded-[4px] text-center text-sm tabular-nums" style={cell(r.followed, false)}>{pct(r.followed)}</td>
                        <td className="h-9 rounded-[4px] text-center text-sm tabular-nums" style={cell(r.unresolved, true)}>{pct(r.unresolved)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          ),
          notes: [
            "Peringkat tadi hanya 'siapa'. Tabel ini menjawab 'di bagian mana'. Satu SPV bisa tinggi rata-rata tapi lemah di satu aspek.",
            hi.weakestCell ? `Sel terlemah: ${nm(hi.weakestCell.spv)} pada "${hi.weakestCell.scale}" (${Math.round(hi.weakestCell.pct)}%).` : "",
            "Kolom 'Kendala belum terjawab' arah warnanya dibalik: makin kecil makin baik.",
            "Arahkan diskusi ke pembinaan spesifik (misalnya cara merespons, cara memberi arahan), bukan ke penilaian orangnya.",
          ].filter(Boolean),
        });
      }

      const priorQ = survey!.questions.find((q) => q.key === "prior_status");
      const followedQ = survey!.questions.find((q) => q.key === "followed");
      const priorK = priorQ ? c.questions[priorQ.key] : undefined;
      const belum = priorK ? ((priorK.counts["Belum terselesaikan"] ?? 0) / Math.max(1, priorK.answered)) * 100 : null;
      const tuntas = kpis.find((k) => k.key === "followed")?.pct ?? null;
      if (priorQ && followedQ) {
        out.push({
          id: "spg-isu", group: "spg",
          title: belum !== null ? `Isu lama: ${Math.round(belum)}% SPG bilang belum terselesaikan${tuntas !== null ? `; kendala baru yang diselesaikan ${Math.round(tuntas)}%` : ""}` : "Isu lama dan kendala yang dilaporkan",
          sub: "Pertanyaan ini mengukur apakah suara SPG ditindaklanjuti — yang paling menentukan apakah mereka mau mengisi lagi.",
          body: (
            <div className="grid gap-4 lg:grid-cols-2">
              <LikertCard question={priorQ} levels={PRIOR_LEVELS} mode="diverging" summary={spg!.summary} period={period} setPeriod={setPeriod}
                title="Isu yang pernah disampaikan" subtitle="Apakah sudah ditindaklanjuti? Merah ke kiri = belum terselesaikan." />
              <LikertCard question={followedQ} levels={FOLLOWED_LEVELS} mode="diverging" summary={spg!.summary} period={period} setPeriod={setPeriod}
                title="Kendala yang dilaporkan ke SPV" subtitle="Dari SPG yang melapor sebulan terakhir. Merah ke kiri = belum ada tindak lanjut." />
            </div>
          ),
          notes: [
            "Bagian ini sering terlewat padahal paling menentukan. Kalau SPG melapor dan tidak ada kabar, bulan depan mereka berhenti jujur.",
            belum !== null ? `Dari yang pernah memberi masukan, ${Math.round(belum)}% menjawab belum terselesaikan.` : "",
            tuntas !== null ? `Dari yang melapor kendala sebulan terakhir, ${Math.round(tuntas)}% diselesaikan.` : "",
          ].filter(Boolean),
        });
      }

      const defs = survey!.config.themes ?? [];
      if (defs.length) {
        const wIdx = spg!.themes.findIndex((t) => t.period === period);
        const win = wIdx >= 0 ? spg!.themes.slice(Math.max(0, wIdx - 7), wIdx + 1) : [];
        const top = topThemes(themeMatrix(defs, win, win.map((t) => t.period)), 3);
        out.push({
          id: "spg-suara", group: "spg",
          title: top.length ? `Yang paling sering disebut SPG: ${top.map((t) => `${t.label} — ${t.latest} orang`).join("; ")}` : "Keluhan dan usulan SPG",
          sub: "Dihitung dari kata kunci di komentar bebas, bukan penilaian AI. Satu orang bisa menyebut lebih dari satu tema.",
          body: <ThemeCard survey={survey!} themes={spg!.themes} period={period} setPeriod={setPeriod} unit="SPG" title="Tema keluhan & usulan" subtitle="Jumlah SPG yang menyebut tiap tema. Warna = persen dari SPG yang menjawab bulan itu." />,
          notes: [
            "Angka di sel = jumlah orang. Warna = persen dari yang menjawab bulan itu, karena jumlah penjawab tiap bulan berbeda.",
            "Cari yang warnanya makin gelap dari kiri ke kanan: itu keluhan yang makin sering, bukan yang sekadar banyak.",
            "Kutipan komentar sengaja tidak ditampilkan di layar presentasi. Kalau ada yang minta contoh, buka tab Komentar di dashboard (khusus HR).",
          ],
        });
      }

      const acts = (spg!.actions.filter((a) => a.period === period)).sort((a, b) => Number(!!b.is_focus) - Number(!!a.is_focus));
      out.push({
        id: "spg-aksi", group: "spg",
        title: acts.length
          ? `${acts.length} tindak lanjut untuk ${mon}; ${acts.some((a) => a.is_focus) ? `${acts.filter((a) => a.is_focus).length} ditetapkan sebagai fokus` : "belum ada yang ditetapkan sebagai fokus"}`
          : `Belum ada tindak lanjut untuk ${mon}`,
        sub: "Maksimal 3 fokus supaya yang dikerjakan benar-benar selesai.",
        body: acts.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {acts.map((a) => <ActionItem key={a.id} a={a} />)}
          </ul>
        ) : <p className="text-sm text-slate-500">Belum ada usulan atau fokus yang dicatat. Tambahkan dari tab Tindak lanjut di dashboard SPG → SPV.</p>,
        notes: [
          "Ini jembatan dari data ke keputusan. Usulan boleh banyak, fokus maksimal tiga.",
          "Minta peserta menyebut penanggung jawab dan tenggat untuk tiap fokus — kalau tidak, tidak akan bergerak.",
        ],
      });
    }

    /* ═══ Bagian 2 ═══ */
    const weakNote = hi.weakestCell ? `${nm(hi.weakestCell.spv)} pada "${hi.weakestCell.scale}" (${Math.round(hi.weakestCell.pct)}%)` : null;
    out.push({
      id: "jembatan", group: "koor", title: "Sekarang naik satu tingkat: siapa yang membina para SPV?",
      sub: "SPV menilai Koordinator SPV — arah umpan balik yang jarang didengar.",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard t="Yang baru kita lihat (SPG → SPV)" d={[hi.lowest ? `SPV terendah: ${nm(hi.lowest.spv)} (${fmtNum(hi.lowest.score)}).` : "", weakNote ? `Titik terlemah: ${weakNote}.` : "", hi.biggestDrop ? `Turun terbesar: ${nm(hi.biggestDrop.spv)} (${signed(hi.biggestDrop.delta)}).` : ""].filter(Boolean).join(" ") || "Belum ada data bulan ini."} />
          <InfoCard t="Pertanyaan untuk dibawa ke bagian berikutnya" d="Apakah para SPV mendapat arahan, pendampingan, dan keterbukaan yang cukup dari Koordinator untuk membina SPG-nya? Data berikut baru memberi gambaran awal, bukan jawaban pasti." />
        </div>
      ),
      notes: [
        "Hubungkan dua tingkat sebagai PERTANYAAN, bukan kesimpulan: yang lemah di bawah mungkin berhubungan dengan dukungan di atas, tapi datanya belum cukup untuk menyatakan sebab-akibat.",
        "Jumlah penilai di tingkat ini kecil (hitungan SPV), jadi dibaca sebagai gambaran arah.",
      ],
    });

    if (!isHr || !koor) {
      out.push({
        id: "koor-khusus-hr", group: "koor", title: "Rapor 360 Koordinator SPV hanya dibuka oleh tim HR",
        sub: "Dengan sedikit penilai, rata-rata pun mudah ditebak siapa menilai apa, jadi hanya HR yang melihatnya.",
        body: <p className="text-sm text-slate-500">Masuk dengan akun HR untuk menampilkan bagian ini.</p>, notes: ["Bila diminta, HR dapat menyampaikan ringkasannya secara lisan tanpa angka per penilai."],
      });
    } else if (!lv) {
      out.push({
        id: "koor-kosong", group: "koor", title: `Belum ada putaran 360 untuk ${mon}`, sub: "Pilih bulan lain di bagian atas.",
        body: <p className="text-sm text-slate-500">Putaran yang tersedia: {[...new Set(koor.responses.map((r) => periodLabel(r.period)))].join(", ") || "belum ada"}.</p>, notes: [],
      });
    } else {
      const rounds = [...new Set(koor.responses.filter((r) => !r.excluded).map((r) => r.period))].sort();
      out.push({
        id: "koor-cara", group: "koor", title: `${lv.raters} SPV menilai ${leaderName} di ${mon} — gambaran awal, bukan vonis`,
        sub: "Skala 1–5. Hanya rata-rata yang ditampilkan, tanpa nama penilai.",
        body: (
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCard t="Yang dinilai" d="Lima hal: arahan strategis, penyelesaian masalah, mentoring & feedback, keterbukaan, dan keadilan." />
            <InfoCard t="Jumlah penilai kecil" d={`${lv.raters} penilai bulan ini${lv.previousRaters !== null ? `, ${lv.previousRaters} pada putaran sebelumnya` : ""}. Satu orang bisa menggeser rata-rata cukup jauh, jadi lihat polanya, bukan angka desimalnya.`} />
            <InfoCard t="Putaran yang ada" d={rounds.map((p) => `${periodLabel(p)}: ${koor.responses.filter((r) => r.period === p && !r.excluded).length} jawaban`).join(" · ")} />
          </div>
        ),
        notes: [
          "Jelaskan dulu keterbatasan: jumlah penilai sedikit, putaran baru dua. Ini agar angka tidak dibaca sebagai hukuman.",
          "Penilaian diri dan kutipan penilai tidak ditampilkan di layar ini kecuali dipilih oleh pembicara.",
        ],
      });

      const dots: DotRow[] = lv.aspects.map((a) => ({ key: a.key, label: a.label, current: a.current, previous: a.previous, n: lv.raters }));
      const vals = lv.aspects.flatMap((a) => [a.current, a.previous]).filter((x): x is number => x !== null);
      const lo = Math.max(1, Math.floor(Math.min(...vals, 5) - 0.5));
      const prevLabel = lv.previousPeriod ? periodLabel(lv.previousPeriod) : null;
      const dAvg = lv.avg !== null && lv.previousAvg !== null ? lv.avg - lv.previousAvg : null;
      out.push({
        id: "koor-skor", group: "koor",
        title: `Rata-rata ${fmtNum(lv.avg)}${dAvg !== null && Math.abs(dAvg) >= MOVE_EPS ? ` (${dAvg > 0 ? "naik" : "turun"} dari ${fmtNum(lv.previousAvg)})` : ""}; terlemah ${lv.weakest ? `${lv.weakest.label.toLowerCase()} (${fmtNum(lv.weakest.current)})` : "—"}, terkuat ${lv.strongest ? `${lv.strongest.label.toLowerCase()} (${fmtNum(lv.strongest.current)})` : "—"}`,
        sub: lv.previousRaters !== null && lv.previousRaters !== lv.raters ? `Perhatian: jumlah penilai berbeda (${lv.raters} vs ${lv.previousRaters}), jadi perbandingan antar-putaran hanya perkiraan.` : undefined,
        body: (
          <ChartCard title={`Penilaian SPV terhadap ${leaderName}`} subtitle={`Skala 1–5, ${mon}${prevLabel ? ` dibanding ${prevLabel}` : ""}.`}
            legend={<Legend items={[{ label: mon, color: "var(--v-s1)" }, ...(prevLabel ? [{ label: prevLabel, color: "var(--v-muted)", kind: "ring" as const }] : [])]} />}
            table={{ head: ["Aspek", mon, prevLabel ?? "Putaran lalu"], rows: lv.aspects.map((a) => [a.label, fmtNum(a.current), fmtNum(a.previous)]) }}>
            <DotPlot rows={dots} domain={[lo, 5]} ticks={Array.from({ length: 5 - lo + 1 }, (_, i) => lo + i)} currentLabel={mon.split(" ")[0]} previousLabel={prevLabel ?? "Putaran lalu"} unit="SPV" labelWidth={190} />
          </ChartCard>
        ),
        notes: [
          lv.weakest ? `Aspek terendah: ${lv.weakest.label} (${fmtNum(lv.weakest.current)}).` : "",
          lv.spread ? `Rata-rata per penilai berkisar ${fmtNum(lv.spread.min)} sampai ${fmtNum(lv.spread.max)} — penilainya tidak seragam; itu informasi penting, jangan hanya melihat rata-rata.` : "",
          "Tekankan: angka ini masukan untuk dukungan dan pembinaan Koordinator, bukan penilaian kinerja formal.",
        ].filter(Boolean),
      });

      out.push({
        id: "koor-kutipan", group: "koor", title: "Dalam kata-kata mereka", sub: "Kutipan tanpa nama penilai. Tampilkan hanya yang aman dibacakan di forum ini.",
        body: !quotes ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
            Kutipan disembunyikan. Tekan <b>Tampilkan kutipan</b> di bagian atas bila memang akan dibacakan. Dengan penilai sedikit, gaya bahasa pun bisa dikenali — pilih dulu dan baca sebelum ditayangkan.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <QuoteList t="Yang sudah baik" tone="good" items={lv.strengths} />
            <QuoteList t="Yang perlu diperbaiki" tone="bad" items={lv.improvements} />
          </div>
        ),
        notes: ["Baca kutipan lebih dulu di tab Komentar/Rapor 360 sebelum tampil ke forum.", "Sampaikan yang baik lebih dulu, lalu yang perlu diperbaiki, dengan nada pembinaan."],
      });
    }

    /* ═══ Keputusan ═══ */
    const focus = (spg?.actions ?? []).filter((a) => a.period === period && a.is_focus);
    out.push({
      id: "putus", group: "putus", title: "Apa yang kita putuskan hari ini?",
      sub: "Satu penanggung jawab dan satu tenggat untuk tiap fokus, lalu kabari balik ke SPG.",
      body: (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Fokus yang sudah dipilih</h3>
            {focus.length ? <ul className="space-y-2">{focus.map((a) => <ActionItem key={a.id} a={a} />)}</ul>
              : <p className="rounded-lg bg-white p-3 text-sm text-slate-500 shadow-sm dark:bg-slate-900">Belum ada yang ditetapkan sebagai fokus bulan ini. Putuskan maksimal tiga hari ini.</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Pertanyaan untuk diputuskan</h3>
            <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {[
                "Dari tema yang paling sering disebut SPG, mana yang bisa dituntaskan bulan ini — dan siapa penanggung jawabnya?",
                hi.lowest ? `Pendampingan apa untuk ${nm(hi.lowest.spv)}${hi.weakestCell ? ` (terutama "${hi.weakestCell.scale}")` : ""}?` : "Pendampingan apa untuk SPV yang skornya paling rendah?",
                lv?.weakest ? `Dukungan apa yang dibutuhkan ${leaderName} pada "${lv.weakest.label.toLowerCase()}"?` : `Dukungan apa yang dibutuhkan ${leaderName}?`,
                "Kapan dan lewat apa hasilnya dikabarkan balik ke SPG?",
              ].map((t, i) => <li key={i} className="flex gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"><span className="font-semibold text-blue-600">{i + 1}</span><span>{t}</span></li>)}
            </ol>
          </div>
        </div>
      ),
      notes: [
        "Akhiri dengan permintaan keputusan, bukan sekadar laporan. Catat hasilnya langsung di tab Tindak lanjut.",
        "Janjikan kabar balik ke SPG dengan tanggal. Survei yang tidak pernah dijawab balik membuat orang berhenti mengisi.",
      ],
    });
    return out;
  }, [period, spg, koor, isHr, survey, label, hideNames, quotes, mon]);

  const total = slides.length;
  const at = Math.min(idx, Math.max(0, total - 1));
  const slide = slides[at];
  const go = useCallback((n: number) => setIdx(Math.min(Math.max(0, n), Math.max(0, total - 1))), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(at + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); go(at - 1); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go, total]);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFull = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void wrap.current?.requestFullscreen?.(); };

  if (!period) return <p className="text-sm text-slate-500">Belum ada data survei untuk ditampilkan.</p>;

  return (
    <div ref={wrap} className={cn("viz space-y-4 bg-slate-50 dark:bg-slate-950", full && "min-h-screen overflow-y-auto p-6")}>
      <VizStyle />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Bagian presentasi" className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {GROUPS.filter((g) => slides.some((s) => s.group === g.id)).map((g) => (
            <button key={g.id} type="button" onClick={() => go(slides.findIndex((s) => s.group === g.id))}
              className={cn("rounded-md px-3 py-1.5 text-sm", slide?.group === g.id ? "bg-blue-600 font-medium text-white" : "text-slate-600 dark:text-slate-300")}>{g.label}</button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Bulan yang dinilai</span>
          <select className={inputClass} style={{ width: "auto" }} value={period} onChange={(e) => { setPeriod(e.target.value); setIdx(0); }} aria-label="Bulan yang dinilai">
            {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <Button size="sm" variant={hideNames ? "primary" : "secondary"} aria-pressed={hideNames} onClick={() => setHideNames((v) => !v)}>{hideNames ? "Nama disamarkan" : "Samarkan nama"}</Button>
          {isHr && koor && <Button size="sm" variant={quotes ? "primary" : "secondary"} aria-pressed={quotes} onClick={() => setQuotes((v) => !v)}>{quotes ? "Kutipan tampil" : "Tampilkan kutipan"}</Button>}
          <Button size="sm" variant={notes ? "primary" : "secondary"} aria-pressed={notes} onClick={() => setNotes((v) => !v)}>Catatan pembicara</Button>
          <Button size="sm" variant="secondary" onClick={toggleFull}>{full ? "Keluar layar penuh" : "Layar penuh"}</Button>
        </div>
      </div>

      {slide && (
        <article key={slide.id} aria-live="polite" className="rounded-2xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          <header className="px-4 pb-3 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{KICKER[slide.group]}</p>
            <h2 className="mt-1 max-w-4xl text-xl font-semibold leading-snug text-slate-900 dark:text-white md:text-2xl">{slide.title}</h2>
            {slide.sub && <p className="mt-1 max-w-4xl text-sm text-slate-600 dark:text-slate-300">{slide.sub}</p>}
          </header>
          <div className="px-4 pb-4">{slide.body}</div>
        </article>
      )}

      {notes && slide && slide.notes.length > 0 && (
        <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30" aria-label="Catatan pembicara">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Catatan pembicara — tidak ikut dibaca peserta</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950 dark:text-amber-100">{slide.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </aside>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => go(at - 1)} disabled={at === 0}>← Sebelumnya</Button>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Daftar layar">
            {slides.map((s, i) => (
              <button key={s.id} type="button" role="tab" aria-selected={i === at} aria-label={`Layar ${i + 1}: ${s.title}`} title={s.title} onClick={() => go(i)}
                className={cn("h-2.5 rounded-full transition-all", i === at ? "w-6 bg-blue-600" : "w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700")} />
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{at + 1} / {total} · panah kiri/kanan untuk berpindah · N = catatan</span>
        </div>
        <Button variant="primary" onClick={() => go(at + 1)} disabled={at >= total - 1}>Berikutnya →</Button>
      </div>
    </div>
  );
}

/* ─── Potongan kecil ─── */

function FlowBox({ who, does, value }: { who: string; does: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-lg font-semibold text-slate-900 dark:text-white">{who}</p>
      <p className="text-xs text-slate-500">{does}</p>
      <p className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-300">{value}</p>
    </div>
  );
}
const Arrow = () => <div className="flex items-center justify-center text-2xl text-slate-400" aria-hidden>→</div>;

function InfoCard({ t, d }: { t: string; d: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d}</p>
    </div>
  );
}

function ActionItem({ a }: { a: SurveyAction }) {
  return (
    <li className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {a.is_focus && <span className="rounded bg-blue-600 px-1.5 py-0.5 font-medium text-white">Fokus</span>}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{ACTION_STATUS_LABEL[a.status]}</span>
        {a.theme && <span className="text-slate-500">{a.theme}</span>}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">PIC: {a.pic || "belum ditentukan"}{a.due_date ? ` · tenggat ${a.due_date}` : ""}</p>
    </li>
  );
}

function QuoteList({ t, tone, items }: { t: string; tone: "good" | "bad"; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className={cn("text-sm font-semibold", tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{t}</p>
      {items.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">{items.map((x, i) => <li key={i} className="border-l-2 border-slate-200 pl-3 dark:border-slate-700">{x}</li>)}</ul>
        : <p className="mt-2 text-sm text-slate-500">Tidak ada kutipan.</p>}
    </div>
  );
}
