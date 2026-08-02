"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, Card, Button, Icon, SvgPath, Label, inputClass, cn } from "@/components/app-shell";
import { toast } from "@/components/toast";
import { getActiveCompanyEmployees } from "@/lib/payroll/pay-data";
import { getActiveCompanyId } from "@/lib/payroll/company-profile";
import {
  getIRCases,
  upsertIRCase,
  deleteIRCase,
  getIRDocuments,
  upsertIRDocument,
  deleteIRDocument,
  computeDocStatus,
  suggestExpiryDate,
  type IRCase,
  type IRCaseCategory,
  type IRCaseStatus,
  type IRDocument,
  type IRDocType,
  type IRDocStatus,
} from "@/lib/ir-store";

interface EmployeeLite {
  id: string;
  full_name: string;
  department: string | null;
}

const CATEGORY_LABEL: Record<IRCaseCategory, string> = {
  keluhan: "Keluhan Karyawan",
  indisipliner: "Pelanggaran Disiplin",
  phk: "PHK",
  "mediasi-bipartit": "Mediasi Bipartit",
  phi: "PHI (Pengadilan Hub. Industrial)",
  lainnya: "Lainnya",
};

const CASE_STATUS_LABEL: Record<IRCaseStatus, string> = {
  open: "Dibuka",
  mediasi: "Dalam Mediasi",
  selesai: "Selesai",
  eskalasi: "Eskalasi",
};

