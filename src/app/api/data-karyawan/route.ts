/* ═══════════════════════════════════════════════════════════════════════════
   /api/data-karyawan — PUBLIK, dipakai formulir /data-karyawan/<token>
   (pengganti Google Form "Employee Database").

   Pengisi tidak punya akun → service-role di server, pola sama dengan /api/survei.
     GET  ?token=…  → pertanyaan + pilihan; untuk link pribadi juga data lama yang
                      ditampilkan kembali. Data sensitif (NIK, rekening, HP, alamat, …)
                      TIDAK dikirim balik — hanya tanda "sudah tercatat" dan 4 digit
                      terakhir, karena link bisa saja diteruskan ke orang lain.
     POST { token, answers, files, website, confirmKtp } → simpan SATU isian + dokumen.
          Sebelum disimpan, isian dicocokkan dengan NIK-nya sendiri dan dengan foto KTP yang
          diunggah (ktp-check.ts). Bila ada yang janggal dan pengisi belum menekan "Kirim tetap"
          (confirmKtp), dibalas 409 + daftar masalah — tidak ada yang disimpan.
   Isian tidak pernah langsung menimpa master; HR yang menerapkannya di /karyawan/kantorku.
   ═══════════════════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { builtinUnits } from "@/lib/kantorku/template";
import { mapBank } from "@/lib/kantorku/map";
import {
  DOC_KINDS, DOC_MAX_BYTES, DOC_MIME, INTAKE_FIELDS, bankOptions, maskTail, validateIntake, type DocKind,
} from "@/lib/kantorku/intake";
import { checkAgainstKtp, mergeKtpFlags, needsConfirmation, type KtpCheckRecord, type KtpReading } from "@/lib/kantorku/ktp-check";
import { KTP_IMAGE_MIME, readKtpImage } from "@/lib/kantorku/ktp-ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pembacaan foto KTP (±3–10 detik) ikut dalam kiriman.
export const maxDuration = 60;

/* Penahan spam per IP. Longgar karena satu outlet/kantor/Wi-Fi = satu IP publik, dan operator
   seluler berbagi IP antar-pelanggan (CGNAT): 300+ karyawan bisa mengisi bersamaan dari
   segelintir IP. Token link tetap jadi pengaman utama. */
const LIMIT = { get: { max: 2000, windowMs: 60_000 }, post: { max: 500, windowMs: 10 * 60_000 } } as const;
const hits = new Map<string, number[]>();
function limited(req: NextRequest, key: keyof typeof LIMIT): boolean {
  const { max, windowMs } = LIMIT[key];
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const k = `${key}:${ip}`;
  const now = Date.now();
  if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(kk);
  const recent = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(k, recent); return true; }
  recent.push(now);
  hits.set(k, recent);
  return false;
}

/** Ditampilkan apa adanya di link pribadi (data kerja, bukan data rahasia). */
const PREFILL = new Set(["full_name", "nickname", "birth_place", "gender", "religion", "blood_type", "marital_status",
  "education_level", "education_institution", "education_major", "join_date", "position", "department", "outlet", "supervisor_name",
  "emergency_relation", "bank_code"]);

interface LinkRow { id: string; tenant_id: string; employee_id: string | null; status: string; expires_at: string | null }

