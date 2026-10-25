"use client";

import { useMemo } from "react";
import { Card } from "@/components/app-shell";
import { distribution, periodLabel, questionAverage, type PeriodSummary, type Survey, type SurveyQuestion } from "@/lib/rr/pulse";

function maxScore(q: SurveyQuestion): number | null {
  if (q.type === "scale") return q.max ?? null;
  const s = (q.options ?? []).map((o) => o.score).filter((x): x is number => typeof x === "number");
  return s.length ? Math.max(...s) : null;
}

/** Sebaran jawaban per pertanyaan untuk satu siklus — rincian di balik angka utama. */
export function Details({ survey, current }: { survey: Survey; current: PeriodSummary | undefined }) {
  const sections = useMemo(() => {
    const m = new Map<string, SurveyQuestion[]>();
    for (const q of survey.questions) {
      if (q.type === "text") continue;
      m.set(q.section ?? "Lainnya", [...(m.get(q.section ?? "Lainnya") ?? []), q]);
    }
    return [...m.entries()];
  }, [survey]);

  if (!current) return <Card><p className="text-sm text-slate-500">Belum ada jawaban untuk siklus ini.</p></Card>;
  if (current.suppressed) return <Card><p className="text-sm text-slate-500">{periodLabel(current.period)} hanya punya {current.n} jawaban — rincian disembunyikan supaya pengisinya tidak bisa ditebak.</p></Card>;

  return (
    <div className="space-y-4">
      {sections.map(([section, qs]) => (
        <Card key={section}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section}</h2>
          <div className="mt-3 grid gap-5 lg:grid-cols-2">
            {qs.map((q) => {
              const s = current.questions[q.key];
              const avg = questionAverage(q, s);
              const max = maxScore(q);
              const fav = new Set([...(q.favorable ?? []), ...(q.favorableMin !== undefined ? Array.from({ length: (q.max ?? 10) - q.favorableMin + 1 }, (_, i) => String(q.favorableMin! + i)) : [])]);
              const risk = new Set(q.risk ?? []);
              return (
                <div key={q.key}>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.label}</p>
                  <p className="text-xs text-slate-500">
                    {s ? `${s.answered} dari ${current.n} menjawab` : "Tidak ada yang menjawab"}
                    {avg.avg !== null && max !== null && ` · rata-rata ${avg.avg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} / ${max}`}
                    {q.type === "multi" && " · boleh pilih lebih dari satu"}
                    {q.showIf && " · hanya ditanyakan ke sebagian orang"}
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {distribution(q, s).map((r) => (
                      <div key={r.value} className="flex items-center gap-2 text-xs">
                        <span className="w-44 shrink-0 truncate text-slate-600 dark:text-slate-300" title={r.label}>{r.label}</span>
                        <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                          <div className={`h-2 rounded ${risk.has(r.value) ? "bg-amber-500" : fav.has(r.value) ? "bg-emerald-600" : "bg-slate-400"}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">{r.count} · {Math.round(r.pct)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
