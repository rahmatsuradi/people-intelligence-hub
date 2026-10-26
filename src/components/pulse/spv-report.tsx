"use client";

import { Card, cn } from "@/components/app-shell";
import { periodLabel, spvScorecard, type SegmentPeriod, type Survey } from "@/lib/rr/pulse";
import { heatClass, shortMonth } from "./charts";

/** Keenam skala penilaian SPG terhadap SPV (sama dengan "AVERAGE ALL" di dashboard sheet). */
export const SPV_SCALES = ["reach", "respond", "helps", "direction", "respect", "comfort"];
const fmt = (x: number | null, d = 2) => (x === null ? "—" : x.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x)}%`);

/**
 * Rapor SPV bulanan dari Feedback SPG — pengganti tab Dashboard + Pivot Table di sheet.
 * Angkanya dari ringkasan per kelompok (SPV dengan < 3 SPG menjawab tidak ditampilkan),
 * jadi aman dilihat owner: yang dinilai SPV, nama SPG tidak pernah muncul.
 */
export function SpvReport({ survey, segments, period, roster }: { survey: Survey; segments: SegmentPeriod[]; period: string; roster: Record<string, number> }) {
  const idx = segments.findIndex((s) => s.period === period);
  const cur = segments[idx] ?? null;
  const prev = idx > 0 ? segments[idx - 1] : null;
  const rows = spvScorecard(survey, cur, prev, roster, SPV_SCALES);
  const label = (k: string) => survey.questions.find((q) => q.key === k)?.kpiLabel ?? k;
  const history = segments.slice(Math.max(0, idx - 5), idx + 1);
  const allSpv = [...new Set(history.flatMap((s) => Object.keys(s.groups)))].sort();

  if (!cur) return <Card><p className="text-sm text-slate-500">Belum ada rapor untuk siklus ini.</p></Card>;

  return (
    <div className="space-y-4">
      <Card padding={false} className="overflow-hidden">
        <div className="px-5 pt-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Rapor SPV — {periodLabel(period)}</h2>
          <p className="text-xs text-slate-500">
            Skor = rata-rata 6 penilaian SPG (skala 1–5). Persen = SPG yang memberi nilai 4–5. Diurutkan dari skor terendah.
            {cur.hidden ? ` ${cur.hidden} SPV dengan kurang dari 3 SPG menjawab tidak ditampilkan.` : ""}
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">SPV</th>
              <th className="px-3 py-2 text-right font-medium">SPG menjawab</th>
              <th className="px-3 py-2 text-right font-medium">Partisipasi</th>
              <th className="px-3 py-2 text-right font-medium">Skor</th>
              {SPV_SCALES.map((k) => <th key={k} className="px-2 py-2 text-center font-medium">{label(k)}</th>)}
              <th className="px-3 py-2 text-center font-medium">Kendala dituntaskan</th>
              <th className="px-3 py-2 text-center font-medium">Kendala belum terjawab</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const d = r.score !== null && r.scorePrev !== null ? r.score - r.scorePrev : null;
                return (
                  <tr key={r.spv} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2 font-medium">{r.spv}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.n}{r.roster ? <span className="text-slate-400"> / {r.roster}</span> : null}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", r.participation !== null && r.participation > 100 && "text-amber-600")}
                      title={r.participation !== null && r.participation > 100 ? "Lebih dari 100%: data SPG di master belum diperbarui, ada isian ganda, atau SPG area lain memilih SPV ini." : undefined}>
                      {pct(r.participation)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(r.score)}
                      {d !== null && Math.abs(d) >= 0.05 && <span className={cn("ml-1 text-[11px]", d > 0 ? "text-emerald-600" : "text-red-600")}>{d > 0 ? "▲" : "▼"}{fmt(Math.abs(d))}</span>}
                    </td>
                    {SPV_SCALES.map((k) => <td key={k} className={cn("px-2 py-2 text-center tabular-nums", heatClass(r.scales[k], false))}>{pct(r.scales[k])}</td>)}
                    <td className={cn("px-3 py-2 text-center tabular-nums", heatClass(r.followed, false))}>{pct(r.followed)}</td>
                    <td className={cn("px-3 py-2 text-center tabular-nums", heatClass(r.unresolved, true))}>{pct(r.unresolved)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-[11px] text-slate-400">
          Catatan: hampir semua SPG menjawab &ldquo;Ya&rdquo; untuk refresh SOP &amp; coaching, dan nilai 5 mendominasi. Bedakan SPV dari porsi nilai rendah dan skala terlemahnya, bukan dari rata-rata saja.
        </p>
      </Card>

      {history.length > 1 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-5 pt-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Skor SPV per bulan</h2>
            <p className="text-xs text-slate-500">Rata-rata 6 penilaian. Kosong = kurang dari 3 SPG menjawab bulan itu.</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">
                <th className="px-5 py-2 font-medium">SPV</th>
                {history.map((h) => <th key={h.period} className={cn("px-3 py-2 text-center font-medium", h.period === period && "text-slate-900 dark:text-white")}>{shortMonth(h.period)}</th>)}
              </tr></thead>
              <tbody>
                {allSpv.map((spv) => (
                  <tr key={spv} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2">{spv}</td>
                    {history.map((h, i) => {
                      const row = spvScorecard(survey, h, i > 0 ? history[i - 1] : null, roster, SPV_SCALES).find((r) => r.spv === spv);
                      return <td key={h.period} className={cn("px-3 py-2 text-center tabular-nums", heatClass(row?.score != null ? ((row.score - 1) / 4) * 100 : null, false))}>{fmt(row?.score ?? null)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
