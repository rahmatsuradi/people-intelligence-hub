// Memverifikasi pemasangan modul Assessment ke database — bukan sekadar
// "SQL-nya sudah dijalankan", tapi memastikan hasilnya benar.
//
// Jalankan:
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/verify-assessment-setup.ts
//
// Empat hal yang diperiksa, dan alasan masing-masing:
//
// 1. TABEL ADA. Dicek lewat service-role (melewati RLS), sehingga "0 baris"
//    benar-benar berarti kosong, bukan tertutup policy.
//
// 2. SEED MASUK. Norma dan profil jabatan harus ada, kalau tidak setiap laporan
//    jatuh ke default di kode dan tidak ada yang bisa disunting per perusahaan.
//
// 3. NORMA MASIH JUJUR. Baris norma bawaan wajib berlabel 'synthetic_demo'
//    dengan sample_size 0. Kalau label ini pernah dinaikkan tanpa data, seluruh
//    persentil di laporan berubah artinya secara diam-diam.
//
// 4. RLS BENAR-BENAR MENUTUP. Diuji dengan kunci ANON — kunci yang ikut terkirim
//    ke browser. Ini pelajaran dari modul Pay: tabel bisa punya RLS aktif tanpa
//    satu pun policy, atau sebaliknya punya policy yang lupa dibatasi `to
//    authenticated` sehingga terbuka ke publik. Keduanya hanya ketahuan kalau
//    diuji, bukan dibaca dari file SQL-nya.
import { createClient } from "@supabase/supabase-js";

const TABLES = ["pi_assessment_norms", "pi_assessment_profiles", "pi_assessment_sessions"] as const;

let failures = 0;
const ok = (msg: string) => console.log(`  OK      ${msg}`);
const bad = (msg: string) => {
  failures++;
  console.log(`  GAGAL   ${msg}`);
};
const warn = (msg: string) => console.log(`  CATATAN ${msg}`);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) throw new Error("env Supabase tidak ada (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  /* 1. Tabel ada */
  console.log("\n[1/4] Tabel");
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    // Sengaja BUKAN { head: true }. Permintaan HEAD tidak membawa badan respons,
    // sehingga error PostgREST (mis. tabel belum ada) tidak terbaca dan
    // count-nya null — pemeriksaan jadi selalu "lolos" dengan 0 baris. Itu
    // false positive yang membuat verifikator ini lebih berbahaya daripada
    // tidak ada. GET biasa memaksa errornya muncul.
    const { count, error } = await admin.from(t).select("id", { count: "exact" }).limit(1);
    if (error) {
      bad(`${t} — ${error.message}`);
      continue;
    }
    counts[t] = count ?? 0;
    ok(`${t} ada (${count ?? 0} baris)`);
  }
  if (failures > 0) {
    console.log(
      "\nTabel belum terpasang. Jalankan supabase/assessment-module-ALL.sql di Supabase SQL Editor lebih dulu.",
    );
    process.exitCode = 1;
    return;
  }

  /* 2. Seed masuk */
  console.log("\n[2/4] Seed");
  if ((counts.pi_assessment_norms ?? 0) < 1) bad("belum ada satu pun kelompok norma — jalankan bagian seed");
  else ok(`${counts.pi_assessment_norms} kelompok norma`);

  const { data: profiles } = await admin.from("pi_assessment_profiles").select("id, name, requirements, source");
  const profileCount = profiles?.length ?? 0;
  if (profileCount < 9) bad(`baru ${profileCount} profil jabatan, seharusnya minimal 9 template bawaan`);
  else ok(`${profileCount} profil jabatan`);

  // Profil tanpa requirements tidak bisa menghitung kesesuaian apa pun.
  for (const p of profiles ?? []) {
    const reqs = (p as { requirements?: unknown[] }).requirements;
    if (!Array.isArray(reqs) || reqs.length === 0) bad(`profil ${p.id} tidak punya requirements`);
  }

  /* 3. Norma masih jujur */
  console.log("\n[3/4] Kejujuran label norma");
  const { data: norms } = await admin
    .from("pi_assessment_norms")
    .select("id, label, provenance, sample_size, entries");
  for (const n of norms ?? []) {
    const entries = (n as { entries?: unknown[] }).entries;
    const nEntries = Array.isArray(entries) ? entries.length : 0;
    if (n.provenance === "synthetic_demo") {
      if (n.sample_size !== 0) bad(`${n.id} berlabel sintetis tetapi sample_size = ${n.sample_size}`);
      else ok(`${n.id} — sintetis, sample_size 0, ${nEntries} skala (label jujur)`);
    } else if (n.provenance === "local_sample") {
      if (n.sample_size < 100) bad(`${n.id} mengaku sampel lokal tetapi n = ${n.sample_size} (< 100)`);
      else ok(`${n.id} — sampel lokal, n = ${n.sample_size}, ${nEntries} skala`);
    } else {
      bad(`${n.id} punya provenance tidak dikenal: '${n.provenance}'`);
    }
  }

  /* 4. RLS menutup akses anon */
  console.log("\n[4/4] RLS (diuji dengan kunci anon — kunci yang ikut ke browser)");
  if (!anonKey) {
    warn("NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ada, uji RLS dilewati");
  } else {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    for (const t of TABLES) {
      const { data, error } = await anon.from(t).select("*").limit(1);
      // Dua bentuk penolakan yang sah: error permission, atau 0 baris karena
      // tidak ada policy yang mengizinkan anon (default-deny).
      if (error) ok(`${t} menolak anon (${error.code || "error"})`);
      else if (!data || data.length === 0) ok(`${t} tidak mengembalikan baris ke anon`);
      else bad(`${t} TERBUKA untuk anon — ${data.length} baris terbaca tanpa login. Jalankan ulang assessment-module-rls.sql.`);
    }

    // Pemeriksaan tulis: anon yang bisa menyisipkan sesi bisa memalsukan hasil.
    const { error: insErr } = await anon.from("pi_assessment_sessions").insert({
      id: "AS-UJI-RLS-0000",
      tenant_id: "00000000-0000-4000-8000-000000000000",
      candidate_name: "uji rls",
      battery_id: "BAT-SCREEN",
      access_token: "uji-rls-token-jangan-dipakai-0000",
    });
    if (insErr) ok("anon tidak bisa menulis ke pi_assessment_sessions");
    else {
      bad("anon BISA menulis ke pi_assessment_sessions — hasil asesmen bisa dipalsukan dari browser.");
      await admin.from("pi_assessment_sessions").delete().eq("id", "AS-UJI-RLS-0000");
      console.log("          (baris uji sudah dihapus kembali)");
    }
  }

  console.log(
    failures === 0
      ? "\nSemua pemeriksaan lolos. Modul Assessment siap dipakai: buka /assessment lalu undang kandidat."
      : `\n${failures} pemeriksaan GAGAL — perbaiki dulu sebelum mengundang kandidat.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
