"use client";

import { Button, Label, inputClass } from "@/components/app-shell";
import { ACTION_STATUS_LABEL, type ActionStatus, type SurveyAction } from "@/lib/rr/pulse";

export type ActionDraft = Partial<SurveyAction> & { raised_by?: string };

/** Formulir tambah/ubah tindak lanjut. Kolom "Diangkat oleh" hanya untuk HR. */
export function ActionModal({ draft, setDraft, themes, isHr, onSave }: {
  draft: ActionDraft; setDraft: (d: ActionDraft | null) => void; themes: string[]; isHr: boolean; onSave: () => void;
}) {
  return (
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
            <datalist id="pulse-themes">{themes.map((t) => <option key={t} value={t} />)}</datalist></div>
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
            <div className="sm:col-span-2"><Label>Diangkat oleh / dasar angka (hanya terlihat oleh HR)</Label>
              <input className={inputClass} value={draft.raised_by ?? ""} onChange={(e) => setDraft({ ...draft, raised_by: e.target.value })} /></div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(null)}>Batal</Button>
          <Button variant="primary" onClick={onSave}>Simpan</Button>
        </div>
      </div>
    </div>
  );
}
