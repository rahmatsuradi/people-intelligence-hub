"use client";

import { useState } from "react";
import { Card, cn, inputClass } from "@/components/app-shell";
import { isVisible, periodLabel, type Survey, type SurveyResponse } from "@/lib/rr/pulse";

/** Isian identitas (outlet, SPV, jam kerja) bukan komentar — ditampilkan sebagai label saja. */
const IDENTITY = ["store", "joined_since", "spv", "work_hours"];

export function Comments({ survey, responses, period }: { survey: Survey; responses: SurveyResponse[]; period: string }) {
  const [q, setQ] = useState("");
  const [key, setKey] = useState("");
  const [showNames, setShowNames] = useState(false);
  const textQs = survey.questions.filter((x) => x.type === "text" && !IDENTITY.includes(x.key));
  const rows = responses.filter((r) => r.period === period).flatMap((r) =>
    textQs.filter((t) => (!key || t.key === key) && isVisible(t, r.answers) && typeof r.answers[t.key] === "string" && String(r.answers[t.key]).trim())
      .map((t) => ({ id: `${r.id}-${t.key}`, r, label: t.label, text: String(r.answers[t.key]) })));
  const s = q.trim().toLowerCase();
  const shown = s ? rows.filter((x) => x.text.toLowerCase().includes(s) || (showNames && x.r.respondent_name?.toLowerCase().includes(s))) : rows;
  const countBy = (k: string) => responses.filter((r) => r.period === period && typeof r.answers[k] === "string" && String(r.answers[k]).trim()).length;

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Hanya tim HR yang bisa membuka bagian ini. Nama disembunyikan secara bawaan supaya aman saat layar dilihat orang lain. Jangan menyalin nama atau kutipan ke grup atau laporan owner.</p>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setKey("")} className={cn("rounded-full border px-3 py-1 text-xs", !key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>Semua ({rows.length})</button>
        {textQs.map((t) => (
          <button key={t.key} type="button" onClick={() => setKey(t.key)} className={cn("rounded-full border px-3 py-1 text-xs", key === t.key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
            {t.label} ({countBy(t.key)})
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
          <li key={x.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] text-slate-400">{x.label}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{x.text}</p>
            <p className="mt-2 text-[11px] text-slate-400">
              {showNames ? (x.r.respondent_name ?? "Tanpa nama") : "Nama disembunyikan"}
              {typeof x.r.answers.store === "string" && showNames ? ` · ${x.r.answers.store}` : ""}
              {typeof x.r.answers.spv === "string" ? ` · SPV ${x.r.answers.spv}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
