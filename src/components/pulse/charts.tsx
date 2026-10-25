"use client";

import { periodLabel } from "@/lib/rr/pulse";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const shortMonth = (p: string) => SHORT[Number(p.slice(5, 7)) - 1] ?? p;

/** Garis kecil di kartu KPI. Titik tanpa angka (periode tersembunyi) memutus garis. */
export function Sparkline({ values, className = "stroke-blue-600" }: { values: (number | null)[]; className?: string }) {
  const w = 120, h = 32;
  if (values.filter((v) => v !== null).length < 2) return null;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const y = (v: number) => h - 2 - (v / 100) * (h - 4);
  const segs: string[] = [];
  let cur = "";
  values.forEach((v, i) => {
    if (v === null) { if (cur) segs.push(cur); cur = ""; return; }
    cur += `${cur ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" aria-hidden="true">
      {segs.map((d, i) => <path key={i} d={d} fill="none" strokeWidth={2} className={className} strokeLinecap="round" strokeLinejoin="round" />)}
      {values[last] !== null && <circle cx={last * step} cy={y(values[last] as number)} r={2.5} className={className.replace("stroke-", "fill-")} />}
    </svg>
  );
}

export interface Series { label: string; values: (number | null)[]; color: string; dashed?: boolean }

/** Grafik garis 0–100% per bulan, beberapa seri sekaligus. */
export function TrendChart({ periods, series, selected, onSelect }: { periods: string[]; series: Series[]; selected?: string; onSelect?: (p: string) => void }) {
  const w = 640, h = 200, pl = 34, pr = 10, pt = 10, pb = 26;
  const iw = w - pl - pr, ih = h - pt - pb;
  const x = (i: number) => pl + (periods.length > 1 ? (i / (periods.length - 1)) * iw : iw / 2);
  const y = (v: number) => pt + ih - (v / 100) * ih;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Tren per bulan">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={pl} x2={w - pr} y1={y(g)} y2={y(g)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
            <text x={pl - 6} y={y(g) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{g}%</text>
          </g>
        ))}
        {periods.map((p, i) => (
          <g key={p} className={onSelect ? "cursor-pointer" : ""} onClick={() => onSelect?.(p)}>
            {selected === p && <rect x={x(i) - 14} y={pt} width={28} height={ih} className="fill-blue-50 dark:fill-blue-950/40" />}
            <text x={x(i)} y={h - 8} textAnchor="middle" className={selected === p ? "fill-slate-900 text-[11px] font-semibold dark:fill-white" : "fill-slate-500 text-[11px]"}>{shortMonth(p)}</text>
          </g>
        ))}
        {series.map((s) => {
          let d = "";
          s.values.forEach((v, i) => { if (v === null) return; d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; });
          return (
            <g key={s.label}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => v === null ? null : (
                <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color}><title>{`${s.label} ${periodLabel(periods[i])}: ${Math.round(v)}%`}</title></circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : undefined }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Warna sel peta panas: hijau = baik, merah = perlu perhatian (arah risiko dibalik). */
export function heatClass(pct: number | null, risk: boolean): string {
  if (pct === null) return "bg-slate-50 text-slate-400 dark:bg-slate-800/50";
  const good = risk ? 100 - pct : pct;
  if (good >= 80) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200";
  if (good >= 65) return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (good >= 50) return "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  return "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200";
}
