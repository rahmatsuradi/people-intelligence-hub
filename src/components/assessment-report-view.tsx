"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Tampilan laporan asesmen — dipakai bersama oleh halaman laporan nyata
   (/assessment/[sessionId], membaca snapshot dari DB) dan tab Contoh Hasil pada
   halaman panduan (/assessment/panduan, menghitung langsung dari engine).

   Satu komponen untuk keduanya supaya yang dilihat di demo benar-benar sama
   dengan yang keluar untuk kandidat sungguhan — kalau dipisah, demo akan
   perlahan menjadi brosur yang tidak mencerminkan produknya.

   Urutan bagian mengikuti cara laporan asesmen korporat dibaca:
   ringkasan → kualitas jawaban → kesesuaian jabatan → skor → interpretasi →
   batasan. Kualitas jawaban sengaja mendahului angka: kalau pengisiannya
   meragukan, angka di bawahnya tidak layak dibaca sebagai kesimpulan.
═══════════════════════════════════════════════════════════════════════════ */

import { Card, cn } from "@/components/app-shell";
import { BAND_LABELS } from "@/lib/assessment/norms";
import { FIT_VERDICT_LABELS } from "@/lib/assessment/job-profiles";
import { SCALE_BY_ID } from "@/lib/assessment/scales";
import type { AssessmentReport, NormedScaleScore, ValidityStatus } from "@/lib/assessment/types";

export const VALIDITY_STYLE: Record<ValidityStatus, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  perhatian: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  meragukan: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
};

export const VALIDITY_LABEL: Record<ValidityStatus, string> = {
  ok: "Baik",
  perhatian: "Perlu perhatian",
  meragukan: "Meragukan",
};

