/* ═══════════════════════════════════════════════════════════════════════════
   Master karyawan & outlet Rica Rico — pi_employees + pi_employee_profiles + pi_outlets
   (supabase/rica-rico-phase1.sql). Fungsi murni (filter, ringkasan tanda, outlet lowong)
   diuji di master.test.ts; pemuat/penyimpan memakai Supabase dan dijaga RLS
   (owner hanya bisa membaca).
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../supabase";
import { getActiveCompanyId } from "../payroll/company-profile";

export type WorkGroup = "spg" | "spv" | "office" | "produksi" | "santan" | "sopir" | "host_live" | "lainnya";
export type EmployeeStatus = "active" | "resigned" | "perlu_verifikasi";

export const WORK_GROUP_LABEL: Record<WorkGroup, string> = {
  spg: "SPG", spv: "SPV", office: "Office", produksi: "Produksi", santan: "Santan",
  sopir: "Sopir", host_live: "Host Live", lainnya: "Lainnya",
};

export const STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: "Aktif", resigned: "Resign", perlu_verifikasi: "Perlu verifikasi",
};

/** Arti tiap tanda kualitas data hasil impor — ditulis untuk HR, bukan untuk programmer. */
export const FLAG_LABEL: Record<string, string> = {
  tanpa_data_pribadi: "Belum mengisi Employee Database (NIK, kontak, rekening kosong)",
  nik_tidak_16_digit: "NIK tidak 16 digit",
  nik_dipakai_nama_lain: "NIK yang sama dipakai di formulir atas nama lain",
  nik_ganda_antar_karyawan: "NIK sama dengan karyawan lain di sistem",
  tanggal_masuk_kosong_atau_tidak_valid: "Tanggal masuk kosong / tidak valid di sumber",
  rekening_tanpa_nama_bank: "Nomor rekening tanpa nama bank",
  cocok_ke_lebih_dari_satu_orang: "Nama di rekap gaji cocok ke lebih dari satu orang di Employee Database",
  tidak_ada_di_rekap_gaji_september: "Ada di Employee Database tapi tidak digaji September — masih bekerja?",
  belum_ada_di_rekap_gaji_september: "Baru join (mengisi database setelah 25 Sep) — belum ada di rekap gaji",
  juga_ada_di_tab_resign: "Digaji September tapi juga tercatat di tab Resign",
  outlet_tidak_ada_di_tracker_omset: "Outlet penempatan belum ada di tracker omset",
  catatan_resign_di_rekap: "Ada catatan \"resign\" di kolom lokasi rekap gaji",
  penempatan_kosong: "SPG tanpa outlet / penempatan",
  terdaftar_di_lebih_dari_satu_entitas_bpjs: "Terdaftar di lebih dari satu badan usaha BPJS",
};

export interface Outlet {
  id: string;
  name: string;
  area: string | null;
  spv_name: string | null;
  location_type: "stasiun" | "mall" | "supermarket" | "toko" | "lainnya" | null;
  status: "active" | "closed";
  source: string | null;
  notes: string | null;
}

export interface EmployeeProfile {
  employee_id: string;
  work_group: WorkGroup;
  outlet_id: string | null;
  placement_note: string | null;
  supervisor_name: string | null;
  legal_entity: string | null;
  employment_label: string | null;
  nickname: string | null;
  gender: string | null;
  birth_place: string | null;
  birth_date: string | null;
  religion: string | null;
  blood_type: string | null;
  marital_status: string | null;
  mother_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  emergency_relation: string | null;
  education_level: string | null;
  education_institution: string | null;
  education_major: string | null;
  bank_name: string | null;
  ktp_url: string | null;
  kk_url: string | null;
  photo_url: string | null;
  data_flags: string[];
  source: string | null;
}

export interface MasterEmployee {
  id: string;
  full_name: string;
  nik: string | null;
  join_date: string | null;
  employment_type: string;
  position: string | null;
  bank_account: string | null;
  status: EmployeeStatus;
  profile: EmployeeProfile | null;
}

/* ─── Fungsi murni ─── */

export interface MasterFilter {
  search?: string;
  group?: WorkGroup | "";
  status?: EmployeeStatus | "";
  outletId?: string;
  supervisor?: string;
  flag?: string; // "" = semua, "__any__" = hanya yang punya tanda
}

