"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Jawaban lengkap (khusus HR) — setiap isian dibuka dari pertanyaan pertama sampai terakhir,
   persis urutan formulir, beserta riwayat orang yang sama di bulan-bulan lain.

   Pengganti membuka sheet mentah: tab Komentar hanya menampilkan jawaban teks, sedangkan di sini
   pilihan, skala, kunjungan SPV, coaching, dan label HR ikut terlihat dalam satu kartu.
   Nama & outlet disembunyikan secara bawaan (sama dengan tab Komentar).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Button, Card, cn, inputClass } from "@/components/app-shell";
import { RESPONSE_FLAG_LABEL, isVisible, periodLabel, type AnswerValue, type Survey, type SurveyQuestion, type SurveyResponse } from "@/lib/rr/pulse";
import { personKey, personScore } from "@/lib/rr/pulse-bi";

/** Jawaban yang menunjuk orang/tempat pengisi — ikut disembunyikan bersama nama. */
const IDENTIFYING = ["store", "rater"];
const PAGE = 60;

const isEmpty = (v: AnswerValue | undefined) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
const asText = (v: AnswerValue | undefined) => (isEmpty(v) ? "" : Array.isArray(v) ? v.join("; ") : String(v));
const dateId = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export function ResponseBrowser({ survey, responses, period }: { survey: Survey; responses: SurveyResponse[]; period: string }) {
  const periods = useMemo(() => [...new Set(responses.map((r) => r.period))].sort().reverse(), [responses]);
  const [per, setPer] = useState<string>(period && periods.includes(period) ? period : "all");
  const [spv, setSpv] = useState("");
  const [q, setQ] = useState("");
  const [showNames, setShowNames] = useState(false);
  const [withExcluded, setWithExcluded] = useState(false);
  const [onlyText, setOnlyText] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<string | null>(null);

  const scaleKeys = survey.questions.filter((x) => x.type === "scale" && !x.hidden).map((x) => x.key);
  const textKeys = survey.questions.filter((x) => x.type === "text" && !IDENTIFYING.includes(x.key)).map((x) => x.key);
  const spvQ = survey.questions.find((x) => x.key === "spv" && x.type === "choice");
  const spvOptions = spvQ ? [...new Set(responses.map((r) => asText(r.answers.spv)).filter(Boolean))].sort() : [];

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return responses
      .filter((r) => (per === "all" || r.period === per) && (withExcluded || !r.excluded) && (!spv || asText(r.answers.spv) === spv))
      .filter((r) => !onlyText || textKeys.some((k) => !isEmpty(r.answers[k])))
      .filter((r) => {
        if (!s) return true;
        const hay = Object.entries(r.answers).filter(([k]) => showNames || !IDENTIFYING.includes(k)).map(([, v]) => asText(v)).join(" ").toLowerCase();
        return hay.includes(s) || (showNames && (r.respondent_name ?? "").toLowerCase().includes(s));
      })
      .sort((a, b) => b.period.localeCompare(a.period) || (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  }, [responses, per, withExcluded, spv, onlyText, q, showNames, textKeys]);

  const selected = list.find((r) => r.id === sel) ?? responses.find((r) => r.id === sel) ?? null;
  const history = useMemo(() => {
    if (!selected) return [];
    const k = personKey(selected);
    return k ? responses.filter((r) => personKey(r) === k).sort((a, b) => a.period.localeCompare(b.period) || (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")) : [selected];
  }, [selected, responses]);

  const downloadCsv = () => {
    const qs = survey.questions.filter((x) => showNames || !IDENTIFYING.includes(x.key));
    const head = ["Bulan dinilai", "Waktu isi", ...(showNames ? ["Nama"] : []), "Dihitung", "Catatan data", ...qs.map((x) => (x.section ? `${x.section} — ${x.label}` : x.label))];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = list.map((r) => [periodLabel(r.period), r.submitted_at ?? "", ...(showNames ? [r.respondent_name ?? ""] : []), r.excluded ? "Tidak (isian ganda)" : "Ya",
      (r.flags ?? []).map((f) => RESPONSE_FLAG_LABEL[f] ?? f).join("; "), ...qs.map((x) => asText(r.answers[x.key]))]);
    const csv = "﻿" + [head, ...rows].map((row) => row.map((c) => esc(String(c))).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${survey.key}-${per === "all" ? "semua-bulan" : per.slice(0, 7)}${showNames ? "-dengan-nama" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Hanya tim HR yang bisa membuka bagian ini. Nama dan outlet disembunyikan secara bawaan; centang &ldquo;Tampilkan nama&rdquo; hanya bila layar tidak dilihat orang lain. Unduhan CSV mengikuti pilihan ini.</p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <select className={inputClass} style={{ width: "auto" }} value={per} onChange={(e) => { setPer(e.target.value); setLimit(PAGE); }} aria-label="Bulan">
          <option value="all">Semua bulan ({responses.filter((r) => withExcluded || !r.excluded).length})</option>
          {periods.map((p) => <option key={p} value={p}>{periodLabel(p)} ({responses.filter((r) => r.period === p && (withExcluded || !r.excluded)).length})</option>)}
        </select>
        {spvOptions.length > 0 && (
          <select className={inputClass} style={{ width: "auto" }} value={spv} onChange={(e) => { setSpv(e.target.value); setLimit(PAGE); }} aria-label="SPV">
            <option value="">Semua SPV</option>
            {spvOptions.map((s) => <option key={s} value={s}>SPV {s}</option>)}
          </select>
        )}
        <input className={cn(inputClass, "w-64")} placeholder="Cari di semua jawaban…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={onlyText} onChange={(e) => setOnlyText(e.target.checked)} /> Hanya yang menulis komentar</label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={withExcluded} onChange={(e) => setWithExcluded(e.target.checked)} /> Sertakan isian ganda</label>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} /> Tampilkan nama</label>
        <Button size="sm" variant="secondary" onClick={downloadCsv} disabled={!list.length}>Unduh CSV ({list.length})</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card padding={false} className="overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">{list.length} isian · klik untuk membuka</div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {list.slice(0, limit).map((r, i) => {
              const sc = scaleKeys.length ? personScore(r, scaleKeys) : null;
              const nText = textKeys.filter((k) => !isEmpty(r.answers[k])).length;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setSel(r.id)}
                    className={cn("flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60", sel === r.id && "bg-blue-50 dark:bg-blue-950/30", r.excluded && "opacity-60")}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                        {showNames ? (r.respondent_name ?? "Tanpa nama") : `Isian #${i + 1}`}
                        {showNames && asText(r.answers.store) ? <span className="font-normal text-slate-500"> · {asText(r.answers.store)}</span> : null}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {periodLabel(r.period)}{asText(r.answers.spv) ? ` · SPV ${asText(r.answers.spv)}` : ""}{showNames && asText(r.answers.rater) ? ` · penilai ${asText(r.answers.rater)}` : ""}
                        {nText ? ` · ${nText} komentar` : ""}{r.excluded ? " · tidak dihitung" : ""}
                      </span>
                    </span>
                    {sc !== null && <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">{sc.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</span>}
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">Tidak ada isian yang cocok.</li>}
          </ul>
          {list.length > limit && <div className="border-t border-slate-100 p-2 text-center dark:border-slate-800"><Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Tampilkan {Math.min(PAGE, list.length - limit)} lagi</Button></div>}
        </Card>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {!selected ? (
            <Card><p className="text-sm text-slate-500">Pilih satu isian di kiri untuk melihat seluruh jawabannya dari awal sampai akhir.</p></Card>
          ) : (
            <>
              <ResponseCard survey={survey} r={selected} showNames={showNames} scaleKeys={scaleKeys} />
              {history.length > 1 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Riwayat orang ini ({history.length} isian)</h3>
                  <p className="text-xs text-slate-500">Dicocokkan dari nama + outlet yang sama. Klik untuk membuka isian bulan lain.</p>
                  <ol className="mt-2 flex flex-wrap gap-1.5">
                    {history.map((h) => {
                      const sc = scaleKeys.length ? personScore(h, scaleKeys) : null;
                      return (
                        <li key={h.id}>
                          <button type="button" onClick={() => setSel(h.id)}
                            className={cn("rounded-lg border px-2.5 py-1 text-xs", h.id === selected.id ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300", h.excluded && "border-dashed")}>
                            {periodLabel(h.period)}{sc !== null ? ` · ${sc.toLocaleString("id-ID", { maximumFractionDigits: 1 })}` : ""}{h.excluded ? " · ganda" : ""}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Satu isian, semua pertanyaan dalam urutan formulir, dikelompokkan per bagian. Bagian yang seluruhnya kosong diringkas satu baris. */
function ResponseCard({ survey, r, showNames, scaleKeys }: { survey: Survey; r: SurveyResponse; showNames: boolean; scaleKeys: string[] }) {
  const sections: { name: string; qs: SurveyQuestion[] }[] = [];
  // 360: "Penilaian rekan — blok N" diberi nama SPV yang dinilai bila pemetaannya sudah dipastikan (config.targets).
  const sectionName = (sec: string) => {
    const m = /blok (\d+)/i.exec(sec);
    const who = m ? survey.config.targets?.[`b${m[1]}`] : null;
    return who ? `${sec} (menilai ${who})` : sec;
  };
  for (const x of survey.questions) {
    const name = sectionName(x.section ?? "Jawaban");
    const last = sections.at(-1);
    if (last && last.name === name) last.qs.push(x); else sections.push({ name, qs: [x] });
  }
  const sc = scaleKeys.length ? personScore(r, scaleKeys) : null;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{showNames ? (r.respondent_name ?? "Tanpa nama") : "Nama disembunyikan"}</h3>
          <p className="text-xs text-slate-500">Menilai {periodLabel(r.period)} · diisi {dateId(r.submitted_at)}{r.excluded ? " · tidak dihitung (isian ganda)" : ""}</p>
        </div>
        {sc !== null && <div className="text-right"><p className="text-[11px] text-slate-500">Rata-rata skala</p><p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{sc.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p></div>}
      </div>
      {(r.flags ?? []).length > 0 && (
        <ul className="mt-2 space-y-0.5">{r.flags!.map((f) => <li key={f} className="text-[11px] text-amber-700 dark:text-amber-400">{RESPONSE_FLAG_LABEL[f] ?? f}</li>)}</ul>
      )}
      <div className="mt-3 space-y-3">
        {sections.map((s, si) => {
          const filled = s.qs.filter((x) => !isEmpty(r.answers[x.key]));
          if (!filled.length) return <p key={`${s.name}-${si}`} className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-400 dark:bg-slate-800/50">{s.name} — tidak diisi</p>;
          return (
            <section key={`${s.name}-${si}`}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.name}</h4>
              <dl className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                {s.qs.map((x) => {
                  const v = r.answers[x.key];
                  const hidden = !showNames && IDENTIFYING.includes(x.key);
                  const skipped = !isVisible(x, r.answers);
                  return (
                    <div key={x.key} className="grid gap-1 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
                      <dt className="text-xs text-slate-500">{x.label}{x.hidden ? " (diisi HR)" : ""}</dt>
                      <dd className="text-sm text-slate-800 dark:text-slate-100">
                        {hidden ? <span className="text-slate-400">disembunyikan</span>
                          : isEmpty(v) ? <span className="text-slate-400">{skipped ? "tidak ditanyakan" : "—"}</span>
                          : <Answer q={x} v={v} />}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
      </div>
    </Card>
  );
}

function Answer({ q, v }: { q: SurveyQuestion; v: AnswerValue }) {
  if (q.type === "scale" && typeof v === "number") {
    const max = q.max ?? 5;
    const min = q.min ?? 1;
    const p = ((v - min) / Math.max(1, max - min)) * 100;
    return (
      <span className="flex items-center gap-2">
        <span className="w-10 font-semibold tabular-nums">{v}<span className="text-xs font-normal text-slate-400">/{max}</span></span>
        <span className="h-2 w-28 rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-2 rounded-full" style={{ width: `${p}%`, background: p >= 75 ? "#256abf" : p >= 50 ? "#6da7ec" : "#e34948" }} /></span>
      </span>
    );
  }
  if (Array.isArray(v)) return <span className="flex flex-wrap gap-1">{v.map((x) => <span key={String(x)} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{String(x)}</span>)}</span>;
  return <span className="whitespace-pre-line">{String(v)}</span>;
}
