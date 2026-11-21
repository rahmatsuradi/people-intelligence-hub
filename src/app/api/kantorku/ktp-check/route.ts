/* POST /api/kantorku/ktp-check { id } — khusus akun HR.
   Membaca ulang foto KTP satu isian (pi_employee_data_submissions) dan mencocokkannya dengan
   isian + master (ktp-check.ts). Dipakai tombol "Cek KTP" dan "Cek KTP semua" di tab Isian
   masuk — untuk isian lama (sebelum pemeriksaan otomatis ada) dan isian yang saat dikirim
   tidak sempat dibaca karena layanan AI sibuk.

   Isian tanpa foto KTP (link pribadi; KTP sudah ada di master) memakai foto KTP di profil.
   Hasil disimpan di files.ktp_check + tanda di flags; isian & master TIDAK diubah.
   429 = layanan AI sedang penuh (±3 KTP per menit di paket gratis Groq) → coba lagi
   setelah `retryAfter` detik. */

import { NextRequest, NextResponse } from "next/server";
import { requireHr } from "@/lib/require-hr";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkAgainstKtp, mergeKtpFlags, type KtpCheckRecord } from "@/lib/kantorku/ktp-check";
import { KTP_IMAGE_MIME, readKtpImage } from "@/lib/kantorku/ktp-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

export async function POST(request: NextRequest) {
  const who = await requireHr(request);
  if (who instanceof NextResponse) return who;
  const db = supabaseAdmin!;
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: "Isian tidak dikenal." }, { status: 400 });

  const { data: sub, error } = await db.from("pi_employee_data_submissions")
    .select("id, employee_id, answers, files, flags").eq("id", body.id).maybeSingle();
  if (error || !sub) return NextResponse.json({ error: "Isian tidak ditemukan." }, { status: 404 });
  const s = sub as { id: string; employee_id: string | null; answers: Record<string, string>; files: Record<string, unknown>; flags: string[] };

  // Nilai master (untuk isian link pribadi yang tidak mengetik ulang NIK dll.).
  const master: Record<string, string> = {};
  let profileKtp: string | null = null;
  if (s.employee_id) {
    const [e, p, h] = await Promise.all([
      db.from("pi_employees").select("full_name, nik").eq("id", s.employee_id).maybeSingle(),
      db.from("pi_employee_profiles").select("birth_date, gender, ktp_url").eq("employee_id", s.employee_id).maybeSingle(),
      db.from("pi_employee_hris").select("account_holder").eq("employee_id", s.employee_id).maybeSingle(),
    ]);
    for (const row of [e.data, p.data, h.data] as (Record<string, unknown> | null)[])
      for (const [k, v] of Object.entries(row ?? {})) if (typeof v === "string" && v.trim() && v !== "BELUM_DIISI") master[k] = v.trim();
    profileKtp = master.ktp_url ?? null;
    delete master.ktp_url;
  }

  // Foto KTP: dari isian ini, kalau tidak ada dari profil master.
  const path = typeof s.files?.ktp === "string" ? s.files.ktp
    : profileKtp?.startsWith("storage:pi-employee-docs/") ? profileKtp.slice("storage:pi-employee-docs/".length) : null;
  const answers = { ...master, ...s.answers };
  let record: KtpCheckRecord;
  let unchecked = false;
  if (!path) record = { reading: null, skipped: "tanpa_ktp", issues: checkAgainstKtp(answers, null) };
  else {
    const mime = MIME_BY_EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? "";
    if (!KTP_IMAGE_MIME.has(mime)) record = { reading: null, skipped: "pdf", issues: checkAgainstKtp(answers, null) };
    else {
      const dl = await db.storage.from("pi-employee-docs").download(path);
      if (dl.error || !dl.data) return NextResponse.json({ error: "Foto KTP tidak bisa dibuka dari penyimpanan." }, { status: 502 });
      const r = await readKtpImage(Buffer.from(await dl.data.arrayBuffer()), mime, { timeoutMs: 40_000 });
      if (!r.ok && r.reason === "ai_sibuk") return NextResponse.json({ error: "Layanan pembaca KTP sedang penuh.", retryAfter: r.retryAfter ?? 20 }, { status: 429 });
      if (!r.ok) { record = { reading: null, skipped: r.reason, issues: checkAgainstKtp(answers, null) }; unchecked = true; }
      else record = { reading: r.reading, issues: checkAgainstKtp(answers, r.reading) };
    }
  }

  const flags = mergeKtpFlags(s.flags ?? [], record.issues, unchecked);
  const files = { ...(s.files ?? {}), ktp_check: record };
  const up = await db.from("pi_employee_data_submissions").update({ files, flags }).eq("id", s.id);
  if (up.error) return NextResponse.json({ error: "Hasil cek gagal disimpan." }, { status: 500 });
  return NextResponse.json({ ok: true, check: record, flags });
}