async function findLink(token: string): Promise<{ link?: LinkRow; error?: NextResponse }> {
  if (!supabaseAdmin) return { error: NextResponse.json({ error: "Formulir belum bisa dipakai. Hubungi HR." }, { status: 503 }) };
  /* Link pribadi = hex acak (tidak bisa ditebak). Link umum boleh bernama terbaca ("data-karyawan-rica-rico"):
     isiannya memang terbuka untuk siapa pun yang diberi link, dan tetap diperiksa HR sebelum diterapkan. */
  if (token.length > 80 || !/^([a-f0-9]{32,64}|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(token)) return { error: NextResponse.json({ error: "Link tidak dikenal." }, { status: 404 }) };
  const { data, error } = await supabaseAdmin.from("pi_employee_data_links").select("id, tenant_id, employee_id, status, expires_at").eq("token", token).maybeSingle();
  if (error) return { error: NextResponse.json({ error: "Formulir belum bisa dipakai. Hubungi HR." }, { status: 503 }) };
  const link = data as LinkRow | null;
  if (!link) return { error: NextResponse.json({ error: "Link tidak dikenal." }, { status: 404 }) };
  if (link.status !== "open" || (link.expires_at && new Date(link.expires_at) < new Date()))
    return { error: NextResponse.json({ error: "Link ini sudah ditutup. Minta link baru ke HR." }, { status: 410 }) };
  return { link };
}

/** Nilai master saat ini, dengan key yang sama dengan pertanyaan formulir. */
async function currentValues(employeeId: string): Promise<{ values: Record<string, string>; docs: Record<DocKind, boolean> } | null> {
  const db = supabaseAdmin!;
  const [e, p, h] = await Promise.all([
    db.from("pi_employees").select("full_name, nik, npwp, join_date, position, bank_account, status").eq("id", employeeId).maybeSingle(),
    db.from("pi_employee_profiles").select("*, pi_outlets(name)").eq("employee_id", employeeId).maybeSingle(),
    db.from("pi_employee_hris").select("account_holder, bpjs_tk_number, bpjs_kes_number, department").eq("employee_id", employeeId).maybeSingle(),
  ]);
  if (!e.data) return null;
  const prof = (p.data ?? {}) as Record<string, unknown> & { pi_outlets?: { name: string } | null };
  const raw: Record<string, unknown> = { ...prof, ...(h.data ?? {}), ...e.data };
  raw.outlet = prof.pi_outlets?.name ?? prof.placement_note ?? null;
  raw.bank_code = mapBank(prof.bank_name as string | null) ?? null;
  const values: Record<string, string> = {};
  for (const f of INTAKE_FIELDS) {
    const v = raw[f.key];
    if (typeof v === "string" && v.trim() && v !== "BELUM_DIISI") values[f.key] = v.trim();
  }
  const docs = { ktp: !!prof.ktp_url, kk: !!prof.kk_url, photo: !!prof.photo_url };
  return { values, docs };
}

export async function GET(request: NextRequest) {
  if (limited(request, "get")) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." }, { status: 429 });
  const { link, error } = await findLink(request.nextUrl.searchParams.get("token") ?? "");
  if (error) return error;
  const db = supabaseAdmin!;
  const [{ data: outlets }] = await Promise.all([
    db.from("pi_outlets").select("name").eq("tenant_id", link!.tenant_id).eq("status", "active").order("name"),
    db.from("pi_employee_data_links").update({ last_opened_at: new Date().toISOString() }).eq("id", link!.id),
  ]);

  let prefill: Record<string, string> = {};
  let recorded: Record<string, string> = {}; // key → "sudah tercatat" (+ 4 digit terakhir bila angka)
  let docs: Record<DocKind, boolean> = { ktp: false, kk: false, photo: false };
  if (link!.employee_id) {
    const cur = await currentValues(link!.employee_id);
    if (cur) {
      docs = cur.docs;
      for (const [k, v] of Object.entries(cur.values)) {
        if (PREFILL.has(k)) prefill[k] = v;
        else {
          const f = INTAKE_FIELDS.find((x) => x.key === k);
          recorded[k] = f?.type === "digits" || f?.type === "tel" ? maskTail(v) ?? "tercatat" : "tercatat";
        }
      }
    } else { prefill = {}; recorded = {}; }
  }
  return NextResponse.json({
    mode: link!.employee_id ? "pribadi" : "umum",
    fields: INTAKE_FIELDS,
    departments: builtinUnits()?.departments ?? [],
    banks: bankOptions(),
    outlets: ((outlets ?? []) as { name: string }[]).map((o) => o.name),
    prefill, recorded, docs,
    docKinds: DOC_KINDS,
  });
}

interface FileIn { type?: string; data?: string }

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function POST(request: NextRequest) {
  if (limited(request, "post")) return NextResponse.json({ error: "Terlalu banyak kiriman dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { token?: string; answers?: Record<string, unknown>; files?: Partial<Record<DocKind, FileIn>>; website?: string; confirmKtp?: boolean } | null;
  if (!body) return NextResponse.json({ error: "Kiriman tidak terbaca. Coba lagi." }, { status: 400 });
  if (body.website) return NextResponse.json({ ok: true }); // isian jebakan bot
  const { link, error } = await findLink(body.token ?? "");
  if (error) return error;
  const db = supabaseAdmin!;

  // Link pribadi: field yang sudah tercatat di master boleh dikosongkan (= tidak berubah).
  const cur = link!.employee_id ? await currentValues(link!.employee_id) : null;
  const keep = new Set(Object.keys(cur?.values ?? {}));
  const { clean, errors } = validateIntake(body.answers ?? {}, { departments: builtinUnits()?.departments ?? [] }, keep);

  // Dokumen: wajib kecuali sudah ada di master. Diperiksa jenis & ukurannya di sini, bukan di browser.
  const files: Partial<Record<DocKind, { bytes: Buffer; type: string }>> = {};
  for (const d of DOC_KINDS) {
    const f = body.files?.[d.key];
    if (!f?.data) { if (!cur?.docs[d.key]) errors[d.key] = "Wajib diunggah"; continue; }
    const type = String(f.type ?? "");
    if (!(DOC_MIME as readonly string[]).includes(type)) { errors[d.key] = "Hanya foto (JPG/PNG) atau PDF"; continue; }
    const bytes = Buffer.from(String(f.data).replace(/^data:[^,]*,/, ""), "base64");
    if (!bytes.length || bytes.length > DOC_MAX_BYTES) { errors[d.key] = "Ukuran berkas terlalu besar (maks 1 MB)"; continue; }
    files[d.key] = { bytes, type };
  }
  if (Object.keys(errors).length) return NextResponse.json({ error: "Masih ada isian yang perlu diperbaiki.", errors }, { status: 400 });

  /* Cocokkan dengan KTP. Pengisi hanya diberi tahu soal isian yang ia ketik sendiri (`clean`):
     di link pribadi, NIK yang tidak diketik ulang berasal dari master dan tidak boleh
     dikirim balik ke browser (link bisa diteruskan). HR mendapat perbandingan lengkap. */
  let reading: KtpReading | null = null;
  let skipped: KtpCheckRecord["skipped"];
  if (!files.ktp) skipped = "tanpa_ktp";
  else if (!KTP_IMAGE_MIME.has(files.ktp.type)) skipped = "pdf";
  else {
    const r = await readKtpImage(files.ktp.bytes, files.ktp.type);
    if (r.ok) reading = r.reading; else skipped = r.reason;
  }
  const userIssues = checkAgainstKtp(clean, reading);
  if (!body.confirmKtp && needsConfirmation(userIssues))
    return NextResponse.json({
      error: "Data Anda belum cocok dengan KTP. Periksa dulu, atau tekan \"Kirim tetap\" kalau sudah benar.",
      ktp: { issues: userIssues.map(({ field, message }) => ({ field, message })) },
    }, { status: 409 });
  const hrIssues = checkAgainstKtp({ ...(cur?.values ?? {}), ...clean }, reading);
  const ktpCheck: KtpCheckRecord = { reading, ...(skipped ? { skipped } : {}), issues: hrIssues };

  // Tanda untuk HR — tidak pernah menggabungkan otomatis.
  const flags: string[] = mergeKtpFlags([], hrIssues, skipped === "ai_sibuk" || skipped === "ai_galat");
  if (body.confirmKtp && needsConfirmation(userIssues)) flags.push("dikirim_tetap_walau_beda_ktp");
  let employeeId = link!.employee_id;
  if (clean.nik) {
    const { data: same } = await db.from("pi_employees").select("id").eq("tenant_id", link!.tenant_id).eq("nik", clean.nik).limit(3);
    const ids = ((same ?? []) as { id: string }[]).map((r) => r.id);
    if (!employeeId && ids.length === 1) { employeeId = ids[0]; flags.push("cocok_nik"); }
    if (!link!.employee_id && ids.length > 1) flags.push("nik_ganda_di_master");
    if (link!.employee_id && ids.some((id) => id !== link!.employee_id)) flags.push("nik_milik_karyawan_lain");
  }
  if (!link!.employee_id) flags.push("link_umum");
  if (employeeId) {
    const { count } = await db.from("pi_employee_data_submissions").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "baru");
    if (count) flags.push("ada_isian_lain_belum_diterapkan");
  }

  const ins = await db.from("pi_employee_data_submissions")
    .insert({ tenant_id: link!.tenant_id, link_id: link!.id, employee_id: employeeId, answers: clean, flags })
    .select("id").single();
  if (ins.error || !ins.data) return NextResponse.json({ error: "Gagal menyimpan. Coba lagi sebentar." }, { status: 500 });
  const sid = (ins.data as { id: string }).id;

  const stored: Partial<Record<DocKind, string>> = {};
  const failed: string[] = [];
  for (const [kind, f] of Object.entries(files) as [DocKind, { bytes: Buffer; type: string }][]) {
    const path = `${link!.tenant_id}/${sid}/${kind}.${EXT[f.type]}`;
    const up = await db.storage.from("pi-employee-docs").upload(path, f.bytes, { contentType: f.type, upsert: true });
    if (up.error) failed.push(kind); else stored[kind] = path;
  }
  await db.from("pi_employee_data_submissions")
    .update({ files: { ...stored, ktp_check: ktpCheck }, flags: failed.length ? [...flags, "dokumen_gagal_tersimpan"] : flags }).eq("id", sid);
  await db.from("pi_employee_data_links").update({ last_submitted_at: new Date().toISOString() }).eq("id", link!.id);

  if (failed.length) {
    const label = failed.map((k) => DOC_KINDS.find((d) => d.key === k)?.label).join(", ");
    return NextResponse.json({ ok: true, warning: `Data tersimpan, tapi ${label} gagal terunggah. Kirim berkasnya ke HR lewat WhatsApp.` });
  }
  return NextResponse.json({ ok: true });
}
