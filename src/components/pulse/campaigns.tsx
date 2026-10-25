"use client";

import { useState } from "react";
import { Button, Card, Label, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { createCampaign, periodLabel, updateCampaign, type Campaign, type PeriodSummary, type Survey } from "@/lib/rr/pulse";

const addMonths = (period: string, n: number) => {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};

/** Bulan yang dinilai berikutnya: sebulan setelah periode terakhir yang sudah ada. */
export function nextPeriod(survey: Survey, summary: PeriodSummary[], campaigns: Campaign[]): string {
  const last = [...summary.map((p) => p.period), ...campaigns.map((c) => c.period)].sort().at(-1);
  const thisMonth = new Date().toISOString().slice(0, 7) + "-01";
  if (!last) return thisMonth;
  const n = addMonths(last, 1);
  return survey.cadence === "bulanan" ? n : (n > thisMonth ? n : thisMonth);
}

/** Batas isi bawaan: tanggal 10 bulan berikutnya (formulir diisi di awal bulan setelah bulan yang dinilai). */
const defaultClose = (period: string) => `${addMonths(period, 1).slice(0, 7)}-10`;

export function Campaigns({ survey, summary, campaigns, reload }: { survey: Survey; summary: PeriodSummary[]; campaigns: Campaign[]; reload: () => void }) {
  const suggested = nextPeriod(survey, summary, campaigns);
  const [form, setForm] = useState({ period: suggested.slice(0, 7), closes: defaultClose(suggested), target: "" });
  const [saving, setSaving] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = (c: Campaign) => `${origin}/survei/${c.token}`;
  const count = (p: string) => summary.find((s) => s.period === p)?.n ?? 0;

  const waText = (c: Campaign) =>
    `Halo rekan-rekan Rica Rico 👋\n\nYuk isi *${survey.title} ${periodLabel(c.period)}* (±3 menit) lewat link ini:\n${link(c)}\n\n` +
    `Jawabanmu hanya dibaca tim HR dan dipakai untuk memperbaiki tempat kerja kita. Owner hanya melihat ringkasan angka tanpa nama.` +
    (c.closes_at ? `\n\nBatas pengisian: ${new Date(c.closes_at).toLocaleDateString("id-ID", { day: "numeric", month: "long" })}.` : "") + `\n\nTerima kasih 🙏`;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`${what} disalin`); } catch { toast("Gagal menyalin — salin manual dari kotak di bawah", "error"); }
  };

  const create = async () => {
    if (!form.period) { toast("Pilih bulan yang dinilai", "error"); return; }
    setSaving(true);
    const err = await createCampaign({
      survey_id: survey.id, period: `${form.period}-01`,
      closes_at: form.closes ? new Date(`${form.closes}T23:59:00+07:00`).toISOString() : null,
      target_count: form.target ? Math.max(1, Number(form.target)) : null,
    });
    setSaving(false);
    if (err) { toast(err, "error"); return; }
    toast("Link survei dibuat");
    reload();
  };

  const toggle = async (c: Campaign) => {
    const next = c.status === "open" ? "closed" : "open";
    if (next === "closed" && !window.confirm(`Tutup formulir ${periodLabel(c.period)}? Orang yang membuka link akan melihat pesan "sudah ditutup".`)) return;
    const err = await updateCampaign(c.id, { status: next });
    if (err) { toast(err, "error"); return; }
    reload();
  };

  const setTarget = async (c: Campaign) => {
    const v = window.prompt(`Berapa orang yang diharapkan mengisi ${periodLabel(c.period)}?`, String(c.target_count ?? ""));
    if (v === null) return;
    const n = v.trim() ? Math.max(1, Math.round(Number(v))) : null;
    if (v.trim() && !Number.isFinite(n)) { toast("Isi dengan angka", "error"); return; }
    const err = await updateCampaign(c.id, { target_count: n });
    if (err) { toast(err, "error"); return; }
    reload();
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Buat link survei baru</h2>
        <p className="mt-0.5 text-xs text-slate-500">Satu link untuk satu bulan. Bagikan ke grup WhatsApp; karyawan mengisi dari HP tanpa login, dan jawabannya langsung masuk ke sini — tidak perlu Google Form lagi.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div><Label>Bulan yang dinilai</Label><input type="month" className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value, closes: e.target.value ? defaultClose(`${e.target.value}-01`) : form.closes })} /></div>
          <div><Label>Batas pengisian</Label><input type="date" className={inputClass} value={form.closes} onChange={(e) => setForm({ ...form, closes: e.target.value })} /></div>
          <div><Label>Target pengisi (orang)</Label><input type="number" min={1} className={inputClass} placeholder="mis. 25" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
          <div className="flex items-end"><Button variant="primary" className="w-full" onClick={create} disabled={saving}>{saving ? "Membuat…" : "Buat link"}</Button></div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Target dipakai untuk menghitung tingkat partisipasi. {survey.audience ? `Pengisi survei ini: ${survey.audience}.` : ""}</p>
      </Card>

      {campaigns.length === 0 && <Card><p className="text-sm text-slate-500">Belum ada link. Jawaban lama dari Google Form tetap tampil di Ringkasan.</p></Card>}
      {campaigns.map((c) => {
        const closed = c.status === "closed" || (c.closes_at && new Date(c.closes_at) < new Date());
        const n = count(c.period);
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{periodLabel(c.period)}
                  <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium", closed ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300")}>{closed ? "Ditutup" : "Terbuka"}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {n} jawaban masuk{c.target_count ? ` dari ${c.target_count} (${Math.round((n / c.target_count) * 100)}%)` : ""}
                  {c.closes_at ? ` · batas ${new Date(c.closes_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}
                </p>
                {c.target_count ? (
                  <div className="mt-2 h-1.5 w-56 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (n / c.target_count) * 100)}%` }} /></div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => copy(waText(c), "Pesan WhatsApp")}>Salin pesan WA</Button>
                <Button size="sm" onClick={() => copy(link(c), "Link")}>Salin link</Button>
                <a href={link(c)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">Buka formulir</a>
                <Button size="sm" variant="ghost" onClick={() => setTarget(c)}>Target</Button>
                <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.status === "open" ? "Tutup" : "Buka lagi"}</Button>
              </div>
            </div>
            <input readOnly className={cn(inputClass, "mt-3 font-mono text-xs")} value={link(c)} onFocus={(e) => e.currentTarget.select()} />
          </Card>
        );
      })}
    </div>
  );
}
