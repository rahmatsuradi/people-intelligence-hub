"use client";

import { cn } from "@/components/app-shell";
import { periodLabel } from "@/lib/rr/pulse";
import type { ShareRow } from "@/lib/rr/pulse-viz";
import { fmtPct, useTip } from "./base";

export interface LikertLevel { value: string; color: string; ink: string; side?: "neg" | "pos" }

const SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const short = (p: string) => `${SHORT[Number(p.slice(5, 7)) - 1] ?? p} ${p.slice(2, 4)}`;

/**
 * Sebaran jawaban berskala per bulan.
 *  mode "diverging": sisi negatif ke kiri dan positif ke kanan dari garis tengah (skala Likert, mis. rasa bahagia).
 *  mode "share": 100% bertumpuk dari kiri (skala berurutan satu arah, mis. frekuensi stres; atau status).
 * Satu skala sumbu untuk semua baris supaya panjang antar-bulan bisa dibandingkan. Label hanya di segmen yang
 * cukup lebar — selebihnya dibawa tooltip dan tabel.
 */
export function LikertBars({ rows, levels, mode, selected, onSelect }: {
  rows: ShareRow[]; levels: LikertLevel[]; mode: "diverging" | "share"; selected?: string; onSelect?: (period: string) => void;
}) {
  const { ref, at, atEl, hide, node } = useTip();
  const side = (v: string) => levels.find((l) => l.value === v)?.side;
  const negOf = (r: ShareRow) => (mode === "diverging" ? r.parts.filter((p) => side(p.value) === "neg").reduce((a, p) => a + p.pct, 0) : 0);
  const posOf = (r: ShareRow) => (mode === "diverging" ? r.parts.filter((p) => side(p.value) !== "neg").reduce((a, p) => a + p.pct, 0) : 100);
  const live = rows.filter((r) => !r.suppressed);
  const maxNeg = mode === "diverging" ? Math.max(20, Math.ceil(Math.max(0, ...live.map(negOf)) / 10) * 10) : 0;
  const maxPos = mode === "diverging" ? Math.max(20, Math.ceil(Math.max(0, ...live.map(posOf)) / 10) * 10) : 100;
  const span = maxNeg + maxPos;
  const unit = 100 / span; // persen lebar track per 1% jawaban
  const center = maxNeg * unit;
  const ticks = mode === "diverging"
    ? [...Array.from({ length: Math.floor(maxNeg / 20) }, (_, i) => -(i + 1) * 20), 0, ...Array.from({ length: Math.floor(maxPos / 20) }, (_, i) => (i + 1) * 20)]
    : [0, 25, 50, 75, 100];
  const color = (v: string) => levels.find((l) => l.value === v);

  return (
    <div ref={ref} className="relative">
      <div className="space-y-1.5">
        {rows.map((r) => {
          const neg = negOf(r);
          let x = mode === "diverging" ? center - neg * unit : 0;
          // Urutan segmen mengikuti `levels` (bukan urutan opsi di definisi pertanyaan), supaya sisi negatif selalu di kiri.
          const parts = levels.map((l) => r.parts.find((p) => p.value === l.value)).filter((p): p is ShareRow["parts"][number] => !!p);
          const isSel = selected === r.period;
          const lastIdx = parts.length - 1;
          const tipOf = () => ({
            title: periodLabel(r.period), sub: `${r.n} menjawab`,
            rows: levels.slice().reverse().map((l) => r.parts.find((p) => p.value === l.value)).filter((p): p is ShareRow["parts"][number] => !!p).map((p) => ({ color: color(p.value)?.color ? `var(${varOf(color(p.value)!.color)})` : "#888", label: p.label, value: `${p.count} · ${fmtPct(p.pct)}` })),
          });
          return (
            <div key={r.period} className={cn("grid grid-cols-[52px_1fr_34px] items-center gap-2 rounded-md py-0.5", isSel && "bg-slate-50 dark:bg-slate-800/40")}>
              <button type="button" onClick={() => onSelect?.(r.period)} className={cn("text-left text-[11px]", isSel ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500")}>{short(r.period)}</button>
              {r.suppressed ? (
                <div className="flex h-[22px] items-center text-[11px] text-slate-400">kurang dari 3 jawaban</div>
              ) : (
                <div className="relative h-[22px]" tabIndex={0} role="img"
                  aria-label={`${periodLabel(r.period)}: ${r.parts.map((p) => `${p.label} ${Math.round(p.pct)}%`).join(", ")}`}
                  onPointerMove={(e) => at(e, tipOf())} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tipOf())} onBlur={hide}>
                  {parts.map((p, i) => {
                    const w = p.pct * unit;
                    const left = x;
                    x += w;
                    if (w < 0.4) return null;
                    const lv = color(p.value);
                    const first = i === 0 || parts.slice(0, i).every((q) => q.pct * unit < 0.4);
                    const lastVisible = parts.slice(i + 1).every((q) => q.pct * unit < 0.4) || i === lastIdx;
                    return (
                      <div key={p.value} className="viz-mark absolute top-0 flex h-full items-center justify-center text-[10px] font-medium"
                        style={{ left: `${left}%`, width: `calc(${w}% - 2px)`, marginLeft: 1, background: lv?.color, color: lv?.ink,
                          borderRadius: `${first ? 4 : 1}px ${lastVisible ? 4 : 1}px ${lastVisible ? 4 : 1}px ${first ? 4 : 1}px` }}>
                        {w >= 8 ? `${Math.round(p.pct)}%` : ""}
                      </div>
                    );
                  })}
                  {mode === "diverging" && <div className="pointer-events-none absolute top-[-2px] h-[26px] w-px" style={{ left: `${center}%`, background: "var(--v-ink2)", opacity: 0.55 }} />}
                </div>
              )}
              <span className="text-right text-[10px] tabular-nums text-slate-400">{r.n || ""}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-[52px_1fr_34px] gap-2">
        <span />
        <div className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${mode === "diverging" ? (center + t * unit) : t * unit}%` }}>{Math.abs(t)}%</span>
          ))}
        </div>
        <span className="text-right text-[10px] text-slate-400">n</span>
      </div>
      {node}
    </div>
  );
}

/** CSS custom property name dari `var(--v-xxx)` agar tooltip bisa memakai warna yang sama dengan segmen. */
function varOf(c: string): string {
  const m = /var\((--[\w-]+)\)/.exec(c);
  return m ? m[1] : "--v-s1";
}
