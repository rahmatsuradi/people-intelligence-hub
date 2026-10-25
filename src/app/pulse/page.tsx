"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import {
  ACTION_STATUS_LABEL, MIN_RESPONSES, deleteAction, distribution, groupAverage, lastChange, loadActions, loadRaisers, loadResponses,
  loadSummary, loadSurveys, periodLabel, periodsWithoutActions, recurringThemes, saveAction, trend,
  type ActionStatus, type AnswerValue, type PeriodSummary, type Survey, type SurveyAction, type SurveyQuestion, type SurveyResponse,
} from "@/lib/rr/pulse";

type Tab = "ringkasan" | "action" | "jawaban";

const STATUS_STYLE: Record<ActionStatus, string> = {
  belum: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  berjalan: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  selesai: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  dibatalkan: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

/** Skor tertinggi yang mungkin, untuk menulis "2,9 / 4". */
function maxScore(q: SurveyQuestion): number | null {
  if (q.type === "scale") return q.max ?? null;
  const s = (q.options ?? []).map((o) => o.score).filter((x): x is number => typeof x === "number");
  return s.length ? Math.max(...s) : null;
}

const fmt = (x: number | null, d = 1) => (x === null ? "—" : x.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }));

function answerText(v: AnswerValue | undefined): string {
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** Jawaban pilihan memakai label opsinya (mis. "Job-Related" → "Pekerjaannya sendiri"). */
function valuesLabel(q: SurveyQuestion, v: AnswerValue | undefined): string {
  if (v === undefined || v === null) return "";
  return (Array.isArray(v) ? v : [v]).map((x) => q.options?.find((o) => o.value === String(x))?.label ?? String(x)).join(", ");
}

type Draft = Partial<SurveyAction> & { raised_by?: string };

export default function PulsePage() {
  const { role, loading: roleLoading, canEdit } = useRole();
  const isHr = role === "hr";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [summary, setSummary] = useState<PeriodSummary[]>([]);
  const [actions, setActions] = useState<SurveyAction[]>([]);
  const [raisers, setRaisers] = useState<Map<string, string>>(new Map());
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [period, setPeriod] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    loadSurveys()
      .then((s) => { setSurveys(s); setSurveyId((cur) => cur || s.find((x) => x.key === "pulse_bulanan")?.id || s[0]?.id || ""); })
      .catch((e: Error) => toast(`Gagal memuat survei: ${e.message}`, "error"))
      .finally(() => setLoading(false));
  }, []);

  const reload = useCallback(() => {
    if (!surveyId || roleLoading) return;
    setLoading(true);
    Promise.all([
      loadSummary(surveyId), loadActions(surveyId),
      isHr ? loadRaisers() : Promise.resolve(new Map<string, string>()),
      isHr ? loadResponses(surveyId) : Promise.resolve([] as SurveyResponse[]),
    ])
      .then(([s, a, r, rs]) => {
        setSummary(s); setActions(a); setRaisers(r); setResponses(rs);
        setPeriod((cur) => (cur && s.some((p) => p.period === cur) ? cur : [...s].reverse().find((p) => !p.suppressed)?.period ?? ""));
      })
      .catch((e: Error) => toast(`Gagal memuat: ${e.message}`, "error"))
      .finally(() => setLoading(false));
  }, [surveyId, isHr, roleLoading]);
  useEffect(reload, [reload]);

  const survey = surveys.find((s) => s.id === surveyId);
  const qByKey = useMemo(() => new Map((survey?.questions ?? []).map((q) => [q.key, q])), [survey]);
  const headline = (survey?.headline ?? []).map((k) => qByKey.get(k)).filter((q): q is SurveyQuestion => !!q);
  const recurring = useMemo(() => recurringThemes(actions), [actions]);
  const stale = useMemo(() => periodsWithoutActions(summary, actions), [summary, actions]);
  const total = summary.reduce((a, p) => a + p.n, 0);

  const switchSurvey = (id: string) => { setSurveyId(id); setPeriod(""); setTab("ringkasan"); };

  const submitAction = async () => {
    if (!draft || !survey) return;
    if (!draft.title?.trim()) { toast("Isi butir action wajib diisi", "error"); return; }
    if (!draft.period) { toast("Periode wajib diisi", "error"); return; }
    const { raised_by, ...a } = draft;
    const err = await saveAction({ ...a, survey_id: survey.id, title: draft.title.trim(), period: draft.period, status: draft.status ?? "belum" }, isHr ? raised_by ?? "" : undefined);
    if (err) { toast(`Gagal menyimpan: ${err}`, "error"); return; }
    toast(draft.id ? "Action item diperbarui" : "Action item ditambahkan");
    setDraft(null);
    reload();
  };

  const removeAction = async (a: SurveyAction) => {
    if (!window.confirm(`Hapus action item "${a.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const err = await deleteAction(a.id);
    if (err) { toast(`Gagal menghapus: ${err}`, "error"); return; }
    toast("Action item dihapus");
    reload();
  };

  return (
    <AppShell activeNavId="pulse" title="Pulse Check & Feedback" subtitle="Suara karyawan dari survei rutin, beserta tindak lanjutnya">
      {!loading && surveys.length === 0 && (
        <Card><p className="text-sm text-slate-600 dark:text-slate-300">Belum ada survei tersimpan.</p></Card>
      )}

      {surveys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {surveys.map((s) => (
            <button key={s.id} type="button" onClick={() => switchSurvey(s.id)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm", s.id === surveyId ? "border-blue-500 bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
              {s.title}
            </button>
          ))}
        </div>
      )}

      {survey && (
        <>
          <Card>
            <p className="text-sm text-slate-700 dark:text-slate-200">{survey.description}</p>
            <p className="mt-1 text-xs text-slate-500">Pengisi: {survey.audience ?? "—"} · {total} jawaban · {summary.length} periode{survey.source ? ` · sumber: ${survey.source.replace(/^Drive: /, "Google Drive — ")}` : ""}</p>
            {!isHr && !roleLoading && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Nama pengisi, jawaban tertulis, dan siapa yang mengangkat tiap masalah hanya bisa dibuka tim HR — supaya karyawan tetap berani menulis jujur. Periode dengan kurang dari {MIN_RESPONSES} jawaban disembunyikan rinciannya.
              </p>
            )}
          </Card>

          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {([["ringkasan", "Ringkasan"], ["action", `Action List (${actions.length})`], ...(isHr ? [["jawaban", `Jawaban per orang (${responses.length})`]] : [])] as [Tab, string][]).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === k ? "border-blue-600 font-medium text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500")}>
                {label}
              </button>
            ))}
          </div>

          {tab === "ringkasan" && (
            <Ringkasan survey={survey} summary={summary} headline={headline} recurring={recurring} stale={stale}
              lastActionPeriod={actions.map((a) => a.period).sort().at(-1) ?? null}
              period={period} setPeriod={setPeriod} hasActions={actions.length > 0} onOpenActions={() => setTab("action")} loading={loading} />
          )}
          {tab === "action" && (
            <ActionList actions={actions} raisers={raisers} isHr={isHr} canEdit={canEdit}
              onAdd={() => setDraft({ status: "belum", period: summary.at(-1)?.period ?? "" })}
              onEdit={(a) => setDraft({ ...a, raised_by: raisers.get(a.id) ?? "" })} onDelete={removeAction} />
          )}
          {tab === "jawaban" && isHr && <Jawaban survey={survey} responses={responses} />}
        </>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{draft.id ? "Ubah action item" : "Action item baru"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Butir action</Label>
                <textarea className={inputClass} rows={2} value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Periode pulse check</Label>
                <input type="month" className={inputClass} value={(draft.period ?? "").slice(0, 7)} onChange={(e) => setDraft({ ...draft, period: e.target.value ? `${e.target.value}-01` : "" })} /></div>
              <div><Label>Status</Label>
                <select className={inputClass} value={draft.status ?? "belum"} onChange={(e) => setDraft({ ...draft, status: e.target.value as ActionStatus })}>
                  {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => <option key={s} value={s}>{ACTION_STATUS_LABEL[s]}</option>)}
                </select></div>
              <div><Label>Tema</Label>
                <input className={inputClass} list="pulse-themes" value={draft.theme ?? ""} onChange={(e) => setDraft({ ...draft, theme: e.target.value || null })} />
                <datalist id="pulse-themes">{[...new Set(actions.map((a) => a.theme).filter(Boolean))].map((t) => <option key={t} value={t as string} />)}</datalist></div>
              <div><Label>PIC</Label>
                <input className={inputClass} placeholder="mis. Owner, HR" value={draft.pic ?? ""} onChange={(e) => setDraft({ ...draft, pic: e.target.value || null })} /></div>
              <div className="sm:col-span-2"><Label>Rencana langkah</Label>
                <textarea className={inputClass} rows={3} value={draft.plan ?? ""} onChange={(e) => setDraft({ ...draft, plan: e.target.value || null })} /></div>
              <div className="sm:col-span-2"><Label>Hasil / tindak lanjut nyata</Label>
                <textarea className={inputClass} rows={2} value={draft.result ?? ""} onChange={(e) => setDraft({ ...draft, result: e.target.value || null })} /></div>
              {isHr && (
                <div className="sm:col-span-2"><Label>Diangkat oleh (hanya terlihat oleh HR)</Label>
                  <input className={inputClass} placeholder="mis. Firdaus, Winda" value={draft.raised_by ?? ""} onChange={(e) => setDraft({ ...draft, raised_by: e.target.value })} /></div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Batal</Button>
              <Button variant="primary" onClick={submitAction}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ─── Ringkasan ─── */

function Ringkasan({ survey, summary, headline, recurring, stale, lastActionPeriod, period, setPeriod, hasActions, onOpenActions, loading }: {
  survey: Survey; summary: PeriodSummary[]; headline: SurveyQuestion[]; recurring: ReturnType<typeof recurringThemes>; stale: string[]; lastActionPeriod: string | null;
  period: string; setPeriod: (p: string) => void; hasActions: boolean; onOpenActions: () => void; loading: boolean;
}) {
  const current = summary.find((p) => p.period === period);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const sections = useMemo(() => {
    const m = new Map<string, SurveyQuestion[]>();
    for (const q of survey.questions) {
      if (q.type === "text") continue;
      const k = q.section ?? "Lainnya";
      m.set(k, [...(m.get(k) ?? []), q]);
    }
    return [...m.entries()];
  }, [survey]);
  const multiPeriod = summary.length > 1;

  if (loading && !summary.length) return <Card><p className="text-sm text-slate-500">Memuat…</p></Card>;

  return (
    <div className="space-y-4">
      {(recurring.length > 0 || stale.length > 0) && (
        <Card className="border-red-200 dark:border-red-900">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">Perlu perhatian</h2>
          {stale.length > 0 && (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              Action List terakhir dibuat untuk periode {lastActionPeriod ? periodLabel(lastActionPeriod) : "—"}.
              {" "}{stale.map(periodLabel).join(", ")} sudah ada jawabannya tetapi belum punya action item.
            </p>
          )}
          {recurring.length > 0 && (
            <>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Keluhan yang terus diangkat di beberapa periode dan belum tuntas:</p>
              <ul className="mt-2 space-y-2">
                {recurring.slice(0, showAllThemes ? undefined : 5).map((t) => (
                  <li key={t.theme} className="rounded-lg bg-red-50/60 px-3 py-2 text-sm dark:bg-red-950/30">
                    <span className="font-medium capitalize text-slate-900 dark:text-white">{t.theme}</span>
                    <span className="text-slate-600 dark:text-slate-300"> — muncul di {t.periods.length} periode ({t.periods.map(periodLabel).join(", ")}), {t.open} dari {t.total} butir belum selesai.</span>
                    <p className="mt-0.5 text-xs text-slate-500">Terakhir: {t.latest.title}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-4">
                {recurring.length > 5 && (
                  <button type="button" className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300" onClick={() => setShowAllThemes((v) => !v)}>
                    {showAllThemes ? "Ringkas" : `Tampilkan ${recurring.length - 5} tema lainnya`}
                  </button>
                )}
                <button type="button" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={onOpenActions}>Buka Action List →</button>
              </div>
            </>
          )}
        </Card>
      )}
      {!hasActions && survey.cadence === "bulanan" && (
        <Card><p className="text-sm text-slate-600 dark:text-slate-300">Belum ada action item untuk survei ini.</p></Card>
      )}

      <div className={cn("grid gap-3", headline.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {headline.map((q) => {
          const pts = trend(q, summary);
          const c = lastChange(q, pts);
          const max = maxScore(q);
          return (
            <Card key={q.key}>
              <p className="text-xs text-slate-500">{q.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(c.current?.avg ?? null)}{max !== null && <span className="text-sm font-normal text-slate-400"> / {max}</span>}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {c.current ? `${periodLabel(c.current.period)} · ${c.current.n} jawaban` : "Belum ada data"}
                {q.higherIsBetter === false && " · makin rendah makin baik"}
              </p>
              {c.delta !== null && c.previous && (
                <p className={cn("mt-1 text-xs font-medium", c.better === true && "text-emerald-700 dark:text-emerald-400", c.better === false && "text-red-600")}>
                  {c.delta > 0 ? "▲" : c.delta < 0 ? "▼" : "■"} {fmt(Math.abs(c.delta), 2)} dibanding {periodLabel(c.previous.period)}
                  {c.better === true ? " (membaik)" : c.better === false ? " (memburuk)" : ""}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {multiPeriod && headline.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Tren per bulan</h2>
          <p className="text-xs text-slate-500">Bulan yang dinilai (formulir diisi di awal bulan berikutnya).</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">
                <th className="py-1.5 pr-3 font-medium">Bulan</th><th className="py-1.5 pr-3 text-right font-medium">Jawaban</th>
                {headline.map((q) => <th key={q.key} className="py-1.5 pr-3 font-medium">{q.label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.map((p) => (
                  <tr key={p.period} className={cn("cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50", p.period === period && "bg-blue-50/60 dark:bg-blue-950/30")} onClick={() => !p.suppressed && setPeriod(p.period)}>
                    <td className="py-1.5 pr-3">{periodLabel(p.period)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{p.n}</td>
                    {headline.map((q) => {
                      const a = trend(q, [p])[0];
                      const max = maxScore(q) ?? 1;
                      return (
                        <td key={q.key} className="py-1.5 pr-3">
                          {p.suppressed ? <span className="text-xs text-slate-400">&lt; {MIN_RESPONSES} jawaban</span> : (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-28 rounded bg-slate-100 dark:bg-slate-800">
                                <div className={cn("h-2 rounded", q.higherIsBetter === false ? "bg-amber-500" : "bg-blue-600")} style={{ width: `${Math.max(0, Math.min(100, ((a.avg ?? 0) / max) * 100))}%` }} />
                              </div>
                              <span className="tabular-nums">{fmt(a.avg)}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sebaran jawaban{current ? ` — ${periodLabel(current.period)} (${current.n} jawaban)` : ""}</h2>
          {multiPeriod && (
            <select className={cn(inputClass, "w-auto py-1 text-xs")} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {summary.map((p) => <option key={p.period} value={p.period} disabled={p.suppressed}>{periodLabel(p.period)}{p.suppressed ? " (disembunyikan)" : ""}</option>)}
            </select>
          )}
        </div>
        {!current ? <p className="mt-3 text-sm text-slate-500">Belum ada periode yang bisa ditampilkan.</p> : (
          <div className="mt-4 space-y-6">
            {sections.map(([section, qs]) => (
              <div key={section}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{section}</h3>
                <div className="mt-2 grid gap-4 lg:grid-cols-2">
                  {qs.map((q) => {
                    const s = current.questions[q.key];
                    const rows = distribution(q, s);
                    const avg = trend(q, [current])[0];
                    return (
                      <div key={q.key}>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{q.label}</p>
                        <p className="text-xs text-slate-500">
                          {s ? `${s.answered} dari ${current.n} menjawab` : "Tidak ada yang menjawab"}
                          {avg.avg !== null && ` · rata-rata ${fmt(avg.avg)}${maxScore(q) !== null ? ` / ${maxScore(q)}` : ""}`}
                          {q.type === "multi" && " · boleh pilih lebih dari satu"}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {rows.map((r) => (
                            <div key={r.value} className="flex items-center gap-2 text-xs">
                              <span className="w-44 shrink-0 truncate text-slate-600 dark:text-slate-300" title={r.label}>{r.label}</span>
                              <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-blue-600" style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                              <span className="w-16 shrink-0 text-right tabular-nums text-slate-500">{r.count} · {Math.round(r.pct)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Action List ─── */

function ActionList({ actions, raisers, isHr, canEdit, onAdd, onEdit, onDelete }: {
  actions: SurveyAction[]; raisers: Map<string, string>; isHr: boolean; canEdit: boolean;
  onAdd: () => void; onEdit: (a: SurveyAction) => void; onDelete: (a: SurveyAction) => void;
}) {
  const [status, setStatus] = useState<ActionStatus | "" | "terbuka">("terbuka");
  const [theme, setTheme] = useState("");
  const themes = [...new Set(actions.map((a) => a.theme ?? "lainnya"))].sort();
  const shown = actions.filter((a) =>
    (!status || (status === "terbuka" ? a.status === "belum" || a.status === "berjalan" : a.status === status)) && (!theme || (a.theme ?? "lainnya") === theme));
  const grouped = useMemo(() => {
    const m = new Map<string, SurveyAction[]>();
    for (const a of shown) m.set(a.period, [...(m.get(a.period) ?? []), a]);
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [shown]);
  const count = (s: ActionStatus) => actions.filter((a) => a.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["belum", "berjalan", "selesai", "dibatalkan"] as ActionStatus[]).map((s) => (
          <button key={s} type="button" className="text-left" onClick={() => setStatus(status === s ? "" : s)}>
            <Card className={cn("h-full", status === s && "border-blue-400")}>
              <p className="text-xs text-slate-500">{ACTION_STATUS_LABEL[s]}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s === "belum" && "text-red-600")}>{count(s)}</p>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <select className={cn(inputClass, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="terbuka">Belum selesai (belum jalan + berjalan)</option><option value="">Semua status</option>
            {(Object.keys(ACTION_STATUS_LABEL) as ActionStatus[]).map((s) => <option key={s} value={s}>{ACTION_STATUS_LABEL[s]}</option>)}
          </select>
          <select className={cn(inputClass, "w-auto")} value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">Semua tema</option>{themes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-slate-500">{shown.length} butir</span>
          {canEdit && <Button variant="primary" size="sm" className="ml-auto" onClick={onAdd}>+ Action item</Button>}
        </div>
      </Card>

      {grouped.length === 0 && <Card><p className="text-sm text-slate-500">Tidak ada butir yang cocok dengan saringan.</p></Card>}
      {grouped.map(([p, list]) => (
        <Card key={p} padding={false} className="overflow-hidden">
          <h3 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">Pulse check {periodLabel(p)}</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[a.status])}>{ACTION_STATUS_LABEL[a.status]}</span>
                  {a.theme && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.theme}</span>}
                  <p className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
                  {canEdit && (
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>Ubah</Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(a)}>Hapus</Button>
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-[auto_1fr]">
                  {a.pic && <><span className="text-slate-400">PIC</span><span>{a.pic}</span></>}
                  {a.plan && <><span className="text-slate-400">Rencana</span><span className="whitespace-pre-line">{a.plan}</span></>}
                  {a.result && <><span className="text-slate-400">Hasil</span><span className="whitespace-pre-line">{a.result}</span></>}
                  {isHr && raisers.get(a.id) && <><span className="text-slate-400">Diangkat oleh</span><span>{raisers.get(a.id)}</span></>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ─── Jawaban per orang (HR) ─── */

function Jawaban({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
  const [period, setPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [onlyText, setOnlyText] = useState(true);
  const [page, setPage] = useState(0);
  const periods = [...new Set(responses.map((r) => r.period))].sort().reverse();
  const textQs = survey.questions.filter((q) => q.type === "text" && !["store", "joined_since", "spv", "work_hours"].includes(q.key));
  const choiceQs = survey.questions.filter((q) => q.type !== "text");
  const q = search.trim().toLowerCase();
  const shown = responses.filter((r) =>
    (!period || r.period === period) &&
    (!onlyText || textQs.some((t) => answerText(r.answers[t.key]))) &&
    (!q || [r.respondent_name, ...Object.values(r.answers).map(answerText)].filter(Boolean).join(" ").toLowerCase().includes(q)));
  const pageSize = 30;
  const pageRows = shown.slice(page * pageSize, page * pageSize + pageSize);

  const hasSpv = survey.questions.some((x) => x.key === "spv");
  const spvQs = survey.headline.map((k) => survey.questions.find((x) => x.key === k)).filter((x): x is SurveyQuestion => !!x);

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Bagian ini hanya terlihat oleh tim HR. Jangan menyalin nama atau kutipan ke grup atau ke laporan untuk owner — kalau karyawan tahu jawabannya sampai ke atasan, survei berikutnya tidak akan jujur lagi.</p>
      </Card>

      {hasSpv && spvQs.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <h3 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white">Per SPV area</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">SPV</th><th className="px-4 py-2 text-right font-medium">SPG menjawab</th>
                {spvQs.map((x) => <th key={x.key} className="px-4 py-2 text-right font-medium">{x.label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {groupAverage(spvQs[0], responses, "spv").map((g) => (
                  <tr key={g.group}>
                    <td className="px-4 py-2">{g.group}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{responses.filter((r) => (answerText(r.answers.spv) || "Tidak diisi") === g.group).length}</td>
                    {spvQs.map((x) => {
                      const v = groupAverage(x, responses, "spv").find((h) => h.group === g.group);
                      return <td key={x.key} className="px-4 py-2 text-right tabular-nums">{fmt(v?.avg ?? null)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-slate-400">Diurutkan dari skor terendah pada kolom &ldquo;{spvQs[0].label}&rdquo;. Kelompok kecil mudah berubah karena satu-dua jawaban.</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {periods.length > 1 && (
            <select className={cn(inputClass, "w-auto")} value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }}>
              <option value="">Semua periode</option>{periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </select>
          )}
          <input className={cn(inputClass, "w-64")} placeholder="Cari nama atau isi jawaban…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={onlyText} onChange={(e) => { setOnlyText(e.target.checked); setPage(0); }} /> Hanya yang menulis cerita / usulan
          </label>
          <span className="text-xs text-slate-500">{shown.length} jawaban</span>
        </div>
      </Card>

      {pageRows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.respondent_name ?? "Tanpa nama"}
              {!r.employee_id && <span className="ml-2 text-[11px] font-normal text-slate-400">belum tertaut ke master karyawan</span>}</p>
            <p className="text-xs text-slate-500">{periodLabel(r.period)}{r.submitted_at ? ` · diisi ${new Date(r.submitted_at).toLocaleDateString("id-ID")}` : ""}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["store", "spv"].filter((k) => r.answers[k]).map((k) => (
              <span key={k} className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{k === "spv" ? "SPV " : ""}{answerText(r.answers[k])}</span>
            ))}
            {choiceQs.filter((x) => r.answers[x.key] !== undefined).slice(0, 8).map((x) => (
              <span key={x.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={x.label}>
                {x.label}: {valuesLabel(x, r.answers[x.key])}
              </span>
            ))}
          </div>
          <dl className="mt-2 space-y-1.5">
            {textQs.filter((t) => answerText(r.answers[t.key])).map((t) => (
              <div key={t.key}>
                <dt className="text-[11px] text-slate-400">{t.label}</dt>
                <dd className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{answerText(r.answers[t.key])}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}

      {shown.length > pageSize && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
          <span className="text-xs text-slate-500">Halaman {page + 1} dari {Math.ceil(shown.length / pageSize)}</span>
          <Button size="sm" disabled={(page + 1) * pageSize >= shown.length} onClick={() => setPage(page + 1)}>Berikutnya</Button>
        </div>
      )}
    </div>
  );
}
