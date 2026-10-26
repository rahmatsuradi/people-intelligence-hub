"use client";

import { useState } from "react";
import { Button, Card, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { CONCLUSION_CATEGORIES, RESPONSE_FLAG_LABEL, isVisible, periodLabel, saveConclusion, type Conclusion, type Survey, type SurveyResponse } from "@/lib/rr/pulse";

/** Isian identitas (outlet, SPV, jam kerja) bukan komentar — ditampilkan sebagai label saja. */
const IDENTITY = ["store", "joined_since", "spv", "work_hours"];

export function Comments({ survey, responses, period, conclusions, onConclusionSaved }: {
  survey: Survey; responses: SurveyResponse[]; period: string; conclusions?: Conclusion[]; onConclusionSaved?: () => void;
}) {
  const [q, setQ] = useState("");
  const [key, setKey] = useState("");
  const [showNames, setShowNames] = useState(false);
  const textQs = survey.questions.filter((x) => x.type === "text" && !IDENTITY.includes(x.key) && !x.hidden);
  const sections = new Set(textQs.map((t) => t.section));
  const labelOf = (t: (typeof textQs)[number]) => (sections.size > 1 && textQs.filter((x) => x.label === t.label).length > 1 ? `${t.section} — ${t.label}` : t.label);
  const rows = responses.filter((r) => r.period === period).flatMap((r) =>
    textQs.filter((t) => (!key || t.key === key) && isVisible(t, r.answers) && typeof r.answers[t.key] === "string" && String(r.answers[t.key]).trim())
      .map((t) => ({ id: `${r.id}-${t.key}`, r, label: labelOf(t), text: String(r.answers[t.key]) })));
  const s = q.trim().toLowerCase();
  const shown = s ? rows.filter((x) => x.text.toLowerCase().includes(s) || (showNames && x.r.respondent_name?.toLowerCase().includes(s))) : rows;
  const countBy = (k: string) => responses.filter((r) => r.period === period && typeof r.answers[k] === "string" && String(r.answers[k]).trim()).length;
  const majors = responses.filter((r) => r.period === period && typeof r.answers.major_feedback === "string").map((r) => String(r.answers.major_feedback));

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Hanya tim HR yang bisa membuka bagian ini. Nama disembunyikan secara bawaan supaya aman saat layar dilihat orang lain. Jangan menyalin nama atau kutipan ke grup atau laporan owner.</p>
      </Card>

      {conclusions && <ConclusionPanel survey={survey} period={period} conclusions={conclusions} onSaved={onConclusionSaved} />}

      {majors.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Major feedback (label HR) — {periodLabel(period)}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(majors.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <span key={t} className="rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">{t} · {n}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setKey("")} className={cn("rounded-full border px-3 py-1 text-xs", !key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>Semua ({rows.length})</button>
        {textQs.filter((t) => countBy(t.key) > 0).map((t) => (
          <button key={t.key} type="button" onClick={() => setKey(t.key)} className={cn("rounded-full border px-3 py-1 text-xs", key === t.key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            {labelOf(t)} ({countBy(t.key)})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input className={cn(inputClass, "w-72")} placeholder="Cari kata, mis. libur, gaji, SPV…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Tampilkan nama</label>
        <span className="text-xs text-slate-500">{shown.length} komentar · {periodLabel(period)}</span>
      </div>
      {shown.length === 0 && <Card><p className="text-sm text-slate-500">Tidak ada komentar yang cocok.</p></Card>}
      <ul className="grid gap-2 md:grid-cols-2">
        {shown.map((x) => (
          <li key={x.id} className={cn("rounded-xl border bg-white p-3 dark:bg-slate-900", x.r.excluded ? "border-dashed border-slate-300 opacity-70 dark:border-slate-700" : "border-slate-200 dark:border-slate-800")}>
            <p className="text-[11px] text-slate-400">{x.label}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{x.text}</p>
            <p className="mt-2 text-[11px] text-slate-400">
              {showNames ? (x.r.respondent_name ?? "Tanpa nama") : "Nama disembunyikan"}
              {typeof x.r.answers.store === "string" && showNames ? ` · ${x.r.answers.store}` : ""}
              {typeof x.r.answers.spv === "string" ? ` · SPV ${x.r.answers.spv}` : ""}
              {typeof x.r.answers.rater === "string" && showNames ? ` · penilai ${x.r.answers.rater}` : ""}
            </p>
            {x.r.flags?.filter((f) => RESPONSE_FLAG_LABEL[f]).map((f) => <p key={f} className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{RESPONSE_FLAG_LABEL[f]}</p>)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kesimpulan 4 kategori per bulan — pengganti sheet "Conclusion". */
function ConclusionPanel({ survey, period, conclusions, onSaved }: { survey: Survey; period: string; conclusions: Conclusion[]; onSaved?: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const now = conclusions.filter((c) => c.period === period);
  const extra = now.filter((c) => !(CONCLUSION_CATEGORIES as readonly string[]).includes(c.category));
  const save = async (category: string) => {
    const err = await saveConclusion({ survey_id: survey.id, period, category, body: draft });
    if (err) { toast(err, "error"); return; }
    toast("Kesimpulan disimpan");
    setEdit(null);
    onSaved?.();
  };
  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kesimpulan per kategori — {periodLabel(period)}</h2>
      <p className="text-xs text-slate-500">Empat kategori yang sama dengan sheet Conclusion. Kosong = belum dirangkum untuk bulan ini.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {CONCLUSION_CATEGORIES.map((cat) => {
          const c = now.find((x) => x.category === cat);
          return (
            <div key={cat} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</p>
                {edit !== cat && <Button size="sm" variant="ghost" onClick={() => { setEdit(cat); setDraft(c?.body ?? ""); }}>{c ? "Ubah" : "Isi"}</Button>}
              </div>
              {edit === cat ? (
                <div className="mt-2">
                  <textarea className={inputClass} rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Batal</Button><Button size="sm" variant="primary" onClick={() => save(cat)}>Simpan</Button></div>
                </div>
              ) : <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{c?.body.replace(/^\[[^\]]+\]\s*/, "") ?? <span className="text-slate-400">—</span>}</p>}
            </div>
          );
        })}
      </div>
      {extra.map((c) => (
        <div key={c.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="text-xs font-semibold text-slate-500">{c.category}</p>
          <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-200">{c.body}</p>
        </div>
      ))}
    </Card>
  );
}
