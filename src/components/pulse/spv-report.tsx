"use client";

import { cn } from "@/components/app-shell";
import { periodLabel, spvScorecard, type SegmentPeriod, type Survey } from "@/lib/rr/pulse";
import { spvSeries } from "@/lib/rr/pulse-viz";
import { CoverageCard } from "./dashboards";
import { ChartCard, Legend, VizStyle, fmtNum, fmtPct, useTip } from "./viz/base";
import { DotPlot, type DotRow } from "./viz/dot-plot";
import { SmallMultiples } from "./viz/small-multiples";
import type { PeriodSummary } from "@/lib/rr/pulse";

/** Keenam penilaian SPG terhadap SPV (sama dengan "AVERAGE ALL" di dashboard sheet). */
export const SPV_SCALES = ["reach", "respond", "helps", "direction", "respect", "comfort"];
const WINDOW = 6;

/**
 * Rapor SPV bulanan dari Feedback SPG. Angkanya dari ringkasan per kelompok (SPV dengan < 3 SPG yang menjawab
 * tidak ditampilkan), jadi aman dilihat owner: yang dinilai SPV, nama SPG tidak pernah muncul.
 * Urutan baca: siapa yang paling rendah → di skala apa → bagaimana arah 5 bulan terakhir → seberapa lengkap datanya.
 */
