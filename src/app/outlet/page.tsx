"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import { activeSpgByOutlet, loadMaster, saveOutlet, vacantOutlets, type MasterEmployee, type Outlet } from "@/lib/rr/master";

const TYPE_LABEL: Record<NonNullable<Outlet["location_type"]>, string> = {
  stasiun: "Stasiun", mall: "Mall", supermarket: "Supermarket", toko: "Toko", lainnya: "Lainnya",
};

type Draft = Partial<Outlet> & { name: string };

export default function OutletPage() {
  const { canEdit } = useRole();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [employees, setEmployees] = useState<MasterEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState("");
  const [spv, setSpv] = useState("");
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    loadMaster()
      .then(({ employees: e, outlets: o }) => { setEmployees(e); setOutlets(o); })
      .catch((err: Error) => toast(`Gagal memuat: ${err.message}`, "error"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  const spgCount = useMemo(() => activeSpgByOutlet(employees), [employees]);
  const vacant = useMemo(() => new Set(vacantOutlets(outlets, employees).map((o) => o.id)), [outlets, employees]);
  const areas = useMemo(() => [...new Set(outlets.map((o) => o.area ?? "Belum ditentukan"))], [outlets]);
  const spvs = useMemo(() => [...new Set(outlets.map((o) => o.spv_name).filter((s): s is string => !!s))].sort(), [outlets]);
  const noType = outlets.filter((o) => o.status === "active" && !o.location_type).length;

  const shown = outlets.filter((o) =>
    (!area || (o.area ?? "Belum ditentukan") === area) && (!spv || o.spv_name === spv) && (!onlyVacant || vacant.has(o.id)));
  const grouped = useMemo(() => {
    const m = new Map<string, Outlet[]>();
    for (const o of shown) {
      const k = o.area ?? "Belum ditentukan";
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return [...m.entries()];
  }, [shown]);

  const spgAt = (id: string) => employees.filter((e) => e.status === "active" && e.profile?.work_group === "spg" && e.profile.outlet_id === id);

  const submit = async () => {
    if (!draft?.name.trim()) { toast("Nama outlet wajib diisi", "error"); return; }
    const err = await saveOutlet({ ...draft, name: draft.name.trim() });
    if (err) { toast(`Gagal menyimpan: ${err}`, "error"); return; }
    toast(draft.id ? "Outlet diperbarui" : "Outlet ditambahkan");
    setDraft(null);
    reload();
  };

  return (
    <AppShell activeNavId="outlet" title="Outlet & Penempatan" subtitle="Outlet Rica Rico per area dan SPV, dengan jumlah SPG aktif"
      headerActions={canEdit ? <Button variant="primary" size="sm" onClick={() => setDraft({ name: "", status: "active" })}>+ Outlet</Button> : undefined}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs text-slate-500">Outlet aktif</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "…" : outlets.filter((o) => o.status === "active").length}</p></Card>
        <Card><p className="text-xs text-slate-500">SPG aktif berpenempatan</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "…" : [...spgCount.values()].reduce((a, b) => a + b, 0)}</p></Card>
        <button type="button" className="text-left" onClick={() => setOnlyVacant((v) => !v)}>
          <Card className={cn("h-full", onlyVacant && "border-red-300")}><p className="text-xs text-slate-500">Outlet tanpa SPG aktif</p><p className="mt-1 text-2xl font-semibold tabular-nums text-red-600">{loading ? "…" : vacant.size}</p></Card>
        </button>
        <Card><p className="text-xs text-slate-500">Jenis lokasi belum diisi</p><p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? "…" : noType}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Menentukan uang makan & lembur SPG (mall vs stasiun)</p></Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <select className={cn(inputClass, "w-auto")} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Semua area</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className={cn(inputClass, "w-auto")} value={spv} onChange={(e) => setSpv(e.target.value)}>
            <option value="">Semua SPV</option>{spvs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={onlyVacant} onChange={(e) => setOnlyVacant(e.target.checked)} /> Hanya yang tanpa SPG aktif
          </label>
          <span className="ml-auto text-xs text-slate-500">{shown.length} outlet</span>
        </div>
      </Card>

      {grouped.map(([a, list]) => (
        <Card key={a} padding={false} className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{a}</h2>
            <p className="text-xs text-slate-500">{list.length} outlet · SPV: {[...new Set(list.map((o) => o.spv_name ?? "—"))].join(", ")}</p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((o) => {
              const n = spgCount.get(o.id) ?? 0;
              return (
                <li key={o.id}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === o.id ? null : o.id)}>
                      <span className="font-medium text-slate-900 dark:text-white">{o.name}</span>
                      {o.status === "closed" && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">Tutup</span>}
                      <span className="ml-2 text-xs text-slate-400">{o.location_type ? TYPE_LABEL[o.location_type] : "jenis belum diisi"}</span>
                    </button>
                    <span className="text-xs text-slate-500">SPV {o.spv_name ?? "—"}</span>
                    <span className={cn("rounded px-2 py-0.5 text-xs font-semibold tabular-nums", n === 0 && o.status === "active"
                      ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
                      {n} SPG
                    </span>
                    {canEdit && <Button size="sm" variant="ghost" onClick={() => setDraft({ ...o })}>Ubah</Button>}
                  </div>
                  {open === o.id && (
                    <div className="bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-300">
                      {spgAt(o.id).map((e) => e.full_name).join(" · ") || "Belum ada SPG aktif di outlet ini."}
                      {o.notes && <p className="mt-1 text-slate-500">Catatan: {o.notes}</p>}
                      <p className="mt-1 text-slate-400">Sumber: {o.source ?? "—"}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{draft.id ? "Ubah outlet" : "Outlet baru"}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Nama outlet</Label><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div><Label>Area</Label><input className={inputClass} list="area-list" value={draft.area ?? ""} onChange={(e) => setDraft({ ...draft, area: e.target.value || null })} />
                <datalist id="area-list">{areas.filter((x) => x !== "Belum ditentukan").map((x) => <option key={x} value={x} />)}</datalist></div>
              <div><Label>SPV</Label><input className={inputClass} list="spv-list" value={draft.spv_name ?? ""} onChange={(e) => setDraft({ ...draft, spv_name: e.target.value || null })} />
                <datalist id="spv-list">{spvs.map((x) => <option key={x} value={x} />)}</datalist></div>
              <div><Label>Jenis lokasi</Label>
                <select className={inputClass} value={draft.location_type ?? ""} onChange={(e) => setDraft({ ...draft, location_type: (e.target.value || null) as Outlet["location_type"] })}>
                  <option value="">Belum ditentukan</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><Label>Status</Label>
                <select className={inputClass} value={draft.status ?? "active"} onChange={(e) => setDraft({ ...draft, status: e.target.value as Outlet["status"] })}>
                  <option value="active">Aktif</option><option value="closed">Tutup</option>
                </select></div>
              <div className="sm:col-span-2"><Label>Catatan</Label><input className={inputClass} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} /></div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>Batal</Button>
              <Button variant="primary" onClick={submit}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