const CASE_STATUS_COLOR: Record<IRCaseStatus, string> = {
  open: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  mediasi: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  selesai: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  eskalasi: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const DOC_STATUS_LABEL: Record<IRDocStatus, string> = {
  aktif: "Aktif",
  "menuju-kadaluarsa": "Menuju Kadaluarsa",
  kadaluarsa: "Kadaluarsa",
  "proses-perpanjangan": "Proses Perpanjangan",
};

const DOC_STATUS_COLOR: Record<IRDocStatus, string> = {
  aktif: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  "menuju-kadaluarsa": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  kadaluarsa: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  "proses-perpanjangan": "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
};

const EMPTY_CASE_FORM = {
  title: "",
  employeeId: "",
  category: "keluhan" as IRCaseCategory,
  status: "open" as IRCaseStatus,
  openedDate: new Date().toISOString().slice(0, 10),
  targetDate: "",
  description: "",
  resolutionNotes: "",
  legalRef: "",
};

const EMPTY_DOC_FORM = {
  docType: "pp" as IRDocType,
  title: "",
  registrationNumber: "",
  effectiveDate: "",
  expiryDate: "",
  status: "aktif" as IRDocStatus,
  notes: "",
};

function CaseModal({
  employees,
  initial,
  onClose,
  onSave,
}: {
  employees: EmployeeLite[];
  initial: IRCase | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_CASE_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          title: initial.title,
          employeeId: initial.employeeId,
          category: initial.category,
          status: initial.status,
          openedDate: initial.openedDate,
          targetDate: initial.targetDate,
          description: initial.description,
          resolutionNotes: initial.resolutionNotes,
          legalRef: initial.legalRef,
        }
      : EMPTY_CASE_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Kasus" : "Kasus Baru"}</h3>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="title">Judul Kasus</Label>
            <input id="title" className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ringkasan singkat kasus" />
          </div>

          <div>
            <Label htmlFor="employee">Karyawan Terkait</Label>
            <select id="employee" className={inputClass} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Pilih karyawan...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name}{e.department ? ` — ${e.department}` : ""}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Kategori</Label>
              <select id="category" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as IRCaseCategory })}>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IRCaseStatus })}>
                {Object.entries(CASE_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="openedDate">Tanggal Dibuka</Label>
              <input id="openedDate" type="date" className={inputClass} value={form.openedDate} onChange={(e) => setForm({ ...form, openedDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="targetDate">Target Penyelesaian</Label>
              <input id="targetDate" type="date" className={inputClass} value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <textarea id="description" rows={3} className={cn(inputClass, "resize-none")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kronologi & duduk perkara" />
          </div>

          <div>
            <Label htmlFor="legalRef">Referensi Hukum</Label>
            <input id="legalRef" className={inputClass} value={form.legalRef} onChange={(e) => setForm({ ...form, legalRef: e.target.value })} placeholder="mis. UU 13/2003 Pasal 161, PP Pasal 12" />
          </div>

          <div>
            <Label htmlFor="resolutionNotes">Catatan Penyelesaian</Label>
            <textarea id="resolutionNotes" rows={2} className={cn(inputClass, "resize-none")} value={form.resolutionNotes} onChange={(e) => setForm({ ...form, resolutionNotes: e.target.value })} placeholder="Hasil mediasi / keputusan / tindak lanjut" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.title.trim() || !form.employeeId) {
                toast("Judul dan karyawan wajib diisi", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocModal({
  initial,
  onClose,
  onSave,
}: {
  initial: IRDocument | null;
  onClose: () => void;
  onSave: (form: typeof EMPTY_DOC_FORM & { id?: string }) => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          docType: initial.docType,
          title: initial.title,
          registrationNumber: initial.registrationNumber,
          effectiveDate: initial.effectiveDate,
          expiryDate: initial.expiryDate,
          status: initial.status,
          notes: initial.notes,
        }
      : EMPTY_DOC_FORM,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{initial ? "Ubah Dokumen" : "Dokumen Baru"}</h3>
        <p className="mt-1 text-xs text-slate-400">PP & PKB berlaku maksimal 2 tahun sejak disahkan (UU 13/2003 Pasal 111 & 123) — wajib diperbarui sebelum kadaluarsa.</p>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="docType">Jenis Dokumen</Label>
              <select id="docType" className={inputClass} value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value as IRDocType })}>
                <option value="pp">Peraturan Perusahaan (PP)</option>
                <option value="pkb">Perjanjian Kerja Bersama (PKB)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="registrationNumber">No. Registrasi</Label>
              <input id="registrationNumber" className={inputClass} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="No. pengesahan Disnaker" />
            </div>
          </div>

          <div>
            <Label htmlFor="docTitle">Judul Dokumen</Label>
            <input id="docTitle" className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Peraturan Perusahaan PT Valora TV 2026-2028" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="effectiveDate">Tanggal Berlaku</Label>
              <input
                id="effectiveDate"
                type="date"
                className={inputClass}
                value={form.effectiveDate}
                onChange={(e) => {
                  const effectiveDate = e.target.value;
                  const shouldSuggest = !form.expiryDate;
                  setForm({
                    ...form,
                    effectiveDate,
                    expiryDate: shouldSuggest ? suggestExpiryDate(effectiveDate) : form.expiryDate,
                  });
                }}
              />
            </div>
            <div>
              <Label htmlFor="expiryDate">Tanggal Kadaluarsa</Label>
              <input id="expiryDate" type="date" className={inputClass} value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
          </div>

          <div>
            <Label htmlFor="docStatus">Status</Label>
            <select id="docStatus" className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IRDocStatus })}>
              {Object.entries(DOC_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {form.expiryDate && (
              <p className="mt-1 text-xs text-slate-400">Saran otomatis berdasarkan tanggal kadaluarsa: {DOC_STATUS_LABEL[computeDocStatus(form.expiryDate)]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="docNotes">Catatan</Label>
            <textarea id="docNotes" rows={2} className={cn(inputClass, "resize-none")} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!form.title.trim() || !form.effectiveDate || !form.expiryDate) {
                toast("Judul, tanggal berlaku, dan kadaluarsa wajib diisi", "error");
                return;
              }
              onSave({ ...form, id: initial?.id });
            }}
          >
            Simpan
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IndustrialRelationsPage() {
  const [tab, setTab] = useState<"cases" | "documents">("cases");
  const [tenantId, setTenantId] = useState("");
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [cases, setCases] = useState<IRCase[]>([]);
  const [documents, setDocuments] = useState<IRDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [caseModal, setCaseModal] = useState<{ mode: "new" | "edit"; data: IRCase | null } | null>(null);
  const [docModal, setDocModal] = useState<{ mode: "new" | "edit"; data: IRDocument | null } | null>(null);

  const refresh = () => {
    const id = getActiveCompanyId();
    setTenantId(id);
    setEmployees(getActiveCompanyEmployees());
    setCases(getIRCases(id));
    setDocuments(getIRDocuments(id));
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pi-company-change", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pi-company-change", refresh);
    };
  }, []);

  const employeeName = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";

  const caseStats = useMemo(() => {
    const open = cases.filter((c) => c.status === "open" || c.status === "mediasi" || c.status === "eskalasi").length;
    const overdue = cases.filter((c) => c.status !== "selesai" && c.targetDate && new Date(c.targetDate) < new Date()).length;
    return { total: cases.length, open, overdue };
  }, [cases]);

  const docStats = useMemo(() => {
    const expiringSoon = documents.filter((d) => computeDocStatus(d.expiryDate) === "menuju-kadaluarsa").length;
    const expired = documents.filter((d) => computeDocStatus(d.expiryDate) === "kadaluarsa").length;
    return { total: documents.length, expiringSoon, expired };
  }, [documents]);

  const handleSaveCase = (form: typeof EMPTY_CASE_FORM & { id?: string }) => {
    upsertIRCase(tenantId, { ...form, employeeName: employeeName(form.employeeId) });
    setCaseModal(null);
    toast(form.id ? "Kasus diperbarui" : "Kasus baru ditambahkan");
    refresh();
  };

  const handleSaveDoc = (form: typeof EMPTY_DOC_FORM & { id?: string }) => {
    upsertIRDocument(tenantId, form);
    setDocModal(null);
    toast(form.id ? "Dokumen diperbarui" : "Dokumen baru ditambahkan");
    refresh();
  };

  if (!loaded) {
    return (
      <AppShell activeNavId="ir" title="Industrial Relations" subtitle="Kasus perselisihan & dokumen PP/PKB">
        <div className="flex h-64 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeNavId="ir" title="Industrial Relations" subtitle="Pelacakan kasus perselisihan hubungan industrial & masa berlaku dokumen PP/PKB">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm font-medium text-slate-500">Total Kasus</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{caseStats.total}</p>
            <p className="mt-1 text-xs text-slate-400">{caseStats.open} masih berjalan</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Kasus Lewat Target</p>
            <p className={cn("mt-2 text-3xl font-bold tabular-nums", caseStats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white")}>{caseStats.overdue}</p>
            <p className="mt-1 text-xs text-slate-400">Belum selesai, sudah lewat target</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-500">Dokumen PP/PKB</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{docStats.total}</p>
            <p className="mt-1 text-xs text-slate-400">
              {docStats.expired > 0 && <span className="text-red-500">{docStats.expired} kadaluarsa</span>}
              {docStats.expired > 0 && docStats.expiringSoon > 0 && " · "}
              {docStats.expiringSoon > 0 && <span className="text-amber-500">{docStats.expiringSoon} menuju kadaluarsa</span>}
              {docStats.expired === 0 && docStats.expiringSoon === 0 && "Semua aktif"}
            </p>
          </Card>
        </div>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab("cases")}
            className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "cases" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Kasus & Perselisihan
          </button>
          <button
            type="button"
            onClick={() => setTab("documents")}
            className={cn("border-b-2 px-1 pb-3 text-sm font-medium transition-colors", tab === "documents" ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Dokumen PP/PKB
          </button>
        </div>

        {tab === "cases" ? (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Daftar Kasus</h2>
                <p className="mt-0.5 text-sm text-slate-500">Keluhan, indisipliner, PHK, mediasi, hingga PHI</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setCaseModal({ mode: "new", data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Kasus Baru
              </Button>
            </div>
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="scale" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada kasus tercatat.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-5 py-2.5 font-medium">Kasus</th>
                      <th className="px-5 py-2.5 font-medium">Karyawan</th>
                      <th className="px-5 py-2.5 font-medium">Kategori</th>
                      <th className="px-5 py-2.5 font-medium">Target</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cases.map((c) => (
                      <tr key={c.id}>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{c.title}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.employeeName}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{CATEGORY_LABEL[c.category]}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{c.targetDate || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", CASE_STATUS_COLOR[c.status])}>{CASE_STATUS_LABEL[c.status]}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setCaseModal({ mode: "edit", data: c })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                              <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                            </button>
                            <button
                              type="button"
                              onClick={() => { deleteIRCase(tenantId, c.id); toast("Kasus dihapus"); refresh(); }}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            >
                              <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Dokumen PP/PKB</h2>
                <p className="mt-0.5 text-sm text-slate-500">Masa berlaku maksimal 2 tahun (UU 13/2003 Pasal 111 & 123)</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setDocModal({ mode: "new", data: null })}>
                <Icon className="h-4 w-4"><SvgPath name="plus" /></Icon>
                Dokumen Baru
              </Button>
            </div>
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600"><SvgPath name="document" /></Icon>
                <p className="mt-3 text-sm text-slate-400">Belum ada dokumen PP/PKB tercatat.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-5 py-2.5 font-medium">Dokumen</th>
                      <th className="px-5 py-2.5 font-medium">Jenis</th>
                      <th className="px-5 py-2.5 font-medium">Berlaku</th>
                      <th className="px-5 py-2.5 font-medium">Kadaluarsa</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {documents.map((d) => (
                      <tr key={d.id}>
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{d.title}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{d.docType.toUpperCase()}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{d.effectiveDate}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{d.expiryDate}</td>
                        <td className="px-5 py-3">
                          <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", DOC_STATUS_COLOR[d.status])}>{DOC_STATUS_LABEL[d.status]}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setDocModal({ mode: "edit", data: d })} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                              <Icon className="h-4 w-4"><SvgPath name="pencil" /></Icon>
                            </button>
                            <button
                              type="button"
                              onClick={() => { deleteIRDocument(tenantId, d.id); toast("Dokumen dihapus"); refresh(); }}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                            >
                              <Icon className="h-4 w-4"><SvgPath name="trash" /></Icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {caseModal && (
        <CaseModal
          employees={employees}
          initial={caseModal.data}
          onClose={() => setCaseModal(null)}
          onSave={handleSaveCase}
        />
      )}
      {docModal && (
        <DocModal
          initial={docModal.data}
          onClose={() => setDocModal(null)}
          onSave={handleSaveDoc}
        />
      )}
    </AppShell>
  );
}
