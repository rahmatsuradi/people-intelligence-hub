"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Check & Feedback — dirancang mengikuti pola HRIS survei karyawan
   (Culture Amp, Peakon/Workday, Lattice): satu siklus per bulan → link isi →
   skor "% favorable" & tren → rincian per kelompok → komentar bertema →
   maksimal 3 fokus → tindak lanjut → kabari balik karyawan.
   Logika hitung ada di src/lib/rr/pulse.ts (diuji); halaman ini hanya merangkai.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import {
  ACTION_STATUS_LABEL, deleteAction, loadActions, loadCampaigns, loadInsight, loadRaisers, loadResponses, loadSegments, loadSummary, loadSurveys,
  periodLabel, saveAction, signals as buildSignals,
  type ActionStatus, type Campaign, type PeriodSummary, type SegmentPeriod, type StoredInsight, type Survey, type SurveyAction, type SurveyResponse,
} from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";
import { Overview } from "@/components/pulse/overview";
import { ActionsBoard } from "@/components/pulse/actions-board";
import { Comments } from "@/components/pulse/comments";
import { Details } from "@/components/pulse/details";
import { Campaigns } from "@/components/pulse/campaigns";

type Tab = "ringkasan" | "tindak" | "komentar" | "detail" | "kirim";
const SEGMENT_LABEL: Record<string, string> = { tenure: "Lama kerja", spv: "SPV area" };
type Draft = Partial<SurveyAction> & { raised_by?: string };
const GUIDE_KEY = "pulse-guide-hidden";

