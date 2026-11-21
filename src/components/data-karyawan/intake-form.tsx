"use client";

/* Formulir data karyawan, satu bagian per langkah, untuk diisi di HP.
   - Isian (tanpa berkas) disimpan di sessionStorage tab ini supaya tidak hilang saat halaman
     dimuat ulang ketika berpindah aplikasi — sessionStorage, bukan localStorage, karena HP
     outlet sering dipakai bergantian dan isian ini memuat NIK & rekening.
   - Foto KTP/KK/pas foto dikecilkan di HP sebelum dikirim (batas kiriman server ±4,5 MB).
   - Validasi yang menentukan ada di server; yang di sini hanya supaya pengisi cepat tahu. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENERAL_LOCATIONS, PDF_LIMIT_LABEL, type IntakeField } from "@/lib/kantorku/intake";

type DocKind = "ktp" | "kk" | "photo";
interface Payload {
  mode: "pribadi" | "umum";
  fields: IntakeField[];
  departments: string[];
  banks: { code: string; name: string }[];
  outlets: string[];
  prefill: Record<string, string>;
  recorded: Record<string, string>;
  docs: Record<DocKind, boolean>;
  docKinds: { key: DocKind; label: string }[];
}
interface FileVal { type: string; data: string; name: string; size: number }

const SECTIONS = ["Data diri", "Kontak & alamat", "Kontak darurat", "Pendidikan", "Pekerjaan", "Rekening, pajak & BPJS", "Dokumen"];
const box = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const input = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
const MAX_BYTES = 1_000_000;   // batas PDF (dikirim apa adanya)
/* Target foto ±600 KB: KTP/KK tetap terbaca di 1600 px, dan 300+ karyawan × 3 dokumen
   tetap muat di kuota penyimpanan Supabase paket gratis (1 GB). */
const PHOTO_TARGET = 600_000;

const session = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}

/** Foto dari kamera HP bisa 4–8 MB; dikecilkan ke JPEG ≤ ~600 KB (paling buruk ≤ 1 MB). PDF dikirim apa adanya. */
async function prepareFile(file: File): Promise<FileVal> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) throw new Error("PDF terlalu besar (maks 1 MB). Kirim foto saja.");
    return { type: file.type, data: await readAsDataUrl(file), name: file.name, size: file.size };
  }
  if (!file.type.startsWith("image/")) throw new Error("Pilih foto atau PDF.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Foto tidak bisa dibaca. Coba ambil ulang (format JPG/PNG).");
  let fallback: Blob | null = null;
  for (const [side, q] of [[1600, 0.8], [1400, 0.75], [1200, 0.7], [1000, 0.65], [900, 0.6]] as const) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale); c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= PHOTO_TARGET) return { type: "image/jpeg", data: await readAsDataUrl(blob), name: file.name, size: blob.size };
    if (blob && blob.size <= MAX_BYTES) fallback = blob;
  }
  if (fallback) return { type: "image/jpeg", data: await readAsDataUrl(fallback), name: file.name, size: fallback.size };
  throw new Error("Foto terlalu besar. Coba ambil ulang dengan resolusi lebih kecil.");
}

