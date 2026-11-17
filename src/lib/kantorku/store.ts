/* ═══════════════════════════════════════════════════════════════════════════
   Pemuat & penyimpan untuk /karyawan/kantorku (sisi browser, akun HR — dijaga RLS).
   Tabel: supabase/data-karyawan-kantorku.sql. Logika murni ada di map.ts / intake.ts.
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../supabase";
import { getActiveCompanyId } from "../payroll/company-profile";
import { fetchAll, type MasterEmployee, type WorkGroup } from "../rr/master";
import { buildApplyPatch, matchOutlet, type DocKind } from "./intake";
import type { HrisFields } from "./map";

export interface HrisRow extends HrisFields { employee_id: string; exported_at?: string | null; updated_at?: string }
export interface DataLink {
  id: string; token: string; employee_id: string | null; label: string | null; status: "open" | "closed";
  expires_at: string | null; created_at: string; last_opened_at: string | null; last_submitted_at: string | null;
}
export interface Submission {
  id: string; link_id: string | null; employee_id: string | null; answers: Record<string, string>;
  files: Partial<Record<DocKind, string>>; status: "baru" | "diterapkan" | "ditolak"; flags: string[];
  submitted_at: string; reviewed_at: string | null; review_note: string | null;
}
export interface ExtraCore { id: string; npwp: string | null; ptkp_status: string | null }

export const SUBMISSION_FLAG_LABEL: Record<string, string> = {
  link_umum: "Lewat link umum (karyawan baru / belum terhubung)",
  cocok_nik: "Dicocokkan otomatis lewat NIK — periksa namanya",
  nik_ganda_di_master: "NIK ini dipakai lebih dari satu karyawan di master",
  nik_milik_karyawan_lain: "NIK yang diisi milik karyawan lain di master — link mungkin diteruskan",
  ada_isian_lain_belum_diterapkan: "Ada isian lain untuk orang yang sama yang belum diterapkan",
  dokumen_gagal_tersimpan: "Sebagian dokumen gagal terunggah",
};

export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function loadKantorku(): Promise<{
  hris: HrisRow[]; links: DataLink[]; submissions: Submission[]; extra: ExtraCore[]; salary: Map<string, number>; missingTables: boolean;
}> {
  const empty = { hris: [], links: [], submissions: [], extra: [], salary: new Map<string, number>(), missingTables: false };
  if (!supabase) return empty;
  const db = supabase;
  const tenant = getActiveCompanyId();
  const today = new Date().toISOString().slice(0, 10);
  const probe = await db.from("pi_employee_hris").select("employee_id", { head: true, count: "exact" });
  if (probe.error && /does not exist|schema cache|not find/i.test(probe.error.message)) return { ...empty, missingTables: true };
  const [hris, links, submissions, extra, comp] = await Promise.all([
    fetchAll<HrisRow>((a, b) => db.from("pi_employee_hris").select("*").order("employee_id").range(a, b)),
    fetchAll<DataLink>((a, b) => db.from("pi_employee_data_links").select("id, token, employee_id, label, status, expires_at, created_at, last_opened_at, last_submitted_at").eq("tenant_id", tenant).order("created_at", { ascending: false }).range(a, b)),
    fetchAll<Submission>((a, b) => db.from("pi_employee_data_submissions").select("id, link_id, employee_id, answers, files, status, flags, submitted_at, reviewed_at, review_note").eq("tenant_id", tenant).order("submitted_at", { ascending: false }).range(a, b)),
    fetchAll<ExtraCore>((a, b) => db.from("pi_employees").select("id, npwp, ptkp_status").eq("tenant_id", tenant).order("id").range(a, b)),
    fetchAll<{ employee_id: string; upah_pokok: number; effective_date: string }>((a, b) => db.from("pi_compensation").select("employee_id, upah_pokok, effective_date").lte("effective_date", today).order("effective_date").range(a, b)),
  ]);
  // Urut naik → baris terakhir per karyawan = upah pokok yang berlaku hari ini.
  const salary = new Map<string, number>();
  for (const c of comp) salary.set(c.employee_id, Number(c.upah_pokok));
  return { hris, links, submissions, extra, salary, missingTables: false };
}

export async function saveHris(employeeId: string, patch: Partial<HrisFields>): Promise<string | null> {
  if (!supabase) return "Database belum terhubung.";
  const row: Record<string, unknown> = { employee_id: employeeId, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) row[k] = typeof v === "string" ? (v.trim() || null) : v ?? null;
  const { error } = await supabase.from("pi_employee_hris").upsert(row, { onConflict: "employee_id" });
  return error ? (/pi_employee_hris_kk_id_idx|duplicate key/.test(error.message) ? "Employee ID KantorKu itu sudah dipakai karyawan lain." : error.message) : null;
}

export async function markExported(ids: string[]): Promise<string | null> {
  if (!supabase || !ids.length) return null;
  const now = new Date().toISOString();
  // Upsert per 500 supaya tidak melewati batas panjang permintaan.
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await supabase.from("pi_employee_hris").upsert(ids.slice(i, i + 500).map((employee_id) => ({ employee_id, exported_at: now })), { onConflict: "employee_id" });
    if (error) return error.message;
  }
  return null;
}

export async function createLinks(rows: { employee_id: string | null; label: string | null }[], expiresAt: string | null): Promise<{ links: DataLink[]; error: string | null }> {
  if (!supabase) return { links: [], error: "Database belum terhubung." };
  const tenant = getActiveCompanyId();
  const { data, error } = await supabase.from("pi_employee_data_links")
    .insert(rows.map((r) => ({ ...r, tenant_id: tenant, token: newToken(), expires_at: expiresAt })))
    .select("id, token, employee_id, label, status, expires_at, created_at, last_opened_at, last_submitted_at");
  return { links: (data ?? []) as DataLink[], error: error?.message ?? null };
}

export async function setLinkStatus(id: string, status: "open" | "closed"): Promise<string | null> {
  if (!supabase) return "Database belum terhubung.";
  const { error } = await supabase.from("pi_employee_data_links").update({ status }).eq("id", id);
  return error?.message ?? null;
}

export async function rejectSubmission(id: string, note: string): Promise<string | null> {
  if (!supabase) return "Database belum terhubung.";
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("pi_employee_data_submissions")
    .update({ status: "ditolak", review_note: note || null, reviewed_at: new Date().toISOString(), reviewed_by: u.user?.id ?? null }).eq("id", id);
  return error?.message ?? null;
}

/** Buka dokumen di bucket privat lewat signed URL 5 menit. URL biasa (Google Drive lama) dibuka apa adanya. */
export async function openDoc(url: string): Promise<void> {
  const m = url.match(/^storage:([^/]+)\/(.+)$/);
  if (!m) { window.open(url, "_blank", "noopener"); return; }
  const tab = window.open("", "_blank");
  const res = await supabase?.storage.from(m[1]).createSignedUrl(m[2], 300);
  if (res?.data?.signedUrl) { if (tab) tab.location.href = res.data.signedUrl; else window.open(res.data.signedUrl, "_blank", "noopener"); }
  else { tab?.close(); throw new Error(res?.error?.message ?? "Dokumen tidak bisa dibuka."); }
}

