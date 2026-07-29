"use client";
import { useState } from "react";
import { AppShell, Icon, SvgPath, Card, Button, Label, inputClass } from "@/components/app-shell";
import { buildIndeedSearch } from "@/lib/integrations";

/* Connectors that work today with zero setup — they build standard deep-links
   (Gmail / Google Calendar / Indeed) or universal files (.ics). */
const ACTIVE = [
  {
    name: "Gmail",
    category: "Email",
    icon: "envelope" as const,
    desc: "Kirim undangan interview, penawaran, dan penolakan dari kartu kandidat — pra-isi di Gmail web, atau kirim langsung tanpa buka tab jika SMTP (App Password) diatur.",
    where: "Candidates → pilih kandidat → Kirim Email",
  },
  {
    name: "Google Calendar",
    category: "Scheduling",
    icon: "calendarDays" as const,
    desc: "Jadwalkan interview dengan tanggal, durasi, lokasi, dan undangan otomatis ke email kandidat.",
    where: "Candidates → pilih kandidat → Schedule",
  },
  {
    name: "Kalender universal (.ics)",
    category: "Scheduling",
    icon: "download" as const,
    desc: "Unduh file .ics yang bisa dibuka di Outlook, Apple Calendar, atau aplikasi kalender apa pun — tanpa akun Google.",
    where: "Candidates → pilih kandidat → Schedule → Unduh .ics",
  },
  {
    name: "Indeed",
    category: "Sourcing",
    icon: "search" as const,
    desc: "Cari lowongan & pasar talenta di Indeed untuk benchmark posisi dan sourcing kandidat.",
    where: "Langsung dari kotak pencarian di bawah",
  },
];

/* Connectors that need OAuth credentials or a partner API the deploying team
   must provision — honestly marked as requiring setup. */
const SETUP_REQUIRED = [
  { name: "Workday", category: "ATS / HRIS", desc: "Sinkronisasi kandidat & job req dua arah.", icon: "briefcase" as const },
  { name: "Greenhouse", category: "ATS", desc: "Impor pipeline, ekspor hasil analisis AI.", icon: "briefcase" as const },
  { name: "BambooHR", category: "HRIS", desc: "Kirim keputusan hire & trigger onboarding.", icon: "users" as const },
  { name: "Slack", category: "Collaboration", desc: "Notifikasi kandidat baru & keputusan hiring.", icon: "bell" as const },
  { name: "DocuSign", category: "E-Signature", desc: "Kirim offer letter untuk tanda tangan elektronik.", icon: "document" as const },
];

export default function IntegrationsPage() {
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState("");

  const searchIndeed = () => {
    const query = q.trim() || "Software Engineer";
    window.open(buildIndeedSearch(query, loc), "_blank", "noopener");
  };

  return (
    <AppShell activeNavId="integrations" title="Integrations" subtitle="Connect your hiring stack">
      {/* Active connectors */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
        <div className="flex items-start gap-4">
          <Icon className="h-6 w-6 shrink-0 text-emerald-500 dark:text-emerald-400"><SvgPath name="check" /></Icon>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Aktif — siap dipakai sekarang</p>
            <p className="mt-1 text-sm text-slate-500">
              Konektor ini bekerja tanpa setup: membuka Gmail/Calendar/Indeed yang sudah pra-isi, atau mengunduh file kalender universal.
              Tidak perlu memasang kredensial apa pun.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ACTIVE.map((intg) => (
          <Card key={intg.name} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/15">
                <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400"><SvgPath name={intg.icon} /></Icon>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{intg.name}</p>
                <p className="text-xs text-slate-400">{intg.category}</p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Active</span>
            </div>
            <p className="text-sm text-slate-500">{intg.desc}</p>
            <p className="mt-auto flex items-center gap-1.5 text-xs text-slate-400">
              <Icon className="h-3.5 w-3.5 shrink-0"><SvgPath name="arrowRight" /></Icon>
              {intg.where}
            </p>
          </Card>
        ))}
      </div>

      {/* Indeed search — live */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400"><SvgPath name="search" /></Icon>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Cari di Indeed</h2>
        </div>
        <p className="text-sm text-slate-500">Buka hasil pencarian Indeed untuk benchmark gaji, judul posisi, atau sourcing.</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <div>
            <Label htmlFor="idd-q">Posisi / kata kunci</Label>
            <input id="idd-q" className={inputClass} placeholder="e.g. Data Analyst" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchIndeed()} />
          </div>
          <div>
            <Label htmlFor="idd-l">Lokasi</Label>
            <input id="idd-l" className={inputClass} placeholder="e.g. Jakarta" value={loc} onChange={(e) => setLoc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchIndeed()} />
          </div>
          <div className="flex items-end">
            <Button variant="primary" size="lg" onClick={searchIndeed} className="w-full sm:w-auto">
              <Icon className="h-4 w-4"><SvgPath name="search" /></Icon> Cari
            </Button>
          </div>
        </div>
      </Card>

      {/* Requires setup */}
      <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-6 py-5 dark:border-blue-500/20 dark:bg-blue-500/5">
        <div className="flex items-start gap-4">
          <Icon className="h-6 w-6 shrink-0 text-blue-500 dark:text-blue-400"><SvgPath name="sparkles" /></Icon>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Perlu setup — konektor API dua arah</p>
            <p className="mt-1 text-sm text-slate-500">
              Integrasi native ke ATS/HRIS besar membutuhkan kredensial OAuth atau partner API yang dipasang oleh tim.
              Sedang dalam pengembangan.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETUP_REQUIRED.map((intg) => (
          <Card key={intg.name} className="flex flex-col gap-3 opacity-70">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Icon className="h-5 w-5 text-slate-500"><SvgPath name={intg.icon} /></Icon>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{intg.name}</p>
                <p className="text-xs text-slate-400">{intg.category}</p>
              </div>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800">Setup</span>
            </div>
            <p className="text-sm text-slate-500">{intg.desc}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
