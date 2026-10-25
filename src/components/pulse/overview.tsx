"use client";

import { useState } from "react";
import { Button, Card, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import {
  hasKpi, kpi, kpiBetter, kpiTrend, periodLabel, requestInsight, shareInsight,
  type PeriodSummary, type SegmentPeriod, type Signal, type StoredInsight, type Survey, type SurveyQuestion,
} from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";
import { Sparkline, TrendChart, heatClass } from "./charts";

const SERIES_COLORS = ["#c8102e", "#d97706", "#2563eb", "#059669"];
const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x)}%`);

export function kpiQuestions(survey: Survey): SurveyQuestion[] {
  return survey.headline.map((k) => survey.questions.find((q) => q.key === k)).filter((q): q is SurveyQuestion => !!q && hasKpi(q));
}

export function Overview(props: {
  survey: Survey; summary: PeriodSummary[]; period: string; setPeriod: (p: string) => void;
  signals: Signal[]; segments: SegmentPeriod | null; segmentLabel: string; targetCount: number | null;
  insight: StoredInsight | null; setInsight: (i: StoredInsight | null) => void; isHr: boolean;
  onAddAction: (r: InsightContent["rekomendasi"][number]) => void;
}) {
  const { survey, summary, period, setPeriod, signals, segments, segmentLabel, targetCount, insight, isHr } = props;
  const qs = kpiQuestions(survey);
  const idx = summary.findIndex((p) => p.period === period);
  const cur = summary[idx];
  const prev = summary.slice(0, Math.max(0, idx)).reverse().find((p) => !p.suppressed);
  const visible = summary.slice(0, idx + 1).slice(-8);

  if (!cur) return <Card><p className="text-sm text-slate-500">Belum ada jawaban untuk siklus ini. Bagikan link survei dari tab &ldquo;Kirim survei&rdquo;.</p></Card>;

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3", qs.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        <Card>
          <p className="text-xs font-medium text-slate-500">Responden</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{cur.n}{targetCount ? <span className="text-base font-normal text-slate-400"> / {targetCount}</span> : null}</p>
          <p className="mt-0.5 text-xs text-slate-500">{targetCount ? `Partisipasi ${pct((cur.n / targetCount) * 100)}` : "Target belum diisi"} · {periodLabel(cur.period)}</p>
          {prev && <p className="mt-1 text-xs text-slate-400">{prev.n} orang di {periodLabel(prev.period)}</p>}
        </Card>
        {qs.map((q, i) => {
          const k = cur.suppressed ? null : kpi(q, cur.questions[q.key]);
          const kp = prev ? kpi(q, prev.questions[q.key]) : null;
          const d = k?.pct != null && kp?.pct != null ? k.pct - kp.pct : null;
          const better = d !== null ? kpiBetter(q, d) : null;
          const risk = k?.kind === "risk";
          return (
            <Card key={q.key}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-500">{q.kpiLabel ?? q.label}</p>
                  <p className={cn("mt-1 text-3xl font-semibold tabular-nums", risk ? "text-amber-600" : "text-slate-900 dark:text-white")}>{pct(k?.pct)}</p>
                </div>
                <Sparkline values={kpiTrend(q, visible).map((p) => p.pct)} className={risk ? "stroke-amber-500" : i === 0 ? "stroke-blue-600" : "stroke-slate-500"} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{q.kpiHint}{k ? ` · ${k.hits} dari ${k.n}` : ""}</p>
              {d !== null && Math.round(d) !== 0 && (
                <p className={cn("mt-1 text-xs font-medium", better ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
                  {d > 0 ? "▲" : "▼"} {Math.round(Math.abs(d))} poin vs {periodLabel(prev!.period)} · {better ? "membaik" : "memburuk"}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {signals.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Perlu diperhatikan</h2>
          <ul className="mt-2 space-y-2">
            {signals.map((s) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.severity === "tinggi" ? "bg-red-500" : s.severity === "sedang" ? "bg-amber-500" : "bg-slate-400")} />
                <div><p className="font-medium text-slate-900 dark:text-white">{s.title}</p><p className="text-xs text-slate-500">{s.detail}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <InsightCard {...props} />

      {qs.length > 0 && visible.length > 1 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Tren per bulan</h2>
          <p className="text-xs text-slate-500">Bulan yang dinilai. Klik bulan untuk membuka siklusnya.</p>
          <div className="mt-3">
            <TrendChart periods={visible.map((p) => p.period)} selected={period} onSelect={setPeriod}
              series={qs.map((q, i) => ({ label: q.kpiLabel ?? q.label, values: kpiTrend(q, visible).map((p) => p.pct), color: SERIES_COLORS[i % SERIES_COLORS.length], dashed: !!q.risk?.length }))} />
          </div>
        </Card>
      )}

      {segments && Object.keys(segments.groups).length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-5 pt-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Per {segmentLabel.toLowerCase()}</h2>
            <p className="text-xs text-slate-500">Hijau = baik, merah = perlu perhatian. Kelompok kurang dari 3 orang tidak ditampilkan{segments.hidden ? ` (${segments.hidden} kelompok disembunyikan)` : ""}.</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">
                <th className="px-5 py-2 font-medium">{segmentLabel}</th><th className="px-3 py-2 text-right font-medium">Orang</th>
                {qs.map((q) => <th key={q.key} className="px-3 py-2 text-center font-medium">{q.kpiLabel ?? q.label}</th>)}
              </tr></thead>
              <tbody>
                <tr className="border-t border-slate-100 font-medium dark:border-slate-800">
                  <td className="px-5 py-2">Semua</td><td className="px-3 py-2 text-right tabular-nums">{cur.n}</td>
                  {qs.map((q) => { const k = kpi(q, cur.questions[q.key]); return <td key={q.key} className="px-3 py-2 text-center tabular-nums">{pct(k?.pct)}</td>; })}
                </tr>
                {Object.entries(segments.groups).sort((a, b) => b[1].n - a[1].n).map(([g, d]) => (
                  <tr key={g} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2">{g}</td><td className="px-3 py-2 text-right tabular-nums">{d.n}</td>
                    {qs.map((q) => { const k = kpi(q, d.questions[q.key]); return <td key={q.key} className={cn("px-3 py-2 text-center tabular-nums", heatClass(k?.pct ?? null, k?.kind === "risk"))}>{pct(k?.pct)}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function InsightCard({ survey, period, insight, setInsight, isHr, onAddAction, summary }: Parameters<typeof Overview>[0]) {
  const [busy, setBusy] = useState(false);
  const n = summary.find((p) => p.period === period)?.n ?? 0;
  const generate = async () => {
    if (insight && !window.confirm("Buat ulang insight? Insight lama untuk bulan ini akan diganti dan status berbagi ke owner direset.")) return;
    setBusy(true);
    const r = await requestInsight(survey.id, period);
    setBusy(false);
    if (r.error) { toast(r.error, "error"); return; }
    setInsight(r.insight ?? null);
    toast("Insight AI selesai dibuat");
  };
  const toggleShare = async () => {
    if (!insight) return;
    const err = await shareInsight(insight.id, !insight.shared_with_owner);
    if (err) { toast(err, "error"); return; }
    setInsight({ ...insight, shared_with_owner: !insight.shared_with_owner });
    toast(insight.shared_with_owner ? "Insight tidak lagi terlihat oleh owner" : "Insight kini terlihat oleh owner");
  };

  if (!insight) {
    return (
      <Card className="border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Insight AI — {periodLabel(period)}</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              {isHr
                ? "AI membaca angka dan semua komentar bulan ini, mengelompokkannya jadi tema, lalu mengusulkan tindak lanjut. Komentar dikirim ke layanan AI setelah nama, email, dan nomor telepon disamarkan."
                : "HR belum membagikan insight untuk bulan ini."}
            </p>
          </div>
          {isHr && <Button variant="primary" onClick={generate} disabled={busy || n < 3}>{busy ? "AI sedang membaca… (±20 detik)" : "Buat insight AI"}</Button>}
        </div>
      </Card>
    );
  }

  const c = insight.content;
  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Insight AI — {periodLabel(period)}</h2>
          <p className="text-[11px] text-slate-400">Dibuat {new Date(insight.created_at).toLocaleString("id-ID")} dari {c.dasar?.responden ?? "?"} jawaban & {c.dasar?.komentar ?? "?"} komentar. Periksa sebelum dipakai — AI bisa keliru.</p>
        </div>
        {isHr && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={toggleShare}>{insight.shared_with_owner ? "✓ Terlihat oleh owner" : "Bagikan ke owner"}</Button>
            <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>{busy ? "Membuat…" : "Buat ulang"}</Button>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{c.ringkasan}</p>

      {c.temuan.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Temuan</h3>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {c.temuan.map((t, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{t.judul}</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t.bukti}</p>
                {t.dampak && <p className="mt-1 text-xs text-slate-500">Dampak: {t.dampak}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.tema_komentar.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tema komentar</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.tema_komentar.map((t, i) => (
              <div key={i} className={cn("rounded-lg border px-3 py-2 text-xs", t.sentimen === "negatif" ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : t.sentimen === "positif" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60")}>
                <p className="font-semibold text-slate-900 dark:text-white">{t.tema} <span className="font-normal text-slate-500">· {t.jumlah} komentar</span></p>
                <p className="mt-0.5 max-w-xs text-slate-600 dark:text-slate-300">{t.inti}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {c.rekomendasi.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Usulan tindak lanjut</h3>
          <ul className="mt-2 space-y-2">
            {c.rekomendasi.map((r, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-start gap-2">
                  {r.fokus && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">★ Fokus</span>}
                  <p className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">{r.judul}</p>
                  {isHr && <Button size="sm" onClick={() => onAddAction(r)}>+ Jadikan tindak lanjut</Button>}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{r.alasan}</p>
                {r.langkah.length > 0 && <ol className="mt-1 list-inside list-decimal text-xs text-slate-600 dark:text-slate-300">{r.langkah.map((l, j) => <li key={j}>{l}</li>)}</ol>}
                {r.pic && <p className="mt-1 text-[11px] text-slate-400">PIC usulan: {r.pic}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!c.apresiasi?.length && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paling sering diapresiasi rekan</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.apresiasi.map((a) => <span key={a.name} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">{a.name} · {a.count}×</span>)}
          </div>
        </div>
      )}

      {c.catatan_data.length > 0 && (
        <p className="mt-4 text-[11px] text-slate-400">Catatan data: {c.catatan_data.join(" · ")}</p>
      )}
    </Card>
  );
}
