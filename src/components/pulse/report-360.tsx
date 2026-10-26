"use client";

import { useState } from "react";
import { Button, Card, cn, inputClass } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { build360, periodLabel, saveSurveyConfig, type Survey, type SurveyResponse } from "@/lib/rr/pulse";
import { heatClass, shortMonth } from "./charts";

const PEER = ["teamwork", "problem", "sharing", "ownership", "teamlead"];
const LEADER = ["leader_direction", "leader_problem", "leader_mentoring", "leader_openness", "leader_fairness"];
const fmt = (x: number | null | undefined) => (x == null ? "—" : x.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const heat = (x: number | null | undefined) => heatClass(x == null ? null : ((x - 1) / 4) * 100, false);

/** Rapor Feedback 360 SPV — khusus HR (survei ini tidak terlihat oleh owner). */
export function Report360({ survey, responses, canEdit, onSaved }: { survey: Survey; responses: SurveyResponse[]; canEdit: boolean; onSaved: () => void }) {
  const cfg = survey.config;
  const { leader, targets } = build360(cfg, responses.filter((r) => !r.excluded), PEER, LEADER);
  const periods = [...new Set(responses.map((r) => r.period))].sort();
  const label = (k: string) => survey.questions.find((q) => q.key === k)?.label.split(":")[0] ?? k;
  const peerLabel = (k: string) => survey.questions.find((q) => q.key === `p1_${k}`)?.label.split(":")[0] ?? k;
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [map, setMap] = useState<Record<string, string>>(Object.fromEntries(Object.entries(cfg.targets ?? {}).map(([k, v]) => [k, v ?? ""])));
  const spvs = survey.questions.find((q) => q.key === "rater")?.options?.map((o) => o.value) ?? [];

  const saveMap = async () => {
    const targetsNew = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v || null]));
    const err = await saveSurveyConfig(survey.id, { ...cfg, targets: targetsNew });
    if (err) { toast(err, "error"); return; }
    toast("Pemetaan blok disimpan");
    setEditing(false);
    onSaved();
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-900">
        <p className="text-xs text-amber-800 dark:text-amber-300">Hanya tim HR yang bisa membuka survei ini. Dengan 7 SPV, angka rata-rata pun mudah ditebak siapa penilainya — jangan diteruskan mentah ke SPV maupun owner.</p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Penilaian SPV terhadap Leader SPV{leader.name ? ` (${leader.name})` : ""}</h2>
        <p className="text-xs text-slate-500">Skala 1–5. Satu baris per putaran.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Putaran</th><th className="py-2 pr-3 text-right font-medium">Penilai</th><th className="py-2 pr-3 text-right font-medium">Rata-rata</th>
              {LEADER.map((k) => <th key={k} className="px-2 py-2 text-center font-medium">{label(k)}</th>)}
            </tr></thead>
            <tbody>
              {Object.entries(leader.periods).sort().map(([p, s]) => (
                <tr key={p} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{periodLabel(p)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s.raters}</td>
                  <td className="py-2 pr-3 text-right font-semibold tabular-nums">{fmt(s.avg)}</td>
                  {LEADER.map((k) => <td key={k} className={cn("px-2 py-2 text-center tabular-nums", heat(s.items[k]))}>{fmt(s.items[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Object.entries(leader.periods).sort().map(([p, s]) => (
          <div key={p} className="mt-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
            <p className="font-medium text-slate-700 dark:text-slate-200">{periodLabel(p)} — per penilai: {s.byRater.map((b) => `${b.rater} ${fmt(b.avg)}`).join(" · ")}</p>
            {s.strengths.map((t, i) => <p key={`s${i}`} className="mt-1 text-emerald-700 dark:text-emerald-400">+ {t.rater}: {t.text}</p>)}
            {s.improvements.map((t, i) => <p key={`i${i}`} className="mt-1 text-red-700 dark:text-red-400">− {t.rater}: {t.text}</p>)}
          </div>
        ))}
      </Card>

      <Card padding={false} className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Penilaian antar-SPV</h2>
            <p className="max-w-3xl text-xs text-slate-500">Rata-rata dari rekan; penilaian diri ditampilkan terpisah dan tidak ikut dirata-ratakan. Klik baris untuk melihat rincian dan komentar.</p>
          </div>
          {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>{editing ? "Batal" : "Atur nama per blok"}</Button>}
        </div>
        {editing && (
          <div className="mx-5 mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">{cfg.targetNote}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              {Object.keys(map).sort().map((b) => (
                <label key={b} className="text-xs text-slate-600 dark:text-slate-300">Blok {b.slice(1)}
                  <select className={cn(inputClass, "mt-1 py-1 text-xs")} value={map[b]} onChange={(e) => setMap({ ...map, [b]: e.target.value })}>
                    <option value="">Belum dipastikan</option>{spvs.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-2 flex justify-end"><Button size="sm" variant="primary" onClick={saveMap}>Simpan pemetaan</Button></div>
          </div>
        )}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">SPV dinilai</th>
              {periods.map((p) => <th key={p} className="px-3 py-2 text-center font-medium">{shortMonth(p)} (rekan · diri)</th>)}
            </tr></thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.block} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50" onClick={() => setOpen(open === t.block ? null : t.block)}>
                  <td className="px-5 py-2">{t.name ?? <span className="text-slate-400">Blok {t.block.slice(1)} — belum dipastikan</span>}</td>
                  {periods.map((p) => {
                    const s = t.periods[p];
                    return (
                      <td key={p} className={cn("px-3 py-2 text-center tabular-nums", heat(s?.avg))}>
                        {s ? <>{fmt(s.avg)} <span className="text-[11px] text-slate-500">({s.raters})</span>{s.self != null && <span className="text-[11px] text-slate-500"> · {fmt(s.self)}</span>}</> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {targets.filter((t) => t.block === open).map((t) => (
          <div key={t.block} className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
            {Object.entries(t.periods).sort().map(([p, s]) => (
              <div key={p} className="mb-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{periodLabel(p)} — {s.raters} rekan</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {PEER.map((k) => <span key={k} className={cn("rounded px-2 py-0.5 text-[11px]", heat(s.items[k]))}>{peerLabel(k)} {fmt(s.items[k])}</span>)}
                </div>
                {s.strengths.map((x, i) => <p key={`s${i}`} className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">+ {x.rater}: {x.text}</p>)}
                {s.improvements.map((x, i) => <p key={`i${i}`} className="mt-1 text-xs text-red-700 dark:text-red-400">− {x.rater}: {x.text}</p>)}
              </div>
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}
