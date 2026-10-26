"use client";

/* Grafik tambahan untuk Mode Presentasi: dibuat besar dan terbaca dari jauh (proyektor), angka selalu tertulis,
   warna hanya membawa identitas/arah. Token warna sama dengan pustaka viz (kelas .viz). */

import { fmtPct, useTip } from "./base";

/* ─── Batang persen dengan n ─── */

export interface BarItem { key: string; label: string; sub?: string; pct: number | null; n: number; accent?: boolean }

/** Batang horizontal 0–100%. Kelompok tanpa persen (n < 3) tampil sebagai "n terlalu kecil", bukan 0. */
export function PctBars({ rows, color = "var(--v-s1)", accentColor = "var(--v-s2)", outcome }: { rows: BarItem[]; color?: string; accentColor?: string; outcome: string }) {
  const { ref, at, atEl, hide, node } = useTip();
  return (
    <div ref={ref} className="relative space-y-2.5">
      {rows.map((r) => {
        const tip = { title: r.label, rows: [{ label: outcome, value: r.pct === null ? "n terlalu kecil" : fmtPct(r.pct, 0), color: r.accent ? accentColor : color }, { label: "Jumlah SPG", value: String(r.n) }] };
        return (
          <div key={r.key} tabIndex={0} onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-800 dark:text-slate-100">{r.label}{r.sub && <span className="ml-1.5 text-xs text-slate-500">{r.sub}</span>}</span>
              <span className="text-xs tabular-nums text-slate-500">{r.n} SPG</span>
            </div>
            <div className="mt-1 flex h-6 items-center rounded" style={{ background: "var(--v-track)" }}>
              {r.pct !== null ? (
                <div className="viz-mark flex h-6 items-center justify-end rounded-r pr-2 text-xs font-semibold text-white" style={{ width: `${Math.max(8, r.pct)}%`, background: r.accent ? accentColor : color }}>{Math.round(r.pct)}%</div>
              ) : <span className="pl-2 text-xs text-slate-500">n terlalu kecil untuk persen</span>}
            </div>
          </div>
        );
      })}
      {node}
    </div>
  );
}

/* ─── Baris bertumpuk 100% (sebaran per kelompok) ─── */

export interface StackLevel { key: string; label: string; color: string; ink: string }
export interface StackRow { key: string; label: string; sub?: string; parts: Record<string, number> }

export function StackRows({ rows, levels }: { rows: StackRow[]; levels: StackLevel[] }) {
  const { ref, at, atEl, hide, node } = useTip();
  return (
    <div ref={ref} className="relative space-y-2">
      {rows.map((r) => {
        const tip = { title: r.label, sub: r.sub, rows: levels.map((l) => ({ label: l.label, value: fmtPct(r.parts[l.key] ?? 0, 0), color: l.color })) };
        return (
          <div key={r.key} className="grid grid-cols-[150px_1fr] items-center gap-3" tabIndex={0} onPointerMove={(e) => at(e, tip)} onPointerLeave={hide} onFocus={(e) => atEl(e.currentTarget, tip)} onBlur={hide}>
            <div className="min-w-0 text-sm leading-tight text-slate-800 dark:text-slate-100">{r.label}{r.sub && <span className="block text-[11px] text-slate-500">{r.sub}</span>}</div>
            <div className="flex h-7 overflow-hidden rounded" style={{ gap: 2, background: "var(--v-surface)" }}>
              {levels.map((l) => {
                const p = r.parts[l.key] ?? 0;
                if (p <= 0) return null;
                return <div key={l.key} className="viz-mark flex items-center justify-center text-[11px] font-medium" style={{ width: `${p}%`, background: l.color, color: l.ink }}>{p >= 9 ? `${Math.round(p)}%` : ""}</div>;
              })}
            </div>
          </div>
        );
      })}
      {node}
    </div>
  );
}

/* ─── Corong ─── */

export interface FunnelStep { key: string; label: string; value: number; note?: string; tone?: "base" | "good" | "warn" | "bad"; indent?: boolean }

const TONE: Record<NonNullable<FunnelStep["tone"]>, string> = { base: "var(--v-s1)", good: "var(--v-pos2)", warn: "var(--v-warn)", bad: "var(--v-neg2)" };

/** Corong horizontal: lebar batang sebanding dengan jumlah terhadap langkah pertama. Angka & persen selalu tertulis. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const base = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.key} className={s.indent ? "pl-6" : undefined}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-800 dark:text-slate-100">{s.indent ? "↳ " : ""}{s.label}</span>
            <span className="tabular-nums text-slate-900 dark:text-white"><b>{s.value}</b> <span className="text-xs text-slate-500">({Math.round((s.value / base) * 100)}%)</span></span>
          </div>
          <div className="mt-1 h-5 rounded" style={{ background: "var(--v-track)" }}>
            <div className="viz-mark h-5 rounded-r" style={{ width: `${Math.max(s.value ? 1.5 : 0, (s.value / base) * 100)}%`, background: TONE[s.tone ?? "base"] }} />
          </div>
          {s.note && <p className="mt-0.5 text-[11px] text-slate-500">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

/* ─── Peta panas sekuensial (persen) ─── */

const seq = (p: number | null): React.CSSProperties => {
  if (p === null) return { background: "var(--v-track)", color: "var(--v-muted)" };
  const step = p >= 50 ? 7 : p >= 35 ? 6 : p >= 25 ? 5 : p >= 15 ? 4 : p >= 8 ? 3 : p > 0 ? 2 : 1;
  return { background: `var(--v-seq-${step})`, color: `var(--v-ink-${step})` };
};

export function SeqHeat({ rows, cols }: { rows: { key: string; label: string; sub?: string; values: Record<string, number | null> }[]; cols: { key: string; label: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate text-xs" style={{ borderSpacing: 2 }}>
        <thead><tr className="text-slate-500">
          <th className="min-w-[110px] text-left font-medium" />
          {cols.map((c) => <th key={c.key} className="px-1 pb-1 text-center font-medium leading-tight">{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-0.5 pr-2 text-sm font-medium text-slate-800 dark:text-slate-100">{r.label}{r.sub && <span className="ml-1 text-[10px] font-normal text-slate-500">{r.sub}</span>}</td>
              {cols.map((c) => <td key={c.key} className="h-9 rounded-[4px] text-center text-sm tabular-nums" style={seq(r.values[c.key])} title={`${r.label} · ${c.label}`}>{r.values[c.key] === null ? "—" : `${Math.round(r.values[c.key] as number)}%`}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
        Lebih gelap = lebih banyak SPG di kelompok itu menyebut tema tersebut.
        {[1, 3, 5, 7].map((s) => <span key={s} style={{ width: 14, height: 10, borderRadius: 2, background: `var(--v-seq-${s})` }} />)}
        — = kurang dari 3 SPG.
      </p>
    </div>
  );
}

/* ─── Kartu temuan ringkasan eksekutif ─── */

export function FindingCard({ n, value, title, meaning, action }: { n: number; value: string; title: string; meaning: string; action: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{n}</span>
        <span className="text-3xl font-semibold leading-none text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300"><b className="font-semibold">Artinya:</b> {meaning}</p>
      <p className="mt-auto pt-2 text-xs text-slate-700 dark:text-slate-200"><span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Usulan</span> {action}</p>
    </div>
  );
}
