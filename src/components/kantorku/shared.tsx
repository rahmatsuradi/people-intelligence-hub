"use client";

import type { MasterEmployee, Outlet } from "@/lib/rr/master";
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
