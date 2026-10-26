"use client";

import { periodLabel, type PeriodSummary, type Survey } from "@/lib/rr/pulse";
import { coverage, headlineKpis, type HeadlineKpi } from "@/lib/rr/pulse-viz";
import { Tile } from "./viz/hbars";
import { Spark } from "./viz/trend";

/** Teks perubahan bernama: "▲ 13 poin vs Agustus 2026 · memburuk". Arah baik/buruk memperhitungkan jenis indikator. */
export function deltaText(k: HeadlineKpi, prevLabel: string | null): { text: string | null; tone: "good" | "bad" | "flat" } {
  if (k.delta === null || !prevLabel) return { text: null, tone: "flat" };
  const d = Math.round(k.delta);
  if (d === 0) return { text: `■ sama seperti ${prevLabel}`, tone: "flat" };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} poin vs ${prevLabel} · ${k.better ? "membaik" : "memburuk"}`, tone: k.better ? "good" : "bad" };
}

/** Baris kartu angka: jumlah jawaban + indikator utama survei. */
export function KpiRow({ survey, summaries, period, targetCount }: { survey: Survey; summaries: PeriodSummary[]; period: string; targetCount: number | null }) {
  const idx = summaries.findIndex((p) => p.period === period);
  const cur = summaries[idx];
  if (!cur) return null;
  const prev = summaries.slice(0, idx).reverse().find((p) => !p.suppressed);
  const kpis = headlineKpis(survey, summaries, period);
  const cov = coverage([cur])[0];
  const parts = [cov.total !== cov.counted ? `${cov.total} baris masuk` : null, cov.people !== cov.counted ? `${cov.people} orang unik` : null, cov.excluded ? `${cov.excluded} dikeluarkan (isian ganda)` : null].filter(Boolean);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="Jawaban dihitung" value={`${cur.n}${targetCount ? ` / ${targetCount}` : ""}`}
        hint={targetCount ? `Partisipasi ${Math.round((cur.n / targetCount) * 100)}% · ${periodLabel(period)}` : periodLabel(period)}
        sub={parts.length ? parts.join(" · ") : undefined}
        delta={prev ? `${prev.n} jawaban di ${periodLabel(prev.period)}` : null} tone="flat" />
      {kpis.map((k, i) => {
        const d = deltaText(k, prev ? periodLabel(prev.period) : null);
        return <Tile key={k.key} label={k.label} value={k.pct === null ? "—" : `${Math.round(k.pct)}%`} hint={k.hint ? `${k.hint}${k.n ? ` · ${Math.round(((k.pct ?? 0) / 100) * k.n)} dari ${k.n}` : ""}` : undefined}
          delta={d.text} tone={d.tone} spark={<Spark values={k.series} color={k.risk ? "var(--v-s2)" : i === 0 ? "var(--v-s1)" : "var(--v-s3)"} />} />;
      })}
    </div>
  );
}
