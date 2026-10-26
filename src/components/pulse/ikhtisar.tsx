"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import {
  build360, loadActions, loadResponses, loadSummary, loadThemes, periodLabel,
  type PeriodSummary, type Survey, type SurveyAction, type SurveyResponse, type ThemePeriod,
} from "@/lib/rr/pulse";
import { coverage, headlineKpis, themeMatrix, topThemes } from "@/lib/rr/pulse-viz";
import { deltaText } from "./dash-common";
import { ChartCard, VizStyle, fmtNum } from "./viz/base";
import { HBars } from "./viz/hbars";
import { Spark } from "./viz/trend";

interface Loaded { summary: PeriodSummary[]; themes: ThemePeriod[]; actions: SurveyAction[]; responses: SurveyResponse[] }
const PEER = ["teamwork", "problem", "sharing", "ownership", "teamlead"];
const LEADER = ["leader_direction", "leader_problem", "leader_mentoring", "leader_openness", "leader_fairness"];
const COLORS = ["var(--v-s1)", "var(--v-s2)", "var(--v-s3)"];

/**
 * Halaman pembuka: tiga survei Rica Rico dalam satu layar untuk bulan terbaru — angka utama, keluhan teratas,
 * dan apa yang perlu diputuskan. Detail ada di dashboard tiap survei.
 */
