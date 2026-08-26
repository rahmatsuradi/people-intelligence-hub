// Uji ujung-ke-ujung modul Assessment melewati JALUR NYATA, bukan engine saja:
// buat sesi di database -> ambil soal lewat API publik -> kirim jawaban per
// bagian -> baca laporan yang tersimpan.
//
// Jalankan (dev server harus hidup):
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/e2e-assessment-smoke.ts [baseUrl]
//
// Yang dibuktikan di sini dan tidak bisa dibuktikan unit test:
// - RLS dan service-role benar-benar mengizinkan alur yang dimaksud
// - route publik /api/assessment/session bekerja tanpa login
// - API TIDAK membocorkan kunci jawaban / nilai efektivitas / skor ke peserta
// - laporan benar-benar tersimpan sebagai snapshot di kolom `report`
//
// Sesi yang dibuat memakai nama kandidat sintetis dan dihapus di akhir, kecuali
// dijalankan dengan argumen --keep (untuk melihat hasilnya di UI).
import { createClient } from "@supabase/supabase-js";
import { BATTERY_FULL } from "../src/lib/assessment/batteries";
import { PERSONALITY_SECTION_ITEMS, ATTENTION_CHECK_KEY } from "../src/lib/assessment/items-personality";
import { COGNITIVE_ITEMS_BY_SUBTEST } from "../src/lib/assessment/items-cognitive";
import { SJT_ITEMS } from "../src/lib/assessment/items-sjt";
import { generateAccessToken, generateSessionId, defaultExpiry } from "../src/lib/assessment/assessment-data";
import type { PiAssessmentSessionRow } from "../src/lib/assessment/assessment-data";
import { COMPANY_LENCIR } from "../src/lib/payroll/company-profile";

const TENANT_ID = COMPANY_LENCIR.id;
const KEEP = process.argv.includes("--keep");
const baseUrl = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");

let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "OK    " : "GAGAL "} ${msg}`);
  if (!cond) failures++;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("env Supabase tidak ada");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const sessionId = generateSessionId();
  const token = generateAccessToken();

  /* ── 1. Buat sesi (yang dilakukan konsol HR saat menekan Undang) ── */
  console.log("\n[1/5] Membuat sesi asesmen");
  const { error: insErr } = await supabase.from("pi_assessment_sessions").insert({
    id: sessionId,
    tenant_id: TENANT_ID,
    candidate_name: "Uji Ujung-ke-Ujung (sintetis)",
    candidate_email: "uji@contoh.test",
    position: "Supervisor Produksi",
    battery_id: BATTERY_FULL.id,
    profile_id: "JP-SUPERVISOR",
    access_token: token,
    status: "invited",
    invited_at: new Date().toISOString(),
    expires_at: defaultExpiry(),
    responses: {},
    timings: [],
  });
  check(!insErr, insErr ? `insert gagal: ${insErr.message}` : `sesi ${sessionId} dibuat`);
  const cleanup = async () => { await supabase.from("pi_assessment_sessions").delete().eq("id", sessionId); };
  if (insErr) return finish(cleanup, sessionId);

  /* ── 2. Ambil soal lewat API publik (tanpa login) ── */
  console.log("\n[2/5] Mengambil soal lewat API publik");
  const getRes = await fetch(`${baseUrl}/api/assessment/session?token=${encodeURIComponent(token)}`);
  const loaded = await getRes.json();
  check(getRes.ok && loaded.success === true, `GET ${getRes.status}`);
  check(loaded.candidateName === "Uji Ujung-ke-Ujung (sintetis)", "nama kandidat terbaca");
  const sections = loaded.battery?.sections ?? [];
  check(sections.length === BATTERY_FULL.sections.length, `${sections.length} bagian soal diterima`);

  /* ── 3. Pastikan kunci jawaban TIDAK ikut terkirim ── */
  console.log("\n[3/5] Memastikan kunci jawaban tidak bocor ke peserta");
  const payload = JSON.stringify(loaded);
  check(!/"answerIndex"\s*:/.test(payload), "tidak ada kunci jawaban kognitif di respons");
  check(!/"rationale"\s*:/.test(payload), "tidak ada penjelasan kunci di respons");
  check(!/"keying"\s*:/.test(payload), "tidak ada arah keying item kepribadian di respons");
  // Kata 'effectiveness' MEMANG muncul di respons sebagai nama format item
  // ("sjt_effectiveness"), jadi pencarian substring polos menghasilkan alarm
  // palsu. Yang harus dipastikan adalah NILAI-nya tidak ikut: tidak ada field
  // bernama effectiveness, dan setiap opsi SJT terkirim sebagai teks polos —
  // bukan objek yang membawa angka kunci.
  check(!/"effectiveness"\s*:/.test(payload), "tidak ada field nilai efektivitas SJT di respons");
  const sjtSection = sections.find((s: { id: string }) => s.id === "sec-sjt");
  check(
    !!sjtSection &&
      sjtSection.items.every((i: { options: unknown[] }) => i.options.every((o) => typeof o === "string")),
    "setiap opsi SJT terkirim sebagai teks polos, tanpa angka kunci",
  );
  // Dicocokkan ke isi sebenarnya: penjelasan kunci soal pertama tidak boleh ada.
  check(!payload.includes(COGNITIVE_ITEMS_BY_SUBTEST.NUM[0].rationale), "penjelasan kunci soal numerik pertama tidak ikut terkirim");

  /* ── 4. Kirim jawaban per bagian, seperti peserta sungguhan ── */
  console.log("\n[4/5] Mengirim jawaban per bagian");
  const answers = buildAnswers();
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const sectionAnswers: Record<string, number> = {};
    for (const it of s.items) if (answers[it.id] !== undefined) sectionAnswers[it.id] = answers[it.id];

    const res = await fetch(`${baseUrl}/api/assessment/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        sectionId: s.id,
        responses: sectionAnswers,
        elapsedSec: s.id === "sec-personality" ? 700 : 420,
        startedAt: new Date().toISOString(),
        final: i === sections.length - 1,
      }),
    });
    const json = await res.json();
    check(res.ok && json.success === true, `bagian ${i + 1}/${sections.length} "${s.title}" terkirim`);
    // Peserta tidak boleh menerima skor apa pun dalam respons.
    check(!JSON.stringify(json).match(/sten|percentile|fitScore|skor/i), `  respons bagian ${i + 1} tidak memuat skor`);
  }

  /* ── 5. Baca laporan yang tersimpan ── */
  console.log("\n[5/5] Membaca laporan tersimpan");
  const { data } = await supabase
    .from("pi_assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<PiAssessmentSessionRow>();

  check(data?.status === "completed", `status sesi = ${data?.status}`);
  const report = data?.report;
  check(!!report, "kolom report terisi (snapshot laporan)");
  if (report) {
    check(report.scores.length > 10, `${report.scores.length} skala berskor`);
    check(!!report.fit, "kesesuaian jabatan dihitung");
    check(report.limitations.length >= 5, `${report.limitations.length} batasan penggunaan tercetak`);
    check(report.normProvenance === "synthetic_demo", "norma ditandai sintetis di laporan");

    const cog = report.scores.find((s) => s.scaleId === "COG_TOTAL");
    console.log("\n  Ringkasan hasil:");
    console.log(`    Kognitif umum : sten ${cog?.sten} (persentil ${cog?.percentile})`);
    console.log(`    Kualitas isi  : ${report.validity.overall}`);
    console.log(`    Kesesuaian    : ${report.fit?.fitScore}/100 — ${report.fit?.verdict}`);
    console.log(`    Laporan HR    : ${baseUrl}/assessment/${sessionId}`);
  }

  await finish(cleanup, sessionId);
}

