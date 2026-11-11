"use client";

import { useMemo, useState } from "react";
import { Button, Card, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import {
  CONCLUSION_CATEGORIES, RESPONSE_FLAG_LABEL, conclusionCategories, isVisible, periodLabel, saveConclusion,
  type Conclusion, type StoredInsight, type Survey, type SurveyResponse,
} from "@/lib/rr/pulse";
import { NON_OPINION_KEYS, PEMILIK_LABEL, buildProblemUnits, conclusionDraft, tagKey } from "@/lib/rr/pulse-themes";

/** Isian identitas (outlet, SPV, jam kerja) bukan komentar — ditampilkan sebagai label saja. */
const IDENTITY = ["store", "joined_since", "spv", "work_hours"];

export function Comments({ survey, responses, period, conclusions, onConclusionSaved, insight }: {
  survey: Survey; responses: SurveyResponse[]; period: string; conclusions?: Conclusion[]; onConclusionSaved?: () => void;
  /** Insight AI bulan ini: bila ada peta masalah, komentar dikelompokkan per isu di Kesimpulan per kategori. */
  insight?: StoredInsight | null;
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

      {conclusions && (
        <ConclusionPanel survey={survey} period={period} conclusions={conclusions} onSaved={onConclusionSaved}
          insight={insight?.period === period ? insight : null} responses={responses} showNames={showNames} setShowNames={setShowNames} />
      )}

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

type CommentRow = { k: string; r: SurveyResponse; label: string; text: string };

/**
 * Kesimpulan per kategori per bulan — pengganti sheet "Conclusion".
 * Bila Insight AI bulan ini sudah memetakan komentar (masalah_peta), tiap kategori menampilkan isu-isunya
 * beserta komentar aslinya, dan kategori yang masih kosong diberi usulan teks yang tinggal disimpan.
 * Teks yang sudah disimpan HR tidak pernah ditimpa otomatis.
 */
function ConclusionPanel({ survey, period, conclusions, onSaved, insight, responses, showNames, setShowNames }: {
  survey: Survey; period: string; conclusions: Conclusion[]; onSaved?: () => void;
  insight: StoredInsight | null; responses: SurveyResponse[]; showNames: boolean; setShowNames: (v: boolean) => void;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const categories = conclusionCategories(survey);
  const now = conclusions.filter((c) => c.period === period);
  const extra = now.filter((c) => !categories.includes(c.category));
  const content = insight?.content;
  const peta = content?.masalah_peta;
  const responden = content?.masalah_dasar?.responden ?? content?.dasar?.responden ?? 0;

  // Komentar asli per kode `${id jawaban}:${pertanyaan}` — dibaca langsung dari jawaban (tab ini khusus HR).
  const { byKey, untagged } = useMemo(() => {
    const inPeriod = responses.filter((r) => r.period === period && !r.excluded);
    const labelOf = new Map(survey.questions.map((q) => [q.key, q.label]));
    const map = new Map<string, CommentRow>();
    const units = buildProblemUnits(survey, inPeriod.map((r) => ({ id: r.id, answers: r.answers })), (x) => x, NON_OPINION_KEYS, null);
    const rById = new Map(inPeriod.map((r) => [r.id, r]));
    for (const u of units) for (const p of u.parts) {
      const r = rById.get(u.rid)!;
      map.set(tagKey(u.rid, p.key), { k: tagKey(u.rid, p.key), r, label: labelOf.get(p.key) ?? p.key, text: String(r.answers[p.key]) });
    }
    const loose = peta ? [...map.values()].filter((c) => !peta.tags[c.k]?.length) : [];
    return { byKey: map, untagged: loose };
  }, [responses, period, survey, peta]);

  const commentsOf = (themeId: string) => (peta ? Object.entries(peta.tags).filter(([, ids]) => ids.includes(themeId)).map(([k]) => byKey.get(k)).filter((c): c is CommentRow => !!c) : []);
  const suggestion = (cat: string) => (peta && content ? conclusionDraft(cat, peta, content.masalah_utama ?? [], responden, content.masalah_dasar?.kelompok_label ?? null) : "");

  const save = async (category: string, body: string) => {
    const err = await saveConclusion({ survey_id: survey.id, period, category, body });
    if (err) { toast(err, "error"); return false; }
    return true;
  };
  const saveEdit = async (category: string) => {
    if (!(await save(category, draft))) return;
    toast("Kesimpulan disimpan");
    setEdit(null);
    onSaved?.();
  };
  const emptyWithSuggestion = categories.filter((cat) => !now.some((c) => c.category === cat) && suggestion(cat));
  const fillAll = async () => {
    if (!window.confirm(`Simpan usulan dari komentar ke ${emptyWithSuggestion.length} kategori yang masih kosong? Kategori yang sudah diisi tidak diubah.`)) return;
    setBusy(true);
    let ok = 0;
    for (const cat of emptyWithSuggestion) if (await save(cat, suggestion(cat))) ok++;
    setBusy(false);
    toast(`${ok} kategori diisi dari komentar — periksa dan ubah bila perlu`);
    onSaved?.();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kesimpulan per kategori — {periodLabel(period)}</h2>
          <p className="text-xs text-slate-500">
            {categories.length > CONCLUSION_CATEGORIES.length ? "Empat kategori sheet Conclusion + Kinerja SPV." : "Empat kategori yang sama dengan sheet Conclusion."} Kosong = belum dirangkum untuk bulan ini.
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {peta
              ? `Isu & komentar di tiap kategori dipetakan Insight AI (${new Date(insight!.created_at).toLocaleDateString("id-ID")}). Jumlah = orang yang menyebut, dihitung pasti; AI bisa keliru menempatkan komentar — periksa sebelum dipakai.`
              : "Buat atau buat ulang Insight AI di tab Dashboard supaya komentar bulan ini dipetakan ke isu dan kategori di sini."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peta && <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Tampilkan nama</label>}
          {emptyWithSuggestion.length > 0 && <Button size="sm" variant="primary" onClick={fillAll} disabled={busy}>{busy ? "Menyimpan…" : `Isi ${emptyWithSuggestion.length} kategori kosong dari komentar`}</Button>}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {categories.map((cat) => {
          const c = now.find((x) => x.category === cat);
          const sug = suggestion(cat);
          const isu = peta?.tema.filter((t) => t.kategori === cat) ?? [];
          return (
            <div key={cat} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</p>
                {edit !== cat && <Button size="sm" variant="ghost" onClick={() => { setEdit(cat); setDraft(c?.body ?? sug); }}>{c ? "Ubah" : "Isi"}</Button>}
              </div>
              {edit === cat ? (
                <div className="mt-2">
                  <textarea className={inputClass} rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {sug && draft !== sug && <Button size="sm" variant="ghost" onClick={() => setDraft(c?.body && !draft.includes(sug) ? `${draft.trim()}\n${sug}` : sug)}>{c?.body ? "Tambahkan usulan dari komentar" : "Pakai usulan dari komentar"}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Batal</Button><Button size="sm" variant="primary" onClick={() => saveEdit(cat)}>Simpan</Button>
                  </div>
                </div>
              ) : c ? (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{c.body.replace(/^\[[^\]]+\]\s*/, "")}</p>
              ) : sug ? (
                <div className="mt-2 rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-950/20">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Usulan dari komentar — belum disimpan</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{sug}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="primary" onClick={async () => { if (await save(cat, sug)) { toast("Kesimpulan disimpan"); onSaved?.(); } }}>Simpan</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEdit(cat); setDraft(sug); }}>Ubah dulu</Button>
                  </div>
                </div>
              ) : <p className="mt-1 text-sm text-slate-400">—</p>}

              {isu.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Isu dari komentar</p>
                  <ul className="mt-1 space-y-1">
                    {isu.map((t) => {
                      const list = commentsOf(t.id);
                      return (
                        <li key={t.id}>
                          <details className="group rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-slate-800 dark:text-slate-100"><span className="mr-1 text-slate-400 group-open:rotate-90 inline-block transition-transform">›</span>{t.nama}</span>
                              <span className="shrink-0 text-slate-500">{t.jumlah} orang{responden ? ` · ${Math.round((t.jumlah / responden) * 100)}%` : ""} · {list.length} komentar</span>
                            </summary>
                            <p className="mt-1 text-[11px] text-slate-400">{PEMILIK_LABEL[t.pemilik]}</p>
                            <CommentList rows={list} showNames={showNames} />
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {peta && untagged.length > 0 && (
        <details className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <summary className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">Komentar keluhan/usulan yang tidak masuk isu mana pun ({untagged.length}) — baca sendiri, bisa jadi isu penting yang hanya disebut sekali</summary>
          <CommentList rows={untagged} showNames={showNames} />
        </details>
      )}
      {extra.map((c) => (
        <div key={c.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <p className="text-xs font-semibold text-slate-500">{c.category}</p>
          <p className="mt-1 whitespace-pre-line text-slate-700 dark:text-slate-200">{c.body}</p>
        </div>
      ))}
    </Card>
  );
}

function CommentList({ rows, showNames }: { rows: CommentRow[]; showNames: boolean }) {
  if (!rows.length) return <p className="mt-1 text-[11px] text-slate-400">Komentarnya tidak ditemukan lagi (mungkin dikeluarkan dari hitungan setelah insight dibuat).</p>;
  return (
    <ul className="mt-1 max-h-80 space-y-1.5 overflow-y-auto pr-1">
      {rows.map((x) => (
        <li key={x.k} className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="whitespace-pre-line text-xs text-slate-800 dark:text-slate-100">{x.text}</p>
          <p className="mt-1 text-[10px] text-slate-400">
            {x.label}
            {typeof x.r.answers.spv === "string" ? ` · SPV ${x.r.answers.spv}` : ""}
            {showNames ? ` · ${x.r.respondent_name ?? "Tanpa nama"}${typeof x.r.answers.store === "string" ? ` · ${x.r.answers.store}` : ""}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
