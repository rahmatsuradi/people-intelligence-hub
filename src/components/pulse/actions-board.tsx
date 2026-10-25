"use client";

import { useMemo, useState } from "react";
import { Button, Card, cn, inputClass } from "@/components/app-shell";
import { ACTION_STATUS_LABEL, MAX_FOCUS, periodLabel, recurringThemes, type ActionStatus, type SurveyAction } from "@/lib/rr/pulse";

const COLUMNS: { status: ActionStatus; hint: string }[] = [
  { status: "belum", hint: "Sudah dicatat, belum ada yang bergerak" },
  { status: "berjalan", hint: "Ada PIC & langkah yang sedang dikerjakan" },
  { status: "selesai", hint: "Tuntas — jangan lupa kabari balik karyawan" },
];
const NEXT: Partial<Record<ActionStatus, ActionStatus>> = { belum: "berjalan", berjalan: "selesai" };

export function ActionsBoard({ actions, raisers, isHr, canEdit, period, onAdd, onEdit, onPatch, onDelete }: {
  actions: SurveyAction[]; raisers: Map<string, string>; isHr: boolean; canEdit: boolean; period: string;
  onAdd: () => void; onEdit: (a: SurveyAction) => void; onPatch: (a: SurveyAction, patch: Partial<SurveyAction>) => void; onDelete: (a: SurveyAction) => void;
}) {
  const [theme, setTheme] = useState("");
  const [scope, setScope] = useState<"semua" | "siklus">("semua");
  const themes = [...new Set(actions.map((a) => a.theme ?? "lainnya"))].sort();
  const shown = actions.filter((a) => (!theme || (a.theme ?? "lainnya") === theme) && (scope === "semua" || a.period === period));
  const focus = actions.filter((a) => a.is_focus && (a.status === "belum" || a.status === "berjalan"));
  const recurring = useMemo(() => new Map(recurringThemes(actions).map((t) => [t.theme, t.periods.length])), [actions]);
  const cancelled = shown.filter((a) => a.status === "dibatalkan").length;

  const card = (a: SurveyAction) => {
    const overdue = a.due_date && a.status !== "selesai" && a.due_date < new Date().toISOString().slice(0, 10);
    return (
      <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-2">
          {canEdit ? (
            <button type="button" title={a.is_focus ? "Hapus dari fokus" : "Jadikan fokus"} onClick={() => onPatch(a, { is_focus: !a.is_focus })}
              className={cn("mt-0.5 text-base leading-none", a.is_focus ? "text-amber-500" : "text-slate-300 hover:text-amber-400")}>★</button>
          ) : a.is_focus ? <span className="mt-0.5 text-base leading-none text-amber-500">★</span> : null}
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{a.theme ?? "lainnya"}</span>
          {(recurring.get(a.theme ?? "") ?? 0) >= 3 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700 dark:bg-red-950/40 dark:text-red-300">berulang {recurring.get(a.theme ?? "")} bln</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">{periodLabel(a.period)}</span>
          {a.pic && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">PIC {a.pic}</span>}
          {a.due_date && <span className={cn("rounded-full px-2 py-0.5", overdue ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>tenggat {new Date(a.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>}
        </div>
        {a.result && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300"><span className="text-slate-400">Hasil:</span> {a.result}</p>}
        {a.told_back && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">✓ Disampaikan ke karyawan: {a.told_back}</p>}
        {a.status === "selesai" && !a.told_back && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Belum dikabarkan balik ke karyawan</p>}
        {isHr && raisers.get(a.id) && <p className="mt-1 text-[11px] text-slate-400">Diangkat oleh {raisers.get(a.id)}</p>}
        {canEdit && (
          <div className="mt-2 flex flex-wrap gap-1">
            {NEXT[a.status] && <Button size="sm" onClick={() => onPatch(a, { status: NEXT[a.status] })}>→ {ACTION_STATUS_LABEL[NEXT[a.status]!]}</Button>}
            <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>Ubah</Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(a)}>Hapus</Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Card className={focus.length > MAX_FOCUS ? "border-red-300" : "border-amber-200 dark:border-amber-900"}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">★ Fokus saat ini ({focus.length}/{MAX_FOCUS})</h2>
            <p className="text-xs text-slate-500">Pilih paling banyak {MAX_FOCUS} hal untuk benar-benar dikerjakan. Klik bintang di kartu untuk menjadikannya fokus.</p>
          </div>
          {canEdit && <Button variant="primary" size="sm" onClick={onAdd}>+ Tindak lanjut</Button>}
        </div>
        {focus.length > MAX_FOCUS && <p className="mt-2 text-xs text-red-600">Terlalu banyak fokus — kalau semuanya prioritas, tidak ada yang prioritas.</p>}
        {focus.length === 0 ? <p className="mt-2 text-sm text-slate-500">Belum ada fokus.</p> : (
          <ul className="mt-3 grid gap-2 md:grid-cols-3">{focus.map(card)}</ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <select className={cn(inputClass, "w-auto")} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
          <option value="semua">Semua bulan</option><option value="siklus">Hanya {periodLabel(period)}</option>
        </select>
        <select className={cn(inputClass, "w-auto")} value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="">Semua tema</option>{themes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-slate-500">{shown.length} butir{cancelled ? ` · ${cancelled} dibatalkan tidak ditampilkan` : ""}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = shown.filter((a) => a.status === col.status).sort((a, b) => Number(!!b.is_focus) - Number(!!a.is_focus) || b.period.localeCompare(a.period));
          return (
            <div key={col.status} className="rounded-xl bg-slate-100/70 p-3 dark:bg-slate-900/60">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ACTION_STATUS_LABEL[col.status]} <span className="font-normal text-slate-500">({list.length})</span></h3>
              <p className="text-[11px] text-slate-500">{col.hint}</p>
              <ul className="mt-2 max-h-[70vh] space-y-2 overflow-y-auto pr-1">{list.map(card)}</ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
