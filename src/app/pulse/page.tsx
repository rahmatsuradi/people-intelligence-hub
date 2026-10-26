"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Pulse Check & Feedback — "Suara Karyawan" Rica Rico.

   Struktur (sama di setiap survei, supaya tidak perlu belajar ulang):
     Ikhtisar  → tiga survei dalam satu layar untuk bulan terbaru
     Survei    → Pulse Office · SPG → SPV · 360 SPV   (Arsip: survei lama/sekali)
     Tab       → Dashboard · [Rapor] · Tindak lanjut · [Per orang] · Komentar · Pertanyaan · Kirim

   Pola HRIS survei (Culture Amp, Peakon, Lattice): satu siklus per bulan → link isi → angka utama & tren →
   rincian per kelompok → komentar bertema → maksimal 3 fokus → tindak lanjut → kabari balik.
   Logika hitung ada di src/lib/rr/pulse*.ts (diuji); grafik di src/components/pulse/viz; halaman ini hanya merangkai.
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import {
  deleteAction, loadActions, loadCampaigns, loadConclusions, loadEmployeeNames, loadInsight, loadRaisers, loadResponses, loadSegments,
  loadSpgCountBySpv, loadSummary, loadSurveys, loadThemes, periodLabel, saveAction, signals as buildSignals,
  type Campaign, type Conclusion, type PeriodSummary, type SegmentPeriod, type StoredInsight, type Survey, type SurveyAction, type SurveyResponse, type ThemePeriod,
} from "@/lib/rr/pulse";
import type { InsightContent } from "@/lib/rr/pulse-insight";
import { ActionsBoard } from "@/components/pulse/actions-board";
import { ActionModal, type ActionDraft } from "@/components/pulse/action-modal";
import { Campaigns } from "@/components/pulse/campaigns";
import { Comments } from "@/components/pulse/comments";
import { PulseDashboard, SpgDashboard } from "@/components/pulse/dashboards";
import { Details } from "@/components/pulse/details";
import { Ikhtisar } from "@/components/pulse/ikhtisar";
import { People } from "@/components/pulse/people";
import { ResponseBrowser } from "@/components/pulse/responses";
import { Report360 } from "@/components/pulse/report-360";
import { SpvReport } from "@/components/pulse/spv-report";

type Tab = "dash" | "rapor" | "tindak" | "orang" | "komentar" | "jawaban" | "detail" | "kirim";
const SEGMENT_LABEL: Record<string, string> = { tenure: "Lama kerja", spv: "SPV area", jabatan: "Kelompok jabatan" };
const GUIDE_KEY = "pulse-guide-hidden";
const HOME = "ikhtisar";

