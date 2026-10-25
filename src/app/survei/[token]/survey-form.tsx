"use client";

import { useEffect, useMemo, useState } from "react";
import { isVisible, type AnswerValue, type SurveyQuestion } from "@/lib/rr/pulse";

interface FormData { title: string; description: string | null; periodLabel: string; closesAt: string | null; questions: SurveyQuestion[] }

const box = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

export function SurveyForm({ token }: { token: string }) {
  const [data, setData] = useState<FormData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [done, setDone] = useState(false);
  const [website, setWebsite] = useState("");

  useEffect(() => {
    fetch(`/api/survei?token=${encodeURIComponent(token)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Gagal memuat formulir."); setData(j); })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  // Langkah 0 = identitas; berikutnya satu bagian (section) per langkah — nyaman di HP.
  const sections = useMemo(() => {
    const m = new Map<string, SurveyQuestion[]>();
    for (const q of data?.questions ?? []) m.set(q.section ?? "Pertanyaan", [...(m.get(q.section ?? "Pertanyaan") ?? []), q]);
    return [...m.entries()];
  }, [data]);
  const total = sections.length + 1;

  if (loadError) return <div className={box}><p className="text-base text-slate-700 dark:text-slate-200">{loadError}</p></div>;
  if (!data) return <div className={box}><p className="text-sm text-slate-500">Memuat formulir…</p></div>;
  if (done) {
    return (
      <div className={box}>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Terima kasih, {name.split(" ")[0]}!</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Jawabanmu sudah tersimpan. Nama dan jawaban tertulismu hanya bisa dibuka tim HR; owner hanya melihat ringkasan angka tanpa nama.</p>
      </div>
    );
  }

  const set = (k: string, v: AnswerValue | undefined) => setAnswers((a) => {
    const n = { ...a };
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v;
    return n;
  });

  const visibleIn = (qs: SurveyQuestion[]) => qs.filter((q) => isVisible(q, answers));
  const checkStep = (): boolean => {
    if (step === 0) {
      const ok = name.trim().length >= 2;
      setMissing(ok ? [] : ["__name"]);
      return ok;
    }
    const miss = visibleIn(sections[step - 1][1]).filter((q) => q.required && answers[q.key] === undefined).map((q) => q.key);
    setMissing(miss);
    return miss.length === 0;
  };
  const next = () => { if (checkStep()) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  const submit = async () => {
    if (!checkStep()) return;
    setSending(true); setSendError("");
    // Hanya jawaban untuk pertanyaan yang sedang tampil yang dikirim.
    const visible = new Set(data.questions.filter((q) => isVisible(q, answers)).map((q) => q.key));
    const payload = Object.fromEntries(Object.entries(answers).filter(([k]) => visible.has(k)));
    const r = await fetch("/api/survei", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, contact, answers: payload, website }) });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) { setSendError(j.error ?? "Gagal mengirim. Coba lagi."); return; }
    setDone(true);
  };

  return (
    <div className="space-y-4">
      <div className={box}>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{data.title} — {data.periodLabel}</p>
        {step === 0 && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{data.description}</p>}
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-slate-500">Langkah {step + 1} dari {total}{step > 0 ? ` · ${sections[step - 1][0]}` : ""}</p>
      </div>

      {step === 0 ? (
        <div className={box}>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">Nama lengkap <span className="text-red-600">*</span></label>
          <input className={`${input} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          {missing.includes("__name") && <p className="mt-1 text-xs text-red-600">Nama lengkap wajib diisi.</p>}
          <label className="mt-4 block text-sm font-medium text-slate-800 dark:text-slate-100">Email atau nomor WA <span className="text-xs font-normal text-slate-400">(boleh dikosongkan)</span></label>
          <input className={`${input} mt-1.5`} value={contact} onChange={(e) => setContact(e.target.value)} />
          <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Jawabanmu hanya dibaca tim HR. Atasan dan owner hanya melihat ringkasan angka tanpa nama. Jawab jujur — itu yang paling membantu.
          </p>
        </div>
      ) : (
        visibleIn(sections[step - 1][1]).map((q) => (
          <div key={q.key} className={`${box} ${missing.includes(q.key) ? "border-red-300 dark:border-red-800" : ""}`}>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.label}{q.required && <span className="text-red-600"> *</span>}</p>
            {q.type === "multi" && <p className="text-xs text-slate-400">Boleh pilih lebih dari satu</p>}
            <div className="mt-3"><Field q={q} value={answers[q.key]} onChange={(v) => set(q.key, v)} /></div>
            {missing.includes(q.key) && <p className="mt-2 text-xs text-red-600">Wajib diisi.</p>}
          </div>
        ))
      )}

      {sendError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{sendError}</p>}
      <div className="flex gap-3">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Kembali</button>}
        {step < total - 1
          ? <button type="button" onClick={next} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Lanjut</button>
          : <button type="button" onClick={submit} disabled={sending} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{sending ? "Mengirim…" : "Kirim jawaban"}</button>}
      </div>
    </div>
  );
}

function Field({ q, value, onChange }: { q: SurveyQuestion; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void }) {
  const opt = "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm";
  const on = "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  const off = "border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200";
  if (q.type === "text") return <textarea className={input} rows={3} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  if (q.type === "scale") {
    const nums: number[] = [];
    for (let i = q.min ?? 1; i <= (q.max ?? 5); i++) nums.push(i);
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {nums.map((n) => (
            <button key={n} type="button" onClick={() => onChange(n)}
              className={`h-11 min-w-11 flex-1 rounded-xl border text-sm font-medium ${value === n ? on : off}`}>{n}</button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{q.min ?? 1} = sangat rendah</span><span>{q.max ?? 5} = sangat tinggi</span></div>
      </div>
    );
  }
  const vals = Array.isArray(value) ? value.map(String) : value !== undefined ? [String(value)] : [];
  return (
    <div className="space-y-2">
      {(q.options ?? []).map((o) => {
        const picked = vals.includes(o.value);
        return (
          <button key={o.value} type="button" className={`${opt} ${picked ? on : off}`}
            onClick={() => q.type === "multi"
              ? onChange(picked ? vals.filter((v) => v !== o.value) : [...vals, o.value])
              : onChange(picked ? undefined : o.value)}>
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${q.type === "multi" ? "rounded" : "rounded-full"} ${picked ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
              {picked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            {o.label ?? o.value}
          </button>
        );
      })}
    </div>
  );
}
