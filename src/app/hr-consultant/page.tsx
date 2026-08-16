"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Konsultan HR — ruang tanya-jawab dengan konsultan Human Capital senior.

   Bedanya dengan dashboard: dashboard menjawab "apa yang terjadi", halaman ini
   menjawab "apa yang harus saya lakukan" — termasuk untuk persoalan yang
   datanya sama sekali tidak ada di sistem, misalnya turnover pada posisi baru
   yang belum pernah direkrut lewat platform ini.

   Sakelar "sertakan data perusahaan" sengaja BISA DIMATIKAN dan bisa dilihat
   isinya sebelum dikirim. Pengguna berhak tahu persis apa yang keluar dari
   sistemnya sendiri, dan berhak bertanya tanpa membawa data sama sekali.
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getCandidates, getJobReqs, syncFromSupabase, type CandidateRecord, type JobRequisition } from "@/lib/store";
import { ALL_COMPANIES, getActiveCompanyId } from "@/lib/payroll/company-profile";
import { buildReqStatus, buildSourceStats, buildSummary } from "@/lib/recruiting/pipeline-metrics";
import { buildContextBlock, SUGGESTED_QUESTIONS, type CompanySnapshot } from "@/lib/hr-consultant";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

export default function HrConsultantPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [reqs, setReqs] = useState<JobRequisition[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setCandidates(getCandidates());
    setReqs(getJobReqs());
  }, []);

  useEffect(() => {
    refresh();
    syncFromSupabase().then(refresh).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, sending]);

  const snapshot: CompanySnapshot = useMemo(() => {
    const company = ALL_COMPANIES.find((c) => c.id === getActiveCompanyId()) ?? ALL_COMPANIES[0];
    const summary = buildSummary(candidates, reqs);
    const reqStatus = buildReqStatus(reqs, candidates);
    return {
      companyName: company.name,
      industry: company.industry === "broadcast" ? "Media & Broadcast" : "Manufaktur Garmen",
      headcount: null, // modul kepegawaian punya sumber data terpisah; jangan menebak
      pipeline: {
        totalCandidates: summary.totalCandidates,
        activePipeline: summary.activePipeline,
        hired: summary.hired,
        openReqs: summary.openReqs,
        medianTimeToHireDays: summary.timeToHire.medianDays,
        offerAcceptRatePct: summary.offerAcceptRatePct,
        stalledCount: summary.stalledCount,
      },
      openPositions: reqs
        .filter((r) => r.status === "active")
        .map((r) => ({
          title: r.title,
          department: r.department,
          headcount: r.headcount,
          activePipeline: reqStatus.find((s) => s.reqId === r.id)?.activePipeline ?? 0,
        })),
      topSources: buildSourceStats(candidates)
        .slice(0, 6)
        .map((s) => ({ source: s.source, candidates: s.candidates, hired: s.hired })),
    };
  }, [candidates, reqs]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || sending) return;

      const nextTurns: Turn[] = [...turns, { role: "user", content: q }];
      setTurns(nextTurns);
      setInput("");
      setSending(true);

      try {
        const res = await fetch("/api/hr-consultant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextTurns,
            context: useContext ? snapshot : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast(json.error || "Gagal memproses pertanyaan.", "error");
          // Pertanyaan dikembalikan ke kotak input supaya tidak perlu diketik ulang.
          setTurns(turns);
          setInput(q);
          return;
        }
        setTurns([...nextTurns, { role: "assistant", content: json.reply }]);
      } catch {
        toast("Gagal terhubung ke layanan AI. Periksa koneksi Anda.", "error");
        setTurns(turns);
        setInput(q);
      } finally {
        setSending(false);
      }
    },
    [sending, snapshot, turns, useContext],
  );

  return (
    <AppShell
      activeNavId="hr-consultant"
      title="Konsultan HR"
      subtitle="Tanya apa saja soal SDM — dijawab seperti HR Manager berpengalaman"
      headerActions={
        turns.length > 0 ? (
          <Button variant="secondary" onClick={() => setTurns([])}>Percakapan baru</Button>
        ) : undefined
      }
    >
      {/* Pengaturan konteks */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={useContext}
                onChange={(e) => setUseContext(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Sertakan data rekrutmen perusahaan
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {useContext
                    ? "Konsultan bisa merujuk angka nyata pipeline Anda. Matikan bila ingin bertanya secara umum saja."
                    : "Konsultan menjawab murni dari praktik umum, tanpa melihat data perusahaan Anda."}
                </span>
              </span>
            </label>
          </div>
          {useContext && (
            <Button variant="secondary" size="sm" onClick={() => setShowContext((v) => !v)}>
              {showContext ? "Sembunyikan" : "Lihat data yang dikirim"}
            </Button>
          )}
        </div>

        {useContext && showContext && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            {buildContextBlock(snapshot)}
          </pre>
        )}
      </Card>

      {/* Percakapan */}
      {turns.length === 0 ? (
        <>
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
            <div className="flex gap-3">
              <Icon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"><SvgPath name="sparkles" /></Icon>
              <div className="text-sm leading-relaxed text-blue-900 dark:text-blue-200">
                <p className="font-semibold">Konsultan ini mendiagnosis dulu, baru memberi solusi</p>
                <p className="mt-1">
                  Ia akan menguraikan kemungkinan akar masalah, menyebut data apa yang perlu Anda cek untuk
                  memastikannya, lalu memberi tindakan yang dipisah antara yang bisa dikerjakan minggu ini dan yang
                  bersifat struktural — lengkap dengan konsekuensi tiap pilihan. Untuk perkara hukum dan hubungan
                  industrial, ia memberi kerangka berpikir dan menunjukkan kapan Anda perlu pendampingan hukum.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Mulai dari salah satu ini</p>
            <p className="mt-0.5 text-xs text-slate-500">Atau langsung ketik pertanyaan Anda sendiri di bawah.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={sending}
                  onClick={() => void ask(s.question)}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50 disabled:opacity-50 dark:border-slate-700 dark:hover:border-blue-500 dark:hover:bg-blue-500/10"
                >
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {s.tag}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-slate-900 dark:text-white">{s.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <div className="space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                  t.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
                )}
              >
                {t.role === "assistant" && (
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Konsultan HR
                  </p>
                )}
                <div className="whitespace-pre-wrap">{t.content}</div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  Menyusun jawaban…
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Kotak input */}
      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter mengirim, Shift+Enter baris baru — lazim untuk kotak chat,
              // dan pertanyaan HR sering butuh beberapa baris konteks.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={3}
            disabled={sending}
            placeholder="Contoh: Turnover host live kami tinggi sekali, rata-rata bertahan 3 bulan. Apa yang harus saya lakukan?"
            className="min-h-[76px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <Button variant="primary" size="lg" disabled={sending || !input.trim()} onClick={() => void ask(input)}>
            {sending ? "Mengirim…" : "Tanya"}
          </Button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Jawaban AI adalah bahan pertimbangan, bukan keputusan final — dan bukan nasihat hukum. Untuk PHK, sengketa,
          atau perselisihan hubungan industrial, dampingi dengan konsultan hukum ketenagakerjaan atau konsultasikan ke
          Disnaker setempat.
        </p>
      </Card>
    </AppShell>
  );
}