export default function PulsePage() {
  const { role, loading: roleLoading, canEdit } = useRole();
  const isHr = role === "hr";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [summary, setSummary] = useState<PeriodSummary[]>([]);
  const [segments, setSegments] = useState<SegmentPeriod[]>([]);
  const [actions, setActions] = useState<SurveyAction[]>([]);
  const [raisers, setRaisers] = useState<Map<string, string>>(new Map());
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insight, setInsight] = useState<StoredInsight | null>(null);
  const [period, setPeriod] = useState("");
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [guideHidden, setGuideHidden] = useState(true);

  useEffect(() => {
    try { setGuideHidden(localStorage.getItem(GUIDE_KEY) === "1"); } catch { setGuideHidden(false); }
    loadSurveys()
      .then((s) => { setSurveys(s); setSurveyId((cur) => cur || s.find((x) => x.key === "pulse_bulanan")?.id || s[0]?.id || ""); })
      .catch((e: Error) => toast(`Gagal memuat survei: ${e.message}`, "error"))
      .finally(() => setLoading(false));
  }, []);

  const survey = surveys.find((s) => s.id === surveyId);
  const segKey = survey?.segments?.[0] ?? "";

  const reload = useCallback(() => {
    if (!surveyId || roleLoading) return;
    setLoading(true);
    Promise.all([
      loadSummary(surveyId), loadActions(surveyId), loadCampaigns(surveyId),
      segKey ? loadSegments(surveyId, segKey) : Promise.resolve([] as SegmentPeriod[]),
      isHr ? loadRaisers() : Promise.resolve(new Map<string, string>()),
      isHr ? loadResponses(surveyId) : Promise.resolve([] as SurveyResponse[]),
    ])
      .then(([s, a, c, seg, r, rs]) => {
        setSummary(s); setActions(a); setCampaigns(c); setSegments(seg); setRaisers(r); setResponses(rs);
        setPeriod((cur) => (cur && s.some((p) => p.period === cur) ? cur : [...s].reverse().find((p) => !p.suppressed)?.period ?? s.at(-1)?.period ?? ""));
      })
      .catch((e: Error) => toast(`Gagal memuat: ${e.message}`, "error"))
      .finally(() => setLoading(false));
  }, [surveyId, segKey, isHr, roleLoading]);
  useEffect(reload, [reload]);

  useEffect(() => {
    if (!surveyId || !period) { setInsight(null); return; }
    loadInsight(surveyId, period).then(setInsight).catch(() => setInsight(null));
  }, [surveyId, period]);

  const current = summary.find((p) => p.period === period);
  const campaign = campaigns.find((c) => c.period === period) ?? null;
  const segNow = segments.find((s) => s.period === period) ?? null;
  const sig = useMemo(() => survey && period ? buildSignals({
    survey, summaries: summary, period, actions, segments: segNow, segmentLabel: SEGMENT_LABEL[segKey] ?? segKey, targetCount: campaign?.target_count,
  }) : [], [survey, summary, period, actions, segNow, segKey, campaign]);
  const periods = [...new Set([...summary.map((p) => p.period), ...campaigns.map((c) => c.period)])].sort().reverse();
  const openCount = actions.filter((a) => a.status === "belum" || a.status === "berjalan").length;
  const commentCount = responses.filter((r) => r.period === period).length;

  const hideGuide = (v: boolean) => { setGuideHidden(v); try { localStorage.setItem(GUIDE_KEY, v ? "1" : "0"); } catch { /* abaikan */ } };
  const switchSurvey = (id: string) => { setSurveyId(id); setPeriod(""); setTab("ringkasan"); };

  const submitDraft = async () => {
    if (!draft || !survey) return;
    if (!draft.title?.trim()) { toast("Judul tindak lanjut wajib diisi", "error"); return; }
    if (!draft.period) { toast("Bulan wajib diisi", "error"); return; }
    const { raised_by, ...a } = draft;
    const err = await saveAction({ ...a, survey_id: survey.id, title: draft.title.trim(), period: draft.period, status: draft.status ?? "belum" }, isHr ? raised_by ?? "" : undefined);
    if (err) { toast(`Gagal menyimpan: ${err}`, "error"); return; }
    toast(draft.id ? "Tindak lanjut diperbarui" : "Tindak lanjut ditambahkan");
    setDraft(null);
    reload();
  };

  const patchAction = async (a: SurveyAction, patch: Partial<SurveyAction>) => {
    const err = await saveAction({ id: a.id, survey_id: a.survey_id, title: a.title, period: a.period, ...patch });
    if (err) { toast(`Gagal menyimpan: ${err}`, "error"); return; }
    setActions((list) => list.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    if (patch.status === "selesai") toast("Selesai! Isi \"Yang disampaikan ke karyawan\" lewat tombol Ubah supaya lingkarannya tertutup.");
  };

  const removeAction = async (a: SurveyAction) => {
    if (!window.confirm(`Hapus tindak lanjut "${a.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const err = await deleteAction(a.id);
    if (err) { toast(`Gagal menghapus: ${err}`, "error"); return; }
    toast("Tindak lanjut dihapus");
    reload();
  };

  const fromInsight = (r: InsightContent["rekomendasi"][number]) => setDraft({
    title: r.judul, theme: r.tema || null, pic: r.pic || null, plan: r.langkah.map((l, i) => `${i + 1}. ${l}`).join("\n") || null,
    status: "belum", period, is_focus: r.fokus, raised_by: "",
  });

  const tabs: [Tab, string][] = [
    ["ringkasan", "Ringkasan"],
    ["tindak", `Tindak lanjut (${openCount})`],
    ...(isHr ? [["komentar", "Komentar"] as [Tab, string]] : []),
    ["detail", "Detail pertanyaan"],
    ...(isHr ? [["kirim", "Kirim survei"] as [Tab, string]] : []),
  ];

  return (
    <AppShell activeNavId="pulse" title="Pulse Check & Feedback" subtitle="Dengar karyawan tiap bulan, putuskan fokus, dan kabari balik">
      {!loading && surveys.length === 0 && <Card><p className="text-sm text-slate-600 dark:text-slate-300">Belum ada survei tersimpan.</p></Card>}

      {survey && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              {surveys.map((s) => (
                <button key={s.id} type="button" onClick={() => switchSurvey(s.id)}
                  className={cn("rounded-md px-3 py-1.5 text-sm", s.id === surveyId ? "bg-blue-600 font-medium text-white" : "text-slate-600 dark:text-slate-300")}>{s.title}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Siklus</span>
              <select className={cn(inputClass, "w-auto")} value={period} onChange={(e) => setPeriod(e.target.value)}>
                {periods.map((p) => {
                  const s = summary.find((x) => x.period === p);
                  return <option key={p} value={p}>{periodLabel(p)} — {s ? `${s.n} jawaban` : "belum ada jawaban"}</option>;
                })}
              </select>
              {guideHidden && <Button size="sm" variant="ghost" onClick={() => hideGuide(false)}>Cara pakai</Button>}
            </div>
          </div>

          {!guideHidden && (
            <Card className="bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-950/30 dark:to-amber-950/20">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cara pakai — 4 langkah tiap bulan</h2>
                <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => hideGuide(true)}>Sembunyikan</button>
              </div>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["1. Kirim link", "Awal bulan, buat link untuk bulan lalu lalu tempel pesannya ke grup WA.", isHr ? "kirim" : null],
                  ["2. Baca hasil", "Lihat angka utama, tren, dan bagian \"Perlu diperhatikan\". Buat insight AI.", "ringkasan"],
                  ["3. Pilih fokus", "Dari usulan AI dan komentar, pilih paling banyak 3 hal untuk dikerjakan.", "tindak"],
                  ["4. Kabari balik", "Saat selesai, catat apa yang disampaikan ke karyawan — supaya mereka mau mengisi lagi.", "tindak"],
                ].map(([t, d, go]) => (
                  <li key={t} className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/70">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t}</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{d}</p>
                    {go && <button type="button" className="mt-1.5 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={() => setTab(go as Tab)}>Buka →</button>}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {!isHr && !roleLoading && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Anda melihat ringkasan tanpa nama. Nama pengisi dan komentar tertulis hanya bisa dibuka tim HR, supaya karyawan tetap berani menulis jujur.
            </p>
          )}

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === k ? "border-blue-600 font-medium text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500")}>
                {label}{k === "komentar" && commentCount ? ` (${commentCount})` : ""}
              </button>
            ))}
          </div>

          {loading && !summary.length ? <Card><p className="text-sm text-slate-500">Memuat…</p></Card> : (
            <>
              {tab === "ringkasan" && (
                <Overview survey={survey} summary={summary} period={period} setPeriod={setPeriod} signals={sig}
                  segments={segNow} segmentLabel={SEGMENT_LABEL[segKey] ?? segKey} targetCount={campaign?.target_count ?? null}
                  insight={insight} setInsight={setInsight} isHr={isHr} onAddAction={fromInsight} />
              )}
              {tab === "tindak" && (
                <ActionsBoard actions={actions} raisers={raisers} isHr={isHr} canEdit={canEdit} period={period}
                  onAdd={() => setDraft({ status: "belum", period, raised_by: "" })} onEdit={(a) => setDraft({ ...a, raised_by: raisers.get(a.id) ?? "" })}
                  onPatch={patchAction} onDelete={removeAction} />
              )}
              {tab === "komentar" && isHr && <Comments survey={survey} responses={responses} period={period} />}
              {tab === "detail" && <Details survey={survey} current={current} />}
              {tab === "kirim" && isHr && <Campaigns survey={survey} summary={summary} campaigns={campaigns} reload={reload} />}
            </>
          )}
        </>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{draft.id ? "Ubah tindak lanjut" : "Tindak lanjut baru"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Apa yang akan dilakukan</Label>
                <textarea className={inputClass} rows={2} value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><Label>Dari pulse check bulan</Label>
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
              <div><Label>Tenggat</Label>
                <input type="date" className={inputClass} value={draft.due_date ?? ""} onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={!!draft.is_focus} onChange={(e) => setDraft({ ...draft, is_focus: e.target.checked })} /> ★ Jadikan fokus</label></div>
              <div className="sm:col-span-2"><Label>Langkah</Label>
                <textarea className={inputClass} rows={3} value={draft.plan ?? ""} onChange={(e) => setDraft({ ...draft, plan: e.target.value || null })} /></div>
              <div className="sm:col-span-2"><Label>Hasil nyata</Label>
                <textarea className={inputClass} rows={2} value={draft.result ?? ""} onChange={(e) => setDraft({ ...draft, result: e.target.value || null })} /></div>
              <div className="sm:col-span-2"><Label>Yang sudah disampaikan ke karyawan</Label>
                <textarea className={inputClass} rows={2} placeholder="mis. Diumumkan di grup 3 Nov: mulai Desember libur jadi 3x sebulan untuk tim produksi" value={draft.told_back ?? ""} onChange={(e) => setDraft({ ...draft, told_back: e.target.value || null })} /></div>
              {isHr && (
                <div className="sm:col-span-2"><Label>Diangkat oleh (hanya terlihat oleh HR)</Label>
                  <input className={inputClass} value={draft.raised_by ?? ""} onChange={(e) => setDraft({ ...draft, raised_by: e.target.value })} /></div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Batal</Button>
              <Button variant="primary" onClick={submitDraft}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
