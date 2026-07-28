"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, Button, Card, Icon, SvgPath, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { HiredCandidateRow, PiEmployeeRow } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import type { PtkpStatus, RiskClass } from "@/lib/payroll/types";

const PTKP_OPTIONS: PtkpStatus[] = ["TK/0", "TK/1", "TK/2", "TK/3", "K/0", "K/1", "K/2", "K/3"];
const RISK_OPTIONS: { value: RiskClass; label: string }[] = [
  { value: "I", label: "I — risiko sangat rendah (0,24%)" },
  { value: "II", label: "II — risiko rendah (0,54%)" },
  { value: "III", label: "III — risiko sedang (0,89%)" },
  { value: "IV", label: "IV — risiko tinggi (1,27%)" },
  { value: "V", label: "V — risiko sangat tinggi (1,74%)" },
];

interface Tunjangan {
  name: string;
  amount: number;
}

interface OnboardingForm {
  upahPokok: number;
  ptkpStatus: PtkpStatus;
  joinDate: string;
  employmentType: "PKWTT" | "PKWT";
  riskClass: RiskClass;
  nik: string;
  npwp: string;
  bankAccount: string;
  tunjanganTetap: Tunjangan[];
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

// Form onboarding: menarik data yang SUDAH diketahui dari rekrutmen (nama, departemen,
// posisi) dan meminta data yang HANYA bisa didapat saat kontrak ditandatangani
// (gaji disepakati, PTKP, NIK, tanggal masuk, tipe kontrak, kelas risiko JKK).
// Rekrutmen tidak pernah mengumpulkan data ini -- jadi jembatan Hire->Pay memang
// tidak bisa sepenuhnya otomatis, dan itu benar secara domain, bukan keterbatasan.
function OnboardingModal({
  candidate, onClose, onDone,
}: {
  candidate: HiredCandidateRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<OnboardingForm>({
    upahPokok: 0,
    ptkpStatus: "TK/0",
    joinDate: new Date().toISOString().slice(0, 10),
    employmentType: "PKWTT",
    riskClass: "II",
    nik: "",
    npwp: "",
    bankAccount: "",
    tunjanganTetap: [],
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof OnboardingForm>(k: K, v: OnboardingForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addTunjangan = () => set("tunjanganTetap", [...form.tunjanganTetap, { name: "", amount: 0 }]);
  const updateTunjangan = (i: number, patch: Partial<Tunjangan>) =>
    set("tunjanganTetap", form.tunjanganTetap.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTunjangan = (i: number) =>
    set("tunjanganTetap", form.tunjanganTetap.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!supabase) return;
    if (form.upahPokok <= 0) { toast("Upah pokok wajib diisi.", "error"); return; }
    if (!form.joinDate) { toast("Tanggal masuk kerja wajib diisi.", "error"); return; }

    setSaving(true);
    try {
      const activeCompId = getActiveCompanyId();

      const { data: emp, error: empErr } = await supabase
        .from("pi_employees")
        .insert({
          tenant_id: activeCompId,
          full_name: candidate.name,
          nik: form.nik.trim() || null,
          npwp: form.npwp.trim() || null,
          ptkp_status: form.ptkpStatus,
          join_date: form.joinDate,
          employment_type: form.employmentType,
          risk_class: form.riskClass,
          department: candidate.department || "General",
          position: candidate.position || null,
          bank_account: form.bankAccount.trim() || null,
          status: "active",
          hired_candidate_id: candidate.id,
        })
        .select()
        .single();
      if (empErr) throw new Error(`Gagal membuat pi_employees: ${empErr.message}`);

      const { error: cErr } = await supabase.from("pi_compensation").insert({
        employee_id: emp.id,
        effective_date: form.joinDate,
        upah_pokok: form.upahPokok,
        tunjangan_tetap: form.tunjanganTetap.filter((t) => t.name.trim() && t.amount > 0),
        tunjangan_tidak_tetap: [],
      });
      if (cErr) {
        await supabase.from("pi_employees").delete().eq("id", emp.id);
        throw new Error(`Gagal membuat pi_compensation: ${cErr.message}`);
      }

      toast(`Karyawan ${candidate.name} berhasil di-onboard ke modul Payroll!`, "success");
      onDone();
      onClose();
    } catch (err: any) {
      toast(err.message || "Gagal onboarding", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Onboarding — {candidate.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{candidate.position} · {candidate.department ?? "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tutup">
            <Icon className="h-5 w-5"><SvgPath name="close" /></Icon>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
            Nama, posisi, dan departemen ditarik otomatis dari data rekrutmen. Data di bawah wajib diisi
            karena tidak pernah dikumpulkan saat proses lamar — semuanya memengaruhi perhitungan BPJS & PPh 21.
          </div>

          <Field label="Upah pokok (Rp)" hint="Gaji yang disepakati di kontrak — dasar semua perhitungan.">
            <input type="number" min={0} value={form.upahPokok || ""} onChange={(e) => set("upahPokok", Number(e.target.value))} className={inputCls} placeholder="5000000" />
          </Field>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Tunjangan tetap</label>
            <div className="space-y-2">
              {form.tunjanganTetap.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={t.name} onChange={(e) => updateTunjangan(i, { name: e.target.value })} placeholder="mis. Tunjangan Jabatan" className={cn(inputCls, "flex-1")} />
                  <input type="number" min={0} value={t.amount || ""} onChange={(e) => updateTunjangan(i, { amount: Number(e.target.value) })} placeholder="Rp" className={cn(inputCls, "w-32 text-right")} />
                  <button type="button" onClick={() => removeTunjangan(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Hapus tunjangan">
                    <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                  </button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={addTunjangan}>
                <Icon className="h-3.5 w-3.5"><SvgPath name="plus" /></Icon> Tambah tunjangan tetap
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status PTKP" hint="Penentu tarif PPh 21.">
              <select value={form.ptkpStatus} onChange={(e) => set("ptkpStatus", e.target.value as PtkpStatus)} className={inputCls}>
                {PTKP_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Tanggal masuk kerja" hint="Penentu prorata THR.">
              <input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipe kontrak">
              <select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as "PKWTT" | "PKWT")} className={inputCls}>
                <option value="PKWTT">PKWTT (tetap)</option>
                <option value="PKWT">PKWT (kontrak)</option>
              </select>
            </Field>
            <Field label="Kelas risiko JKK" hint="Penentu iuran kecelakaan kerja.">
              <select value={form.riskClass} onChange={(e) => set("riskClass", e.target.value as RiskClass)} className={inputCls}>
                {RISK_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="NIK KTP" hint="Untuk BPJS. Ditampilkan ter-masking di slip gaji (UU PDP).">
            <input value={form.nik} onChange={(e) => set("nik", e.target.value)} className={inputCls} placeholder="16 digit" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="NPWP (opsional)">
              <input value={form.npwp} onChange={(e) => set("npwp", e.target.value)} className={inputCls} placeholder="09.xxx.xxx.x-xxx.xxx" />
            </Field>
            <Field label="No. rekening (opsional)">
              <input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Menyimpan…" : "Onboard ke Payroll"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [pending, setPending] = useState<HiredCandidateRow[] | null>(null);
  const [onboarded, setOnboarded] = useState<PiEmployeeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HiredCandidateRow | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setError("Supabase belum dikonfigurasi."); return; }
    setError(null);
    const activeCompId = getActiveCompanyId();
    const [cand, emp] = await Promise.all([
      supabase.from("candidates").select("id,name,email,phone,position,department,stage").eq("stage", "hired"),
      supabase.from("pi_employees").select("*").eq("tenant_id", activeCompId).not("hired_candidate_id", "is", null),
    ]);
    if (cand.error) { setError(cand.error.message); return; }
    if (emp.error) { setError(emp.error.message); return; }

    const linked = new Set((emp.data as PiEmployeeRow[]).map((e) => e.hired_candidate_id));
    setPending((cand.data as HiredCandidateRow[]).filter((c) => !linked.has(c.id)));
    setOnboarded(emp.data as PiEmployeeRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell
      activeNavId="onboarding"
      title="Onboarding"
      subtitle="Kandidat yang diterima → karyawan payroll"
    >
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </Card>
      )}

      {!error && (
        <>
          <Card padding={false}>
            <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Menunggu onboarding {pending ? `(${pending.length})` : "…"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Kandidat berstatus <strong>Hired</strong> di modul Hire yang belum punya data payroll.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="px-5 py-3 font-medium">Nama</th>
                    <th className="px-5 py-3 font-medium">Posisi</th>
                    <th className="px-5 py-3 font-medium">Departemen</th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(pending ?? []).map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{c.name}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.position}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.department ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="primary" onClick={() => setSelected(c)}>
                          <Icon className="h-3.5 w-3.5"><SvgPath name="arrowRight" /></Icon> Onboard
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {pending && pending.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                      Tidak ada kandidat menunggu. Ubah status kandidat jadi <strong>Hired</strong> di modul Candidates untuk memunculkannya di sini.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {onboarded.length > 0 && (
            <Card padding={false}>
              <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sudah di-onboard dari rekrutmen ({onboarded.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="px-5 py-3 font-medium">Nama</th>
                      <th className="px-5 py-3 font-medium">Departemen</th>
                      <th className="px-5 py-3 font-medium">PTKP</th>
                      <th className="px-5 py-3 font-medium">Masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboarded.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{e.full_name}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{e.department ?? "—"}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-400">{e.ptkp_status}</td>
                        <td className="px-5 py-3 tabular-nums text-slate-600 dark:text-slate-400">{e.join_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {selected && (
        <OnboardingModal candidate={selected} onClose={() => setSelected(null)} onDone={load} />
      )}
    </AppShell>
  );
}