export function AssessmentReportView({ report }: { report: AssessmentReport }) {
  return (
    <div className="space-y-6">
      {/* 1. Ringkasan eksekutif */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Ringkasan Eksekutif
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{report.candidateName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {report.position || "Tanpa posisi"} · {report.batteryName}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <p>ID sesi: <span className="font-mono">{report.sessionId}</span></p>
            <p>Selesai: {new Date(report.completedAt).toLocaleString("id-ID")}</p>
            <p>Norma: {report.normLabel}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.executiveSummary}</p>

        {report.recommendedActions.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Tindak lanjut yang disarankan</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {report.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* 2. Kualitas jawaban */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Kualitas Jawaban</p>
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", VALIDITY_STYLE[report.validity.overall])}>
            {VALIDITY_LABEL[report.validity.overall]}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{report.validity.summary}</p>

        <div className="mt-4 space-y-2">
          {report.validity.indices.map((ix) => (
            <div key={ix.id} className={cn("rounded-lg border px-3 py-2.5", VALIDITY_STYLE[ix.status])}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{ix.label}</p>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {ix.unit === "ratio" && ix.id === "completion" ? `${Math.round(ix.value * 100)}%` : ix.value}
                  {ix.unit === "sec" ? " dtk/item" : ""}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">{ix.explanation}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Kesesuaian jabatan */}
      {report.fit && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Kesesuaian dengan Profil Jabatan</p>
              <p className="text-xs text-slate-500">{report.fit.profileName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{report.fit.fitScore}</p>
              <p className="text-xs font-medium text-slate-500">/100 · {FIT_VERDICT_LABELS[report.fit.verdict]}</p>
            </div>
          </div>

          {report.fit.criticalFlags.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Di bawah ambang kritis posisi ini</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-700 dark:text-red-300">
                {report.fit.criticalFlags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">Skala</th>
                  <th className="py-2 pr-3 font-medium">Sten</th>
                  <th className="py-2 pr-3 font-medium">Target</th>
                  <th className="py-2 pr-3 font-medium">Bobot</th>
                  <th className="py-2 pr-3 font-medium">Cocok</th>
                  <th className="py-2 font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.fit.details.map((d) => (
                  <tr key={d.scaleId} className={d.belowCritical ? "bg-red-50/60 dark:bg-red-500/5" : undefined}>
                    <td className="py-2 pr-3 font-medium text-slate-900 dark:text-white">{d.scaleName}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700 dark:text-slate-300">{d.sten}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{d.targetStenMin}–{d.targetStenMax}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{d.weight}</td>
                    <td className="py-2 pr-3 tabular-nums font-semibold text-slate-900 dark:text-white">{d.matchPct}%</td>
                    <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{d.gapNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. Profil skor */}
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Profil Skor</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Sten 1–10 (rata-rata 5–6). Persentil menunjukkan posisi terhadap kelompok norma {report.normLabel}.
          {report.normProvenance === "synthetic_demo" && " Norma ini sintetis — baca sebagai perbandingan antar-kandidat, bukan ambang absolut."}
        </p>

        <div className="mt-4 space-y-4">
          <ScoreGroup title="Kemampuan Kognitif" scores={report.scores.filter((s) => s.scaleId.startsWith("COG_"))} />
          <ScoreGroup title="Kepribadian Kerja (Big Five)" scores={report.scores.filter((s) => ["O", "C", "E", "A", "N"].includes(s.scaleId))} />
          <ScoreGroup title="Penilaian Situasional (SJT)" scores={report.scores.filter((s) => s.scaleId.startsWith("SJT_"))} />
        </div>
      </Card>

      {/* 5. Interpretasi */}
      <Card>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Interpretasi &amp; Panduan Wawancara</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Skor adalah hipotesis. Pertanyaan di bawah dirancang untuk mengujinya lewat contoh perilaku nyata,
          bukan mengonfirmasinya.
        </p>
        <div className="mt-4 space-y-3">
          {report.interpretations.map((it) => (
            <details key={it.scaleId} className="rounded-lg border border-slate-200 dark:border-slate-800" open={it.sten <= 3 || it.sten >= 8}>
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-medium text-slate-900 dark:text-white">{it.scaleName}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Sten {it.sten} · {BAND_LABELS[it.band]}
                </span>
              </summary>
              <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{it.narrative}</p>
                {it.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Kekuatan</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      {it.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {it.watchouts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Perlu diwaspadai</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      {it.watchouts.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                {it.interviewProbes.length > 0 && (
                  <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Pertanyaan probing</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-blue-900 dark:text-blue-200">
                      {it.interviewProbes.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </Card>

      {/* 6. Batasan */}
      <Card className="border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Batasan Penggunaan Laporan</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {report.limitations.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function ScoreGroup({ title, scores }: { title: string; scores: NormedScaleScore[] }) {
  if (scores.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-2 space-y-2">
        {scores.map((s) => <ScoreBar key={s.scaleId} score={s} />)}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: NormedScaleScore }) {
  const def = SCALE_BY_ID[score.scaleId];
  // Neuroticism di-key ke arah reaktivitas: sten tinggi BUKAN kabar baik.
  // Warnanya karena itu tidak boleh mengikuti aturan "makin tinggi makin hijau".
  const reverseColor = score.scaleId === "N";
  const good = reverseColor ? score.sten <= 4 : score.sten >= 7;
  const bad = reverseColor ? score.sten >= 8 : score.sten <= 3;
  const barColor = good ? "bg-emerald-500" : bad ? "bg-amber-500" : "bg-blue-500";

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
          {def?.name ?? score.scaleId}
          {score.scaleId === "N" && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              skor tinggi = reaktivitas tinggi
            </span>
          )}
        </p>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          sten <span className="font-bold text-slate-900 dark:text-white">{score.sten}</span> · persentil {score.percentile} · T {score.tScore}
          {score.answered < score.itemCount && (
            <span className="ml-1.5 text-amber-600 dark:text-amber-400">· {score.answered}/{score.itemCount} item</span>
          )}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {/* Pita rata-rata (sten 5-6) sebagai acuan visual */}
          <div className="absolute inset-y-0 left-[40%] w-[20%] bg-slate-200 dark:bg-slate-700" />
          <div className={cn("relative h-full rounded-full transition-all", barColor)} style={{ width: `${score.sten * 10}%` }} />
        </div>
        <span className="w-28 shrink-0 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {BAND_LABELS[score.band]}
        </span>
      </div>
    </div>
  );
}
