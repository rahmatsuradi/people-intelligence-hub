/* ═══════════════════════════════════════════════════════════════════════════
   Lapisan data modul Assessment — bentuk baris DB, pemetaan ke tipe engine,
   dan penyajian item ke peserta.

   Dua hal yang dijaga ketat di file ini:

   1. KUNCI JAWABAN TIDAK PERNAH IKUT KE BROWSER. `toPublicItem()` membuang
      answerIndex, rationale, dan nilai effectiveness setiap opsi SJT. Halaman
      tes berjalan tanpa login; apa pun yang dikirim ke sana harus dianggap
      bisa dibaca peserta lewat DevTools atau tab jaringan.

   2. DB BOLEH KOSONG. Bila tabel pi_assessment_* belum di-seed (atau Supabase
      belum dikonfigurasi), profil jabatan dan norma jatuh ke default di kode.
      Modul tetap bisa dipakai, dan sumber datanya dinyatakan ke UI lewat
      flag `source` sehingga tidak ada yang mengira DB sudah terisi padahal belum.
═══════════════════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssessmentItem,
  AssessmentReport,
  BatteryDefinition,
  JobProfile,
  NormGroup,
  ProfileRequirement,
  ResponseMap,
  SectionTiming,
} from "./types";
import { DEFAULT_JOB_PROFILES } from "./job-profiles";
import { DEFAULT_NORM_GROUPS } from "./norms";
import { PERSONALITY_ITEM_BY_ID, LIKERT5_LABELS } from "./items-personality";
import { COGNITIVE_ITEM_BY_ID } from "./items-cognitive";
import { SJT_ITEM_BY_ID } from "./items-sjt";
import { BATTERY_BY_ID } from "./batteries";

/* ─── Bentuk baris DB ─── */

export interface PiAssessmentNormRow {
  id: string;
  tenant_id: string | null;
  label: string;
  provenance: string;
  sample_size: number;
  effective_date: string;
  entries: NormGroup["entries"];
  notes: string | null;
}

export interface PiAssessmentProfileRow {
  id: string;
  tenant_id: string | null;
  name: string;
  family: string;
  level: string;
  description: string | null;
  requirements: ProfileRequirement[];
  recommend_threshold: number;
  consider_threshold: number;
  source: string;
}

export type SessionStatus = "invited" | "in_progress" | "completed" | "expired";

export interface PiAssessmentSessionRow {
  id: string;
  tenant_id: string;
  candidate_id: string | null;
  candidate_name: string;
  candidate_email: string | null;
  position: string;
  battery_id: string;
  profile_id: string | null;
  norm_id: string | null;
  access_token: string;
  status: SessionStatus;
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  responses: ResponseMap;
  timings: SectionTiming[];
  report: AssessmentReport | null;
}

/* ─── Pemetaan baris → tipe engine ─── */

export function rowToNormGroup(row: PiAssessmentNormRow): NormGroup {
  return {
    id: row.id,
    label: row.label,
    provenance: row.provenance === "local_sample" ? "local_sample" : "synthetic_demo",
    sampleSize: row.sample_size ?? 0,
    effectiveDate: row.effective_date,
    entries: row.entries ?? [],
    notes: row.notes ?? undefined,
  };
}

export function rowToJobProfile(row: PiAssessmentProfileRow): JobProfile {
  return {
    id: row.id,
    name: row.name,
    family: row.family,
    level: (["staff", "supervisor", "manager", "specialist"].includes(row.level)
      ? row.level
      : "staff") as JobProfile["level"],
    description: row.description ?? "",
    requirements: row.requirements ?? [],
    recommendThreshold: row.recommend_threshold,
    considerThreshold: row.consider_threshold,
    source: row.source === "custom" ? "custom" : "template",
  };
}

export function jobProfileToRow(p: JobProfile, tenantId: string | null): Omit<PiAssessmentProfileRow, "tenant_id"> & { tenant_id: string | null } {
  return {
    id: p.id,
    tenant_id: tenantId,
    name: p.name,
    family: p.family,
    level: p.level,
    description: p.description,
    requirements: p.requirements,
    recommend_threshold: p.recommendThreshold,
    consider_threshold: p.considerThreshold,
    source: p.source,
  };
}

/* ─── Pembacaan dengan fallback ke default di kode ─── */

export interface LoadResult<T> {
  data: T;
  /** 'db' = dibaca dari Supabase; 'default' = tabel kosong / DB tak tersedia. */
  source: "db" | "default";
  error?: string;
}

