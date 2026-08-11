// Membangun NORMA LOKAL dari sesi asesmen yang sudah selesai, lalu menuliskan
// SQL insert-nya. Menutup lingkaran yang dijanjikan modul: norma sintetis
// digantikan norma dari populasi pelamar yang sebenarnya.
//
// Jalankan:
//   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/build-assessment-norms.ts [tenantId]
//
// Yang dilakukan script ini, dan alasannya:
//
// 1. MENGHITUNG ULANG skor mentah dari `responses`, bukan membaca `report`.
//    Laporan tersimpan adalah snapshot yang dibuat dengan norma saat itu; yang
//    dibutuhkan untuk membangun norma justru skor MENTAH-nya.
//
// 2. MEMBUANG sesi dengan kualitas jawaban 'meragukan'. Norma yang dibangun dari
//    peserta yang mengisi asal-asalan akan menggeser rata-rata dan menggelembungkan
//    SD — akibatnya kandidat yang mengerjakan sungguh-sungguh terlihat luar biasa
//    hanya karena pembandingnya buruk. Ini keputusan paling penting di file ini.
//
// 3. MEMISAHKAN per baterai tidak dilakukan; yang dipisah adalah per SKALA. Satu
//    skala hanya diskor bila baterai yang dikerjakan memang memuat itemnya, jadi
//    peserta baterai penyaringan tidak ikut menyumbang norma skala kepribadian.
//
// 4. TIDAK menulis ke database. Keluarannya berupa file SQL yang harus dibaca
//    manusia lebih dulu — mengganti dasar pembanding seluruh keputusan seleksi
//    bukan hal yang pantas terjadi otomatis dari sebuah script.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scoreAll } from "../src/lib/assessment/scoring";
import { buildValidityReport } from "../src/lib/assessment/validity";
import { buildNormGroupFromSample, MIN_LOCAL_NORM_N, type NormSampleRow } from "../src/lib/assessment/norms";
import { presentedItemIds } from "../src/lib/assessment/assessment-data";
import type { PiAssessmentSessionRow } from "../src/lib/assessment/assessment-data";
import { SCALE_BY_ID } from "../src/lib/assessment/scales";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("env Supabase tidak ada (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const tenantId = process.argv[2];

  let query = supabase.from("pi_assessment_sessions").select("*").eq("status", "completed");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw new Error(`gagal membaca sesi: ${error.message}`);

  const sessions = (data ?? []) as PiAssessmentSessionRow[];
  console.log(`Sesi selesai ditemukan: ${sessions.length}${tenantId ? ` (tenant ${tenantId})` : " (semua tenant)"}`);

  const rows: NormSampleRow[] = [];
  let excluded = 0;

  for (const s of sessions) {
    const itemIds = presentedItemIds(s.battery_id);
    if (itemIds.length === 0) {
      console.warn(`  ! sesi ${s.id}: baterai '${s.battery_id}' tidak dikenal, dilewati`);
      continue;
    }

    const validity = buildValidityReport(s.responses ?? {}, itemIds, s.timings ?? []);
    if (validity.overall === "meragukan") {
      excluded++;
      continue;
    }

    for (const sc of scoreAll(s.responses ?? {}, itemIds)) {
      // Skala yang hampir tidak dijawab tidak layak menyumbang norma: nilainya
      // hasil prorata dari sedikit sekali item.
      if (sc.answered < sc.itemCount * 0.8) continue;
      rows.push({ scaleId: sc.scaleId, raw: sc.raw });
    }
  }

  console.log(`Sesi dibuang karena kualitas jawaban meragukan: ${excluded}`);

  const perScale = new Map<string, number>();
  for (const r of rows) perScale.set(r.scaleId, (perScale.get(r.scaleId) ?? 0) + 1);
  console.log("Jumlah peserta per skala:");
  for (const [scaleId, n] of [...perScale].sort()) {
    const flag = n >= MIN_LOCAL_NORM_N ? "OK " : "KURANG";
    console.log(`  ${flag}  ${scaleId.padEnd(14)} n = ${n}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const id = `NORM-LOKAL-${today.replace(/-/g, "")}`;
  const group = buildNormGroupFromSample(rows, {
    id,
    label: `Norma lokal — pelamar${tenantId ? ` tenant ${tenantId.slice(0, 8)}` : ""} (per ${today})`,
    effectiveDate: today,
    notes: `Dibangun dari ${sessions.length - excluded} sesi valid; ${excluded} sesi dibuang karena kualitas jawaban meragukan.`,
  });

  if (!group) {
    console.error(
      `\nBELUM CUKUP. Minimal ${MIN_LOCAL_NORM_N} peserta per skala diperlukan sebelum norma lokal layak dipakai.\n` +
        `Norma dari sampel kecil lebih menyesatkan daripada tidak punya norma sama sekali — SD-nya tidak stabil,\n` +
        `sehingga persentil kandidat akan berayun besar hanya karena tambahan beberapa peserta.\n` +
        `Terus pakai norma sintetis untuk sementara, dan baca sten sebagai urutan antar-kandidat.`,
    );
    process.exitCode = 1;
    return;
  }

  const esc = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const sql = `-- Norma lokal hasil generate ${new Date().toISOString()}
-- Sumber: ${sessions.length - excluded} sesi asesmen selesai berkualitas jawaban memadai.
--
-- BACA DULU SEBELUM DIJALANKAN. Baris ini menjadi dasar pembanding untuk seluruh
-- laporan berikutnya. Periksa apakah sampelnya memang mewakili populasi pelamar
-- yang akan datang (posisi, level, wilayah). Norma dari 120 pelamar operator
-- tidak sah dipakai menilai kandidat manajer.
--
-- Ini INSERT baris baru, bukan UPDATE. Baris norma lama sengaja dibiarkan hidup
-- supaya laporan yang sudah terbit tetap bisa dihitung ulang dengan angka yang sama.

insert into pi_assessment_norms (id, tenant_id, label, provenance, sample_size, effective_date, entries, notes)
values (
  ${esc(group.id)},
  ${tenantId ? esc(tenantId) : "null"},
  ${esc(group.label)},
  'local_sample',
  ${group.sampleSize},
  ${esc(group.effectiveDate)},
  ${esc(JSON.stringify(group.entries))}::jsonb,
  ${esc(group.notes ?? "")}
)
on conflict (id) do nothing;
`;

  const outPath = join(process.cwd(), "supabase", `assessment-norms-${id.toLowerCase()}.sql`);
  writeFileSync(outPath, sql, "utf8");

  console.log(`\nNorma lokal dibangun (n = ${group.sampleSize}), ${group.entries.length} skala:`);
  for (const e of group.entries) {
    console.log(`  ${(SCALE_BY_ID[e.scaleId]?.name ?? e.scaleId).padEnd(34)} mean ${String(e.mean).padStart(6)}  SD ${e.sd}`);
  }
  console.log(`\nSQL ditulis ke ${outPath}`);
  console.log("Periksa isinya, lalu jalankan di Supabase SQL Editor bila sampelnya memang representatif.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
