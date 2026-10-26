"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Mode Presentasi Pulse Check — satu layar = satu pesan, dari lapangan ke atas:
     Pembuka (peta masalah) → SPG menilai SPV (bukti) → SPV menilai Koordinator → Akar masalah → Keputusan.

   Aturan tata letak: judul ≤ ±10 kata, satu visual, paling banyak 3 poin pendek. Penjelasan panjang
   masuk ke catatan pembicara (tersembunyi secara bawaan, tombol N). Angka & grafik memakai fungsi dan
   komponen yang sama dengan dashboard; judul yang memuat angka dihitung dari data, bukan tulisan tetap.
   Akar masalah (penyebab, solusi, kutipan) adalah DATA di pi_survey_diagnoses yang disusun HR.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, cn, inputClass } from "@/components/app-shell";
import {
  periodLabel, spvScorecard, build360,
  type Campaign, type Diagnosis, type PeriodSummary, type SegmentPeriod, type Survey, type SurveyAction, type SurveyResponse, type ThemePeriod,
} from "@/lib/rr/pulse";
import { leaderView, maskNames, spvHighlights } from "@/lib/rr/pulse-present";
import { ceilingItems, compileThemes, crossTab, favorableOf, gap, issueFunnel, spanOfControl, themeBySegment, themeGroups, type CrossRow } from "@/lib/rr/pulse-bi";
import { headlineKpis } from "@/lib/rr/pulse-viz";
import { KpiRow } from "./dash-common";
import { TrendCard } from "./dashboards";
import { SPV_SCALES, cell, pct } from "./spv-report";
import { ChartCard, Legend, VizStyle, fmtNum } from "./viz/base";
import { DotPlot, type DotRow } from "./viz/dot-plot";
import { Funnel, PctBars, SeqHeat, StackRows } from "./viz/present-viz";

