/* ═══════════════════════════════════════════════════════════════════════════
   Penyimpanan cloud untuk fitur HR — tabel `pi_hr_records` (supabase/hr-records-schema.sql).

   Pola sama dengan store.ts: localStorage = cache yang dibaca SINKRON oleh halaman,
   Supabase = sumber kebenaran.
   - Tulis: cache diperbarui, lalu HANYA catatan yang berubah di-upsert dan yang
     hilang dihapus di cloud. Gagal tulis dimunculkan sebagai toast — kalau diam,
     data itu hanya hidup di browser ini dan akan tertimpa saat sinkron berikutnya.
   - Baca: syncHrRecords() menarik semua catatan perusahaan, menimpa cache (cloud
     selalu menang, termasuk saat kosong), lalu memicu event "pi-hr-synced".

   Satu koleksi = satu `kind`. Bentuknya "list" (array objek ber-`id`) atau "map"
   (Record<kunci, nilai>, kunci jadi record_id).
   ═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "./supabase";
import { toast } from "../components/toast";

export type HrShape = "list" | "map";

export const HR_KINDS = {
  enps_round: { prefix: "hi_engagement_enps_", shape: "list" },
  feedback: { prefix: "hi_engagement_feedback_", shape: "list" },
  course: { prefix: "hi_training_courses_", shape: "list" },
  enrollment: { prefix: "hi_training_enrollments_", shape: "list" },
  training_budget: { prefix: "hi_training_budgets_", shape: "list" },
  ninebox: { prefix: "hi_ninebox_", shape: "map" },
  key_position: { prefix: "hi_succession_positions_", shape: "list" },
  successor: { prefix: "hi_succession_candidates_", shape: "list" },
  org_relation: { prefix: "hi_od_relations_", shape: "map" },
  job_grade: { prefix: "hi_od_grades_", shape: "list" },
  position_grade: { prefix: "hi_od_position_grade_", shape: "map" },
  ir_case: { prefix: "hi_ir_cases_", shape: "list" },
  ir_document: { prefix: "hi_ir_documents_", shape: "list" },
  competency_rating: { prefix: "hi_competency_ratings_", shape: "map" },
} as const satisfies Record<string, { prefix: string; shape: HrShape }>;

export type HrKind = keyof typeof HR_KINDS;

export const HR_SYNCED_EVENT = "pi-hr-synced";

/* ─── Fungsi murni (diuji di hr-records.test.ts) ─── */

/** Koleksi → pasangan [record_id, data]. Item list tanpa `id` dilewati: tanpa kunci,
 *  catatan itu tidak bisa diperbarui atau dihapus di cloud secara tepat. */
export function toEntries(shape: HrShape, value: unknown): [string, unknown][] {
  if (shape === "list") {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is { id: string } => typeof item?.id === "string" && item.id !== "")
      .map((item) => [item.id, item]);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

/** Apa yang harus dikirim ke cloud supaya `prev` menjadi `next`. Urutan array sengaja
 *  diabaikan: menyisipkan satu item di depan tidak boleh mengirim ulang semua item. */
export function diffEntries(prev: [string, unknown][], next: [string, unknown][]): { upserts: [string, unknown][]; deletes: string[] } {
  const before = new Map(prev.map(([id, data]) => [id, JSON.stringify(data)]));
  const after = new Set(next.map(([id]) => id));
  return {
    upserts: next.filter(([id, data]) => before.get(id) !== JSON.stringify(data)),
    deletes: prev.map(([id]) => id).filter((id) => !after.has(id)),
  };
}

/** Baris cloud → bentuk koleksi seperti yang disimpan store. List diurutkan terbaru
 *  dulu (createdAt) — urutan yang sama dengan `unshift` di store; getter yang butuh
 *  urutan lain (eNPS per periode, grade per level) mengurutkan ulang sendiri. */
export function rebuildCollection(shape: HrShape, rows: { record_id: string; data: unknown }[]): unknown {
  if (shape === "map") return Object.fromEntries(rows.map((r) => [r.record_id, r.data]));
  const createdAt = (d: unknown) => String((d as { createdAt?: unknown })?.createdAt ?? "");
  return rows.map((r) => r.data).sort((a, b) => createdAt(b).localeCompare(createdAt(a)));
}

/* ─── Cache + cloud ─── */

function readCache(kind: HrKind, tenantId: string): unknown {
  try {
    const raw = localStorage.getItem(HR_KINDS[kind].prefix + tenantId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function reportCloudFailure(op: string, message: string): void {
  console.warn(`[hr-records] ${op} gagal:`, message);
  toast("Gagal menyimpan ke cloud — perubahan baru ada di browser ini. Coba simpan lagi.", "error");
}

/** Pengganti `localStorage.setItem(PREFIX + tenantId, JSON.stringify(value))` di store. */
export function saveHrCollection(kind: HrKind, tenantId: string, value: unknown): void {
  if (typeof window === "undefined") return;
  const { prefix, shape } = HR_KINDS[kind];
  const prev = readCache(kind, tenantId);
  localStorage.setItem(prefix + tenantId, JSON.stringify(value));
  if (!supabase || !tenantId) return;

  const { upserts, deletes } = diffEntries(toEntries(shape, prev), toEntries(shape, value));
  const now = new Date().toISOString();
  if (upserts.length) {
    supabase
      .from("pi_hr_records")
      .upsert(upserts.map(([record_id, data]) => ({ tenant_id: tenantId, kind, record_id, data, updated_at: now })))
      .then(({ error }) => { if (error) reportCloudFailure(`${kind} upsert`, error.message); });
  }
  if (deletes.length) {
    supabase
      .from("pi_hr_records")
      .delete()
      .eq("tenant_id", tenantId).eq("kind", kind).in("record_id", deletes)
      .then(({ error }) => { if (error) reportCloudFailure(`${kind} delete`, error.message); });
  }
}

/** Tarik semua catatan HR perusahaan dari cloud ke cache. Gagal = cache dibiarkan apa
 *  adanya (gagal jaringan tidak sama dengan "cloud kosong"). */
export async function syncHrRecords(tenantId: string): Promise<boolean> {
  if (!supabase || !tenantId || typeof window === "undefined") return false;
  // Diambil per halaman: PostgREST memotong hasil di 1.000 baris secara diam-diam, dan
  // matriks kompetensi (karyawan × kompetensi) mudah melewatinya.
  const PAGE = 1000;
  const data: { kind: string; record_id: string; data: unknown }[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await supabase
      .from("pi_hr_records").select("kind, record_id, data")
      .eq("tenant_id", tenantId)
      .order("kind").order("record_id")
      .range(from, from + PAGE - 1);
    if (res.error || !res.data) {
      if (res.error) console.warn("[hr-records] sinkron gagal:", res.error.message);
      return false;
    }
    data.push(...res.data);
    if (res.data.length < PAGE) break;
  }
  for (const kind of Object.keys(HR_KINDS) as HrKind[]) {
    const { prefix, shape } = HR_KINDS[kind];
    const rows = data.filter((r) => r.kind === kind);
    localStorage.setItem(prefix + tenantId, JSON.stringify(rebuildCollection(shape, rows)));
  }
  window.dispatchEvent(new Event(HR_SYNCED_EVENT));
  return true;
}
