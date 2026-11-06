"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isValidContact, isVisible, maxChoicesOf, type AnswerValue, type SurveyQuestion } from "@/lib/rr/pulse";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/rr/survey-draft";

interface FormData { title: string; description: string | null; periodLabel: string; closesAt: string | null; questions: SurveyQuestion[] }

const box = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

/** localStorage bisa melempar galat bila browser memblokirnya; formulir tetap harus jalan tanpa draf. */
const browserStore = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

export function SurveyForm({ token, invite }: { token: string; invite?: string }) {
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
  const [restored, setRestored] = useState(false);
  // Penahan klik ganda: `sending` baru berlaku setelah render, klik kedua bisa lebih cepat dari itu.
  const submitting = useRef(false);
  const key = draftKey(token, invite);

  useEffect(() => {
    fetch(`/api/survei?token=${encodeURIComponent(token)}${invite ? `&u=${encodeURIComponent(invite)}` : ""}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Gagal memuat formulir.");
        setData(j);
        if (j.inviteName) setName((n) => n || j.inviteName);
        // Lanjutkan isian yang terhenti (halaman dimuat ulang saat berpindah aplikasi di HP).
        const store = browserStore();
        const draft = store && loadDraft(store, key);
        if (draft) {
          const steps = new Set((j.questions as SurveyQuestion[]).map((q) => q.section ?? "Pertanyaan")).size;
          setStep(Math.min(draft.step, steps));
          if (draft.name) setName(draft.name);
          setContact(draft.contact);
          setAnswers(draft.answers);
          setRestored(draft.step > 0 || Object.keys(draft.answers).length > 0);
        }
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token, invite, key]);

  useEffect(() => {
    if (!data || done) return;
    const store = browserStore();
    if (store) saveDraft(store, key, { step, name, contact, answers });
  }, [data, done, key, step, name, contact, answers]);

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
      const miss = [...(name.trim().length >= 2 ? [] : ["__name"]), ...(isValidContact(contact) ? [] : ["__contact"])];
      setMissing(miss);
      return miss.length === 0;
    }
    const miss = visibleIn(sections[step - 1][1]).filter((q) => q.required && answers[q.key] === undefined).map((q) => q.key);
    setMissing(miss);
    return miss.length === 0;
  };
  const next = () => { if (checkStep()) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  const submit = async () => {
    if (submitting.current || !checkStep()) return;
    submitting.current = true;
    setSending(true); setSendError("");
    // Hanya jawaban untuk pertanyaan yang sedang tampil yang dikirim.
    const visible = new Set(data.questions.filter((q) => isVisible(q, answers)).map((q) => q.key));
    const payload = Object.fromEntries(Object.entries(answers).filter(([k]) => visible.has(k)));
    try {
      const r = await fetch("/api/survei", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, invite, name, contact, answers: payload, website }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setSendError(j.error ?? "Gagal mengirim. Coba lagi."); return; }
      const store = browserStore();
      if (store) clearDraft(store, key);
      setDone(true);
    } catch {
      setSendError("Koneksi terputus. Jawabanmu masih tersimpan di sini — coba kirim lagi.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={box}>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">{data.title} — {data.periodLabel}</p>
        {step === 0 && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{data.description}</p>}
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-slate-500">Langkah {step + 1} dari {total}{step > 0 ? ` · ${sections[step - 1][0]}` : ""}</p>
        {restored && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Jawabanmu yang tadi dipulihkan. Lanjutkan dari sini.</p>}
      </div>

      {step === 0 ? (
        <div className={box}>
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">Nama lengkap <span className="text-red-600">*</span></label>
          <input className={`${input} mt-1.5`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          {missing.includes("__name") && <p className="mt-1 text-xs text-red-600">Nama lengkap wajib diisi.</p>}
          {invite && <p className="mt-1 text-xs text-slate-500">Ini link pribadi. Bukan kamu? Minta link grup dari HR supaya jawabanmu tercatat atas namamu sendiri.</p>}
          <label className="mt-4 block text-sm font-medium text-slate-800 dark:text-slate-100">Email atau nomor WA <span className="text-red-600">*</span></label>
          <input className={`${input} mt-1.5`} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
          {missing.includes("__contact") && <p className="mt-1 text-xs text-red-600">Isi email atau nomor WA yang benar.</p>}
          <input className="hidden" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden="true" />
        </div>
      ) : (
        visibleIn(sections[step - 1][1]).map((q) => (
          <div key={q.key} className={`${box} ${missing.includes(q.key) ? "border-red-300 dark:border-red-800" : ""}`}>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.label}{q.required && <span className="text-red-600"> *</span>}</p>
            {q.type === "multi" && <p className="text-xs text-slate-400">{maxChoicesOf(q) ? `Pilih paling banyak ${maxChoicesOf(q)}` : "Boleh pilih lebih dari satu"}</p>}
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
        <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{q.min ?? 1} = {q.minLabel ?? "sangat rendah"}</span><span>{q.max ?? 5} = {q.maxLabel ?? "sangat tinggi"}</span></div>
      </div>
    );
  }
  const vals = Array.isArray(value) ? value.map(String) : value !== undefined ? [String(value)] : [];
  const max = maxChoicesOf(q);
  return (
    <div className="space-y-2">
      {(q.options ?? []).map((o) => {
        const picked = vals.includes(o.value);
        const full = !picked && max !== null && vals.length >= max; // sudah penuh: batalkan pilihan lain dulu
        return (
          <button key={o.value} type="button" disabled={full} className={`${opt} ${picked ? on : off} ${full ? "opacity-40" : ""}`}
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
