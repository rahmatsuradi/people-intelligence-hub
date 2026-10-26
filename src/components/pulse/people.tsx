"use client";

import { useMemo, useState } from "react";
import { Card, cn, inputClass } from "@/components/app-shell";
import { appreciationCounts, periodLabel, personTrends, type Survey, type SurveyResponse } from "@/lib/rr/pulse";
import { INSTANCE } from "@/lib/instance";
import { shortMonth } from "./charts";

/**
 * Per orang (khusus HR) — pengganti pilihan "Employee Name" di dashboard sheet, ditambah
 * rekap "Most Appreciated" per bulan dan kandidat Employee of the Month.
 */
export function People({ survey, responses, period, employeeNames }: { survey: Survey; responses: SurveyResponse[]; period: string; employeeNames: string[] }) {
  const [q, setQ] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const trends = useMemo(() => personTrends(survey, responses), [survey, responses]);
  const kq = survey.headline.map((k) => survey.questions.find((x) => x.key === k)).filter((x) => x && (x.favorable?.length || x.risk?.length || x.favorableMin !== undefined));
  const periods = [...new Set(responses.map((r) => r.period))].sort().slice(-8);
  const shown = trends.filter((t) => (!onlyAlerts || t.alerts.length) && (!q || t.name.toLowerCase().includes(q.toLowerCase())));
  const texts = (p: string | null) => responses.filter((r) => !r.excluded && (!p || r.period === p)).map((r) => r.answers.appreciated_names).filter((v): v is string => typeof v === "string");
  const month = appreciationCounts(texts(period), employeeNames, 8);
  const all = appreciationCounts(texts(null), employeeNames, 8);
  const hasAppreciation = survey.questions.some((x) => x.key === "appreciated_names");

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Khusus HR. Dipakai untuk menyapa orang yang terus-menerus stres atau tidak bahagia lewat obrolan empat mata — bukan untuk menegur atau dibawa ke penilaian kinerja.</p>
      </Card>

      {hasAppreciation && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Paling banyak diapresiasi — {periodLabel(period)}</h2>
            {month.length === 0 ? <p className="mt-2 text-sm text-slate-500">Belum ada.</p> : (
              <>
                <p className="mt-1 text-xs text-slate-500">Kandidat Employee of the Month: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{month[0].name}</span> ({month[0].count}× disebut rekan). {INSTANCE.employeeOfMonthNote}</p>
                <ol className="mt-2 space-y-1 text-sm">{month.map((a, i) => <li key={a.name} className="flex justify-between"><span>{i + 1}. {a.name}</span><span className="tabular-nums text-slate-500">{a.count}×</span></li>)}</ol>
              </>
            )}
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Paling banyak diapresiasi — semua bulan</h2>
            <ol className="mt-2 space-y-1 text-sm">{all.map((a, i) => <li key={a.name} className="flex justify-between"><span>{i + 1}. {a.name}</span><span className="tabular-nums text-slate-500">{a.count}×</span></li>)}</ol>
          </Card>
        </div>
      )}

      <Card padding={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Riwayat per orang</h2>
          <input className={cn(inputClass, "w-56 py-1 text-xs")} placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> Hanya yang perlu disapa ({trends.filter((t) => t.alerts.length).length})</label>
        </div>
        <p className="px-5 text-[11px] text-slate-400">● hijau = baik, ● merah = tidak bahagia / stres tinggi, kosong = tidak mengisi bulan itu.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">Nama</th><th className="px-3 py-2 font-medium">Kelompok</th>
              {kq.map((x) => <th key={x!.key} className="px-3 py-2 font-medium">{x!.kpiLabel} ({periods.map(shortMonth).join(" · ")})</th>)}
              <th className="px-3 py-2 font-medium">Perlu perhatian</th>
            </tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.key} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-2">{t.name}{!t.employeeId && <span className="ml-1 text-[10px] text-slate-400">(belum tertaut)</span>}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{t.jabatan ?? "—"}</td>
                  {kq.map((x) => (
                    <td key={x!.key} className="px-3 py-2">
                      <div className="flex gap-1">
                        {periods.map((p) => {
                          const v = t.points.find((pt) => pt.period === p)?.values[x!.key];
                          const bad = x!.risk?.length ? v === 1 : v === 0;
                          return <span key={p} title={`${periodLabel(p)}`} className={cn("inline-block h-2.5 w-2.5 rounded-full", v == null ? "border border-slate-300 dark:border-slate-600" : bad ? "bg-red-500" : "bg-emerald-500")} />;
                        })}
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs text-red-600">{t.alerts.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
