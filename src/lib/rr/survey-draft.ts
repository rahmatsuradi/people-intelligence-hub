/* ═══════════════════════════════════════════════════════════════════════════
   Draf formulir survei, tersimpan di browser pengisi (localStorage), TIDAK di server.
   Di HP, berpindah ke WhatsApp lalu kembali sering membuat halaman dimuat ulang; tanpa draf
   semua jawaban hilang dan orang malas mengulang.

   Draf per link (+ link pribadi), dihapus begitu jawaban terkirim, dan kedaluwarsa setelah
   DRAFT_MAX_AGE_MS supaya jawaban tidak tertinggal lama di HP yang dipakai bersama.
   Penyimpanan bisa saja ditolak browser (mode privat), jadi semua akses aman bila gagal.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { AnswerValue } from "./pulse";

export const DRAFT_MAX_AGE_MS = 3 * 24 * 3_600_000;

export interface SurveyDraft { step: number; name: string; contact: string; answers: Record<string, AnswerValue> }

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const draftKey = (token: string, invite?: string) => `survei-draft:${token}:${invite ?? ""}`;

export function saveDraft(store: Store, key: string, draft: SurveyDraft, now = Date.now()): void {
  try { store.setItem(key, JSON.stringify({ ...draft, savedAt: now })); } catch { /* penyimpanan penuh/ditolak: formulir tetap jalan */ }
}

export function loadDraft(store: Store, key: string, now = Date.now()): SurveyDraft | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SurveyDraft> & { savedAt?: number };
    if (typeof d.savedAt !== "number" || now - d.savedAt > DRAFT_MAX_AGE_MS) { store.removeItem(key); return null; }
    if (!d.answers || typeof d.answers !== "object" || Array.isArray(d.answers)) return null;
    return { step: Number.isInteger(d.step) && d.step! >= 0 ? d.step! : 0, name: String(d.name ?? ""), contact: String(d.contact ?? ""), answers: d.answers };
  } catch { return null; }
}

export function clearDraft(store: Store, key: string): void {
  try { store.removeItem(key); } catch { /* tidak apa-apa */ }
}
