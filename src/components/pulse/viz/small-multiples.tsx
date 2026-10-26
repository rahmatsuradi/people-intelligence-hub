"use client";

import { useState } from "react";
import { periodLabel } from "@/lib/rr/pulse";
import { fmtNum, useTip } from "./base";

export interface SparkPanel { key: string; label: string; points: { period: string; value: number | null; n: number }[] }

const SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const short = (p: string) => SHORT[Number(p.slice(5, 7)) - 1] ?? p;

/**
 * Small multiples: satu panel per entitas, SATU skala Y yang sama di semua panel supaya bisa dibandingkan
 * (bukan tiap panel menyesuaikan diri). Titik tanpa data memutus garis — tidak ditarik ke nol.
 */
export function SmallMultiples({ panels, domain, decimals = 2, periods }: { panels: SparkPanel[]; domain: [number, number]; decimals?: number; periods: string[] }) {
  const w = 190, h = 62, pl = 6, pr = 34, pt = 8, pb = 16;
  const [lo, hi] = domain;
  const x = (i: number) => pl + (periods.length > 1 ? (i / (periods.length - 1)) * (w - pl - pr) : (w - pl - pr) / 2);
  const y = (v: number) => pt + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - pt - pb);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((p) => <Panel key={p.key} p={p} periods={periods} x={x} y={y} w={w} h={h} pb={pb} pt={pt} domain={domain} decimals={decimals} />)}
    </div>
  );
}

function Panel({ p, periods, x, y, w, h, pb, pt, domain, decimals }: {
  p: SparkPanel; periods: string[]; x: (i: number) => number; y: (v: number) => number; w: number; h: number; pb: number; pt: number; domain: [number, number]; decimals: number;
}) {
  const { ref, at, hide, node } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const byPeriod = new Map(p.points.map((q) => [q.period, q]));
  const vals = periods.map((per) => byPeriod.get(per)?.value ?? null);
  let d = "";
  vals.forEach((v, i) => { if (v !== null) d += `${d && vals[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
  const lastIdx = vals.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).at(-1) ?? -1;
  const prevIdx = vals.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).at(-2) ?? -1;
  const delta = lastIdx >= 0 && prevIdx >= 0 ? (vals[lastIdx] as number) - (vals[prevIdx] as number) : null;
  const mid = (domain[0] + domain[1]) / 2;

  return (
    <div ref={ref} className="relative rounded-lg border border-slate-200/70 p-2 dark:border-slate-800">
      <div className="flex items-baseline justify-between px-1">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{p.label}</span>
        {delta !== null && Math.abs(delta) >= 0.05 && <span className="text-[11px] tabular-nums" style={{ color: delta > 0 ? "var(--v-good)" : "var(--v-bad)" }}>{delta > 0 ? "▲" : "▼"} {fmtNum(Math.abs(delta), decimals)}</span>}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${p.label}: ${vals.map((v, i) => `${short(periods[i])} ${v === null ? "tidak ada data" : fmtNum(v, decimals)}`).join(", ")}`}
        onPointerLeave={() => { setHover(null); hide(); }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          let best = 0;
          periods.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHover(best);
          const q = byPeriod.get(periods[best]);
          at(e, { title: p.label, sub: periodLabel(periods[best]), rows: [{ color: "var(--v-s1)", label: q?.value == null ? "Data" : `${q.n} SPG`, value: q?.value == null ? "kurang dari 3" : fmtNum(q.value, decimals) }] });
        }}>
        <line x1={0} x2={w} y1={y(mid)} y2={y(mid)} stroke="var(--v-grid)" strokeWidth={1} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pt - 2} y2={h - pb} stroke="var(--v-axis)" strokeWidth={1} />}
        <path d={d} fill="none" stroke="var(--v-s1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {vals.map((v, i) => v === null ? null : (i === lastIdx || i === hover) && (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--v-s1)" stroke="var(--v-surface)" strokeWidth={2} />
        ))}
        {lastIdx >= 0 && <text x={x(lastIdx) + 8} y={y(vals[lastIdx] as number) + 4} fontSize={11} fontWeight={600} fill="var(--v-ink)">{fmtNum(vals[lastIdx], decimals)}</text>}
        {periods.map((per, i) => (i === 0 || i === periods.length - 1) && <text key={per} x={x(i)} y={h - 3} textAnchor={i === 0 ? "start" : "end"} fontSize={9} fill="var(--v-muted)">{short(per)}</text>)}
      </svg>
      {node}
    </div>
  );
}
