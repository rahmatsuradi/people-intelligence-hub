"use client";

import { useMemo, useState } from "react";
import { Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { INSTANCE } from "@/lib/instance";
import { supabase } from "@/lib/supabase";
import { STATUS_LABEL, WORK_GROUP_LABEL, type MasterEmployee } from "@/lib/rr/master";
import { KK_LABEL, rowCells, toKantorkuRow, type KkRow, type KkUnits } from "@/lib/kantorku/map";
import { KK_EMPLOYMENT_TYPES, KK_PAYEE_TIDAK_TETAP, KK_PTKP, KK_TAXABILITY, KK_TAX_STATUSES_SUPPORTED, type KkKey } from "@/lib/kantorku/spec";
import { fillTemplate } from "@/lib/kantorku/xlsx";
import { markExported, saveHris, type HrisRow } from "@/lib/kantorku/store";
import { Modal, fmtDateTime, toSource, type KkData } from "./shared";

type Scope = "semua" | "belum_diekspor" | "tanpa_id";

export function ExportTab({ data, template, templateLabel, units, onTemplate, taxability, setTaxability, onChanged }: {
  data: KkData; template: Uint8Array | null; templateLabel: string; units: KkUnits | null; onTemplate: (bytes: Uint8Array, label: string) => void;
  taxability: string; setTaxability: (v: string) => void; onChanged: () => void;
}) {
  const [includeVerify, setIncludeVerify] = useState(false);
  const [scope, setScope] = useState<Scope>("belum_diekspor");
  const [problemKey, setProblemKey] = useState<KkKey | "">("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MasterEmployee | null>(null);
  const [withUnready, setWithUnready] = useState(false);

  const rows = useMemo(() => {
    if (!units) return [];
    return data.employees
      .filter((e) => e.status === "active" || (includeVerify && e.status === "perlu_verifikasi"))
      .map((e) => ({ e, row: toKantorkuRow(toSource(e, data), units, { taxability }) }));
  }, [data, units, includeVerify, taxability]);

  const inScope = rows.filter(({ e }) => {
    const h = data.hrisById.get(e.id);
    return scope === "semua" || (scope === "belum_diekspor" ? !h?.exported_at : !h?.kantorku_employee_id);
  });
  const ready = inScope.filter((r) => !r.row.problems.length);
  const problemCounts = useMemo(() => {
    const m = new Map<KkKey, number>();
    for (const { row } of inScope) for (const p of new Set(row.problems.map((x) => x.key))) m.set(p, (m.get(p) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [inScope]);
  const q = search.trim().toLowerCase();
  const shown = inScope.filter(({ e, row }) => (!problemKey || row.problems.some((p) => p.key === problemKey)) && (!q || e.full_name.toLowerCase().includes(q)));

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { readUnits } = await import("@/lib/kantorku/xlsx");
      const u = readUnits(bytes);
      if (!u.branches.length) throw new Error("Sheet Existing Data kosong — unduh ulang template dari KantorKu.");
      onTemplate(bytes, `${f.name} (diunggah)`);
      toast(`Template dipakai: ${u.branches.length} branch, ${u.departments.length} department, ${u.positions.length} position.`);
    } catch (err) { toast((err as Error).message, "error"); }
  };

  const download = async () => {
    if (!template) return;
    const pick = withUnready ? inScope : ready;
    if (!pick.length) { toast("Tidak ada karyawan yang siap diekspor.", "error"); return; }
    if (withUnready && pick.length > ready.length && !window.confirm(`${pick.length - ready.length} baris belum lengkap dan kemungkinan ditolak KantorKu. Tetap sertakan?`)) return;
    try {
      const out = fillTemplate(template, pick.map((r) => rowCells(r.row)));
      const blob = new Blob([out.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `KantorKu Import Karyawan - ${INSTANCE.shortName} - ${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      const err = await markExported(pick.map((r) => r.e.id));
      if (err) toast(`Berkas terunduh, tapi tanda "sudah diekspor" gagal disimpan: ${err}`, "error");
      else toast(`${pick.length} karyawan diekspor.`);
      onChanged();
    } catch (err) { toast((err as Error).message, "error"); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <Label>Template KantorKu</Label>
            <p className="text-sm text-slate-700 dark:text-slate-200">{template ? templateLabel : "Belum ada — unggah template dari KantorKu"}</p>
            <label className="mt-1 inline-block cursor-pointer text-xs text-blue-600 hover:underline">
              Ganti dengan template terbaru dari KantorKu…
              <input type="file" accept=".xlsx" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            <p className="mt-1 text-xs text-slate-500">Unduh ulang dari KantorKu bila Branch/Department/Position di sana berubah — pilihannya dibaca dari sheet &quot;Existing Data&quot;.</p>
          </div>
          <div>
            <Label>Taxability bawaan perusahaan</Label>
            <select className={inputClass} value={taxability} onChange={(e) => setTaxability(e.target.value)}>
              <option value="">Pilih…</option>
              {KK_TAXABILITY.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Gross = pajak dipotong dari gaji; Gross Up = perusahaan memberi tunjangan pajak; Nett = pajak ditanggung perusahaan. Tidak bisa diubah di tengah tahun pajak di KantorKu.</p>
          </div>
          <div>
            <Label>Yang diekspor</Label>
            <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="belum_diekspor">Belum pernah diekspor</option>
              <option value="tanpa_id">Belum punya Employee ID KantorKu</option>
              <option value="semua">Semua karyawan aktif</option>
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeVerify} onChange={(e) => setIncludeVerify(e.target.checked)} /> Sertakan status &quot;perlu verifikasi&quot;
            </label>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Karyawan yang sudah ada di KantorKu: isi dulu Employee ID KantorKu-nya (tombol Atur). Belum dipastikan apakah KantorKu memperbarui atau menggandakan karyawan yang diimpor ulang — uji dulu dengan 1–2 orang sebelum mengimpor semuanya.
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs font-medium text-slate-500">Dalam cakupan</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{inScope.length}</p></Card>
        <Card><p className="text-xs font-medium text-slate-500">Siap diimpor</p><p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{ready.length}</p></Card>
        <Card><p className="text-xs font-medium text-slate-500">Belum lengkap</p><p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{inScope.length - ready.length}</p></Card>
        <Card className="flex flex-col justify-between gap-2">
          <Button variant="primary" disabled={!template || !(withUnready ? inScope.length : ready.length)} onClick={download}>
            Unduh untuk KantorKu ({withUnready ? inScope.length : ready.length})
          </Button>
          <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={withUnready} onChange={(e) => setWithUnready(e.target.checked)} /> Sertakan yang belum lengkap</label>
        </Card>
      </div>

      {problemCounts.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Yang paling sering kurang</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {problemCounts.map(([k, n]) => (
              <button key={k} type="button" onClick={() => setProblemKey(problemKey === k ? "" : k)}
                className={cn("rounded-full border px-3 py-1 text-xs", problemKey === k ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300")}>
                {KK_LABEL[k]} <span className="font-semibold tabular-nums">· {n}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Data pribadi (NIK, HP, rekening, nama pemilik rekening) paling cepat dilengkapi lewat link pribadi di tab Kirim link. Gaji pokok diisi di Pay → Employees.</p>
        </Card>
      )}

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <input className={cn(inputClass, "max-w-xs")} placeholder="Cari nama…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-slate-500">{shown.length} orang</span>
        </div>
        <div className="max-h-[36rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-800">
              <tr><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Branch · Department · Position</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.slice(0, 500).map(({ e, row }) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{e.full_name}</p>
                    <p className="text-xs text-slate-500">{e.profile ? WORK_GROUP_LABEL[e.profile.work_group] : "—"} · {e.position ?? "—"}{e.status !== "active" ? ` · ${STATUS_LABEL[e.status]}` : ""}{row.values.employeeId ? ` · ID ${row.values.employeeId}` : ""}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{[row.values.branch, row.values.department, row.values.position].map((v) => v ?? "—").join(" · ")}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.problems.length
                      ? <span className="text-amber-700 dark:text-amber-400">{row.problems.slice(0, 3).map((p) => p.message).join(" · ")}{row.problems.length > 3 ? ` · +${row.problems.length - 3}` : ""}</span>
                      : <span className="text-emerald-700 dark:text-emerald-400">Siap{data.hrisById.get(e.id)?.exported_at ? ` · diekspor ${fmtDateTime(data.hrisById.get(e.id)!.exported_at)}` : ""}</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><Button size="sm" onClick={() => setEditing(e)}>Atur</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!units && <p className="px-3 py-6 text-center text-sm text-slate-500">Unggah template KantorKu untuk melihat kesiapan data.</p>}
        </div>
      </Card>

      {editing && units && (
        <HrisEditor e={editing} data={data} units={units} taxability={taxability}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
      )}
    </div>
  );
}

function HrisEditor({ e, data, units, taxability, onClose, onSaved }: {
  e: MasterEmployee; data: KkData; units: KkUnits; taxability: string; onClose: () => void; onSaved: () => void;
}) {
  const h0 = data.hrisById.get(e.id);
  const [h, setH] = useState<Partial<HrisRow>>({ ...h0 });
  const [ptkp, setPtkp] = useState(data.extraById.get(e.id)?.ptkp_status ?? "");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof HrisRow, v: string) => setH((x) => ({ ...x, [k]: v }));
  const preview: KkRow = useMemo(() => {
    const src = toSource(e, data);
    return toKantorkuRow({ ...src, ptkp_status: ptkp || src.ptkp_status, hris: { ...src.hris, ...h } }, units, { taxability });
  }, [e, data, h, ptkp, units, taxability]);

  const save = async () => {
    setBusy(true);
    const fields = ["kantorku_employee_id", "company_email", "employment_type", "contract_end_date", "tax_status", "payee_type", "taxability", "account_holder", "bpjs_tk_number", "bpjs_kes_number", "branch", "department", "position"] as const;
    const err = await saveHris(e.id, Object.fromEntries(fields.map((k) => [k, (h[k] as string | null | undefined) ?? null])));
    let err2: string | null = null;
    const curPtkp = data.extraById.get(e.id)?.ptkp_status ?? "";
    if (!err && ptkp && ptkp !== curPtkp && supabase) {
      const r = await supabase.from("pi_employees").update({ ptkp_status: ptkp }).eq("id", e.id);
      err2 = r.error?.message ?? null;
    }
    setBusy(false);
    if (err || err2) { toast(err ?? err2!, "error"); return; }
    toast("Tersimpan.");
    onSaved();
  };

  const sel = (k: keyof HrisRow, label: string, opts: readonly string[], derivedValue: string | number | null, help?: string) => (
    <div>
      <Label>{label}</Label>
      <select className={inputClass} value={(h[k] as string) ?? ""} onChange={(ev) => set(k, ev.target.value)}>
        <option value="">{derivedValue ? `Otomatis: ${derivedValue}` : "Pilih…"}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
  const txt = (k: keyof HrisRow, label: string, placeholder?: string, type = "text") => (
    <div>
      <Label>{label}</Label>
      <input type={type} className={inputClass} value={(h[k] as string) ?? ""} placeholder={placeholder} onChange={(ev) => set(k, ev.target.value)} />
    </div>
  );
  const auto = (key: KkKey) => (preview.derived.includes(key) ? preview.values[key] : null);

  return (
    <Modal title={e.full_name} subtitle="Data khusus KantorKu" onClose={onClose}
      actions={<Button size="sm" variant="primary" disabled={busy} onClick={save}>Simpan</Button>}>
      <section className="grid gap-4 sm:grid-cols-2">
        {txt("kantorku_employee_id", "Employee ID di KantorKu", "kosong = dibuat KantorKu")}
        {txt("company_email", "Email login KantorKu", e.profile?.email ?? "kosong = email di profil")}
        {sel("employment_type", "Employment Type", KK_EMPLOYMENT_TYPES.slice(0, 6), auto("employmentType"))}
        {txt("contract_end_date", "Tanggal akhir kontrak", undefined, "date")}
        {sel("tax_status", "Tax Status", KK_TAX_STATUSES_SUPPORTED, auto("taxStatus"), "Tenaga Ahli / Bukan Pegawai diatur langsung di KantorKu.")}
        {(preview.values.taxStatus === "Pegawai Tidak Tetap") && sel("payee_type", "Payee Type (Tidak Tetap)", KK_PAYEE_TIDAK_TETAP, null)}
        {sel("taxability", "Taxability", KK_TAXABILITY, taxability ? `${taxability} (bawaan)` : null)}
        <div>
          <Label>Status PTKP</Label>
          <select className={inputClass} value={ptkp === "BELUM_DIISI" ? "" : ptkp} onChange={(ev) => setPtkp(ev.target.value)}>
            <option value="">Belum diisi</option>
            {KK_PTKP.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {txt("account_holder", "Nama pemilik rekening", "persis seperti di buku tabungan")}
        {txt("bpjs_tk_number", "Nomor BPJS Ketenagakerjaan")}
        {txt("bpjs_kes_number", "Nomor BPJS Kesehatan")}
        {sel("branch", "Branch", units.branches, auto("branch"))}
        {sel("department", "Department", units.departments, auto("department"))}
        {sel("position", "Position", units.positions, auto("position"))}
      </section>
      <section className={cn("rounded-lg border px-3 py-2 text-sm", preview.problems.length ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300")}>
        {preview.problems.length ? (
          <><p className="font-medium">Belum siap diimpor:</p><ul className="mt-1 list-inside list-disc text-xs">{preview.problems.map((p) => <li key={p.key + p.message}>{KK_LABEL[p.key]} — {p.message}</li>)}</ul></>
        ) : <p className="font-medium">Siap diimpor ke KantorKu.</p>}
        {preview.notes.length > 0 && <ul className="mt-1 list-inside list-disc text-xs opacity-80">{preview.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        <p className="mt-1 text-xs opacity-80">Data pribadi (NIK, HP, alamat, bank, rekening) diubah di Master Karyawan atau lewat link pribadi.</p>
      </section>
    </Modal>
  );
}
