"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Pengerjaan tes oleh peserta.

   Keputusan desain yang disengaja:
   - SATU SECTION PER LAYAR, bukan satu soal per layar. Peserta bisa meninjau
     ulang jawabannya dalam satu bagian sebelum mengirim, dan jumlah permintaan
     jaringan tetap sedikit (penting untuk koneksi seluler yang tidak stabil).
   - JAWABAN DISIMPAN SAAT SATU BAGIAN SELESAI, bukan per klik. Bila koneksi
     terputus di tengah bagian, bagian yang sudah terkirim tidak perlu diulang.
   - WAKTU HABIS = KIRIM OTOMATIS, bukan menghanguskan jawaban. Yang sudah diisi
     tetap dihitung; menghanguskan pekerjaan peserta karena detik terakhir tidak
     punya pembenaran psikometrik apa pun.
   - Peserta TIDAK PERNAH melihat skor. Umpan balik disampaikan lewat HR.
═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PublicItem {
  id: string;
  format: "likert5" | "multiple_choice" | "sjt_effectiveness";
  text: string;
  options: string[];
}

interface PublicSection {
  id: string;
  title: string;
  instruction: string;
  timeLimitSec: number | null;
  items: PublicItem[];
}

interface PublicBattery {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  sections: PublicSection[];
}

interface LoadedSession {
  status: "invited" | "in_progress" | "completed" | "expired";
  candidateName: string;
  position: string;
  battery?: PublicBattery;
  responses?: Record<string, number>;
  completedSectionIds?: string[];
  completedAt?: string | null;
}

type Phase = "loading" | "error" | "intro" | "running" | "done";

