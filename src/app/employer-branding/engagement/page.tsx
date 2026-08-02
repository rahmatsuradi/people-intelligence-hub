"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import {
  getEnpsRounds,
  upsertEnpsRound,
  deleteEnpsRound,
  computeEnps,
  getFeedbackEntries,
  addFeedbackEntry,
  deleteFeedbackEntry,
  type EnpsRound,
  type FeedbackEntry,
  type FeedbackCategory,
  type FeedbackSentiment,
} from "@/lib/engagement-store";

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  budaya: "Budaya Kerja",
  "beban-kerja": "Beban Kerja",
  kompensasi: "Kompensasi",
  manajemen: "Manajemen",
  "pengembangan-karir": "Pengembangan Karir",
  lainnya: "Lainnya",
};

const SENTIMENT_LABEL: Record<FeedbackSentiment, string> = { positif: "Positif", netral: "Netral", negatif: "Negatif" };
const SENTIMENT_COLOR: Record<FeedbackSentiment, string> = {
  positif: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  netral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  negatif: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

function enpsColor(score: number): string {
  if (score >= 30) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

const EMPTY_ROUND_FORM = {
  period: new Date().toISOString().slice(0, 7),
  respondentCount: 0,
  promoters: 0,
  passives: 0,
  detractors: 0,
  keyThemes: "",
  enteredBy: "",
};

function RoundModal({
  initial,
  onClose,
  onSave,
}: {
  initial: EnpsRound | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_ROUND_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { period: initial.period, respondentCount: initial.respondentCount, promoters: initial.promoters, passives: initial.passives, detractors: initial.detractors, keyThemes: initial.keyThemes, enteredBy: initial.enteredBy }
      : EMPTY_ROUND_FORM,
  );

  const tally = form.promoters + form.passives + form.detractors;
  const mismatch = tally !== form.respondentCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Survei eNPS" : "Survei eNPS Baru"}</h3>
        <p className="mt-1 text-xs text-slate-400">Masukkan hasil tally survei (skala 0–10: promoter 9–10, passive 7–8, detractor 0–6).</p>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="period">Periode</Label>
              <input id="period" type="month" className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="respondentCount">Jumlah Responden</Label>
              <input id="respondentCount" type="number" min={0} className={inputClass} value={form.respondentCount} onChange={(e) => setForm({ ...form, respondentCount: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="promoters">Promoter (9–10)</Label>
              <input id="promoters" type="number" min={0} className={inputClass} value={form.promoters} onChange={(e) => setForm({ ...form, promoters: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="passives">Passive (7–8)</Label>
              <input id="passives" type="number" min={0} className={inputClass} value={form.passives} onChange={(e) => setForm({ ...form, passives: Number(e.target.value) })} />
            </div>
            <div>
              <Label htmlFor="detractors">Detractor (0–6)</Label>
              <input id="detractors" type="number" min={0} className={inputClass} value={form.detractors} onChange={(e) => setForm({ ...form, detractors: Number(e.target.value) })} />
            </div>
          </div>
          {mismatch && form.respondentCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Total promoter+passive+detractor ({tally}) tidak sama dengan jumlah responden ({form.respondentCount}).
            </p>
          )}
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            eNPS: <span className={cn("font-bold", enpsColor(computeEnps(form)))}>{computeEnps(form)}</span>
          </p>

          <div>
            <Label htmlFor="keyThemes">Tema Utama Masukan</Label>
            <textarea id="keyThemes" rows={3} className={cn(inputClass, "resize-none")} value={form.keyThemes} onChange={(e) => setForm({ ...form, keyThemes: e.target.value })} placeholder="Ringkasan tema dari komentar terbuka survei" />
          </div>

          <div>
            <Label htmlFor="enteredBy">Diinput oleh</Label>
            <input id="enteredBy" className={inputClass} value={form.enteredBy} onChange={(e) => setForm({ ...form, enteredBy: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.period || form.respondentCount <= 0) {
                toast("Periode dan jumlah responden wajib diisi", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_FEEDBACK_FORM = {
  date: new Date().toISOString().slice(0, 10),
  department: "",
  category: "budaya" as FeedbackCategory,
  sentiment: "netral" as FeedbackSentiment,
  note: "",
  anonymous: true,
};

function FeedbackModal({
  departments,
  onClose,
  onSave,
}: {
  departments: string[];
  onClose: () => void;
  onSave: (form: typeof EMPTY_FEEDBACK_FORM) => void;
}) {
  const [form, setForm] = useState(EMPTY_FEEDBACK_FORM);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Catat Masukan Karyawan</h3>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fbDate">Tanggal</Label>
              <input id="fbDate" type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="fbDept">Departemen</Label>
              <select id="fbDept" className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Tidak spesifik</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fbCategory">Kategori</Label>
              <select id="fbCategory" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FeedbackCategory })}>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="fbSentiment">Sentimen</Label>
              <select id="fbSentiment" className={inputClass} value={form.sentiment} onChange={(e) => setForm({ ...form, sentiment: e.target.value as FeedbackSentiment })}>
                {Object.entries(SENTIMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="fbNote">Catatan</Label>
            <textarea id="fbNote" rows={3} className={cn(inputClass, "resize-none")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Isi masukan..." />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Simpan sebagai anonim (nama pemberi masukan tidak dicatat)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.note.trim()) {
                toast("Catatan tidak boleh kosong", "error");
                return;
              }
              onSave(form);
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EngagementPage() {
  const [tab, setTab] = useState<"enps" | "feedback">("enps");
  const [tenantId, setTenantId] = useState("");
  const [rounds, setRounds] = useState<EnpsRound[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [roundModal, setRoundModal] = useState<{ data: EnpsRound | null } | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<"all" | FeedbackSentiment>("all");

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    const employees = getActiveCompanyEmployees();
    setDepartments(Array.from(new Set(employees.map((e: { department: string | null }) => e.department || "Lainnya"))).sort());
    setRounds(getEnpsRounds(id));
    setFeedback(getFeedbackEntries(id));
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pi-company-change", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pi-company-change", refresh);
    };
  }, []);

  const latestRound = rounds[rounds.length - 1];
  const latestScore = latestRound ? computeEnps(latestRound) : null;
  const previousRound = rounds.length > 1 ? rounds[rounds.length - 2] : null;
  const trendDelta = latestRound && previousRound ? computeEnps(latestRound) - computeEnps(previousRound) : null;
  const maxAbsScore = Math.max(...rounds.map((r) => Math.abs(computeEnps(r))), 1);

  const filteredFeedback = useMemo(
    () => (sentimentFilter === "all" ? feedback : feedback.filter((f) => f.sentiment === sentimentFilter)),
    [feedback, sentimentFilter],
  );

  const sentimentBreakdown = useMemo(() => {
    const total = feedback.length;
    const counts = { positif: 0, netral: 0, negatif: 0 };
    for (const f of feedback) counts[f.sentiment]++;
    return { total, counts };
  }, [feedback]);

  const handleSaveRound = (form: typeof EMPTY_ROUND_FORM & { id?: string }) => {
    upsertEnpsRound(tenantId, form);
    setRoundModal(null);
    toast(form.id ? "Survei diperbarui" : "Survei baru ditambahkan");
    refresh();
  };

  const handleSaveFeedback = (form: typeof EMPTY_FEEDBACK_FORM) => {
    addFeedbackEntry(tenantId, form);
    setFeedbackModalOpen(false);
    toast("Masukan tercatat");
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="engagement" title="Employee Engagement" subtitle="eNPS & masukan karyawan">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="engagement" title="Employee Engagement" subtitle="Pelacakan eNPS bulanan & pengumpulan masukan internal">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm font-medium text-slate-500">eNPS Terkini</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", latestScore !== null ? enpsColor(latestScore) : "text-slate-900 dark:text-white")}>
              {latestScore !== null ? latestScore : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {latestRound ? `Periode ${latestRound.period}` : "Belum ada survei"}
              {trendDelta !== null && (trendDelta >= 0 ? ` · naik ${trendDelta}` : ` · turun ${Math.abs(trendDelta)}`)}
            </p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Total Survei</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{rounds.length}</p>
            <p className="mt-1 text-xs text-slate-400">Round eNPS tercatat</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Masukan Terkumpul</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{sentimentBreakdown.total}</p>
            <p className="mt-1 text-xs text-slate-400">
              {sentimentBreakdown.counts.negatif > 0 && <span className="text-red-500">{sentimentBreakdown.counts.negatif} negatif</span>}
              {sentimentBreakdown.counts.negatif === 0 && "Belum ada masukan negatif"}
            </p>
          </Card>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button type="button" onClick={() => setTab("enps")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "enps" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Tren eNPS
          </button>
          <button type="button" onClick={() => setTab("feedback")} className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "feedback" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>
            Log Masukan
          </button>
        </div>

        {tab === "enps" ? (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tren eNPS per Periode</h2>
                <p className="mt-0.5 text-sm text-slate-500">eNPS = %promoter − %detractor (Reichheld, 2003)</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setRoundModal({ data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Input Survei
              </Button>
            </div>
            {rounds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="chart" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada survei eNPS tercatat.</p>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                {rounds.map((r) => {
                  const score = computeEnps(r);
                  const widthPct = Math.max((Math.abs(score) / maxAbsScore) * 50, 3);
                  return (
                    <div key={r.id} className="group">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{r.period} <span className="text-xs text-slate-400">({r.respondentCount} responden)</span></span>
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold tabular-nums", enpsColor(score))}>{score}</span>
                          <button type="button" onClick={() => setRoundModal({ data: r })} className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800">
                            <Icon className="h-3.5 w-3.5"><SvgPath name="pencil" /></Icon>
                          </button>
                          <button type="button" onClick={() => { deleteEnpsRound(tenantId, r.id); toast("Survei dihapus"); refresh(); }} className="rounded p-1 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/10">
                            <Icon className="h-3.5 w-3.5"><SvgPath name="trash" /></Icon>
                          </button>
                        </div>
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn("absolute top-0 h-full rounded-full transition-all duration-500", score >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500")}
                          style={{ width: `${widthPct}%` }}
                        />
                        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300 dark:bg-slate-600" />
                      </div>
                      {r.keyThemes && <p className="mt-1.5 text-xs text-slate-400">{r.keyThemes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Log Masukan Karyawan</h2>
                <p className="mt-0.5 text-sm text-slate-500">Keluhan, saran, dan observasi budaya kerja</p>
              </div>
              <div className="flex items-center gap-2">
                <select className={cn(inputClass, "w-36")} value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value as "all" | FeedbackSentiment)}>
                  <option value="all">Semua sentimen</option>
                  {Object.entries(SENTIMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Button variant="primary" size="sm" onClick={() => setFeedbackModalOpen(true)}>
                  <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                  Catat Masukan
                </Button>
              </div>
            </div>
            {filteredFeedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="users" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada masukan tercatat.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFeedback.map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", SENTIMENT_COLOR[f.sentiment])}>{SENTIMENT_LABEL[f.sentiment]}</span>
                        <span className="text-xs text-slate-400">{CATEGORY_LABEL[f.category]}</span>
                        {f.department && <span className="text-xs text-slate-400">· {f.department}</span>}
                        <span className="text-xs text-slate-400">· {f.date}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{f.note}</p>
                    </div>
                    <button type="button" onClick={() => { deleteFeedbackEntry(tenantId, f.id); toast("Masukan dihapus"); refresh(); }} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                      <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200">Catatan metodologi:</span>{" "}
          Platform ini belum mendistribusikan survei secara langsung ke karyawan — hasil eNPS diinput HR dari hasil
          tally survei eksternal (mis. Google Form/kertas). eNPS dihitung dengan formula standar %promoter − %detractor.
        </div>
      </div>

      {roundModal && (
        <RoundModal
          initial={roundModal.data}
          onClose={() => setRoundModal(null)}
          onSave={handleSaveRound}
        />
      )}
      {feedbackModalOpen && (
        <FeedbackModal
          departments={departments}
          onClose={() => setFeedbackModalOpen(false)}
          onSave={handleSaveFeedback}
        />
      )}
    </AppShell>
  );
}
