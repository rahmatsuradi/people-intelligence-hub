"use client";

import { periodLabel } from "@/lib/rr/pulse";
import { fmtNum, useTip } from "./base";

export interface DotRow { key: string; label: string; sub?: string; current: number | null; previous: number | null; n: number; note?: string }

/**
 * Dot plot / dumbbell: titik terisi = bulan ini, cincin = bulan lalu, garis penghubung = perubahan.
 * Dipilih (bukan batang) karena skornya bergerak di rentang sempit (3,5–5): batang yang dipotong dari
 * nol menyesatkan, sedangkan dot plot sah memakai sumbu yang tidak dimulai dari nol. Nilai terbaru ada
 * di kolom kanan (kolom angka, bukan label per titik).
 */
export function DotPlot({ rows, domain, ticks, currentLabel, previousLabel, highlight }: {
  rows: DotRow[]; domain: [number, number]; ticks: number[]; currentLabel: string; previousLabel: string; highlight?: string;
}) {
  const { ref, at, atEl, hide, node } = useTip();
  const [lo, hi] = domain;
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100;
  const rowH = 30;

  return (
    <div ref={ref} className="relative">
      <div className="grid grid-cols-[110px_1fr_92px] items-end gap-2 pb-1 text-[10px] text-slate-400">
        <span />
        <div className="relative h-4">{ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>{fmtNum(t, 1)}</span>)}</div>
        <span className="text-right">{currentLabel} · Δ</span>
      </div>
      <div>
        {rows.map((r) => {
          const d = r.current !== null && r.previous !== null ? r.current - r.previous : null;
          const tip = { title: r.label, sub: `${r.n} SPG menjawab`, rows: [
            { color: "var(--v-s1)", label: currentLabel, value: fmtNum(r.current) },
            ...(r.previous !== null ? [{ color: "var(--v-muted)", label: previousLabel, value: fmtNum(r.previous), ring: true }] : []),
            ...(d !== null ? [{ label: "Selisih", value: `${d > 0 ? "+" : ""}${fmtNum(d)}` }] : []),
            ...(r.note ? [{ label: r.note, value: "" }] : []),
          ] };
          return (
            <div key={r.key} className="grid grid-cols-[110px_1fr_92px] items-center gap-2" style={{ height: rowH }}>
              <div className="min-w-0 truncate text-xs text-slate-700 dark:text-slate-200">{r.label}{r.sub && <span className="ml-1 text-[10px] text-slate-400">{r.sub}</span>}</div>
              <div className="relative h-full" tabIndex={0} role="img" aria-label={`${r.label}: ${fmtNum(r.current)}, bulan lalu ${fmtNum(r.previous)}`}
                onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
                {ticks.map((t) => <div key={t} className="absolute top-0 h-full w-px" style={{ left: `${x(t)}%`, background: "var(--v-grid)" }} />)}
                {r.current !== null && r.previous !== null && (
                  <div className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: `${Math.min(x(r.current), x(r.previous))}%`, width: `${Math.abs(x(r.current) - x(r.previous))}%`, background: "var(--v-axis)" }} />
                )}
                {r.previous !== null && (
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x(r.previous)}%`, width: 10, height: 10, border: "2px solid var(--v-muted)", background: "var(--v-surface)" }} />
                )}
                {r.current !== null && (
                  <div className="viz-mark absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x(r.current)}%`, width: 12, height: 12, background: r.key === highlight ? "var(--v-s2)" : "var(--v-s1)", boxShadow: "0 0 0 2px var(--v-surface)" }} />
                )}
              </div>
              <div className="text-right text-xs tabular-nums">
                <b className="font-semibold text-slate-900 dark:text-white">{fmtNum(r.current)}</b>
                {d !== null && Math.abs(d) >= 0.05 && <span className="ml-1.5" style={{ color: d > 0 ? "var(--v-good)" : "var(--v-bad)" }}>{d > 0 ? "▲" : "▼"}{fmtNum(Math.abs(d))}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {node}
    </div>
  );
}

export function dotCaption(period: string, previous: string | null) {
  return `${periodLabel(period)}${previous ? ` dibanding ${periodLabel(previous)}` : ""}`;
}
