"use client";

import { useState } from "react";
import { Button, Card, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { periodLabel, requestInsight, shareInsight, type Signal, type StoredInsight, type Survey } from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";
import { PEMILIK_LABEL, masalahAsText, type MasalahDasar, type MasalahTheme } from "@/lib/rr/pulse-themes";

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
  const [progress, setProgress] = useState("");
  const generate = async () => {
    if (insight && !window.confirm("Buat ulang insight? Insight lama untuk bulan ini akan diganti dan status berbagi ke owner direset.")) return;
    setBusy(true);
    setProgress("Menyiapkan…");
    const r = await requestInsight(survey.id, period, setProgress);
    setBusy(false);
    setProgress("");
    if (r.error) { toast(r.error, "error"); return; }
    setInsight(r.insight ?? null);
    if (r.warning) toast(r.warning, "error");
    else toast("Insight AI selesai dibuat");
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
          {isHr && <Button variant="primary" onClick={generate} disabled={busy || n < 3}>{busy ? "AI sedang membaca…" : "Buat insight AI"}</Button>}
        </div>
        {busy && <Progress text={progress} />}
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
      {busy && <Progress text={progress} />}

      <p className="mt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{c.ringkasan}</p>

      {!!c.masalah_utama?.length && <MasalahUtama tema={c.masalah_utama} dasar={c.masalah_dasar} period={period} />}
      {isHr && !c.masalah_utama && <p className="mt-3 text-[11px] text-slate-400">Insight ini dibuat sebelum ada bagian &quot;Masalah utama dari komentar&quot;. Tekan Buat ulang untuk memetakan semua komentar (±3–4 menit).</p>}

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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.masalah_utama ? "Yang sudah berjalan baik menurut pengisi" : "Tema komentar"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.tema_komentar.map((t, i) => (
              <div key={i} className={cn("rounded-lg border px-3 py-2 text-xs", t.sentimen === "negatif" ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30" : t.sentimen === "positif" ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60")}>
                <p className="font-semibold text-slate-900 dark:text-white">{t.tema} {!c.masalah_utama && <span className="font-normal text-slate-500">· {t.jumlah} komentar</span>}</p>
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

function Progress({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
      <p className="font-medium">{text || "Memproses…"}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">Semua komentar dibaca bertahap karena jatah AI per menit terbatas. Biarkan halaman ini terbuka sampai selesai (±3–4 menit untuk ±150 jawaban).</p>
    </div>
  );
}

const PEMILIK_TONE: Record<MasalahTheme["pemilik"], string> = {
  spv: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  perusahaan: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  operasional: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
};

/** Masalah utama dari SEMUA komentar: jumlah orang dihitung server, kalimat dari AI. Disusun untuk dibaca di layar rapat. */
function MasalahUtama({ tema, dasar, period }: { tema: MasalahTheme[]; dasar?: MasalahDasar; period: string }) {
  const max = Math.max(...tema.map((t) => t.persen), 1);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(masalahAsText(periodLabel(period), tema, dasar));
      toast("Teks masalah utama disalin — tinggal tempel ke slide");
    } catch {
      toast("Browser menolak menyalin. Blok teksnya lalu salin manual.", "error");
    }
  };
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Masalah utama dari komentar</h3>
          {dasar && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              Dibaca dari semua komentar: {dasar.responden_berkomentar} dari {dasar.responden} pengisi menulis keluhan/usulan ({dasar.komentar} komentar).
              Jumlah = orang yang menyebut, dihitung pasti; satu orang bisa menyebut beberapa masalah.
              {dasar.tanpa_tema > 0 && ` ${dasar.tanpa_tema} pengisi tidak masuk tema mana pun — baca di tab Komentar.`}
            </p>
          )}
        </div>
        <Button size="sm" onClick={copy}>Salin untuk slide</Button>
      </div>
      <ol className="mt-2 space-y-2">
        {tema.map((t, i) => (
          <li key={t.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.judul}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", PEMILIK_TONE[t.pemilik])}>{PEMILIK_LABEL[t.pemilik]}</span>
                  {t.berulang && <span className="rounded-full border border-red-300 px-2 py-0.5 font-medium text-red-700 dark:border-red-800 dark:text-red-300">Keluhan berulang, belum tuntas</span>}
                </div>
              </div>
              <div className="w-40 shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{t.jumlah} orang <span className="font-normal text-slate-500">· {t.persen}%</span></p>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-red-500/80" style={{ width: `${(t.persen / max) * 100}%` }} /></div>
              </div>
            </div>
            <div className="ml-8 mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {t.inti && <p>{t.inti}</p>}
              {t.per_kelompok.length > 0 && dasar?.kelompok_label && (
                <p className="text-slate-500">
                  Terbanyak di {dasar.kelompok_label}:{" "}
                  {t.per_kelompok.slice(0, 3).map((g) => `${g.grup} ${g.persen}% (${g.jumlah}/${g.n})`).join(" · ")}
                </p>
              )}
              {t.contoh.length > 0 && <p className="italic text-slate-500">Contoh (parafrase): {t.contoh.join(" · ")}</p>}
              {t.usulan && <p><span className="font-medium text-slate-700 dark:text-slate-200">Usulan:</span> {t.usulan}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
