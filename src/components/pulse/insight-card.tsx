"use client";

import { useState } from "react";
import { Button, Card, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { periodLabel, requestInsight, shareInsight, type Signal, type StoredInsight, type Survey } from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";

/** Sinyal otomatis berbasis aturan tetap (bukan AI) — "perlu diperhatikan". */
export function SignalsCard({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;
  return (
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
  );
}

export function InsightCard({ survey, period, n, insight, setInsight, isHr, onAddAction }: {
  survey: Survey; period: string; n: number; insight: StoredInsight | null; setInsight: (i: StoredInsight | null) => void; isHr: boolean;
  onAddAction: (r: InsightContent["rekomendasi"][number]) => void;
}) {
  const [busy, setBusy] = useState(false);
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

      {c.catatan_data.length > 0 && <p className="mt-4 text-[11px] text-slate-400">Catatan data: {c.catatan_data.join(" · ")}</p>}
    </Card>
  );
}