export function filterEmployees(list: MasterEmployee[], f: MasterFilter, outletName: (id: string | null) => string = () => ""): MasterEmployee[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return list.filter((e) => {
    const p = e.profile;
    if (f.group && p?.work_group !== f.group) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.outletId && p?.outlet_id !== f.outletId) return false;
    if (f.supervisor && (p?.supervisor_name ?? "") !== f.supervisor) return false;
    if (f.flag === "__any__" && !(p?.data_flags.length)) return false;
    if (f.flag && f.flag !== "__any__" && !p?.data_flags.includes(f.flag)) return false;
    if (q) {
      const hay = [e.full_name, p?.nickname, e.position, p?.supervisor_name, outletName(p?.outlet_id ?? null), p?.placement_note, e.nik]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Jumlah karyawan per tanda, urut terbanyak. Karyawan resign tidak dihitung — tandanya tidak lagi perlu dikejar. */
export function summarizeFlags(list: MasterEmployee[]): { flag: string; count: number }[] {
  const c = new Map<string, number>();
  for (const e of list) {
    if (e.status === "resigned") continue;
    for (const fl of e.profile?.data_flags ?? []) c.set(fl, (c.get(fl) ?? 0) + 1);
  }
  return [...c.entries()].map(([flag, count]) => ({ flag, count })).sort((a, b) => b.count - a.count || a.flag.localeCompare(b.flag));
}

/** SPG aktif per outlet. Outlet aktif dengan 0 SPG aktif = kemungkinan lowong. */
export function activeSpgByOutlet(list: MasterEmployee[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of list) {
    const p = e.profile;
    if (e.status !== "active" || p?.work_group !== "spg" || !p.outlet_id) continue;
    m.set(p.outlet_id, (m.get(p.outlet_id) ?? 0) + 1);
  }
  return m;
}

export function vacantOutlets(outlets: Outlet[], list: MasterEmployee[]): Outlet[] {
  const n = activeSpgByOutlet(list);
  return outlets.filter((o) => o.status === "active" && !n.get(o.id));
}

export function countBy<T>(items: T[], key: (t: T) => string | null | undefined): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}

/* ─── Database ─── */

/** PostgREST memotong hasil di 1.000 baris secara diam-diam — ambil per halaman. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadMaster(): Promise<{ employees: MasterEmployee[]; outlets: Outlet[] }> {
  if (!supabase) return { employees: [], outlets: [] };
  const db = supabase;
  const tenant = getActiveCompanyId();
  const [emps, profiles, outlets] = await Promise.all([
    fetchAll<Omit<MasterEmployee, "profile">>((a, b) => db.from("pi_employees")
      .select("id, full_name, nik, join_date, employment_type, position, bank_account, status").eq("tenant_id", tenant).order("id").range(a, b)),
    fetchAll<EmployeeProfile>((a, b) => db.from("pi_employee_profiles").select("*").order("employee_id").range(a, b)),
    fetchAll<Outlet>((a, b) => db.from("pi_outlets")
      .select("id, name, area, spv_name, location_type, status, source, notes").eq("tenant_id", tenant).order("id").range(a, b)),
  ]);
  const byId = new Map(profiles.map((p) => [p.employee_id, p]));
  const employees = emps
    .map((e) => ({ ...e, profile: byId.get(e.id) ?? null }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "id"));
  // Outlet tanpa area (belum ada di tracker omset) diletakkan paling akhir.
  outlets.sort((a, b) => Number(!a.area) - Number(!b.area) || (a.area ?? "").localeCompare(b.area ?? "") || a.name.localeCompare(b.name, "id"));
  return { employees, outlets };
}

export async function saveEmployee(
  id: string,
  core: Partial<Pick<MasterEmployee, "full_name" | "nik" | "join_date" | "position" | "bank_account" | "status" | "employment_type">>,
  profile: Partial<Omit<EmployeeProfile, "employee_id">>,
): Promise<string | null> {
  if (!supabase) return "Database belum terhubung.";
  const now = new Date().toISOString();
  const a = await supabase.from("pi_employees").update(core).eq("id", id);
  if (a.error) return a.error.message;
  const b = await supabase.from("pi_employee_profiles").update({ ...profile, updated_at: now }).eq("employee_id", id);
  return b.error ? b.error.message : null;
}

export async function saveOutlet(o: Partial<Outlet> & { name: string }): Promise<string | null> {
  if (!supabase) return "Database belum terhubung.";
  const row = { ...o, tenant_id: getActiveCompanyId(), updated_at: new Date().toISOString() };
  const res = o.id
    ? await supabase.from("pi_outlets").update(row).eq("id", o.id)
    : await supabase.from("pi_outlets").insert({ ...row, source: "Ditambahkan HR di aplikasi" });
  return res.error ? res.error.message : null;
}
