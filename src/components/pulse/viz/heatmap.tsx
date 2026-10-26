"use client";

import { cn } from "@/components/app-shell";
import { periodLabel } from "@/lib/rr/pulse";
import type { ThemeRow } from "@/lib/rr/pulse-viz";
import { fmtPct, useTip } from "./base";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const short = (p: string) => SHORT[Number(p.slice(5, 7)) - 1] ?? p;
// Ramp sekuensial satu hue; sel terendah hampir menyatu dengan permukaan, tertinggi paling gelap/terang.
const STEPS = [1, 2, 3, 4, 5, 6, 7].map((i) => `var(--v-seq-${i})`);

/**
 * Peta tema × bulan. Angka di sel = jumlah ORANG yang menyebut tema itu; intensitas warna = persen dari
 * responden bulan itu (n tiap bulan berbeda). Kolom bulan terpilih diberi bingkai; klik kepala kolom untuk berpindah.
 */
export function Heatmap({ rows, periods, ns, unit, selected, onSelect, limit }: {
  rows: ThemeRow[]; periods: string[]; ns: Record<string, number>; unit: string; selected?: string; onSelect?: (p: string) => void; limit?: number;
}) {
  const { ref, at, atEl, hide, node } = useTip();
  const shown = limit ? rows.slice(0, limit) : rows;
  const maxPct = Math.max(10, ...shown.flatMap((r) => r.cells.map((c) => c.pct ?? 0)));
  const step = (pct: number) => Math.min(6, Math.floor((pct / maxPct) * 7));

  return (
    <div ref={ref} className="relative overflow-x-auto">
      <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="min-w-[190px] pb-1 text-left font-medium text-slate-500">Tema</th>
            {periods.map((p) => (
              <th key={p} className="pb-1 text-center font-medium">
                <button type="button" onClick={() => onSelect?.(p)} className={cn("w-full leading-tight", selected === p ? "text-slate-900 dark:text-white" : "text-slate-500")}>
                  <span className={selected === p ? "font-semibold" : ""}>{short(p)}</span>
                  <span className="block text-[10px] font-normal text-slate-400">n={ns[p] ?? "—"}</span>
                </button>
              </th>
            ))}
            <th className="min-w-[78px] pb-1 text-right font-medium text-slate-500">vs bulan lalu</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const d = r.deltaPct;
            return (
              <tr key={r.key}>
                <td className="py-0.5 pr-2 text-slate-700 dark:text-slate-200">{r.label}</td>
                {r.cells.map((c) => {
                  const s = c.pct === null ? -1 : step(c.pct);
                  const tip = { title: `${r.label}`, sub: `${periodLabel(c.period)} · ${unit}`, rows: c.count === null ? [{ label: "Data", value: "kurang dari 3 jawaban" }] : [{ label: "Menyebut", value: `${c.count} dari ${c.n}` }, { label: "Persen", value: fmtPct(c.pct, 0) }] };
                  return (
                    <td key={c.period} tabIndex={0} aria-label={`${r.label} ${periodLabel(c.period)}: ${c.count ?? "tidak ada data"}`}
                      onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}
                      className={cn("viz-mark h-7 min-w-[34px] rounded-[4px] text-center tabular-nums", selected === c.period && "outline outline-1 outline-offset-1 outline-slate-400")}
                      style={s < 0 ? { background: "var(--v-track)", color: "var(--v-muted)" } : { background: STEPS[s], color: `var(--v-ink-${s + 1})` }}>
                      {c.count === null ? "·" : c.count}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap pl-2 text-right tabular-nums">
                  {d === null || Math.abs(d) < 1 ? <span className="text-slate-400">—</span> : (
                    <span style={{ color: Math.abs(d) >= 5 ? (d > 0 ? "var(--v-bad)" : "var(--v-good)") : "var(--v-ink2)" }}>
                      {d > 0 ? "▲" : "▼"} {Math.abs(Math.round(d))} poin
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
        <span>sedikit</span>
        <span className="flex gap-0.5">{STEPS.map((c, i) => <span key={i} style={{ width: 18, height: 8, borderRadius: 2, background: c }} />)}</span>
        <span>banyak (persen dari responden bulan itu, maks {Math.round(maxPct)}%)</span>
        <span className="ml-auto">· = kurang dari 3 jawaban</span>
      </div>
      {node}
    </div>
  );
}
