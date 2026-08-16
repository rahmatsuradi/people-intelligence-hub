"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Hiring Analytics — kesehatan proses rekrutmen, bukan sekadar jumlah kandidat.

   Urutan halaman mengikuti pertanyaan yang benar-benar ditanyakan manajemen:
   1. Apa yang sedang bermasalah?      → hambatan & kandidat mandek (paling atas)
   2. Seberapa cepat prosesnya?        → time-to-hire & kecepatan per tahap
   3. Di mana kandidat berguguran?     → corong konversi
   4. Sumber mana yang benar berhasil? → efektivitas sumber
   5. Lowongan mana yang tertinggal?   → status per lowongan

   Masalah ditaruh di atas, bukan angka besar yang menyenangkan. Dashboard yang
   membuka dengan "total 248 kandidat" tidak menolong siapa pun mengambil
   tindakan hari itu.

   Seluruh angka dihitung oleh mesin murni di lib/recruiting/pipeline-metrics.ts
   yang punya 37 unit test — halaman ini hanya menyajikan.
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { getCandidates, getJobReqs, syncFromSupabase, type CandidateRecord, type JobRequisition } from "@/lib/store";
import {
  buildFunnel,
  buildReqStatus,
  buildSourceStats,
  buildStageVelocity,
  buildSummary,
  detectBottlenecks,
  findStalled,
} from "@/lib/recruiting/pipeline-metrics";