export function Ikhtisar({ surveys, isHr, onOpen }: { surveys: Survey[]; isHr: boolean; onOpen: (surveyId: string) => void }) {
  const main = useMemo(() => surveys.filter((s) => !s.config.archived), [surveys]);
  const [data, setData] = useState<Record<string, Loaded>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(main.map(async (s) => {
      const [summary, themes, actions, responses] = await Promise.all([
        loadSummary(s.id), s.config.themes?.length ? loadThemes(s.id) : Promise.resolve([] as ThemePeriod[]), loadActions(s.id),
        isHr && s.config.kind === "360" ? loadResponses(s.id) : Promise.resolve([] as SurveyResponse[]),
      ]);
      return [s.id, { summary, themes, actions, responses }] as const;
    }))
      .then((rows) => { if (!cancelled) setData(Object.fromEntries(rows)); })
      .catch((e: Error) => toast(`Gagal memuat ikhtisar: ${e.message}`, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [main, isHr]);

  const latest = (s: Survey) => data[s.id]?.summary.filter((p) => !p.suppressed).at(-1)?.period ?? null;
  const allPeriods = main.map(latest).filter((x): x is string => !!x).sort();
  const asOf = allPeriods.at(-1);

  if (loading && !Object.keys(data).length) return <Card><p className="text-sm text-slate-500">Memuat ikhtisar…</p></Card>;

  const focus = main.flatMap((s) => (data[s.id]?.actions ?? []).filter((a) => a.is_focus && (a.status === "belum" || a.status === "berjalan")).map((a) => ({ ...a, survey: s })));
  const open = main.map((s) => ({ s, n: (data[s.id]?.actions ?? []).filter((a) => a.status === "belum" || a.status === "berjalan").length, total: (data[s.id]?.actions ?? []).length }));

  return (
    <div className="viz space-y-4">
      <VizStyle />
      <div className="grid gap-4 lg:grid-cols-3">
        {main.map((s) => <SurveyCard key={s.id} survey={s} d={data[s.id]} period={latest(s)} onOpen={() => onOpen(s.id)} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {main.filter((s) => s.config.themes?.length).map((s) => {
          const d = data[s.id];
          const p = latest(s);
          if (!d || !p) return null;
          const idx = d.themes.findIndex((t) => t.period === p);
          const win = d.themes.slice(0, idx + 1).slice(-3);
          const rows = topThemes(themeMatrix(s.config.themes ?? [], win, win.map((t) => t.period)), 6);
          const n = d.themes[idx]?.n ?? 0;
          const first = rows[0];
          return (
            <ChartCard key={s.id} title={first ? `${s.config.navLabel}: "${first.label}" paling banyak disebut — ${first.latest} dari ${n}` : `${s.config.navLabel}: keluhan teratas`}
              subtitle={`${periodLabel(p)} · jumlah ${s.config.kind === "spv_report" ? "SPG" : "karyawan"} yang menyebut tema (dihitung dari kata kunci). Panah = perubahan persen vs bulan lalu.`}
              table={{ head: ["Tema", "Menyebut", "Persen", "Perubahan (poin)"], rows: rows.map((r) => [r.label, r.latest ?? 0, `${Math.round(((r.latest ?? 0) / Math.max(1, n)) * 100)}%`, r.deltaPct === null ? "—" : Math.round(r.deltaPct)]) }}>
              <HBars unit={s.config.kind === "spv_report" ? "SPG" : "orang"} rows={rows.map((r) => ({ key: r.key, label: r.label, value: r.latest ?? 0, pct: n ? ((r.latest ?? 0) / n) * 100 : null, delta: r.deltaPct }))} />
              <button type="button" className="mt-3 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={() => onOpen(s.id)}>Lihat peta keluhan lengkap →</button>
            </ChartCard>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Perlu diputuskan</h2>
          {focus.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Belum ada tindak lanjut yang dijadikan fokus. Pilih maksimal 3 dari daftar usulan supaya ada yang benar-benar dikerjakan bulan ini.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">{focus.map((a) => <li key={a.id}><span className="text-amber-500">★</span> {a.title} <span className="text-xs text-slate-400">· {a.survey.config.navLabel}{a.pic ? ` · PIC ${a.pic}` : ""}</span></li>)}</ul>
          )}
          <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            {open.map(({ s, n, total }) => (
              <li key={s.id} className="flex justify-between"><span>{s.config.navLabel}</span><span className="tabular-nums">{n} terbuka dari {total} butir</span></li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => onOpen(main[0]?.id ?? "")}>Buka papan tindak lanjut</Button>
        </Card>

        <ChartCard title="Kelengkapan data" subtitle="Bulan terakhir tiap survei: jawaban yang masuk vs yang dihitung." >
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1.5 font-medium">Survei</th><th className="py-1.5 font-medium">Bulan</th><th className="py-1.5 text-right font-medium">Masuk</th><th className="py-1.5 text-right font-medium">Dihitung</th><th className="py-1.5 text-right font-medium">Orang unik</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {main.map((s) => {
                const c = coverage(data[s.id]?.summary ?? []).at(-1);
                return <tr key={s.id}><td className="py-1.5">{s.config.navLabel}</td><td className="py-1.5">{c?.label ?? "—"}</td><td className="py-1.5 text-right tabular-nums">{c?.total ?? "—"}</td><td className="py-1.5 text-right font-medium tabular-nums">{c?.counted ?? "—"}</td><td className="py-1.5 text-right tabular-nums">{c?.people ?? "—"}</td></tr>;
              })}
            </tbody>
          </table></div>
          {asOf && <p className="mt-2 text-[11px] text-slate-400">Data terbaru: {periodLabel(asOf)}. Belum ada data untuk bulan setelahnya.</p>}
        </ChartCard>
      </div>
    </div>
  );
}

function SurveyCard({ survey, d, period, onOpen }: { survey: Survey; d?: Loaded; period: string | null; onOpen: () => void }) {
  const kind = survey.config.kind;
  const sum = d?.summary.find((p) => p.period === period);
  const kpis = d && period && kind !== "360" ? headlineKpis(survey, d.summary, period) : [];
  const prev = d && period ? d.summary.slice(0, d.summary.findIndex((p) => p.period === period)).reverse().find((p) => !p.suppressed) : undefined;
  const cov = coverage(sum ? [sum] : [])[0];

  let leaderAvg: number | null = null, leaderPrev: number | null = null, raters = 0;
  if (kind === "360" && d) {
    const { leader } = build360(survey.config, d.responses.filter((r) => !r.excluded), PEER, LEADER);
    const ps = Object.keys(leader.periods).sort();
    leaderAvg = ps.length ? leader.periods[ps.at(-1) as string].avg : null;
    leaderPrev = ps.length > 1 ? leader.periods[ps.at(-2) as string].avg : null;
    raters = ps.length ? leader.periods[ps.at(-1) as string].raters : 0;
  }
  const p360 = kind === "360" && d ? Object.keys(build360(survey.config, d.responses, PEER, LEADER).leader.periods).sort().at(-1) ?? null : null;
  const when = kind === "360" ? p360 : period;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{survey.config.navLabel ?? survey.title}</h2>
          <p className="text-xs text-slate-500">{survey.config.who}</p>
        </div>
        {kind === "360" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">khusus HR</span>}
      </div>
      <p className="mt-3 text-[32px] font-semibold leading-none text-slate-900 dark:text-white">{kind === "360" ? raters || "—" : sum?.n ?? "—"}<span className="ml-1.5 text-sm font-normal text-slate-500">{kind === "360" ? "penilai" : "jawaban"}</span></p>
      <p className="mt-1 text-xs text-slate-500">{when ? periodLabel(when) : "Belum ada data"}{cov && cov.total !== cov.counted ? ` · ${cov.total} baris masuk · ${cov.people} orang unik` : ""}</p>

      <ul className="mt-3 flex-1 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        {kind === "360" ? (
          <li className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300">Penilaian ke Leader SPV</span>
            <span className="tabular-nums"><b className="text-sm font-semibold text-slate-900 dark:text-white">{fmtNum(leaderAvg, 1)}</b><span className="text-slate-400"> / 5</span>
              {leaderAvg !== null && leaderPrev !== null && Math.abs(leaderAvg - leaderPrev) >= 0.05 && <span className="ml-1.5" style={{ color: leaderAvg > leaderPrev ? "var(--v-good)" : "var(--v-bad)" }}>{leaderAvg > leaderPrev ? "▲" : "▼"} {fmtNum(Math.abs(leaderAvg - leaderPrev), 1)}</span>}</span>
          </li>
        ) : kpis.map((k, i) => {
          const dt = deltaText(k, prev ? periodLabel(prev.period) : null);
          return (
            <li key={k.key}>
              <p className="text-xs text-slate-600 dark:text-slate-300">{k.label}</p>
              <div className="flex items-center justify-between gap-2">
                <b className="text-2xl font-semibold leading-tight text-slate-900 dark:text-white">{k.pct === null ? "—" : `${Math.round(k.pct)}%`}</b>
                <Spark values={k.series} color={COLORS[i % COLORS.length]} />
              </div>
              {dt.text && <p className={cn("text-[11px]", dt.tone === "bad" ? "text-red-600" : dt.tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400")}>{dt.text}</p>}
            </li>
          );
        })}
      </ul>
      <Button size="sm" className="mt-3 self-start" onClick={onOpen}>Buka dashboard →</Button>
    </Card>
  );
}
