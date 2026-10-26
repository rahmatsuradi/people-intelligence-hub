"use client";

import { useMemo, useState } from "react";
import { cn } from "@/components/app-shell";
import { kpi, kpiTrend, periodLabel, type PeriodSummary, type SegmentPeriod, type Signal, type StoredInsight, type Survey, type SurveyQuestion, type ThemePeriod } from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";
import { coverage, headlineKpis, optionShares, themeMatrix, type ShareRow } from "@/lib/rr/pulse-viz";
import { KpiRow } from "./dash-common";
import { InsightCard, SignalsCard } from "./insight-card";
import { ChartCard, Legend, VizStyle, fmtPct, type TableView } from "./viz/base";
import { GroupBars, type GroupCol, type GroupRow } from "./viz/group-bars";
import { Heatmap } from "./viz/heatmap";
import { LikertBars, type LikertLevel } from "./viz/likert-bars";
import { TrendLines, type TrendSeries } from "./viz/trend";

export interface DashProps {
  survey: Survey; summary: PeriodSummary[]; period: string; setPeriod: (p: string) => void;
  themes: ThemePeriod[]; segmentsBy: Record<string, SegmentPeriod[]>; targetCount: number | null; signals: Signal[];
  insight: StoredInsight | null; setInsight: (i: StoredInsight | null) => void; isHr: boolean;
  onAddAction: (r: InsightContent["rekomendasi"][number]) => void;
}

const SERIES = ["var(--v-s1)", "var(--v-s2)", "var(--v-s3)"];
const WINDOW = 8;

/* ─── Tingkat jawaban yang dipakai di beberapa dashboard ─── */

export const HAPPY_LEVELS: LikertLevel[] = [
  { value: "Sangat Tidak Bahagia", color: "var(--v-neg2)", ink: "#fff", side: "neg" },
  { value: "Tidak Bahagia", color: "var(--v-neg1)", ink: "var(--v-ink)", side: "neg" },
  { value: "Bahagia", color: "var(--v-pos1)", ink: "var(--v-ink)", side: "pos" },
  { value: "Sangat Bahagia", color: "var(--v-pos2)", ink: "#fff", side: "pos" },
];
export const STRESS_LEVELS: LikertLevel[] = ["Tidak sama sekali", "1x dalam 2 Minggu", "1x dalam setiap Minggu", "2 - 3x dalam seminggu", "> 3x dalam seminggu", "Setiap hari"]
  .map((value, i) => ({ value, color: `var(--v-ord-${i + 1})`, ink: `var(--v-ordink-${i + 1})` }));
export const PRIOR_LEVELS: LikertLevel[] = [
  { value: "Belum terselesaikan", color: "var(--v-neg2)", ink: "#fff", side: "neg" },
  { value: "Sebagian sudah ditindaklanjuti", color: "var(--v-pos1)", ink: "var(--v-ink)", side: "pos" },
  { value: "Ya, sudah terselesaikan", color: "var(--v-pos2)", ink: "#fff", side: "pos" },
];
export const FOLLOWED_LEVELS: LikertLevel[] = [
  { value: "Belum ada tindak lanjut", color: "var(--v-neg2)", ink: "#fff", side: "neg" },
  { value: "Ya, sedang diproses", color: "var(--v-pos1)", ink: "var(--v-ink)", side: "pos" },
  { value: "Ya, diselesaikan", color: "var(--v-pos2)", ink: "#fff", side: "pos" },
];

const q = (s: Survey, key: string) => s.questions.find((x) => x.key === key);

function likertTable(rows: ShareRow[], levels: LikertLevel[]): TableView {
  return {
    head: ["Bulan", "n", ...levels.map((l) => l.value)],
    rows: rows.map((r) => [periodLabel(r.period), r.suppressed ? "< 3" : r.n, ...levels.map((l) => (r.suppressed ? "—" : fmtPct(r.parts.find((p) => p.value === l.value)?.pct, 0)))]),
  };
}

function LikertCard({ question, levels, mode, summary, period, setPeriod, title, subtitle, legendLabels }: {
  question: SurveyQuestion; levels: LikertLevel[]; mode: "diverging" | "share"; summary: PeriodSummary[]; period: string; setPeriod: (p: string) => void;
  title: string; subtitle: string; legendLabels?: Record<string, string>;
}) {
  const idx = summary.findIndex((p) => p.period === period);
  const window = summary.slice(0, idx + 1).slice(-WINDOW);
  const rows = optionShares(question, window);
  return (
    <ChartCard title={title} subtitle={subtitle} table={likertTable(rows, levels)}
      legend={<Legend items={levels.map((l) => ({ label: legendLabels?.[l.value] ?? l.value, color: l.color }))} />}>
      <LikertBars rows={rows} levels={levels} mode={mode} selected={period} onSelect={setPeriod} />
    </ChartCard>
  );
}