export function SpvReport({ survey, segments, period, roster, summary }: { survey: Survey; segments: SegmentPeriod[]; period: string; roster: Record<string, number>; summary: PeriodSummary[] }) {
  const idx = segments.findIndex((s) => s.period === period);
  const cur = segments[idx] ?? null;
  const prev = idx > 0 ? segments[idx - 1] : null;
  const rows = spvScorecard(survey, cur, prev, roster, SPV_SCALES);
  const label = (k: string) => survey.questions.find((q) => q.key === k)?.kpiLabel ?? k;
  const windowSegs = idx >= 0 ? segments.slice(Math.max(0, idx - WINDOW + 1), idx + 1) : [];
  const series = spvSeries(survey, windowSegs, SPV_SCALES);
  const periods = windowSegs.map((s) => s.period);
  const prevPeriod = prev && rows.some((r) => r.scorePrev !== null) ? prev.period : null;

  if (!cur || !rows.length) return <ChartCard title="Belum ada rapor untuk bulan ini" subtitle="Rapor muncul bila minimal 3 SPG menilai satu SPV."><span /></ChartCard>;

  const lowest = rows[0];
  const dots: DotRow[] = rows.map((r) => ({ key: r.spv, label: r.spv, sub: `${r.n} SPG`, current: r.score, previous: r.scorePrev, n: r.n,
    note: r.weakest ? `Terlemah: ${label(r.weakest.key)} (${Math.round(r.weakest.pct)}%)` : undefined }));
  let weakCell: { spv: string; scale: string; pct: number } | null = null;
  for (const r of rows) for (const k of SPV_SCALES) { const v = r.scales[k]; if (v !== null && (!weakCell || v < weakCell.pct)) weakCell = { spv: r.spv, scale: label(k), pct: v }; }

  return (
    <div className="viz space-y-4">
      <VizStyle />
      <ChartCard title={`${lowest.spv} skor terendah (${fmtNum(lowest.score)}); tertinggi ${rows.at(-1)?.spv} (${fmtNum(rows.at(-1)?.score)})`}
        subtitle={`Rata-rata 6 penilaian SPG (skala 1–5), ${periodLabel(period)}${prevPeriod ? ` dibanding ${periodLabel(prevPeriod)}` : ""}.${cur.hidden ? ` ${cur.hidden} SPV dengan kurang dari 3 SPG menjawab tidak ditampilkan.` : ""}`}
        legend={<Legend items={[{ label: periodLabel(period), color: "var(--v-s1)" }, ...(prevPeriod ? [{ label: periodLabel(prevPeriod), color: "var(--v-muted)", kind: "ring" as const }] : []), { label: "terendah", color: "var(--v-s2)" }]} />}
        table={{ head: ["SPV", "SPG menjawab", "Skor", "Bulan lalu", ...SPV_SCALES.map(label)], rows: rows.map((r) => [r.spv, r.n, fmtNum(r.score), fmtNum(r.scorePrev), ...SPV_SCALES.map((k) => fmtPct(r.scales[k], 0))]) }}>
        <DotPlot rows={dots} domain={[3.5, 5]} ticks={[3.5, 4, 4.5, 5]} currentLabel={periodLabel(period).split(" ")[0]} previousLabel={prevPeriod ? periodLabel(prevPeriod) : "Bulan lalu"} highlight={lowest.spv} />
      </ChartCard>

      <ChartCard title={weakCell ? `Titik terlemah: ${weakCell.spv} pada "${weakCell.scale}" — ${Math.round(weakCell.pct)}% SPG memberi nilai 4–5` : "Enam penilaian per SPV"}
        subtitle="Persen SPG yang memberi nilai 4–5 pada tiap penilaian. Hijau = baik, merah = perlu perhatian."
        table={{ head: ["SPV", ...SPV_SCALES.map(label), "Kendala dituntaskan", "Kendala belum terjawab"], rows: rows.map((r) => [r.spv, ...SPV_SCALES.map((k) => fmtPct(r.scales[k], 0)), fmtPct(r.followed, 0), fmtPct(r.unresolved, 0)]) }}>
        <div className="overflow-x-auto">
          <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
            <thead><tr className="text-slate-500">
              <th className="min-w-[70px] text-left font-medium">SPV</th>
              {SPV_SCALES.map((k) => <th key={k} className="px-1 pb-1 text-center font-medium leading-tight">{label(k)}</th>)}
              <th className="px-1 pb-1 text-center font-medium leading-tight">Kendala dituntaskan</th>
              <th className="px-1 pb-1 text-center font-medium leading-tight">Kendala belum terjawab</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.spv}>
                  <td className="py-0.5 font-medium">{r.spv}</td>
                  {SPV_SCALES.map((k) => <td key={k} className="h-7 rounded-[4px] text-center tabular-nums" style={cell(r.scales[k], false)}>{pct(r.scales[k])}</td>)}
                  <td className="h-7 rounded-[4px] text-center tabular-nums" style={cell(r.followed, false)}>{pct(r.followed)}</td>
                  <td className="h-7 rounded-[4px] text-center tabular-nums" style={cell(r.unresolved, true)}>{pct(r.unresolved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Hampir semua SPG menjawab &ldquo;Ya&rdquo; untuk refresh SOP &amp; coaching dan nilai 5 mendominasi. Bedakan SPV dari porsi nilai rendah dan skala terlemahnya, bukan dari rata-rata saja.</p>
      </ChartCard>

      {series.length > 0 && periods.length > 1 && (
        <ChartCard title="Arah skor tiap SPV" subtitle={`${periods.length} bulan terakhir. Semua panel memakai skala yang sama (3,5–5) supaya bisa dibandingkan. Kosong = kurang dari 3 SPG menjawab.`}
          table={{ head: ["SPV", ...periods.map((p) => periodLabel(p))], rows: series.map((s) => [s.spv, ...s.points.map((x) => fmtNum(x.score))]) }}>
          <SmallMultiples periods={periods} domain={[3.5, 5]} panels={series.map((s) => ({ key: s.spv, label: s.spv, points: s.points.map((x) => ({ period: x.period, value: x.score, n: x.n })) }))} />
        </ChartCard>
      )}

      <ChartCard title="Partisipasi SPG per SPV" subtitle="SPG yang menjawab dibanding SPG aktif di master karyawan. 0 = kurang dari 3 SPG menjawab (tidak ditampilkan di rapor) atau SPV sudah tidak ada. Lebih dari 100% = master belum diperbarui, atau SPG area lain memilih SPV ini.">
        <Participation rows={[...rows.map((r) => ({ spv: r.spv, n: r.n, roster: r.roster })), ...Object.entries(roster).filter(([k]) => !rows.some((r) => r.spv === k)).map(([spv, r]) => ({ spv, n: 0, roster: r }))]} />
      </ChartCard>
      <CoverageCard summary={summary} />
    </div>
  );
}

export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x)}%`);
/** Warna sel peta panas: 4 tingkat; arah risiko dibalik. Teks tetap token ink agar terbaca di kedua mode. */
export function cell(v: number | null, risk: boolean): React.CSSProperties {
  if (v === null) return { background: "var(--v-track)", color: "var(--v-muted)" };
  const good = risk ? 100 - v : v;
  if (good >= 90) return { background: "var(--v-pos2)", color: "#fff" };
  if (good >= 80) return { background: "var(--v-pos1)", color: "var(--v-ink)" };
  if (good >= 70) return { background: "var(--v-mid)", color: "var(--v-ink)" };
  return { background: "var(--v-neg1)", color: "var(--v-ink)" };
}

function Participation({ rows }: { rows: { spv: string; n: number; roster: number | null }[] }) {
  const { ref, at, atEl, hide, node } = useTip();
  return (
    <div ref={ref} className="relative space-y-1.5">
      {rows.map((r) => {
        const p = r.roster ? (r.n / r.roster) * 100 : null;
        const tip = { title: r.spv, rows: [{ label: "SPG menjawab", value: String(r.n) }, { label: "SPG aktif di master", value: r.roster ? String(r.roster) : "—" }, { label: "Partisipasi", value: p === null ? "—" : fmtPct(p, 0) }] };
        return (
          <div key={r.spv} className="grid grid-cols-[90px_1fr_110px] items-center gap-2 text-xs" tabIndex={0} onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
            <span className="text-slate-700 dark:text-slate-200">{r.spv}</span>
            <div className="relative h-4 rounded-sm" style={{ background: "var(--v-track)" }}>
              {p !== null && <div className="viz-mark absolute inset-y-0 left-0" style={{ width: `${Math.min(100, p)}%`, background: p > 100 ? "var(--v-s2)" : "var(--v-s1)", borderRadius: "0 4px 4px 0" }} />}
            </div>
            <span className={cn("text-right tabular-nums", p !== null && p > 100 ? "text-amber-600" : "text-slate-600 dark:text-slate-300")}>{r.n} / {r.roster ?? "—"}{p !== null ? ` · ${Math.round(p)}%` : ""}</span>
          </div>
        );
      })}
      {node}
    </div>
  );
}
