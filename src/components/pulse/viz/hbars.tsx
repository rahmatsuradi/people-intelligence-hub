"use client";

import { fmtPct, useTip } from "./base";

export interface HBarRow { key: string; label: string; value: number; pct?: number | null; delta?: number | null; sub?: string; accent?: boolean }

/**
 * Batang horizontal untuk peringkat. Satu seri = satu warna (batang tidak diwarnai menurut nilai).
 * Tebal ≤ 16px, ujung data membulat 4px, nilai di ujung batang. Perubahan vs bulan lalu di kolom kanan —
 * panah + angka, bukan warna saja.
 */
export function HBars({ rows, max, unit, deltaSuffix = "poin" }: { rows: HBarRow[]; max?: number; unit: string; deltaSuffix?: string }) {
  const { ref, at, atEl, hide, node } = useTip();
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div ref={ref} className="relative space-y-2">
      {rows.map((r) => {
        const tip = { title: r.label, rows: [{ label: unit, value: String(r.value) }, ...(r.pct != null ? [{ label: "Persen responden", value: fmtPct(r.pct, 0) }] : []), ...(r.delta != null ? [{ label: "vs bulan lalu", value: `${r.delta > 0 ? "+" : ""}${Math.round(r.delta)} ${deltaSuffix}` }] : [])] };
        return (
          <div key={r.key} tabIndex={0} className="rounded-md py-0.5"
            onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
            <p className="text-xs leading-tight text-slate-700 dark:text-slate-200">{r.label}</p>
            <div className="mt-0.5 grid grid-cols-[1fr_52px] items-center gap-2">
              <div className="flex h-4 items-center">
                <div className="viz-mark h-4" style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%`, maxWidth: "calc(100% - 28px)", background: r.accent ? "var(--v-s2)" : "var(--v-s1)", borderRadius: "0 4px 4px 0" }} />
                <span className="ml-1.5 text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{r.value}</span>
              </div>
              <span className="text-right text-[11px] tabular-nums" style={{ color: r.delta == null || Math.abs(r.delta) < 1 ? "var(--v-muted)" : Math.abs(r.delta) >= 5 ? (r.delta > 0 ? "var(--v-bad)" : "var(--v-good)") : "var(--v-ink2)" }}>
                {r.delta == null || Math.abs(r.delta) < 1 ? "—" : `${r.delta > 0 ? "▲" : "▼"} ${Math.abs(Math.round(r.delta))}`}
              </span>
            </div>
          </div>
        );
      })}
      {node}
    </div>
  );
}

/** Kartu angka (stat tile): label, angka besar, perubahan bernama, dan garis kecil. */
export function Tile({ label, value, hint, delta, tone, spark, sub, children }: {
  label: string; value: string; hint?: string; delta?: string | null; tone?: "good" | "bad" | "flat"; spark?: React.ReactNode; sub?: string; children?: React.ReactNode;
}) {
  return (
    <div className="viz rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[32px] font-semibold leading-none text-slate-900 dark:text-white">{value}</p>
        </div>
        {spark}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {delta && (
        <p className="mt-1 text-xs font-medium" style={{ color: tone === "good" ? "var(--v-good)" : tone === "bad" ? "var(--v-bad)" : "var(--v-ink2)" }}>{delta}</p>
      )}
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
      {children}
    </div>
  );
}
