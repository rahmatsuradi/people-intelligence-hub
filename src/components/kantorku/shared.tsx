"use client";

import { WORK_GROUP_LABEL, type MasterEmployee, type Outlet, type WorkGroup } from "@/lib/rr/master";
import type { KkSource } from "@/lib/kantorku/map";
import type { ExtraCore, HrisRow } from "@/lib/kantorku/store";
import { mapBank } from "@/lib/kantorku/map";
import { INTAKE_FIELDS } from "@/lib/kantorku/intake";
import { Button } from "@/components/app-shell";

export interface KkData {
  employees: MasterEmployee[];
  outlets: Outlet[];
  hrisById: Map<string, HrisRow>;
  extraById: Map<string, ExtraCore>;
  salary: Map<string, number>;
}

export function toSource(e: MasterEmployee, d: KkData): KkSource {
  const x = d.extraById.get(e.id);
  const outlet = e.profile?.outlet_id ? d.outlets.find((o) => o.id === e.profile!.outlet_id) : null;
  return {
    full_name: e.full_name, nik: e.nik, npwp: x?.npwp ?? null, ptkp_status: x?.ptkp_status ?? null,
    join_date: e.join_date, employment_type: e.employment_type, position: e.position, bank_account: e.bank_account,
    profile: e.profile, outletArea: outlet?.area ?? null, basicSalary: d.salary.get(e.id) ?? null, hris: d.hrisById.get(e.id) ?? null,
  };
}

/** Nilai master dengan key pertanyaan formulir — pembanding isian. */
export function formValues(e: MasterEmployee | null, d: KkData): Record<string, string | null> {
  if (!e) return {};
  const p = e.profile;
  const h = d.hrisById.get(e.id);
  const x = d.extraById.get(e.id);
  const outlet = p?.outlet_id ? d.outlets.find((o) => o.id === p.outlet_id)?.name : null;
  const raw: Record<string, string | null | undefined> = {
    ...(p as unknown as Record<string, string | null>), ...(h as unknown as Record<string, string | null>),
    full_name: e.full_name, nik: e.nik, npwp: x?.npwp, join_date: e.join_date, position: e.position, bank_account: e.bank_account,
    outlet: outlet ?? p?.placement_note ?? null, bank_code: mapBank(p?.bank_name) ?? p?.bank_name ?? null,
  };
  return Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, raw[f.key] ?? null]));
}

export function Modal({ title, subtitle, onClose, children, actions }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl dark:bg-slate-900" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 gap-2">{actions}<Button size="sm" variant="ghost" onClick={onClose}>Tutup</Button></div>
        </div>
        <div className="space-y-5 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—";

export const linkUrl = (token: string) => (typeof window === "undefined" ? "" : `${window.location.origin}/data-karyawan/${token}`);

/** Urutan divisi di semua daftar KantorKu. */
export const GROUP_ORDER: WorkGroup[] = ["office", "spv", "produksi", "santan", "sopir", "spg", "host_live", "lainnya"];
export const groupOf = (e: MasterEmployee): WorkGroup => e.profile?.work_group ?? "lainnya";
export const groupRank = (e: MasterEmployee) => GROUP_ORDER.indexOf(groupOf(e));
/** Urut per divisi lalu nama, supaya daftar rapi dan bisa dibaca per kelompok. */
export function byGroupThenName<T>(list: T[], emp: (x: T) => MasterEmployee): T[] {
  return [...list].sort((a, b) => groupRank(emp(a)) - groupRank(emp(b)) || emp(a).full_name.localeCompare(emp(b).full_name, "id"));
}

/** Tombol pilih divisi: Semua / Office / Produksi / ... dengan jumlahnya. */
export function GroupChips({ counts, value, onChange }: { counts: Map<WorkGroup, number>; value: WorkGroup | ""; onChange: (g: WorkGroup | "") => void }) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs ${active ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`;
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(value === "")} onClick={() => onChange("")}>Semua divisi <span className="font-semibold tabular-nums">· {total}</span></button>
      {GROUP_ORDER.filter((g) => counts.get(g)).map((g) => (
        <button key={g} type="button" className={chip(value === g)} onClick={() => onChange(value === g ? "" : g)}>
          {WORK_GROUP_LABEL[g]} <span className="font-semibold tabular-nums">· {counts.get(g)}</span>
        </button>
      ))}
    </div>
  );
}

/** Baris judul kelompok di dalam tabel. */
export function GroupHeaderRow({ group, count, cols }: { group: WorkGroup; count: number; cols: number }) {
  return (
    <tr className="bg-slate-50 dark:bg-slate-800/60">
      <td colSpan={cols} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{WORK_GROUP_LABEL[group]} <span className="font-normal normal-case text-slate-500">· {count} orang</span></td>
    </tr>
  );
}

/** Salin teks ke clipboard. Mencoba cara modern, lalu cara lama (jalan juga di panel/preview dan http). */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* lanjut ke cara lama */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
