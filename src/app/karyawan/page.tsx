"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Button, Card, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import { maskBankAccount, maskNik } from "@/lib/payroll/payslip-masking";
import {
  FLAG_LABEL, STATUS_LABEL, WORK_GROUP_LABEL, filterEmployees, loadMaster, saveEmployee, summarizeFlags,
  type EmployeeStatus, type MasterEmployee, type MasterFilter, type Outlet, type WorkGroup,
} from "@/lib/rr/master";

const PAGE = 50;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<EmployeeStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  perlu_verifikasi: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  resigned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function MasterKaryawanPage() {
  const { canEdit } = useRole();
  const [employees, setEmployees] = useState<MasterEmployee[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MasterFilter>({ status: "active" });
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<MasterEmployee | null>(null);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    loadMaster()
      .then(({ employees: e, outlets: o }) => { setEmployees(e); setOutlets(o); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  const outletById = useMemo(() => new Map(outlets.map((o) => [o.id, o])), [outlets]);
  const outletName = useCallback((id: string | null) => (id ? outletById.get(id)?.name ?? "" : ""), [outletById]);
  const filtered = useMemo(() => filterEmployees(employees, filter, outletName), [employees, filter, outletName]);
  const flags = useMemo(() => summarizeFlags(employees), [employees]);
  const supervisors = useMemo(
    () => [...new Set(employees.map((e) => e.profile?.supervisor_name).filter((s): s is string => !!s))].sort(),
    [employees],
  );
  const counts = useMemo(() => ({
    active: employees.filter((e) => e.status === "active").length,
    perlu_verifikasi: employees.filter((e) => e.status === "perlu_verifikasi").length,
    resigned: employees.filter((e) => e.status === "resigned").length,
    flagged: employees.filter((e) => e.status !== "resigned" && e.profile?.data_flags.length).length,
  }), [employees]);

  const set = (patch: MasterFilter) => { setFilter((f) => ({ ...f, ...patch })); setShown(PAGE); };

  return (
    <AppShell activeNavId="karyawan" title="Master Karyawan" subtitle="Seluruh karyawan Rica Rico — sumber: rekap gaji September 2026 + Employee Database">
      {error && <Card><p className="text-sm text-red-600">Gagal memuat data: {error}</p></Card>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ["Aktif", counts.active, { status: "active" as const, flag: "" }],
          ["Perlu verifikasi", counts.perlu_verifikasi, { status: "perlu_verifikasi" as const, flag: "" }],
          ["Resign", counts.resigned, { status: "resigned" as const, flag: "" }],
          ["Data perlu dibereskan", counts.flagged, { status: "" as const, flag: "__any__" }],
        ] as const).map(([label, n, f]) => (
          <button key={label} type="button" onClick={() => set(f)} className="text-left">
            <Card className="h-full transition hover:border-blue-300">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{loading ? "…" : n}</p>
            </Card>
          </button>
        ))}
      </div>

      {flags.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Perlu dibereskan</h2>
          <p className="mt-0.5 text-xs text-slate-500">Tanda dari proses impor. Tidak ada data yang ditebak — klik untuk melihat siapa saja.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {flags.map(({ flag, count }) => (
              <button key={flag} type="button" onClick={() => set({ flag, status: "" })}
                className={cn("rounded-full border px-3 py-1 text-xs", filter.flag === flag
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300")}>
                {FLAG_LABEL[flag] ?? flag} <span className="font-semibold tabular-nums">· {count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <input className={cn(inputClass, "lg:col-span-2")} placeholder="Cari nama, panggilan, NIK, outlet…" value={filter.search ?? ""} onChange={(e) => set({ search: e.target.value })} />
          <select className={inputClass} value={filter.group ?? ""} onChange={(e) => set({ group: e.target.value as WorkGroup | "" })}>
            <option value="">Semua kelompok</option>
            {Object.entries(WORK_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={inputClass} value={filter.status ?? ""} onChange={(e) => set({ status: e.target.value as EmployeeStatus | "" })}>
            <option value="">Semua status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={inputClass} value={filter.supervisor ?? ""} onChange={(e) => set({ supervisor: e.target.value })}>
            <option value="">Semua atasan</option>
            {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputClass} value={filter.outletId ?? ""} onChange={(e) => set({ outletId: e.target.value })}>
            <option value="">Semua outlet</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{loading ? "Memuat…" : `${filtered.length} karyawan`}</span>
          <button type="button" className="hover:text-slate-900 dark:hover:text-white" onClick={() => { setFilter({}); setShown(PAGE); }}>Hapus semua filter</button>
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Nama</th>
                <th className="px-4 py-2.5 font-medium">Kelompok</th>
                <th className="px-4 py-2.5 font-medium">Posisi</th>
                <th className="px-4 py-2.5 font-medium">Penempatan</th>
                <th className="px-4 py-2.5 font-medium">Atasan</th>
                <th className="px-4 py-2.5 font-medium">Masuk</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Tanda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.slice(0, shown).map((e) => {
                const p = e.profile;
                return (
                  <tr key={e.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => { setDetail(e); setEditing(false); }}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900 dark:text-white">{e.full_name}</span>
                      {p?.nickname && <span className="ml-1.5 text-xs text-slate-400">({p.nickname})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p ? WORK_GROUP_LABEL[p.work_group] : "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{e.position ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{outletName(p?.outlet_id ?? null) || p?.placement_note || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p?.supervisor_name ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{fmtDate(e.join_date)}</td>
                    <td className="px-4 py-2.5"><span className={cn("rounded px-2 py-0.5 text-xs font-medium", STATUS_STYLE[e.status])}>{STATUS_LABEL[e.status]}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      {p?.data_flags.length ? <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">{p.data_flags.length}</span> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Tidak ada karyawan yang cocok dengan filter ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > shown && (
          <div className="border-t border-slate-100 p-3 text-center dark:border-slate-800">
            <Button size="sm" onClick={() => setShown((n) => n + PAGE)}>Tampilkan {Math.min(PAGE, filtered.length - shown)} lagi</Button>
          </div>
        )}
      </Card>

      {detail && (
        <DetailModal
          employee={detail} outlets={outlets} outletName={outletName} canEdit={canEdit} editing={editing}
          onEdit={() => setEditing(true)} onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); reload(); }}
        />
      )}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-sm text-slate-800 dark:text-slate-200">{value || "—"}</p>
    </div>
  );
}

function Secret({ label, value, mask }: { label: string; value: string | null; mask: (v: string | null) => string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
        <span className="tabular-nums">{value ? (show ? value : mask(value)) : "—"}</span>
        {value && <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setShow((s) => !s)}>{show ? "Sembunyikan" : "Tampilkan"}</button>}
      </p>
    </div>
  );
}

function DetailModal({ employee: e, outlets, outletName, canEdit, editing, onEdit, onClose, onSaved }: {
  employee: MasterEmployee; outlets: Outlet[]; outletName: (id: string | null) => string; canEdit: boolean; editing: boolean;
  onEdit: () => void; onClose: () => void; onSaved: () => void;
}) {
  const p = e.profile;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl dark:bg-slate-900" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{e.full_name}</h2>
            <p className="text-sm text-slate-500">{p ? WORK_GROUP_LABEL[p.work_group] : ""} · {e.position ?? "—"} · {STATUS_LABEL[e.status]}</p>
          </div>
          <div className="flex gap-2">
            {canEdit && !editing && <Button size="sm" variant="primary" onClick={onEdit}>Ubah</Button>}
            <Button size="sm" variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        </div>
        {editing && p ? (
          <EditForm employee={e} outlets={outlets} onCancel={onClose} onSaved={onSaved} />
        ) : (
          <div className="space-y-5 px-5 py-4">
            {p && p.data_flags.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <p className="font-medium">Perlu dibereskan</p>
                <ul className="mt-1 list-inside list-disc text-xs">{p.data_flags.map((f) => <li key={f}>{FLAG_LABEL[f] ?? f}</li>)}</ul>
              </div>
            )}
            <section className="grid gap-4 sm:grid-cols-3">
              <Field label="Penempatan" value={outletName(p?.outlet_id ?? null) || p?.placement_note} />
              <Field label="Atasan" value={p?.supervisor_name} />
              <Field label="Tanggal masuk" value={fmtDate(e.join_date)} />
              <Field label="Status kerja (sumber)" value={p?.employment_label ?? (e.employment_type === "BELUM_DIISI" ? "Belum diisi" : e.employment_type)} />
              <Field label="Badan usaha BPJS" value={p?.legal_entity} />
              <Field label="Nama panggilan" value={p?.nickname} />
            </section>
            <section className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
              <Secret label="NIK" value={e.nik} mask={maskNik} />
              <Field label="Tempat, tgl lahir" value={[p?.birth_place, p?.birth_date ? fmtDate(p.birth_date) : null].filter(Boolean).join(", ")} />
              <Field label="Jenis kelamin" value={p?.gender} />
              <Field label="Agama" value={p?.religion} />
              <Field label="Status perkawinan" value={p?.marital_status} />
              <Field label="Nama ibu kandung" value={p?.mother_name} />
            </section>
            <section className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
              <Field label="Telepon" value={p?.phone} />
              <Field label="Email" value={p?.email} />
              <Field label="Kontak darurat" value={[p?.emergency_name, p?.emergency_relation, p?.emergency_phone].filter(Boolean).join(" · ")} />
              <div className="sm:col-span-3"><Field label="Alamat domisili" value={p?.address} /></div>
            </section>
            <section className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
              <Secret label="Nomor rekening" value={e.bank_account} mask={maskBankAccount} />
              <Field label="Bank" value={p?.bank_name} />
              <Field label="Pendidikan" value={[p?.education_level, p?.education_institution, p?.education_major].filter(Boolean).join(" · ")} />
            </section>
            {(p?.ktp_url || p?.kk_url || p?.photo_url) && (
              <section className="flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                {p?.ktp_url && <a className="text-blue-600 hover:underline" href={p.ktp_url} target="_blank" rel="noreferrer">KTP ↗</a>}
                {p?.kk_url && <a className="text-blue-600 hover:underline" href={p.kk_url} target="_blank" rel="noreferrer">Kartu Keluarga ↗</a>}
                {p?.photo_url && <a className="text-blue-600 hover:underline" href={p.photo_url} target="_blank" rel="noreferrer">Pas foto ↗</a>}
              </section>
            )}
            <p className="text-[11px] text-slate-400">Sumber data: {p?.source ?? "—"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EditForm({ employee: e, outlets, onCancel, onSaved }: { employee: MasterEmployee; outlets: Outlet[]; onCancel: () => void; onSaved: () => void }) {
  const p = e.profile!;
  const [f, setF] = useState({
    full_name: e.full_name, status: e.status, position: e.position ?? "", join_date: e.join_date ?? "", nik: e.nik ?? "",
    bank_account: e.bank_account ?? "", work_group: p.work_group, outlet_id: p.outlet_id ?? "", placement_note: p.placement_note ?? "",
    supervisor_name: p.supervisor_name ?? "", legal_entity: p.legal_entity ?? "", bank_name: p.bank_name ?? "", phone: p.phone ?? "",
    nickname: p.nickname ?? "",
  });
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const up = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: ev.target.value }));
  const nul = (s: string) => (s.trim() === "" ? null : s.trim());

  const save = async () => {
    if (!f.full_name.trim()) { toast("Nama wajib diisi", "error"); return; }
    setSaving(true);
    const err = await saveEmployee(e.id,
      { full_name: f.full_name.trim(), status: f.status, position: nul(f.position), join_date: nul(f.join_date), nik: nul(f.nik)?.replace(/\D/g, "") ?? null, bank_account: nul(f.bank_account) },
      { work_group: f.work_group, outlet_id: nul(f.outlet_id), placement_note: nul(f.placement_note), supervisor_name: nul(f.supervisor_name),
        legal_entity: nul(f.legal_entity), bank_name: nul(f.bank_name), phone: nul(f.phone), nickname: nul(f.nickname),
        data_flags: p.data_flags.filter((x) => !cleared.has(x)) },
    );
    setSaving(false);
    if (err) { toast(`Gagal menyimpan: ${err}`, "error"); return; }
    toast("Data karyawan disimpan");
    onSaved();
  };

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nama lengkap</Label><input className={inputClass} value={f.full_name} onChange={up("full_name")} /></div>
        <div><Label>Nama panggilan</Label><input className={inputClass} value={f.nickname} onChange={up("nickname")} /></div>
        <div><Label>Status</Label>
          <select className={inputClass} value={f.status} onChange={up("status")}>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><Label>Kelompok kerja</Label>
          <select className={inputClass} value={f.work_group} onChange={up("work_group")}>{Object.entries(WORK_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><Label>Posisi</Label><input className={inputClass} value={f.position} onChange={up("position")} /></div>
        <div><Label>Tanggal masuk</Label><input type="date" className={inputClass} value={f.join_date} onChange={up("join_date")} /></div>
        <div><Label>Outlet</Label>
          <select className={inputClass} value={f.outlet_id} onChange={up("outlet_id")}>
            <option value="">— Tidak di outlet —</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}{o.area ? ` (${o.area})` : ""}</option>)}
          </select></div>
        <div><Label>Penempatan lain</Label><input className={inputClass} placeholder="Backup / Training / Event Mobile" value={f.placement_note} onChange={up("placement_note")} /></div>
        <div><Label>Atasan</Label><input className={inputClass} value={f.supervisor_name} onChange={up("supervisor_name")} /></div>
        <div><Label>Badan usaha BPJS</Label><input className={inputClass} value={f.legal_entity} onChange={up("legal_entity")} /></div>
        <div><Label>NIK</Label><input className={inputClass} inputMode="numeric" value={f.nik} onChange={up("nik")} /></div>
        <div><Label>Telepon</Label><input className={inputClass} value={f.phone} onChange={up("phone")} /></div>
        <div><Label>Nomor rekening</Label><input className={inputClass} value={f.bank_account} onChange={up("bank_account")} /></div>
        <div><Label>Bank</Label><input className={inputClass} placeholder="BCA, BRI, Mandiri…" value={f.bank_name} onChange={up("bank_name")} /></div>
      </div>
      {p.data_flags.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Tandai sudah beres</p>
          <p className="text-xs text-slate-500">Centang tanda yang sudah Anda perbaiki di atas.</p>
          <div className="mt-2 space-y-1.5">
            {p.data_flags.map((fl) => (
              <label key={fl} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" className="mt-0.5" checked={cleared.has(fl)}
                  onChange={(ev) => setCleared((s) => { const n = new Set(s); if (ev.target.checked) n.add(fl); else n.delete(fl); return n; })} />
                {FLAG_LABEL[fl] ?? fl}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Batal</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
      </div>
    </div>
  );
}
