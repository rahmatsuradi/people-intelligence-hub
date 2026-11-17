"use client";

import { useMemo, useState } from "react";
import { Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { WORK_GROUP_LABEL, type MasterEmployee, type WorkGroup } from "@/lib/rr/master";
import { DOC_KINDS, FIELD_BY_KEY, bankName, diffWithMaster, matchOutlet, maskTail, suggestPtkp } from "@/lib/kantorku/intake";
import { KK_PTKP } from "@/lib/kantorku/spec";
import { SUBMISSION_FLAG_LABEL, applySubmission, openDoc, rejectSubmission, type DataLink, type Submission } from "@/lib/kantorku/store";
import { Modal, fmtDateTime, formValues, type KkData } from "./shared";

/** Saran kelompok kerja dari divisi yang dipilih karyawan (Department KantorKu). HR tetap bisa mengganti. */
const GROUP_BY_DEPT: Record<string, WorkGroup> = {
  SPG: "spg", "Store Supervisor": "spv", Produksi: "produksi", Santen: "santan", "Driver/Delivery": "sopir", "Host Live": "host_live",
};
const groupFromDept = (d: string | undefined): WorkGroup | "" => (d ? GROUP_BY_DEPT[d] ?? "office" : "");

const STATUS_TEXT = { baru: "Belum diperiksa", diterapkan: "Diterapkan", ditolak: "Ditolak" } as const;

export function SubmissionsTab({ submissions, links, data, onChanged }: {
  submissions: Submission[]; links: DataLink[]; data: KkData; onChanged: () => void;
}) {
  const [status, setStatus] = useState<Submission["status"] | "">("baru");
  const [open, setOpen] = useState<Submission | null>(null);
  const byId = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);
  const list = submissions.filter((s) => !status || s.status === status);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Isian masuk</h2>
            <p className="mt-0.5 text-xs text-slate-500">Isian belum mengubah master sampai diterapkan. Periksa perubahannya, lalu terapkan atau tolak.</p>
          </div>
          <select className={cn(inputClass, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="baru">Belum diperiksa ({submissions.filter((s) => s.status === "baru").length})</option>
            <option value="diterapkan">Diterapkan</option>
            <option value="ditolak">Ditolak</option>
            <option value="">Semua</option>
          </select>
        </div>
        <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {list.map((s) => {
            const target = s.employee_id ? byId.get(s.employee_id) : null;
            const link = s.link_id ? linkById.get(s.link_id) : null;
            return (
              <button key={s.id} type="button" onClick={() => setOpen(s)} className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{s.answers.full_name ?? "(tanpa nama)"}</p>
                  <p className="text-xs text-slate-500">
                    {link?.employee_id ? "Link pribadi" : "Link umum"} · {target ? `→ ${target.full_name}` : "belum terhubung ke karyawan"} · {s.answers.position ?? "—"}
                  </p>
                  {s.flags.filter((f) => f !== "link_umum").length > 0 && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{s.flags.filter((f) => f !== "link_umum").map((f) => SUBMISSION_FLAG_LABEL[f] ?? f).join(" · ")}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500">{fmtDateTime(s.submitted_at)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", s.status === "baru" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : s.status === "diterapkan" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>{STATUS_TEXT[s.status]}</span>
              </button>
            );
          })}
          {!list.length && <p className="px-3 py-6 text-center text-sm text-slate-500">Belum ada isian.</p>}
        </div>
      </Card>
      {open && <ReviewModal s={open} data={data} onClose={() => setOpen(null)} onDone={() => { setOpen(null); onChanged(); }} />}
    </div>
  );
}

function ReviewModal({ s, data, onClose, onDone }: { s: Submission; data: KkData; onClose: () => void; onDone: () => void }) {
  const byId = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const [target, setTarget] = useState<string>(s.employee_id ?? "");
  const [search, setSearch] = useState("");
  const emp: MasterEmployee | null = target ? byId.get(target) ?? null : null;
  const suggestion = suggestPtkp(s.answers);
  const currentPtkp = emp ? data.extraById.get(emp.id)?.ptkp_status ?? null : null;
  const [ptkp, setPtkp] = useState<string>(suggestion.ptkp ?? "");
  const [outletId, setOutletId] = useState<string>(matchOutlet(s.answers.outlet, data.outlets)?.id ?? "");
  const [group, setGroup] = useState<WorkGroup | "">(groupFromDept(s.answers.department));
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [reveal, setReveal] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const readOnly = s.status !== "baru";

  const diff = useMemo(() => diffWithMaster(s.answers, formValues(emp, data)), [s.answers, emp, data]);
  const unchanged = Object.keys(s.answers).filter((k) => !diff.some((d) => d.key === k));
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return data.employees.filter((e) => e.full_name.toLowerCase().includes(q) || (e.nik ?? "").includes(q)).slice(0, 8);
  }, [search, data.employees]);
  const sameNik = useMemo(() => (s.answers.nik ? data.employees.filter((e) => e.nik === s.answers.nik) : []), [s.answers.nik, data.employees]);

  const toggle = (k: string) => setSkip((x) => { const n = new Set(x); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const shown = (k: string, v: string | null, sensitive: boolean) => {
    if (!v) return <span className="text-slate-400">kosong</span>;
    const text = k === "bank_code" ? bankName(v) ?? v : v;
    return sensitive && !reveal ? <span className="font-mono">{maskTail(text)}</span> : <span>{text}</span>;
  };

  const apply = async () => {
    if (!emp && !group) { toast("Pilih kelompok kerja untuk karyawan baru.", "error"); return; }
    if (emp && !emp.profile && !group) { toast("Karyawan ini belum punya profil — pilih kelompok kerjanya.", "error"); return; }
    if (!emp && !window.confirm(`Buat karyawan baru "${s.answers.full_name}"? Pastikan orangnya belum ada di master (cek dengan pencarian di atas).`)) return;
    setBusy(true);
    const res = await applySubmission(s, { employeeId: emp?.id ?? null, ptkp: ptkp && ptkp !== currentPtkp ? ptkp : null, outletId: outletId || null, workGroup: group || null, skip }, emp, data.outlets);
    setBusy(false);
    if (res.error) { toast(res.error, "error"); if (!res.employeeId) return; }
    else toast(emp ? "Isian diterapkan ke master." : "Karyawan baru dibuat dari isian.");
    onDone();
  };

  const reject = async () => {
    if (!window.confirm("Tolak isian ini? Master tidak berubah; isiannya tetap tersimpan sebagai riwayat.")) return;
    setBusy(true);
    const err = await rejectSubmission(s.id, note);
    setBusy(false);
    if (err) toast(err, "error"); else onDone();
  };

  return (
    <Modal title={s.answers.full_name ?? "Isian"} subtitle={`Dikirim ${fmtDateTime(s.submitted_at)} · ${STATUS_TEXT[s.status]}`} onClose={onClose}
      actions={<Button size="sm" onClick={() => setReveal((r) => !r)}>{reveal ? "Samarkan" : "Tampilkan data sensitif"}</Button>}>
      {s.flags.filter((f) => f !== "link_umum").length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <ul className="list-inside list-disc text-xs">{s.flags.filter((f) => f !== "link_umum").map((f) => <li key={f}>{SUBMISSION_FLAG_LABEL[f] ?? f}</li>)}</ul>
        </div>
      )}

      <section>
        <Label>Untuk karyawan</Label>
        {emp ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-100">{emp.full_name}</span>
            <span className="text-xs text-slate-500">{emp.position ?? "—"} · {emp.profile ? WORK_GROUP_LABEL[emp.profile.work_group] : "tanpa profil"}</span>
            {!readOnly && <Button size="sm" variant="ghost" onClick={() => setTarget("")}>Ganti</Button>}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">Belum terhubung — akan dibuat sebagai <b>karyawan baru</b>, kecuali Anda memilih karyawan yang ada.</p>
            {sameNik.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">NIK yang sama ada di master: {sameNik.map((e) => e.full_name).join(", ")}</p>}
            {!readOnly && <>
              <input className={inputClass} placeholder="Cari nama / NIK karyawan yang ada…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {matches.length > 0 && <div className="flex flex-wrap gap-1.5">{matches.map((e) => <Button key={e.id} size="sm" onClick={() => { setTarget(e.id); setSearch(""); }}>{e.full_name} · {e.position ?? "—"}</Button>)}</div>}
            </>}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{emp ? `Berubah atau baru diisi (${diff.length})` : `Isian (${diff.length})`}</h3>
        {!readOnly && emp && <p className="text-xs text-slate-500">Hapus centang untuk mempertahankan nilai lama di master.</p>}
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
              <tr>{!readOnly && <th className="w-8 px-3 py-2"></th>}<th className="px-3 py-2">Data</th>{emp && <th className="px-3 py-2">Di master</th>}<th className="px-3 py-2">Isian</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {diff.map((d) => (
                <tr key={d.key} className={skip.has(d.key) ? "opacity-50" : ""}>
                  {!readOnly && <td className="px-3 py-1.5"><input type="checkbox" checked={!skip.has(d.key)} onChange={() => toggle(d.key)} /></td>}
                  <td className="px-3 py-1.5 text-xs text-slate-500">{d.label}</td>
                  {emp && <td className="px-3 py-1.5">{shown(d.key, d.before, d.sensitive)}</td>}
                  <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">{shown(d.key, s.answers[d.key], d.sensitive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {emp && unchanged.length > 0 && <p className="mt-1 text-xs text-slate-500">Sama dengan master: {unchanged.map((k) => FIELD_BY_KEY.get(k)?.label ?? k).join(", ")}.</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Status PTKP</Label>
          <select className={inputClass} value={ptkp} disabled={readOnly} onChange={(e) => setPtkp(e.target.value)}>
            <option value="">{currentPtkp && currentPtkp !== "BELUM_DIISI" ? `Tidak diubah (${currentPtkp})` : "Belum ditetapkan"}</option>
            {KK_PTKP.map((p) => <option key={p} value={p}>{p}{p === suggestion.ptkp ? " — saran dari isian" : ""}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{s.answers.marital_status ?? "—"}, {s.answers.dependents ?? "?"} tanggungan. {suggestion.note}</p>
        </div>
        <div>
          <Label>Outlet / penempatan</Label>
          <select className={inputClass} value={outletId} disabled={readOnly} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">{s.answers.outlet ? `Catat sebagai teks: "${s.answers.outlet}"` : "—"}</option>
            {data.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}{o.area ? ` (${o.area})` : ""}</option>)}
          </select>
        </div>
        {(!emp || !emp.profile) && (
          <div>
            <Label>Kelompok kerja</Label>
            <select className={inputClass} value={group} disabled={readOnly} onChange={(e) => setGroup(e.target.value as WorkGroup)}>
              <option value="">Pilih…</option>
              {Object.entries(WORK_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Dokumen</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {DOC_KINDS.map((d) => s.files[d.key]
            ? <Button key={d.key} size="sm" onClick={() => openDoc(`storage:pi-employee-docs/${s.files[d.key]}`).catch((e: Error) => toast(e.message, "error"))}>{d.label} ↗</Button>
            : <span key={d.key} className="rounded-lg border border-dashed border-slate-200 px-2.5 py-1 text-xs text-slate-400 dark:border-slate-700">{d.label}: tidak diunggah</span>)}
        </div>
      </section>

      {readOnly ? (
        <p className="text-sm text-slate-500">{STATUS_TEXT[s.status]} {fmtDateTime(s.reviewed_at)}{s.review_note ? ` · ${s.review_note}` : ""}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="min-w-[12rem] flex-1">
            <Label>Catatan (kalau ditolak)</Label>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. isian ganda, salah orang" />
          </div>
          <Button variant="secondary" disabled={busy} onClick={reject}>Tolak</Button>
          <Button variant="primary" disabled={busy} onClick={apply}>{emp ? "Terapkan ke master" : "Buat karyawan baru"}</Button>
        </div>
      )}
    </Modal>
  );
}