const CLEARED_BY_FORM: Record<string, (a: Record<string, string>) => boolean> = {
  tanpa_data_pribadi: (a) => !!(a.nik && a.phone && a.bank_account),
  nik_tidak_16_digit: (a) => !!a.nik,
  rekening_tanpa_nama_bank: (a) => !!a.bank_code,
  penempatan_kosong: (a) => !!a.outlet,
  tanggal_masuk_kosong_atau_tidak_valid: (a) => !!a.join_date,
};

export interface ApplyChoice {
  /** null = buat karyawan baru. */
  employeeId: string | null;
  ptkp: string | null;              // dipilih HR; null = tidak diubah
  outletId: string | null;          // dipilih HR; null = pakai catatan penempatan
  workGroup: WorkGroup | null;      // wajib untuk karyawan baru / karyawan tanpa profil
  /** Field isian yang TIDAK diterapkan (HR mempertahankan nilai master). */
  skip: Set<string>;
}

/** Terapkan satu isian ke master. Mengembalikan id karyawan, atau pesan galat. */
export async function applySubmission(
  s: Submission, choice: ApplyChoice, current: MasterEmployee | null, outlets: { id: string; name: string }[],
): Promise<{ employeeId?: string; error?: string }> {
  if (!supabase) return { error: "Database belum terhubung." };
  const db = supabase;
  const answers = Object.fromEntries(Object.entries(s.answers).filter(([k]) => !choice.skip.has(k)));
  const files = Object.fromEntries(Object.entries(s.files).filter(([k]) => !choice.skip.has(k)));
  const patch = buildApplyPatch(answers, files);
  const now = new Date().toISOString();
  let id = choice.employeeId;

  const core: Record<string, unknown> = { ...patch.core };
  if (choice.ptkp) core.ptkp_status = choice.ptkp;
  if (patch.hris.department && !current?.profile) core.department = patch.hris.department;

  const outlet = choice.outletId ? outlets.find((o) => o.id === choice.outletId) ?? null : matchOutlet(patch.outletName, outlets);
  const profile: Record<string, unknown> = { ...patch.profile, updated_at: now };
  if (patch.outletName && !choice.skip.has("outlet")) {
    if (outlet) { profile.outlet_id = outlet.id; profile.placement_note = null; }
    else profile.placement_note = patch.outletName;
  }

  if (!id) {
    if (!choice.workGroup) return { error: "Pilih kelompok kerja untuk karyawan baru." };
    if (!answers.full_name) return { error: "Nama lengkap kosong." };
    const ins = await db.from("pi_employees").insert({
      tenant_id: getActiveCompanyId(), status: "active", ptkp_status: choice.ptkp ?? "BELUM_DIISI",
      employment_type: "BELUM_DIISI", risk_class: "BELUM_DIISI", ...core,
    }).select("id").single();
    if (ins.error || !ins.data) return { error: ins.error?.message ?? "Gagal membuat karyawan." };
    id = (ins.data as { id: string }).id;
    const pr = await db.from("pi_employee_profiles").insert({ employee_id: id, work_group: choice.workGroup, source: "Formulir data karyawan (web)", data_flags: [], ...profile });
    if (pr.error) return { error: `Karyawan dibuat, tapi profil gagal: ${pr.error.message}` };
  } else {
    if (Object.keys(core).length) {
      const a = await db.from("pi_employees").update(core).eq("id", id);
      if (a.error) return { error: a.error.message };
    }
    const flags = (current?.profile?.data_flags ?? []).filter((f) => !CLEARED_BY_FORM[f]?.(answers));
    if (current?.profile) {
      const b = await db.from("pi_employee_profiles").update({ ...profile, data_flags: flags }).eq("employee_id", id);
      if (b.error) return { error: b.error.message };
    } else {
      if (!choice.workGroup) return { error: "Karyawan ini belum punya profil — pilih kelompok kerjanya." };
      const b = await db.from("pi_employee_profiles").insert({ employee_id: id, work_group: choice.workGroup, source: "Formulir data karyawan (web)", data_flags: [], ...profile });
      if (b.error) return { error: b.error.message };
    }
  }

  if (Object.keys(patch.hris).length) {
    const err = await saveHris(id, patch.hris);
    if (err) return { error: `Master diperbarui, tapi data KantorKu gagal: ${err}` };
  }
  const { data: u } = await db.auth.getUser();
  const done = await db.from("pi_employee_data_submissions")
    .update({ status: "diterapkan", employee_id: id, reviewed_at: now, reviewed_by: u.user?.id ?? null,
      review_note: choice.skip.size ? `Tidak diterapkan: ${[...choice.skip].join(", ")}` : null })
    .eq("id", s.id);
  if (done.error) return { employeeId: id, error: `Master diperbarui, tapi status isian gagal disimpan: ${done.error.message}` };
  return { employeeId: id };
}
