/* ═══════════════════════════════════════════════════════════════════════════
   Lapisan data bank soal perusahaan.

   Dipisahkan dari question-bank.ts supaya logikanya tetap murni dan bisa diuji
   tanpa database. Berkas ini hanya menerjemahkan bentuk baris ke bentuk yang
   dipakai aplikasi, dan sebaliknya.
═══════════════════════════════════════════════════════════════════════════ */

import { supabase } from "../supabase";
import type { BankQuestion, CustomQuestionDraft } from "./question-bank";
import { generateCustomQuestionId } from "./question-bank";

export interface PiInterviewQuestionRow {
  id: string;
  tenant_id: string;
  competency_id: string;
  competency_name: string;
  type: string;
  question: string;
  strong_answer: string;
  red_flags: string[];
  cluster: string | null;
}

export function rowToBankQuestion(r: PiInterviewQuestionRow): BankQuestion {
  return {
    id: r.id,
    type: r.type,
    competencyId: r.competency_id,
    competencyName: r.competency_name,
    question: r.question,
    strongAnswer: r.strong_answer ?? "",
    redFlags: Array.isArray(r.red_flags) ? r.red_flags : [],
    source: "custom",
  };
}

export interface LoadCustomResult {
  questions: BankQuestion[];
  /** Diisi hanya bila pemuatan gagal — UI menampilkannya apa adanya alih-alih
   *  diam-diam menyajikan kit tanpa pertanyaan perusahaan seolah memang tidak ada. */
  error?: string;
}

/** Memuat pertanyaan perusahaan untuk satu klaster jabatan.
 *  Pertanyaan tanpa klaster (cluster null) selalu ikut — itu pertanyaan yang
 *  berlaku untuk semua posisi, mis. soal kepatuhan internal. */
export async function loadCustomQuestions(tenantId: string, cluster: string): Promise<LoadCustomResult> {
  if (!supabase) return { questions: [] };

  const { data, error } = await supabase
    .from("pi_interview_questions")
    .select("*")
    .eq("tenant_id", tenantId)
    .or(`cluster.is.null,cluster.eq.${cluster}`)
    .order("created_at");

  if (error) {
    // Tabel belum dibuat adalah kondisi normal pada instance yang belum
    // dimigrasi — bukan kegagalan yang perlu ditampilkan sebagai error.
    if (/relation .* does not exist|schema cache/i.test(error.message)) return { questions: [] };
    return { questions: [], error: error.message };
  }

  return { questions: (data ?? []).map((r) => rowToBankQuestion(r as PiInterviewQuestionRow)) };
}

export async function saveCustomQuestion(
  tenantId: string,
  cluster: string,
  draft: CustomQuestionDraft,
): Promise<{ question?: BankQuestion; error?: string }> {
  if (!supabase) return { error: "Penyimpanan belum tersedia." };

  const id = generateCustomQuestionId();
  const row: PiInterviewQuestionRow & { created_at: string; updated_at: string } = {
    id,
    tenant_id: tenantId,
    competency_id: draft.competencyId,
    competency_name: draft.competencyName,
    type: draft.type,
    question: draft.question.trim(),
    strong_answer: draft.strongAnswer.trim(),
    red_flags: draft.redFlags.filter((f) => f.trim().length > 0),
    cluster,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pi_interview_questions").insert(row);
  if (error) {
    return {
      error: /relation .* does not exist|schema cache/i.test(error.message)
        ? "Penyimpanan bank soal belum aktif di database."
        : error.message,
    };
  }
  return { question: rowToBankQuestion(row) };
}

export async function deleteCustomQuestion(id: string): Promise<{ error?: string }> {
  if (!supabase) return { error: "Penyimpanan belum tersedia." };
  const { error } = await supabase.from("pi_interview_questions").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