export function IntakeForm({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState<{ text: string; retry: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(-1); // -1 = layar pembuka
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Partial<Record<DocKind, FileVal>>>({});
  const [fileBusy, setFileBusy] = useState<DocKind | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [done, setDone] = useState<{ warning?: string } | null>(null);
  /* Isian belum cocok dengan KTP (dibalas server 409). Pengisi memperbaiki atau "Kirim tetap". */
  const [ktpWarn, setKtpWarn] = useState<{ field: string; message: string }[] | null>(null);
  const [website, setWebsite] = useState("");
  const submitting = useRef(false);
  const draftKey = `data-karyawan:${token}`;

  useEffect(() => {
    fetch(`/api/data-karyawan?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j) { setLoadError({ text: j?.error ?? "Formulir belum terbuka. Periksa koneksi lalu coba lagi.", retry: !j || r.status === 429 || r.status >= 500 }); return; }
        setData(j);
        let draft: { step?: number; answers?: Record<string, string> } | null = null;
        try { draft = JSON.parse(session()?.getItem(draftKey) ?? "null"); } catch { draft = null; }
        setAnswers({ ...j.prefill, ...(draft?.answers ?? {}) });
        if (draft && typeof draft.step === "number") setStep(draft.step);
      })
      .catch(() => setLoadError({ text: "Formulir belum terbuka. Periksa koneksi lalu coba lagi.", retry: true }));
  }, [token, attempt, draftKey]);

  useEffect(() => {
    if (!data || done) return;
    try { session()?.setItem(draftKey, JSON.stringify({ step, answers })); } catch { /* penyimpanan ditolak: tetap jalan */ }
  }, [answers, step, data, done, draftKey]);

  const fieldsOf = useCallback((section: string) => (data?.fields ?? []).filter((f) => f.section === section), [data]);
  const sections = useMemo(() => SECTIONS.filter((s) => s === "Dokumen" || fieldsOf(s).length), [fieldsOf]);

  const set = (k: string, v: string) => { setAnswers((a) => ({ ...a, [k]: v })); setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); setKtpWarn(null); };

  const missingIn = (section: string): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!data) return out;
    if (section === "Dokumen") {
      for (const d of data.docKinds) if (!files[d.key] && !data.docs[d.key]) out[d.key] = "Wajib diunggah";
      return out;
    }
    for (const f of fieldsOf(section)) {
      const v = (answers[f.key] ?? "").trim();
      if (f.required && !v && !data.recorded[f.key]) out[f.key] = "Wajib diisi";
      else if (v && f.key === "nik" && v.replace(/\D/g, "").length !== 16) out[f.key] = "NIK harus 16 digit";
      else if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) out[f.key] = "Email tidak valid";
    }
    return out;
  };

  const next = () => {
    const m = missingIn(sections[step]);
    if (Object.keys(m).length) { setErrors(m); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setStep((s) => s + 1); window.scrollTo({ top: 0 });
  };

  const pickFile = async (kind: DocKind, file: File | undefined) => {
    if (!file) return;
    setFileBusy(kind);
    try {
      const v = await prepareFile(file);
      setFiles((f) => ({ ...f, [kind]: v }));
      setKtpWarn(null);
      setErrors((e) => { const n = { ...e }; delete n[kind]; return n; });
    } catch (err) {
      setErrors((e) => ({ ...e, [kind]: (err as Error).message }));
    } finally { setFileBusy(null); }
  };

  /** Buka bagian tempat isian yang tidak cocok dengan KTP. */
  const fixKtp = () => {
    const f = ktpWarn?.[0]?.field;
    const i = !f || f === "ktp" ? sections.indexOf("Dokumen") : sections.findIndex((sec) => fieldsOf(sec).some((x) => x.key === f));
    if (i >= 0) setStep(i);
    window.scrollTo({ top: 0 });
  };

  const submit = async (confirmKtp = false) => {
    if (submitting.current) return;
    const m = missingIn("Dokumen");
    if (Object.keys(m).length) { setErrors(m); return; }
    submitting.current = true; setSending(true); setSendError("");
    try {
      const body = JSON.stringify({ token, answers, website, confirmKtp, files: Object.fromEntries(Object.entries(files).map(([k, f]) => [k, { type: f!.type, data: f!.data }])) });
      /* Ratusan karyawan bisa mengirim bersamaan (link massal lewat WA). Server sibuk
         (429/502/503/504) atau sinyal putus dicoba ulang otomatis sebelum menampilkan galat. */
      let r: Response | null = null;
      for (const wait of [0, 2_000, 5_000, 10_000]) {
        if (wait) await new Promise((res) => setTimeout(res, wait + Math.random() * 1_000));
        r = await fetch("/api/data-karyawan", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
        if (r && ![429, 502, 503, 504].includes(r.status)) break;
      }
      if (!r) throw new Error("network");
      const j = await r.json().catch(() => null);
      if (r.status === 409 && j?.ktp?.issues?.length) { setKtpWarn(j.ktp.issues); setSendError(""); return; }
      if (!r.ok) {
        if (j?.errors) {
          setErrors(j.errors);
          const first = sections.findIndex((s) => s === "Dokumen" ? data!.docKinds.some((d) => j.errors[d.key]) : fieldsOf(s).some((f) => j.errors[f.key]));
          if (first >= 0) setStep(first);
        }
        setSendError(j?.error ?? (r.status === 413 ? "Berkas terlalu besar. Ganti foto dengan ukuran lebih kecil." : "Gagal mengirim. Periksa koneksi lalu coba lagi."));
        return;
      }
      try { session()?.removeItem(draftKey); } catch { /* */ }
      setDone({ warning: j?.warning });
    } catch {
      setSendError("Gagal mengirim. Periksa koneksi lalu coba lagi.");
    } finally { submitting.current = false; setSending(false); }
  };

  if (loadError) return (
    <div className={box}>
      <p className="text-base text-slate-700 dark:text-slate-200">{loadError.text}</p>
      {loadError.retry && <button className={`${btn} mt-4 bg-blue-600 text-white`} onClick={() => { setLoadError(null); setAttempt((a) => a + 1); }}>Coba lagi</button>}
    </div>
  );
  if (!data) return <div className={box}><p className="text-sm text-slate-500">Memuat formulir…</p></div>;

  if (done) return (
    <div className={box}>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Terima kasih, data sudah terkirim.</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Tim HR akan memeriksa data Anda. Kalau ada yang perlu dibetulkan, HR akan menghubungi lewat WhatsApp.</p>
      {done.warning && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{done.warning}</p>}
      <p className="mt-3 text-xs text-slate-500">Data ini hanya dibuka oleh tim HR untuk administrasi kepegawaian, gaji, pajak, dan BPJS.</p>
    </div>
  );

  if (step < 0) return (
    <div className={box}>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Formulir data karyawan</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {data.mode === "pribadi"
          ? "Periksa dan lengkapi data Anda. Data yang sudah tercatat ditandai — biarkan kosong kalau tidak berubah."
          : "Isi data diri Anda untuk administrasi kepegawaian, gaji, pajak, dan BPJS."}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>Sekitar 10 menit, {sections.length} bagian.</li>
        <li>Siapkan KTP, Kartu Keluarga, buku tabungan, dan pas foto.</li>
        <li><b>Ukuran file:</b> foto dari HP boleh sebesar apa pun, otomatis dikecilkan. Kalau berupa PDF, maksimal {PDF_LIMIT_LABEL}. PDF lebih besar? Kirim fotonya saja.</li>
        <li>Data hanya dibuka oleh tim HR.</li>
      </ul>
      <button className={`${btn} mt-5 w-full bg-blue-600 text-white`} onClick={() => setStep(0)}>Mulai</button>
    </div>
  );

  const section = sections[step];
  const last = step === sections.length - 1;
  const errCount = Object.keys(errors).length;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500"><span>Bagian {step + 1} dari {sections.length}</span><span>{section}</span></div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${((step + 1) / sections.length) * 100}%` }} /></div>
      </div>

      <div className={box}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section}</h2>
        {errCount > 0 && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">Ada {errCount} isian yang perlu diperbaiki.</p>}

        <div className="mt-4 space-y-5">
          {section === "Dokumen" ? data.docKinds.map((d) => (
            <div key={d.key}>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">{d.label}{!data.docs[d.key] && <span className="text-red-600"> *</span>}</label>
              <p className="mt-0.5 text-xs text-slate-500">Foto (otomatis dikecilkan) atau PDF maksimal {PDF_LIMIT_LABEL}.</p>
              {data.docs[d.key] && !files[d.key] && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Sudah tercatat. Unggah lagi hanya kalau ada yang baru.</p>}
              <input type="file" accept="image/*,application/pdf" className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 dark:text-slate-300"
                onChange={(e) => pickFile(d.key, e.target.files?.[0])} />
              {fileBusy === d.key && <p className="mt-1 text-xs text-slate-500">Menyiapkan berkas…</p>}
              {files[d.key] && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Siap dikirim ({Math.round(files[d.key]!.size / 1024)} KB)</p>}
              {errors[d.key] && <p className="mt-1 text-xs text-red-600">{errors[d.key]}</p>}
            </div>
          )) : fieldsOf(section).map((f) => (
            <FieldInput key={f.key} f={f} value={answers[f.key] ?? ""} error={errors[f.key]} recorded={data.recorded[f.key]}
              options={f.dynamicOptions === "departments" ? data.departments.map((x) => ({ value: x, label: x }))
                : f.dynamicOptions === "banks" ? data.banks.map((b) => ({ value: b.code, label: b.name }))
                : (f.options ?? []).map((x) => ({ value: x, label: x }))}
              outlets={f.suggest === "outlets" ? [...GENERAL_LOCATIONS, ...data.outlets] : undefined}
              onChange={(v) => set(f.key, v)} />
          ))}
        </div>
        {/* isian jebakan bot — tidak terlihat orang */}
        <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      </div>

      {sendError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{sendError}</p>}
      {ktpWarn && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Periksa dulu — data belum cocok dengan KTP</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{ktpWarn.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
          <p className="mt-2 text-xs">Data belum terkirim. Perbaiki isiannya atau unggah ulang foto KTP Anda sendiri. Kalau semuanya sudah benar, tekan &quot;Kirim tetap&quot; — HR akan memeriksanya.</p>
          <div className="mt-3 flex gap-2">
            <button className={`${btn} flex-1 bg-amber-600 text-white`} onClick={fixKtp}>Perbaiki</button>
            <button className={`${btn} flex-1 border border-amber-400 bg-white text-amber-800 dark:bg-slate-900 dark:text-amber-200`} disabled={sending} onClick={() => submit(true)}>{sending ? "Mengirim…" : "Kirim tetap"}</button>
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button className={`${btn} flex-1 border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`} onClick={() => { setErrors({}); setStep((s) => s - 1); window.scrollTo({ top: 0 }); }}>Kembali</button>
        {last
          ? <button className={`${btn} flex-[2] bg-blue-600 text-white`} disabled={sending || !!fileBusy} onClick={() => submit(false)}>{sending ? "Mengirim…" : "Kirim data"}</button>
          : <button className={`${btn} flex-[2] bg-blue-600 text-white`} onClick={next}>Lanjut</button>}
      </div>
    </div>
  );
}

function FieldInput({ f, value, error, recorded, options, outlets, onChange }: {
  f: IntakeField; value: string; error?: string; recorded?: string; options: { value: string; label: string }[]; outlets?: string[]; onChange: (v: string) => void;
}) {
  const id = `f-${f.key}`;
  const required = f.required && !recorded;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800 dark:text-slate-100">{f.label}{required && <span className="text-red-600"> *</span>}</label>
      {f.help && <p className="mt-0.5 text-xs text-slate-500">{f.help}</p>}
      {recorded && !value && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Sudah tercatat{recorded !== "tercatat" ? ` (${recorded})` : ""}. Biarkan kosong kalau tidak berubah.</p>}
      <div className="mt-2">
        {f.type === "choice" && options.length <= 6 ? (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(value === o.value ? "" : o.value)}
                className={`rounded-xl border px-3 py-2 text-sm ${value === o.value ? "border-blue-600 bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
                {o.label}
              </button>
            ))}
          </div>
        ) : f.type === "choice" && options.length ? (
          <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Pilih…</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : f.type === "textarea" ? (
          <textarea id={id} className={input} rows={3} value={value} maxLength={f.maxLength} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <>
            <input id={id} className={input} value={value} maxLength={f.type === "digits" ? 30 : f.maxLength}
              type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
              inputMode={f.type === "digits" ? "numeric" : f.type === "tel" ? "tel" : undefined}
              autoComplete="off" list={outlets ? `${id}-list` : undefined} onChange={(e) => onChange(e.target.value)} />
            {outlets && <datalist id={`${id}-list`}>{outlets.map((o) => <option key={o} value={o} />)}</datalist>}
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