/** Jawaban kandidat tiruan yang mengerjakan dengan sungguh-sungguh. */
function buildAnswers(): Record<string, number> {
  const r: Record<string, number> = {};
  const KEYED: Record<string, number> = { O: 4, C: 5, E: 4, A: 4, N: 2 };
  for (const it of PERSONALITY_SECTION_ITEMS) {
    if (it.qc === "attention") { r[it.id] = ATTENTION_CHECK_KEY[it.id]; continue; }
    if (it.qc === "desirability") { r[it.id] = 2; continue; }
    const t = KEYED[it.scale];
    r[it.id] = it.keying === 1 ? t : 6 - t;
  }
  for (const sub of ["NUM", "VER", "LOG"] as const) {
    COGNITIVE_ITEMS_BY_SUBTEST[sub].forEach((it, i) => {
      r[it.id] = i < 8 ? it.answerIndex : (it.answerIndex + 1) % it.options.length;
    });
  }
  for (const it of SJT_ITEMS) {
    r[it.id] = it.options.reduce((bi, o, i, arr) => (o.effectiveness > arr[bi].effectiveness ? i : bi), 0);
  }
  return r;
}

// Menerima fungsi penghapus, bukan client-nya: tipe generik SupabaseClient
// berubah-ubah antar versi dan menuliskannya di tanda tangan fungsi hanya
// menimbulkan galat tipe yang tidak ada hubungannya dengan isi uji ini.
async function finish(cleanup: () => Promise<void>, sessionId: string) {
  if (KEEP) {
    console.log(`\nSesi ${sessionId} DIBIARKAN di database (--keep) agar bisa dilihat di UI.`);
  } else {
    await cleanup();
    console.log(`\nSesi uji ${sessionId} dihapus kembali.`);
  }
  console.log(failures === 0 ? "Semua pemeriksaan lolos." : `${failures} pemeriksaan GAGAL.`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
