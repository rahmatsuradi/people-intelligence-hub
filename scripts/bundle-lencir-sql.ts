// Menggabungkan struktur lengkap + tarif statutori + norma/profil asesmen bawaan
// menjadi SATU file untuk database instance baru (mis. Lencir) yang ditempel
// sekali jalan di Supabase SQL Editor.
//
// Kenapa ada: instance baru tidak boleh dibangun dari urutan file sejarah
// (schema.sql -> pay-module-* -> ... ), karena dua bagian struktur hanya pernah
// diterapkan lewat migrasi langsung. lencir-structure.sql adalah potret utuh;
// dua file seed di bawah adalah DATA REFERENSI (tarif pemerintah, template
// profil jabatan), bukan data perusahaan.
//
// Jalankan: node node_modules/tsx/dist/cli.mjs scripts/bundle-lencir-sql.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase");

// Urutan TIDAK boleh diubah: struktur dulu, baru data referensi.
const PARTS = [
  "lencir-structure.sql",
  "pay-module-seed.sql",
  "assessment-module-seed.sql",
] as const;

const banner = `-- ============================================================
-- People Intelligence — INSTANCE BARU: PEMASANGAN SEKALI JALAN
--
-- FILE INI DI-GENERATE dengan menggabungkan tiga file di bawah, apa adanya:
${PARTS.map((p) => `--   ${p}`).join("\n")}
-- Regenerasi: node node_modules/tsx/dist/cli.mjs scripts/bundle-lencir-sql.ts
--
-- Cara pakai: Supabase SQL Editor -> New query -> tempel seluruh isi file ini
-- -> Run. Hanya untuk database KOSONG (ada penjaga di awal yang menolak
-- database yang sudah berisi). Seluruhnya satu transaksi: kalau satu langkah
-- gagal, tidak ada yang terpasang setengah-setengah.
--
-- Setelah sukses, hasil terakhir menampilkan lima baris pemeriksaan; kolom
-- "jumlah" harus sama dengan "seharusnya". Lalu jalankan lencir-first-hr.sql.
-- ============================================================

begin;

`;

const body = PARTS.map((name) => {
  const content = readFileSync(join(dir, name), "utf8").trimEnd();
  return `-- ════════════════════════════════════════════════════════════\n-- BAGIAN: ${name}\n-- ════════════════════════════════════════════════════════════\n\n${content}\n`;
}).join("\n\n");

// Dijalankan SETELAH commit supaya hasil yang tampil di SQL Editor adalah tabel
// pemeriksaan ini, bukan pesan "Success. No rows returned".
const footer = `

commit;

-- ════════════════════════════════════════════════════════════
-- PEMERIKSAAN — kolom "jumlah" harus sama dengan "seharusnya"
-- ════════════════════════════════════════════════════════════
select 'tabel' as item, count(*)::int as jumlah, 25 as seharusnya
  from pg_tables where schemaname = 'public'
union all select 'aturan akses (policy)', count(*)::int, 46
  from pg_policies where schemaname = 'public'
union all select 'tarif statutori', count(*)::int, 2 from pi_statutory_config
union all select 'kelompok pembanding asesmen', count(*)::int, 1 from pi_assessment_norms
union all select 'profil jabatan bawaan', count(*)::int, 9 from pi_assessment_profiles;
`;

const sql = banner + body + footer;

const outPath = join(dir, "lencir-bootstrap.sql");
writeFileSync(outPath, sql, "utf8");

console.log(`Ditulis: ${outPath}`);
console.log(`Gabungan dari ${PARTS.length} file, ${sql.split("\n").length} baris.`);
