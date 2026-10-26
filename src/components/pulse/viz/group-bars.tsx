"use client";

import { cn } from "@/components/app-shell";
import { fmtPct, useTip } from "./base";

export interface GroupCol { key: string; label: string; color: string; risk?: boolean }
export interface GroupRow { key: string; label: string; n: number; values: Record<string, number | null> }

/**
 * Perbandingan antar-kelompok untuk beberapa indikator sekaligus: satu baris per kelompok, satu lajur
 * batang (0–100%) per indikator. Garis tipis menandai rata-rata seluruh responden sehingga yang
 * menyimpang langsung terlihat. Kelompok kecil (< 3 orang) sudah dibuang oleh database sebelum sampai sini.
 */
export function GroupBars({ rows, cols, overall }: { rows: GroupRow[]; cols: GroupCol[]; overall: Record<string, number | null> }) {
  const { ref, at, atEl, hide, node } = useTip();
  const tpl = `minmax(86px,1fr) 28px repeat(${cols.length}, minmax(76px,1fr))`;
  return (
    <div ref={ref} className="relative overflow-x-auto text-xs">
      <div className="grid items-end gap-x-3 pb-1 text-[11px] text-slate-500" style={{ gridTemplateColumns: tpl }}>
        <span /><span className="text-right text-[10px] text-slate-400">n</span>
        {cols.map((c) => <span key={c.key} className="flex items-center gap-1.5 leading-tight"><span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flex: "none" }} />{c.label}</span>)}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="grid items-center gap-x-3" style={{ gridTemplateColumns: tpl }}>
            <span className="truncate text-slate-700 dark:text-slate-200" title={r.label}>{r.label}</span>
            <span className="text-right tabular-nums text-slate-400">{r.n}</span>
            {cols.map((c) => {
              const v = r.values[c.key];
              const o = overall[c.key];
              const tip = { title: `${r.label} · ${c.label}`, sub: `${r.n} orang`, rows: [{ label: "Kelompok ini", value: fmtPct(v, 0), color: c.color }, { label: "Semua responden", value: fmtPct(o, 0), color: "var(--v-muted)" }] };
              return (
                <div key={c.key} className="relative flex h-5 items-center" tabIndex={0} role="img" aria-label={`${r.label} ${c.label}: ${fmtPct(v, 0)}`}
                  onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
                  <div className="absolute inset-y-0 left-0 right-7 rounded-sm" style={{ background: "var(--v-track)" }} />
                  {v !== null && <div className="viz-mark relative h-3.5" style={{ width: `calc((100% - 28px) * ${v / 100})`, minWidth: v > 0 ? 3 : 0, background: c.color, borderRadius: "0 4px 4px 0" }} />}
                  {o !== null && <div className="absolute inset-y-0 w-px" style={{ left: `calc((100% - 28px) * ${o / 100})`, background: "var(--v-ink2)", opacity: 0.55 }} />}
                  <span className={cn("absolute right-0 w-7 text-right tabular-nums", v === null ? "text-slate-400" : "font-semibold text-slate-900 dark:text-white")}>{v === null ? "—" : Math.round(v)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Garis tipis = rata-rata semua responden. Angka = persen.</p>
      {node}
    </div>
  );
}