export async function loadJobProfiles(
  client: SupabaseClient | null,
  tenantId?: string,
): Promise<LoadResult<JobProfile[]>> {
  if (!client) return { data: DEFAULT_JOB_PROFILES, source: "default" };
  const { data, error } = await client
    .from("pi_assessment_profiles")
    .select("*")
    .or(tenantId ? `tenant_id.is.null,tenant_id.eq.${tenantId}` : "tenant_id.is.null")
    .order("name");

  if (error) return { data: DEFAULT_JOB_PROFILES, source: "default", error: error.message };
  if (!data || data.length === 0) return { data: DEFAULT_JOB_PROFILES, source: "default" };

  // Profil custom milik tenant menang atas template bawaan yang ber-id sama.
  const rows = data as PiAssessmentProfileRow[];
  const byId = new Map<string, JobProfile>();
  for (const r of rows) {
    const existing = byId.get(r.id);
    if (existing && existing.source === "custom") continue;
    byId.set(r.id, rowToJobProfile(r));
  }
  return { data: [...byId.values()], source: "db" };
}

export async function loadNormGroups(client: SupabaseClient | null): Promise<LoadResult<NormGroup[]>> {
  if (!client) return { data: DEFAULT_NORM_GROUPS, source: "default" };
  const { data, error } = await client
    .from("pi_assessment_norms")
    .select("*")
    .order("effective_date", { ascending: false });

  if (error) return { data: DEFAULT_NORM_GROUPS, source: "default", error: error.message };
  if (!data || data.length === 0) return { data: DEFAULT_NORM_GROUPS, source: "default" };
  return { data: (data as PiAssessmentNormRow[]).map(rowToNormGroup), source: "db" };
}

/* ─── Penyajian item ke peserta (tanpa kunci jawaban) ─── */

export type PublicItemFormat = "likert5" | "multiple_choice" | "sjt_effectiveness";

export interface PublicItem {
  id: string;
  format: PublicItemFormat;
  /** Teks pernyataan (kepribadian) atau pertanyaan (kognitif) atau skenario (SJT). */
  text: string;
  /** Pilihan yang ditampilkan. Untuk likert5 = label skala. */
  options: string[];
}

const ALL_ITEM_BY_ID: Record<string, AssessmentItem> = {
  ...PERSONALITY_ITEM_BY_ID,
  ...COGNITIVE_ITEM_BY_ID,
  ...SJT_ITEM_BY_ID,
};

export function getItemById(id: string): AssessmentItem | undefined {
  return ALL_ITEM_BY_ID[id];
}

/** Membuang segala hal yang tidak boleh dilihat peserta: kunci jawaban kognitif,
 *  nilai efektivitas opsi SJT, penjelasan kunci, domain/keying item kepribadian
 *  (yang akan memudahkan menebak arah "jawaban yang bagus"). */
export function toPublicItem(item: AssessmentItem): PublicItem {
  if (item.format === "likert5") {
    return { id: item.id, format: "likert5", text: item.text, options: [...LIKERT5_LABELS] };
  }
  if (item.format === "multiple_choice") {
    return { id: item.id, format: "multiple_choice", text: item.text, options: item.options };
  }
  return {
    id: item.id,
    format: "sjt_effectiveness",
    text: item.scenario,
    options: item.options.map((o) => o.text),
  };
}

export interface PublicSection {
  id: string;
  title: string;
  instruction: string;
  timeLimitSec: number | null;
  items: PublicItem[];
}

export interface PublicBattery {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  sections: PublicSection[];
}

export function toPublicBattery(battery: BatteryDefinition): PublicBattery {
  return {
    id: battery.id,
    name: battery.name,
    description: battery.description,
    estimatedMinutes: battery.estimatedMinutes,
    sections: battery.sections.map((s) => ({
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      timeLimitSec: s.timeLimitSec,
      items: s.itemIds
        .map((id) => ALL_ITEM_BY_ID[id])
        .filter((it): it is AssessmentItem => Boolean(it))
        .map(toPublicItem),
    })),
  };
}

/** Seluruh id item yang disajikan sebuah baterai — dipakai penskoran & validitas. */
export function presentedItemIds(batteryId: string): string[] {
  const b = BATTERY_BY_ID[batteryId];
  if (!b) return [];
  return b.sections.flatMap((s) => s.itemIds);
}

/* ─── Pembuatan id & token ─── */

/** Id sesi yang bisa dibaca manusia, sepola dengan id kandidat modul Hire. */
export function generateSessionId(now: Date = new Date()): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AS-${date}-${rand}`;
}

/** Token akses halaman tes publik.
 *  Dibuat dengan crypto.getRandomValues (bukan Math.random) karena token inilah
 *  satu-satunya yang melindungi sesi asesmen — Math.random tidak dirancang untuk
 *  nilai rahasia dan bisa ditebak dari keluaran sebelumnya.
 *  32 karakter base36 ≈ 165 bit entropi. */
export function generateAccessToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

/** Masa berlaku undangan tes. 14 hari: cukup panjang untuk kandidat yang sedang
 *  bekerja, cukup pendek agar tautan tidak beredar tanpa batas waktu. */
export const INVITE_VALID_DAYS = 14;

export function defaultExpiry(from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + INVITE_VALID_DAYS);
  return d.toISOString();
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  invited: "Diundang",
  in_progress: "Sedang dikerjakan",
  completed: "Selesai",
  expired: "Kedaluwarsa",
};