function TrendCard({ survey, summary, period, setPeriod, title, subtitle }: { survey: Survey; summary: PeriodSummary[]; period: string; setPeriod: (p: string) => void; title: string; subtitle: string }) {
  const idx = summary.findIndex((p) => p.period === period);
  const window = summary.slice(0, idx + 1).slice(-WINDOW);
  const series: TrendSeries[] = survey.headline.map((k, i) => ({ key: k, q: q(survey, k) })).filter((x): x is { key: string; q: SurveyQuestion } => !!x.q && !!(x.q.favorable?.length || x.q.risk?.length || x.q.favorableMin !== undefined))
    .map((x, i) => ({ key: x.key, label: x.q.kpiLabel ?? x.q.label, color: SERIES[i % SERIES.length], values: kpiTrend(x.q, window).map((p) => p.pct) }));
  const periods = window.map((p) => p.period);
  return (
    <ChartCard title={title} subtitle={subtitle}
      table={{ head: ["Bulan", ...series.map((s) => s.label)], rows: periods.map((p, i) => [periodLabel(p), ...series.map((s) => fmtPct(s.values[i], 0))]) }}
      legend={<Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: "line" as const }))} />}>
      <TrendLines periods={periods} series={series} selected={period} onSelect={setPeriod} />
    </ChartCard>
  );
}

function ThemeCard({ survey, themes, period, setPeriod, title, subtitle, unit }: { survey: Survey; themes: ThemePeriod[]; period: string; setPeriod: (p: string) => void; title: string; subtitle: string; unit: string }) {
  const defs = survey.config.themes ?? [];
  const idx = themes.findIndex((t) => t.period === period);
  const window = themes.slice(0, idx + 1).slice(-WINDOW);
  const periods = window.map((t) => t.period);
  const rows = useMemo(() => themeMatrix(defs, window, periods), [defs, window, periods]);
  if (!defs.length || !periods.length) return null;
  const ns = Object.fromEntries(window.map((t) => [t.period, t.n]));
  return (
    <ChartCard title={title} subtitle={subtitle}>
      <Heatmap rows={rows} periods={periods} ns={ns} unit={unit} selected={period} onSelect={setPeriod} />
    </ChartCard>
  );
}