export default function PulsePage() {
  const { role, loading: roleLoading, canEdit } = useRole();
  const isHr = role === "hr";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [view, setView] = useState<string>(HOME);
  const [summary, setSummary] = useState<PeriodSummary[]>([]);
  const [segmentsBy, setSegmentsBy] = useState<Record<string, SegmentPeriod[]>>({});
  const [themes, setThemes] = useState<ThemePeriod[]>([]);
  const [actions, setActions] = useState<SurveyAction[]>([]);
  const [raisers, setRaisers] = useState<Map<string, string>>(new Map());
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insight, setInsight] = useState<StoredInsight | null>(null);
  const [period, setPeriod] = useState("");
  const [tab, setTab] = useState<Tab>("dash");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [guideHidden, setGuideHidden] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [roster, setRoster] = useState<Record<string, number>>({});
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);

  useEffect(() => {
    try { setGuideHidden(localStorage.getItem(GUIDE_KEY) === "1"); } catch { setGuideHidden(false); }
    loadSurveys()
      .then(setSurveys)
      .catch((e: Error) => toast(`Gagal memuat survei: ${e.message}`, "error"))
      .finally(() => setLoading(false));
  }, []);

  const main = surveys.filter((s) => !s.config.archived);
  const archived = surveys.filter((s) => s.config.archived);
  const survey = view === HOME ? undefined : surveys.find((s) => s.id === view);
  const kind = survey?.config?.kind ?? "pulse";
  const segKeys = (survey?.segments ?? []).join(",");

  const reload = useCallback(() => {
    if (!survey || roleLoading) return;
    setLoading(true);
    const keys = survey.segments;
    Promise.all([
      loadSummary(survey.id), loadActions(survey.id), loadCampaigns(survey.id),
      Promise.all(keys.map((k) => loadSegments(survey.id, k))),
      survey.config.themes?.length ? loadThemes(survey.id) : Promise.resolve([] as ThemePeriod[]),
      isHr ? loadRaisers() : Promise.resolve(new Map<string, string>()),
      isHr ? loadResponses(survey.id) : Promise.resolve([] as SurveyResponse[]),
      kind === "spv_report" ? loadSpgCountBySpv() : Promise.resolve({} as Record<string, number>),
      isHr && kind !== "360" ? loadConclusions(survey.id) : Promise.resolve([] as Conclusion[]),
      isHr && kind === "pulse" ? loadEmployeeNames() : Promise.resolve([] as string[]),
    ])
      .then(([s, a, c, segs, th, r, rs, ro, co, en]) => {
        setSummary(s); setActions(a); setCampaigns(c); setThemes(th); setRaisers(r); setResponses(rs); setRoster(ro); setConclusions(co); setEmployeeNames(en);
        setSegmentsBy(Object.fromEntries(keys.map((k, i) => [k, segs[i]])));
        setPeriod((cur) => (cur && s.some((p) => p.period === cur) ? cur : [...s].reverse().find((p) => !p.suppressed)?.period ?? s.at(-1)?.period ?? ""));
      })
      .catch((e: Error) => toast(`Gagal memuat: ${e.message}`, "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.id, segKeys, kind, isHr, roleLoading]);
  useEffect(reload, [reload]);

  useEffect(() => {
    if (!survey || !period) { setInsight(null); return; }
    loadInsight(survey.id, period).then(setInsight).catch(() => setInsight(null));
  }, [survey, period]);

  const campaign = campaigns.find((c) => c.period === period) ?? null;
  const segKey = survey?.segments?.[0] ?? "";
  const sig = useMemo(() => survey && period ? buildSignals({
    survey, summaries: summary, period, actions, segments: segmentsBy[segKey]?.find((s) => s.period === period) ?? null,
    segmentLabel: SEGMENT_LABEL[segKey] ?? segKey, targetCount: campaign?.target_count,
  }) : [], [survey, summary, period, actions, segmentsBy, segKey, campaign]);
  // Siklus = bulan yang SUDAH punya jawaban. Link bulan berikutnya hanya tampil di tab Kirim survei.
  const periods = [...new Set(summary.map((p) => p.period))].sort().reverse();
  const openCount = actions.filter((a) => a.status === "belum" || a.status === "berjalan").length;
  const commentCount = responses.filter((r) => r.period === period && !r.excluded).length;

  const hideGuide = (v: boolean) => { setGuideHidden(v); try { localStorage.setItem(GUIDE_KEY, v ? "1" : "0"); } catch { /* abaikan */ } };
  const open = (id: string) => {
    const s = surveys.find((x) => x.id === id);
    setView(id); setPeriod(""); setShowArchive(false);
    setTab(s?.config.kind === "360" ? "rapor" : s?.config.kind === "archive" ? "detail" : "dash");
  };

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

  const tabs: [Tab, string][] = kind === "360" ? [
    ["rapor", "Rapor 360"], ["komentar", "Komentar"], ["jawaban", "Jawaban lengkap"], ["detail", "Pertanyaan"], ["kirim", "Kirim survei"],
  ] : kind === "archive" ? [
    ["detail", "Hasil survei"], ["komentar", "Komentar"], ["jawaban", "Jawaban lengkap"],
  ] : [
    ["dash", "Dashboard"],
    ...(kind === "spv_report" ? [["rapor", "Rapor SPV"] as [Tab, string]] : []),
    ["tindak", `Tindak lanjut (${openCount})`],
    ...(isHr && kind === "pulse" ? [["orang", "Per orang & apresiasi"] as [Tab, string]] : []),
    ...(isHr ? [["komentar", "Komentar"] as [Tab, string], ["jawaban", "Jawaban lengkap"] as [Tab, string]] : []),
    ["detail", "Pertanyaan"],
    ...(isHr ? [["kirim", "Kirim survei"] as [Tab, string]] : []),
  ];
  const visibleTabs = tabs.filter(([k]) => (k !== "komentar" && k !== "jawaban") || isHr);
  const current = summary.find((p) => p.period === period);
  const dashProps = survey ? {
    survey, summary, period, setPeriod, themes, segmentsBy, targetCount: campaign?.target_count ?? null, signals: sig,
    insight, setInsight, isHr, onAddAction: fromInsight,
  } : null;

  return (
    <AppShell activeNavId="pulse" title="Pulse Check & Feedback" subtitle="Dengar karyawan tiap bulan, putuskan fokus, dan kabari balik">
      {!loading && surveys.length === 0 && <Card><p className="text-sm text-slate-600 dark:text-slate-300">Belum ada survei tersimpan.</p></Card>}

      {surveys.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <nav aria-label="Survei" className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => { setView(HOME); setShowArchive(false); }}
                className={cn("rounded-md px-3 py-1.5 text-sm", view === HOME ? "bg-blue-600 font-medium text-white" : "text-slate-600 dark:text-slate-300")}>Ikhtisar</button>
              {main.map((s) => (
                <button key={s.id} type="button" onClick={() => open(s.id)}
                  className={cn("rounded-md px-3 py-1.5 text-sm", view === s.id ? "bg-blue-600 font-medium text-white" : "text-slate-600 dark:text-slate-300")}>{s.config.navLabel ?? s.title}</button>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {archived.length > 0 && (
                <div className="relative">
                  <Button size="sm" variant="ghost" onClick={() => setShowArchive((v) => !v)} aria-expanded={showArchive}>Arsip ▾</Button>
                  {showArchive && (
                    <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {archived.map((s) => (
                        <button key={s.id} type="button" onClick={() => open(s.id)} className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                          <span className="font-medium text-slate-800 dark:text-slate-100">{s.config.navLabel ?? s.title}</span>
                          <span className="block text-slate-500">{s.config.who}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {survey && kind !== "archive" && (
                <>
                  <span className="text-xs text-slate-500">Bulan yang dinilai</span>
                  <select className={inputClass} style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Bulan yang dinilai">
                    {periods.map((p) => <option key={p} value={p}>{periodLabel(p)} — {summary.find((x) => x.period === p)?.n ?? 0} jawaban</option>)}
                  </select>
                </>
              )}
              <Link href="/pulse/presentasi" className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Mode presentasi</Link>
              {guideHidden && view === HOME && <Button size="sm" variant="ghost" onClick={() => hideGuide(false)}>Cara pakai</Button>}
            </div>
          </div>

          {view === HOME && !guideHidden && (
            <Card className="bg-gradient-to-r from-blue-50 to-amber-50 dark:from-blue-950/30 dark:to-amber-950/20">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cara pakai — 4 langkah tiap bulan</h2>
                <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => hideGuide(true)}>Sembunyikan</button>
              </div>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["1. Kirim link", "Awal bulan (SPG: tanggal 22–23), buat link lalu tempel pesannya ke grup WA. Buka survei → tab Kirim survei."],
                  ["2. Baca hasil", "Mulai dari Ikhtisar, lalu buka dashboard survei yang angkanya bergeser. Buat insight AI bila perlu."],
                  ["3. Pilih fokus", "Dari usulan dan komentar, pilih paling banyak 3 hal untuk dikerjakan (tab Tindak lanjut)."],
                  ["4. Kabari balik", "Saat selesai, catat apa yang disampaikan ke karyawan — supaya mereka mau mengisi lagi."],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/70">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t}</p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{d}</p>
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

          {view === HOME ? <Ikhtisar surveys={surveys} isHr={isHr} onOpen={open} /> : survey && dashProps && (
            <>
              {kind === "archive" && <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Arsip pembanding: {survey.config.who}. Pertanyaannya berbeda dari Feedback SPG Bulanan, jadi angkanya tidak digabung.</p>}
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
                {visibleTabs.map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setTab(k)}
                    className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === k ? "border-blue-600 font-medium text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500")}>
                    {label}{k === "komentar" && commentCount ? ` (${commentCount})` : ""}
                  </button>
                ))}
              </div>

              {loading && !summary.length ? <Card><p className="text-sm text-slate-500">Memuat…</p></Card> : (
                <div className={cn(loading && "opacity-60 transition-opacity")}>
                  {tab === "dash" && kind === "pulse" && <PulseDashboard {...dashProps} />}
                  {tab === "dash" && kind === "spv_report" && <SpgDashboard {...dashProps} />}
                  {tab === "rapor" && kind === "spv_report" && <SpvReport survey={survey} segments={segmentsBy.spv ?? []} period={period} roster={roster} summary={summary} />}
                  {tab === "rapor" && kind === "360" && isHr && <Report360 survey={survey} responses={responses} canEdit={canEdit} onSaved={() => loadSurveys().then(setSurveys)} />}
                  {tab === "tindak" && (
                    <ActionsBoard actions={actions} raisers={raisers} isHr={isHr} canEdit={canEdit} period={period}
                      onAdd={() => setDraft({ status: "belum", period, raised_by: "" })} onEdit={(a) => setDraft({ ...a, raised_by: raisers.get(a.id) ?? "" })}
                      onPatch={patchAction} onDelete={removeAction} />
                  )}
                  {tab === "orang" && isHr && <People survey={survey} responses={responses} period={period} employeeNames={employeeNames} />}
                  {tab === "komentar" && isHr && <Comments survey={survey} responses={responses} period={period || periodOf(responses)}
                    conclusions={kind === "360" || kind === "archive" ? undefined : conclusions} onConclusionSaved={() => loadConclusions(survey.id).then(setConclusions)} />}
                  {tab === "jawaban" && isHr && <ResponseBrowser key={survey.id} survey={survey} responses={responses} period={period || periodOf(responses)} />}
                  {tab === "detail" && <Details survey={survey} current={kind === "archive" ? summary.at(-1) : current} />}
                  {tab === "kirim" && isHr && <Campaigns survey={survey} summary={summary} campaigns={campaigns} reload={reload} />}
                </div>
              )}
            </>
          )}
        </>
      )}

      {draft && <ActionModal draft={draft} setDraft={setDraft} themes={[...new Set(actions.map((a) => a.theme).filter((t): t is string => !!t))]} isHr={isHr} onSave={submitDraft} />}
    </AppShell>
  );
}

/** Arsip tidak punya "siklus": pakai bulan terakhir yang punya jawaban. */
function periodOf(responses: SurveyResponse[]): string {
  return responses.map((r) => r.period).sort().at(-1) ?? "";
}
