"use client";

import { useState } from "react";
import { periodLabel } from "@/lib/rr/pulse";
import { fmtPct, useTip } from "./base";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const short = (p: string) => SHORT[Number(p.slice(5, 7)) - 1] ?? p;

export interface TrendSeries { key: string; label: string; color: string; values: (number | null)[] }

/**
 * Garis tren per bulan (persen). Warna mengikuti entitas (urutan tetap, tidak ikut peringkat). Crosshair
 * menempel ke bulan terdekat, tooltip memuat SEMUA seri di bulan itu, klik memilih bulan. Label ujung hanya
 * dipasang bila tidak bertabrakan; selebihnya legenda + tooltip yang membawa.
 */
export function TrendLines({ periods, series, selected, onSelect, domain = [0, 100] }: {
  periods: string[]; series: TrendSeries[]; selected?: string; onSelect?: (p: string) => void; domain?: [number, number];
}) {
  const w = 640, h = 210, pl = 34, pr = 40, pt = 12, pb = 26;
  const iw = w - pl - pr, ih = h - pt - pb;
  const [lo, hi] = domain;
  const x = (i: number) => pl + (periods.length > 1 ? (i / (periods.length - 1)) * iw : iw / 2);
  const y = (v: number) => pt + ih - ((v - lo) / (hi - lo)) * ih;
  const [hover, setHover] = useState<number | null>(null);
  const { ref, at, hide, node } = useTip();
  const ticks = [lo, lo + (hi - lo) / 4, lo + (hi - lo) / 2, lo + ((hi - lo) * 3) / 4, hi];

  // Label ujung: urut dari atas, lewati yang kurang dari 14px dari label sebelumnya.
  const ends = series.map((s) => {
    const i = s.values.map((v, k) => (v !== null ? k : -1)).filter((k) => k >= 0).at(-1) ?? -1;
    return { s, i, v: i >= 0 ? (s.values[i] as number) : null };
  }).filter((e) => e.v !== null).sort((a, b) => (b.v as number) - (a.v as number));
  const shownEnds: typeof ends = [];
  for (const e of ends) if (!shownEnds.some((o) => Math.abs(y(o.v as number) - y(e.v as number)) < 14)) shownEnds.push(e);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`Tren per bulan: ${series.map((s) => s.label).join(", ")}`}
        onPointerLeave={() => { setHover(null); hide(); }}
        onClick={() => hover !== null && onSelect?.(periods[hover])}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * w;
          let best = 0;
          periods.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHover(best);
          at(e, { title: periodLabel(periods[best]), rows: series.map((s) => ({ color: s.color, label: s.label, value: fmtPct(s.values[best], 0) })) });
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={w - pr} y1={y(t)} y2={y(t)} stroke="var(--v-grid)" strokeWidth={1} />
            <text x={pl - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--v-muted)">{Math.round(t)}%</text>
          </g>
        ))}
        {selected && periods.includes(selected) && <rect x={x(periods.indexOf(selected)) - 14} y={pt} width={28} height={ih} fill="var(--v-track)" opacity={0.7} />}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={pt + ih} stroke="var(--v-axis)" strokeWidth={1} />}
        {periods.map((p, i) => (
          <text key={p} x={x(i)} y={h - 8} textAnchor="middle" fontSize={11} fill={selected === p ? "var(--v-ink)" : "var(--v-muted)"} fontWeight={selected === p ? 600 : 400}>{short(p)}</text>
        ))}
        {series.map((s) => {
          let d = "";
          s.values.forEach((v, i) => { if (v !== null) d += `${d && s.values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
          const lastI = s.values.map((v, k) => (v !== null ? k : -1)).filter((k) => k >= 0).at(-1);
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) => v !== null && (i === hover || i === lastI) && (
                <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="var(--v-surface)" strokeWidth={2} />
              ))}
            </g>
          );
        })}
        {shownEnds.map((e) => (
          <text key={e.s.key} x={x(e.i) + 9} y={y(e.v as number) + 4} fontSize={11} fontWeight={600} fill="var(--v-ink)">{Math.round(e.v as number)}%</text>
        ))}
      </svg>
      {node}
    </div>
  );
}

/** Garis kecil pada kartu angka. Bulan tanpa data memutus garis. */
export function Spark({ values, color = "var(--v-s1)" }: { values: (number | null)[]; color?: string }) {
  const w = 120, h = 34;
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" aria-hidden />;
  const lo = Math.min(...real), hi = Math.max(...real);
  const pad = Math.max(8, (hi - lo) * 0.25);
  const y = (v: number) => h - 4 - ((v - (lo - pad / 2)) / (hi - lo + pad)) * (h - 8);
  const step = w / (values.length - 1);
  let d = "";
  values.forEach((v, i) => { if (v !== null) d += `${d && values[i - 1] !== null ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`; });
  const last = values.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).at(-1) as number;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" aria-hidden>
      <path d={d} fill="none" stroke="var(--v-axis)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last * step} cy={y(values[last] as number)} r={4} fill={color} stroke="var(--v-surface)" strokeWidth={2} />
    </svg>
  );
}