/** "Berapa sebenarnya jawabannya?" — baris masuk, dihitung, dikeluarkan, dan orang unik per bulan. */
export function CoverageCard({ summary }: { summary: PeriodSummary[] }) {
  const rows = coverage(summary).slice(-WINDOW);
  const any = rows.some((r) => r.excluded > 0 || r.total !== r.counted);
  return (
    <ChartCard title="Kelengkapan data" subtitle={any ? "Jawaban yang masuk vs yang dihitung. Isian ganda = orang yang sama di outlet yang sama pada bulan yang sama; yang terakhir dipakai." : "Jumlah jawaban per bulan."}
      table={undefined}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-500"><th className="py-1.5 font-medium">Bulan dinilai</th><th className="py-1.5 text-right font-medium">Baris masuk</th><th className="py-1.5 text-right font-medium">Dihitung</th><th className="py-1.5 text-right font-medium">Dikeluarkan</th><th className="py-1.5 text-right font-medium">Orang unik</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.period}><td className="py-1.5">{r.label}</td><td className="py-1.5 text-right tabular-nums">{r.total}</td><td className="py-1.5 text-right font-medium tabular-nums">{r.counted}</td>
                <td className={cn("py-1.5 text-right tabular-nums", r.excluded ? "text-amber-600" : "text-slate-400")}>{r.excluded || "—"}</td><td className="py-1.5 text-right tabular-nums">{r.people}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function groupCard(survey: Survey, segKey: string, segmentsBy: Record<string, SegmentPeriod[]>, summary: PeriodSummary[], period: string) {
  const seg = segmentsBy[segKey]?.find((s) => s.period === period);
  const cur = summary.find((p) => p.period === period);
  const qs = survey.headline.map((k) => q(survey, k)).filter((x): x is SurveyQuestion => !!x && !!(x.favorable?.length || x.risk?.length || x.favorableMin !== undefined));
  const cols: GroupCol[] = qs.map((x, i) => ({ key: x.key, label: x.kpiLabel ?? x.label, color: SERIES[i % SERIES.length], risk: !!x.risk?.length }));
  const overall = Object.fromEntries(qs.map((x) => [x.key, cur && !cur.suppressed ? kpi(x, cur.questions[x.key])?.pct ?? null : null]));
  const rows: GroupRow[] = Object.entries(seg?.groups ?? {}).map(([g, d]) => ({ key: g, label: g, n: d.n, values: Object.fromEntries(qs.map((x) => [x.key, kpi(x, d.questions[x.key])?.pct ?? null])) })).sort((a, b) => b.n - a.n);
  // Judul = temuan: kelompok yang paling menyimpang pada indikator risiko pertama.
  const riskCol = cols.find((c) => c.risk);
  const worst = riskCol ? rows.filter((r) => r.values[riskCol.key] != null).sort((a, b) => (b.values[riskCol.key] as number) - (a.values[riskCol.key] as number))[0] : undefined;
  const o = riskCol ? overall[riskCol.key] : null;
  const title = worst && riskCol && o != null && (worst.values[riskCol.key] as number) - o >= 10
    ? `${worst.label}: ${riskCol.label.toLowerCase()} ${Math.round(worst.values[riskCol.key] as number)}%, rata-rata ${Math.round(o)}%`
    : "Perbandingan antar-kelompok";
  return { seg, rows, cols, overall, title };
}

/* ═══ Dashboard Pulse Office ═══ */

export function PulseDashboard(p: DashProps) {
  const { survey, summary, period } = p;
  const [segKey, setSegKey] = useState(survey.segments[0] ?? "");
  const SEG: Record<string, string> = { tenure: "Lama kerja", jabatan: "Kelompok jabatan", spv: "SPV area" };
  const kpis = headlineKpis(survey, summary, period);
  const happy = kpis.find((k) => k.key === "happiness");
  const stress = kpis.find((k) => k.key === "stress_freq");
  const mon = periodLabel(period);
  const g = groupCard(survey, segKey, p.segmentsBy, summary, period);
  const hq = q(survey, "happiness"), sq = q(survey, "stress_freq");

  if (!summary.some((x) => x.period === period)) return <ChartCard title="Belum ada jawaban" subtitle="Bagikan link survei dari tab Kirim survei."><span /></ChartCard>;
  return (
    <div className="viz space-y-4">
      <VizStyle />
      <KpiRow survey={survey} summaries={summary} period={period} targetCount={p.targetCount} />
      <SignalsCard signals={p.signals} />
      <div className="grid gap-4 lg:grid-cols-2">
        {hq && <LikertCard question={hq} levels={HAPPY_LEVELS} mode="diverging" summary={summary} period={period} setPeriod={p.setPeriod}
          title={happy?.pct != null ? `Rasa bahagia: ${Math.round(happy.pct)}% bahagia di ${mon}${happy.delta != null && Math.round(happy.delta) !== 0 ? `, ${happy.delta > 0 ? "naik" : "turun"} ${Math.abs(Math.round(happy.delta))} poin` : ""}` : "Rasa bahagia per bulan"}
          subtitle="Sebaran jawaban tiap bulan: tidak bahagia ke kiri, bahagia ke kanan. Klik bulan untuk berpindah." />}
        {sq && <LikertCard question={sq} levels={STRESS_LEVELS} mode="share" summary={summary} period={period} setPeriod={p.setPeriod}
          title={stress?.pct != null ? `Stres: ${Math.round(stress.pct)}% merasa stres 2x seminggu atau lebih${stress.delta != null && Math.round(stress.delta) !== 0 ? `, ${stress.delta > 0 ? "naik" : "turun"} ${Math.abs(Math.round(stress.delta))} poin` : ""}` : "Frekuensi stres per bulan"}
          subtitle="Seberapa sering merasa stres sebulan terakhir. Makin gelap/terang makin sering." />}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2"><TrendCard survey={survey} summary={summary} period={period} setPeriod={p.setPeriod} title="Tiga indikator utama dari bulan ke bulan" subtitle="Persen karyawan per bulan. Stres & butuh dukungan: makin rendah makin baik." /></div>
        <ChartCard className="lg:col-span-3" title={g.title} subtitle={`Perbandingan per ${SEG[segKey]?.toLowerCase() ?? segKey} di ${mon}. Kelompok kurang dari 3 orang tidak ditampilkan${g.seg?.hidden ? ` (${g.seg.hidden} disembunyikan)` : ""}.`}
          actions={survey.segments.length > 1 ? (
            <select className="rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-[11px] dark:border-slate-700" value={segKey} onChange={(e) => setSegKey(e.target.value)} aria-label="Kelompokkan menurut">
              {survey.segments.map((k) => <option key={k} value={k}>{SEG[k] ?? k}</option>)}
            </select>) : undefined}
          table={{ head: ["Kelompok", "n", ...g.cols.map((c) => c.label)], rows: g.rows.map((r) => [r.label, r.n, ...g.cols.map((c) => fmtPct(r.values[c.key], 0))]) }}>
          {g.rows.length ? <GroupBars rows={g.rows} cols={g.cols} overall={g.overall} /> : <p className="text-sm text-slate-500">Belum ada kelompok dengan 3 orang atau lebih.</p>}
        </ChartCard>
      </div>
      <ThemeCard survey={survey} themes={p.themes} period={period} setPeriod={p.setPeriod} unit="orang" title="Keluhan & usulan yang paling sering disebut" subtitle="Jumlah karyawan yang menyebut tiap tema di komentar bebas (dihitung dari kata kunci, bukan penilaian AI). Warna = persen dari responden bulan itu." />
      <InsightCard survey={survey} period={period} n={summary.find((x) => x.period === period)?.n ?? 0} insight={p.insight} setInsight={p.setInsight} isHr={p.isHr} onAddAction={p.onAddAction} />
      <CoverageCard summary={summary} />
    </div>
  );
}

/* ═══ Dashboard SPG → SPV ═══ */

export function SpgDashboard(p: DashProps) {
  const { survey, summary, period } = p;
  const mon = periodLabel(period);
  const cur = summary.find((x) => x.period === period);
  const prior = q(survey, "prior_status"), followed = q(survey, "followed");
  const priorK = prior && cur && !cur.suppressed ? cur.questions[prior.key] : undefined;
  const belum = priorK ? ((priorK.counts["Belum terselesaikan"] ?? 0) / Math.max(1, priorK.answered)) * 100 : null;
  const tuntas = followed && cur && !cur.suppressed ? kpi(followed, cur.questions[followed.key]) : null;

  if (!cur) return <ChartCard title="Belum ada jawaban" subtitle="Bagikan link survei dari tab Kirim survei."><span /></ChartCard>;
  return (
    <div className="viz space-y-4">
      <VizStyle />
      <KpiRow survey={survey} summaries={summary} period={period} targetCount={p.targetCount} />
      <SignalsCard signals={p.signals} />
      <div className="grid gap-4 lg:grid-cols-2">
        {prior && <LikertCard question={prior} levels={PRIOR_LEVELS} mode="diverging" summary={summary} period={period} setPeriod={p.setPeriod}
          title={belum != null ? `Isu lama: ${Math.round(belum)}% SPG bilang belum terselesaikan di ${mon}` : "Isu lama yang pernah disampaikan"}
          subtitle="Dari SPG yang pernah memberi masukan: apakah sudah ditindaklanjuti? Merah ke kiri = belum terselesaikan." />}
        {followed && <LikertCard question={followed} levels={FOLLOWED_LEVELS} mode="diverging" summary={summary} period={period} setPeriod={p.setPeriod}
          title={tuntas?.pct != null ? `Kendala yang dilaporkan ke SPV: ${Math.round(tuntas.pct)}% diselesaikan di ${mon}` : "Kendala yang dilaporkan ke SPV"}
          subtitle="Dari SPG yang melapor kendala sebulan terakhir. Merah ke kiri = belum ada tindak lanjut." />}
      </div>
      <TrendCard survey={survey} summary={summary} period={period} setPeriod={p.setPeriod} title="Indikator utama dari bulan ke bulan" subtitle="Persen SPG per bulan. Klik titik atau bulan untuk berpindah." />
      <ThemeCard survey={survey} themes={p.themes} period={period} setPeriod={p.setPeriod} unit="SPG" title="Keluhan & usulan SPG yang paling sering disebut" subtitle="Jumlah SPG yang menyebut tiap tema di komentar bebas (dihitung dari kata kunci). Warna = persen dari SPG yang menjawab bulan itu." />
      <InsightCard survey={survey} period={period} n={cur.n} insight={p.insight} setInsight={p.setInsight} isHr={p.isHr} onAddAction={p.onAddAction} />
      <CoverageCard summary={summary} />
    </div>
  );
}