function formatClock(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const card =
  "rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function TestRunner({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [session, setSession] = useState<LoadedSession | null>(null);
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [sectionIdx, setSectionIdx] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showUnanswered, setShowUnanswered] = useState(false);

  const sectionStartRef = useRef<string>("");
  const submitLockRef = useRef(false);

  /* ─── Muat sesi ─── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assessment/session?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setError(json.error || "Tautan tes tidak valid.");
          setPhase("error");
          return;
        }
        setSession(json);
        setResponses(json.responses ?? {});
        if (json.status === "completed") {
          setPhase("done");
          return;
        }
        // Melanjutkan dari bagian pertama yang belum dikirim.
        const done: string[] = json.completedSectionIds ?? [];
        const battery: PublicBattery = json.battery;
        const nextIdx = battery.sections.findIndex((s) => !done.includes(s.id));
        setSectionIdx(nextIdx === -1 ? battery.sections.length - 1 : nextIdx);
        setPhase("intro");
      } catch {
        if (!cancelled) {
          setError("Gagal memuat tes. Periksa koneksi Anda lalu muat ulang halaman.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const battery = session?.battery;
  const section = battery?.sections[sectionIdx];

  const answeredInSection = useMemo(
    () => (section ? section.items.filter((i) => responses[i.id] !== undefined).length : 0),
    [section, responses],
  );

  /* ─── Kirim satu bagian ─── */
  const submitSection = useCallback(
    async (auto: boolean) => {
      if (!section || !battery || submitLockRef.current) return;
      submitLockRef.current = true;
      setSubmitting(true);
      setError("");

      const isLast = sectionIdx >= battery.sections.length - 1;
      const startedAt = sectionStartRef.current || new Date().toISOString();
      const elapsedSec = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);

      const sectionResponses: Record<string, number> = {};
      for (const it of section.items) {
        if (responses[it.id] !== undefined) sectionResponses[it.id] = responses[it.id];
      }

      try {
        const res = await fetch("/api/assessment/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            sectionId: section.id,
            responses: sectionResponses,
            elapsedSec,
            startedAt,
            final: isLast,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || "Gagal mengirim jawaban. Coba lagi.");
          return;
        }
        if (isLast) {
          setPhase("done");
          return;
        }
        setSectionIdx((i) => i + 1);
        setShowUnanswered(false);
        setRemaining(null);
        sectionStartRef.current = "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError(
          auto
            ? "Waktu bagian ini habis, tetapi jawaban gagal terkirim. Periksa koneksi lalu tekan Kirim."
            : "Gagal mengirim jawaban. Periksa koneksi Anda lalu coba lagi.",
        );
      } finally {
        setSubmitting(false);
        submitLockRef.current = false;
      }
    },
    [battery, responses, section, sectionIdx, token],
  );

  /* ─── Hitung mundur per bagian ─── */
  useEffect(() => {
    if (phase !== "running" || !section) return;
    if (!sectionStartRef.current) sectionStartRef.current = new Date().toISOString();
    if (section.timeLimitSec === null) {
      setRemaining(null);
      return;
    }
    setRemaining(section.timeLimitSec);
    const startMs = Date.now();
    const id = window.setInterval(() => {
      const left = section.timeLimitSec! - Math.floor((Date.now() - startMs) / 1000);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        // Waktu habis: kirim apa yang sudah diisi, jangan hanguskan.
        void submitSection(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, section, submitSection]);

  /* ─── Peringatan sebelum meninggalkan halaman ─── */
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  /* ─── Render ─── */

  if (phase === "loading") {
    return (
      <div className={`${card} flex items-center justify-center py-16`}>
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <span className="text-xl" aria-hidden>🔒</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Tes tidak dapat dibuka</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <p className="mx-auto mt-4 max-w-sm text-xs text-slate-400">
          Bila Anda yakin tautan ini benar, hubungi tim rekrutmen yang mengirimkannya.
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={`${card} text-center`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
          <span className="text-xl" aria-hidden>✓</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Terima kasih, asesmen selesai</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Jawaban Anda sudah tersimpan. Hasil asesmen dibaca bersama CV dan wawancara oleh tim rekrutmen — tidak ada
          keputusan yang diambil dari skor tes semata. Tim rekrutmen akan menghubungi Anda untuk tahap berikutnya.
        </p>
        <p className="mx-auto mt-4 max-w-md text-xs text-slate-400">
          Anda berhak meminta umpan balik atas hasil asesmen ini kepada tim rekrutmen.
        </p>
      </div>
    );
  }

  if (!battery || !session) return null;

  /* ─── Layar pembuka ─── */
  if (phase === "intro") {
    const timed = battery.sections.filter((s) => s.timeLimitSec !== null).length;
    return (
      <div className="space-y-4">
        <div className={card}>
          <p className="text-sm text-slate-500 dark:text-slate-400">Halo,</p>
          <h1 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{session.candidateName}</h1>
          {session.position && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Asesmen untuk posisi <span className="font-medium text-slate-900 dark:text-white">{session.position}</span>
            </p>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Jumlah bagian" value={`${battery.sections.length} bagian`} />
            <Stat label="Perkiraan waktu" value={`± ${battery.estimatedMinutes} menit`} />
            <Stat label="Berbatas waktu" value={`${timed} dari ${battery.sections.length} bagian`} />
          </div>

          <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-white">Sebelum mulai, mohon diperhatikan:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Kerjakan sendiri, tanpa bantuan orang lain. Terdapat pemeriksaan konsistensi jawaban di dalam tes.</li>
              <li>Sebagian bagian <span className="font-medium">berbatas waktu</span>. Bila waktu habis, jawaban yang sudah diisi tetap terkirim.</li>
              <li>Jawaban tersimpan setiap kali Anda menyelesaikan satu bagian. Bila koneksi terputus, buka kembali tautan yang sama.</li>
              <li>Pada bagian kepribadian tidak ada jawaban benar atau salah — jawab sesuai keadaan Anda yang sebenarnya.</li>
              <li>Siapkan koneksi yang stabil dan kerjakan di tempat yang tenang.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setPhase("running")}
            className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
          >
            Mulai asesmen
          </button>
        </div>
      </div>
    );
  }

  /* ─── Layar pengerjaan ─── */
  if (!section) return null;

  const allAnswered = answeredInSection === section.items.length;
  const isLast = sectionIdx >= battery.sections.length - 1;

  return (
    <div className="space-y-4">
      {/* Kepala bagian */}
      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Bagian {sectionIdx + 1} dari {battery.sections.length}
            </p>
            <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{section.title}</h2>
          </div>
          {remaining !== null && (
            <div
              className={`rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums ${
                remaining <= 60
                  ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
              role="timer"
              aria-live="off"
            >
              ⏱ {formatClock(remaining)}
            </div>
          )}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${(answeredInSection / section.items.length) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {answeredInSection} dari {section.items.length} soal terjawab
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
        {section.instruction}
      </div>

      {/* Soal */}
      <ol className="space-y-3">
        {section.items.map((item, idx) => {
          const unanswered = showUnanswered && responses[item.id] === undefined;
          return (
            <li
              key={item.id}
              className={`rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${
                unanswered
                  ? "border-amber-300 dark:border-amber-500/50"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex gap-3">
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-400">{idx + 1}.</span>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-900 dark:text-slate-100">{item.text}</p>
              </div>

              <div className={`mt-4 gap-2 ${item.format === "likert5" ? "grid sm:grid-cols-5" : "flex flex-col"}`}>
                {item.options.map((opt, oi) => {
                  // Likert dikirim 1-5 (nilai skala); pilihan ganda & SJT dikirim
                  // sebagai index opsi. Perbedaan ini ikut divalidasi di server.
                  const value = item.format === "likert5" ? oi + 1 : oi;
                  const selected = responses[item.id] === value;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="radio"
                        name={item.id}
                        value={value}
                        checked={selected}
                        onChange={() => setResponses((r) => ({ ...r, [item.id]: value }))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                      />
                      <span className="leading-snug">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {showUnanswered && !allAnswered && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Masih ada {section.items.length - answeredInSection} soal yang belum dijawab (ditandai garis kuning). Anda tetap
          dapat melanjutkan, tetapi soal yang dilewati akan mengurangi keandalan hasil.
        </div>
      )}

      <div className="flex flex-col gap-2 pb-8 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (!allAnswered && !showUnanswered) {
              setShowUnanswered(true);
              return;
            }
            void submitSection(false);
          }}
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting
            ? "Mengirim…"
            : !allAnswered && !showUnanswered
              ? "Periksa & lanjutkan"
              : isLast
                ? "Selesaikan asesmen"
                : "Kirim & lanjut ke bagian berikutnya"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