const STATUS_STYLE: Record<string, string> = {
  terpenuhi: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  berjalan: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  lewat_target: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  tanpa_kandidat: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const STATUS_LABEL: Record<string, string> = {
  terpenuhi: "Terpenuhi",
  berjalan: "Berjalan",
  lewat_target: "Lewat target",
  tanpa_kandidat: "Belum ada pelamar",
};

export default function HiringAnalyticsPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [reqs, setReqs] = useState<JobRequisition[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setCandidates(getCandidates());
    setReqs(getJobReqs());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    syncFromSupabase().then(refresh).catch(() => {});
  }, [refresh]);

  const m = useMemo(() => {
    const funnel = buildFunnel(candidates);
    const velocity = buildStageVelocity(candidates);
    return {
      summary: buildSummary(candidates, reqs),
      funnel,
      velocity,
      bottlenecks: detectBottlenecks(funnel, velocity),
      stalled: findStalled(candidates),
      sources: buildSourceStats(candidates),
      reqStatus: buildReqStatus(reqs, candidates).sort((a, b) => b.openDays - a.openDays),
    };
  }, [candidates, reqs]);

  const { summary } = m;
  const activeReqStatus = m.reqStatus.filter((r) => r.status !== "terpenuhi");

  return (
    <AppShell
      activeNavId="hiring-analytics"
      title="Hiring Analytics"
      subtitle="Kecepatan, konversi, dan hambatan proses rekrutmen"
      headerActions={
        <Link href="/hr-consultant">
          <Button variant="primary">
            <Icon className="h-4 w-4"><SvgPath name="sparkles" /></Icon>
            Tanya Konsultan HR
          </Button>
        </Link>
      }
    >
      {loading ? (
        <Card><p className="text-sm text-slate-500">Memuat…</p></Card>
      ) : candidates.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Belum ada kandidat di pipeline, jadi belum ada yang bisa diukur.
          </p>
          <Link href="/candidates" className="mt-2 inline-block text-sm font-medium text-blue-600 underline underline-offset-2">
            Buka daftar kandidat
          </Link>
        </Card>
      ) : (
        <>
          {/* ── 1. Yang perlu ditindaklanjuti hari ini ── */}
          {(m.bottlenecks.length > 0 || m.stalled.length > 0) && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="flex gap-3">
                <Icon className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"><SvgPath name="warning" /></Icon>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-amber-900 dark:text-amber-100">Perlu ditindaklanjuti</p>

                  {m.bottlenecks.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {m.bottlenecks.map((b, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm text-amber-900 dark:text-amber-100">
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            b.severity === "tinggi" ? "bg-red-200 text-red-800 dark:bg-red-500/25 dark:text-red-200" : "bg-amber-200 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100",
                          )}>
                            {b.label}
                          </span>
                          <span>{b.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.stalled.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {m.stalled.length} kandidat mandek melewati batas wajar
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                        Kandidat jarang hilang karena ditolak — mereka hilang karena didiamkan.
                      </p>
                      <div className="mt-2 space-y-1">
                        {m.stalled.slice(0, 6).map((s) => (
                          <div key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-white/60 px-3 py-1.5 text-sm dark:bg-slate-900/40">
                            <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              {s.position} · {s.stageLabel} ·{" "}
                              <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                                {Math.round(s.daysInStage)} hari
                              </span>{" "}
                              (batas {s.thresholdDays})
                            </span>
                          </div>
                        ))}
                        {m.stalled.length > 6 && (
                          <p className="px-3 text-xs text-amber-800 dark:text-amber-200">
                            dan {m.stalled.length - 6} kandidat lain.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── 2. Angka utama ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Median time-to-hire"
              value={summary.timeToHire.medianDays === null ? "—" : `${summary.timeToHire.medianDays} hari`}
              sub={
                summary.timeToHire.basedOn === 0
                  ? "Belum ada perekrutan dengan riwayat lengkap"
                  : `Dari ${summary.timeToHire.basedOn} perekrutan · tercepat ${summary.timeToHire.fastestDays}, terlama ${summary.timeToHire.slowestDays} hari`
              }
            />
            <Metric
              label="Offer diterima"
              value={summary.offerAcceptRatePct === null ? "—" : `${summary.offerAcceptRatePct}%`}
              sub={summary.offerBasedOn === 0 ? "Belum ada penawaran" : `Dari ${summary.offerBasedOn} kandidat yang pernah ditawari`}
            />
            <Metric
              label="Pipeline aktif"
              value={String(summary.activePipeline)}
              sub={
                summary.candidatesPerOpenReq === null
                  ? "Tidak ada lowongan aktif"
                  : `${summary.candidatesPerOpenReq} kandidat per lowongan aktif`
              }
            />
            <Metric
              label="Kandidat mandek"
              value={String(summary.stalledCount)}
              sub={summary.stalledCount === 0 ? "Semua bergerak dalam batas wajar" : "Melewati batas wajar tahapnya"}
              tone={summary.stalledCount > 0 ? "warn" : "ok"}
            />
          </div>

          {summary.withoutHistory > 0 && (
            <Card className="border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <span className="font-semibold">{summary.withoutHistory} dari {summary.totalCandidates} kandidat</span>{" "}
                belum punya riwayat perpindahan tahap — mereka masuk sistem sebelum pencatatan riwayat ada.
                Kandidat tersebut <span className="font-medium">tidak ikut</span> dalam perhitungan kecepatan, agar
                metriknya tidak terlihat lebih cepat dari kenyataan. Angka akan makin akurat seiring kandidat baru
                berjalan lewat pipeline.
              </p>
            </Card>
          )}

          {/* ── 3. Corong konversi ── */}
          <Card>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Corong Konversi</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Berapa banyak yang <span className="font-medium">pernah mencapai</span> tiap tahap, bukan yang sedang berada di sana.
            </p>
            <div className="mt-4 space-y-2">
              {m.funnel.map((s) => (
                <div key={s.stage}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-white">{s.label}</span>
                    <span className="text-xs tabular-nums text-slate-500">
                      <span className="font-semibold text-slate-900 dark:text-white">{s.reached}</span> pernah sampai ·{" "}
                      {s.current} sedang di sini · {s.reachedPct}% dari total
                      {s.stepConversionPct !== null && (
                        <span className={cn("ml-1.5 font-semibold", s.stepConversionPct < 25 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300")}>
                          ↓ {s.stepConversionPct}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${s.reachedPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 4. Kecepatan per tahap ── */}
          <Card>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Lama Tertahan per Tahap</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Median hari, bukan rata-rata — satu kandidat yang menggantung berbulan-bulan tidak boleh merusak seluruh angka.
            </p>
            <div className="mt-3 space-y-1.5">
              {m.velocity.map((v) => (
                <div key={v.stage} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{v.label}</span>
                  <span className="text-sm tabular-nums text-slate-600 dark:text-slate-400">
                    {v.medianDays === null ? (
                      <span className="text-xs text-slate-400">belum ada data</span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-900 dark:text-white">{v.medianDays}</span> hari
                        <span className="ml-1.5 text-xs text-slate-400">dari {v.basedOn} kandidat</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* ── 5. Efektivitas sumber ── */}
          <Card padding={false}>
            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Efektivitas Sumber Kandidat</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Diurutkan dari yang paling banyak menghasilkan karyawan — bukan yang paling banyak mendatangkan pelamar.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Sumber</th>
                    <th className="px-5 py-2.5 font-medium">Pelamar</th>
                    <th className="px-5 py-2.5 font-medium">Wawancara</th>
                    <th className="px-5 py-2.5 font-medium">Diterima</th>
                    <th className="px-5 py-2.5 font-medium">Rasio hire</th>
                    <th className="px-5 py-2.5 font-medium">Rata-rata skor CV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {m.sources.map((s) => (
                    <tr key={s.source} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-white">{s.source}</td>
                      <td className="px-5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">{s.candidates}</td>
                      <td className="px-5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">{s.interviewed}</td>
                      <td className="px-5 py-2.5 tabular-nums font-semibold text-slate-900 dark:text-white">{s.hired}</td>
                      <td className={cn("px-5 py-2.5 tabular-nums font-medium", s.hired > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400")}>
                        {s.hireRatePct}%
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">
                        {s.avgCvScore ?? <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── 6. Status lowongan ── */}
          {activeReqStatus.length > 0 && (
            <Card padding={false}>
              <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Lowongan yang Belum Terpenuhi</p>
                <p className="mt-0.5 text-xs text-slate-500">Diurutkan dari yang paling lama terbuka.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Posisi</th>
                      <th className="px-5 py-2.5 font-medium">Terisi</th>
                      <th className="px-5 py-2.5 font-medium">Pipeline aktif</th>
                      <th className="px-5 py-2.5 font-medium">Terbuka</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeReqStatus.map((r) => (
                      <tr key={r.reqId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-slate-900 dark:text-white">{r.title}</p>
                          <p className="text-xs text-slate-500">{r.department}</p>
                        </td>
                        <td className="px-5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">
                          {r.hiredCount} / {r.headcount}
                        </td>
                        <td className={cn("px-5 py-2.5 tabular-nums", r.activePipeline === 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400")}>
                          {r.activePipeline}
                        </td>
                        <td className="px-5 py-2.5 tabular-nums text-slate-600 dark:text-slate-400">
                          {Math.round(r.openDays)} hari
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, value, sub, tone = "ok" }: { label: string; value: string; sub: string; tone?: "ok" | "warn" }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{sub}</p>
    </Card>
  );
}