const LEADER_KEYS = ["leader_direction", "leader_problem", "leader_mentoring", "leader_openness", "leader_fairness"];
const VISIT = ["Tidak Pernah", "1 kali", "2 kali", "3 kali", "Lebih dari 3 kali"];
const LOW_VISIT = ["Tidak Pernah", "1 kali", "2 kali"];
/** Kelompok terkecil yang boleh menentukan peringkat pengungkit. */
const MIN_RANK_N = 10;
const r0 = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x)}%`);

export interface DeckData {
  spg: {
    survey: Survey; summary: PeriodSummary[]; segments: SegmentPeriod[]; themes: ThemePeriod[]; actions: SurveyAction[]; roster: Record<string, number>; campaigns: Campaign[];
    /** Jawaban mentah — kosong untuk owner; layar analisis kaitan hanya muncul bila terisi. */
    responses: SurveyResponse[];
    /** Analisis akar masalah (khusus HR). */
    diagnoses: Diagnosis[];
  } | null;
  koor: { survey: Survey; responses: SurveyResponse[] } | null;
  isHr: boolean;
}

type Group = "buka" | "spg" | "koor" | "akar" | "putus";
const GROUPS: { id: Group; label: string }[] = [
  { id: "buka", label: "Pembuka" }, { id: "spg", label: "SPG → SPV" }, { id: "koor", label: "SPV → Koordinator" }, { id: "akar", label: "Akar masalah" }, { id: "putus", label: "Keputusan" },
];
const KICKER: Record<Group, string> = { buka: "Pembuka", spg: "Bagian 1 · SPG menilai SPV", koor: "Bagian 2 · SPV menilai Koordinator", akar: "Bagian 3 · Akar masalah", putus: "Penutup" };

interface Slide { id: string; group: Group; kicker?: string; title: string; sub?: string; body: React.ReactNode; notes: string[] }

export function PresentDeck({ data }: { data: DeckData }) {
  const { spg, koor, isHr } = data;
  const periods = useMemo(() => {
    const fromSpg = spg ? spg.summary.map((p) => p.period) : [];
    const from360 = koor ? [...new Set(koor.responses.map((r) => r.period))] : [];
    return [...new Set([...fromSpg, ...from360])].sort().reverse();
  }, [spg, koor]);
  const [period, setPeriod] = useState(() => (spg ? [...spg.summary].reverse().find((p) => !p.suppressed)?.period : undefined) ?? periods[0] ?? "");
  const [idx, setIdx] = useState(0);
  const [notes, setNotes] = useState(false);
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
    const diags = (spg?.diagnoses ?? []).filter((d) => d.period === period).sort((a, b) => a.ord - b.ord);
    const spvOptions = survey?.questions.find((q) => q.key === "spv")?.options?.map((o) => o.value) ?? [];
    const mask = hideNames ? maskNames([...rows.map((r) => r.spv), ...Object.keys(spg?.roster ?? {}), ...spvOptions, ...diags.map((d) => d.spv).filter((x): x is string => !!x)]) : {};
    const nm = (s: string) => mask[s] ?? s;
    // Teks analisis bisa menyebut SPV lain (mis. di catatan); saat disamarkan, semua nama yang dikenal ikut diganti.
    const maskAll = (t: string) => Object.entries(mask).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), v), t);
    const fill = (text: string | null, d: Diagnosis) => maskAll((text ?? "").replace(/\{spv\}/g, d.spv ? nm(d.spv) : "SPV"));
    const kpis = spg && survey ? headlineKpis(survey, spg.summary, period) : [];
    const spgOk = !!(spg && survey && cur && !cur.suppressed);

    /* ─── Data bagian 2 ─── */
    const lv = (() => {
      if (!koor) return null;
      const { leader } = build360(koor.survey.config, koor.responses.filter((r) => !r.excluded), [], LEADER_KEYS);
      const l = (k: string) => koor.survey.questions.find((q) => q.key === k)?.label.split(":")[0] ?? k;
      return leaderView(leader, period, LEADER_KEYS, l);
    })();
    const leaderName = hideNames ? "Koordinator SPV" : `Koordinator SPV${koor?.survey.config.leader ? ` (${koor.survey.config.leader})` : ""}`;

    /* ─── Analisis tingkat responden (khusus HR; owner tidak menerima jawaban mentah) ─── */
    const raw = (spg?.responses ?? []).filter((r) => r.period === period && !r.excluded);
    const bi = raw.length >= 10 && survey ? (() => {
      const fav = (r: Pick<SurveyResponse, "answers">) => favorableOf(r, "comfort");
      const drivers: { key: string; title: string; rows: CrossRow[] }[] = [
        { key: "visit", title: "Frekuensi kunjungan SPV", rows: crossTab(raw, "visit_freq", fav, { buckets: { "> 3 kali": ["Lebih dari 3 kali"], "3 kali": ["3 kali"], "≤ 2 kali": LOW_VISIT } }) },
        { key: "problem", title: "Cara SPV menangani masalah", rows: crossTab(raw, "problem_behavior", fav, { buckets: { "Sangat membantu": ["Sangat membantu"], "Cukup membantu": ["Cukup membantu"], "Kurang / tidak": ["Kurang membantu", "Tidak membantu"] } }) },
        { key: "unresolved", title: "Ada kendala belum terjawab", rows: crossTab(raw, "unresolved", fav, { buckets: { Tidak: ["Tidak"], Ya: ["Ya"] } }) },
      ].filter((d) => d.rows.length >= 2);
      const themes = compileThemes(survey.config.themes ?? []);
      const tg = themes.length ? themeGroups(raw, themes) : null;
      const topThemeKeys = tg ? tg.groups.flatMap((g) => g.themes).sort((a, b) => b.n - a.n).slice(0, 5) : [];
      return {
        // Peringkat pengungkit hanya dari kelompok ≥ MIN_RANK_N orang, supaya kelompok 4 orang tidak menjadi "temuan utama".
        drivers: drivers.map((d) => ({ ...d, gap: gap(d.rows.filter((r) => r.n >= MIN_RANK_N)) })).sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1)),
        span: spanOfControl(raw, "spv", "visit_freq", VISIT, LOW_VISIT),
        funnel: issueFunnel(raw),
        tg, topThemeKeys,
        bySpv: themes.length ? themeBySegment(raw, themes, "spv", topThemeKeys.map((t) => t.key)) : [],
        ceiling: ceilingItems(survey, raw),
      };
    })() : null;

    /* ═══ Pembuka ═══ */
    out.push({
      id: "buka", group: "buka", title: `Suara SPG & SPV — ${mon}`, sub: "Dari lapangan ke atas, lalu kita putuskan bersama.",
      body: (
        <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FlowBox who="SPG" does="menilai SPV" value={spgOk ? `${cur!.n} jawaban` : "—"} />
          <Arrow />
          <FlowBox who="SPV" does="menilai Koordinator" value={lv ? `${lv.raters} penilai` : isHr ? "—" : "khusus HR"} />
          <Arrow />
          <FlowBox who="Koordinator SPV" does="membina para SPV" value={lv?.avg != null ? `skor ${fmtNum(lv.avg, 1)} / 5` : "—"} />
        </div>
      ),
      notes: [
        "Tujuan: masalah di lapangan sampai ke atasan lewat data, ada yang memutuskan, dan SPG dikabari balik.",
        "Urutan: peta masalah → bukti dari SPG → penilaian Koordinator → akar masalah → keputusan.",
        "Yang tampil hanya angka per kelompok; nama SPG tidak pernah muncul.",
      ],
    });

    if (diags.length) {
      out.push({
        id: "peta", group: "buka", title: `${diags.length} masalah utama ${mon}`, sub: "Dikelompokkan menurut siapa yang bisa menyelesaikannya.",
        body: (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {diags.map((d) => (
              <div key={d.id} className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <OwnerBadge owner={d.owner} />
                <p className="mt-2 text-3xl font-semibold leading-none text-slate-900 dark:text-white">{d.metric}</p>
                <p className="mt-1 text-xs text-slate-500">{fill(d.metric_label, d)}</p>
                <p className="mt-auto pt-3 text-sm font-medium leading-snug text-slate-900 dark:text-white">{fill(d.title, d)}</p>
              </div>
            ))}
          </div>
        ),
        notes: [
          "Ini jawabannya lebih dulu. Layar berikutnya adalah buktinya, lalu tiap masalah dibedah satu per satu di bagian Akar masalah.",
          "Perhatikan pemiliknya: dua masalah terbesar ada di level manajemen dan HR, bukan di SPV.",
        ],
      });
    }

    /* ═══ Bagian 1 — bukti dari SPG ═══ */
    if (!spgOk) {
      out.push({ id: "spg-kosong", group: "spg", title: `Belum ada data SPG → SPV untuk ${mon}`, sub: "Pilih bulan lain di bagian atas.", body: <span />, notes: [] });
    } else {
      const c = cur!;
      const total = c.n_total ?? c.n;
      out.push({
        id: "spg-data", group: "spg", title: `${c.n} jawaban dari ${c.n_people ?? c.n} SPG`, sub: survey!.config.who,
        body: (
          <div className="grid gap-3 sm:grid-cols-3">
            <BigStat value={String(total)} label="isian masuk" />
            <BigStat value={String(c.n)} label="dihitung" />
            <BigStat value={String(total - c.n)} label="isian ganda dikeluarkan" muted />
          </div>
        ),
        notes: [
          `Bulan yang dinilai = ${mon}; formulirnya diisi awal bulan berikutnya, jadi sebagian masuk di bulan Oktober.`,
          "Isian ganda = orang yang sama di outlet yang sama pada bulan yang sama; yang terakhir dipakai. SPG yang pindah outlet tetap dihitung.",
          "Kelompok kurang dari 3 orang disembunyikan.",
        ],
      });

      out.push({
        id: "spg-gambaran", group: "spg", title: kpis.filter((k) => k.pct !== null).map((k) => `${k.label} ${Math.round(k.pct as number)}%`).join(" · ") || `Gambaran ${mon}`,
        body: <KpiRow survey={survey!} summaries={spg!.summary} period={period} targetCount={spg!.campaigns.find((x) => x.period === period)?.target_count ?? null} />,
        notes: [
          ...kpis.map((k) => `${k.label}: ${r0(k.pct)}${k.delta !== null && Math.round(k.delta) !== 0 ? ` (${k.delta > 0 ? "naik" : "turun"} ${Math.abs(Math.round(k.delta))} poin)` : ""}. ${k.hint}`),
          "Satu SPG = beberapa poin persen; yang dilihat arah beberapa bulan, bukan satu bulan.",
        ],
      });

      out.push({
        id: "spg-tren", group: "spg", title: "Arah beberapa bulan terakhir",
        body: <TrendCard survey={survey!} summary={spg!.summary} period={period} setPeriod={setPeriod} title="Indikator utama per bulan" subtitle="Persen SPG. Klik bulan untuk berpindah." />,
        notes: ["Tanyakan: adakah kejadian di bulan yang turun (promo, pergantian SPV, perubahan jadwal)?"],
      });

      if (rows.length) {
        const lowest = hi.lowest!, highest = hi.highest!;
        const dots: DotRow[] = rows.map((r) => ({ key: r.spv, label: nm(r.spv), sub: `${r.n} SPG`, current: r.score, previous: r.scorePrev, n: r.n,
          note: r.weakest ? `Terlemah: ${label(r.weakest.key)} (${Math.round(r.weakest.pct)}%)` : undefined }));
        const prevLabel = segPrev && rows.some((r) => r.scorePrev !== null) ? periodLabel(segPrev.period) : null;
        out.push({
          id: "spg-rapor", group: "spg", title: `${nm(lowest.spv)} terendah, ${nm(highest.spv)} tertinggi`,
          sub: hi.biggestDrop ? `Turun terbesar: ${nm(hi.biggestDrop.spv)} (▼ ${fmtNum(Math.abs(hi.biggestDrop.delta))})` : undefined,
          body: (
            <ChartCard title="Skor tiap SPV (skala 1–5)" subtitle={`${mon}${prevLabel ? ` vs ${prevLabel}` : ""}`}
              legend={<Legend items={[{ label: mon, color: "var(--v-s1)" }, ...(prevLabel ? [{ label: prevLabel, color: "var(--v-muted)", kind: "ring" as const }] : []), { label: "terendah", color: "var(--v-s2)" }]} />}
              table={{ head: ["SPV", "SPG menjawab", "Skor", "Bulan lalu"], rows: rows.map((r) => [nm(r.spv), r.n, fmtNum(r.score), fmtNum(r.scorePrev)]) }}>
              <DotPlot rows={dots} domain={[3.5, 5]} ticks={[3.5, 4, 4.5, 5]} currentLabel={mon.split(" ")[0]} previousLabel={prevLabel ?? "Bulan lalu"} highlight={lowest.spv} />
            </ChartCard>
          ),
          notes: [
            `Dibanding bulan lalu: ${hi.down} SPV turun, ${hi.up} naik, ${hi.flat} relatif sama.`,
            "Nilai 5 mendominasi; bedakan dari porsi nilai rendah, bukan rata-rata saja. Selisih 0,1–0,2 bisa kebetulan.",
            hideNames ? "Nama SPV disamarkan." : "Forum terbuka untuk para SPV? Aktifkan 'Samarkan nama'.",
          ],
        });

        out.push({
          id: "spg-lemah", group: "spg", title: "Titik lemah tiap SPV",
          sub: hi.weakestCell ? `Terlemah: ${nm(hi.weakestCell.spv)} — "${hi.weakestCell.scale}" ${Math.round(hi.weakestCell.pct)}%` : undefined,
          body: (
            <ChartCard title="% SPG memberi nilai 4–5" subtitle="Hijau tua = baik · merah muda = perlu perhatian"
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
            "Peringkat = siapa; tabel ini = di bagian mana. Tiap SPV punya titik lemah yang berbeda.",
            ...rows.filter((r) => r.weakest).map((r) => `${nm(r.spv)}: terlemah "${label(r.weakest!.key)}" ${Math.round(r.weakest!.pct)}%${r.followed !== null ? `, kendala dituntaskan ${Math.round(r.followed)}%` : ""}.`),
            "Kolom 'Kendala belum terjawab' arahnya dibalik: makin kecil makin baik.",
          ],
        });
      }

      if (bi && bi.span.length) {
        const top = bi.span[0];
        const levels = VISIT.map((v, i) => ({ key: v, label: v === "Tidak Pernah" ? "Tidak pernah" : v, color: `var(--v-ord-${Math.min(6, i + 2)})`, ink: `var(--v-ordink-${Math.min(6, i + 2)})` }));
        out.push({
          id: "spg-kendali", group: "spg", title: `${top.n} SPG menilai ${nm(top.spv)} — terbanyak`,
          sub: `${r0(top.top)} dari mereka dikunjungi lebih dari 3x sebulan`,
          body: (
            <ChartCard title="SPG per SPV & frekuensi kunjungan" subtitle="Makin gelap = makin sering dikunjungi"
              legend={<Legend items={levels.map((l) => ({ label: l.label, color: l.color }))} />}
              table={{ head: ["SPV", "SPG", "Porsi", ...levels.map((l) => l.label)], rows: bi.span.map((r) => [nm(r.spv), r.n, r0(r.share), ...VISIT.map((v) => r0(r.dist[v]))]) }}>
              <StackRows levels={levels} rows={bi.span.map((r) => ({ key: r.spv, label: nm(r.spv), sub: `${r.n} SPG · ${r0(r.share)}`, parts: r.dist }))} />
            </ChartCard>
          ),
          notes: [
            "Rentang kendali = berapa orang dibina satu atasan. Makin lebar, makin tipis waktu per orang.",
            `${top.n} SPG memilih ${nm(top.spv)} di formulir; jumlah di master karyawan bisa berbeda (lihat Akar masalah).`,
            "Skor terendah tidak selalu yang paling jarang berkunjung — kalau sering datang tapi skornya rendah, masalahnya kualitas kunjungan.",
          ],
        });
      }

      if (bi && bi.drivers.length) {
        const d0 = bi.drivers[0];
        const big = d0.rows.filter((r) => r.pct !== null && r.n >= MIN_RANK_N);
        out.push({
          id: "spg-pengungkit", group: "spg", title: "Apa yang membuat SPG nyaman dengan SPV?",
          sub: big.length >= 2 ? `Paling berkaitan: ${d0.title} (${r0(big[0].pct)} vs ${r0(big.at(-1)!.pct)})` : undefined,
          body: (
            <div className="grid gap-4 lg:grid-cols-3">
              {bi.drivers.map((d) => (
                <ChartCard key={d.key} title={d.title} subtitle={d.gap !== null ? `Selisih ${Math.round(d.gap)} poin` : "Pembanding < 10 SPG"}
                  table={{ head: ["Kelompok", "SPG", "% nyaman"], rows: d.rows.map((r) => [r.value, r.n, r0(r.pct)]) }}>
                  <PctBars outcome="Nyaman dengan SPV" rows={d.rows.map((r, i) => ({ key: r.value, label: r.value, pct: r.pct, n: r.n, accent: i === d.rows.length - 1 }))} />
                </ChartCard>
              ))}
            </div>
          ),
          notes: [
            "Persen SPG yang nyaman berkomunikasi dengan SPV (nilai 4–5), dikelompokkan menurut jawaban lain di formulir yang sama.",
            ...bi.drivers.map((d) => `${d.title}: ${d.rows.map((r) => `${r.value} ${r0(r.pct)} (n=${r.n})`).join(" · ")}.`),
            "Ini kaitan, bukan bukti sebab-akibat. Kelompok di bawah 10 SPG dibaca hati-hati.",
          ],
        });
      }

      if (bi && bi.funnel.total) {
        const f = bi.funnel;
        out.push({
          id: "spg-corong", group: "spg", title: `${f.unresolved} SPG masih menunggu solusi`,
          sub: `${f.reported} melapor kendala · ${f.solved} diselesaikan`,
          body: (
            <ChartCard title="Corong kendala" subtitle="Persen terhadap semua SPG yang menjawab"
              table={{ head: ["Langkah", "SPG"], rows: [["Semua SPG", f.total], ["Melapor kendala", f.reported], ["Diselesaikan", f.solved], ["Sedang diproses", f.inProgress], ["Belum ditindaklanjuti", f.notFollowed], ["Masih tanpa solusi", f.unresolved]] }}>
              <Funnel steps={[
                { key: "all", label: "Semua SPG", value: f.total },
                { key: "rep", label: "Melapor kendala ke SPV", value: f.reported },
                { key: "ok", label: "Diselesaikan", value: f.solved, tone: "good", indent: true },
                { key: "wip", label: "Sedang diproses", value: f.inProgress, tone: "warn", indent: true },
                { key: "no", label: "Belum ditindaklanjuti", value: f.notFollowed, tone: "bad", indent: true },
                { key: "open", label: "Masih punya kendala tanpa solusi", value: f.unresolved, tone: "bad" },
              ]} />
            </ChartCard>
          ),
          notes: [
            `${f.reported} dari ${f.total} SPG melapor kendala dalam sebulan — volume laporan ke SPV besar.`,
            "'Masih tanpa solusi' adalah pertanyaan terpisah; bisa termasuk kendala lama.",
            "Isian mereka bisa dibuka satu per satu di tab Jawaban lengkap.",
          ],
        });
      }

      if (bi && bi.tg && bi.tg.any > 0) {
        const tg = bi.tg;
        const g0 = tg.groups[0];
        const uneven = bi.topThemeKeys.map((t) => {
          const vals = bi.bySpv.map((r) => ({ s: r.segment, v: r.values[t.key] })).filter((x): x is { s: string; v: number } => x.v !== null);
          if (vals.length < 2) return null;
          const mx = vals.reduce((a, b) => (b.v > a.v ? b : a)), mn = vals.reduce((a, b) => (b.v < a.v ? b : a));
          return { t, mx, mn, spread: mx.v - mn.v };
        }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.spread - a.spread)[0];
        out.push({
          id: "spg-keluhan", group: "spg", title: `${r0(g0.pct)} SPG mengeluhkan ${g0.group.toLowerCase()}`,
          sub: g0.themes.slice(0, 3).map((t) => `${t.label.split(" (")[0]} ${t.n}`).join(" · "),
          body: (
            <div className="grid gap-4 xl:grid-cols-5">
              <ChartCard className="xl:col-span-2" title="Keluhan per kelompok" subtitle="% SPG yang menyebut ≥ 1 tema"
                table={{ head: ["Kelompok", "SPG", "%", "Tema teratas"], rows: tg.groups.map((g) => [g.group, g.n, r0(g.pct), g.themes.slice(0, 3).map((t) => `${t.label} (${t.n})`).join(", ")]) }}>
                <PctBars outcome="Menyebut kelompok ini" rows={tg.groups.map((g, i) => ({ key: g.group, label: g.group, pct: g.pct, n: g.n, accent: i === 0 }))} />
              </ChartCard>
              {bi.bySpv.length > 0 && (
                <ChartCard className="xl:col-span-3" title="Tema teratas per area SPV" subtitle="Merata = masalah perusahaan · menumpuk = masalah lokal"
                  table={{ head: ["SPV", "SPG", ...bi.topThemeKeys.map((t) => t.label)], rows: bi.bySpv.map((r) => [nm(r.segment), r.n, ...bi.topThemeKeys.map((t) => r0(r.values[t.key]))]) }}>
                  <SeqHeat cols={bi.topThemeKeys.map((t) => ({ key: t.key, label: t.label.split(" (")[0] }))} rows={bi.bySpv.map((r) => ({ key: r.segment, label: nm(r.segment), sub: `${r.n}`, values: r.values }))} />
                </ChartCard>
              )}
            </div>
          ),
          notes: [
            `${tg.any} dari ${tg.total} SPG menulis setidaknya satu keluhan bertema (dihitung dari kata kunci, per orang).`,
            ...(uneven && uneven.spread >= 30 ? [`Tidak merata: "${uneven.t.label}" ${r0(uneven.mx.v)} di area ${nm(uneven.mx.s)} vs ${r0(uneven.mn.v)} di area ${nm(uneven.mn.s)}. Cek juga berapa SPG di area itu yang menulis komentar — sedikit komentar bisa terlihat seperti tidak ada keluhan.`] : []),
            "Keluhan hak & kesejahteraan adalah keputusan manajemen — jangan dibebankan ke SPV.",
          ],
        });
      }
    }

    /* ═══ Bagian 2 — SPV menilai Koordinator ═══ */
    if (!isHr || !koor) {
      out.push({ id: "koor-hr", group: "koor", title: "Penilaian Koordinator hanya dibuka tim HR", sub: "Penilainya sedikit, jadi rata-rata pun mudah ditebak.", body: <span />, notes: [] });
    } else if (!lv) {
      out.push({ id: "koor-kosong", group: "koor", title: `Belum ada penilaian Koordinator untuk ${mon}`, sub: "Pilih bulan lain di bagian atas.", body: <span />, notes: [] });
    } else {
      const dots: DotRow[] = lv.aspects.map((a) => ({ key: a.key, label: a.label, current: a.current, previous: a.previous, n: lv.raters }));
      const vals = lv.aspects.flatMap((a) => [a.current, a.previous]).filter((x): x is number => x !== null);
      const lo = Math.max(1, Math.floor(Math.min(...vals, 5) - 0.5));
      const prevLabel = lv.previousPeriod ? periodLabel(lv.previousPeriod) : null;
      out.push({
        id: "koor-skor", group: "koor", title: `${leaderName}: ${fmtNum(lv.avg, 2)} dari 5`,
        sub: `${lv.raters} SPV menilai${lv.weakest ? ` · terendah: ${lv.weakest.label.toLowerCase()} ${fmtNum(lv.weakest.current)}` : ""}`,
        body: (
          <ChartCard title="Penilaian SPV per aspek" subtitle={`Skala 1–5 · ${mon}${prevLabel ? ` vs ${prevLabel}` : ""}`}
            legend={<Legend items={[{ label: mon, color: "var(--v-s1)" }, ...(prevLabel ? [{ label: prevLabel, color: "var(--v-muted)", kind: "ring" as const }] : [])]} />}
            table={{ head: ["Aspek", mon, prevLabel ?? "Putaran lalu"], rows: lv.aspects.map((a) => [a.label, fmtNum(a.current), fmtNum(a.previous)]) }}>
            <DotPlot rows={dots} domain={[lo, 5]} ticks={Array.from({ length: 5 - lo + 1 }, (_, i) => lo + i)} currentLabel={mon.split(" ")[0]} previousLabel={prevLabel ?? "Putaran lalu"} unit="SPV" labelWidth={190} />
          </ChartCard>
        ),
        notes: [
          `Rata-rata ${fmtNum(lv.avg)}${lv.previousAvg !== null ? `, putaran lalu ${fmtNum(lv.previousAvg)}` : ""}. Penilai: ${lv.raters}${lv.previousRaters !== null ? ` (putaran lalu ${lv.previousRaters})` : ""} — perbandingan hanya perkiraan.`,
          lv.spread ? `Rata-rata per penilai ${fmtNum(lv.spread.min)} sampai ${fmtNum(lv.spread.max)}: pendapat para SPV tidak seragam.` : "",
          "Masukan untuk dukungan dan pembinaan, bukan penilaian kinerja formal.",
        ].filter(Boolean),
      });
      out.push({
        id: "koor-kutipan", group: "koor", title: "Kata para SPV", sub: quotes ? "Tanpa nama penilai." : "Kutipan disembunyikan — tekan \"Tampilkan kutipan\" bila aman dibacakan.",
        body: quotes ? (
          <div className="grid gap-4 md:grid-cols-2">
            <QuoteList t="Yang sudah baik" tone="good" items={lv.strengths} />
            <QuoteList t="Yang perlu diperbaiki" tone="bad" items={lv.improvements} />
          </div>
        ) : <span />,
        notes: ["Dengan 6 penilai, gaya bahasa bisa dikenali. Baca dulu sebelum ditayangkan.", "Sampaikan yang baik dulu, lalu yang perlu diperbaiki."],
      });
    }

    /* ═══ Bagian 3 — Akar masalah (data dari HR) ═══ */
    diags.forEach((d, i) => {
      out.push({
        id: `akar-${d.ord}`, group: "akar", kicker: `Akar masalah ${i + 1} dari ${diags.length}`, title: fill(d.title, d),
        body: (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <OwnerBadge owner={d.owner} />
                <p className="mt-3 text-5xl font-semibold leading-none text-slate-900 dark:text-white">{d.metric}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{fill(d.metric_label, d)}</p>
                {d.evidence.length > 0 && <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">{d.evidence.slice(0, 3).map((e, j) => <li key={j}>• {fill(e, d)}</li>)}</ul>}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <Column title="Penyebab" tone="bad" items={d.causes.slice(0, 3).map((x) => ({ t: fill(x, d) }))} />
                <div className="hidden items-center text-2xl text-slate-400 sm:flex" aria-hidden>→</div>
                <Column title="Solusi" tone="good" items={d.solutions.slice(0, 4).map((s) => ({ t: fill(s.text, d), s: [s.pic, s.due].filter(Boolean).join(" · ") }))} />
              </div>
            </div>
            {quotes && d.quotes.length > 0 && (
              <div className="flex flex-wrap gap-2">{d.quotes.slice(0, 3).map((q, j) => <span key={j} className="rounded-lg bg-white px-3 py-1.5 text-sm italic text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">“{q}”</span>)}</div>
            )}
          </div>
        ),
        notes: [...d.notes.map((n) => fill(n, d)), ...(d.quotes.length && !quotes ? [`Kata SPG/SPV: ${d.quotes.map((q) => `“${q}”`).join(" · ")}`] : []), d.source ? `Sumber: ${d.source}.` : ""].filter(Boolean),
      });
    });

    /* ═══ Penutup ═══ */
    if (bi && bi.ceiling.length) {
      out.push({
        id: "kualitas", group: "putus", title: `${bi.ceiling.length} pertanyaan perlu diganti`, sub: "Jawabannya hampir seragam — tidak lagi membedakan SPV.",
        body: (
          <ChartCard title="Satu jawaban dipilih ≥ 95% SPG" table={{ head: ["Pertanyaan", "Jawaban dominan", "%", "n"], rows: bi.ceiling.map((c) => [c.label, c.value, r0(c.pct), c.n]) }}>
            <PctBars outcome="Memilih jawaban dominan" rows={bi.ceiling.map((c) => ({ key: c.key, label: c.label, sub: `"${c.value}"`, pct: c.pct, n: c.n }))} />
          </ChartCard>
        ),
        notes: [
          "Kalau hampir semua menjawab 'Ya', pertanyaan itu tidak bisa membedakan SPV yang benar-benar melakukan dari yang tidak.",
          "Usulan: ganti Ya/Tidak dengan frekuensi ('berapa kali') atau contoh konkret ('apa yang terakhir diajarkan?'). Catat bulan perubahannya.",
        ],
      });
    }

    // Dua langkah pertama per masalah di layar; sisanya di catatan pembicara supaya tabel tetap terbaca dari jauh.
    const planAll = diags.map((d) => ({ d, items: d.solutions.map((s) => ({ problem: fill(d.title, d), ...s, text: fill(s.text, d) })) }));
    const plan = planAll.flatMap((x) => x.items.slice(0, 2));
    const planRest = planAll.flatMap((x) => x.items.slice(2));
    out.push({
      id: "putus", group: "putus", title: plan.length ? "Rencana tindakan untuk disetujui" : "Apa yang kita putuskan hari ini?",
      sub: plan.length ? "Setujui, ubah PIC/tenggat, atau coret — lalu kabari SPG." : "Maksimal 3 fokus, masing-masing dengan PIC dan tenggat.",
      body: plan.length ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
              <th className="px-3 py-2 font-medium">Tindakan</th><th className="px-3 py-2 font-medium">PIC</th><th className="px-3 py-2 font-medium">Tenggat</th><th className="px-3 py-2 font-medium">Untuk masalah</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plan.map((p, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white">{p.text}</td>
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{p.pic ?? "—"}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{p.due ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{p.problem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ol className="grid gap-2 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2">
          {[
            "Tema keluhan mana yang dituntaskan bulan ini, oleh siapa?",
            hi.lowest ? `Pendampingan apa untuk ${nm(hi.lowest.spv)}${hi.lowest.weakest ? ` ("${label(hi.lowest.weakest.key)}")` : ""}?` : "Pendampingan apa untuk SPV dengan skor terendah?",
            lv?.weakest ? `Dukungan apa untuk ${leaderName} soal ${lv.weakest.label.toLowerCase()}?` : `Dukungan apa untuk ${leaderName}?`,
            "Kapan hasilnya dikabarkan ke SPG?",
          ].map((t, i) => <li key={i} className="flex gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900"><span className="font-semibold text-blue-600">{i + 1}</span><span>{t}</span></li>)}
        </ol>
      ),
      notes: [
        "Akhiri dengan keputusan, bukan laporan. Yang disetujui dicatat di tab Tindak lanjut (maks. 3 fokus).",
        ...(planRest.length ? [`Langkah lanjutan: ${planRest.map((p) => `${p.text}${p.pic ? ` (${p.pic})` : ""}`).join(" · ")}.`] : []),
        "Janjikan tanggal kabar balik ke SPG — survei yang tidak pernah dijawab balik membuat orang berhenti mengisi jujur.",
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
          <select className={inputClass} style={{ width: "auto" }} value={period} onChange={(e) => { setPeriod(e.target.value); setIdx(0); }} aria-label="Bulan yang dinilai">
            {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <Button size="sm" variant={hideNames ? "primary" : "secondary"} aria-pressed={hideNames} onClick={() => setHideNames((v) => !v)}>{hideNames ? "Nama disamarkan" : "Samarkan nama"}</Button>
          {isHr && <Button size="sm" variant={quotes ? "primary" : "secondary"} aria-pressed={quotes} onClick={() => setQuotes((v) => !v)}>{quotes ? "Kutipan tampil" : "Tampilkan kutipan"}</Button>}
          <Button size="sm" variant={notes ? "primary" : "secondary"} aria-pressed={notes} onClick={() => setNotes((v) => !v)}>Catatan pembicara</Button>
          <Button size="sm" variant="secondary" onClick={toggleFull}>{full ? "Keluar layar penuh" : "Layar penuh"}</Button>
        </div>
      </div>

      {slide && (
        <article key={slide.id} aria-live="polite" className="rounded-2xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          <header className="px-4 pb-3 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">{slide.kicker ?? KICKER[slide.group]}</p>
            <h2 className="mt-1 max-w-4xl text-2xl font-semibold leading-snug text-slate-900 dark:text-white md:text-3xl">{slide.title}</h2>
            {slide.sub && <p className="mt-1 max-w-4xl text-base text-slate-600 dark:text-slate-300">{slide.sub}</p>}
          </header>
          <div className="px-4 pb-4">{slide.body}</div>
        </article>
      )}

      {notes && slide && slide.notes.length > 0 && (
        <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30" aria-label="Catatan pembicara">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">Catatan pembicara — tidak untuk ditayangkan</p>
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
          <span className="text-[11px] text-slate-500">{at + 1} / {total} · panah kiri/kanan · N = catatan pembicara</span>
        </div>
        <Button variant="primary" onClick={() => go(at + 1)} disabled={at >= total - 1}>Berikutnya →</Button>
      </div>
    </div>
  );
}

/* ─── Potongan kecil ─── */

function FlowBox({ who, does, value }: { who: string; does: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xl font-semibold text-slate-900 dark:text-white">{who}</p>
      <p className="text-sm text-slate-500">{does}</p>
      <p className="mt-3 text-2xl font-semibold text-blue-700 dark:text-blue-300">{value}</p>
    </div>
  );
}
const Arrow = () => <div className="flex items-center justify-center text-3xl text-slate-400" aria-hidden>→</div>;

function BigStat({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className={cn("text-5xl font-semibold leading-none", muted ? "text-slate-400" : "text-slate-900 dark:text-white")}>{value}</p>
      <p className="mt-2 text-sm text-slate-500">{label}</p>
    </div>
  );
}

const OWNER_TONE: [RegExp, string][] = [
  [/manajemen/i, "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"],
  [/^hr/i, "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"],
  [/spv|koordinator/i, "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"],
];
function OwnerBadge({ owner }: { owner: string }) {
  const tone = OWNER_TONE.find(([re]) => re.test(owner))?.[1] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return <span className={cn("self-start rounded-full px-2.5 py-0.5 text-xs font-semibold", tone)}>{owner}</span>;
}

function Column({ title, tone, items }: { title: string; tone: "good" | "bad"; items: { t: string; s?: string }[] }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className={cn("text-xs font-semibold uppercase tracking-wide", tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((x, i) => <li key={i} className="text-sm leading-snug text-slate-800 dark:text-slate-100">{x.t}{x.s && <span className="block text-xs text-slate-500">{x.s}</span>}</li>)}
      </ul>
    </div>
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
