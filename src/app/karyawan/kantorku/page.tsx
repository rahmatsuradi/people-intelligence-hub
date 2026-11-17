"use client";

/* /karyawan/kantorku — formulir data karyawan (pengganti Google Form "Employee Database")
   dan ekspor ke template impor HRIS KantorKu. Web ini = master; KantorKu menerima salinan.
   Tabel: supabase/data-karyawan-kantorku.sql. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Card, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { useRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { loadMaster, type MasterEmployee, type Outlet } from "@/lib/rr/master";
import { loadKantorku, type DataLink, type Submission } from "@/lib/kantorku/store";
import { readUnits } from "@/lib/kantorku/xlsx";
import { toKantorkuRow, type KkUnits } from "@/lib/kantorku/map";
import { LinksTab } from "@/components/kantorku/links-tab";
import { SubmissionsTab } from "@/components/kantorku/submissions-tab";
import { ExportTab } from "@/components/kantorku/export-tab";
import { toSource, type KkData } from "@/components/kantorku/shared";

type Tab = "kirim" | "isian" | "ekspor";
const TAX_KEY = "kantorku:taxability";

export default function KantorkuPage() {
  const { role, loading: roleLoading } = useRole();
  const [tab, setTab] = useState<Tab>("kirim");
  const [employees, setEmployees] = useState<MasterEmployee[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [kk, setKk] = useState<Awaited<ReturnType<typeof loadKantorku>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<{ bytes: Uint8Array; label: string } | null>(null);
  const [templateMissing, setTemplateMissing] = useState(false);
  const [taxability, setTaxabilityState] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([loadMaster(), loadKantorku()])
      .then(([m, k]) => { setEmployees(m.employees); setOutlets(m.outlets); setKk(k); setError(null); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);

  useEffect(() => {
    try { setTaxabilityState(window.localStorage.getItem(TAX_KEY) ?? ""); } catch { /* */ }
    (async () => {
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      const r = await fetch("/api/kantorku/template", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } }).catch(() => null);
      if (r?.ok) setTemplate({ bytes: new Uint8Array(await r.arrayBuffer()), label: "Template KantorKu bawaan (17 Nov 2026)" });
      else setTemplateMissing(true);
    })();
  }, []);
  const setTaxability = (v: string) => { setTaxabilityState(v); try { window.localStorage.setItem(TAX_KEY, v); } catch { /* */ } };

  const units: KkUnits | null = useMemo(() => {
    if (!template) return null;
    try { return readUnits(template.bytes); } catch (err) { toast((err as Error).message, "error"); return null; }
  }, [template]);

  const data: KkData = useMemo(() => ({
    employees, outlets,
    hrisById: new Map((kk?.hris ?? []).map((h) => [h.employee_id, h])),
    extraById: new Map((kk?.extra ?? []).map((x) => [x.id, x])),
    salary: kk?.salary ?? new Map(),
  }), [employees, outlets, kk]);

  const readyById = useMemo(() => {
    const m = new Map<string, boolean>();
    if (!units) return m;
    for (const e of employees) m.set(e.id, !toKantorkuRow(toSource(e, data), units, { taxability }).problems.length);
    return m;
  }, [employees, data, units, taxability]);

  const links: DataLink[] = kk?.links ?? [];
  const submissions: Submission[] = kk?.submissions ?? [];
  const pending = submissions.filter((s) => s.status === "baru").length;

  return (
    <AppShell activeNavId="data-kantorku" title="Data Karyawan & KantorKu" subtitle="Formulir data karyawan → master web → berkas impor KantorKu">
      {error && <Card><p className="text-sm text-red-600">Gagal memuat data: {error}</p></Card>}
      {kk?.missingTables && (
        <Card>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Fitur ini belum diaktifkan.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Minta pengelola aplikasi menjalankan perintah pengaktifan &quot;data-karyawan-kantorku&quot; satu kali.</p>
        </Card>
      )}
      {!roleLoading && role !== "hr" && (
        <Card><p className="text-sm text-slate-600 dark:text-slate-300">Halaman ini khusus tim HR — isinya data pribadi karyawan yang belum diverifikasi.</p></Card>
      )}

      {role === "hr" && !kk?.missingTables && (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {([["kirim", "1. Kirim link"], ["isian", `2. Isian masuk${pending ? ` (${pending})` : ""}`], ["ekspor", "3. Ekspor KantorKu"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-medium", tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800")}>{label}</button>
            ))}
          </div>
          {loading && !kk ? <Card><p className="text-sm text-slate-500">Memuat…</p></Card> : (
            <>
              {tab === "kirim" && <LinksTab employees={employees} links={links} readyById={readyById} onChanged={reload} />}
              {tab === "isian" && <SubmissionsTab submissions={submissions} links={links} data={data} onChanged={reload} />}
              {tab === "ekspor" && (
                <ExportTab data={data} template={template?.bytes ?? null} templateLabel={template?.label ?? (templateMissing ? "Belum ada template bawaan" : "Memuat…")}
                  units={units} onTemplate={(bytes, label) => setTemplate({ bytes, label })} taxability={taxability} setTaxability={setTaxability} onChanged={reload} />
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
